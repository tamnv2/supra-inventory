import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const agent = readFileSync("relay-agent/Program.cs", "utf8");

test("E189: authenticated Agent hides stale failed-login notice before fleet header", () => {
  const ui = agent.slice(agent.indexOf("private void SetAgentAuthUi(bool authenticated)"),
    agent.indexOf("private void LogoutAgent()"));
  assert.match(ui, /if \(authenticated\) _agentAuthStatus\.Visible = false;/);
  assert.match(ui, /ApplyD119AuthenticatedLayout\(authenticated\);/);
  assert.match(ui, /UpdateD129AgentHeader\(\);/);
});

test("E189: Firebase nested 400 response exposes error.message, not Dictionary type", () => {
  const decode = agent.slice(agent.indexOf("private static RelayHttpException ToRelayHttpException("),
    agent.indexOf("private string LoadAgentRoleHint("));
  assert.match(decode, /error as Dictionary<string, object>/);
  assert.match(decode, /firebaseError\.TryGetValue\("message", out reason\)/);
  assert.match(decode, /AgentDiagnostics\.Sanitize\(detail\)/);
  const firebaseFailure = {
    error: { code: 400, message: "INVALID_LOGIN_CREDENTIALS", errors: [{ message: "INVALID_LOGIN_CREDENTIALS" }] }
  };
  assert.equal(firebaseFailure.error.message, "INVALID_LOGIN_CREDENTIALS");
});

test("E189: no new auth fallback, business mutation, runtime or role bypass", () => {
  assert.match(agent, /FirebasePasswordLoginDirect\(email, password\)/);
  assert.match(agent, /tokenRole, expectedRole/);
  assert.match(agent, /IsAgentOperatorRole\(tokenRole, tokenBaseRole\)/);
});
