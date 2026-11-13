import { test } from "node:test";
import { strict as assert } from "node:assert";
import { ensureDedicatedTestProject, requireTestEmployeeCode, newGrant, hashGrant, canRedeem } from "../session-logic.mjs";

test("only approved prefix for isolated Firebase project", () => {
  assert.doesNotThrow(() => ensureDedicatedTestProject("supra-d173-poc-test01"));
  for (const p of ["supra-inventory-beta", "supra-inventory-stable", "supra-inventory", "", "supra-d173-poc-"]) {
    assert.throws(() => ensureDedicatedTestProject(p));
  }
});
test("employee numeric validation, no default password", () => {
  assert.equal(requireTestEmployeeCode("1234567"), "1234567");
  for (const code of ["", "admin", "1", "123456789012345"]) assert.throws(() => requireTestEmployeeCode(code));
});
test("grants are opaque, unique, one-time and tied to active session", () => {
  const a = newGrant(), b = newGrant();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
  assert.equal(hashGrant(a).length, 64);
  const grant = {uid:"uid1",session_id:"a",expires_at_ms:20000,used:false};
  const session = {uid:"uid1",id:"a",active:true};
  assert.ok(canRedeem(grant,10000,session));
  assert.equal(canRedeem({...grant,used:true},10000,session),false);
  assert.equal(canRedeem(grant,20000,session),false);
  assert.equal(canRedeem(grant,10000,{...session,uid:"uid2"}),false);
  assert.equal(canRedeem(grant,10000,{...session,active:false}),false);
});
