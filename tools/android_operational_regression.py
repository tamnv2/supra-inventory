#!/usr/bin/env python3
"""Regression guards for Android operational P1 contracts."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def fail(message: str) -> None:
    raise SystemExit(f"ANDROID_OPERATIONAL_REGRESSION_FAIL: {message}")


def require(text: str, marker: str, name: str) -> None:
    if marker not in text:
        fail(f"missing {name}: {marker}")


def forbid(text: str, marker: str, name: str) -> None:
    if marker in text:
        fail(f"forbidden {name}: {marker}")


def main() -> None:
    picker = read("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt")
    reporter = read("android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt")
    keyed = read("android/app/src/main/java/cd/cc/supra/inventory/beta/KeyedLinearRenderer.kt")
    cache = read("android/app/src/main/java/cd/cc/supra/inventory/beta/SkuCatalogCache.kt")
    main_activity = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt")
    relay = read("android/app/src/main/java/cd/cc/supra/inventory/beta/RelayPocClient.kt")
    picker_layout = read("android/app/src/main/res/layout/view_picker.xml")
    relay_agent = read("relay-agent/Program.cs")
    relay_agent_config = read("relay-agent/AgentConfig.cs")
    relay_agent_updater = read("relay-agent/AgentUpdater.cs")
    relay_agent_workflow = read(".github/workflows/verify-relay-agent.yml")
    relay_rules = read("firebase/database.rules.json")
    service_index = read("service/src/index.ts")
    inventory_api = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt")
    launcher = read("android/app/src/main/java/cd/cc/supra/inventory/beta/AdminLauncherController.kt")
    manifest = read("android/app/src/main/AndroidManifest.xml")
    gradle = read("android/app/build.gradle.kts")
    verify_apps = read(".github/workflows/verify-apps.yml")
    fcm_service = read("android/app/src/main/java/cd/cc/supra/inventory/beta/StockMessagingService.kt")
    signal_store = read("android/app/src/main/java/cd/cc/supra/inventory/beta/NotificationSignalStore.kt")
    fcm_worker = read("service/src/fcm.ts")
    notifications_core = read("service/src/notifications-core.ts")
    operational = read("service/src/operational-v2-core.ts")
    sla_auto = read("service/src/sla-automation.ts")
    web = read("web/src/operational-app.ts")

    # F09/F11: lifecycle-safe keyed rendering and single-tap withdrawal.
    require(keyed, "class KeyedLinearRenderer", "keyed list renderer")
    require(picker, "historyRenderer", "Picker keyed history")
    require(reporter, "listRenderer", "Reporter keyed list")
    require(picker, "setOnClickListener { confirmWithdraw(row) }", "single-tap withdrawal confirmation")
    forbid(picker, "setOnLongClickListener { confirmWithdraw(row)", "long-press withdrawal")

    # F10: RECEIVED and DISPLAYED are separate; DISPLAYED occurs only after dialog show.
    require(picker, 'api.markResultStage(result.resultEventId, "RECEIVED")', "Picker RECEIVED stage")
    require(picker, "dialog.setOnShowListener", "result visible hook")
    require(picker, 'api.markResultStage(result.resultEventId, "DISPLAYED")', "Picker DISPLAYED stage")
    forbid(picker, 'api.markResultStage(result.resultEventId, "RECEIVED")\n                    api.markResultStage(result.resultEventId, "DISPLAYED")', "eager DISPLAYED after fetch")

    # F13: SQLite staging protects the previous valid catalog.
    require(cache, "SQLiteOpenHelper", "SQLite catalog")
    require(cache, "catalog_stage", "catalog staging table")
    require(cache, "prepareStage(copyCurrent = true)", "delta staging")
    require(cache, "commitStage(info)", "atomic catalog promotion")
    require(cache, "Master SKU thay đổi trong lúc đồng bộ. Cache cũ được giữ nguyên.", "mid-sync authority verification")
    forbid(cache, 'private val cacheFile = File(', "TSV authoritative cache")

    # F12: data-only FCM reaches FirebaseMessagingService and keeps event correlation.
    require(manifest, 'android:name=".StockMessagingService"', "Firebase messaging service manifest")
    require(fcm_service, "class StockMessagingService : FirebaseMessagingService()", "Firebase messaging service")
    require(fcm_service, "NotificationSignalStore.markMessage", "FCM local correlation signal")
    require(signal_store, "pending_result_events", "pending result receipt store")
    require(fcm_worker, "notification_title", "data-only notification title")
    require(fcm_worker, "notification_body", "data-only notification body")
    forbid(fcm_worker, "notification: { title: message.title, body: message.body }", "system notification payload bypassing service")
    require(notifications_core, "notification_delivery_attempts", "delivery attempt persistence")
    require(notifications_core, "/notifications/disable-tokens", "invalid token disable route")
    require(fcm_worker, "UNREGISTERED", "FCM invalid-token classification")
    require(operational, "notification_delivery_attempts", "delivery attempt schema readiness")

    # F21: fail-closed OTA identity and channel verification.
    require(gradle, '"TRUSTED_SIGNER_SHA256"', "trusted signer BuildConfig")
    require(verify_apps, "BETA_SIGNER_SHA256", "release signer derivation")
    require(main_activity, "verifyInstalledSignerTrusted()", "installed signer verification")
    require(main_activity, "verifyDownloadedApk(temp, info)", "downloaded APK identity verification")
    require(main_activity, "archive.packageName != BuildConfig.APPLICATION_ID", "package verification")
    require(main_activity, "archive.longVersionCode != info.versionCode.toLong()", "versionCode verification")
    require(main_activity, 'info.tag != "beta-vc${info.versionCode}"', "Beta channel tag verification")
    require(main_activity, "expectedSigner !in archiveSigners", "downloaded signer verification")
    require(main_activity, "validateUpdateUrl", "trusted update URL verification")
    require(main_activity, "info.versionCode == BuildConfig.VERSION_CODE", "exact latest-version login gate")
    require(main_activity, "info.versionCode < BuildConfig.VERSION_CODE", "unexpected ahead-of-channel fail closed")

    # D060: Android refreshes the server-authoritative effective role on resume.
    require(inventory_api, "fun refreshProfile(): AppSession", "effective-role profile refresh API")
    require(inventory_api, '"/api/auth/me"', "effective-role profile endpoint")
    require(main_activity, "private fun syncEffectiveRole()", "effective-role resume sync")
    require(main_activity, "api.refreshProfile()", "effective-role server refresh")
    require(main_activity, "if (roleChanged || identityChanged || activeSession == null)", "role-change rerender")

    # D075: shared Picker queue + real ADMIN Agent identity + dedicated Agent auto-update.
    require(relay, '.addPathSegment("relay_poc")', "D075 shared relay root")
    require(relay, '.addPathSegment("jobs")', "D075 shared jobs collection")
    forbid(relay, ".addPathSegment(firebaseUid)", "D075 per-Firebase-UID relay branch")
    require(relay, '.put("picker_uid", identity.uid)', "D075 Picker Firebase identity")
    require(relay, '.put("picker_user_id", session.userId)', "D075 Picker application identity")
    require(relay, "agentAdminUserId", "D075 ADMIN ACK identity")
    require(picker_layout, '@+id/panelShortage', "D074/D075 shortage panel")
    require(picker_layout, '@+id/panelConfirmOrder', "D074/D075 confirmation panel")
    require(picker_layout, '@+id/tabShortage', "D074/D075 shortage bottom tab")
    require(picker_layout, '@+id/tabConfirmOrder', "D074/D075 confirmation bottom tab")
    require(picker_layout, 'android:maxLength="5"', "D074/D075 five digit input cap")
    require(picker, "digits.length == 5", "D074/D075 send enabled exactly at five digits")
    require(picker, "result.agentAdminUserId", "D075 Picker shows ADMIN Agent identity")
    require(relay_agent, 'string.Equals(role, "ADMIN"', "D075 Agent effective ADMIN gate")
    require(relay_agent, 'string.Equals(baseRole, "ADMIN"', "D075 Agent immutable base ADMIN gate")
    require(relay_agent, '"agent_admin_user_id"', "D075 Agent ADMIN ACK metadata")
    require(relay_agent, '"agent_instance_id"', "D075 persistent Agent instance metadata")
    require(relay_agent, '"/relay_poc/jobs.json?auth="', "D075 shared Agent collection")
    require(relay_agent, "JobAlreadyAcknowledgedByAnotherAgent", "D075 first-writer ACK ownership")
    require(relay_agent, "LoadOrCreateAgentInstanceId", "D075 persistent Agent instance id")
    require(relay_agent, "ClearStoredSession", "D075 old non-ADMIN session invalidation")
    require(service_index, "app_base_role: user.base_role", "D075 immutable base-role Firebase custom claim")
    require(relay_rules, "auth.token.app_base_role == 'ADMIN'", "D075 real ADMIN RTDB rule")
    require(relay_rules, "newData.child('agent_admin_user_id').val() == auth.token.app_user_id", "D075 ADMIN ACK rule binding")
    require(relay_agent_config, "AgentBuild = 2", "D075 Agent build channel")
    require(relay_agent_updater, "CheckAndInstallIfNeeded", "D075 automatic Agent updater")
    require(relay_agent_updater, "Sha256", "D075 Agent SHA-256 verification")
    require(relay_agent_updater, "release-assets.githubusercontent.com", "D075 trusted GitHub CDN update guard")
    require(relay_agent_workflow, "--prerelease", "D075 dedicated Agent prerelease")
    require(relay_agent_workflow, "relay-agent-v$version", "D075 Agent prerelease tag")
    forbid(relay_agent, 'Log("ACK " + suffix', "D075 raw Picklist suffix in Agent log")

    # F22: launcher actions have distinct targets and Web honors direct hash routes.
    require(launcher, 'openWeb("/#hr"', "HR deep link")
    require(launcher, 'openWeb("/#users"', "users deep link")
    require(launcher, 'openWeb("/#sku"', "SKU deep link")
    require(launcher, 'openWeb("/#sla"', "SLA deep link")

    # D070: Android receives exact timeout state/results without gaining resolve authority.
    require(inventory_api, "autoSkipDeadlineAt", "D070 Picker automatic deadline projection")
    require(inventory_api, "autoSkipAllowedAt", "D070 Picker automatic result projection")
    require(inventory_api, "autoSkipAt", "D070 Reporter next automatic deadline projection")
    require(picker, "Hệ thống tự động do quá hạn", "D070 Picker timeout source copy")
    require(reporter, "Tự động bỏ qua", "D070 Reporter timeout timing copy")
    require(sla_auto, "PER_PICKER", "D070 per-Picker service mode")
    require(sla_auto, "FIRST_REPORT", "D070 first-report service mode")
    require(launcher, "onOpenResults", "distinct results route")
    require(main_activity, 'initialFilter = "HAS_STOCK"', "results initial filter")
    require(web, "sectionFromHash()", "Web hash route parser")
    require(web, "resolveInitialSection", "Web direct-route resolver")
    require(web, "canAccessSection", "Web route RBAC")

    print("ANDROID_OPERATIONAL_REGRESSION_PASS")


if __name__ == "__main__":
    main()
