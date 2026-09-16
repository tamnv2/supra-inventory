interface ServiceAccountJson {
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
