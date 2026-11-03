import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const core = readFileSync(new URL("../service/src/core.ts", import.meta.url), "utf8");
const realtime = readFileSync(new URL("../service/src/read-model-core.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../web/src/api.ts", import.meta.url), "utf8");
const android = readFileSync(new URL("../android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt", import.meta.url), "utf8");

test("E128 new tickets disable E110 business WebSocket commands without disabling realtime", () => {
  assert.match(core, /const D173_E128_LEGACY_HTTP_OPERATIONS = true;/);
  assert.match(core, /command_protocol_disabled: D173_E128_LEGACY_HTTP_OPERATIONS \|\| this\.env\.D173_COMMAND_TRANSPORT_DISABLED === "1"/);
  assert.match(realtime, /!body\.command_protocol_disabled/);
  assert.match(realtime, /capabilities: \{ protocol: D173_COMMAND_PROTOCOL/);
});

test("E128 existing sockets do not execute business commands after Worker rollout", () => {
  assert.match(core, /!D173_E128_LEGACY_HTTP_OPERATIONS && this\.env\.D173_COMMAND_TRANSPORT_DISABLED !== "1"/);
  assert.match(core, /async webSocketMessage\(ws: WebSocket/);
  assert.match(realtime, /\/realtime\/ticket/);
});

test("E128 E123 and both legacy HTTP paths remain available", () => {
  assert.match(core, /d173PickerShiftIsExpired/);
  assert.match(core, /picker_shift_logout_at_ms: d173PickerShiftLogoutAtMs/);
  assert.match(client, /fetch\(\x60\x24\{API_BASE_URL\}\x24\{path\}\x60/);
  assert.match(android, /private fun execute\(method: String, path: String/);
});
