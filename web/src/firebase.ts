import { getApps, initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || "",
};

export const firebaseMissing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseReady = firebaseMissing.length === 0;

export const auth: Auth | null = firebaseReady
  ? getAuth(getApps()[0] ?? initializeApp(config))
  : null;

export function usernameToEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,64}$/.test(normalized)) {
    throw new Error("Tên đăng nhập chỉ được chứa chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.");
  }
  return `${normalized}@auth.supra-inventory.local`;
}
