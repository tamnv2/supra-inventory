#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "service/src"
ANDROID = ROOT / "android/app/src/main"
STATE = ROOT / "ops/project-state.json"
REGISTRY = ROOT / "ops/resource-registry.json"


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_FAIL {label}: expected exactly one match, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def write_service_files() -> None:
    (SERVICE / "notifications-core.ts").write_text(r'''type SqlRow = Record<string, SqlStorageValue>;

type DeviceBody = {
  user_id?: string;
  device_id?: string;
  token?: string;
  platform?: string;
};

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function validUserId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function validDeviceId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{8,128}$/.test(value);
}

async function upsertDevice(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as DeviceBody;
  const userId = String(body.user_id || "").trim();
  const deviceId = String(body.device_id || "").trim();
  const token = String(body.token || "").trim();
  const platform = String(body.platform || "ANDROID").toUpperCase();
  if (!validUserId(userId) || !validDeviceId(deviceId) || !token || token.length > 4096 || !["ANDROID", "WEB"].includes(platform)) {
    return response({ error: "INVALID_NOTIFICATION_DEVICE" }, 400);
  }
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `INSERT INTO fcm_devices (device_id, user_id, platform, token, enabled, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET
       user_id = excluded.user_id,
       platform = excluded.platform,
       token = excluded.token,
       enabled = 1,
       last_seen_at = excluded.last_seen_at,
       updated_at = excluded.updated_at`,
    deviceId, userId, platform, token, at, at, at,
  );
  return response({ status: "registered", device_id: deviceId, platform, registered_at: at });
}

async function removeDevice(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as DeviceBody;
  const userId = String(body.user_id || "").trim();
  const deviceId = String(body.device_id || "").trim();
  if (!validUserId(userId) || !validDeviceId(deviceId)) return response({ error: "INVALID_NOTIFICATION_DEVICE" }, 400);
  const at = new Date().toISOString();
  state.storage.sql.exec(
    `UPDATE fcm_devices SET enabled = 0, updated_at = ?, last_seen_at = ? WHERE device_id = ? AND user_id = ?`,
    at, at, deviceId, userId,
  );
  return response({ status: "unregistered", device_id: deviceId, unregistered_at: at });
}

function targetUsersForRoles(state: DurableObjectState, roles: string[]): string[] {
  const allowed = [...new Set(roles.filter((role) => ["PICKER", "REPORTER", "ADMIN", "ROOT"].includes(role)))];
  if (!allowed.length) return [];
  const placeholders = allowed.map(() => "?").join(",");
  return state.storage.sql
    .exec<SqlRow>(`SELECT user_id FROM users WHERE status = 'ACTIVE' AND role IN (${placeholders})`, ...allowed)
    .toArray()
    .map((row) => String(row.user_id || "").trim())
    .filter(Boolean);
}

function targetUsersForBatch(state: DurableObjectState, batchId: string): string[] {
  if (!batchId) return [];
  return state.storage.sql
    .exec<SqlRow>(
      `SELECT DISTINCT picker_user_id AS user_id
         FROM report_tickets
        WHERE batch_id = ? AND picker_user_id IS NOT NULL AND picker_user_id <> ''`,
      batchId,
    )
    .toArray()
    .map((row) => String(row.user_id || "").trim())
    .filter(Boolean);
}

async function notificationTargets(state: DurableObjectState, request: Request): Promise<Response> {
  const body = (await request.json()) as { roles?: unknown[]; user_ids?: unknown[]; batch_id?: string };
  const users = new Set<string>();
  for (const value of Array.isArray(body.user_ids) ? body.user_ids : []) {
    const userId = String(value).trim();
    if (validUserId(userId)) users.add(userId);
  }
  for (const userId of targetUsersForRoles(state, (Array.isArray(body.roles) ? body.roles : []).map(String))) users.add(userId);
  const batchId = String(body.batch_id || "").trim();
  for (const userId of targetUsersForBatch(state, batchId)) users.add(userId);

  const tokens = new Set<string>();
  for (const userId of users) {
    const rows = state.storage.sql
      .exec<SqlRow>(
        `SELECT token FROM fcm_devices WHERE user_id = ? AND enabled = 1 ORDER BY last_seen_at DESC LIMIT 8`,
        userId,
      )
      .toArray();
    for (const row of rows) {
      const token = String(row.token || "").trim();
      if (token) tokens.add(token);
    }
  }

  let batch: Record<string, unknown> | null = null;
  if (batchId) {
    const row = state.storage.sql
      .exec<SqlRow>(`SELECT batch_id, sku, product_name, status, resolution FROM report_batches WHERE batch_id = ? LIMIT 1`, batchId)
      .toArray()[0];
    if (row) batch = row;
  }
  return response({ tokens: [...tokens].slice(0, 500), target_user_count: users.size, batch });
}

export async function handleNotificationCoreRequest(state: DurableObjectState, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/notifications/device/upsert") return upsertDevice(state, request);
  if (request.method === "POST" && url.pathname === "/notifications/device/remove") return removeDevice(state, request);
  if (request.method === "POST" && url.pathname === "/notifications/targets") return notificationTargets(state, request);
  return null;
}
''', encoding="utf-8")

    (SERVICE / "fcm.ts").write_text(r'''interface ServiceAccountJson {
  client_email: string;
  private_key: string;
}

type FcmMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
let accessTokenCache: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function parseServiceAccount(raw: string): ServiceAccountJson {
  const parsed = JSON.parse(raw) as ServiceAccountJson;
  if (!parsed.client_email || !parsed.private_key) throw new Error("FCM_SERVICE_ACCOUNT_INVALID");
  return parsed;
}

async function accessToken(raw: string): Promise<string> {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) return accessTokenCache.token;
  const credentials = parseServiceAccount(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: TOKEN_ENDPOINT,
    scope: FCM_SCOPE,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const result = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !result.access_token) throw new Error(`FCM_OAUTH_FAILED:${result.error || response.status}`);
  accessTokenCache = {
    token: result.access_token,
    expiresAt: Date.now() + Math.max(300, Number(result.expires_in || 3600)) * 1000,
  };
  return result.access_token;
}

export async function sendFcmNotifications(
  rawServiceAccountJson: string,
  projectId: string,
  tokens: string[],
  message: FcmMessage,
): Promise<{ sent: number; failed: number }> {
  const unique = [...new Set(tokens.map((value) => value.trim()).filter(Boolean))].slice(0, 500);
  if (!unique.length) return { sent: 0, failed: 0 };
  const bearer = await accessToken(rawServiceAccountJson);
  let sent = 0;
  let failed = 0;
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  for (let offset = 0; offset < unique.length; offset += 20) {
    const chunk = unique.slice(offset, offset + 20);
    const results = await Promise.all(chunk.map(async (token) => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${bearer}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: message.data || {},
              android: {
                priority: "high",
                notification: { channel_id: "inventory_operations" },
              },
            },
          }),
        });
        return response.ok;
      } catch {
        return false;
      }
    }));
    for (const ok of results) ok ? sent++ : failed++;
  }
  return { sent, failed };
}
''', encoding="utf-8")

    (SERVICE / "notification-api.ts").write_text(r'''import { readBearerToken, verifyFirebaseIdToken } from "./auth";

interface NotificationEnv {
  FIREBASE_PROJECT_ID: string;
  INVENTORY_CORE: DurableObjectNamespace;
}

type InternalUser = {
  user_id: string;
  status: "ACTIVE" | "DISABLED";
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function core(env: NotificationEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

async function requireUser(request: Request, env: NotificationEnv): Promise<InternalUser> {
  const token = readBearerToken(request);
  if (!token) throw json({ error: "AUTH_REQUIRED" }, 401);
  let uid = "";
  try {
    uid = (await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID)).uid;
  } catch {
    throw json({ error: "INVALID_AUTH_TOKEN" }, 401);
  }
  const lookup = await core(env).fetch(`https://inventory-core.internal/auth/user-by-firebase-uid?uid=${encodeURIComponent(uid)}`);
  if (!lookup.ok) throw json({ error: "AUTH_LOOKUP_FAILED" }, 502);
  const user = ((await lookup.json()) as { user?: InternalUser | null }).user;
  if (!user || user.status !== "ACTIVE") throw json({ error: "USER_NOT_ACTIVE" }, 403);
  return user;
}

export async function handleNotificationApi(request: Request, env: NotificationEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/notifications/device") return null;
  if (request.method !== "POST" && request.method !== "DELETE") return null;
  const user = await requireUser(request, env);
  let body: { device_id?: string; token?: string; platform?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const path = request.method === "POST" ? "/notifications/device/upsert" : "/notifications/device/remove";
  return core(env).fetch(`https://inventory-core.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, user_id: user.user_id }),
  });
}
''', encoding="utf-8")


def patch_service() -> None:
    core = SERVICE / "core.ts"
    replace_once(core,
        'import { handleReadModelCoreRequest } from "./read-model-core";\n',
        'import { handleReadModelCoreRequest } from "./read-model-core";\nimport { handleNotificationCoreRequest } from "./notifications-core";\n',
        "core-import")
    replace_once(core,
        '    const readModel = await handleReadModelCoreRequest(this.state, request);\n    if (readModel) return readModel;\n',
        '    const notifications = await handleNotificationCoreRequest(this.state, request);\n    if (notifications) return notifications;\n\n    const readModel = await handleReadModelCoreRequest(this.state, request);\n    if (readModel) return readModel;\n',
        "core-route")

    index = SERVICE / "index.ts"
    replace_once(index,
        'import { handleReadApi } from "./read-api";\n',
        'import { handleReadApi } from "./read-api";\nimport { handleNotificationApi } from "./notification-api";\n',
        "index-import")
    replace_once(index,
        '  async fetch(request: Request, env: Env): Promise<Response> {',
        '  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {',
        "index-context")
    replace_once(index,
        '      const readResponse = await handleReadApi(request, env);\n      if (readResponse) return readResponse;\n\n      const businessResponse = await handleBusinessApi(request, env);',
        '      const notificationResponse = await handleNotificationApi(request, env);\n      if (notificationResponse) return notificationResponse;\n\n      const readResponse = await handleReadApi(request, env);\n      if (readResponse) return readResponse;\n\n      const businessResponse = await handleBusinessApi(request, env, ctx);',
        "index-routes")

    business = SERVICE / "business-api.ts"
    replace_once(business,
        'import { readBearerToken, verifyFirebaseIdToken, type AppRole } from "./auth";\n',
        'import { readBearerToken, verifyFirebaseIdToken, type AppRole } from "./auth";\nimport { sendFcmNotifications } from "./fcm";\n',
        "business-import")
    replace_once(business,
        '  FIREBASE_PROJECT_ID: string;\n  INVENTORY_CORE: DurableObjectNamespace;\n',
        '  FIREBASE_PROJECT_ID: string;\n  INVENTORY_CORE: DurableObjectNamespace;\n  GOOGLE_RUNTIME_SA_JSON?: string;\n',
        "business-env")
    marker = 'export async function handleBusinessApi(request: Request, env: BusinessEnv): Promise<Response | null> {'
    helper = r'''type NotificationTarget = {
  roles?: AppRole[];
  userIds?: string[];
  batchId?: string;
};

function scheduleFcm(
  response: Response,
  env: BusinessEnv,
  ctx: ExecutionContext | undefined,
  options: {
    event: string;
    target: NotificationTarget;
    title: string;
    body: string;
  },
): void {
  if (!ctx || !env.GOOGLE_RUNTIME_SA_JSON || !response.ok) return;
  ctx.waitUntil((async () => {
    try {
      const targetResponse = await corePost(env, "/notifications/targets", {
        roles: options.target.roles || [],
        user_ids: options.target.userIds || [],
        batch_id: options.target.batchId || null,
      });
      if (!targetResponse.ok) return;
      const targetPayload = (await targetResponse.json()) as {
        tokens?: string[];
        batch?: { sku?: string; product_name?: string } | null;
      };
      const tokens = targetPayload.tokens || [];
      if (!tokens.length) return;
      const batchSku = String(targetPayload.batch?.sku || "");
      await sendFcmNotifications(env.GOOGLE_RUNTIME_SA_JSON!, env.FIREBASE_PROJECT_ID, tokens, {
        title: options.title,
        body: options.body.replace("{sku}", batchSku || "SKU"),
        data: {
          event: options.event,
          batch_id: options.target.batchId || "",
        },
      });
    } catch {
      // Background notification is best-effort and must never change the committed business result.
    }
  })());
}

export async function handleBusinessApi(request: Request, env: BusinessEnv, ctx?: ExecutionContext): Promise<Response | null> {'''
    replace_once(business, marker, helper, "business-helper")

    replace_once(business,
        '''    return realtimeAfter(response, env, {
      event: "report_created",
      scopes: ["reporter_queue"],
      tags: [...REPORTER_TAGS, `user:${user.user_id}`],
    });''',
        '''    const result = await realtimeAfter(response, env, {
      event: "report_created",
      scopes: ["reporter_queue"],
      tags: [...REPORTER_TAGS, `user:${user.user_id}`],
    });
    let sku = String(body.sku || "").trim();
    try {
      const payload = (await response.clone().json()) as { ticket?: { sku?: string } };
      sku = String(payload.ticket?.sku || sku);
    } catch {}
    scheduleFcm(result, env, ctx, {
      event: "report_created",
      target: { roles: REPORTER_ROLES },
      title: "SUPRA Inventory · SKU cần xử lý",
      body: `${sku || "SKU"} vừa được Picker báo hết hàng.`,
    });
    return result;''',
        "business-create-fcm")

    replace_once(business,
        '''    return realtimeAfter(response, env, {
      event: "batch_resolved",
      scopes: ["reporter_queue", "reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });''',
        '''    const result = await realtimeAfter(response, env, {
      event: "batch_resolved",
      scopes: ["reporter_queue", "reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });
    const resolution = String(body.resolution || "");
    scheduleFcm(result, env, ctx, {
      event: "batch_resolved",
      target: { batchId },
      title: resolution === "HAS_STOCK" ? "SUPRA Inventory · Đã có hàng" : "SUPRA Inventory · Được skip",
      body: resolution === "HAS_STOCK" ? "{sku} đã được Reporter xác nhận có hàng." : "{sku} đã được Reporter cho phép skip.",
    });
    return result;''',
        "business-resolve-fcm")

    replace_once(business,
        '''    return realtimeAfter(response, env, {
      event: "batch_corrected",
      scopes: ["reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });''',
        '''    const result = await realtimeAfter(response, env, {
      event: "batch_corrected",
      scopes: ["reporter_recent", "picker_reports"],
      tags: REPORTER_TAGS,
      batchId,
      includeBatchPickerUsers: true,
    });
    scheduleFcm(result, env, ctx, {
      event: "batch_corrected",
      target: { batchId },
      title: "SUPRA Inventory · Cập nhật kết quả",
      body: "{sku} đã được sửa kết quả thành Có hàng.",
    });
    return result;''',
        "business-correct-fcm")


def patch_android() -> None:
    manifest = ANDROID / "AndroidManifest.xml"
    replace_once(manifest,
        '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n',
        '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n',
        "manifest-notification-permission")

    api = ANDROID / "java/cd/cc/supra/inventory/beta/InventoryApi.kt"
    replace_once(api,
        '    fun createRealtimeTicket(): String {',
        '''    fun registerNotificationDevice(deviceId: String, token: String): JSONObject =
        request(
            method = "POST",
            path = "/api/notifications/device",
            body = JSONObject().put("device_id", deviceId).put("token", token).put("platform", "ANDROID"),
        )

    fun unregisterNotificationDevice(deviceId: String): JSONObject =
        request(
            method = "DELETE",
            path = "/api/notifications/device",
            body = JSONObject().put("device_id", deviceId).put("platform", "ANDROID"),
        )

    fun createRealtimeTicket(): String {''',
        "android-api-notification")

    main = ANDROID / "java/cd/cc/supra/inventory/beta/MainActivity.kt"
    replace_once(main,
        'import android.app.AlertDialog\n',
        'import android.Manifest\nimport android.app.AlertDialog\nimport android.app.NotificationChannel\nimport android.app.NotificationManager\n',
        "android-main-import-1")
    replace_once(main,
        'import android.content.Intent\n',
        'import android.content.Intent\nimport android.content.pm.PackageManager\n',
        "android-main-import-2")
    replace_once(main,
        'import com.google.firebase.FirebaseOptions\n',
        'import com.google.firebase.FirebaseOptions\nimport com.google.firebase.messaging.FirebaseMessaging\n',
        "android-main-import-firebase")
    replace_once(main,
        'import java.util.ArrayDeque\n',
        'import java.util.ArrayDeque\nimport java.util.UUID\n',
        "android-main-import-uuid")
    replace_once(main,
        '    private var realtimeClient: AndroidRealtimeClient? = null\n',
        '''    private var realtimeClient: AndroidRealtimeClient? = null
    private val notificationDeviceId: String by lazy {
        val prefs = getSharedPreferences("notification_device", MODE_PRIVATE)
        prefs.getString("device_id", null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString("device_id", it).apply()
        }
    }
''',
        "android-main-device-id")
    replace_once(main,
        '        if (FirebaseApp.getApps(this).isEmpty()) FirebaseApp.initializeApp(this, options)\n\n        api = InventoryApi(',
        '''        if (FirebaseApp.getApps(this).isEmpty()) FirebaseApp.initializeApp(this, options)
        createNotificationChannel()

        api = InventoryApi(''',
        "android-main-channel-call")
    replace_once(main,
        '        setContentView(wrapScroll(root))\n        startRealtime(session)\n    }\n\n    private fun startRealtime(session: AppSession) {',
        '''        setContentView(wrapScroll(root))
        startRealtime(session)
        registerBackgroundNotifications()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            "inventory_operations",
            "SUPRA Inventory · Nghiệp vụ",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Cảnh báo báo hàng khi ứng dụng chạy nền"
        }
        manager.createNotificationChannel(channel)
    }

    private fun registerBackgroundNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 701)
        }
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            val token = if (task.isSuccessful) task.result else null
            if (token.isNullOrBlank() || api.session == null) return@addOnCompleteListener
            Thread {
                try {
                    api.registerNotificationDevice(notificationDeviceId, token)
                } catch (_: Exception) {
                    // Registration retries on the next login; foreground realtime remains available.
                }
            }.start()
        }
    }

    private fun logoutWithNotificationCleanup() {
        realtimeClient?.stop()
        realtimeClient = null
        Thread {
            try {
                api.unregisterNotificationDevice(notificationDeviceId)
            } catch (_: Exception) {
                // Logout remains local even if the unregister request cannot reach the service.
            } finally {
                api.clearSession()
                runOnUiThread { renderLogin("Đã đăng xuất.") }
            }
        }.start()
    }

    private fun startRealtime(session: AppSession) {''',
        "android-main-notification-functions")
    replace_once(main,
        '''                        realtimeClient?.stop()
                        realtimeClient = null
                        api.clearSession()
                        renderLogin("Đã đăng xuất.")''',
        '''                        logoutWithNotificationCleanup()''',
        "android-main-logout")


def update_state() -> None:
    state = json.loads(STATE.read_text(encoding="utf-8"))
    state["current_status"]["android"] = "ROLE_BASED_PICKER_REPORTER_REALTIME_SIGNED_OTA_BETA_PASS"
    state["current_status"]["latest_beta_apk"] = "beta-vc25"
    state["current_status"]["realtime"] = "WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS"
    state["current_status"]["fcm"] = "DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_SOURCE_PENDING_CI_DEPLOY"
    completed = state["completed_capabilities"]
    for item in [
        "Android foreground realtime invalidation client — signed Beta beta-vc25 build/release PASS",
    ]:
        if item not in completed:
            completed.append(item)
    pending = state["pending_build"]
    pending[:] = [item for item in pending if "Android foreground realtime" not in item and "FCM device registration" not in item]
    pending.insert(0, "Verify/deploy FCM device registration + role/user targeted background notification source")
    state["next_action"]["primary"] = "Verify/deploy FCM device registration and background delivery, then build user management + HR provisioning/sync lifecycle."
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    registry["realtime"]["source_status"] = "SERVER_WEB_ANDROID_DEPLOYED_SIGNED_PASS"
    registry["notifications"] = {
        "background": "FCM_HTTP_V1",
        "authentication": "SHORT_LIVED_OAUTH2_FROM_GOOGLE_RUNTIME_SA_JSON",
        "oauth_scope": "https://www.googleapis.com/auth/firebase.messaging",
        "device_registry": "InventoryCore.fcm_devices",
        "routing": "ROLE_OR_USER_BATCH_TARGETS",
        "delivery_semantics": "BEST_EFFORT_AFTER_COMMITTED_TRANSACTION",
        "source_status": "PENDING_CI_DEPLOY"
    }
    beta = registry["environments"]["beta"]
    beta["latest_signed_beta_release"] = "beta-vc25"
    beta["latest_signed_beta_release_name"] = "SUPRA Inventory Beta 0.2.0-beta.25"
    beta["latest_signed_beta_apk_sha256"] = "fa2126078e0fc6776292ae71f2028ff55ae4059ac908faec869eb4e09a9b97a4"
    beta["latest_signed_beta_apk_size_bytes"] = 9149854
    beta["android_source_status"] = "ROLE_BASED_PICKER_REPORTER_REALTIME_SIGNED_OTA_PASS"
    built = registry["application_build_completed"]
    if "android_foreground_realtime_client" not in built:
        built.append("android_foreground_realtime_client")
    pending_registry = registry["application_build_pending"]
    pending_registry[:] = [item for item in pending_registry if item != "android_foreground_realtime_client_verify" and item != "fcm_device_and_delivery_flows"]
    pending_registry.insert(0, "fcm_device_and_delivery_flows_verify")
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    write_service_files()
    patch_service()
    patch_android()
    update_state()
    print("FCM_FOUNDATION_PATCH_PASS")


if __name__ == "__main__":
    main()
