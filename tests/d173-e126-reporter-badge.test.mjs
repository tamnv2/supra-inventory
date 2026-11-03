import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const ui = read("android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt");
const api = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt");
const core = read("service/src/d173-snapshot-core.ts");
const initial = () => ({ epoch: "", seq: 0, known: false, count: 0 });
function adopt(s, epoch, seq, absolute) {
  if (s.epoch !== epoch) { s.epoch=epoch; s.seq=seq; }
  else s.seq=Math.max(s.seq,seq);
  s.known=true; s.count=absolute;
}
function delta(s, seq, value) {
  if (!s.known) return false;
  if (seq<=s.seq) return true; // duplicate/out-of-order must not be applied
  s.seq=seq; s.count+=value; return true;
}
test("E126 Reporter local badge fence: no replay after authoritative combined snapshot", () => {
 const s=initial();adopt(s,"epoch-a",42949,2);delta(s,42949,2);delta(s,42947,-1);
 assert.equal(s.count,2);delta(s,42950,1);delta(s,42950,1);assert.equal(s.count,3);
});
test("E126: epoch rotation resets local sequence and count from server; stale lazy view is discarded", () => {
 const s=initial();adopt(s,"epoch-a",600,6);const lazy={epoch:s.epoch,seq:s.seq};
 adopt(s,"epoch-b",3,1);assert.equal(s.seq,3);assert.equal(s.count,1);
 assert.notEqual(lazy.epoch,s.epoch);delta(s,4,1);assert.equal(s.count,2);
});
test("E126 no model cursor authority leak: Android global ACK remains on applied delta path", () => {
 assert.match(api,/val latestSeq: Long, val streamEpoch: String/);
 assert.match(api,/latestSeq = revision\.optLong\("latest_seq", 0L\)/);
 assert.match(ui,/if \(combined != null\) adoptReporterBaseline\(combined\)/);
 assert.match(ui,/private fun adoptReporterBaseline\(model: D173ReporterReadModel\)/);
 assert.match(ui,/lastReporterEventSeq = maxOf\(lastReporterEventSeq, model.latestSeq\)/);
 assert.match(ui,/if \(!reporterBaselineKnown\) return false/);
 assert.match(ui,/adoptReporterBaseline\(model\)/);
 assert.match(ui,/realtimeRevision\+\+ \/\/ Mutation model invalidates/);
 assert.match(ui,/revisionAtStart != realtimeRevision \|\| baselineAtStart != lastReporterEventSeq/);
 assert.match(core,/cursor_authority: false/);
 assert.doesNotMatch(ui,/saveApplied\(/);
});
