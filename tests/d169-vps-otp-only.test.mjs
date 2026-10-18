import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const auth = read("service/src/privileged-auth.ts");
const core = read("service/src/core.ts");
const worker = read("service/src/index.ts");
const agent = read("relay-agent/D165PrivilegedAuth.cs");
const agentUi = read("relay-agent/Program.cs");
const gateway = read("ops/apps-script/agent-log-gateway/Code.gs");
const management = read("service/src/user-management-api.ts");

test("VPS is protected only when the existing real base/effective role is a permitted Agent operator", () => {
  assert.match(auth, /SPECIAL_LOGINS = new Set\(\["root", "admin", "tamnv2", "vps"\]\)/);
  assert.match(auth, /if \(login !== "vps"\) return login;/);
  assert.match(auth, /role === "ADMIN" && baseRole === "ADMIN"/);
  assert.match(auth, /role === "PICKPACK_ADMIN" && baseRole === "PICKPACK_ADMIN"/);
  assert.match(core, /login === "vps" && !vpsRoleAllowed/);
  assert.match(worker, /user.base_role === "ADMIN" && user.role === "ADMIN"/);
  assert.match(worker, /user.base_role === "PICKPACK_ADMIN" && user.role === "PICKPACK_ADMIN"/);
});

test("VPS never takes the predictable time-only emergency path, including reauthentication", () => {
  assert.match(auth, /privilegedLoginName\(user\) !== "vps" && isEmergencyPrivilegedProof\(value\)/);
  assert.match(auth, /verifyCurrentAuthenticationProof[\s\S]*?verifyPrivilegedProof\(env, user, proof, true\)/);
  assert.match(worker, /privilegedAgentReauth[\s\S]*?verifyPrivilegedProof\(env, user, String\(body.proof \|\| ""\), true\)/);
  assert.match(auth, /if \(!\/\^\\d\{4\}\$\/\.test\(value\)\) return/);
});

test("Every account has independently tracked single-use OTP; email remains the existing project recipient", () => {
  assert.match(auth, /const codeHash = await sha256\(\x60\$\{user.user_id\}:\$\{code\}\x60\)/);
  assert.match(auth, /PROJECT_ADMIN_EMAIL,/);
  assert.match(auth, /await sendPrivilegedOneTimeCode\(env, user, true\)/);
  assert.match(read("service/src/privileged-auth-core.ts"), /KEY_PREFIX = "privileged_auth:otp:"/);
  assert.match(auth, /if \(!isPrivilegedOneTimeUser\(user\)\)/);
});

test("Agent and Office fallback gateway allow VPS, without changing admin-exclusive features", () => {
  assert.match(agent, /login == "admin" \|\| login == "tamnv2" \|\| login == "vps"/);
  assert.equal((gateway.match(/\^\(admin\|tamnv2\|vps\)\$/g) || []).length, 2);
  assert.match(agentUi, /VPS chỉ dùng mã một lần/);
  assert.match(worker, /!\["admin","tamnv2"\]\.includes/);
  assert.match(management, /isPrivilegedOneTimeUser\(before\)/);
  assert.match(management, /không được gán mật khẩu cố định/);
});
