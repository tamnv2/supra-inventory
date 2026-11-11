import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workflow=readFileSync(".github/workflows/verify-relay-agent.yml","utf8");
const gate=readFileSync("tools/d173_e187_agent185_release_gate.py","utf8");
const section=workflow.slice(workflow.indexOf("      - name: Publish dedicated Agent prerelease"),workflow.indexOf("\n  d173-e071-utf8-cross-platform:"));
test("E187 repro: Host14 manifest readback must not return before signed Agent185 and channel EXE", () => {
  assert.ok(section.includes("E187_HOST14_MANIFEST_READBACK_PASS"));
  const start=section.indexOf("if ((git log -1 --format=%s) -like 'D173-E187_AGENT185_ONLY_RELEASE:*')");
  const end=section.indexOf("} elseif ((git log -1 --format=%s) -like 'D173-E185_AGENT184",start);
  assert.ok(start>=0 && end>start);
  assert.doesNotMatch(section.slice(start,end),/^\s*return\s*$/m);
  assert.match(section,/gh release create \$tag/);
  assert.match(section,/gh release upload \$channel \$aliasExe \$aliasSha "relay-agent\/dist\/agent-latest.json"/);
});
test("E187 Host14 manifest is checked; historic Host13 readback only applies to older releases",()=>{
  assert.match(section,/E187_HOST14_MANIFEST_READBACK_PASS/);
  assert.match(section,/if \(\(git log -1 --format=%s\) -notlike 'D173-E187_AGENT185_ONLY_RELEASE:\*'\)/);
  assert.match(section,/E153_EXISTING_HOST13_READBACK_PASS/);
});
test("E187 resume gate binds prior source merge and denies out-of-scope changes",()=>{
  assert.match(gate,/RESUME_BASE = "[a-f0-9]{40}"/);
  assert.match(gate,/SOURCE_MERGE = "7ddecb85bc7d96dc3512ed6a0a07031715485a5d"/);
  assert.match(gate,/RUNTIME_OR_D172_CHANGED_AFTER_AGENT185_SOURCE_PASS/);
  assert.match(gate,/RECOVERY_RELEASE_LOGIC_CHANGED_AFTER_CI/);
  assert.match(gate,/PROTECTED_TWO_PARENT_MERGE_AND_MARKER_REQUIRED/);
});
