import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("../service/node_modules/typescript");
const original = readFileSync(new URL("../service/src/d173-sql-audit-auth.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(original, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);
const { D173_SQL_AUDIT_PATH, D173_SQL_AUDIT_DOMAIN,
  verifyD173SqlAuditSignature: verify } = mod.exports;
const secret = "test-only-not-an-actual-provider-secret-1234";
const timestamp = 1793654400;
const fixed = timestamp * 1000;
const sig = (tsSec) => createHmac("sha256", secret)
  .update([D173_SQL_AUDIT_DOMAIN, "GET", D173_SQL_AUDIT_PATH, String(tsSec)].join("\n")).digest("hex");
function req(tsSec, hmac, method = "GET", path = D173_SQL_AUDIT_PATH) {
  return new Request("https://inventory.supra.cc.cd" + path, {
    method, headers: { "x-d173-audit-ts": String(tsSec), "x-d173-audit-hmac": hmac },
  });
}
test("valid one-shot read-only signed request", async () => {
  assert.equal(await verify(req(timestamp, sig(timestamp)), secret, fixed), true);
});
test("bad signature, wrong secret and clock skew fail closed", async () => {
  assert.equal(await verify(req(timestamp, "0".repeat(64)), secret, fixed), false);
  assert.equal(await verify(req(timestamp, sig(timestamp)), "other-not-production-secret-with-length", fixed), false);
  assert.equal(await verify(req(timestamp, sig(timestamp)), secret, fixed + 91_000), false);
  assert.equal(await verify(req(timestamp, sig(timestamp)), undefined, fixed), false);
});
test("cannot invoke on mutable method or different URL", async () => {
  assert.equal(await verify(req(timestamp, sig(timestamp), "POST"), secret, fixed), false);
  assert.equal(await verify(req(timestamp, sig(timestamp), "GET", "/api/internal/d173/other"), secret, fixed), false);
});
test("invalid timestamp and oversized signature fail closed", async () => {
  assert.equal(await verify(req("NaN", sig(timestamp)), secret, fixed), false);
  assert.equal(await verify(req(timestamp, "a".repeat(128)), secret, fixed), false);
});
