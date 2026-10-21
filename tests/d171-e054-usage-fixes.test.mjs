import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("D171 E054 server-created request-age guard", () => {
  const agent = read("relay-agent/D160ConfirmPipeline.cs");
  const p = agent.split("private static long D160RequestAgeMs(")[1].split("private static bool D160CanStartMutation(")[0];
  assert.ok(p.includes("work.CreatedAtMs"));
  assert.ok(!p.includes("work.ClientSentAtMs > 0"));
  assert.ok(agent.includes("29000L : 12000L"));
  assert.ok(read("firebase/firestore.rules").includes("request.resource.data.created_at == request.time"));
});

test("D171 E054 terminal result receipt is account scoped", () => {
  const ui = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
  const store = read("android/app/src/main/java/cd/cc/supra/inventory/beta/NotificationSignalStore.kt");
  assert.ok(ui.includes("quarantineResultReceipt("));
  assert.ok(ui.includes('error.code == "RESULT_ACK_NOT_FOUND"'));
  assert.ok(ui.includes("api.session?.userId != owner.userId"));
  assert.ok(store.includes('scopedAckKey(userId, "received_terminal_404")'));
  assert.ok(ui.includes("api.acknowledgeResult(eventId)"));
});

test("D171 E054 Reporter in-flight counters are not reused across accounts", () => {
  const api = read("web/src/api.ts");
  assert.ok(api.includes("existing.owner === owner && existing.path === path"));
  assert.ok(api.includes("reporterCountersInFlight?.promise === pending"));
});
