import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
const base="935a3e1b09a6753adac207ca81f4d09978567cdf";
const path="service/src/operational-v2-core.ts";
const old=execFileSync("git",["show",base+":"+path],{encoding:"utf8"});
const now=readFileSync(path,"utf8");
function sql(source,clause){
  const at=source.indexOf('d166MeasuredSqlRows<SqlRow>(state, "RECENT_ACK_TOTALS",');
  assert.ok(at>=0,"ACK query ID must exist");
  const query=source.slice(at).match(/`([\s\S]*?)`/);
  assert.ok(query,"ACK template must exist");
  return query[1].replaceAll("${summaryClause}",clause);
}
const db=new DatabaseSync(":memory:");
db.exec("CREATE TABLE report_batches(batch_id TEXT PRIMARY KEY,version INT,status TEXT,first_report_at TEXT);");
db.exec("CREATE TABLE batch_summaries(batch_id TEXT PRIMARY KEY,ack_target_count INT,acknowledged_count INT);");
db.exec("CREATE TABLE result_acknowledgements(batch_id TEXT,batch_version INT,target_user_id TEXT,acknowledged_at TEXT,displayed_at TEXT);");
db.exec("CREATE INDEX idx_ack_version ON result_acknowledgements(batch_id,batch_version);");
const b=db.prepare("INSERT INTO report_batches VALUES(?,?,?,?)");
const s=db.prepare("INSERT INTO batch_summaries VALUES(?,?,?)");
const a=db.prepare("INSERT INTO result_acknowledgements VALUES(?,?,?,?,?)");
b.run("a",1,"HAS_STOCK","2026-11-02T10:00:00Z");s.run("a",2,1);
b.run("b",2,"SKIP_ALLOWED","2026-11-02T12:00:00Z");s.run("b",1,1);
b.run("c",3,"CLOSED","2026-11-01T12:00:00Z");s.run("c",0,0);
b.run("d",1,"PENDING","2026-11-02T09:00:00Z");s.run("d",1,1);
b.run("e",1,"HAS_STOCK","2026-10-25T00:00:00Z");
for(const values of [[
  "a",1,"p1","ack","display"],["a",1,"p2",null,null],["a",1,"p1","ack","display"],
  ["a",0,"legacy","ack","display"],["b",2,"p3","ack",null],["b",1,"old",null,"display"],
  ["c",3,"p4",null,null],["e",1,"p5",null,"display"]])a.run(...values);
const clauses=[
  "b.status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED')",
  "b.status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED') AND b.first_report_at >= '2026-11-02T00:00:00Z'",
  "b.status = 'HAS_STOCK'",
  "b.status IN ('HAS_STOCK','SKIP_ALLOWED') AND b.first_report_at < '2026-10-25T00:00:00Z'",
];
for(const clause of clauses){
  const before=db.prepare(sql(old,clause)).get();
  const after=db.prepare(sql(now,clause)).get();
  assert.deepEqual(after,before,"ACK SQL parity failure: "+clause);
}
console.log("D173_E123_SQL_ACK_PARITY_PASS",clauses.length);
