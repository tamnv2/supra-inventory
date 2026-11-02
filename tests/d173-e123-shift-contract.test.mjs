import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "../service/node_modules/typescript/lib/typescript.js";
const source = readFileSync("service/src/d173-picker-shift.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}}).outputText;
const module = { exports: {} };
new Function("module", "exports", js)(module, module.exports);
const { d173PickerShiftLogoutAtMs: cutoff, d173PickerShiftIsExpired: expired } = module.exports;
const c = (stamp) => cutoff(stamp).toString();
const boundary = (t) => Date.parse(t).toString();
assert.equal(c("2026-11-03 02:59:59"), boundary("2026-11-03T07:00:00Z"), "09:59:59 VN -> 14:00 VN");
assert.equal(c("2026-11-03 03:00:00"), boundary("2026-11-03T15:00:00Z"), "10:00 VN -> 22:00 VN");
assert.equal(c("2026-11-03 14:59:59"), boundary("2026-11-03T15:00:00Z"), "21:59:59 VN -> 22:00 VN");
assert.equal(c("2026-11-03 15:00:00"), boundary("2026-11-04T15:00:00Z"), "22:00 VN new overtime login must not be immediately revoked");
assert.equal(c("2026-11-03 20:10:00"), boundary("2026-11-04T15:00:00Z"), "03:10 VN overtime login stays usable");
assert.equal(expired("2026-11-03 02:00:00", Date.parse("2026-11-03T06:59:59Z")), false);
assert.equal(expired("2026-11-03 02:00:00", Date.parse("2026-11-03T07:00:00Z")), true);
assert.equal(expired(null, Date.now()), true, "invalid/missing login timestamp fails closed");
assert.equal(cutoff("invalid"), null);
const core = readFileSync("service/src/core.ts", "utf8");
const worker = readFileSync("service/src/index.ts", "utf8");
const android = readFileSync("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt", "utf8");
assert.match(core, /PICKER_SHIFT_ENDED/, "DO enforces boundary");
assert.match(worker, /PICKER_SHIFT_ENDED/, "Worker enforces boundary");
assert.match(android, /pickerShiftLeadMs = 15 \* 60 \* 1000L/);
assert.match(android, /logoutWithNotificationCleanup\("Đã hết ca/);
console.log("D173-E123 shift contract PASS");
