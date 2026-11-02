import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/d173-email-sender-guard.yml", import.meta.url), "utf8");
const lines = workflow.split(/\r?\n/);

// E116 supersedes the historical branch-specific E030/E109 CI YAML fixtures.
// Runtime E005/E010 and D172 guards remain in their own owner-gated workflows.
test("D173 E116: every multiline YAML run step is correctly indented", () => {
  let blocks = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "run: |") continue;
    blocks++;
    const parentIndent = (lines[i].match(/^ */) || [""])[0].length;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      const indent = (lines[j].match(/^ */) || [""])[0].length;
      if (indent <= parentIndent) break;
      assert.ok(indent >= parentIndent + 2, "bad multiline run indentation line " + (j + 1));
    }
  }
  assert.ok(blocks >= 2, "expected source-only multiline test steps");
});

test("D173 E116: pull request, main push and manual run must be real GitHub Actions events", () => {
  assert.match(workflow, /^on:\n  pull_request:/m);
  assert.match(workflow, /^  push:\n    branches:\n      - main/m);
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.match(workflow, /^jobs:\n  source-only:/m);
  assert.match(workflow, /\.github\/workflows\/d173-email-sender-guard\.yml/);
});

test("D173 E116: workflow is strictly source-only and protects four templates + D172", () => {
  assert.match(workflow, /^permissions:\n  contents: read/m);
  assert.match(workflow, /node --test tests\/d173-no-reply-otp\.test\.mjs/);
  assert.match(workflow, /node --experimental-strip-types --test tests\/d173-e005-email-runtime\.test\.mjs/);
  assert.match(workflow, /node --test tests\/d172-\*\.test\.mjs/);
  assert.match(workflow, /npm run typecheck/);
  assert.doesNotMatch(workflow, /\b(?:secrets\.|vars\.|environment:|id-token: write|wrangler deploy|firebase deploy|gh release|curl .*sending\/send)\b/i);
  assert.doesNotMatch(workflow, /github\.head_ref|d173_email_activate_gate\.py|d173_email_release_gate\.py/);
  assert.match(workflow, /NO_PRODUCTION_DEPLOY_OR_REAL_EMAIL/);
});
