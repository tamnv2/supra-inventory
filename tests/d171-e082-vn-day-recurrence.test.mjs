import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../service/src/operational-v2-core.ts", import.meta.url), "utf8");

test("recurrence trigger limits links to the same Vietnam business day", () => {
  const trigger = source.split("CREATE TRIGGER trg_v2_batch_recurrence")[1].split("DROP TRIGGER IF EXISTS trg_v2_ticket_insert_version")[0];
  assert.match(trigger, /date\(prior\.resolved_at, '\+7 hours'\) = date\(NEW\.first_report_at, '\+7 hours'\)/);
  assert.match(trigger, /prior\.status IN \('HAS_STOCK','SKIP_ALLOWED'\)/);
});

test("historic cross-day links are retained in data but invisible to current API projections", () => {
  assert.equal((source.match(/LEFT JOIN report_batches p ON p\.batch_id = b\.previous_batch_id[\s\S]{0,110}date\(p\.resolved_at, '\+7 hours'\)/g)||[]).length, 3);
  assert.match(source, /p\.batch_id AS previous_batch_id/);
  assert.match(source, /CASE WHEN EXISTS \(SELECT 1 FROM report_batches prior/);
});

test("recurrence analytics exclude historical cross-day links", () => {
  const segment=source.split("const recurrence = state.storage.sql.exec")[1];
  assert.match(segment, /WHERE b\.previous_batch_id IS NOT NULL[\s\S]*?date\(prior\.resolved_at, '\+7 hours'\)/);
});
