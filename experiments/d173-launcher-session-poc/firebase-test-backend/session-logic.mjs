import { randomBytes, createHash } from "node:crypto";

export function ensureDedicatedTestProject(project) {
  if (!/^supra-d173-poc-[a-z0-9-]{3,45}$/.test(String(project || ""))) {
    throw new Error("NOT_DEDICATED_TEST_PROJECT");
  }
}
export function requireTestEmployeeCode(value) {
  if (typeof value !== "string" || !/^[0-9]{5,12}$/.test(value)) {
    throw new Error("INVALID_TEST_EMPLOYEE_CODE");
  }
  return value;
}
export function newGrant() {
  return randomBytes(32).toString("hex");
}
export function hashGrant(code) {
  if (typeof code !== "string" || !/^[a-f0-9]{64}$/.test(code)) {
    throw new Error("INVALID_GRANT");
  }
  return createHash("sha256").update(code).digest("hex");
}
export function canRedeem(grant, now, session) {
  return !!grant
    && grant.used !== true
    && typeof grant.expires_at_ms === "number"
    && now < grant.expires_at_ms
    && !!session && session.active === true
    && grant.uid === session.uid
    && grant.session_id === session.id;
}
