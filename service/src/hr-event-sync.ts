import { hashPassword } from "./auth";
import { getServiceAccountAccessToken } from "./hr-source";
import { readHrEmployees, type HrEmployeeReadResult, type StoredHrSource } from "./hr-sync";
import { refreshPickerProjectionBestEffort } from "./firestore-projection";

interface HrEventEnv {
  APP_ENV: string;
  FIREBASE_PROJECT_ID: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
  PICKER_DEFAULT_PASSWORD?: string;
  ROOT_BOOTSTRAP_PASSWORD?: string;
}

type HrActor = {
  user_id: string;
  employee_code: string | null;
  display_name?: string;
  role: "ADMIN" | "ROOT";
  base_role?: "ADMIN" | "ROOT";
};

type HrWatchState = {
  sheet_id?: string;
  channel_id?: string;
  resource_id?: string;
  channel_token?: string;
  expires_at_ms?: number;
  registered_at?: string;
};

type HrPlan = {
  total_source?: number;
  create?: number;
  rename?: number;
  contractor_update?: number;
  existing_info_updates?: number;
  existing_picker_count?: number;
  unchanged?: number;
  inactive_existing?: number;
  not_in_source?: number;
  collisions?: Array<{ employee_code?: string; role?: string; user_id?: string }>;
};

type HrSyncState = {
  status?: string;
  decision?: string;
  fingerprint?: string;
  pending_fingerprint?: string;
  source_row_count?: number;
  last_accepted_row_count?: number;
  last_accepted_fingerprint?: string;
  plan?: HrPlan;
  hard_block_code?: string | null;
  invalid_row_details?: Array<{ row: number; reasons: string[] }>;
  duplicate_employee_codes?: string[];
  updated_at?: string;
  updated_by?: string;
  trigger?: string;
  wait_started_at?: string;
};

const DRIVE_READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const WATCH_CALLBACK = "https://inventory-beta.supra.cc.cd/api/internal/d161/hr-drive-watch";
const WATCH_LIFETIME_MS = 12 * 60 * 60_000;
const WATCH_RENEW_AHEAD_MS = 60 * 60_000;

function core(env: HrEventEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

async function coreJson<T>(env: HrEventEnv, path: string, init?: RequestInit): Promise<T> {
  const response = await core(env).fetch(`https://inventory-core.internal${path}`, init);
  const payload = await response.json() as T;
  if (!response.ok) throw new Error(`HR_CORE_HTTP_${response.status}`);
  return payload;
}

async function readSource(env: HrEventEnv): Promise<StoredHrSource | null> {
  const payload = await coreJson<{ configured?: boolean; source?: StoredHrSource | null }>(env, "/config/hr-source");
  return payload.configured && payload.source ? payload.source : null;
}

async function readWatch(env: HrEventEnv): Promise<HrWatchState | null> {
  const payload = await coreJson<{ configured?: boolean; watch?: HrWatchState | null }>(env, "/config/d161-hr-watch");
  return payload.configured && payload.watch ? payload.watch : null;
}

async function saveWatch(env: HrEventEnv, watch: HrWatchState): Promise<void> {
  await coreJson(env, "/config/d161-hr-watch", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(watch),
  });
}

async function readSync(env: HrEventEnv): Promise<HrSyncState> {
  const payload = await coreJson<{ configured?: boolean; sync?: HrSyncState | null }>(env, "/config/d161-hr-sync");
  return payload.sync || {};
}

async function saveSync(env: HrEventEnv, next: HrSyncState): Promise<void> {
  await coreJson(env, "/config/d161-hr-sync", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  });
}

async function claimSnapshot(env: HrEventEnv, fingerprint: string): Promise<boolean> {
  const payload = await coreJson<{ claimed?: boolean }>(env, "/config/d161-hr-snapshot-claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fingerprint }),
  });
  return payload.claimed === true;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sourceFingerprint(source: StoredHrSource, read: HrEmployeeReadResult): Promise<string> {
  const canonical = {
    sheet_id: source.sheet_id,
    tab_name: source.tab_name,
    header_row: source.header_row,
    mnv_header: source.mnv_header,
    full_name_header: source.full_name_header,
    contractor_header: source.contractor_header,
    source_row_count: read.source_row_count,
    invalid_rows: [...read.invalid_rows].sort((a, b) => a - b),
    invalid_row_details: [...read.invalid_row_details]
      .map((item) => ({ row: item.row, reasons: [...item.reasons].sort() }))
      .sort((a, b) => a.row - b.row),
    duplicate_conflicts: [...read.duplicate_conflicts]
      .map((row) => ({
        employee_code: row.employee_code,
        names: [...row.names].sort(),
        contractors: [...row.contractors].sort(),
      }))
      .sort((a, b) => a.employee_code.localeCompare(b.employee_code)),
    employees: [...read.employees]
      .map((row) => ({
        employee_code: row.employee_code,
        display_name: row.display_name,
        contractor_name: row.contractor_name,
      }))
      .sort((a, b) => a.employee_code.localeCompare(b.employee_code)),
  };
  return sha256Hex(JSON.stringify(canonical));
}

function compactPlan(plan: HrPlan): HrPlan {
  return {
    total_source: Math.max(0, Number(plan.total_source || 0)),
    create: Math.max(0, Number(plan.create || 0)),
    rename: Math.max(0, Number(plan.rename || 0)),
    contractor_update: Math.max(0, Number(plan.contractor_update || 0)),
    existing_info_updates: Math.max(0, Number(plan.existing_info_updates || 0)),
    existing_picker_count: Math.max(0, Number(plan.existing_picker_count || 0)),
    unchanged: Math.max(0, Number(plan.unchanged || 0)),
    inactive_existing: Math.max(0, Number(plan.inactive_existing || 0)),
    not_in_source: Math.max(0, Number(plan.not_in_source || 0)),
    collisions: (plan.collisions || []).slice(0, 20).map((row) => ({
      employee_code: String(row.employee_code || "").slice(0, 64),
      role: String(row.role || "").slice(0, 32),
      user_id: String(row.user_id || "").slice(0, 180),
    })),
  };
}

function hardBlockEvidence(read: HrEmployeeReadResult): Pick<HrSyncState, "invalid_row_details" | "duplicate_employee_codes"> {
  return {
    invalid_row_details: (read.invalid_row_details || []).slice(0, 100).map((item) => ({
      row: Math.max(1, Math.trunc(Number(item.row || 0))),
      reasons: (item.reasons || []).map((reason) => String(reason || "")).filter(Boolean).slice(0, 8),
    })),
    duplicate_employee_codes: (read.duplicate_conflicts || [])
      .map((item) => String(item.employee_code || "").slice(0, 64))
      .filter(Boolean)
      .slice(0, 100),
  };
}

function classify(
  read: HrEmployeeReadResult,
  plan: HrPlan,
  previous: HrSyncState,
): { decision: "HARD_BLOCK" | "CONFIRM_REQUIRED" | "AUTO"; code?: string } {
  if (read.duplicate_conflicts.length) return { decision: "HARD_BLOCK", code: "DUPLICATE_CONFLICT" };
  if (read.invalid_rows.length) return { decision: "HARD_BLOCK", code: "INVALID_ROWS" };
  if (read.source_row_count <= 0 || read.employees.length <= 0) return { decision: "HARD_BLOCK", code: "EMPTY_SOURCE" };
  if ((plan.collisions || []).length) return { decision: "HARD_BLOCK", code: "NON_PICKER_COLLISION" };

  const priorRows = Math.max(0, Number(previous.last_accepted_row_count || 0));
  if (priorRows > 0 && read.source_row_count < Math.ceil(priorRows * 0.8)) {
    return { decision: "HARD_BLOCK", code: "SOURCE_ROW_LOSS_OVER_20_PERCENT" };
  }

  const create = Math.max(0, Number(plan.create || 0));
  const info = Math.max(0, Number(plan.existing_info_updates || 0));
  const existing = Math.max(0, Number(plan.existing_picker_count || 0));
  const infoRatio = existing > 0 ? info / existing : 0;
  if (create > 1 || info > 10 || infoRatio > 0.10) return { decision: "CONFIRM_REQUIRED" };
  return { decision: "AUTO" };
}

async function previewPlan(env: HrEventEnv, read: HrEmployeeReadResult): Promise<HrPlan> {
  const response = await core(env).fetch("https://inventory-core.internal/admin/hr-sync/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor: {
        user_id: "system:d161-hr-watch",
        employee_code: null,
        display_name: "D161 HR Watch",
        role: "ROOT",
        base_role: "ROOT",
      },
      employees: read.employees,
    }),
  });
  const payload = await response.json() as HrPlan & { error?: string };
  if (!response.ok) throw new Error(String(payload.error || `HR_PREVIEW_HTTP_${response.status}`));
  return compactPlan(payload);
}

async function broadcast(env: HrEventEnv, event: string, state: HrSyncState): Promise<void> {
  await core(env).fetch("https://inventory-core.internal/realtime/broadcast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event,
      scopes: ["hr_sync"],
      tags: ["role:ADMIN", "role:ROOT"],
      metadata: {
        status: state.status || "",
        decision: state.decision || "",
        fingerprint: state.fingerprint || "",
        source_row_count: Math.max(0, Number(state.source_row_count || 0)),
        hard_block_code: state.hard_block_code || null,
        invalid_row_count: Math.max(0, Number(state.invalid_row_details?.length || 0)),
        duplicate_employee_count: Math.max(0, Number(state.duplicate_employee_codes?.length || 0)),
        plan: compactPlan(state.plan || {}),
      },
    }),
  }).catch(() => undefined);
}

async function applySnapshot(
  env: HrEventEnv,
  read: HrEmployeeReadResult,
  fingerprint: string,
  actor: HrActor,
  decision: "AUTO" | "CONFIRMED",
): Promise<Record<string, unknown>> {
  const password = env.PICKER_DEFAULT_PASSWORD || env.ROOT_BOOTSTRAP_PASSWORD || "";
  if (!password) throw new Error("PICKER_DEFAULT_PASSWORD_NOT_CONFIGURED");
  const derived = await hashPassword(password);
  const response = await core(env).fetch("https://inventory-core.internal/admin/hr-sync/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actor,
      employees: read.employees,
      request_id: `hr-${decision.toLowerCase()}:${fingerprint.slice(0, 48)}`,
      confirm: true,
      picker_password_salt: derived.salt,
      picker_password_hash: derived.hash,
      source_fingerprint: fingerprint,
      source_row_count: read.source_row_count,
      decision,
    }),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error || `HR_APPLY_HTTP_${response.status}`));
  await refreshPickerProjectionBestEffort(env, `D161_HR_${decision}`).catch(() => undefined);
  return payload;
}

function sourceErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("cột") || message.includes("header") || message.includes("Tên cột")) return "HEADER_CHANGED";
  if (message.includes("403") || message.includes("404") || message.includes("Không đọc")) return "SOURCE_ACCESS_FAILED";
  return "SOURCE_READ_FAILED";
}

async function storeBlockedSourceError(env: HrEventEnv, trigger: string, error: unknown): Promise<HrSyncState> {
  const previous = await readSync(env).catch(() => ({} as HrSyncState));
  const code = sourceErrorCode(error);
  const state: HrSyncState = {
    ...previous,
    status: "HARD_BLOCK",
    decision: "HARD_BLOCK",
    hard_block_code: code,
    pending_fingerprint: "",
    invalid_row_details: [],
    duplicate_employee_codes: [],
    updated_at: new Date().toISOString(),
    updated_by: "system:d161-hr-watch",
    trigger,
  };
  await saveSync(env, state);
  if (previous.hard_block_code !== code || previous.status !== "HARD_BLOCK") {
    await broadcast(env, "hr_sync_blocked", state);
  }
  return state;
}

export async function processHrSnapshot(env: HrEventEnv, trigger = "DRIVE_WATCH"): Promise<HrSyncState> {
  // D167 D01: direct Web/Excel input is the only account writer. Retired sheet watch is read-only legacy evidence.
  if (env.APP_ENV === "beta") return { status: "SHEET_INTAKE_RETIRED_WEB_EXCEL", trigger };
  if (env.APP_ENV !== "beta") return { status: "DISABLED_NON_BETA" };
  if (!env.GOOGLE_RUNTIME_SA_JSON) return storeBlockedSourceError(env, trigger, new Error("GOOGLE_RUNTIME_NOT_CONFIGURED"));

  const source = await readSource(env);
  if (!source) return { status: "NOT_CONFIGURED" };

  let read: HrEmployeeReadResult;
  try {
    read = await readHrEmployees(env.GOOGLE_RUNTIME_SA_JSON, source);
  } catch (error) {
    return storeBlockedSourceError(env, trigger, error);
  }

  const fingerprint = await sourceFingerprint(source, read);
  const previous = await readSync(env);
  const incomplete = read.invalid_row_details.length > 0 &&
    read.invalid_row_details.every(row => row.reasons.every(reason =>
      ["INVALID_EMPLOYEE_CODE", "MISSING_DISPLAY_NAME", "MISSING_CONTRACTOR_NAME"].includes(reason)
    ));
  // A source row under human edit is not an immediate business error.
  if (incomplete && !read.duplicate_conflicts.length) {
    const same = previous.fingerprint === fingerprint;
    const started = same && previous.wait_started_at ? previous.wait_started_at : new Date().toISOString();
    const duration = Date.now() - Date.parse(started);
    const expired = Number.isFinite(duration) && duration >= 120_000;
    const waiting: HrSyncState = {
      ...previous,
      status: expired ? "HARD_BLOCK" : "WAITING_FOR_COMPLETION",
      decision: expired ? "HARD_BLOCK" : undefined,
      hard_block_code: expired ? "INVALID_ROWS" : null,
      fingerprint,
      wait_started_at: started,
      pending_fingerprint: "",
      ...hardBlockEvidence(read),
      updated_at: new Date().toISOString(),
      updated_by: "system:d167-hr-settle",
      trigger,
    };
    if (!same || previous.status !== waiting.status) {
      await saveSync(env, waiting);
      if (expired && previous.status !== "HARD_BLOCK") await broadcast(env, "hr_sync_blocked", waiting);
    }
    return waiting;
  }
  const claimed = await claimSnapshot(env, fingerprint);
  if (!claimed) {
    return { ...previous, fingerprint, status: previous.status || "NO_CHANGE" };
  }

  let plan: HrPlan = {
    total_source: read.employees.length,
    create: 0,
    existing_info_updates: 0,
    existing_picker_count: 0,
    collisions: [],
  };
  if (!read.invalid_rows.length && !read.duplicate_conflicts.length && read.employees.length) {
    try {
      plan = await previewPlan(env, read);
    } catch (error) {
      return storeBlockedSourceError(env, trigger, error);
    }
  }

  const classification = classify(read, plan, previous);
  const base: HrSyncState = {
    ...previous,
    status: classification.decision,
    decision: classification.decision,
    fingerprint,
    source_row_count: read.source_row_count,
    plan: compactPlan(plan),
    hard_block_code: classification.code || null,
    pending_fingerprint: classification.decision === "CONFIRM_REQUIRED" ? fingerprint : "",
    ...hardBlockEvidence(read),
    updated_at: new Date().toISOString(),
    updated_by: "system:d161-hr-watch",
    trigger,
    wait_started_at: "",
  };

  if (classification.decision === "HARD_BLOCK") {
    await saveSync(env, base);
    await broadcast(env, "hr_sync_blocked", base);
    return base;
  }

  if (classification.decision === "CONFIRM_REQUIRED") {
    await saveSync(env, base);
    await broadcast(env, "hr_sync_pending", base);
    return base;
  }

  try {
    await applySnapshot(env, read, fingerprint, {
      user_id: "system:d161-hr-watch",
      employee_code: null,
      display_name: "D161 HR Watch",
      role: "ROOT",
      base_role: "ROOT",
    }, "AUTO");
  } catch (error) {
    return storeBlockedSourceError(env, trigger, error);
  }

  const applied: HrSyncState = {
    ...base,
    status: "APPLIED",
    decision: "AUTO",
    pending_fingerprint: "",
    last_accepted_fingerprint: fingerprint,
    last_accepted_row_count: read.source_row_count,
    hard_block_code: null,
    invalid_row_details: [],
    duplicate_employee_codes: [],
    updated_at: new Date().toISOString(),
  };
  await saveSync(env, applied);
  await broadcast(env, "hr_sync_applied", applied);
  return applied;
}

async function randomHex(bytes = 32): Promise<string> {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function stopChannel(accessToken: string, watch: HrWatchState | null): Promise<void> {
  if (!watch?.channel_id || !watch.resource_id) return;
  await fetch("https://www.googleapis.com/drive/v3/channels/stop", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ id: watch.channel_id, resourceId: watch.resource_id }),
  }).catch(() => undefined);
}

export async function retryIncompleteHrSnapshotIfDue(env: HrEventEnv): Promise<void> {
  if (env.APP_ENV !== "beta") return;
  const prior = await readSync(env).catch(() => ({} as HrSyncState));
  if (prior.status !== "WAITING_FOR_COMPLETION" || !prior.wait_started_at) return;
  const due = Date.parse(prior.wait_started_at) + 120_000;
  if (Number.isFinite(due) && Date.now() >= due) {
    await processHrSnapshot(env, "D167_INCOMPLETE_RECHECK");
  }
}

export async function ensureHrDriveWatch(env: HrEventEnv, force = false): Promise<Record<string, unknown>> {
  if (env.APP_ENV === "beta") return { status: "hr_sheet_intake_retired" };
  if (env.APP_ENV !== "beta") return { status: "disabled_non_beta" };
  if (!env.GOOGLE_RUNTIME_SA_JSON) return { status: "runtime_not_configured" };
  const source = await readSource(env);
  if (!source) return { status: "hr_source_not_configured" };

  const current = await readWatch(env).catch(() => null);
  const now = Date.now();
  if (
    !force &&
    current?.sheet_id === source.sheet_id &&
    Number(current.expires_at_ms || 0) > now + WATCH_RENEW_AHEAD_MS
  ) {
    return { status: "watch_current", expires_at_ms: Number(current.expires_at_ms || 0) };
  }

  const { accessToken } = await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, DRIVE_READ_SCOPE);
  const channelId = crypto.randomUUID();
  const channelToken = await randomHex(32);
  const requestedExpiration = now + WATCH_LIFETIME_MS;
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(source.sheet_id)}/watch`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: WATCH_CALLBACK,
        token: channelToken,
        expiration: String(requestedExpiration),
      }),
    },
  );
  const payload = await response.json() as { resourceId?: string; expiration?: string };
  const resourceId = String(payload.resourceId || "").trim();
  const expiresAtMs = Math.trunc(Number(payload.expiration || requestedExpiration));
  if (!response.ok || !resourceId || !Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
    throw new Error(`HR_DRIVE_WATCH_HTTP_${response.status}`);
  }

  const next: HrWatchState = {
    sheet_id: source.sheet_id,
    channel_id: channelId,
    resource_id: resourceId,
    channel_token: channelToken,
    expires_at_ms: expiresAtMs,
    registered_at: new Date().toISOString(),
  };
  await saveWatch(env, next);

  // Initial synchronization is explicit so an early Google "sync" callback that
  // races watch-state persistence cannot be the only source of truth.
  await processHrSnapshot(env, "WATCH_REGISTERED").catch(() => undefined);

  if (current && current.channel_id !== next.channel_id) {
    await stopChannel(accessToken, current);
  }
  return { status: "watch_registered", expires_at_ms: expiresAtMs };
}

export async function handleHrDriveWatchNotification(request: Request, env: HrEventEnv): Promise<Response> {
  if (env.APP_ENV !== "beta") return new Response(null, { status: 404 });
  const watch = await readWatch(env).catch(() => null);
  if (!watch) return new Response(null, { status: 204 });

  const channelId = request.headers.get("x-goog-channel-id") || "";
  const resourceId = request.headers.get("x-goog-resource-id") || "";
  const token = request.headers.get("x-goog-channel-token") || "";
  const resourceState = (request.headers.get("x-goog-resource-state") || "").toLowerCase();
  if (
    channelId !== watch.channel_id ||
    resourceId !== watch.resource_id ||
    token !== watch.channel_token
  ) {
    return new Response(null, { status: 204 });
  }

  if (resourceState && resourceState !== "sync") {
    await processHrSnapshot(env, `DRIVE_${resourceState.toUpperCase()}`).catch(() => undefined);
  }
  return new Response(null, { status: 204 });
}

export async function readHrEventState(env: HrEventEnv): Promise<Record<string, unknown>> {
  const [watch, sync] = await Promise.all([
    readWatch(env).catch(() => null),
    readSync(env).catch(() => ({} as HrSyncState)),
  ]);
  return {
    watch: watch ? {
      configured: true,
      sheet_id: watch.sheet_id || "",
      expires_at_ms: Math.max(0, Number(watch.expires_at_ms || 0)),
      registered_at: watch.registered_at || null,
    } : { configured: false },
    sync,
  };
}

export async function confirmHrPending(
  env: HrEventEnv,
  actor: HrActor,
  expectedFingerprint: string,
): Promise<{ status: string; state: HrSyncState }> {
  const current = await readSync(env);
  const expected = String(expectedFingerprint || "").trim().toLowerCase();
  if (
    current.status !== "CONFIRM_REQUIRED" ||
    current.pending_fingerprint !== expected ||
    !/^[a-f0-9]{64}$/.test(expected)
  ) {
    return { status: "NO_MATCHING_PENDING_SNAPSHOT", state: current };
  }
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
  const source = await readSource(env);
  if (!source) throw new Error("HR_SOURCE_NOT_CONFIGURED");

  let read: HrEmployeeReadResult;
  try {
    read = await readHrEmployees(env.GOOGLE_RUNTIME_SA_JSON, source);
  } catch (error) {
    const blocked = await storeBlockedSourceError(env, "CONFIRM_REVALIDATE", error);
    return { status: "SOURCE_BLOCKED", state: blocked };
  }
  const latestFingerprint = await sourceFingerprint(source, read);
  if (latestFingerprint !== expected) {
    const recomputed = await processHrSnapshot(env, "STALE_CONFIRM_RECOMPUTE");
    return { status: "STALE_SNAPSHOT_RECOMPUTED", state: recomputed };
  }

  const plan = await previewPlan(env, read);
  const classification = classify(read, plan, current);
  if (classification.decision === "HARD_BLOCK") {
    const blocked: HrSyncState = {
      ...current,
      status: "HARD_BLOCK",
      decision: "HARD_BLOCK",
      hard_block_code: classification.code || "REVALIDATION_BLOCKED",
      pending_fingerprint: "",
      plan,
      ...hardBlockEvidence(read),
      updated_at: new Date().toISOString(),
      updated_by: actor.user_id,
      trigger: "CONFIRM_REVALIDATE",
    };
    await saveSync(env, blocked);
    await broadcast(env, "hr_sync_blocked", blocked);
    return { status: "SOURCE_BLOCKED", state: blocked };
  }

  await applySnapshot(env, read, expected, actor, "CONFIRMED");
  const applied: HrSyncState = {
    ...current,
    status: "APPLIED",
    decision: "CONFIRMED",
    fingerprint: expected,
    pending_fingerprint: "",
    plan,
    source_row_count: read.source_row_count,
    last_accepted_fingerprint: expected,
    last_accepted_row_count: read.source_row_count,
    hard_block_code: null,
    invalid_row_details: [],
    duplicate_employee_codes: [],
    updated_at: new Date().toISOString(),
    updated_by: actor.user_id,
    trigger: "WEB_CONFIRM",
  };
  await saveSync(env, applied);
  await broadcast(env, "hr_sync_applied", applied);
  return { status: "APPLIED", state: applied };
}
