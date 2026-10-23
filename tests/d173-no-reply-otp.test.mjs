import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const mail = read("service/src/google-mail.ts");
const privileged = read("service/src/privileged-auth.ts");
const launcher = read("service/src/launcher-password.ts");
const reset = read("service/src/system-reset.ts");
const worker = read("service/src/index.ts");
const prodConfig = read("service/wrangler.beta.toml");
const stableConfig = read("service/wrangler.stable.toml");

test("D173: sender-locked Email Service binding is configured on existing data-bearing Production only", () => {
  assert.match(prodConfig, /name = "supra-inventory-beta"/);
  assert.match(prodConfig, /\[\[send_email\]\]\s*name = "EMAIL"\s*allowed_sender_addresses = \["no-reply@supra\.cc\.cd"\]/);
  assert.doesNotMatch(stableConfig, /\[\[send_email\]\]/);
  assert.match(prodConfig, /^PROJECT_MAIL_SENDER\s*=\s*"no-reply@supra\\.cc\\.cd"\s*$/m); // E007 delivered, E008 200/day verified
  assert.match(mail, /PROJECT_MAIL_SENDER\?: string/);
  assert.match(mail, /EMAIL\?: \{ send\(/);
});

test("D173: sender transition preserves original caller-generated subject/body and recipient", () => {
  assert.match(mail, /const email = String\(to \|\| ""\)\.trim\(\)/);
  assert.match(mail, /sender !== "no-reply@supra\.cc\.cd"/);
  assert.match(mail, /if \(!env\.EMAIL\) throw new Error\("PROJECT_MAIL_SERVICE_NOT_READY"\)/);
  assert.match(mail, /await env\.EMAIL\.send\(\{ from: sender, to: email, subject, text: textBody \}\)/);
  assert.match(mail, /PROJECT_MAIL_SEND_FAILED_/);
  assert.match(mail, /const token = await refreshGoogleAccessToken\(env\)/);
  assert.match(mail, /Subject: \$\{mimeSubject\(subject\)\}/);
  assert.match(mail, /textBody,/);
  assert.doesNotMatch(mail, /OTP.*replace\(/);
});

test("D173: sender failure is explicit, never triggers duplicate Gmail mail after cutover", () => {
  const fail = mail.indexOf("PROJECT_MAIL_SEND_FAILED_");
  const cloudflareReturn = mail.indexOf("    return;", fail);
  const gmail = mail.indexOf("const token = await refreshGoogleAccessToken(env)", cloudflareReturn);
  assert.ok(fail >= 0 && cloudflareReturn > fail && gmail > cloudflareReturn);
});

test("D173: live recovery email title and plaintext are not changed", () => {
  assert.match(worker, /"Đặt lại mật khẩu SUPRA Inventory"/);
  assert.match(worker, /"Bạn vừa yêu cầu đặt lại mật khẩu SUPRA Inventory\."/);
  assert.match(worker, /"Liên kết có hiệu lực trong 15 phút và chỉ dùng một lần\."/);
});

test("D173: current 4-digit privileged OTP subject, recipient and full body remain byte-for-byte caller-owned", () => {
  assert.match(privileged, /sendProjectEmail\(\s*env,\s*PROJECT_ADMIN_EMAIL/);
  assert.match(privileged, /MẬT KHẨU BÁO HÀNG \$\{username\} - \$\{code\}/);
  assert.match(privileged, /SUPRA Inventory - Báo hàng/);
  assert.match(privileged, /Tài khoản: \$\{username\}/);
  assert.match(privileged, /Mật khẩu một lần: \$\{code\}/);
  assert.match(privileged, /Mã có hiệu lực cho tới lần sử dụng thành công, không tự hết hạn theo thời gian/);
  assert.match(privileged, /Không chuyển tiếp email này cho người không có quyền/);
  assert.match(privileged, /\.join\("\\r\\n"\)/);
  assert.match(privileged, /await cancelIssuedCode\(env, user, stored\.revision\)/);
});

test("D173 E005: Launcher daily/reset title and existing body stay caller-owned", () => {
  assert.match(launcher, /MẬT KHẨU LAUNCHER HÀNG NGÀY/);
  assert.match(launcher, /SUPRA PDA Launcher/);
  assert.match(launcher, /Mã quản trị Launcher hằng ngày đã được tạo/);
  assert.match(launcher, /Mã quản trị Launcher vừa được đặt lại/);
  assert.match(launcher, /sendProjectEmail\(env, RECIPIENT, mailSubject\(payload\), mailBody\(payload\)\)/);
});

test("D173 E005: ROOT reset six-digit email template remains unchanged", () => {
  assert.match(reset, /"Mã xác nhận đặt lại hệ thống SUPRA Inventory"/);
  assert.match(reset, /Mã xác nhận đặt lại hệ thống: \$\{code\}/);
  assert.match(reset, /Mã có hiệu lực trong 10 phút và chỉ dùng cho yêu cầu đặt lại hiện tại/);
  assert.match(reset, /await sendResetCodeEmail\(env, root\.auth_email, code\)/);
});
