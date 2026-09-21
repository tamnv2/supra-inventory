import { getServiceAccountAccessToken } from "./hr-source";

export type FirebaseManagedRole = "PICKER" | "REPORTER" | "ADMIN" | "ROOT";

export interface FirebaseManagedUserSpec {
  uid: string;
  userId: string;
  employeeCode: string | null;
  displayName: string;
  role: FirebaseManagedRole;
  status: "ACTIVE" | "DISABLED";
  authEmail?: string | null;
  passwordSalt?: string | null;
  passwordHash?: string | null;
}

export interface FirebasePasswordSession {
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  localId: string;
  email: string;
}

interface FirebaseErrorPayload {
  error?: {
    message?: string;
    status?: string;
    details?: unknown[];
  };
}

const FIREBASE_ADMIN_SCOPE = "https://www.googleapis.com/auth/identitytoolkit";
const PASSWORD_ROUNDS = 100_000;

export function normalizeAuthEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("EMAIL_INVALID");
  }
  return email;
}

export function syntheticAuthEmail(role: FirebaseManagedRole, employeeCode: string | null, userId: string): string {
  const seed = String(employeeCode || userId || "user")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44) || "user";
  return `${role.toLowerCase()}.${seed}@auth.supra.invalid`;
}

export function effectiveAuthEmail(user: FirebaseManagedUserSpec): string {
  // D100: the Firebase password identifier is deterministic from the business
  // username/employee code. The registered real email is recovery/OTP metadata
  // only and is deliberately not the Firebase sign-in address.
  return syntheticAuthEmail(user.role, user.employeeCode, user.userId);
}

function claimsFor(user: FirebaseManagedUserSpec): string {
  return JSON.stringify({
    app_user_id: user.userId,
    app_role: user.role,
    app_base_role: user.role,
  });
}

async function adminToken(rawServiceAccountJson: string): Promise<string> {
  const token = await getServiceAccountAccessToken(rawServiceAccountJson, FIREBASE_ADMIN_SCOPE);
  return token.accessToken;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`FIREBASE_AUTH_INVALID_JSON_HTTP_${response.status}`);
  }
}

function upstreamMessage(payload: Record<string, unknown>, fallback: string): string {
  const root = payload as FirebaseErrorPayload;
  return String(root.error?.message || root.error?.status || fallback);
}

export async function importPasswordIdentity(
  rawServiceAccountJson: string,
  projectId: string,
  user: FirebaseManagedUserSpec,
): Promise<{ uid: string; email: string }> {
  if (!user.uid || !user.passwordHash || !user.passwordSalt) {
    throw new Error("FIREBASE_IMPORT_PASSWORD_MATERIAL_REQUIRED");
  }

  const token = await adminToken(rawServiceAccountJson);
  const email = effectiveAuthEmail(user);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:batchCreate`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        hashAlgorithm: "PBKDF2_SHA256",
        rounds: PASSWORD_ROUNDS,
        allowOverwrite: true,
        users: [{
          localId: user.uid,
          email,
          displayName: user.displayName,
          passwordHash: user.passwordHash,
          salt: user.passwordSalt,
          disabled: user.status !== "ACTIVE",
          customAttributes: claimsFor(user),
        }],
      }),
    },
  );
  const payload = await readJson(response);
  const errors = Array.isArray(payload.error) ? payload.error : [];
  if (!response.ok || errors.length) {
    throw new Error(upstreamMessage(payload, `FIREBASE_IMPORT_HTTP_${response.status}`));
  }
  return { uid: user.uid, email };
}

export async function deleteFirebaseUsers(
  rawServiceAccountJson: string,
  projectId: string,
  localIds: string[],
): Promise<number> {
  const ids = [...new Set(localIds.map((value) => String(value || "").trim()).filter(Boolean))];
  if (!ids.length) return 0;
  const token = await adminToken(rawServiceAccountJson);
  let deleted = 0;
  for (let offset = 0; offset < ids.length; offset += 1000) {
    const chunk = ids.slice(offset, offset + 1000);
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:batchDelete`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ localIds: chunk, force: true }),
      },
    );
    const payload = await readJson(response);
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    if (!response.ok || errors.length) {
      throw new Error(upstreamMessage(payload, `FIREBASE_BATCH_DELETE_HTTP_${response.status}`));
    }
    deleted += chunk.length;
    if (offset + chunk.length < ids.length) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }
  return deleted;
}

export async function updateFirebaseIdentity(
  rawServiceAccountJson: string,
  projectId: string,
  user: FirebaseManagedUserSpec,
  options: { password?: string; email?: string | null } = {},
): Promise<{ uid: string; email: string }> {
  if (!user.uid) throw new Error("FIREBASE_UID_REQUIRED");
  const token = await adminToken(rawServiceAccountJson);
  const email = normalizeAuthEmail(options.email ?? user.authEmail ?? "") || effectiveAuthEmail(user);
  const body: Record<string, unknown> = {
    localId: user.uid,
    email,
    displayName: user.displayName,
    disableUser: user.status !== "ACTIVE",
    customAttributes: claimsFor(user),
  };
  if (options.password != null) {
    const password = String(options.password);
    if (password.length < 8 || password.length > 128) throw new Error("PASSWORD_INVALID");
    body.password = password;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:update`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(upstreamMessage(payload, `FIREBASE_UPDATE_HTTP_${response.status}`));
  }
  return { uid: user.uid, email };
}

export async function signInWithFirebasePassword(
  apiKey: string,
  email: string,
  password: string,
): Promise<FirebasePasswordSession> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email: normalizeAuthEmail(email), password, returnSecureToken: true }),
    },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(upstreamMessage(payload, "INVALID_CREDENTIALS"));
  }
  const idToken = String(payload.idToken || "");
  const refreshToken = String(payload.refreshToken || "");
  const localId = String(payload.localId || "");
  const returnedEmail = String(payload.email || email);
  const expiresIn = Number(payload.expiresIn || 3600);
  if (!idToken || !refreshToken || !localId) throw new Error("FIREBASE_PASSWORD_SESSION_INCOMPLETE");
  return {
    idToken,
    refreshToken,
    localId,
    email: returnedEmail,
    expiresIn: Number.isFinite(expiresIn) ? Math.max(60, expiresIn) : 3600,
  };
}

export async function sendFirebasePasswordReset(apiKey: string, email: string): Promise<void> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-firebase-locale": "vi",
      },
      body: JSON.stringify({
        requestType: "PASSWORD_RESET",
        email: normalizeAuthEmail(email),
      }),
    },
  );
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(upstreamMessage(payload, `FIREBASE_RESET_HTTP_${response.status}`));
  }
}
