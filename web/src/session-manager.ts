const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, "");
export const SESSION_KEY = "supra_inventory_beta_session_v1";

export interface SessionUser {
  user_id: string;
  [key: string]: unknown;
}

export interface StoredSession {
  id_token: string;
  refresh_token: string;
  expires_at: number;
  user: SessionUser;
}

let session: StoredSession | null = loadStoredSession();
let refreshPromise: Promise<void> | null = null;
let generation = 1;

function loadStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.id_token || !parsed.refresh_token || !parsed.user?.user_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(next: StoredSession | null): void {
  session = next;
  if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else sessionStorage.removeItem(SESSION_KEY);
}

function identity(next: StoredSession | null): string {
  return String(next?.user?.user_id || "");
}

export function getSessionSnapshot(): StoredSession | null {
  return session ? { ...session, user: { ...session.user } } : null;
}

export function getSessionGeneration(): number {
  return generation;
}

export function hasManagedSession(): boolean {
  return Boolean(session?.id_token && session?.refresh_token && session?.user?.user_id);
}

export function setLoginSession(next: StoredSession): void {
  const changedIdentity = identity(session) !== identity(next);
  persist(next);
  if (changedIdentity) generation += 1;
  window.dispatchEvent(new CustomEvent("supra:session-changed", { detail: { generation } }));
}

export function clearManagedSession(): void {
  const hadIdentity = Boolean(identity(session));
  persist(null);
  refreshPromise = null;
  if (hadIdentity) generation += 1;
  window.dispatchEvent(new CustomEvent("supra:session-changed", { detail: { generation } }));
}

export function updateSessionUser(user: SessionUser): void {
  if (!session) return;
  if (identity(session) !== String(user.user_id || "")) {
    setLoginSession({ ...session, user });
    return;
  }
  persist({ ...session, user });
}

function errorFromPayload(response: Response, text: string): Error {
  try {
    const payload = JSON.parse(text) as { error?: string; message?: string };
    return new Error(payload.message || payload.error || `HTTP ${response.status}`);
  } catch {
    return new Error(`HTTP ${response.status}`);
  }
}

async function refreshSession(): Promise<void> {
  if (!session?.refresh_token) throw new Error("Phiên đăng nhập đã hết hạn.");
  if (refreshPromise) return refreshPromise;

  const refreshToken = session.refresh_token;
  const userId = String(session.user.user_id);
  const startGeneration = generation;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({ refresh_token: refreshToken }),
      });
      const text = await response.text();
      if (!response.ok) {
        if ((response.status === 400 || response.status === 401) && generation === startGeneration && identity(session) === userId) {
          clearManagedSession();
        }
        throw errorFromPayload(response, text);
      }
      const result = JSON.parse(text) as { id_token?: string; refresh_token?: string; expires_in?: number };
      if (!result.id_token || !result.refresh_token) throw new Error("Phiên đăng nhập trả về không đầy đủ.");
      if (generation !== startGeneration || identity(session) !== userId || !session) {
        throw new Error("SESSION_CHANGED");
      }
      persist({
        ...session,
        id_token: result.id_token,
        refresh_token: result.refresh_token,
        expires_at: Date.now() + Math.max(60, Number(result.expires_in || 3600)) * 1000,
      });
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!session) throw new Error("Chưa đăng nhập.");
  const requestGeneration = generation;
  const requestUserId = identity(session);

  if (session.expires_at <= Date.now() + 60_000) await refreshSession();
  if (!session || generation !== requestGeneration || identity(session) !== requestUserId) throw new Error("SESSION_CHANGED");

  const send = async (): Promise<Response> => {
    if (!session) throw new Error("Chưa đăng nhập.");
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${session.id_token}`);
    headers.set("accept", "application/json");
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  };

  let response = await send();
  if (response.status === 401 && session?.refresh_token) {
    await refreshSession();
    if (!session || generation !== requestGeneration || identity(session) !== requestUserId) throw new Error("SESSION_CHANGED");
    response = await send();
  }

  if (generation !== requestGeneration || identity(session) !== requestUserId) throw new Error("SESSION_CHANGED");
  return response;
}
