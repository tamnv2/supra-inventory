import { auth } from "./firebase";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export interface AppProfile {
  user_id: string;
  employee_code: string | null;
  display_name: string;
  role: "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
  status: "ACTIVE" | "DISABLED";
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!auth?.currentUser) throw new Error("Chưa đăng nhập.");
  const token = await auth.currentUser.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string; message?: string };
  if (!response.ok) {
    const candidate = payload as { error?: string; message?: string };
    throw new Error(candidate.message || candidate.error || `HTTP ${response.status}`);
  }
  return payload;
}

export async function getMyProfile(): Promise<AppProfile> {
  const result = await readJson<{ user: AppProfile }>(await authorizedFetch("/api/auth/me"));
  return result.user;
}

export async function getHrSource(): Promise<unknown> {
  return readJson(await authorizedFetch("/api/admin/hr-source"));
}

export async function saveHrSource(sheetUrl: string, tabName: string): Promise<unknown> {
  return readJson(
    await authorizedFetch("/api/admin/hr-source", {
      method: "PUT",
      body: JSON.stringify({ sheet_url: sheetUrl, tab_name: tabName }),
    }),
  );
}
