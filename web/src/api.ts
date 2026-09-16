import { auth } from "./firebase";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export interface AppProfile {
  user_id: string;
  firebase_uid: string | null;
  employee_code: string | null;
  display_name: string;
  role: "PICKER" | "REPORTER" | "ADMIN" | "ROOT";
  status: "ACTIVE" | "DISABLED";
  password_changed_at: string | null;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  return payload;
}

export async function loginWithPassword(username: string, password: string): Promise<{ custom_token: string }> {
  return readJson(await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }),
  }));
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!auth?.currentUser) throw new Error("Chưa đăng nhập.");
  const token = await auth.currentUser.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

export async function getMyProfile(): Promise<AppProfile> {
  return (await readJson<{ user: AppProfile }>(await authorizedFetch("/api/auth/me"))).user;
}

export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  await readJson(await authorizedFetch("/api/auth/change-password", {
    method: "PUT", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  }));
}

export async function getHrSource(): Promise<unknown> {
  return readJson(await authorizedFetch("/api/admin/hr-source"));
}

export async function saveHrSource(sheetUrl: string, tabName: string): Promise<unknown> {
  return readJson(await authorizedFetch("/api/admin/hr-source", {
    method: "PUT", body: JSON.stringify({ sheet_url: sheetUrl, tab_name: tabName }),
  }));
}
