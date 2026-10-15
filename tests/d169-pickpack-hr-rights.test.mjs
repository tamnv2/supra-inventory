import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");
const web = read("web/src/operational-app.ts");
const api = read("service/src/user-management-api.ts");
const core = read("service/src/user-management-core.ts");
const business = read("service/src/business-api.ts");
test("Pick Pack admin can open the Web/Excel Picker tab, without gaining managed account creation", () => {
 assert.match(web, /\["ADMIN", "PICKPACK_ADMIN", "ROOT"\]\.includes\(profile\?\.role \|\| ""\).*Thêm Picker \/ Excel/);
 assert.match(web, /if \(next === "import" && !\["ADMIN", "PICKPACK_ADMIN", "ROOT"\]/);
 assert.match(web, /const canCreateReporter = profile\?\.role === "ROOT" \|\| profile\?\.role === "ADMIN"/);
 assert.match(web, /const canLifecyclePickerBulk = profile\?\.role === "ADMIN" \|\| profile\?\.role === "ROOT"/);
});
test("API and Core authorize only validated Picker HR preview and apply", () => {
 assert.match(api, /\["ADMIN", "PICKPACK_ADMIN", "ROOT"\]\.includes\(user\.role\)/);
 assert.match(core, /\["ADMIN","PICKPACK_ADMIN","ROOT"\]\.includes\(body\.actor\.role\)/);
 assert.match(core, /\["ADMIN","PICKPACK_ADMIN","ROOT"\]\.includes\(actor\.role\)/);
 assert.match(core, /HR_EMPLOYEE_CODE_COLLIDES_NON_PICKER/);
 assert.match(core, /HR_PREVIEW_STALE/);
 assert.match(core, /HR_CHANGE_REVIEW_REQUIRED/);
 assert.match(api, /derivePickerDefault\(env\)/);
});
test("Do not grant Picker creation through privileged admin user creation nor full SKU replacement",()=>{
 assert.match(core, /if \(!\["ADMIN", "PICKPACK_ADMIN", "REPORTER"\]\.includes\(targetRole\)\)/);
 assert.match(business, /if \(key === "POST \/api\/admin\/skus\/full-replace"\) return \["ADMIN","ROOT"\]/);
 assert.match(business, /if \(key === "POST \/api\/admin\/skus\/import"\) return PICKPACK_REPORT_ROLES/);
});
