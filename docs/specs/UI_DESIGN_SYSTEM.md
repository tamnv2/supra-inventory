# UI_DESIGN_SYSTEM — Practical Balanced / Phương án 1

Status: **CANONICAL OWNER-SELECTED DESIGN DIRECTION**.

## Design authority

Owner selected **Phương án 1 — Thực dụng cân bằng** on 2026-09-17. This supersedes the former Concept 3 visual direction. The product must look like a real warehouse operating tool, not a concept-art dashboard.

Primary objective:
- give maximum useful screen area and attention to Picker/Reporter work with SKU and out-of-stock reports;
- keep Admin/Root management complete but secondary to daily operational speed;
- keep Web and Android visually consistent without copying a desktop layout onto PDA.

## Visual language

- Light neutral background and white working surfaces.
- Green is the primary action/positive accent.
- Orange is reserved for attention/warning states.
- Red is reserved for destructive/error states.
- Clean borders, restrained shadows, compact cards and low visual clutter.
- Typography uses a Roboto/Noto Sans/system-sans family direction with consistent hierarchy across Web and Android; do not add a remote font dependency merely for appearance.
- Touch targets remain large enough for PDA use, while data tables on Web stay compact.
- Status never relies on color alone; use text/icon/shape semantics.
- Explanatory copy must be limited to information needed to complete the current business action. Do not expose design rationale, AI/Owner discussion text, implementation commentary or other non-operational prose in the product UI.

## Product icon language

Primary product mark represents **SKU/package + operational alert**. Navigation icons must directly describe the business module:
- operational overview;
- processing queue;
- operational reporting;
- Master SKU/catalog;
- people/account management;
- account/security.

Android launcher icon uses an adaptive icon with the green brand color filling the launcher mask and no extra white wrapper/background around the colored icon.

Do not use unrelated map, delivery-route, stock-quantity or incident-photo iconography.

## Web information architecture

Role-aware navigation labels use explicit business names of at least four visible characters:
- `Tổng quan vận hành` — Admin/Root;
- `Hàng chờ xử lý` — Reporter/Admin/Root;
- `Báo cáo vận hành` — Admin/Root;
- `Danh mục Master SKU` — Admin/Root;
- `Quản lý nhân sự` — Admin/Root;
- `Quản lý tài khoản` — authenticated account functions.

Reporter Web prioritizes the unresolved SKU queue, affected Picker count, waiting time, batch detail and the two approved actions `Có hàng` / `Cho phép skip`.

Admin/Root Web keeps management functions available but does not crowd the operational queue with decorative analytics.

## Android/PDA layout rules

- Android is designed for narrow PDA/phone widths first; do not place a long version string beside the product title in the same constrained horizontal row.
- Product title, role/workflow title, forms and primary actions must keep stable alignment and spacing across supported Android 11+ devices.
- Avoid post-layout decorative transformations that can change business layout unpredictably. Any runtime UI normalization must be narrow, deterministic and must not compete with the primary screen layout.
- Version/update state is functional status, not a header decoration.

### Owner-approved operational header

After login, Picker/Reporter/Admin/Root PDA uses one compact operational header:
- left: `BÁO HÀNG 1291` and `Mã nhân viên - Họ tên`;
- right: compact `Log` and `Thoát` actions;
- below/right: role and short Beta build marker;
- do not reintroduce long technical/version prose or a separate oversized identity card.

`Log` is local/session operational feedback only; it is not a second server transaction store.

### Picker

First visual priority and approved composition:
1. one horizontal row containing the SKU input `Nhập tối thiểu 3 số SKU vào đây` and the prominent `BÁO HẾT HÀNG` button;
2. exact SKU selection still derives product name from the synchronized catalog; suggestions remain functional but compact;
3. `Lịch sử báo hàng hôm nay` directly below the entry area;
4. each history card shows `SKU - Tên sản phẩm`, report time and an explicit status label;
5. status background family: pending/yellow, has-stock/green, skip/red-pink, withdrawn/neutral gray;
6. 60-second withdrawal remains available only when the server-authoritative rule permits it.

### Reporter

First visual priority and approved composition:
1. top four-state filter row: `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`;
2. pending queue remains server-priority ordered;
3. each pending card shows `SKU - Tên sản phẩm`, first report time and affected report/Picker count;
4. the card exposes affected Picker detail without displacing the two main actions;
5. two equal primary actions occupy one row: green `CÓ HÀNG` and red/pink `CHO SKIP HÀNG`;
6. resolved/withdrawn tabs use corresponding status-tinted cards;
7. `Picker thu hồi` is backed by actual closed-withdrawal batch data; it is not a decorative placeholder;
8. the 5-minute `SKIP_ALLOWED → HAS_STOCK` correction remains available when the server deadline allows it.

### Admin/Root on PDA

PDA remains operationally focused. Admin/Root inherit Reporter operation capability and may see concise management entry points, but deep HR/Master SKU/reporting administration remains Web-first.

## Android mandatory update gate

- Beta Android checks the canonical signed Beta release before allowing login.
- If the installed `versionCode` is lower than the latest valid Beta release, login remains disabled until the update is installed.
- If the app cannot verify the release state, the login gate fails closed and exposes a concise update/retry status rather than allowing an unverifiable old build to log in.
- Normal Android security rules still apply: the app may automatically detect, download, SHA-256 verify and open the package installer, but installation confirmation remains controlled by Android unless the device is managed with elevated installation authority.

## Android native rendering rule

- Approved labels, footer, header layout and update/login gate are implemented directly in the primary Android activity/view source.
- Do not rely on an `Application` lifecycle callback or generic post-layout view-tree traversal to hide/rename/restyle operational controls after rendering.
- Header composition must remain stable at narrow PDA widths without a right-side version/meta element stealing title width.
- Update verification is fail-closed before login and shares one update state machine with the download/install flow.

## Persistent product credit

Web keeps the existing small centered credit:

`Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291`

Android/PDA uses the Owner-updated shorter wording:

`Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291`

## Scope guard

Visual references are direction only. Never introduce location/bin inventory, stock quantity, maps, delivery orders, incident photos or other unapproved fields/capabilities because they appeared in a mockup.
