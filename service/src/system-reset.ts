import { verifyFirebaseIdToken, readBearerToken } from "./auth";
import {
  deleteFirebaseUsers,
  effectiveAuthEmail,
  signInWithFirebasePassword,
  type FirebaseManagedUserSpec,
} from "./firebase-auth-admin";
import { getServiceAccountAccessToken } from "./hr-source";

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY?: string;
  INVENTORY_CORE: DurableObjectNamespace;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
}

interface RootUser {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: string;
  base_role: string;
  status: string;
  auth_email: string | null;
}

interface ResetIdentity {
  user_id: string;
  firebase_uid?: string | null;
  employee_code?: string | null;
  role?: string;
}

const RESET_SCOPES = new Set([
  "PICKER_ACCOUNTS",
  "REPORTER_ACCOUNTS",
  "ADMIN_ACCOUNTS",
  "SKU_MASTER",
  "OPEN_REPORTS",
  "BUSINESS_HISTORY",
  "SERVICE_LOGS",
  "SESSIONS_DEVICES",
  "RUNTIME_SETTINGS",
  "CONFIRMATION_RELAY",
]);
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function core(env: Env): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

function normalizeScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((scope) => RESET_SCOPES.has(scope)))].sort();
}

async function rootUser(request: Request, env: Env): Promise<RootUser> {
  const token = readBearerToken(request);
  if (!token) throw json({ error: "AUTH_REQUIRED" }, 401);
  let identity;
  try { identity = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID); }
  catch { throw json({ error: "INVALID_AUTH_TOKEN" }, 401); }
  const lookup = await core(env).fetch(
    `https://inventory-core.internal/auth/user-by-firebase-uid?uid=${encodeURIComponent(identity.uid)}`,
  );
  const user = lookup.ok ? ((await lookup.json()) as { user?: RootUser | null }).user : null;
  if (!user || user.status !== "ACTIVE" || user.base_role !== "ROOT" || user.role !== "ROOT") {
    throw json({ error: "ROOT_REQUIRED" }, 403);
  }
  return user;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSixDigits(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

function randomChallengeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function googleOAuthAccessToken(env: Env): Promise<string> {
  if (!env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || !env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || !env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) {
    throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`GOOGLE_OAUTH_FAILED:${payload.error_description || payload.error || response.status}`);
  }
  return payload.access_token;
}

function base64UrlUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function sendResetCodeEmail(env: Env, email: string, code: string): Promise<void> {
  const token = await googleOAuthAccessToken(env);
  const subject = "Mã xác nhận đặt lại hệ thống SUPRA Inventory";
  const body = [
    `Mã xác nhận đặt lại hệ thống: ${code}`,
    "",
    "Mã có hiệu lực trong 10 phút và chỉ dùng cho yêu cầu đặt lại hiện tại.",
    "Nếu bạn không thực hiện thao tác này, hãy bỏ qua email.",
  ].join("\r\n");
  const raw = [
    `To: ${email}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: base64UrlUtf8(raw) }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RESET_EMAIL_SEND_FAILED_HTTP_${response.status}:${text.slice(0, 160)}`);
  }
}

async function primaryPasswordValid(env: Env, root: RootUser, password: string): Promise<boolean> {
  if (!env.FIREBASE_WEB_API_KEY || !root.firebase_uid || !password) return false;
  try {
    const authSpec: FirebaseManagedUserSpec = {
      uid: root.firebase_uid,
      userId: root.user_id,
      employeeCode: root.employee_code,
      displayName: root.display_name,
      role: "ROOT",
      status: "ACTIVE",
      authEmail: root.auth_email,
    };
    const session = await signInWithFirebasePassword(env.FIREBASE_WEB_API_KEY, effectiveAuthEmail(authSpec), password);
    return session.localId === root.firebase_uid;
  } catch {
    return false;
  }
}

async function coreJson<T>(env: Env, path: string, init?: RequestInit): Promise<T> {
  const response = await core(env).fetch(`https://inventory-core.internal${path}`, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `core_http_${response.status}`);
  return payload;
}

const FIRESTORE_COLLECTIONS = [
  "relay_poc_jobs",
  "relay_poc_rate_limits",
  "relay_poc_coordination",
  "relay_poc_agents",
  "relay_poc_confirm_guards",
];

async function firestoreDocuments(env: Env): Promise<{ refs: string[]; counts: Record<string, number>; pendingJobs: number }> {
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
  const access = await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, FIRESTORE_SCOPE);
  const refs: string[] = [];
  const counts: Record<string, number> = {};
  let pendingJobs = 0;
  for (const collection of FIRESTORE_COLLECTIONS) {
    let pageToken = "";
    let count = 0;
    do {
      const url = new URL(
        `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${collection}`,
      );
      url.searchParams.set("pageSize", "1000");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await fetch(url.toString(), {
        headers: { authorization: `Bearer ${access.accessToken}`, accept: "application/json" },
      });
      if (response.status === 404) break;
      if (!response.ok) throw new Error(`FIRESTORE_RESET_LIST_HTTP_${response.status}`);
      const payload = (await response.json()) as {
        documents?: Array<{ name?: string; fields?: Record<string, { stringValue?: string }> }>;
        nextPageToken?: string;
      };
      for (const doc of payload.documents || []) {
        if (doc.name) refs.push(doc.name);
        count += 1;
        if (
          collection === "relay_poc_jobs" &&
          String(doc.fields?.status?.stringValue || "") === "PENDING"
        ) pendingJobs += 1;
      }
      pageToken = String(payload.nextPageToken || "");
    } while (pageToken);
    counts[collection] = count;
  }
  return { refs, counts, pendingJobs };
}

async function deleteFirestoreDocuments(env: Env, refs: string[]): Promise<number> {
  if (!refs.length) return 0;
  if (!env.GOOGLE_RUNTIME_SA_JSON) throw new Error("GOOGLE_RUNTIME_NOT_CONFIGURED");
  const access = await getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON, FIRESTORE_SCOPE);
  let deleted = 0;
  for (let offset = 0; offset < refs.length; offset += 20) {
    const chunk = refs.slice(offset, offset + 20);
    const results = await Promise.all(chunk.map(async (name) => {
      const response = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${access.accessToken}` },
      });
      if (!response.ok && response.status !== 404) throw new Error(`FIRESTORE_RESET_DELETE_HTTP_${response.status}`);
      return 1;
    }));
    deleted += results.reduce((sum, value) => sum + value, 0);
  }
  return deleted;
}

function firebaseLocalIds(identities: ResetIdentity[]): string[] {
  return [...new Set(
    identities
      .map((identity) => String(identity.firebase_uid || "").trim())
      .filter(Boolean),
  )];
}

export async function handleSystemResetApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/root/system-reset")) return null;

  let root: RootUser;
  try { root = await rootUser(request, env); }
  catch (error) { if (error instanceof Response) return error; throw error; }

  if (request.method === "GET" && url.pathname === "/api/root/system-reset/preview") {
    const corePreview = await coreJson<{ counts: Record<string, number> }>(env, "/root/system-reset/preview");
    let relay: { counts: Record<string, number>; pending_jobs: number; status: string } = {
      counts: {}, pending_jobs: 0, status: "not_loaded",
    };
    if (url.searchParams.get("relay") === "1") {
      try {
        const read = await firestoreDocuments(env);
        relay = { counts: read.counts, pending_jobs: read.pendingJobs, status: "ok" };
      } catch {
        relay = { counts: {}, pending_jobs: 0, status: "unavailable" };
      }
    }
    return json({ ...corePreview, confirmation_relay: relay, root_preserved: true });
  }

  if (request.method === "POST" && url.pathname === "/api/root/system-reset/challenge") {
    const body = (await request.json()) as { scopes?: unknown; password?: string };
    const scopes = normalizeScopes(body.scopes);
    if (!scopes.length) return json({ error: "RESET_SCOPE_REQUIRED" }, 400);
    if (!root.auth_email) return json({ error: "ROOT_RECOVERY_EMAIL_REQUIRED", message: "ROOT cần cấu hình email trước khi đặt lại hệ thống." }, 409);
    if (!(await primaryPasswordValid(env, root, String(body.password || "")))) {
      return json({ error: "CURRENT_PASSWORD_INVALID" }, 400);
    }
    const challengeId = randomChallengeId();
    const code = randomSixDigits();
    const codeHash = await sha256(`${challengeId}:${root.user_id}:${code}`);
    const now = new Date();
    const expires = new Date(now.getTime() + 10 * 60 * 1000);
    const store = await core(env).fetch("https://inventory-core.internal/root/system-reset/challenge-store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challenge_id: challengeId,
        root_user_id: root.user_id,
        email: root.auth_email,
        scopes,
        code_hash: codeHash,
        created_at: now.toISOString(),
        expires_at: expires.toISOString(),
      }),
    });
    if (!store.ok) return json(await store.json(), store.status);
    try {
      await sendResetCodeEmail(env, root.auth_email, code);
    } catch (error) {
      await core(env).fetch("https://inventory-core.internal/root/system-reset/challenge-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId }),
      });
      return json({
        error: "RESET_EMAIL_UNAVAILABLE",
        message: "Chưa gửi được mã xác nhận tới email ROOT. Cần cấp quyền Gmail send cho kết nối Google của dự án.",
        detail: error instanceof Error ? error.message.replace(/:[\s\S]*/, "") : "email_failed",
      }, 503);
    }
    return json({
      status: "code_sent",
      challenge_id: challengeId,
      expires_at: expires.toISOString(),
      email_hint: root.auth_email.replace(/^(.{1,2}).*(@.*)$/, "$1***$2"),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/root/system-reset/execute") {
    const body = (await request.json()) as { challenge_id?: string; code?: string };
    const challengeId = String(body.challenge_id || "").trim();
    const code = String(body.code || "").trim();
    if (!challengeId || !/^\d{6}$/.test(code)) return json({ error: "RESET_CODE_REQUIRED" }, 400);
    const codeHash = await sha256(`${challengeId}:${root.user_id}:${code}`);
    const verified = await core(env).fetch("https://inventory-core.internal/root/system-reset/challenge-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challenge_id: challengeId, root_user_id: root.user_id, code_hash: codeHash }),
    });
    const verifyPayload = (await verified.json()) as { status?: string; scopes?: string[]; error?: string; remaining_attempts?: number };
    if (!verified.ok || verifyPayload.status !== "verified") return json(verifyPayload, verified.status);
    const scopes = normalizeScopes(verifyPayload.scopes);
    if (!scopes.length) return json({ error: "RESET_SCOPE_REQUIRED" }, 400);

    let relayDeleted = 0;
    if (scopes.includes("CONFIRMATION_RELAY")) {
      const relay = await firestoreDocuments(env);
      if (relay.pendingJobs > 0) {
        return json({
          error: "RESET_RELAY_PENDING_JOBS",
          message: `Đang có ${relay.pendingJobs} yêu cầu xác nhận đơn PENDING. Không được xóa relay khi còn việc đang chờ.`,
        }, 409);
      }
      relayDeleted = await deleteFirestoreDocuments(env, relay.refs);
    }

    const identityPlan = await coreJson<{ identities: ResetIdentity[] }>(env, "/root/system-reset/identities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scopes }),
    });
    const authIds = firebaseLocalIds(identityPlan.identities || []);
    let firebaseDeleted = 0;
    if (authIds.length) {
      if (!env.GOOGLE_RUNTIME_SA_JSON) return json({ error: "GOOGLE_RUNTIME_NOT_CONFIGURED" }, 503);
      firebaseDeleted = await deleteFirebaseUsers(env.GOOGLE_RUNTIME_SA_JSON, env.FIREBASE_PROJECT_ID, authIds);
    }

    const result = await coreJson<Record<string, unknown>>(env, "/root/system-reset/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scopes }),
    });
    await core(env).fetch("https://inventory-core.internal/root/system-reset/challenge-consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challenge_id: challengeId, root_user_id: root.user_id }),
    });
    return json({
      ...result,
      firebase_accounts_deleted: firebaseDeleted,
      firestore_documents_deleted: relayDeleted,
      root_preserved: true,
      external_google_sheet_drive_untouched: true,
    });
  }

  return json({ error: "NOT_FOUND" }, 404);
}
