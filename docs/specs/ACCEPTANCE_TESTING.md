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

The current proven technical Beta baseline is `beta-vc34`, schema v5. PR #10 passed authority, continuity and Practical Balanced source/build guards; merged source is `c056e842467b2b9e03f6a03e3de4187991361200`. Post-merge Project State Guard, Repo Authority Guard, UI Design Guard and Beta Worker deploy passed, and signed `beta-vc34` was published with versionCode 34, APK SHA-256 `80708e58281b67256f6f7a69e5c4ed9aa9dfaafef4b053657a5c68ae77feda52`, size `9185074` bytes. The Owner-approved compact `BÁO HÀNG 1291` header, Picker one-row SKU entry/today status cards, Reporter four-state tabs/equal actions and real `CLOSED` withdrawal batches are therefore technical source/build/deploy/sign/release PASS.

Physical logged-in PDA FCM delivery and Owner field/business acceptance remain separate pending evidence even after technical build/deploy PASS.

## Regression expectations

After business/UI changes, verify the affected role journey end-to-end and preserve:
- Picker report/search/own-state/60-second withdrawal rules;
- Reporter queue/batch detail/HAS_STOCK/SKIP_ALLOWED/5-minute correction;
- Picker/Reporter workflows remain visually dominant and fast on PDA;
- approved Android operational header shows `BÁO HÀNG 1291`, identity, `Log`, `Thoát`, role and compact Beta build state without restoring a large diagnostic/identity block;
- Picker entry is one compact row with `Nhập tối thiểu 3 số SKU vào đây` + `BÁO HẾT HÀNG`, followed directly by `Lịch sử báo hàng hôm nay`;
- Picker history status cards remain explicit and distinguish pending/yellow, has-stock/green, skip/red-pink and withdrawn/neutral states without relying on color alone;
- Reporter top filters remain `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`;
- Reporter pending cards keep SKU/product + first-report/affected context and equal `CÓ HÀNG` / `CHO SKIP HÀNG` actions;
- Reporter `Picker thu hồi` view is backed by real `CLOSED` withdrawal-only batch read data rather than a decorative placeholder;
- Root inherits Admin + Reporter and can create/manage Admin and Reporter while remaining protected from subordinate management;
- Admin can manage Reporter; Admin/Root can explicitly open/disable/delete one, many or all Picker accounts;
- HR source accepts configured Mã nhân viên/Họ và tên column names and does not auto-disable/delete absent Pickers or auto-reactivate deliberately disabled Pickers;
- managed Admin/Reporter password maintenance is direct replacement rather than reset-to-default;
- newly provisioned Picker accounts use the protected runtime default, and an existing Picker with no initialized password can initialize from that same protected default on first login;
- Android login is disabled while the installed build is older than the latest valid signed Beta release or while release state cannot be verified;
- Android update flow still downloads the APK, validates SHA-256 and opens the package installer without weakening Android install security;
- Android launcher icon is adaptive/full-brand-background without an added white wrapper;
- Android narrow-screen header does not collapse the product name into a vertical character stack and does not waste operating area on long version metadata;
- Android does not show AI/design-discussion or other non-operational explanatory prose;
- WebSocket authoritative resync;
- no false offline business success;
- Practical Balanced labels/icons/credits remain consistent with the platform-specific canonical design spec;
- Stable untouched unless explicitly authorized.

## Load acceptance

Non-destructive CI tests may use declared synthetic tiers. Destructive/mutation load acceptance requires an isolated workload boundary and an Owner-defined operational scale target; do not invent production forecasts.
