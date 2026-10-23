import test from "node:test";
import assert from "node:assert/strict";
import { sendProjectEmail } from "../service/src/google-mail.ts";

test("E005: Cloudflare sends identical UTF-8 OTP subject/body/recipient once", async () => {
  const sent = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Gmail must never be called after cutover"); };
  try {
    const subject = "MẬT KHẨU BÁO HÀNG admin - 0421";
    const body = "SUPRA Inventory - Báo hàng\r\n\r\nTài khoản: admin\r\nMật khẩu một lần: 0421";
    await sendProjectEmail({
      PROJECT_MAIL_SENDER: "no-reply@supra.cc.cd",
      EMAIL: { send: async m => { sent.push(m); return { messageId: "canary-mocked" }; } },
    }, "receiver@example.net", subject, body);
    assert.deepEqual(sent, [{ from: "no-reply@supra.cc.cd", to: "receiver@example.net", subject, text: body }]);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("E005: refuses wrong sender or missing binding; never calls Gmail", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("unexpected Gmail fallback"); };
  try {
    await assert.rejects(sendProjectEmail({ PROJECT_MAIL_SENDER: "other@supra.cc.cd" }, "receiver@example.net", "x", "y"), /PROJECT_MAIL_SENDER_NOT_AUTHORIZED/);
    await assert.rejects(sendProjectEmail({ PROJECT_MAIL_SENDER: "no-reply@supra.cc.cd" }, "receiver@example.net", "x", "y"), /PROJECT_MAIL_SERVICE_NOT_READY/);
    await assert.rejects(sendProjectEmail({ PROJECT_MAIL_SENDER: "no-reply@supra.cc.cd", EMAIL: {
      send: async () => { const e = new Error("do not log raw payload"); e.code = "E_RATE_LIMIT_EXCEEDED"; throw e; },
    } }, "receiver@example.net", "secret-subject", "secret-body"), /PROJECT_MAIL_SEND_FAILED_E_RATE_LIMIT_EXCEEDED/);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("E005: sender flag unset preserves Gmail API and original mime subject/body", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes("oauth2.googleapis.com")) return new Response(JSON.stringify({
      access_token: "test-access-token",
      scope: "https://www.googleapis.com/auth/gmail.send",
    }), { status: 200 });
    return new Response("{}", { status: 200 });
  };
  try {
    await sendProjectEmail({
      GOOGLE_DRIVE_OAUTH_CLIENT_ID: "fake",
      GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: "REDACTED_TEST_VALUE",
      GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "REDACTED_TEST_VALUE",
    }, "receiver@example.net", "Đặt lại mật khẩu SUPRA Inventory", "Mở liên kết thử\r\n");
    assert.equal(calls.length, 2);
    const data = JSON.parse(calls[1].opts.body);
    const s = data.raw.replaceAll("-", "+").replaceAll("_", "/");
    const mime = Buffer.from(s, "base64").toString("utf8");
    assert.match(mime, /^To: receiver@example.net\r\n/);
    assert.match(mime, /Subject: =\?UTF-8\?B\?/);
    assert.ok(mime.endsWith("\r\nMở liên kết thử\r\n"));
  } finally {
    globalThis.fetch = original;
  }
});
