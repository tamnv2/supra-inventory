import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const inventory = read("service/src/core.ts");
const obpp = read("service/src/obpp1291-core.ts");

test("D172-E059: a v9 database without the v10 journal cannot take the D173 E097 fast-path", () => {
  const ready = inventory.slice(
    inventory.indexOf("private isExistingSchemaReady()"),
    inventory.indexOf("private initializeSchema()")
  );
  const definitions = ready.match(/const requiredObjects:[\s\S]*?const objects = new Set/);
  assert.ok(definitions, "Required table/index readiness list must be present");
  const required = [...definitions[0].matchAll(/\["(table|index)",\s*"([^"]+)"\]/g)]
    .map(([,type,name]) => type + ":" + name);
  for (const object of [
    "table:obpp_sessions","table:obpp_records","table:obpp_record_changes",
    "index:obpp_pending_idx","index:obpp_records_page_idx"
  ]) assert.ok(required.includes(object), object + " must be required");
  const v9 = new Set(required.filter(object =>
    object !== "table:obpp_record_changes" && object !== "index:obpp_records_page_idx"));
  assert.ok(required.some(object => !v9.has(object)), "v9 readiness must fail");
  assert.match(ready, /requiredObjects\.some\(\(\[type, name\]\) => !objects\.has/);
});

test("D172-E059: the fail-closed initializer creates the missing isolated journal and index", () => {
  const init = inventory.slice(inventory.indexOf("private initializeSchema()"));
  assert.match(init, /if \(this\.isExistingSchemaReady\(\)\) return/);
  assert.match(init, /initializeObppSchema\(this\.state\)/);
  assert.match(obpp, /CREATE TABLE IF NOT EXISTS obpp_record_changes/);
  assert.match(obpp, /CREATE INDEX IF NOT EXISTS obpp_records_page_idx/);
  assert.match(obpp, /SELECT COALESCE\(MAX\(seq\),0\) AS seq FROM obpp_record_changes/);
  assert.match(obpp, /path==="\/obpp1291\/records" && method==="GET"/);
});

test("D172-E059: no destructive D172 history migration", () => {
  const init = obpp.slice(obpp.indexOf("export function initializeObppSchema"),
    obpp.indexOf("export async function handleObppCoreRequest"));
  assert.doesNotMatch(init, /DROP TABLE\s+obpp_record_changes|DELETE FROM obpp_record_changes/);
  assert.match(init, /CREATE TABLE IF NOT EXISTS obpp_record_changes/);
});
