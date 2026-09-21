export interface GoogleMailEnv {
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
}

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

async function refreshGoogleAccessToken(env: GoogleMailEnv): Promise<string> {
  if (!env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || !env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || !env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) {
    throw new Error("GOOGLE_MAIL_OAUTH_NOT_CONFIGURED");
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
  const payload = (await response.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(`GOOGLE_MAIL_OAUTH_FAILED:${payload.error_description || payload.error || response.status}`);
  }
  if (payload.scope && !payload.scope.split(/\s+/).includes(GMAIL_SEND_SCOPE)) {
    throw new Error("GOOGLE_MAIL_SCOPE_MISSING");
  }
  return payload.access_token;
}

function gmailFailureCode(status: number, payload: unknown): string {
  const body = payload && typeof payload === "object" ? payload as {
    error?: {
      message?: string;
      status?: string;
      errors?: Array<{ reason?: string }>;
    };
  } : {};
  const reason = String(body.error?.errors?.[0]?.reason || "").trim();
  const message = String(body.error?.message || "").toLowerCase();
  if (status === 401 || reason === "authError") return "GOOGLE_MAIL_AUTH_FAILED";
  if (
    reason === "accessNotConfigured" ||
    message.includes("gmail api has not been used") ||
    message.includes("gmail api") && message.includes("disabled")
  ) return "GOOGLE_MAIL_GMAIL_API_DISABLED";
  if (
    reason === "insufficientPermissions" ||
    message.includes("insufficient authentication scopes") ||
    message.includes("insufficient permission")
  ) return "GOOGLE_MAIL_SCOPE_MISSING";
  if (reason === "domainPolicy") return "GOOGLE_MAIL_DOMAIN_POLICY";
  if (
    status === 429 ||
    reason === "rateLimitExceeded" ||
    reason === "userRateLimitExceeded" ||
    reason === "dailyLimitExceeded"
  ) return "GOOGLE_MAIL_PROVIDER_RATE_LIMIT";
  const safeReason = reason.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48);
  return `GOOGLE_MAIL_SEND_FAILED_HTTP_${status}${safeReason ? `_${safeReason}` : ""}`;
}

function base64UrlUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function mimeSubject(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export async function sendProjectEmail(
  env: GoogleMailEnv,
  to: string,
  subject: string,
  textBody: string,
): Promise<void> {
  const email = String(to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("MAIL_RECIPIENT_INVALID");
  const token = await refreshGoogleAccessToken(env);
  const raw = [
    `To: ${email}`,
    `Subject: ${mimeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    textBody,
  ].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: base64UrlUtf8(raw) }),
  });
  if (!response.ok) {
    let payload: unknown = null;
    try { payload = await response.json(); } catch { payload = null; }
    throw new Error(gmailFailureCode(response.status, payload));
  }
}
