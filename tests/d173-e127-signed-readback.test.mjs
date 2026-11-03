import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../.github/workflows/d173-e127-postrelease-readback.yml", import.meta.url), "utf8");

test("signed E127 archive diagnosis uses only trusted main release provenance", () => {
  assert.match(s, /workflows: \["Deploy Beta Worker", "Project State Guard"\]/);
  assert.match(s, /workflow_run\.head_branch == 'main'/);
  assert.match(s, /workflow_run\.head_repository\.full_name == github\.repository/);
  assert.match(s, /checkout@v4/);
  assert.match(s, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(s, /D173-E127_DIAGNOSTICS_READBACK:/);
});

test("E127 HMAC input and GET endpoint preserve SQL collector envelope", () => {
  assert.match(s, /D173_SQL_QUERY_ID_AUDIT_V1/);
  assert.match(s, /\/api\/internal\/d173\/sql-evidence/);
  assert.match(s, /x-d173-audit-ts/);
  assert.match(s, /x-d173-audit-hmac/);
  assert.match(s, /\?mode=LOG_ARCHIVE/);
  assert.match(s, /hmac\.new\(token\.encode\(\), payload, hashlib\.sha256\)/);
  assert.match(s, /"curl", "--silent", "--show-error"/);
  assert.doesNotMatch(s, /urllib\.request/);
});

test("E127 logs only status categories and aggregates, not HTTP response or credentials", () => {
  assert.match(s, /D173_E127_SIGNED_READBACK_HTTP_/);
  assert.match(s, /D173_SQL_AUDIT_FORBIDDEN/);
  assert.match(s, /category = error if error in known else "UNCLASSIFIED"/);
  assert.match(s, /D173_E127_BUFFER_/);
  assert.doesNotMatch(s, /print\(raw\)|print\(token\)|print\(mac\)|print\(executed\.stderr\)/);
});
