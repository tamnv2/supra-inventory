/**
 * D173 owner-scoped non-interactive SQL audit. Existing Cloudflare read-only
 * secret authenticates GitHub's trusted beta collector with a short-lived HMAC.
 * Never accept a raw bearer token or expose the secret in a response/log.
 * Only the fixed, aggregate-only InventoryCore diagnostic is allowed.
 */
export const D173_SQL_AUDIT_PATH = "/api/internal/d173/sql-evidence";
export const D173_SQL_AUDIT_DOMAIN = "D173_SQL_QUERY_ID_AUDIT_V1";
export const D173_SQL_AUDIT_SKEW_SECONDS = 90;

export async function verifyD173SqlAuditSignature(
  request: Request,
  secret: string | undefined,
  nowMs = Date.now(),
): Promise<boolean> {
  if (request.method !== "GET" ||
      new URL(request.url).pathname !== D173_SQL_AUDIT_PATH ||
      !secret || secret.length < 20) return false;
  const raw = request.headers.get("x-d173-audit-ts") || "";
  const hex = request.headers.get("x-d173-audit-hmac") || "";
  if (!/^[1-9]\d{9}$/.test(raw) || !/^[a-f0-9]{64}$/.test(hex)) return false;
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds) ||
      Math.abs(Math.floor(nowMs / 1000) - seconds) > D173_SQL_AUDIT_SKEW_SECONDS) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signature = new Uint8Array(32);
    for (let i = 0; i < 32; i++) signature[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    const payload = encoder.encode(D173_SQL_AUDIT_DOMAIN + "\nGET\n" + D173_SQL_AUDIT_PATH + "\n" + raw);
    return await crypto.subtle.verify("HMAC", key, signature, payload);
  } catch {
    return false;
  }
}
