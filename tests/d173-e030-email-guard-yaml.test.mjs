import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("D173 E030 email-sender guard has YAML-valid multiline run indentation", () => {
  const lines = read(".github/workflows/d173-email-sender-guard.yml").split(/\r?\n/);
  let blocks = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "run: |") continue;
    blocks++;
    const parentIndent = lines[i].match(/^ */)[0].length;
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (lines[j].trim() === "") continue;
      const indent = lines[j].match(/^ */)[0].length;
      if (indent <= parentIndent) break;
      assert.ok(indent >= parentIndent + 2, "under-indented multiline run line " + (j + 1));
    }
  }
  assert.ok(blocks >= 2, "expected two source-only multiline commands");
});

test("D173 E030/E109 route regression guard preserves mail/auth bytes and D172 guard", () => {
  const workflow = read(".github/workflows/d173-email-sender-guard.yml");
  assert.match(workflow, /route = "\\n"\.join\(\[/);
  assert.doesNotMatch(workflow, /route='''/);
  assert.match(workflow, /node --test tests\/d172-\*\.test\.mjs/);
  const route = [
    '      if (request.method === "GET" && url.pathname === "/api/agent/d173/reporter-online") {',
    '        // D173: role-limited AGENT token; no arbitrary Web/Android session.',
    '        return authorizedAgentRead(request, env, "reporter-online");',
    '      }',
    "",
    "",
  ].join("\n");
  assert.ok(read("service/src/index.ts").includes(route));
  assert.match(workflow, /python3 tools\/d173_e109_email_preservation_guard\.py --self-test/);
  assert.match(workflow, /github\.head_ref.*docs\/d173-e108-production-do-proposal-20261101/);
  const guard = read("tools/d173_e109_email_preservation_guard.py");
  for (const invariant of ["E109_INDEX_CHANGED_OUTSIDE_EXACT_APPROVED_ROUTING", "E109_JWT_SIGNATURE_SESSION_GUARD_CHANGED",
    "E109_BINDING_SENDER_RESOURCE_CONFIG_DRIFT", "E109_D172_FIREBASE_DRIFT", "E109_CODE_ONLY_BOUNDARY"])
    assert.ok(guard.includes(invariant), invariant);
  assert.ok(guard.includes('"merge_main_permission", "deployment_permission", "provider_write_permission"'));
});
