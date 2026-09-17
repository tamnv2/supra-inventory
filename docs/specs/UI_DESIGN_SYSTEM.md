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

## Product icon language

Primary product mark represents **SKU/package + operational alert**. Navigation icons must directly describe the business module:
- operational overview;
- processing queue;
- operational reporting;
- Master SKU/catalog;
- people/account management;
- account/security.

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

## Android/PDA information architecture

### Picker
First visual priority:
1. search/scan SKU;
2. selected SKU + product name;
3. large `Báo SKU hết hàng` action;
4. `Lịch sử báo hàng` / current results;
5. 60-second withdrawal action only when server allows it.

### Reporter
First visual priority:
1. `Hàng chờ xử lý` sorted by server priority;
2. SKU + product name + affected Picker count + waiting context;
3. large `Có hàng` and `Cho phép skip` actions;
4. affected Picker detail;
5. recent results/correction window.

### Admin/Root on PDA
PDA remains operationally focused. Admin/Root inherit Reporter operation capability and may see concise management entry points, but deep HR/Master SKU/reporting administration remains Web-first.

## Persistent product credit

Web and Android show this small centered footer at the bottom without consuming meaningful operating area:

`Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291`

## Scope guard

Visual references are direction only. Never introduce location/bin inventory, stock quantity, maps, delivery orders, incident photos or other unapproved fields/capabilities because they appeared in a mockup.
