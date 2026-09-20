export type AppRole = "PICKER" | "REPORTER" | "ADMIN" | "ROOT";

export interface FirebaseIdentity {
  uid: string;
  email?: string;
  sessionChannel: "WEB" | "ANDROID" | "AGENT" | "";
  sessionGeneration: number;
}

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
}

interface FirebaseJwtHeader {
  alg?: string;
  kid?: string;
}

interface FirebaseJwtClaims {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
  app_session_channel?: string;
  app_session_generation?: string | number;
}

interface FirebaseJwk extends JsonWebKey {
  kid?: string;
}

const FIREBASE_JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const CUSTOM_TOKEN_AUD = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
// Cloudflare Workers currently caps PBKDF2 at 100,000 iterations.
// Keep Beta at the platform maximum; revisit the password KDF before Stable promotion.
const PASSWORD_ITERATIONS = 100_000;
let jwkCache: { expiresAt: number; keys: FirebaseJwk[] } | null = null;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonPart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as T;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return toArrayBuffer(bytes);
}

function parseServiceAccount(raw: string): ServiceAccountJson {
  let credentials: ServiceAccountJson;
  try {
    credentials = JSON.parse(raw) as ServiceAccountJson;
  } catch {
    throw new Error("GOOGLE_RUNTIME_SA_JSON is not valid JSON");
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("GOOGLE_RUNTIME_SA_JSON is missing client_email/private_key");
  }
  return credentials;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  if (password.length < 8 || password.length > 128) throw new Error("Mật khẩu phải từ 8 đến 128 ký tự.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return { salt: bytesToBase64(salt), hash: bytesToBase64(hash) };
}

export async function verifyPassword(password: string, saltB64: string, expectedB64: string): Promise<boolean> {
  const actual = await derivePasswordHash(password, base64ToBytes(saltB64));
  const expected = base64ToBytes(expectedB64);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export async function createFirebaseCustomToken(
  rawServiceAccountJson: string,
  uid: string,
  claims: Record<string, string>,
): Promise<string> {
  const credentials = parseServiceAccount(rawServiceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      sub: credentials.client_email,
      aud: CUSTOM_TOKEN_AUD,
      iat: now,
      exp: now + 3600,
      uid,
      claims,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getFirebaseJwks(): Promise<FirebaseJwk[]> {
  if (jwkCache && jwkCache.expiresAt > Date.now()) return jwkCache.keys;
  const response = await fetch(FIREBASE_JWK_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`firebase_jwk_http_${response.status}`);
  const payload = (await response.json()) as { keys?: FirebaseJwk[] };
  const keys = payload.keys || [];
  if (!keys.length) throw new Error("firebase_jwk_empty");
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
  jwkCache = { keys, expiresAt: Date.now() + Math.max(60, maxAge - 60) * 1000 };
  return keys;
}

export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<FirebaseIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_firebase_token");
  const header = decodeJsonPart<FirebaseJwtHeader>(parts[0]);
  const claims = decodeJsonPart<FirebaseJwtClaims>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("invalid_firebase_token_header");
  const jwk = (await getFirebaseJwks()).find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    jwkCache = null;
    const refreshed = (await getFirebaseJwks()).find((candidate) => candidate.kid === header.kid);
    if (!refreshed) throw new Error("firebase_signing_key_not_found");
    return verifyWithKey(refreshed, parts, claims, projectId);
  }
  return verifyWithKey(jwk, parts, claims, projectId);
}

async function verifyWithKey(
  jwk: FirebaseJwk,
  parts: string[],
  claims: FirebaseJwtClaims,
  projectId: string,
): Promise<FirebaseIdentity> {
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    toArrayBuffer(base64UrlDecode(parts[2])),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error("firebase_signature_invalid");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("firebase_token_project_mismatch");
  }
  if (!claims.sub || claims.sub.length > 128) throw new Error("firebase_token_subject_invalid");
  if (!claims.exp || claims.exp <= now || !claims.iat || claims.iat > now + 300) throw new Error("firebase_token_expired_or_invalid");
  const rawChannel = String(claims.app_session_channel || "").toUpperCase();
  const sessionChannel =
    rawChannel === "WEB" || rawChannel === "ANDROID" || rawChannel === "AGENT"
      ? rawChannel
      : "";
  const sessionGeneration = Number(claims.app_session_generation || 0);
  return {
    uid: claims.sub,
    email: claims.email,
    sessionChannel,
    sessionGeneration: Number.isFinite(sessionGeneration) ? sessionGeneration : 0,
  };
}

export function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
