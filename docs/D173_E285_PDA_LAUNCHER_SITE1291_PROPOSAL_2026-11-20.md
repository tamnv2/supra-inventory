# D173-E285 — Site 1291 PDA Launcher proposal (2026-11-20)

Scope: **document proposal only**. Owner requested a concise standalone Word proposal based on the separately owned `tamnv2/supra-pda-launcher` project and operational concerns at Site 1291.

Verified source (read only): Launcher main README and docs/PROJECT_BASELINE.md show a custom HOME launcher, per-device allowed app list, admin password and Accessibility guard; docs/LAUNCHER_325_FOUNDATION_UPDATE_LOGS.md and DeviceIdentifier.java/DeviceRegistryClient.java show device registry and serial/MEID identification approaches. Launcher does **not** have Android Device Owner authority, so app-install and system-settings prohibition cannot be claimed without further device/ROM management assessment.

Delivered locally: one-page Word proposal `De_xuat_Launcher_quan_ly_PDA_Site_1291.docx` (chat attachment only). Proposal covers inappropriate PDA app use, commercial launcher cost/ads and limited Site configurability, custom Launcher app/allowlist, optional employee-code scan before operations app launch, identifier association, usage records sent to a **proposed** Site 1291 Pick Pack operations Web/CCDC/PDA management model, and appropriate test/approval gates.

**No software implementation, backend integration, security permission change, Launcher repo mutation, release, cross-project data sharing or Owner acceptance** was authorized or performed. D172 independent PENDING/HOLD; Stable OWNER-GATED. Source repository `tamnv2/supra-pda-launcher` was read only.
