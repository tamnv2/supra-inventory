import "./styles.css";
import { onAuthStateChanged, signInWithCustomToken, signOut } from "firebase/auth";
import { auth, firebaseMissing, firebaseReady } from "./firebase";
import { changeMyPassword, getHrSource, getMyProfile, loginWithPassword, saveHrSource, type AppProfile } from "./api";

const app = document.querySelector<HTMLDivElement>("#app")!;
let profile: AppProfile | null = null;
let message = "";
let busy = false;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function render(): void {
  if (!firebaseReady || !auth) {
    app.innerHTML = `<main class="shell"><section class="card"><p class="eyebrow">SUPRA Inventory — Beta</p><h1>Thiếu cấu hình Firebase Web</h1><p>Web source đã deploy-ready nhưng Auth cần Firebase API key public của app Beta.</p><pre>${escapeHtml(firebaseMissing.join(", "))}</pre></section></main>`;
    return;
  }
  if (!auth.currentUser) {
    app.innerHTML = `<main class="shell"><section class="card login-card"><p class="eyebrow">SUPRA Inventory — Beta</p><h1>Đăng nhập</h1><form id="login-form" class="stack"><label>Tên đăng nhập<input name="username" autocomplete="username" value="root" required /></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required /></label><button ${busy ? "disabled" : ""}>${busy ? "Đang đăng nhập..." : "Đăng nhập"}</button></form>${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}</section></main>`;
    document.querySelector<HTMLFormElement>("#login-form")?.addEventListener("submit", handleLogin);
    return;
  }
  const canManageHr = profile?.role === "ROOT" || profile?.role === "ADMIN";
  app.innerHTML = `<main class="shell wide"><header class="topbar card"><div><p class="eyebrow">SUPRA Inventory — Beta</p><h1>${escapeHtml(profile?.display_name || "Đang tải hồ sơ...")}</h1></div><div class="actions"><span class="badge">${escapeHtml(profile?.role || "AUTH")}</span><button id="logout" class="secondary">Đăng xuất</button></div></header>${message ? `<p class="message card">${escapeHtml(message)}</p>` : ""}<section class="grid"><article class="card"><h2>Đổi mật khẩu</h2><form id="password-form" class="stack"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" required /></label><label>Mật khẩu mới<input name="newPassword" type="password" minlength="8" required /></label><button>Đổi mật khẩu</button></form></article>${canManageHr ? `<article class="card"><h2>Nguồn nhân sự</h2><p>Nhập link Google Sheet và tên tab chính xác. Backend chỉ lưu sau khi kiểm tra quyền đọc + cột MNV/Họ tên.</p><form id="hr-form" class="stack"><label>Google Sheet URL<input name="sheetUrl" type="url" required /></label><label>Tên tab<input name="tabName" value="Nhân sự" required /></label><button>Xác nhận & cập nhật</button></form><button id="load-hr" class="secondary">Đọc cấu hình hiện tại</button><pre id="hr-result"></pre></article>` : ""}</section></main>`;
  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", async () => signOut(auth!));
  document.querySelector<HTMLFormElement>("#password-form")?.addEventListener("submit", handlePasswordChange);
  document.querySelector<HTMLFormElement>("#hr-form")?.addEventListener("submit", handleHrSave);
  document.querySelector<HTMLButtonElement>("#load-hr")?.addEventListener("click", handleHrLoad);
}

async function handleLogin(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!auth) return;
  const form = new FormData(event.currentTarget as HTMLFormElement);
  busy = true; message = ""; render();
  try {
    const result = await loginWithPassword(String(form.get("username") || ""), String(form.get("password") || ""));
    await signInWithCustomToken(auth, result.custom_token);
  } catch (error) {
    message = error instanceof Error ? error.message : "Đăng nhập thất bại.";
  } finally { busy = false; render(); }
}

async function handlePasswordChange(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  try {
    await changeMyPassword(String(form.get("currentPassword") || ""), String(form.get("newPassword") || ""));
    message = "Đổi mật khẩu thành công.";
    (event.currentTarget as HTMLFormElement).reset();
  } catch (error) { message = error instanceof Error ? error.message : "Không đổi được mật khẩu."; }
  render();
}

async function handleHrSave(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  try {
    const result = await saveHrSource(String(form.get("sheetUrl") || ""), String(form.get("tabName") || ""));
    message = "Nguồn nhân sự đã được kiểm tra và cập nhật.";
    const output = document.querySelector<HTMLElement>("#hr-result");
    if (output) output.textContent = JSON.stringify(result, null, 2);
  } catch (error) { message = error instanceof Error ? error.message : "Không cập nhật được nguồn nhân sự."; render(); }
}

async function handleHrLoad(): Promise<void> {
  try {
    const output = document.querySelector<HTMLElement>("#hr-result");
    if (output) output.textContent = JSON.stringify(await getHrSource(), null, 2);
  } catch (error) { message = error instanceof Error ? error.message : "Không đọc được nguồn nhân sự."; render(); }
}

if (auth) onAuthStateChanged(auth, async (user) => {
  profile = null; message = "";
  if (user) {
    try { profile = await getMyProfile(); }
    catch (error) { message = error instanceof Error ? error.message : "Không tải được hồ sơ ứng dụng."; }
  }
  render();
});
render();
