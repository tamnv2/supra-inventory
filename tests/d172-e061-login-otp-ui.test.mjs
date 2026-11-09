import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt", import.meta.url), "utf8");
const worker = readFileSync(new URL("../service/src/index.ts", import.meta.url), "utf8");
const privileged = readFileSync(new URL("../service/src/privileged-auth.ts", import.meta.url), "utf8");
const login = app.slice(app.indexOf('card.addView(action("Đăng nhập")'), app.indexOf('card.addView(secondaryAction("Lấy mã đăng nhập")'));
const requests = app.slice(app.indexOf("private fun call("), app.indexOf("private fun showLogin()"));

test("E061: valid OTP or ordinary password opens Operations immediately, before any Cloud/history network callback", () => {
  assert.ok(login.length > 100);
  assert.match(login, /sessionToken = token[\s\S]*?bindHistoryOwner\(res\)[\s\S]*?showWorkplace\(\)[\s\S]*?refreshAll\(\)/);
  assert.match(login, /if \(owner\.isBlank\(\)\)/);
  assert.match(login, /ObppSessionStore\.save\(this,token,displayName,owner\)/);
  assert.doesNotMatch(login, /if \(\s*refreshAll\(\)\s*\)/);
});

test("E061: pending one-time-code 409 shows current-code guidance, never a record-revision conflict", () => {
  assert.match(requests, /code == 409 &&\s*path == "\/api\/auth\/privileged-code" &&\s*safeError == "CODE_PENDING_UNTIL_CONSUMED"/);
  assert.match(requests, /Đã có mã đăng nhập chưa sử dụng/);
  assert.match(requests, /else when \(code\)/);
  assert.match(requests, /409 -> "Dữ liệu đã thay đổi ở máy khác/);
  assert.match(requests, /if \(code==401 && authenticated\) showLogin\(\)/);
});

test("E061: no Worker change needed; separate session, existing OTP and password authority remain", () => {
  assert.match(worker, /path==="\/api\/obpp1291\/session\/login"/);
  assert.match(worker, /verifyPrivilegedProof\(env,user,password,true\)/);
  assert.match(worker, /signInWithFirebasePassword\(env\.FIREBASE_WEB_API_KEY!,email,password\)/);
  assert.match(privileged, /CODE_PENDING_UNTIL_CONSUMED|PRIVILEGED_CODE_ISSUE_FAILED/);
  assert.doesNotMatch(login, /console\.log\(password\)|ObppDiagnostics\.event\([^\n]*pass/);
});
