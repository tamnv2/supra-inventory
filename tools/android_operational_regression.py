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
    launcher = read("android/app/src/main/java/cd/cc/supra/inventory/beta/AdminLauncherController.kt")
    manifest = read("android/app/src/main/AndroidManifest.xml")
    gradle = read("android/app/build.gradle.kts")
    verify_apps = read(".github/workflows/verify-apps.yml")
    fcm_service = read("android/app/src/main/java/cd/cc/supra/inventory/beta/StockMessagingService.kt")
    signal_store = read("android/app/src/main/java/cd/cc/supra/inventory/beta/NotificationSignalStore.kt")
    fcm_worker = read("service/src/fcm.ts")
    notifications_core = read("service/src/notifications-core.ts")
    operational = read("service/src/operational-v2-core.ts")
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

    # F22: launcher actions have distinct targets and Web honors direct hash routes.
    require(launcher, 'openWeb("/#hr"', "HR deep link")
    require(launcher, 'openWeb("/#users"', "users deep link")
    require(launcher, 'openWeb("/#sku"', "SKU deep link")
    require(launcher, 'openWeb("/#sla"', "SLA deep link")
    require(launcher, "onOpenResults", "distinct results route")
    require(main_activity, 'initialFilter = "HAS_STOCK"', "results initial filter")
    require(web, "sectionFromHash()", "Web hash route parser")
    require(web, "resolveInitialSection", "Web direct-route resolver")
    require(web, "canAccessSection", "Web route RBAC")

    print("ANDROID_OPERATIONAL_REGRESSION_PASS")


if __name__ == "__main__":
    main()
