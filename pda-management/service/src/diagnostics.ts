const INVENTORY_DIAGNOSTIC_URL = "https://inventory-beta.supra.cc.cd/api/diagnostics/pda-management/upload";

function scrubText(value: unknown, max = 1200): string {
  let text = String(value ?? "").slice(0, max);
  text = text.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]");
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+\/-]{12,}/gi, "Bearer [REDACTED]");
  text = text.replace(/eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}/g, "[REDACTED_JWT]");
  text = text.replace(/(password|secret|token|authorization|cookie|private[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
  return text;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (item) => item.toString(16).padStart(2, "0")).join("");
}

function vietnamIsoNow(): string {
  return new Date().toISOString();
}

export function safeErrorMessage(error: unknown): string {
  return scrubText(error instanceof Error ? error.message : String(error || "unknown"), 500);
}

export function errorCode(error: unknown): string {
  const raw = safeErrorMessage(error).toUpperCase();
  if (raw.includes("SQLITE") || raw.includes("SQL")) return "STORAGE_ERROR";
  if (raw.includes("PBKDF2") || raw.includes("CRYPTO")) return "CRYPTO_ERROR";
  if (raw.includes("GOOGLE") || raw.includes("SHEET")) return "UPSTREAM_DATA_ERROR";
  if (raw.includes("CORE_HTTP_")) return "CORE_ERROR";
  return "UNEXPECTED_ERROR";
}

export async function reportServerError(
  request: Request,
  sourceCommit: string,
  errorId: string,
  error: unknown,
): Promise<void> {
  try {
    const rawDevice = String(request.headers.get("x-supra-device-id") || "server").slice(0, 200);
    const deviceHash = await sha256Hex(rawDevice || "server");
    const stack = error instanceof Error ? scrubText(error.stack || "", 5000) : "";
    const payload = {
      schema: "supra-pda-management-log-v1",
      generated_at: vietnamIsoNow(),
      severity: "ERROR",
      reason: "pda_management_server_error",
      identity: {
        package: "cc.supra.pdamanagement.beta.server",
        device_id_hash: deviceHash,
      },
      build: {
        version_name: "worker",
        version_code: 0,
        source_commit: scrubText(sourceCommit, 80),
      },
      payload: {
        error_id: scrubText(errorId, 80),
        error_code: errorCode(error),
        error_message: safeErrorMessage(error),
        stack,
        request: {
          method: request.method,
          path: new URL(request.url).pathname.slice(0, 240),
        },
        privacy: {
          request_headers: "NOT_COLLECTED",
          request_body: "NOT_COLLECTED",
          passwords: "NOT_COLLECTED",
          auth_tokens: "NOT_COLLECTED",
        },
      },
    };
    await fetch(INVENTORY_DIAGNOSTIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-supra-pda-management-log-version": "1",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Diagnostics must never affect the business response.
  }
}
