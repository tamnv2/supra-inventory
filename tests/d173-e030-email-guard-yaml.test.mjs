import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(p, "utf8");

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

test("D173 E030 route regression guard preserves exact Worker bytes and D172 guard", () => {
  const workflow = read(".github/workflows/d173-email-sender-guard.yml");
  assert.match(workflow, /route = "\\n"\.join\(\[/);
  assert.doesNotMatch(workflow, /route='''/);
  assert.match(workflow, /node --test tests\/d172-\*\.test\.mjs/);
  const route = [
    '      if (request.method === "GET" && url.pathname === "/api/agent/d173/reporter-online") {',
    '        // D173: role-limited AGENT token; no arbitrary Web/Android session.',
    '        await requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"]);',
    '        return coreStub(env).fetch("https://inventory-core.internal/read/realtime/agent-reporters");',
    '      }',
    "",
    "",
  ].join("\n");
  assert.ok(read("service/src/index.ts").includes(route));
});
