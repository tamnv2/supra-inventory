# ACCEPTANCE_TESTING — Canonical verification and Owner acceptance rules

Status: **CANONICAL PRODUCT SPEC**.

## Evidence levels

1. Source/build PASS — compilation/static checks only.
2. Deploy/runtime smoke PASS — target Beta runtime responded as expected.
3. Signed APK/release PASS — signed artifact was produced/published.
4. Field/device PASS — physical PDA/Web user flow verified in real conditions.
5. Owner business acceptance — only explicit Owner confirmation.

Never collapse these levels into one generic “done”.

## Current field frontier

The last deployed/signed baseline before the current change is `beta-vc30`, schema v5. The Owner has now selected **Practical Balanced / Phương án 1** to supersede Concept 3, together with revised Root/Admin account authority, flexible HR source column mapping, direct managed-password changes and manual Picker lifecycle controls. Until the current branch passes CI/deploy/signing, those changes are **source/spec pending verification**, not runtime PASS.

Physical logged-in PDA FCM delivery and Owner field/business acceptance remain separate pending evidence even after technical build/deploy PASS.

## Regression expectations

After business/UI changes, verify the affected role journey end-to-end and preserve:
- Picker report/search/own-state/60-second withdrawal rules;
- Reporter queue/batch detail/HAS_STOCK/SKIP_ALLOWED/5-minute correction;
- Picker/Reporter workflows remain visually dominant and fast on PDA;
- Root inherits Admin + Reporter and can create/manage Admin and Reporter while remaining protected from subordinate management;
- Admin can manage Reporter; Admin/Root can explicitly open/disable/delete one, many or all Picker accounts;
- HR source accepts configured Mã nhân viên/Họ và tên column names and does not auto-disable/delete absent Pickers or auto-reactivate deliberately disabled Pickers;
- managed Admin/Reporter password maintenance is direct replacement rather than reset-to-default; only Picker provisioning may use the protected runtime default;
- WebSocket authoritative resync;
- no false offline business success;
- Practical Balanced labels/icons/footer remain consistent across Web and Android;
- Stable untouched unless explicitly authorized.

## Load acceptance

Non-destructive CI tests may use declared synthetic tiers. Destructive/mutation load acceptance requires an isolated workload boundary and an Owner-defined operational scale target; do not invent production forecasts.
