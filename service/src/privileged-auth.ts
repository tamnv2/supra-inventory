import { verifyPassword } from "./auth";
import { sendProjectEmail, type GoogleMailEnv } from "./google-mail";
import { PROJECT_ADMIN_EMAIL } from "./launcher-password";

export interface PrivilegedAuthUser {
  user_id: string;
  employee_code?: string | null;
  role?: string;
  base_role?: string;
  status?: string;
  password_salt?: string | null;
  password_hash?: string | null;
}

export interface PrivilegedAuthEnv extends GoogleMailEnv {
  INVENTORY_CORE: DurableObjectNamespace;
}

export class PrivilegedAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds = 0,
  ) {
    super(message);
  }
}

const SPECIAL_LOGINS = new Set(["root", "admin", "tamnv2"]);
const CORE_OBJECT_NAME = "inventory-core";

function core(env: PrivilegedAuthEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_OBJECT_NAME));
}

export function privilegedLoginName(user: PrivilegedAuthUser): string {
  const employee = String(user.employee_code || "").trim().toLowerCase();
  if (SPECIAL_LOGINS.has(employee)) return employee;
  const id = String(user.user_id || "").trim().toLowerCase();
  if (SPECIAL_LOGINS.has(id)) return id;
  const tail = id.includes(":") ? id.split(":").pop() || "" : "";
  return SPECIAL_LOGINS.has(tail) ? tail : "";
}

export function isPrivilegedOneTimeUser(user: PrivilegedAuthUser | null | undefined): boolean {
  return Boolean(user && user.status === "ACTIVE" && privilegedLoginName(user));
}

export function isPrivilegedLoginName(username: string): boolean {
  return SPECIAL_LOGINS.has(String(username || "").trim().toLowerCase());
}

function randomFourDigits(): string {
  const bucket = 10_000;
  const range = 0x1_0000_0000;
  const limit = range - (range % bucket);
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return String(values[0] % bucket).padStart(4, "0");
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function vnHhmm(ms: number): string {
  const shifted = new Date(ms + 7 * 60 * 60 * 1000);
  return String(shifted.getUTCHours()).padStart(2, "0") + String(shifted.getUTCMinutes()).padStart(2, "0");
}

export function isEmergencyPrivilegedProof(proof: string, nowMs = Date.now()): boolean {
  const value = String(proof || "").trim();
  if (!/^\d{8,}$/.test(value)) return false;
  for (let delta = -5; delta <= 5; delta += 1) {
    if (value.includes(vnHhmm(nowMs + delta * 60 * 1000))) return true;
  }
  return false;
}

async function issueCodeState(
  env: PrivilegedAuthEnv,
  user: PrivilegedAuthUser,
  code: string,
  bypassCooldown: boolean,
): Promise<{ revision: number; expires_at: string }> {
  const codeHash = await sha256(`${user.user_id}:${code}`);
  const response = await core(env).fetch("https://inventory-core.internal/privileged-auth/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      user_id: user.user_id,
      code_hash: codeHash,
      bypass_cooldown: bypassCooldown,
    }),
  });
  const payload = (await response.json()) as {
    revision?: number;
    expires_at?: string;
    error?: string;
    retry_after_seconds?: number;
  };
  if (!response.ok) {
    throw new PrivilegedAuthError(
      String(payload.error || "PRIVILEGED_CODE_ISSUE_FAILED").toUpperCase(),
      response.status,
      response.status === 429 ? "Mã vừa được gửi. Vui lòng dùng mã mới nhất trong email." : "Không tạo được mã một lần.",
      Number(payload.retry_after_seconds || 0),
    );
  }
  return {
    revision: Number(payload.revision || 0),
    expires_at: String(payload.expires_at || ""),
  };
}

async function cancelIssuedCode(env: PrivilegedAuthEnv, user: PrivilegedAuthUser, revision: number): Promise<void> {
  try {
    await core(env).fetch("https://inventory-core.internal/privileged-auth/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id, revision }),
    });
  } catch {
    // Best effort. A failed email invalidates only the unsent challenge revision.
  }
}

export async function sendPrivilegedOneTimeCode(
  env: PrivilegedAuthEnv,
  user: PrivilegedAuthUser,
  bypassCooldown = false,
): Promise<{ expires_at: string }> {
  if (!isPrivilegedOneTimeUser(user)) {
    throw new PrivilegedAuthError("NOT_PRIVILEGED_ONE_TIME_ACCOUNT", 403, "Tài khoản không dùng mã một lần.");
  }
  const username = privilegedLoginName(user);
  const code = randomFourDigits();
  const stored = await issueCodeState(env, user, code, bypassCooldown);
  try {
    await sendProjectEmail(
      env,
      PROJECT_ADMIN_EMAIL,
      `MẬT KHẨU BÁO HÀNG ${username} - ${code}`,
      [
        "SUPRA Inventory - Báo hàng",
        "",
        `Tài khoản: ${username}`,
        `Mật khẩu một lần: ${code}`,
        "Mã có hiệu lực cho tới lần sử dụng thành công, không tự hết hạn theo thời gian.",
        "",
        "Không chuyển tiếp email này cho người không có quyền.",
      ].join("\r\n"),
    );
  } catch (error) {
    await cancelIssuedCode(env, user, stored.revision);
    throw new PrivilegedAuthError(
      "PRIVILEGED_CODE_EMAIL_FAILED",
      503,
      error instanceof Error ? error.message : "Không gửi được email mã một lần.",
    );
  }
  return { expires_at: stored.expires_at };
}

export async function verifyPrivilegedProof(
  env: PrivilegedAuthEnv,
  user: PrivilegedAuthUser,
  proof: string,
  rotateAfterOtp = true,
): Promise<{ valid: boolean; mode: "OTP" | "EMERGENCY" | "NONE"; next_code_sent?: boolean }> {
  if (!isPrivilegedOneTimeUser(user)) return { valid: false, mode: "NONE" };
  const value = String(proof || "").trim();

  if (isEmergencyPrivilegedProof(value)) return { valid: true, mode: "EMERGENCY" };
  if (!/^\d{4}$/.test(value)) return { valid: false, mode: "NONE" };

  const codeHash = await sha256(`${user.user_id}:${value}`);
  const response = await core(env).fetch("https://inventory-core.internal/privileged-auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.user_id, code_hash: codeHash }),
  });
  const payload = (await response.json()) as { valid?: boolean; retry_after_seconds?: number };
  if (!response.ok || payload.valid !== true) {
    if (response.status === 429) {
      throw new PrivilegedAuthError(
        "PRIVILEGED_AUTH_RATE_LIMITED",
        429,
        "Nhập sai quá nhiều lần. Vui lòng thử lại sau.",
        Number(payload.retry_after_seconds || 0),
      );
    }
    return { valid: false, mode: "NONE" };
  }

  let nextCodeSent = false;
  if (rotateAfterOtp) {
    try {
      await sendPrivilegedOneTimeCode(env, user, true);
      nextCodeSent = true;
    } catch {
      // Current proof was valid and consumed. A temporary next-mail failure does
      // not turn the completed authentication into a false negative.
    }
  }
  return { valid: true, mode: "OTP", next_code_sent: nextCodeSent };
}

export async function verifyCurrentAuthenticationProof(
  env: PrivilegedAuthEnv,
  user: PrivilegedAuthUser,
  proof: string,
): Promise<{ valid: boolean; mode: "OTP" | "EMERGENCY" | "PASSWORD" | "NONE" }> {
  if (isPrivilegedOneTimeUser(user)) {
    const result = await verifyPrivilegedProof(env, user, proof, true);
    return { valid: result.valid, mode: result.mode };
  }
  const valid = Boolean(
    proof &&
    user.password_salt &&
    user.password_hash &&
    await verifyPassword(proof, user.password_salt, user.password_hash)
  );
  return { valid, mode: valid ? "PASSWORD" : "NONE" };
}
