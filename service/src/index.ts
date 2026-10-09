import { InventoryCore } from "./core";
import { collectD166Cf } from "./d166-cloudflare-usage";
import { createFirebaseCustomToken, hashPassword, readBearerToken, verifyFirebaseIdToken, verifyPassword, type AppRole } from "./auth";
import {
  effectiveAuthEmail,
  importPasswordIdentity,
  normalizeAuthEmail,
  signInWithFirebasePassword,
  updateFirebaseIdentity,
  type FirebaseManagedUserSpec,
} from "./firebase-auth-admin";
import { handleBusinessApi } from "./business-api";
import { handleReadApi } from "./read-api";
import { handleNotificationApi } from "./notification-api";
import { handleUserManagementApi } from "./user-management-api";
import { archiveStatus, runArchive } from "./archive";
import { validateHrSheetSource } from "./hr-source";
import { listRuntimeLogs, readRuntimeLog, retryBufferedRuntimeLogArchives, uploadRuntimeLog, probeLauncherArchiveFolder, ensureLauncherLogsDestination, resolveRuntimeLogDayForAgent } from "./runtime-logs";
import { drainAgentLogUploads } from "./agent-log-drain";
import { collectSystemStatus } from "./system-status";
import { handleSystemResetApi } from "./system-reset";
import { sendProjectEmail } from "./google-mail";
import {
  PrivilegedAuthError,
  isPrivilegedOneTimeUser,
  sendPrivilegedOneTimeCode,
  verifyPrivilegedProof,
} from "./privileged-auth";
import { latestAgentAppRelease, latestAgentBrowserBundle, latestLauncherRelease, latestPdaAppRelease, redirectLatestAgentBrowserBundle, redirectLatestAgentBrowserChecksum, redirectLatestAgentChecksum, redirectLatestAgentExe, redirectLatestLauncherApk, redirectLatestLauncherChecksum, redirectLatestPdaApk, redirectLatestPdaChecksum } from "./app-tools";
import { handleD119Internal } from "./internal-d119";
import { clearPickerNotificationTargets, mirrorPickerNotificationTarget, publishAgentSupportLogRequest, publishPickerSessionRevocation, reconcileRecentAgentKicks, refreshPickerProjectionBestEffort } from "./firestore-projection";
import { maybeRunRelayAuditExport } from "./relay-audit";
import { handlePdaRegistryApi, reconcilePdaRegistrySheet } from "./pda-registry";
import { ensureDailyLauncherPassword, handleLauncherPasswordApi, shouldRetryDailyLauncherPassword } from "./launcher-password";
import { handleLauncherDiagnosticLog } from "./launcher-diagnostics";
import { resolveLauncherManifest, validateLauncherRules, loadLauncherUpdateConfig, verifyLauncherOwnerApproval } from "./launcher-update-policy";
import { handlePdaManagementDiagnosticLog } from "./pda-management-diagnostics";
import { handlePublicInfoPage } from "./public-pages";
import { sendFcmNotifications } from "./fcm";
import {
  confirmHrPending,
  ensureHrDriveWatch,
  handleHrDriveWatchNotification,
  processHrSnapshot,
  readHrEventState,
} from "./hr-event-sync";


export { InventoryCore };

interface Env {
  APP_ENV: string;
  PROJECT_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY?: string;
  INVENTORY_CORE: DurableObjectNamespace;
  ASSETS?: Fetcher;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REDIRECT_URI?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  ROOT_BOOTSTRAP_PASSWORD?: string;
  PICKER_DEFAULT_PASSWORD?: string;
  ARCHIVE_SHEET_ID?: string;
  PDA_REGISTRY_SHEET_ID?: string;
  RETENTION_DAYS?: string;
  LOGS_FOLDER_ID?: string;
  LAUNCHER_LOGS_FOLDER_ID?: string;
  ARCHIVE_FOLDER_ID?: string;
  EXPORTS_FOLDER_ID?: string;
  SOURCE_COMMIT?: string;
  LOAD_TEST_TOKEN?: string;
  D166_CF_READ_TOKEN?: string;
  D166_CF_ACCOUNT_ID?: string;
  // D166 Owner-gated version floor. Unset or 0 means updates stay optional.
  PDA_MIN_VERSION_CODE_BETA?: string;
}

interface InternalUser {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  contractor_name: string | null;
  shortage_reporting_enabled: number;
  shortage_reporting_revision: number;
  role: AppRole;
  base_role: AppRole;
  role_override: AppRole | null;
  status: "ACTIVE" | "DISABLED";
  password_salt: string | null;
  password_hash: string | null;
  password_changed_at: string | null;
  auth_email: string | null;
  firebase_password_ready: number;
  firebase_agent_ready: number;
  session_generation: number;
  session_started_at: string | null;
  web_session_generation: number;
  web_session_device_id: string | null;
  web_session_started_at: string | null;
  android_session_generation: number;
  android_session_device_id: string | null;
  android_session_started_at: string | null;
}

interface FirebaseExchangeResponse {
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  localId?: string;
  error?: { message?: string };
}

interface FirebaseRefreshResponse {
  id_token?: string;
  refresh_token?: string;
  expires_in?: string;
  user_id?: string;
  error?: { message?: string };
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send";
const OAUTH_STATE_COOKIE = "inventory_oauth_state";
const CORE_OBJECT_NAME = "inventory-core";
const dndDiagnosticLastUpload = new Map<string, number>();

function dndDiagnosticString(value: unknown, max = 300): string {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function dndDiagnosticRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const REQUIRED_RUNTIME_BINDINGS = [
  "GOOGLE_RUNTIME_SA_JSON",
  "GOOGLE_DRIVE_OAUTH_CLIENT_ID",
  "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET",
  "GOOGLE_DRIVE_OAUTH_REDIRECT_URI",
  "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_WEB_API_KEY",
] as const;

function json(payload: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(payload, null, 2), { status, headers });
}

function html(body: string, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  return new Response(body, { status, headers });
}

function randomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashRecoveryToken(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function oauthBindingsReady(env: Env): boolean {
  return Boolean(env.GOOGLE_DRIVE_OAUTH_CLIENT_ID && env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET && env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI);
}

function coreStub(env: Env): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_OBJECT_NAME));
}

async function coreJson<T>(env: Env, path: string, init?: RequestInit): Promise<T> {
  const response = await coreStub(env).fetch(`https://inventory-core.internal${path}`, init);
  const payload = (await response.json()) as T;
  if (!response.ok) throw new Error(`core_http_${response.status}`);
  return payload;
}

type AndroidOperatingWindowPayload = {
  is_open: boolean;
  server_now_ms: number;
  closes_at_ms: number | null;
  schedule_key?: string;
  schedule_version?: number;
  decision?: string | null;
  projection_open_until_ms?: number | null;
  normal_window_open?: boolean;
  overtime_open?: boolean;
  early_start_open?: boolean;
  overtime_until_ms?: number | null;
  start_minutes?: number;
  end_minutes?: number;
  overtime_cutoff_minutes?: number;
};

async function androidOperatingWindow(env: Env): Promise<AndroidOperatingWindowPayload> {
  return coreJson<AndroidOperatingWindowPayload>(env, "/notifications/alert-window/reconcile");
}

async function checkCore(env: Env): Promise<{
  ok: boolean;
  status: string;
  schema_version?: number;
  expected_schema_version?: number;
  operational_v2?: { ready?: boolean; schema_version?: number; expected_schema_version?: number };
  root_password_initialized?: boolean;
}> {
  try {
    const payload = await coreJson<{
      status?: string;
      schema_version?: number;
      expected_schema_version?: number;
      operational_v2?: { ready?: boolean; schema_version?: number; expected_schema_version?: number };
      root_password_initialized?: boolean;
    }>(env, "/health");
    return {
      ok:
        payload.status === "ok" &&
        payload.schema_version === payload.expected_schema_version &&
        payload.operational_v2?.ready === true,
      status: payload.status || "unknown",
      schema_version: payload.schema_version,
      expected_schema_version: payload.expected_schema_version,
      operational_v2: payload.operational_v2,
      root_password_initialized: payload.root_password_initialized,
    };
  } catch {
    return { ok: false, status: "unavailable" };
  }
}

async function getUserByUsername(env: Env, username: string): Promise<InternalUser | null> {
  const payload = await coreJson<{ user: InternalUser | null }>(env, `/auth/user-by-username?username=${encodeURIComponent(username)}`);
  return payload.user;
}

async function getUserById(env: Env, userId: string): Promise<InternalUser | null> {
  const payload = await coreJson<{ user: InternalUser | null }>(env, `/auth/user-by-id?user_id=${encodeURIComponent(userId)}`);
  return payload.user;
}

async function getUserByFirebaseUid(env: Env, uid: string): Promise<InternalUser | null> {
  const payload = await coreJson<{ user: InternalUser | null }>(env, `/auth/user-by-firebase-uid?uid=${encodeURIComponent(uid)}`);
  return payload.user;
}

async function savePassword(env: Env, userId: string, password: string): Promise<void> {
  const derived = await hashPassword(password);
  await coreJson(env, "/auth/set-password", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId, password_salt: derived.salt, password_hash: derived.hash }),
  });
}

async function ensureFirebaseUid(env: Env, user: InternalUser): Promise<string> {
  if (user.firebase_uid) return user.firebase_uid;
  const uid = user.user_id;
  await coreJson(env, "/auth/link-firebase-uid", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.user_id, firebase_uid: uid }),
  });
  return uid;
}

function randomOpaquePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function retirePrivilegedStaticPassword(env: Env, original: InternalUser): Promise<InternalUser> {
  if (!isPrivilegedOneTimeUser(original)) return original;
  const uid = await ensureFirebaseUid(env, original);

  if ((original.password_hash || original.password_salt) && Number(original.firebase_password_ready || 0) === 1) {
    if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("AUTH_RUNTIME_NOT_CONFIGURED");
    await updateFirebaseIdentity(
      env.GOOGLE_RUNTIME_SA_JSON,
      env.FIREBASE_PROJECT_ID,
      firebaseUserSpec(original, uid),
      { password: randomOpaquePassword() },
    );
  }

  if (original.password_hash || original.password_salt || Number(original.firebase_password_ready || 0) !== 1) {
    const retired = await coreJson<{ user?: InternalUser | null }>(env, "/auth/retire-static-password", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: original.user_id }),
    });
    return retired.user || (await getUserById(env, original.user_id)) || {
      ...original,
      firebase_uid: uid,
      password_hash: null,
      password_salt: null,
      firebase_password_ready: 1,
      firebase_agent_ready: original.base_role === "ADMIN" ? 1 : original.firebase_agent_ready,
    };
  }

  return original.firebase_uid ? original : { ...original, firebase_uid: uid };
}

function privilegedAuthErrorResponse(error: unknown): Response {
  if (error instanceof PrivilegedAuthError) {
    return json({
      error: error.code,
      message: error.message,
      ...(error.retryAfterSeconds > 0 ? { retry_after_seconds: error.retryAfterSeconds } : {}),
    }, error.status);
  }
  return json({ error: "PRIVILEGED_AUTH_UNAVAILABLE", message: "Không xử lý được xác thực một lần." }, 503);
}

async function requestPrivilegedCode(request: Request, env: Env): Promise<Response> {
  let body: { username?: string } = {};
  try { body = (await request.json()) as typeof body; } catch { return json({ error: "INVALID_JSON" }, 400); }
  const username = String(body.username || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,64}$/.test(username)) return json({ error: "PRIVILEGED_ACCOUNT_REQUIRED" }, 400);
  let user = await getUserByUsername(env, username);
  if (!user || !isPrivilegedOneTimeUser(user)) return json({ error: "PRIVILEGED_ACCOUNT_REQUIRED" }, 404);
  try {
    user = await retirePrivilegedStaticPassword(env, user);
    const issued = await sendPrivilegedOneTimeCode(env, user, false);
    return json({
      status: "code_sent",
      expires_at: issued.expires_at,
      message: "Đã gửi mật khẩu một lần tới email quản trị.",
    }, 202);
  } catch (error) {
    return privilegedAuthErrorResponse(error);
  }
}

async function privilegedAgentLogin(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_RUNTIME_SA_JSON || !env.FIREBASE_WEB_API_KEY) return json({ error: "AUTH_RUNTIME_NOT_CONFIGURED" }, 503);
  let body: { username?: string; password?: string } = {};
  try { body = (await request.json()) as typeof body; } catch { return json({ error: "INVALID_JSON" }, 400); }
  const username = String(body.username || "").trim().toLowerCase();
  const proof = String(body.password || "");
  let user = await getUserByUsername(env, username);
  if (!user || !isPrivilegedOneTimeUser(user)) {
    return json({ error: "INVALID_CREDENTIALS" }, 401);
  }
  const agentRoleAllowed =
    (user.base_role === "ADMIN" && user.role === "ADMIN") ||
    (user.base_role === "PICKPACK_ADMIN" && user.role === "PICKPACK_ADMIN");
  if (!agentRoleAllowed) {
    return json({
      error: "AGENT_ROLE_REQUIRED",
      message: "Tài khoản này không có quyền Agent hiện hành.",
    }, 403);
  }

  try {
    user = await retirePrivilegedStaticPassword(env, user);
    const verified = await verifyPrivilegedProof(env, user, proof, true);
    if (!verified.valid) return json({ error: "INVALID_CREDENTIALS" }, 401);
    const uid = await ensureFirebaseUid(env, user);
    const customToken = await createFirebaseCustomToken(env.GOOGLE_RUNTIME_SA_JSON, uid, {
      app_role: user.role,
      app_base_role: user.base_role,
      app_user_id: user.user_id,
      employee_code: user.employee_code || "",
      app_session_channel: "AGENT",
      app_session_generation: 0,
    });
    const session = await exchangeCustomToken(env, customToken);
    return json({ ...session, user: publicUser(user), session_channel: "AGENT" });
  } catch (error) {
    if (error instanceof PrivilegedAuthError) return privilegedAuthErrorResponse(error);
    return json({ error: "INVALID_CREDENTIALS" }, 401);
  }
}

async function privilegedAgentReauth(request: Request, env: Env): Promise<Response> {
  const user = await requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"]);
  if (!isPrivilegedOneTimeUser(user)) return json({ error: "PRIVILEGED_ACCOUNT_REQUIRED" }, 403);
  let body: { proof?: string } = {};
  try { body = (await request.json()) as typeof body; } catch { return json({ error: "INVALID_JSON" }, 400); }
  try {
    const verified = await verifyPrivilegedProof(env, user, String(body.proof || ""), true);
    if (!verified.valid) return json({ error: "CURRENT_PASSWORD_INVALID", message: "Mật khẩu một lần hoặc mật khẩu khẩn cấp không đúng." }, 403);
    return json({ status: "verified", mode: verified.mode });
  } catch (error) {
    return privilegedAuthErrorResponse(error);
  }
}

function sessionAuthorityError(identity: Awaited<ReturnType<typeof verifyFirebaseIdToken>>, user: InternalUser): string | null {
  if (identity.sessionChannel === "AGENT") {
    if (user.role === "ADMIN" && user.base_role === "ADMIN") return null;
    if (user.role === "PICKPACK_ADMIN" && user.base_role === "PICKPACK_ADMIN") return null;
    return "AGENT_ROLE_REQUIRED";
  }
  if (identity.sessionChannel === "ANDROID" && (user.base_role === "ROOT" || user.base_role === "PICKPACK_ADMIN")) return "CLIENT_ROLE_NOT_ALLOWED";
  if (identity.sessionChannel !== "WEB" && identity.sessionChannel !== "ANDROID") return "SESSION_UPGRADE_REQUIRED";
  const expected = identity.sessionChannel === "WEB"
    ? Number(user.web_session_generation || 0)
    : Number(user.android_session_generation || 0);
  if (!identity.sessionGeneration || identity.sessionGeneration !== expected) return "SESSION_REPLACED";
  return null;
}

function firebaseUserSpec(user: InternalUser, uid: string): FirebaseManagedUserSpec {
  return {
    uid,
    userId: user.user_id,
    employeeCode: user.employee_code,
    displayName: user.display_name,
    role: user.base_role,
    status: user.status,
    authEmail: user.auth_email,
    passwordSalt: user.password_salt,
    passwordHash: user.password_hash,
  };
}

async function ensureFirebasePasswordReady(env: Env, original: InternalUser): Promise<InternalUser> {
  if (!env.GOOGLE_RUNTIME_SA_JSON || !env.FIREBASE_WEB_API_KEY) throw new Error("AUTH_RUNTIME_NOT_CONFIGURED");
  let user = original;
  if (!user.password_hash || !user.password_salt) {
    let bootstrapPassword: string | null = null;
    if (user.base_role === "ROOT" && user.user_id === "root" && env.ROOT_BOOTSTRAP_PASSWORD) {
      bootstrapPassword = env.ROOT_BOOTSTRAP_PASSWORD;
    } else if (user.base_role === "PICKER") {
      bootstrapPassword = env.PICKER_DEFAULT_PASSWORD || env.ROOT_BOOTSTRAP_PASSWORD || null;
    }
    if (!bootstrapPassword) throw new Error("PASSWORD_NOT_INITIALIZED");
    await savePassword(env, user.user_id, bootstrapPassword);
    user = (await getUserById(env, user.user_id))!;
  }

  const uid = await ensureFirebaseUid(env, user);
  if (Number(user.firebase_password_ready || 0) !== 1) {
    const imported = await importPasswordIdentity(
      env.GOOGLE_RUNTIME_SA_JSON,
      env.FIREBASE_PROJECT_ID,
      firebaseUserSpec(user, uid),
    );
    await coreJson(env, "/auth/firebase-password-ready", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id, firebase_uid: uid, auth_email: imported.email }),
    });
    user = (await getUserById(env, user.user_id))!;
  }
  return user;
}

async function ensureAgentFirebaseReady(env: Env, user: InternalUser): Promise<void> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("AUTH_RUNTIME_NOT_CONFIGURED");
  const realAgentOperator =
    (user.base_role === "ADMIN" && user.role === "ADMIN") ||
    (user.base_role === "PICKPACK_ADMIN" && user.role === "PICKPACK_ADMIN");
  if (!realAgentOperator) throw new Error("AGENT_OPERATOR_REQUIRED");
  if (!user.password_hash || !user.password_salt || !user.firebase_uid) throw new Error("AGENT_PASSWORD_NOT_READY");
  if (Number(user.firebase_agent_ready || 0) === 1) return;

  // D100: Agent uses the same Firebase UID as Web/App. This update only
  // normalizes the Firebase password identifier to the deterministic
  // username-derived address; recovery email remains InventoryCore metadata.
  await updateFirebaseIdentity(
    env.GOOGLE_RUNTIME_SA_JSON,
    env.FIREBASE_PROJECT_ID,
    firebaseUserSpec(user, String(user.firebase_uid)),
  );
  await coreJson(env, "/auth/firebase-agent-ready", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.user_id }),
  });
}

async function migrateActiveAdminFirebaseCredentials(env: Env): Promise<{ migrated: number; failed: number; remaining: number; agent_migrated: number; agent_failed: number; agent_remaining: number }> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) return { migrated: 0, failed: 1, remaining: 0, agent_migrated: 0, agent_failed: 1, agent_remaining: 0 };

  let privilegedFailed = 0;
  for (const login of ["root", "admin", "tamnv2"]) {
    try {
      const account = await getUserByUsername(env, login);
      if (account && isPrivilegedOneTimeUser(account)) await retirePrivilegedStaticPassword(env, account);
    } catch {
      privilegedFailed += 1;
    }
  }

  const candidates = await coreJson<{ items: InternalUser[]; count: number }>(
    env,
    "/auth/firebase-migration-candidates?role=ADMIN&limit=50",
  );
  let migrated = 0;
  let failed = privilegedFailed;
  for (const candidate of candidates.items || []) {
    try {
      await ensureFirebasePasswordReady(env, candidate);
      migrated += 1;
    } catch {
      failed += 1;
    }
  }
  const remaining = await coreJson<{ count: number }>(
    env,
    "/auth/firebase-migration-candidates?role=ADMIN&limit=1",
  );

  const [adminAgentCandidates, pickPackAgentCandidates] = await Promise.all([
    coreJson<{ items: InternalUser[]; count: number }>(
      env,
      "/auth/firebase-migration-candidates?role=ADMIN&channel=AGENT&limit=50",
    ),
    coreJson<{ items: InternalUser[]; count: number }>(
      env,
      "/auth/firebase-migration-candidates?role=PICKPACK_ADMIN&channel=AGENT&limit=50",
    ),
  ]);
  const agentCandidates = [
    ...(adminAgentCandidates.items || []),
    ...(pickPackAgentCandidates.items || []),
  ].slice(0, 100);
  let agentMigrated = 0;
  let agentFailed = 0;
  for (const original of agentCandidates) {
    try {
      const prepared = Number(original.firebase_password_ready || 0) === 1
        ? original
        : await ensureFirebasePasswordReady(env, original);
      const refreshed = (await getUserById(env, prepared.user_id)) || prepared;
      await ensureAgentFirebaseReady(env, refreshed);
      agentMigrated += 1;
    } catch {
      agentFailed += 1;
    }
  }
  const [adminAgentRemaining, pickPackAgentRemaining] = await Promise.all([
    coreJson<{ count: number }>(
      env,
      "/auth/firebase-migration-candidates?role=ADMIN&channel=AGENT&limit=1",
    ),
    coreJson<{ count: number }>(
      env,
      "/auth/firebase-migration-candidates?role=PICKPACK_ADMIN&channel=AGENT&limit=1",
    ),
  ]);
  const agentRemaining = { count: Number(adminAgentRemaining.count || 0) + Number(pickPackAgentRemaining.count || 0) };
  return {
    migrated,
    failed,
    remaining: Number(remaining.count || 0),
    agent_migrated: agentMigrated,
    agent_failed: agentFailed,
    agent_remaining: Number(agentRemaining.count || 0),
  };
}

async function closeUserRealtime(env: Env, userId: string, channel?: "WEB" | "ANDROID"): Promise<void> {
  try {
    await coreStub(env).fetch("https://inventory-core.internal/realtime/close-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId, client_type: channel || "", reason: "session-replaced" }),
    });
  } catch {
    // HTTP auth generation remains authoritative even if an old socket closes on its next lifecycle edge.
  }
}

async function activateInteractiveSession(
  env: Env,
  userId: string,
  channel: "WEB" | "ANDROID",
  deviceId: string,
  force: boolean,
): Promise<{ generation: number; replaced: boolean } | { conflict: true }> {
  const response = await coreStub(env).fetch("https://inventory-core.internal/auth/activate-session", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId, channel, device_id: deviceId, force }),
  });
  const payload = (await response.json()) as { error?: string; session_generation?: number; replaced_other_device?: boolean };
  if (response.status === 409 && payload.error === "SESSION_ACTIVE_OTHER_DEVICE") return { conflict: true };
  if (!response.ok) throw new Error(`core_http_${response.status}`);
  await closeUserRealtime(env, userId, channel);
  return {
    generation: Math.max(1, Number(payload.session_generation || 0)),
    replaced: Boolean(payload.replaced_other_device),
  };
}

async function requireUser(request: Request, env: Env, roles?: AppRole[]): Promise<InternalUser> {
  const token = readBearerToken(request);
  if (!token) throw new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
  let identity;
  try {
    identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch {
    throw new Response(JSON.stringify({ error: "INVALID_AUTH_TOKEN" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const user = await getUserByFirebaseUid(env, identity.uid);
  if (!user || user.status !== "ACTIVE") throw new Response(JSON.stringify({ error: "USER_NOT_ACTIVE" }), { status: 403, headers: { "content-type": "application/json" } });
  const sessionError = sessionAuthorityError(identity, user);
  if (sessionError) throw new Response(JSON.stringify({ error: sessionError }), { status: 401, headers: { "content-type": "application/json" } });
  if (roles && !roles.includes(user.role)) throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403, headers: { "content-type": "application/json" } });
  if (
    identity.sessionChannel === "ANDROID" &&
    roles &&
    roles.length > 0 &&
    roles.every((role) => role === "ADMIN" || role === "PICKPACK_ADMIN" || role === "ROOT")
  ) {
    throw new Response(JSON.stringify({ error: "MANAGEMENT_WEB_ONLY" }), { status: 403, headers: { "content-type": "application/json" } });
  }
  return user;
}

function isRevokedPickerAndroidSessionEndLog(body: Record<string, unknown>): boolean {
  return (
    String(body.source || "").trim().toUpperCase() === "ANDROID" &&
    String(body.severity || "").trim().toUpperCase() === "INFO" &&
    String(body.reason || "").trim().toLowerCase() === "session_end_logout"
  );
}

async function requireRuntimeLogUser(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
): Promise<InternalUser> {
  const token = readBearerToken(request);
  if (!token) throw new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
  let identity;
  try {
    identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch {
    throw new Response(JSON.stringify({ error: "INVALID_AUTH_TOKEN" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const user = await getUserByFirebaseUid(env, identity.uid);
  if (!user || user.status !== "ACTIVE") {
    throw new Response(JSON.stringify({ error: "USER_NOT_ACTIVE" }), { status: 403, headers: { "content-type": "application/json" } });
  }

  const sessionError = sessionAuthorityError(identity, user);
  if (!sessionError) return user;

  // D163: a forced Picker logout revokes Android authority before vc97 can upload
  // its final session bundle. Keep business authority revoked, but allow exactly
  // one-generation-old Android Picker identity to write only the sanitized
  // INFO/session_end_logout log. No other route or log reason receives this grace.
  const currentGeneration = Math.max(0, Number(user.android_session_generation || 0));
  const tokenGeneration = Math.max(0, Number(identity.sessionGeneration || 0));
  const revokedSessionEndGrace =
    sessionError === "SESSION_REPLACED" &&
    identity.sessionChannel === "ANDROID" &&
    user.base_role === "PICKER" &&
    tokenGeneration > 0 &&
    currentGeneration === tokenGeneration + 1 &&
    isRevokedPickerAndroidSessionEndLog(body);

  if (!revokedSessionEndGrace) {
    throw new Response(JSON.stringify({ error: sessionError }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return user;
}

async function requireAgentUser(request: Request, env: Env, roles: AppRole[] = ["ADMIN", "PICKPACK_ADMIN"]): Promise<InternalUser> {
  const token = readBearerToken(request);
  if (!token) throw new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
  let identity;
  try {
    identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
  } catch {
    throw new Response(JSON.stringify({ error: "INVALID_AUTH_TOKEN" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const user = await getUserByFirebaseUid(env, identity.uid);
  if (!user || user.status !== "ACTIVE") throw new Response(JSON.stringify({ error: "USER_NOT_ACTIVE" }), { status: 403, headers: { "content-type": "application/json" } });

  // Agent signs in directly with the dedicated synthetic Firebase password identity.
  // Those refreshable ID tokens intentionally carry the persistent role/user claims
  // but no WEB/ANDROID interactive-session channel. Never relax requireUser(): only
  // /api/agent/* endpoints may accept this channel-less Agent identity.
  if (identity.sessionChannel !== "" && identity.sessionChannel !== "AGENT") {
    throw new Response(JSON.stringify({ error: "AGENT_SESSION_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  if (Number(user.firebase_agent_ready || 0) !== 1 ||
      user.base_role !== user.role ||
      (user.role !== "ADMIN" && user.role !== "PICKPACK_ADMIN")) {
    throw new Response(JSON.stringify({ error: "AGENT_OPERATOR_REQUIRED" }), { status: 403, headers: { "content-type": "application/json" } });
  }
  if (roles.length && !roles.includes(user.role)) {
    throw new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403, headers: { "content-type": "application/json" } });
  }
  return user;
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = av.length ^ bv.length;
  for (let index = 0; index < Math.min(av.length, bv.length); index += 1) diff |= av[index] ^ bv[index];
  return diff === 0;
}

async function loadTestAuthorized(request: Request, env: Env): Promise<boolean> {
  if (env.APP_ENV !== "beta" || !env.LOAD_TEST_TOKEN) return false;
  const supplied = request.headers.get("x-load-test-token") || "";
  if (!supplied) return false;
  return constantTimeEqual(supplied, env.LOAD_TEST_TOKEN);
}

function publicUser(user: InternalUser): Record<string, unknown> {
  const {
    password_salt: _salt,
    password_hash: _hash,
    role_override: _override,
    session_generation: _legacyGeneration,
    session_started_at: _legacyStarted,
    web_session_generation: _webGeneration,
    web_session_device_id: _webDevice,
    web_session_started_at: _webStarted,
    android_session_generation: _androidGeneration,
    android_session_device_id: _androidDevice,
    android_session_started_at: _androidStarted,
    firebase_password_ready: _firebasePasswordReady,
    firebase_agent_ready: _firebaseAgentReady,
    ...safe
  } = user;
  return {
    ...safe,
    // D161 external capability contract is always a JSON boolean. Non-Picker
    // roles are effectively enabled because the Picker-only gate does not apply.
    shortage_reporting_enabled: user.role === "PICKER"
      ? Number(user.shortage_reporting_enabled ?? 0) === 1
      : true,
    shortage_reporting_revision: Number(user.shortage_reporting_revision || 0),
  };
}

async function parseUpstreamJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`firebase_upstream_invalid_json_http_${response.status}`);
  }
}

async function exchangeCustomToken(env: Env, customToken: string): Promise<{ id_token: string; refresh_token: string; expires_in: number }> {
  if (!env.FIREBASE_WEB_API_KEY) throw new Error("firebase_web_api_key_missing");
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const payload = await parseUpstreamJson<FirebaseExchangeResponse>(response);
  if (!response.ok || !payload.idToken || !payload.refreshToken) {
    throw new Error(`firebase_custom_token_exchange_failed:${payload.error?.message || response.status}`);
  }
  return {
    id_token: payload.idToken,
    refresh_token: payload.refreshToken,
    expires_in: Math.max(60, Number(payload.expiresIn || 3600)),
  };
}

async function refreshSession(request: Request, env: Env): Promise<Response> {
  if (!env.FIREBASE_WEB_API_KEY) return json({ error: "FIREBASE_RUNTIME_NOT_CONFIGURED" }, 503);
  const body = (await request.json()) as { refresh_token?: string };
  const refreshToken = String(body.refresh_token || "").trim();
  if (!refreshToken) return json({ error: "REFRESH_TOKEN_REQUIRED" }, 400);

  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  let payload: FirebaseRefreshResponse;
  try {
    payload = await parseUpstreamJson<FirebaseRefreshResponse>(response);
  } catch {
    return json({ error: "FIREBASE_REFRESH_UPSTREAM_INVALID_RESPONSE" }, 502);
  }
  if (!response.ok || !payload.id_token || !payload.refresh_token) {
    return json({ error: "FIREBASE_REFRESH_FAILED", message: payload.error?.message || `HTTP ${response.status}` }, 401);
  }

  let identity: Awaited<ReturnType<typeof verifyFirebaseIdToken>>;
  let user: InternalUser;
  let operatingWindow: AndroidOperatingWindowPayload | undefined;
  try {
    identity = await verifyFirebaseIdToken(payload.id_token, env.FIREBASE_PROJECT_ID);
    const resolved = await getUserByFirebaseUid(env, identity.uid);
    if (!resolved || resolved.status !== "ACTIVE") return json({ error: "USER_NOT_ACTIVE" }, 401);
    const sessionError = sessionAuthorityError(identity, resolved);
    if (sessionError) return json({ error: sessionError }, 401);
    if (identity.sessionChannel === "ANDROID") {
      // D149: shift closure gates business actions, not authentication/session
      // recovery. Returning the current state here avoids a second schedule request.
      operatingWindow = await androidOperatingWindow(env);
    }
    user = resolved;
  } catch {
    return json({ error: "INVALID_AUTH_TOKEN" }, 401);
  }

  let relayCustomToken: string | undefined;
  if (identity.sessionChannel === "ANDROID" && env.GOOGLE_RUNTIME_SA_JSON) {
    relayCustomToken = await createFirebaseCustomToken(env.GOOGLE_RUNTIME_SA_JSON, identity.uid, {
      app_role: user.role,
      app_base_role: user.base_role,
      app_user_id: user.user_id,
      employee_code: user.employee_code || "",
      app_session_channel: "ANDROID",
      app_session_generation: identity.sessionGeneration,
    });
  }

  return json({
    id_token: payload.id_token,
    refresh_token: payload.refresh_token,
    expires_in: Math.max(60, Number(payload.expires_in || 3600)),
    ...(relayCustomToken ? { firebase_custom_token: relayCustomToken } : {}),
    ...(operatingWindow ? { operating_window: operatingWindow } : {}),
  });
}
async function login(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_RUNTIME_SA_JSON || !env.FIREBASE_WEB_API_KEY) return json({ error: "AUTH_RUNTIME_NOT_CONFIGURED" }, 503);
  const body = (await request.json()) as {
    username?: string;
    password?: string;
    client_type?: string;
    device_id?: string;
    force?: boolean;
  };
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const deviceId = String(body.device_id || "").trim().slice(0, 160);
  if (!/^[a-z0-9._-]{1,64}$/.test(username) || !password || !deviceId) {
    return json({ error: "INVALID_CREDENTIALS" }, 401);
  }

  const requested = String(body.client_type || "").trim().toUpperCase();
  const channel: "WEB" | "ANDROID" = requested === "ANDROID" ? "ANDROID" : "WEB";
  let user = await getUserByUsername(env, username);
  if (!user || user.status !== "ACTIVE") return json({ error: "INVALID_CREDENTIALS" }, 401);

  if (channel === "WEB" && user.base_role === "PICKER") {
    return json({ error: "CLIENT_ROLE_NOT_ALLOWED", message: "Picker chỉ đăng nhập trên App/PDA." }, 403);
  }
  if (channel === "ANDROID" && (user.base_role === "ROOT" || user.base_role === "PICKPACK_ADMIN")) {
    return json({ error: "CLIENT_ROLE_NOT_ALLOWED", message: "Root/Quản trị Pick Pack hiện sử dụng Web hoặc Agent phù hợp. App/PDA hỗ trợ Picker, Reporter và Quản trị Invent ở chế độ xử lý báo hàng." }, 403);
  }
  // D149: an Android user may authenticate while replay/business operations are
  // asleep so a later shared overtime adjustment can reopen the same session.
  // Server mutation gates still enforce the effective operating state.
  const operatingWindow = channel === "ANDROID" ? await androidOperatingWindow(env) : undefined;

  let uid = "";
  if (isPrivilegedOneTimeUser(user)) {
    try {
      user = await retirePrivilegedStaticPassword(env, user);
      const verified = await verifyPrivilegedProof(env, user, password, true);
      if (!verified.valid) return json({ error: "INVALID_CREDENTIALS" }, 401);
      uid = await ensureFirebaseUid(env, user);
    } catch (error) {
      if (error instanceof PrivilegedAuthError) return privilegedAuthErrorResponse(error);
      return json({ error: "INVALID_CREDENTIALS" }, 401);
    }
  } else {
    try {
      user = await ensureFirebasePasswordReady(env, user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AUTH_MIGRATION_FAILED";
      const status = message === "PASSWORD_NOT_INITIALIZED" ? 503 : 502;
      return json({ error: message, message: "Không chuẩn bị được tài khoản Firebase." }, status);
    }

    uid = String(user.firebase_uid || "");
    const email = effectiveAuthEmail(firebaseUserSpec(user, uid));
    try {
      let credential;
      try {
        credential = await signInWithFirebasePassword(env.FIREBASE_WEB_API_KEY, email, password);
      } catch {
        const legacyValid = Boolean(
          user.password_hash &&
          user.password_salt &&
          await verifyPassword(password, user.password_salt, user.password_hash)
        );
        if (!legacyValid) return json({ error: "INVALID_CREDENTIALS" }, 401);
        await updateFirebaseIdentity(
          env.GOOGLE_RUNTIME_SA_JSON,
          env.FIREBASE_PROJECT_ID,
          firebaseUserSpec(user, uid),
          { password },
        );
        credential = await signInWithFirebasePassword(env.FIREBASE_WEB_API_KEY, email, password);
      }
      if (credential.localId !== uid) return json({ error: "INVALID_CREDENTIALS" }, 401);
    } catch {
      return json({ error: "INVALID_CREDENTIALS" }, 401);
    }
  }

  const activated = await activateInteractiveSession(env, user.user_id, channel, deviceId, Boolean(body.force));
  if ("conflict" in activated) {
    return json({
      error: "SESSION_ACTIVE_OTHER_DEVICE",
      channel,
      message: channel === "ANDROID"
        ? "Tài khoản đang đăng nhập trên App/PDA khác. Tiếp tục sẽ đăng xuất thiết bị App/PDA cũ."
        : "Tài khoản đang đăng nhập trên Web khác. Tiếp tục sẽ đăng xuất phiên Web cũ.",
    }, 409);
  }

  const customToken = await createFirebaseCustomToken(env.GOOGLE_RUNTIME_SA_JSON, uid, {
    app_role: user.role,
    app_base_role: user.base_role,
    app_user_id: user.user_id,
    employee_code: user.employee_code || "",
    app_session_channel: channel,
    app_session_generation: activated.generation,
  });
  try {
    const session = await exchangeCustomToken(env, customToken);
    const relayCustomToken = channel === "ANDROID"
      ? await createFirebaseCustomToken(env.GOOGLE_RUNTIME_SA_JSON, uid, {
          app_role: user.role,
          app_base_role: user.base_role,
          app_user_id: user.user_id,
          employee_code: user.employee_code || "",
          app_session_channel: "ANDROID",
          app_session_generation: activated.generation,
        })
      : undefined;
    return json({
      ...session,
      session_generation: activated.generation,
      session_channel: channel,
      ...(relayCustomToken ? { firebase_custom_token: relayCustomToken } : {}),
      ...(operatingWindow ? { operating_window: operatingWindow } : {}),
      user: publicUser(user),
    });
  } catch (error) {
    return json({ error: "FIREBASE_LOGIN_EXCHANGE_FAILED", message: error instanceof Error ? error.message : "Firebase login exchange failed" }, 502);
  }
}

async function setRootEffectiveRole(request: Request, env: Env): Promise<Response> {
  const actor = await requireUser(request, env);
  if (actor.base_role !== "ROOT") return json({ error: "FORBIDDEN" }, 403);
  let body: { role?: string } = {};
  try { body = (await request.json()) as { role?: string }; } catch { body = {}; }
  const role = String(body.role || "").trim().toUpperCase() as AppRole;
  if (!["ROOT", "ADMIN", "PICKPACK_ADMIN", "REPORTER", "PICKER"].includes(role)) return json({ error: "INVALID_ROLE" }, 400);

  const result = await coreJson<{ user: InternalUser | null }>(env, "/auth/root-role-override", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: actor.user_id, role }),
  });
  if (!result.user) return json({ error: "ROOT_ROLE_UPDATE_FAILED" }, 502);

  try {
    await coreStub(env).fetch("https://inventory-core.internal/realtime/close-user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: actor.user_id, reason: "role-changed" }),
    });
  } catch {
    // HTTP authorization already uses the new effective role; realtime reconnect will refresh role projection.
  }

  return json({ user: publicUser(result.user) });
}

async function changePassword(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_RUNTIME_SA_JSON || !env.FIREBASE_WEB_API_KEY) return json({ error: "AUTH_RUNTIME_NOT_CONFIGURED" }, 503);
  let user = await requireUser(request, env);
  if (isPrivilegedOneTimeUser(user)) {
    return json({
      error: "ONE_TIME_AUTH_ACCOUNT",
      message: "Tài khoản này sử dụng mật khẩu một lần hoặc mật khẩu khẩn cấp và không có mật khẩu cố định.",
    }, 409);
  }
  user = await ensureFirebasePasswordReady(env, user);
  const body = (await request.json()) as { current_password?: string; new_password?: string };
  const current = String(body.current_password || "");
  const nextPassword = String(body.new_password || "");
  const uid = String(user.firebase_uid || "");
  const email = effectiveAuthEmail(firebaseUserSpec(user, uid));
  try {
    const currentSession = await signInWithFirebasePassword(env.FIREBASE_WEB_API_KEY, email, current);
    if (currentSession.localId !== uid) return json({ error: "CURRENT_PASSWORD_INVALID" }, 400);
  } catch {
    return json({ error: "CURRENT_PASSWORD_INVALID" }, 400);
  }
  if (nextPassword.length < 8 || nextPassword.length > 128) return json({ error: "INVALID_PASSWORD" }, 400);
  await updateFirebaseIdentity(
    env.GOOGLE_RUNTIME_SA_JSON,
    env.FIREBASE_PROJECT_ID,
    firebaseUserSpec(user, uid),
    { password: nextPassword },
  );
  await savePassword(env, user.user_id, nextPassword);
  await coreJson(env, "/auth/firebase-password-ready", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.user_id, firebase_uid: uid }),
  });
  if (user.base_role === "ADMIN") {
    await coreJson(env, "/auth/firebase-agent-ready", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id }),
    });
  }
  return json({ status: "password_changed", reauth_required: true });
}

async function updateMyAuthEmail(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) return json({ error: "AUTH_RUNTIME_NOT_CONFIGURED" }, 503);
  let user = await requireUser(request, env);
  if (!["ROOT", "ADMIN"].includes(user.base_role)) return json({ error: "FORBIDDEN" }, 403);
  const body = (await request.json()) as { email?: string };
  let email = "";
  try { email = normalizeAuthEmail(body.email); } catch { return json({ error: "EMAIL_INVALID" }, 400); }
  if (!email) return json({ error: "EMAIL_REQUIRED" }, 400);
  // Recovery email is business metadata only. Firebase password sign-in keeps
  // the deterministic username-derived identifier so Agent can stay Worker-independent.
  const saved = await coreJson<{ user: InternalUser | null }>(env, "/auth/set-email", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.user_id, auth_email: email }),
  });
  return json({ status: "email_saved", user: saved.user ? publicUser(saved.user) : publicUser({ ...user, auth_email: email }) });
}

async function requestPasswordReset(request: Request, env: Env): Promise<Response> {
  let body: { username?: string; email?: string } = {};
  try { body = (await request.json()) as { username?: string; email?: string }; } catch { body = {}; }
  const username = String(body.username || "").trim().toLowerCase();
  let recoveryEmail = "";
  try { recoveryEmail = normalizeAuthEmail(body.email); } catch { recoveryEmail = ""; }

  const accepted = () => json({
    status: "accepted",
    message: "Nếu thông tin tài khoản và email khớp, hệ thống đã gửi liên kết đặt lại mật khẩu.",
  }, 202);

  if (!/^[a-z0-9._-]{1,64}$/.test(username) || !recoveryEmail) return accepted();

  let tokenHash = "";
  try {
    let user = await getUserByUsername(env, username);
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !["ROOT", "ADMIN"].includes(user.base_role) ||
      !user.auth_email ||
      normalizeAuthEmail(user.auth_email) !== recoveryEmail
    ) return accepted();

    if (isPrivilegedOneTimeUser(user)) return accepted();
    user = await ensureFirebasePasswordReady(env, user);
    const token = randomState() + randomState();
    tokenHash = await hashRecoveryToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const stored = await coreStub(env).fetch("https://inventory-core.internal/auth/password-recovery/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token_hash: tokenHash,
        user_id: user.user_id,
        created_at: now.toISOString(),
        expires_at: expiresAt,
      }),
    });
    if (!stored.ok) return accepted();

    const origin = new URL(request.url).origin;
    const link = origin + "/?password-reset=" + encodeURIComponent(token);
    await sendProjectEmail(
      env,
      recoveryEmail,
      "Đặt lại mật khẩu SUPRA Inventory",
      [
        "Bạn vừa yêu cầu đặt lại mật khẩu SUPRA Inventory.",
        "",
        "Mở liên kết sau để đặt mật khẩu mới:",
        link,
        "",
        "Liên kết có hiệu lực trong 15 phút và chỉ dùng một lần.",
        "Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.",
      ].join("\r\n"),
    );
  } catch {
    if (tokenHash) {
      await coreStub(env).fetch("https://inventory-core.internal/auth/password-recovery/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token_hash: tokenHash }),
      }).catch(() => undefined);
    }
  }
  return accepted();
}

async function confirmPasswordReset(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_RUNTIME_SA_JSON || !env.FIREBASE_WEB_API_KEY) {
    return json({ error: "AUTH_RUNTIME_NOT_CONFIGURED" }, 503);
  }
  let body: { token?: string; new_password?: string } = {};
  try { body = (await request.json()) as { token?: string; new_password?: string }; } catch { body = {}; }
  const token = String(body.token || "").trim();
  const nextPassword = String(body.new_password || "");
  if (!/^[a-f0-9]{128}$/i.test(token) || nextPassword.length < 8 || nextPassword.length > 128) {
    return json({ error: "RECOVERY_TOKEN_OR_PASSWORD_INVALID", message: "Liên kết hoặc mật khẩu mới không hợp lệ." }, 400);
  }

  const tokenHash = await hashRecoveryToken(token);
  const verifyResponse = await coreStub(env).fetch("https://inventory-core.internal/auth/password-recovery/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token_hash: tokenHash }),
  });
  const verified = (await verifyResponse.json()) as { status?: string; user_id?: string; error?: string };
  if (!verifyResponse.ok || verified.status !== "valid" || !verified.user_id) {
    return json({ error: verified.error || "RECOVERY_TOKEN_INVALID", message: "Liên kết đặt lại mật khẩu không còn hợp lệ." }, 400);
  }

  let user = await getUserById(env, verified.user_id);
  if (!user || user.status !== "ACTIVE" || !["ROOT", "ADMIN"].includes(user.base_role)) {
    return json({ error: "RECOVERY_USER_INVALID" }, 400);
  }
  if (isPrivilegedOneTimeUser(user)) {
    return json({ error: "ONE_TIME_AUTH_ACCOUNT", message: "Tài khoản này không sử dụng mật khẩu cố định." }, 409);
  }
  user = await ensureFirebasePasswordReady(env, user);
  const uid = String(user.firebase_uid || "");
  await updateFirebaseIdentity(
    env.GOOGLE_RUNTIME_SA_JSON,
    env.FIREBASE_PROJECT_ID,
    firebaseUserSpec(user, uid),
    { password: nextPassword },
  );
  await savePassword(env, user.user_id, nextPassword);
  await coreJson(env, "/auth/firebase-password-ready", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.user_id, firebase_uid: uid }),
  });
  if (user.base_role === "ADMIN") {
    await coreJson(env, "/auth/firebase-agent-ready", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id }),
    });
  }
  await coreStub(env).fetch("https://inventory-core.internal/auth/password-recovery/consume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token_hash: tokenHash }),
  });
  return json({ status: "password_reset", message: "Đã đặt lại mật khẩu. Hãy đăng nhập lại." });
}

async function logoutInteractiveSession(request: Request, env: Env): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) return json({ status: "ended" });
  let identity: Awaited<ReturnType<typeof verifyFirebaseIdToken>>;
  try { identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID); }
  catch { return json({ status: "ended" }); }
  if (identity.sessionChannel !== "WEB" && identity.sessionChannel !== "ANDROID") return json({ status: "ended" });
  const user = await getUserByFirebaseUid(env, identity.uid);
  if (!user) return json({ status: "ended" });
  let body: { device_id?: string } = {};
  try { body = (await request.json()) as { device_id?: string }; } catch { body = {}; }
  const deviceId = String(body.device_id || "").trim().slice(0, 160);
  if (deviceId && identity.sessionGeneration > 0) {
    await coreStub(env).fetch("https://inventory-core.internal/auth/end-session", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_id: user.user_id,
        channel: identity.sessionChannel,
        generation: identity.sessionGeneration,
        device_id: deviceId,
      }),
    });
    await closeUserRealtime(env, user.user_id, identity.sessionChannel);
    if (identity.sessionChannel === "ANDROID" && user.base_role === "PICKER") {
      await refreshPickerProjectionBestEffort(env, "LOGOUT", [{ user_id: user.user_id, session_generation: identity.sessionGeneration }]);
    }
  }
  return json({ status: "ended" });
}

async function startGoogleOAuth(env: Env): Promise<Response> {
  if (!oauthBindingsReady(env)) return json({ error: "oauth_not_configured" }, 503);
  const state = randomState();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID!, redirect_uri: env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI!, response_type: "code",
    scope: DRIVE_SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      "set-cookie": `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; Path=/api/oauth/google; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      "cache-control": "no-store", "referrer-policy": "no-referrer",
    },
  });
}

async function googleOAuthCallback(request: Request, env: Env): Promise<Response> {
  if (!oauthBindingsReady(env)) return json({ error: "oauth_not_configured" }, 503);
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) return html(`<h1>OAuth cancelled/failed</h1><p>${escapeHtml(oauthError)}</p>`, 400);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request, OAUTH_STATE_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) return html("<h1>OAuth state validation failed</h1>", 400);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID!, client_secret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET!, redirect_uri: env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI!, grant_type: "authorization_code" }),
  });
  const tokenPayload = (await tokenResponse.json()) as { refresh_token?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok) return html(`<h1>Token exchange failed</h1><p>${escapeHtml(tokenPayload.error_description || tokenPayload.error || "token_exchange_failed")}</p>`, 502);
  if (!tokenPayload.refresh_token) return html("<h1>No refresh token returned</h1>", 502);
  return html(
    `<!doctype html><html><head><meta charset="utf-8"><title>SUPRA Inventory OAuth</title></head><body style="font-family:system-ui;max-width:900px;margin:40px auto;padding:0 20px"><h1>Google Drive OAuth thành công</h1><p>Copy giá trị dưới đây vào Cloudflare Worker secret <code>GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN</code>. Không gửi token qua chat/email/GitHub.</p><textarea readonly style="width:100%;height:160px">${escapeHtml(tokenPayload.refresh_token)}</textarea></body></html>`,
    200,
    { "set-cookie": `${OAUTH_STATE_COOKIE}=; Path=/api/oauth/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      const publicInfoPage = handlePublicInfoPage(request, env.APP_ENV);
      if (publicInfoPage) return publicInfoPage;

      const d119Internal = await handleD119Internal(request, env);
      if (d119Internal) return d119Internal;

      if (request.method === "GET" && url.pathname === "/health") {
        const bindingPresence = Object.fromEntries(REQUIRED_RUNTIME_BINDINGS.map((name) => [name, Boolean(env[name])]));
        const missing = REQUIRED_RUNTIME_BINDINGS.filter((name) => !env[name]);
        const core = await checkCore(env);
        const launcherFolder = await coreJson<{
          folder_id?: string; last_error?: string; updated_at?: string;
        }>(env, "/runtime-logs/launcher-folder").catch(() => ({folder_id:"",last_error:"",updated_at:""}));
        let agentAuthMigration = { migrated: 0, failed: 0, remaining: 0, agent_migrated: 0, agent_failed: 0, agent_remaining: 0 };
        if (core.ok && env.GOOGLE_RUNTIME_SA_JSON) {
          try {
            agentAuthMigration = await migrateActiveAdminFirebaseCredentials(env);
          } catch {
            agentAuthMigration = { migrated: 0, failed: 1, remaining: 1, agent_migrated: 0, agent_failed: 1, agent_remaining: 1 };
          }
        }
        const healthy = missing.length === 0 && core.ok &&
          agentAuthMigration.failed === 0 && agentAuthMigration.remaining === 0 &&
          agentAuthMigration.agent_failed === 0 && agentAuthMigration.agent_remaining === 0;
        return json({
          status: healthy ? "ok" : "degraded", service: env.PROJECT_KEY || "supra-inventory", environment: env.APP_ENV || "unknown",
          source_commit: env.SOURCE_COMMIT || "",
          required_bindings: bindingPresence, oauth_refresh_token_configured: Boolean(env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN),
          root_bootstrap_secret_configured: Boolean(env.ROOT_BOOTSTRAP_PASSWORD), logs_folder_configured: Boolean(env.LOGS_FOLDER_ID),
          pda_registry_configured: Boolean(env.PDA_REGISTRY_SHEET_ID && env.GOOGLE_RUNTIME_SA_JSON),
          launcher_archive: {
            worker_owned_folder_ready: Boolean(launcherFolder.folder_id),
            last_setup_error: String(launcherFolder.last_error || "").slice(0, 80),
            updated_at: launcherFolder.updated_at || null,
          },
          storage: core, agent_auth_migration: agentAuthMigration, missing_bindings: missing, timestamp: new Date().toISOString(),
        }, healthy ? 200 : 503);
      }

      if (request.method === "POST" && url.pathname === "/api/internal/d161/hr-drive-watch") {
        return handleHrDriveWatchNotification(request, env);
      }

      if (request.method === "GET" && url.pathname === "/downloads/pda/latest") {
        return redirectLatestPdaApk();
      }
      if (request.method === "GET" && url.pathname === "/downloads/pda/latest.sha256") {
        return redirectLatestPdaChecksum();
      }
      if (request.method === "GET" && url.pathname === "/downloads/pda/manifest") {
        try {
          const release = await latestPdaAppRelease();
          return json({
            channel: "beta",
            tag: release.tag,
            version_code: Number(release.tag.replace("beta-vc", "")),
            // D166 Owner approved a mandatory ALL-PDA Beta vc104 rollout.
            // Arm the floor only AFTER vc104 is signed and on the public release channel.
            // The optional Beta environment override can lower the floor during recovery.
            minimum_version_code: Number(release.tag.replace("beta-vc", "")) >= 104
              ? Math.min(
                  Number(release.tag.replace("beta-vc", "")),
                  Math.max(0, Math.trunc(Number(env.PDA_MIN_VERSION_CODE_BETA || "104") || 0)),
                )
              : 0,
            name: release.name,
            published_at: release.published_at,
            source: release.source,
            size_bytes: release.size_bytes,
            digest: release.digest,
            apk_path: release.stable_download_path,
            checksum_path: "/downloads/pda/latest.sha256",
            release_notes: release.release_notes,
          });
        } catch (error) {
          return json({ error: "PDA_RELEASE_CHANNEL_UNAVAILABLE", message: error instanceof Error ? error.message : "release_channel_unavailable" }, 503);
        }
      }
      if (request.method === "GET" && url.pathname === "/downloads/agent/latest") {
        return redirectLatestAgentExe();
      }
      if (request.method === "GET" && url.pathname === "/downloads/agent/latest.sha256") {
        return redirectLatestAgentChecksum();
      }
      if (request.method === "GET" && url.pathname === "/downloads/agent/manifest") {
        try {
          const release = await latestAgentAppRelease();
          return json({
            channel: "beta",
            tag: release.tag,
            build: Number(release.tag.replace("relay-agent-v", "")),
            name: release.name,
            published_at: release.published_at,
            source: release.source,
            size_bytes: release.size_bytes,
            digest: release.digest,
            exe_path: release.stable_download_path,
            checksum_path: "/downloads/agent/latest.sha256",
            release_notes: release.release_notes,
          });
        } catch (error) {
          return json({ error: "AGENT_RELEASE_CHANNEL_UNAVAILABLE", message: error instanceof Error ? error.message : "release_channel_unavailable" }, 503);
        }
      }
      if (request.method === "GET" && url.pathname === "/downloads/agent/browser/latest") {
        return redirectLatestAgentBrowserBundle();
      }
      if (request.method === "GET" && url.pathname === "/downloads/agent/browser/latest.sha256") {
        return redirectLatestAgentBrowserChecksum();
      }
      if (request.method === "GET" && url.pathname === "/downloads/agent/browser/manifest") {
        try {
          const release = await latestAgentBrowserBundle();
          return json({
            channel: "beta",
            version: release.version,
            host_build: release.host_build,
            host_arch: release.host_arch,
            asset_name: release.asset_name,
            size_bytes: release.size_bytes,
            sha256: release.sha256,
            bundle_path: "/downloads/agent/browser/latest",
            checksum_path: "/downloads/agent/browser/latest.sha256",
          });
        } catch (error) {
          return json({ error: "AGENT_BROWSER_CHANNEL_UNAVAILABLE", message: error instanceof Error ? error.message : "browser_channel_unavailable" }, 503);
        }
      }

      if (request.method === "GET" && url.pathname === "/downloads/launcher/latest") {
        return redirectLatestLauncherApk();
      }
      if (request.method === "GET" && url.pathname === "/downloads/launcher/latest.sha256") {
        return redirectLatestLauncherChecksum();
      }
      if (request.method === "GET" && /^\/downloads\/launcher\/releases\/\d+\.\d+\.\d+$/.test(url.pathname)) {
        const version = url.pathname.substring("/downloads/launcher/releases/".length);
        return new Response(null, { status: 302, headers: {
          "location": `https://github.com/tamnv2/supra-pda-launcher/releases/download/v${version}/SUPRA-PDA-Launcher-v${version}.apk`,
          "cache-control": "public, max-age=300",
        } });
      }
      if (request.method === "GET" && url.pathname === "/downloads/launcher/manifest") {
        try {
          const release = await latestLauncherRelease();
          const resolved = await resolveLauncherManifest(env, url.searchParams.get("device_key"), release);
          return json(resolved);
        } catch (error) {
          return json({ error: "LAUNCHER_RELEASE_CHANNEL_UNAVAILABLE", message: error instanceof Error ? error.message : "release_channel_unavailable" }, 503);
        }
      }
      if (url.pathname === "/api/admin/launcher/update-policies" && request.method === "GET") {
        await requireUser(request, env, ["ROOT", "ADMIN"]);
        return json(await loadLauncherUpdateConfig(env));
      }
      if (url.pathname === "/api/admin/launcher/update-policies" && request.method === "PUT") {
        const user = await requireUser(request, env, ["ROOT"]);
        const raw = await request.json() as { expected_revision?: unknown; rules?: unknown };
        let rules;
        try { rules = validateLauncherRules(raw.rules); }
        catch (error) { return json({ error: error instanceof Error ? error.message : "INVALID_UPDATE_POLICIES" }, 400); }
        const revision = Number(raw.expected_revision);
        if (!Number.isSafeInteger(revision) || revision < 0) return json({ error: "INVALID_EXPECTED_REVISION" }, 400);
        // Separate deployment gate: a ROOT operator cannot enable an
        // arbitrary version/scope without the owner's GitHub Actions receipt.
        // Missing or mismatching receipts fail closed, prior policy unchanged.
        try {
          await verifyLauncherOwnerApproval(rules);
        } catch (error) {
          return json({
            error: error instanceof Error ? error.message : "OWNER_APPROVAL_REQUIRED",
          }, 409);
        }
        return coreStub(env).fetch("https://inventory-core.internal/launcher-update/policies", {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify({ rules, expected_revision: revision, updated_by: user.user_id }),
        });
      }

      if (request.method === "GET" && url.pathname === "/api/system/capabilities") {
        const core = await checkCore(env);
        return json({
          environment: env.APP_ENV,
          firebase_auth: "firebase_password_authority_with_channel_scoped_app_sessions",
          durable_objects_sqlite: core.ok,
          business_api: {
            version: 1,
            sku_master: "implemented",
            picker_report_withdraw: "implemented",
            reporter_priority_resolve_correction: "implemented",
            three_stage_sla_auto_skip: "implemented",
            auto_skip_modes: ["FIRST_REPORT", "PER_PICKER"],
            admin_monitoring: "implemented",
            mutation_idempotency: "required_request_id",
            operational_v2_ready: core.operational_v2?.ready === true,
            operational_v2_schema_version: core.operational_v2?.schema_version ?? 0,
          },
          realtime_foreground: "websocket_sequence_delta_on_inventory_core",
          background_notifications: "firebase_cloud_messaging",
          runtime_logs: { drive: Boolean(env.LOGS_FOLDER_ID), sources: ["WEB", "ANDROID", "AGENT"], schedule: ["06:00", "12:00", "18:00", "21:00"], android_info_policy: "session_end_only", error_upload: "immediate_best_effort", agent_bridge: "firestore_spool_to_drive_5m" },
          hr_source_setup: { mode: "web_admin_input", required_input: ["google_sheet_url", "tab_name"], validation: ["valid_google_sheet_link", "exact_tab_name", "configured_employee_code_column", "configured_full_name_column", "configured_contractor_column"], public_setup_endpoint: false },
          root_password_initialized: Boolean(core.root_password_initialized), stable_release: "owner_gated",
        });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/privileged-code") return requestPrivilegedCode(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/privileged-agent-login") return privilegedAgentLogin(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/login") return login(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/refresh") return refreshSession(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/logout") return logoutInteractiveSession(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/password-reset") return requestPasswordReset(request, env);
      if (request.method === "POST" && url.pathname === "/api/auth/password-reset/confirm") return confirmPasswordReset(request, env);
      if (request.method === "GET" && url.pathname === "/api/auth/me") return json({ user: publicUser(await requireUser(request, env)) });
      if (request.method === "GET" && url.pathname === "/api/auth/android-window") {
        await requireUser(request, env, ["PICKER", "REPORTER", "ADMIN"]);
        return coreStub(env).fetch("https://inventory-core.internal/notifications/alert-window/reconcile");
      }
      if (request.method === "PUT" && url.pathname === "/api/auth/root-role") return setRootEffectiveRole(request, env);
      if (request.method === "PUT" && url.pathname === "/api/auth/change-password") return changePassword(request, env);
      if (request.method === "PUT" && url.pathname === "/api/auth/email") return updateMyAuthEmail(request, env);

      if (request.method === "GET" && url.pathname === "/api/admin/system-status") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        return json({ error: "SYSTEM_STATUS_DISABLED_QUOTA_GUARD" }, 410);
      }

      if (request.method === "POST" && url.pathname === "/api/agent/reauth") {
        return privilegedAgentReauth(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/agent/d166/usage") {
        if (env.APP_ENV !== "beta") return json({error:"D166_BETA_ONLY"},404);
        const operator = await requireAgentUser(request,env,["ADMIN","PICKPACK_ADMIN"]);
        if (operator.base_role !== operator.role ||
          !["admin","tamnv2"].includes(String(operator.employee_code || "").trim().toLowerCase()))
          return json({error:"D166_PRIVILEGED_AGENT_REQUIRED"},403);
        let body: {start_at?:string;end_at?:string}={};
        try {body=(await request.json()) as typeof body;} catch {return json({error:"D166_INVALID_JSON"},400);}
        const a=String(body.start_at || "");
        const b=String(body.end_at || "");
        if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(a) ||
            !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(b))
          return json({error:"D166_INVALID_WINDOW"},400);
        const start=new Date(a), end=new Date(b), now=Date.now();
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
            end.getTime()<=start.getTime() || end.getTime()-start.getTime()>24*60*60*1000 ||
            end.getTime()>now+5*60*1000 || start.getTime()<now-26*60*60*1000)
          return json({error:"D166_WINDOW_OUT_OF_SCOPE"},400);
        const value=await collectD166Cf(env,start,end);
        return json({ok:true,service:"SUPRA_D166_CLOUDFLARE_WORKER_READONLY",project:"supra-inventory-beta",
          generated_at:new Date().toISOString(),cloudflare:value});
      }

      if (request.method === "GET" && url.pathname === "/api/agent/log-day-folder") {
        if (env.APP_ENV !== "beta") return json({ error: "LOG_DAY_BETA_ONLY" }, 404);
        // Authorized Agent session only. The folder ID is metadata needed
        // by the Apps Script uploader; never return OAuth material.
        await requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"]);
        const selected = await resolveRuntimeLogDayForAgent(env);
        return json({ ok: true, archive_date: selected.dateKey, folder_id: selected.id,
          source: "INVENTORY_CORE_CANONICAL_DAY" });
      }

      if (request.method === "GET" && url.pathname === "/api/agent/usage") {
        return json({ error: "USAGE_RETIRED_D136" }, 410);
      }

      if (request.method === "GET" && url.pathname === "/api/admin/pda-app") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        try {
          return json({ status: "ok", release: await latestPdaAppRelease() });
        } catch (error) {
          return json({ error: "PDA_RELEASE_CHANNEL_UNAVAILABLE", message: error instanceof Error ? error.message : "release_channel_unavailable" }, 502);
        }
      }
      if (request.method === "GET" && url.pathname === "/api/admin/agent-app") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        try {
          return json({ status: "ok", release: await latestAgentAppRelease() });
        } catch (error) {
          return json({ error: "AGENT_RELEASE_CHANNEL_UNAVAILABLE", message: error instanceof Error ? error.message : "release_channel_unavailable" }, 502);
        }
      }

      if (url.pathname.startsWith("/api/__beta_load_test__/")) {
        if (!(await loadTestAuthorized(request, env))) return json({ error: "NOT_FOUND" }, 404);

        if (request.method === "GET" && url.pathname === "/api/__beta_load_test__/prepare") {
          const pickers = Math.max(1, Math.min(200, Number(url.searchParams.get("pickers") || 100)));
          const skus = Math.max(1, Math.min(1000, Number(url.searchParams.get("skus") || 400)));
          return coreStub(env).fetch(`https://inventory-core.internal/admin/load-test/candidates?pickers=${pickers}&skus=${skus}`);
        }

        if (request.method === "POST" && url.pathname === "/api/__beta_load_test__/session") {
          if (!env.GOOGLE_RUNTIME_SA_JSON || !env.FIREBASE_WEB_API_KEY) return json({ error: "AUTH_RUNTIME_NOT_CONFIGURED" }, 503);
          let body: { user_id?: string } = {};
          try { body = (await request.json()) as { user_id?: string }; } catch { body = {}; }
          const userId = String(body.user_id || "").trim();
          const user = userId ? await getUserById(env, userId) : null;
          if (!user || user.role !== "PICKER" || user.status !== "ACTIVE" || !user.employee_code) {
            return json({ error: "INVALID_LOAD_TEST_PICKER" }, 400);
          }
          const firebaseUid = await ensureFirebaseUid(env, user);
          const customToken = await createFirebaseCustomToken(env.GOOGLE_RUNTIME_SA_JSON, firebaseUid, {
            app_role: "PICKER",
            app_base_role: user.base_role,
            app_user_id: user.user_id,
            employee_code: user.employee_code,
          });
          try {
            const session = await exchangeCustomToken(env, customToken);
            return json({
              id_token: session.id_token,
              expires_in: session.expires_in,
              user: {
                user_id: user.user_id,
                employee_code: user.employee_code,
                display_name: user.display_name,
                role: "PICKER",
              },
            });
          } catch (error) {
            return json({ error: "LOAD_TEST_SESSION_FAILED", message: error instanceof Error ? error.message : "session_failed" }, 502);
          }
        }

        if (request.method === "GET" && url.pathname === "/api/__beta_load_test__/snapshot") {
          return json(await collectSystemStatus(env, false, false));
        }

        if (request.method === "POST" && url.pathname === "/api/__beta_load_test__/record") {
          let body: Record<string, unknown> = {};
          try { body = (await request.json()) as Record<string, unknown>; } catch { return json({ error: "INVALID_JSON" }, 400); }
          return coreStub(env).fetch("https://inventory-core.internal/admin/load-test/result", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
        }

        return json({ error: "NOT_FOUND" }, 404);
      }

      if (request.method === "POST" && url.pathname === "/api/agent/support-log-request") {
        const operator = await requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"]);
        if (operator.base_role !== operator.role) return json({ error: "AGENT_OPERATOR_REQUIRED" }, 403);
        const login = String(operator.employee_code || "").trim().toLowerCase();
        if (!["admin", "tamnv2"].includes(login)) return json({ error: "D161_PRIVILEGED_AGENT_REQUIRED" }, 403);
        let body: { request_id?: string } = {};
        try {
          body = (await request.json()) as { request_id?: string };
        } catch {
          return json({ error: "INVALID_JSON" }, 400);
        }
        const requestId = String(body.request_id || "").trim();
        if (!/^support-[A-Za-z0-9]{16,80}$/.test(requestId)) {
          return json({ error: "INVALID_SUPPORT_LOG_REQUEST" }, 400);
        }
        const now = Date.now();
        const expiresAtMs = now + 120_000;
        const traceId = requestId;
        const claimResponse = await coreStub(env).fetch("https://inventory-core.internal/support-log-request/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            request_id: requestId,
            issued_by_user_id: operator.user_id,
            expires_at_ms: expiresAtMs,
            trace_id: traceId,
          }),
        });
        const claim = await claimResponse.json() as {
          claimed?: boolean;
          idempotent_replay?: boolean;
          issued_at_ms?: number;
          expires_at_ms?: number;
          error?: string;
        };
        if (!claimResponse.ok) return json(claim, claimResponse.status);
        if (claim.claimed !== true) {
          return json({
            status: "support_log_request_accepted",
            request_id: requestId,
            trace_id: traceId,
            idempotent_replay: true,
            expires_at_ms: Number(claim.expires_at_ms || expiresAtMs),
          });
        }

        const issuedAtMs = Number(claim.issued_at_ms || now);
        const claimedExpiresAtMs = Number(claim.expires_at_ms || expiresAtMs);
        const propagation: Record<string, unknown> = {
          agent_control: "DEFERRED",
          realtime: "DEFERRED",
          android_fcm: "DEFERRED",
        };

        try {
          await publishAgentSupportLogRequest(env, {
            request_id: requestId,
            trace_id: traceId,
            issued_at_ms: issuedAtMs,
            expires_at_ms: claimedExpiresAtMs,
            issued_by_user_id: operator.user_id,
            issued_by_login: login,
          });
          propagation.agent_control = "PUBLISHED";
        } catch (error) {
          propagation.agent_control = error instanceof Error ? error.message.slice(0, 120) : "FAILED";
        }

        try {
          const realtimeResponse = await coreStub(env).fetch("https://inventory-core.internal/realtime/broadcast", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              event: "support_log_request",
              scopes: ["support_log_request"],
              tags: ["role:PICKER", "role:REPORTER", "role:ADMIN", "role:PICKPACK_ADMIN", "role:ROOT"],
              metadata: {
                request_id: requestId,
                trace_id: traceId,
                issued_at_ms: issuedAtMs,
                expires_at_ms: claimedExpiresAtMs,
                source: "D161_GLOBAL_SUPPORT_LOG",
              },
            }),
          });
          const realtime = await realtimeResponse.json() as Record<string, unknown>;
          propagation.realtime = realtimeResponse.ok ? realtime : { error: realtime.error || realtimeResponse.status };
        } catch {
          propagation.realtime = "FAILED";
        }

        if (env.GOOGLE_RUNTIME_SA_JSON) {
          try {
            const targetResponse = await coreStub(env).fetch("https://inventory-core.internal/notifications/targets", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                roles: ["PICKER", "REPORTER", "ADMIN"],
              }),
            });
            const target = await targetResponse.json() as { tokens?: string[] };
            const tokens = Array.isArray(target.tokens) ? target.tokens : [];
            const delivery = await sendFcmNotifications(
              env.GOOGLE_RUNTIME_SA_JSON,
              env.FIREBASE_PROJECT_ID,
              tokens,
              {
                title: "SUPRA Inventory · Yêu cầu log hỗ trợ",
                body: "Hệ thống đang thu thập log chẩn đoán.",
                data: {
                  event: "support_log_request",
                  request_id: requestId,
                  trace_id: traceId,
                  issued_at_ms: String(issuedAtMs),
                  expires_at_ms: String(claimedExpiresAtMs),
                  source: "D161_GLOBAL_SUPPORT_LOG",
                },
              },
            );
            propagation.android_fcm = { sent: delivery.sent, failed: delivery.failed };
            if (delivery.invalidTokens.length) {
              await coreStub(env).fetch("https://inventory-core.internal/notifications/disable-tokens", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ tokens: delivery.invalidTokens }),
              }).catch(() => undefined);
            }
          } catch {
            propagation.android_fcm = "FAILED";
          }
        }

        return json({
          status: "support_log_request_accepted",
          request_id: requestId,
          trace_id: traceId,
          issued_at_ms: issuedAtMs,
          expires_at_ms: claimedExpiresAtMs,
          idempotent_replay: false,
          propagation,
        });
      }

      if (
        (request.method === "GET" && url.pathname === "/api/agent/picker-session/revoke-all-preview") ||
        (request.method === "POST" && url.pathname === "/api/agent/picker-session/revoke-all")
      ) {
        const operator = await requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"]);
        if (operator.base_role !== operator.role) return json({ error: "AGENT_OPERATOR_REQUIRED" }, 403);
        const login = String(operator.employee_code || "").trim().toLowerCase();
        if (!["admin", "tamnv2"].includes(login)) return json({ error: "D161_PRIVILEGED_AGENT_REQUIRED" }, 403);

        if (request.method === "GET") {
          const countResponse = await coreStub(env).fetch("https://inventory-core.internal/auth/picker-android-session-count");
          const countPayload = await countResponse.json() as Record<string, unknown>;
          return json(countPayload, countResponse.status);
        }

        let body: { request_id?: string } = {};
        try {
          body = (await request.json()) as { request_id?: string };
        } catch {
          return json({ error: "INVALID_JSON" }, 400);
        }
        const requestId = String(body.request_id || "").trim();
        if (!/^[A-Za-z0-9._:-]{8,160}$/.test(requestId)) {
          return json({ error: "INVALID_BULK_REVOKE_COMMAND" }, 400);
        }

        const revokeResponse = await coreStub(env).fetch("https://inventory-core.internal/auth/revoke-all-picker-android-sessions", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            request_id: requestId,
            issued_by_user_id: operator.user_id,
          }),
        });
        const revokePayload = await revokeResponse.json() as {
          status?: string;
          request_id?: string;
          affected?: number;
          idempotent_replay?: boolean;
          targets?: Array<{ user_id?: string; revoked_generation?: number }>;
          error?: string;
        };
        if (!revokeResponse.ok) return json(revokePayload, revokeResponse.status);

        const targets = Array.isArray(revokePayload.targets) ? revokePayload.targets.slice(0, 2000) : [];
        const userIds = targets.map((item) => String(item.user_id || "").trim()).filter(Boolean);
        if (userIds.length) {
          await clearPickerNotificationTargets(env, userIds).catch(() => undefined);
          await coreStub(env).fetch("https://inventory-core.internal/realtime/close-users", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              user_ids: userIds,
              client_type: "ANDROID",
              reason: "session-changed",
            }),
          }).catch(() => undefined);
          await refreshPickerProjectionBestEffort(
            env,
            "D161_BULK_PICKER_REVOKE",
            targets
              .map((item) => ({
                user_id: String(item.user_id || ""),
                session_generation: Math.max(0, Math.trunc(Number(item.revoked_generation || 0))),
              }))
              .filter((item) => item.user_id && item.session_generation > 0),
          ).catch(() => undefined);
        }

        return json({
          status: String(revokePayload.status || "bulk_picker_android_sessions_revoked"),
          request_id: requestId,
          affected: Math.max(0, Math.trunc(Number(revokePayload.affected || userIds.length))),
          idempotent_replay: revokePayload.idempotent_replay === true,
        });
      }

      if (request.method === "POST" && url.pathname === "/api/agent/picker-session/revoke") {
        const operator = await requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"]);
        if (operator.base_role !== operator.role) return json({ error: "AGENT_OPERATOR_REQUIRED" }, 403);
        let body: {
          user_id?: string;
          firebase_uid?: string;
          revoked_generation?: number;
          request_id?: string;
          agent_instance_id?: string;
        } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "INVALID_JSON" }, 400);
        }
        const userId = String(body.user_id || "").trim();
        const firebaseUid = String(body.firebase_uid || "").trim();
        const revokedGeneration = Math.max(0, Math.trunc(Number(body.revoked_generation || 0)));
        const suppliedRequestId = String(body.request_id || "").trim();
        const agentInstanceId = String(body.agent_instance_id || "").trim().slice(0, 180);
        if (!userId || !firebaseUid || revokedGeneration <= 0) {
          return json({ error: "INVALID_PICKER_SESSION" }, 400);
        }
        if (suppliedRequestId && !/^[A-Za-z0-9._:-]{8,160}$/.test(suppliedRequestId)) {
          return json({ error: "INVALID_SINGLE_REVOKE_COMMAND" }, 400);
        }
        const requestId = suppliedRequestId || ("legacy-" + crypto.randomUUID().replaceAll("-", ""));

        const response = await coreStub(env).fetch("https://inventory-core.internal/auth/revoke-android-session", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            firebase_uid: firebaseUid,
            revoked_generation: revokedGeneration,
            force_current: true,
            request_id: requestId,
            issued_by_user_id: operator.user_id,
          }),
        });
        const payload = await response.json() as Record<string, unknown>;
        if (!response.ok) return json(payload, response.status);

        const authoritativeGeneration = Math.max(
          0,
          Math.trunc(Number(payload.revoked_generation || revokedGeneration)),
        );
        if (authoritativeGeneration <= 0) {
          return json({ error: "INVALID_REVOKE_RESPONSE", request_id: requestId }, 502);
        }

        // v109+ sends one idempotent command and lets Worker publish the existing
        // per-Picker generation fence only after InventoryCore authority commits.
        // Older Agents supplied no request_id and already wrote that same fence.
        if (suppliedRequestId) {
          try {
            await publishPickerSessionRevocation(env, {
              user_id: userId,
              firebase_uid: firebaseUid,
              revoked_generation: authoritativeGeneration,
              kicked_at_ms: Date.now(),
              issued_by_user_id: operator.user_id,
              issued_by_agent_instance_id: agentInstanceId,
            });
          } catch {
            return json({
              error: "PICKER_SESSION_SIGNAL_FAILED",
              authority_revoked: true,
              request_id: requestId,
              revoked_generation: authoritativeGeneration,
            }, 502);
          }
        }

        await closeUserRealtime(env, userId, "ANDROID");
        if (payload.status === "android_session_revoked" || payload.status === "android_session_already_superseded") {
          await mirrorPickerNotificationTarget(env, {
            user_id: userId,
            device_id: "",
            platform: "ANDROID",
            enabled: false,
          }).catch(() => undefined);
        }
        await refreshPickerProjectionBestEffort(
          env,
          "AGENT_KICK",
          [{ user_id: userId, session_generation: authoritativeGeneration }],
        ).catch(() => undefined);
        return json({
          ...payload,
          request_id: requestId,
          revoked_generation: authoritativeGeneration,
          session_signal: suppliedRequestId ? "PUBLISHED_AFTER_AUTHORITY" : "LEGACY_AGENT_DIRECT",
        });
      }

      if (request.method === "POST" && url.pathname === "/api/diagnostics/dnd/upload") {
        if (env.APP_ENV !== "beta") return json({ error: "NOT_FOUND" }, 404);
        if (request.headers.get("x-dnd-diagnostic-version") !== "1") return json({ error: "DND_DIAGNOSTIC_HEADER_REQUIRED" }, 400);
        const declaredLength = Number(request.headers.get("content-length") || "0");
        if (declaredLength > 20_000) return json({ error: "DND_DIAGNOSTIC_PAYLOAD_TOO_LARGE" }, 413);

        let raw = "";
        try { raw = await request.text(); } catch { return json({ error: "INVALID_BODY" }, 400); }
        if (!raw || raw.length > 20_000) return json({ error: "DND_DIAGNOSTIC_PAYLOAD_TOO_LARGE" }, 413);

        let input: Record<string, unknown> = {};
        try { input = JSON.parse(raw) as Record<string, unknown>; } catch { return json({ error: "INVALID_JSON" }, 400); }
        if (input.schema !== "dnd-diagnostic-v1") return json({ error: "INVALID_DND_DIAGNOSTIC_SCHEMA" }, 400);

        const identity = dndDiagnosticRecord(input.identity);
        const build = dndDiagnosticRecord(input.build);
        const profile = dndDiagnosticRecord(input.profile);
        const dnd = dndDiagnosticRecord(input.dnd);
        const packageName = dndDiagnosticString(identity.package, 100);
        const deviceHash = dndDiagnosticString(identity.device_id_hash, 32).toLowerCase();
        if (packageName !== "cd.cc.supra.inventory.dnddiag" || !/^[a-f0-9]{16}$/.test(deviceHash)) {
          return json({ error: "INVALID_DND_DIAGNOSTIC_IDENTITY" }, 400);
        }

        const ip = dndDiagnosticString(request.headers.get("cf-connecting-ip") || "unknown", 80);
        const rateKey = ip + "|" + deviceHash;
        const now = Date.now();
        const last = dndDiagnosticLastUpload.get(rateKey) || 0;
        if (now - last < 10_000) return json({ error: "DND_DIAGNOSTIC_RATE_LIMITED" }, 429);
        dndDiagnosticLastUpload.set(rateKey, now);
        if (dndDiagnosticLastUpload.size > 256) {
          const cutoff = now - 60 * 60_000;
          for (const [key, seenAt] of dndDiagnosticLastUpload) if (seenAt < cutoff) dndDiagnosticLastUpload.delete(key);
        }

        const generatedAt = dndDiagnosticString(input.generated_at, 80);
        const allowedPayload = {
          schema: "dnd-diagnostic-v1",
          build: {
            manufacturer: dndDiagnosticString(build.manufacturer, 80),
            brand: dndDiagnosticString(build.brand, 80),
            model: dndDiagnosticString(build.model, 80),
            device: dndDiagnosticString(build.device, 80),
            product: dndDiagnosticString(build.product, 80),
            board: dndDiagnosticString(build.board, 80),
            hardware: dndDiagnosticString(build.hardware, 80),
            bootloader: dndDiagnosticString(build.bootloader, 120),
            id: dndDiagnosticString(build.id, 120),
            display: dndDiagnosticString(build.display, 180),
            fingerprint: dndDiagnosticString(build.fingerprint, 300),
            sdk_int: Number(build.sdk_int || 0),
            release: dndDiagnosticString(build.release, 40),
            incremental: dndDiagnosticString(build.incremental, 120),
            security_patch: dndDiagnosticString(build.security_patch, 40),
          },
          identity: {
            device_id_hash: deviceHash,
            package: packageName,
            uid: Number(identity.uid || 0),
            derived_user_id: Number(identity.derived_user_id || 0),
            first_install_time: Number(identity.first_install_time || 0),
            last_update_time: Number(identity.last_update_time || 0),
          },
          profile: {
            managed_profile: profile.managed_profile === true,
            restriction_adjust_volume: profile.restriction_adjust_volume === true,
            restriction_config_sound: profile.restriction_config_sound === true,
            restriction_config_settings: profile.restriction_config_settings === true,
            this_app_device_owner: profile.this_app_device_owner === true,
            this_app_profile_owner: profile.this_app_profile_owner === true,
          },
          dnd: {
            manifest_declares_access_notification_policy: dnd.manifest_declares_access_notification_policy === true,
            manifest_permission_check: Number(dnd.manifest_permission_check ?? -1),
            is_notification_policy_access_granted: dnd.is_notification_policy_access_granted === true,
            notifications_enabled: dnd.notifications_enabled === true,
            current_interruption_filter: Number(dnd.current_interruption_filter ?? -1),
            secure_policy_list_readable: dnd.secure_policy_list_readable === true,
            secure_policy_list_contains_self: dnd.secure_policy_list_contains_self === true,
            secure_policy_list_count: Number(dnd.secure_policy_list_count || 0),
            condition_provider_list_readable: dnd.condition_provider_list_readable === true,
            condition_provider_list_contains_self: dnd.condition_provider_list_contains_self === true,
            condition_provider_list_count: Number(dnd.condition_provider_list_count || 0),
            channel_before_exists: dnd.channel_before_exists === true,
            channel_before_importance: Number(dnd.channel_before_importance ?? -1),
            channel_before_can_bypass_dnd: dnd.channel_before_can_bypass_dnd === true,
            channel_create_attempted: dnd.channel_create_attempted === true,
            channel_create_error: dndDiagnosticString(dnd.channel_create_error, 300),
            channel_after_exists: dnd.channel_after_exists === true,
            channel_after_importance: Number(dnd.channel_after_importance ?? -1),
            channel_after_can_bypass_dnd: dnd.channel_after_can_bypass_dnd === true,
            global_zen_mode: Number(dnd.global_zen_mode ?? -999),
          },
        };

        try {
          return json(await uploadRuntimeLog(env, {
            user_id: "dnd-diagnostic",
            employee_code: null,
            display_name: "DND Diagnostic",
            role: "DIAGNOSTIC",
          }, {
            source: "ANDROID",
            severity: "INFO",
            reason: "manual_dnd_diagnostic",
            generated_at: generatedAt,
            device: {
              device_id: "dnddiag-" + deviceHash,
              manufacturer: allowedPayload.build.manufacturer,
              model: allowedPayload.build.model,
              sdk_int: allowedPayload.build.sdk_int,
              package: packageName,
              version_name: "1.0-dnddiag",
            },
            payload: allowedPayload,
          }));
        } catch (error) {
          return json({ error: "DND_DIAGNOSTIC_UPLOAD_FAILED", message: error instanceof Error ? error.message : "upload_failed" }, 502);
        }
      }

      if (request.method === "POST" && url.pathname === "/api/logs/upload") {
        let body: Record<string, unknown> = {};
        try { body = (await request.json()) as Record<string, unknown>; } catch { body = {}; }
        const user = await requireRuntimeLogUser(request, env, body);
        try {
          return json(await uploadRuntimeLog(env, user, body));
        } catch (error) {
          return json({ error: "LOG_UPLOAD_FAILED", message: error instanceof Error ? error.message : "log_upload_failed" }, 502);
        }
      }
      // D166 Launcher incident: explicit ROOT-only read of existing Core buffer.
      // No additional polling, content export, Drive mutation or new service.
      if (request.method === "GET" && url.pathname === "/api/admin/launcher/logs/diagnostics") {
        const operator = await requireUser(request, env, ["ROOT"]);
        if (operator.base_role !== "ROOT") return json({ error: "ROOT_REQUIRED" }, 403);
        try {
          const [report, drive] = await Promise.all([
            coreJson<Record<string, unknown>>(env, "/runtime-logs/launcher-diagnostics"),
            probeLauncherArchiveFolder(env),
          ]);
          return json({ ...report, drive_folder_check: drive });
        } catch {
          return json({ error: "LAUNCHER_LOG_DIAGNOSTICS_UNAVAILABLE" }, 503);
        }
      }
      if (request.method === "GET" && url.pathname === "/api/admin/logs") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        try {
          return json(await listRuntimeLogs(
            env,
            url.searchParams.get("source") || "WEB",
            Number(url.searchParams.get("limit") || 50),
            Number(url.searchParams.get("days") || 30),
            String(url.searchParams.get("page_token") || ""),
          ));
        } catch (error) {
          return json({ error: "LOG_LIST_FAILED", message: error instanceof Error ? error.message : "log_list_failed" }, 502);
        }
      }
      if (request.method === "GET" && url.pathname === "/api/admin/logs/file") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        try {
          return json(await readRuntimeLog(env, String(url.searchParams.get("file_id") || "")));
        } catch (error) {
          return json({ error: "LOG_READ_FAILED", message: error instanceof Error ? error.message : "log_read_failed" }, 502);
        }
      }

      if (request.method === "GET" && url.pathname === "/api/admin/archive/status") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        return archiveStatus(env);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/archive/run") {
        await requireUser(request, env, ["ROOT"]);
        try { return json(await runArchive(env)); }
        catch (error) { return json({ error: "ARCHIVE_RUN_FAILED", message: error instanceof Error ? error.message : "archive_failed" }, 502); }
      }

      if (request.method === "GET" && url.pathname === "/api/admin/hr-sync/event-state") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        return json(await readHrEventState(env));
      }
      if (request.method === "POST" && url.pathname === "/api/admin/hr-sync/recheck") {
        await requireUser(request, env, ["ADMIN", "ROOT"]);
        try {
          const state = await processHrSnapshot(env, "WEB_RECHECK");
          return json({ status: String(state.status || "NO_CHANGE"), state });
        } catch (error) {
          return json({
            error: "HR_SYNC_RECHECK_FAILED",
            message: error instanceof Error ? error.message : "Không kiểm tra lại được nguồn nhân sự.",
          }, 500);
        }
      }
      if (request.method === "POST" && url.pathname === "/api/admin/hr-sync/confirm") {
        const user = await requireUser(request, env, ["ADMIN", "ROOT"]);
        let body: { fingerprint?: string } = {};
        try { body = (await request.json()) as { fingerprint?: string }; }
        catch { return json({ error: "INVALID_JSON" }, 400); }
        const fingerprint = String(body.fingerprint || "").trim().toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(fingerprint)) return json({ error: "INVALID_HR_SOURCE_FINGERPRINT" }, 400);
        try {
          const result = await confirmHrPending(env, {
            user_id: user.user_id,
            employee_code: user.employee_code,
            display_name: user.display_name,
            role: user.role === "ROOT" ? "ROOT" : "ADMIN",
            base_role: user.base_role === "ROOT" ? "ROOT" : "ADMIN",
          }, fingerprint);
          const status = result.status === "NO_MATCHING_PENDING_SNAPSHOT" ? 409 :
            result.status === "STALE_SNAPSHOT_RECOMPUTED" ? 409 :
            result.status === "SOURCE_BLOCKED" ? 409 : 200;
          return json(result, status);
        } catch (error) {
          return json({
            error: "HR_SYNC_CONFIRM_FAILED",
            message: error instanceof Error ? error.message : "Không xác nhận được đồng bộ nhân sự.",
          }, 500);
        }
      }

      if (request.method === "GET" && url.pathname === "/api/admin/hr-source") {
        await requireUser(request, env, ["ADMIN", "PICKPACK_ADMIN", "ROOT"]);
        return coreStub(env).fetch("https://inventory-core.internal/config/hr-source");
      }
      if (request.method === "PUT" && url.pathname === "/api/admin/hr-source") {
        const user = await requireUser(request, env, ["ADMIN", "ROOT"]);
        if (!env.GOOGLE_RUNTIME_SA_JSON) return json({ error: "GOOGLE_RUNTIME_NOT_CONFIGURED" }, 503);
        const body = (await request.json()) as { sheet_url?: string; tab_name?: string; employee_code_header?: string; full_name_header?: string; contractor_header?: string };
        try {
          const validated = await validateHrSheetSource(env.GOOGLE_RUNTIME_SA_JSON, {
            sheet_url: String(body.sheet_url || ""),
            tab_name: String(body.tab_name || ""),
            employee_code_header: String(body.employee_code_header || ""),
            full_name_header: String(body.full_name_header || ""),
            contractor_header: String(body.contractor_header || ""),
          });
          await coreJson(env, "/config/hr-source", {
            method: "PUT", headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...validated, updated_by: user.user_id }),
          });
          ctx.waitUntil(ensureHrDriveWatch(env, true).catch((error) =>
            console.error("hr_drive_watch_refresh_failed", error instanceof Error ? error.message : "unknown")));
          return json({ status: "saved", source: validated });
        } catch (error) {
          return json({ error: "HR_SOURCE_INVALID", message: error instanceof Error ? error.message : "HR source validation failed" }, 400);
        }
      }

      const launcherPasswordResponse = await handleLauncherPasswordApi(request, env);
      if (launcherPasswordResponse) return launcherPasswordResponse;

      const pdaRegistryResponse = await handlePdaRegistryApi(request, env);
      if (pdaRegistryResponse) return pdaRegistryResponse;

      const launcherDiagnosticResponse = await handleLauncherDiagnosticLog(request, env);
      if (launcherDiagnosticResponse) return launcherDiagnosticResponse;

      const pdaManagementDiagnosticResponse = await handlePdaManagementDiagnosticLog(request, env);
      if (pdaManagementDiagnosticResponse) return pdaManagementDiagnosticResponse;

      const systemResetResponse = await handleSystemResetApi(request, env);
      if (systemResetResponse) return systemResetResponse;

      const userManagementResponse = await handleUserManagementApi(request, env);
      if (userManagementResponse) return userManagementResponse;

      const notificationResponse = await handleNotificationApi(request, env);
      if (notificationResponse) return notificationResponse;

      const readResponse = await handleReadApi(request, env);
      if (readResponse) return readResponse;

      const businessResponse = await handleBusinessApi(request, env, ctx);
      if (businessResponse) return businessResponse;

      if (request.method === "GET" && url.pathname === "/api/oauth/google/start") return startGoogleOAuth(env);
      if (request.method === "GET" && url.pathname === "/api/oauth/google/callback") return googleOAuthCallback(request, env);

      if (url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
      if ((request.method === "GET" || request.method === "HEAD") && env.ASSETS) return env.ASSETS.fetch(request);
      return json({ error: "not_found" }, 404);
    } catch (error) {
      if (error instanceof Response) return error;
      return json({ error: "internal_error" }, 500);
    }
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === "15 20 * * *") {
      ctx.waitUntil(runArchive(env).then(() => undefined).catch((error) =>
        console.error("archive_scheduled_failed", error instanceof Error ? error.message : "unknown")));
      ctx.waitUntil(reconcilePdaRegistrySheet(env).then(() => undefined).catch((error) =>
        console.error("pda_registry_reconcile_failed", error instanceof Error ? error.message : "unknown")));
    }
    if (controller.cron === "*/5 * * * *") {
      ctx.waitUntil(ensureLauncherLogsDestination(env));
      ctx.waitUntil(drainAgentLogUploads(env).then(() => undefined).catch((error) =>
        console.error("agent_log_drain_failed", error instanceof Error ? error.message : "unknown")));
      ctx.waitUntil(retryBufferedRuntimeLogArchives(env).then(() => undefined).catch((error) =>
        console.error("runtime_log_drive_retry_failed", error instanceof Error ? error.message : "unknown")));
      ctx.waitUntil(reconcileRecentAgentKicks(env).then(() => undefined).catch((error) =>
        console.error("agent_kick_reconcile_failed", error instanceof Error ? error.message : "unknown")));
      ctx.waitUntil(maybeRunRelayAuditExport(env).then(() => undefined).catch((error) =>
        console.error("relay_audit_export_failed", error instanceof Error ? error.message : "unknown")));
      ctx.waitUntil(ensureHrDriveWatch(env).then(() => undefined).catch((error) =>
        console.error("hr_drive_watch_ensure_failed", error instanceof Error ? error.message : "unknown")));
      if (shouldRetryDailyLauncherPassword(new Date())) {
        ctx.waitUntil(ensureDailyLauncherPassword(env).then(() => undefined).catch((error) =>
          console.error("launcher_password_daily_delivery_failed", error instanceof Error ? error.message : "unknown")));
      }
      // D136: provider Usage polling/snapshot publication retired. No periodic
      // Monitoring API calls and no usage_current Firestore writes are scheduled.
    }
  },
} satisfies ExportedHandler<Env>;
