#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def require(text: str, marker: str, reason: str) -> None:
    if marker not in text:
        raise SystemExit(f"D155 guard: missing {reason}: {marker}")

def forbid(text: str, marker: str, reason: str) -> None:
    if marker in text:
        raise SystemExit(f"D155 guard: forbidden {reason}: {marker}")

core = read("service/src/core.ts")
users_api = read("service/src/user-management-api.ts")
users_core = read("service/src/user-management-core.ts")
business = read("service/src/business-api.ts")
read_model = read("service/src/read-model-core.ts")
notifications = read("service/src/notifications-core.ts")
projection = read("service/src/firestore-projection.ts")
android_rt = read("android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidRealtimeClient.kt")
android_api = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt")
picker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt")
agent_presence = read("relay-agent/FirestorePickerPresence.cs")
agent_sync = read("relay-agent/FirestoreAgentSync.cs")
agent_ui = read("relay-agent/D119AgentFeatures.cs")
web = read("web/src/operational-app.ts")

require(core, "const SCHEMA_VERSION = 15;", "additive schema target")
require(core, "shortage_reporting_enabled INTEGER NOT NULL DEFAULT 1", "default enabled Picker capability")
require(core, "contractor_name TEXT", "Picker contractor storage")
require(users_core, '"REPORTING_ENABLE" | "REPORTING_DISABLE"', "bulk reporting actions")
require(users_core, '["ADMIN","PICKPACK_ADMIN","ROOT"]', "reporting toggle authority")
require(users_core, 'reporting_capability_policy: "PRESERVE_EXISTING__NEW_PICKER_ENABLED"', "HR capability preservation")
require(business, "PICKER_SHORTAGE_REPORTING_DISABLED", "server shortage mutation guard")
require(read_model, "directPickerReportingControl", "targeted Cloudflare realtime control")
require(read_model, "picker_reporting_disabled", "Cloudflare reporting disable frame")
require(android_rt, "directCapabilityControl", "PDA direct capability control handling")
require(android_api, "applyShortageReportingCapability", "PDA local capability update")
require(picker, "if (!shortageReportingEnabled)", "disabled Picker workflow gate")
require(picker, "Xác nhận đơn vẫn sử dụng bình thường", "non-shortage continuity copy")
require(web, 'data-picker-action="REPORTING_ENABLE"', "Web reporting enable bulk action")
require(web, 'data-picker-action="REPORTING_DISABLE"', "Web reporting disable bulk action")

# D155 Báo hàng capability must not leak into Firestore/RTDB transport code.
for path in [
    "service/src/firestore-projection.ts",
    "android/app/src/main/java/cd/cc/supra/inventory/beta/RelayPocClient.kt",
    "relay-agent/FirestorePickerPresence.cs",
    "relay-agent/FirestoreAgentSync.cs",
]:
    text = read(path)
    for marker in ["shortage_reporting_enabled", "picker_reporting_enabled", "picker_reporting_disabled"]:
        forbid(text, marker, f"Báo hàng capability in provider/Agent transport ({path})")

# Reporting bulk toggle must never invoke the existing Firestore Picker projection refresh.
start = users_api.find('if (key === "POST /api/admin/pickers/bulk")')
end = users_api.find('if (key === "PUT /api/admin/hr-source-v2")', start)
if start < 0 or end < 0:
    raise SystemExit("D155 guard: unable to isolate Picker bulk API block")
bulk_block = users_api[start:end]
require(bulk_block, "if (reportingAction)", "reporting-action split")
require(bulk_block, "broadcastPickerReportingCapability", "Cloudflare direct broadcast")
reporting_branch = bulk_block[bulk_block.find("if (reportingAction)"):bulk_block.find("} else {")]
forbid(reporting_branch, "refreshPickerProjectionBestEffort", "Firestore projection refresh on Báo hàng toggle")

# Contractor may ride an existing Agent projection but HR contractor-only changes must not
# invalidate D153 semantic presence and therefore must not force a Firestore write.
sig_start = notifications.find("async function d153PickerPresenceSemanticSignature")
sig_end = notifications.find("function d153ValidSignature", sig_start)
if sig_start < 0 or sig_end < 0:
    raise SystemExit("D155 guard: unable to isolate D153 Picker presence semantic signature")
sig_block = notifications[sig_start:sig_end]
forbid(sig_block, "contractor_name", "contractor as Firestore presence semantic trigger")
require(projection, "contractor_name: String(item.contractor_name || "")", "contractor piggyback in existing projection")
require(agent_presence, 'ReadString(itemFields, "contractor_name")', "Agent contractor presence read")
require(agent_sync, '"contractor_name"', "Agent contractor sync preservation")
require(agent_ui, 'HeaderText = "Nhà thầu"', "Agent contractor column")

# Unsequenced direct capability frames must be applied without delta dirty-recovery.
rt_start = android_rt.find("private fun handleInvalidate")
rt_end = android_rt.find("private fun readScopes", rt_start)
if rt_start < 0 or rt_end < 0:
    raise SystemExit("D155 guard: unable to isolate Android realtime invalidate handler")
rt_block = android_rt[rt_start:rt_end]
require(rt_block, "if (directCapabilityControl)", "direct capability fast path")
direct_pos = rt_block.find("if (directCapabilityControl)")
dirty_pos = rt_block.find('scheduleDirtyRecovery("unsequenced_event")')
if direct_pos < 0 or dirty_pos < 0 or direct_pos > dirty_pos:
    raise SystemExit("D155 guard: direct capability path must precede unsequenced dirty recovery")

# Agent payload may grow, but cadence is unchanged: no new D155 polling/listener symbols.
for text, name in [(agent_presence, "Agent presence"), (agent_sync, "Agent sync")]:
    for marker in ["D155_POLL", "D155_LISTENER", "ContractorPoll", "ContractorListener"]:
        forbid(text, marker, f"new contractor cadence in {name}")

version = read("relay-agent/VERSION").strip()
if version != "89":
    raise SystemExit(f"D155 guard: relay-agent/VERSION must be 89, got {version!r}")

print("D155 contractor/reporting Cloudflare-only quota guard PASS")
