# D171-E072 — Production hotfix technical release proof (22 October 2026)

**Scope:** Owner-approved D171-E071 remediation of three post-vc115 Android alert defects. This record is technical release evidence, **not** Owner FIELD PASS.

## Release provenance

- Canonical PR #662 protected non-squash merge: main `c427e629e08c05c38b7c3336a4cdf9441019b967`.
- Frozen exact source with 22/22 GitHub Actions source checks PASS: `a3c781767657e4f3852cc3bfd7be5dda9f57388f`.
- D171 scoped Owner approval receipt pinned exact frozen source, Android versionCode **116**, existing one-Production Worker, Agent v140, Web 3.1.2, unchanged accepted Firestore Rules.
- Main exact-commit GitHub Actions: **15/15 completed SUCCESS**; no failed runs.

## Existing scoped deployment receipts

| Component | Run ID | Outcome |
|---|---:|---|
| Existing Agent Operations Gateway | 39690797251 | SUCCESS |
| Existing Worker / Web / InventoryCore | 39690797553 | SUCCESS |
| Existing Firestore Rules readback | 39690797286 | SUCCESS |
| Existing Agent v140 verification/release | 39690797227 | SUCCESS |
| Signed Android vc116 OTA | 39690797280 | SUCCESS |

- Signed GitHub release: `beta-vc116` built from exact main `c427e629`, 20,055,446-byte APK. Technical beta-tag and APK package/signer were intentionally preserved for OTA compatibility, while user-visible title is **1291 Báo hàng**.
- Existing `inventory-channel` updated to `beta-vc116`; APK aliases `supra-inventory-beta.apk` and `1291-Bao-Hang.apk` each 20,055,446 bytes, plus updated `pda-latest.json`. Release job verified identical packaged alias and asset upload.
- Agent remains version 140 and Web 3.1.2. No new provider, Worker/DO identity change, SQL migration, OAuth redirection, legacy hostname removal or Stable deployment.
- Report-created FCM now resolves exact batch SKU/product, Picker correction uses typed new status, native full-screen fallback and local overlay diagnostics added.
- Deployment proof does **not** certify physical Xiaomi foreground/background/lock-screen behavior, actual vc116 installed fleet, Drive/Gmail physical transactions, WMS/Office field workflows or billed usage optimization.

## Remaining field acceptance

Owner can update two test devices via existing signed OTA to vc116, check Reporter report-created SKU/name, Picker result outside the app with screen on/locked and permission variants, and Reporter correction Skip/Has Stock → PENDING blue state and explicit prior/new status. Capture sanitized `D171_ALERT` journal if OEM denies background popup. Do not infer 100% OS-level forced overlay where Android restrictions prohibit it. After Owner reports PASS/FAIL, maintain D171 acceptance or same-change repair; never automatically promote accepted base D169 or old Stable.

**Release gate:** TECHNICAL RELEASE PASS. **FIELD PASS:** pending. **D171 Owner PASS:** false.
