#!/usr/bin/env python3
"""D156 schedule convergence and Picker reporting-default safety guard."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def require(text: str, marker: str, reason: str) -> None:
    if marker not in text:
        raise SystemExit(f"D156 guard: missing {reason}: {marker}")

def forbid(text: str, marker: str, reason: str) -> None:
    if marker in text:
        raise SystemExit(f"D156 guard: forbidden {reason}: {marker}")

core = read("service/src/core.ts")
business = read("service/src/business-api.ts")
projection = read("service/src/firestore-projection.ts")
users_core = read("service/src/user-management-core.ts")
notifications = read("service/src/notifications-core.ts")
operational = read("service/src/operational-v2-core.ts")
read_model = read("service/src/read-model-core.ts")
web = read("web/src/operational-app.ts")
android_api = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt")
main_activity = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt")
picker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt")
agent_version = read("relay-agent/VERSION").strip()

require(core, "const SCHEMA_VERSION = 16;", "schema16 migration target")
require(core, "shortage_reporting_enabled INTEGER NOT NULL DEFAULT 0", "clean-install reporting default off")
require(core, "d156_reporting_default_off_applied", "one-time existing Picker migration marker")
require(core, "UPDATE users SET shortage_reporting_enabled = 0", "existing Picker default-off migration")
require(core, "scheduleRecoveryInFlight", "single in-flight schedule recovery")
require(core, "this.nextScheduleRecoveryAt = now + 10_000;", "global 10-second exact-read throttle")
require(core, '"/notifications/alert-window/reconcile"', "recovery endpoint")
require(core, '"D156_EXACT_RECOVERY"', "recovery realtime source marker")

require(projection, "readOperatingScheduleProjectionExact", "exact Firestore schedule read")
require(projection, 'documentUrl(env, "relay_poc_coordination", "operating_schedule")', "exact schedule document path")
require(projection, "cachedDatastoreToken", "bounded datastore token reuse")
forbid(projection, "runQuery", "schedule collection query")
forbid(projection, "OperatingScheduleListener", "new schedule listener")

if business.count('"/notifications/alert-window/reconcile"') < 3:
    raise SystemExit("D156 guard: Android mutation, result FCM and Web shift read must all use schedule reconcile")
require(business, "05:45–22:30", "current normal-window copy")

require(web, 'else if (activeSection === "shift" && rolePickPackManage()) await loadShiftOperations();', "Web shift realtime reconcile")
require(read_model, '"PICKPACK_ADMIN"', "Pick Pack Admin realtime role support")
require(read_model, "role:(PICKER|REPORTER|ADMIN|PICKPACK_ADMIN|ROOT)", "Pick Pack Admin realtime tag support")

require(main_activity, "operatingScheduleReceiver", "active Android schedule receiver")
require(main_activity, "ACTION_OPERATING_SCHEDULE_CHANGED", "Android schedule broadcast action")
require(main_activity, "pickerController?.applyOperatingScheduleState(open)", "Android schedule UI application")
require(picker, "private var operatingWindowOpen", "Picker local schedule state")
require(picker, "shortageReportingEnabled && operatingWindowOpen", "Báo hàng button schedule gate")
require(picker, "if (!operatingWindowOpen)", "Báo hàng submit schedule gate")

require(android_api, "val shortageReportingEnabled: Boolean = false", "Android fail-closed reporting default")
require(android_api, 'optBoolean("shortage_reporting_enabled", false)', "Android parser fail-closed reporting default")
require(users_core, "?, NULL, ?, ?, ?, 0, 'PICKER'", "new HR Picker reporting default off")
require(users_core, 'reporting_capability_policy: "PRESERVE_EXISTING__NEW_PICKER_DISABLED_D156"', "HR post-migration preservation policy")
require(notifications, "COALESCE(shortage_reporting_enabled, 0)", "notification eligibility fail closed")
require(operational, "COALESCE(u.shortage_reporting_enabled, 0)", "realtime result eligibility fail closed")

if not agent_version.isdigit() or int(agent_version) < 90:
    raise SystemExit(f"D156 guard: Agent must retain or advance the accepted v90 baseline, got {agent_version!r}")

for text, name in [(core, "core"), (business, "business"), (web, "web"), (main_activity, "Android")]:
    forbid(text, "D156_POLL", f"new D156 polling cadence in {name}")
    forbid(text, "D156_CRON", f"new D156 cron cadence in {name}")

print("D156 schedule convergence/reporting-default guard PASS")
