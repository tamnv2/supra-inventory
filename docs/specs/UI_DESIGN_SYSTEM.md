# UI_DESIGN_SYSTEM — Legacy Operational UI V2

Status: **CANONICAL OWNER-SELECTED DESIGN DIRECTION**.

## Authority

Owner approved **direct legacy presentation transplant** on 2026-09-18. This supersedes any earlier instruction to reinterpret or merely imitate the previous product.

Visual/layout source-of-truth:
- read-only UI source: `tam95supra-source/bao-hang-1291`;
- Owner-provided screenshots of the running prior Web/APK;
- presentation structure only.

The goal is not "similar" styling. Preserve the previous product's presentation geometry and interaction shell as directly as practical: DOM/layout hierarchy, topbar/sidebar/workspace composition, spacing, density, cards/tables/actions, responsive behavior on Web, and XML/drawable/color/style/layout structure on Android/PDA.

Forbidden imports remain unchanged: legacy backend/provider/auth/storage/database/credentials/resource assumptions and out-of-scope business fields are never transplanted.

## UI-first parity gate

The current implementation order is Owner-mandated:

1. Inventory the complete prior Web/APK presentation source before editing the new product.
2. **Transplant presentation instead of redesigning it.**
   - Web: preserve the old topbar, health/status chips, role-test strip where applicable, left grouped sidebar for Admin/Root, workspace/content composition, cards/tables/actions, empty states and responsive breakpoints.
   - Android/PDA: preserve the old native resource hierarchy using XML layouts, drawables, colors, styles/themes and row/overlay resources. Do not rebuild the accepted shell as approximate programmatic `LinearLayout` geometry.
3. Remove/ignore legacy backend/provider/auth/storage calls. Bind the transplanted UI only to current SUPRA Inventory adapters/data later.
4. During the UI phase, fixture/sample data may be used to render every required state. Business mutation completeness is not the UI acceptance criterion.
5. Validate screen-by-screen and viewport-by-viewport. CI/build PASS means only technical validity; it must never be labeled Owner UI PASS.
6. Stop the UI phase only at explicit Owner UI/layout acceptance.
7. Only after Owner UI acceptance may canonical logic/scenarios/business rules be rebuilt/wired into the accepted shell.

Any intentional visual divergence from the prior product requires explicit Owner approval.

## Core principles

- Picker/Reporter business work receives maximum useful screen area.
- SKU and product name are visually stronger than decorative headings.
- Use light neutral surfaces, restrained borders and minimal shadow.
- Green = positive/primary; amber = waiting/SLA attention; red/pink = Skip/destructive/error; gray = withdrawn/non-current.
- Status always includes text; never depend on color alone.
- Use system/Roboto/Noto-style typography without a remote font dependency.
- Remove design rationale, implementation commentary and unnecessary explanatory prose from the product.
- **No offline business mode.** No offline-business affordance exists.

## Android/PDA shared header

After login:
- clearly readable `BÁO HÀNG 1291`;
- concise `MNV · Họ tên` identity;
- secondary role/build marker;
- utility actions in a compact overflow/menu when that preserves narrow-screen width;
- no long version text competing with the product title.

The title must never collapse into a vertical character stack on narrow PDA screens.

## Picker PDA

Canonical vertical composition:
1. compact header/identity/tools;
2. large SKU input (`Nhập / quét SKU` or equivalent concise hint);
3. compact suggestions when needed;
4. prominent selected SKU + product name block;
5. full-width `BÁO HẾT HÀNG`;
6. `BÁO HÔM NAY` / today history;
7. readable status cards and conditional `Thu hồi`.

Rules:
- Do **not** restore the former one-row SKU input + report button layout.
- Report action is enabled only for a valid selected SKU while online.
- Pending = amber/yellow; has-stock = green; skip = red/pink; withdrawn = gray.
- Critical final result is shown in a high-priority result surface with `XÁC NHẬN ĐÃ NHẬN`.
- Multiple unacknowledged results are presented deterministically and none is silently lost.

## Reporter PDA

- Four filters remain: `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`.
- Pending cards prioritize SKU, product name, affected Picker count, first report/waiting duration and SLA/recurrence context.
- Two large actions remain visually dominant: `CÓ HÀNG` and `CHO SKIP HÀNG`.
- Picker detail expands separately without squeezing those actions.
- Skip opens explicit impact confirmation before commit.
- Resolved cards may show acknowledgement progress such as `3/5 Picker đã xác nhận`; ACK is not a new batch status.
- `Picker thu hồi` uses real withdrawal-closed data.
- Five-minute Skip→Có hàng correction appears only while server allows it.

## Admin/Root PDA

Admin/Root must not be rendered as only Reporter. After login show a concise launcher grouped into:

### Vận hành
- Hàng chờ xử lý
- Kết quả gần đây

### Quản trị
Role-allowed concise entry points for Picker/personnel status, accounts, Master SKU status and SLA/settings overview.

### Hệ thống
- Trạng thái dịch vụ
- Log / Chẩn đoán
- Cập nhật
- account/logout utilities as appropriate

Deep HR source editing, 10k–50k SKU import, detailed reporting and bulk administration remain Web-first. ROOT sees Root-allowed entries while normal subordinate controls still cannot manage ROOT.

## Web

Web is operational-first.

### Reporter landing/focus

Show a dense live operational list/table before analytics:
- SKU;
- product name;
- affected Picker count;
- first report/wait duration;
- SLA/recurrence context;
- `CÓ HÀNG` / `CHO SKIP HÀNG`;
- expandable Picker detail.

Compact state filters/counts may sit above the list. Do not place large KPI cards or explanatory paragraphs before the live queue.

### Admin/Root information architecture

Group functions conceptually as:
- **Vận hành** — live queue, results/history;
- **Dữ liệu** — Master SKU, HR source;
- **Quản trị** — accounts, Picker lifecycle, SLA/business settings;
- **Báo cáo** — overview, detailed reporting, SLA/recurrence;
- **Hệ thống** — service state, archive/sync, diagnostics/version where implemented.

Dashboard is an Admin/Root analysis module, not the Reporter landing surface.

## Realtime visual behavior

- WebSocket updates must not reset scroll, selected filter/tab, focused SKU input or unrelated forms.
- Patch affected rows/cards/counts when possible.
- Sequence-gap recovery applies ordered deltas.
- Authoritative reconcile is fallback and preserves user context where possible.
- Full page reload is not synchronization logic.

## Online-only visual behavior

When service connectivity is unavailable:
- show concise connection state;
- disable/block business mutation actions;
- retain safe read-only context where practical;
- never display offline queue/outbox or `chờ đồng bộ` business states.

## Android mandatory update gate

- Verify canonical signed Beta release before login.
- Older or unverifiable build cannot log in.
- Downloaded APK is SHA-256 verified before installer handoff.
- Where supported by the current release pipeline, additionally verify expected package/signing identity.
- Do not weaken Android installation security.

## Native rendering rule

The Android/PDA visual shell must use the transplanted native resource structure from the prior product wherever an equivalent screen exists: XML layouts + drawables + colors + styles/themes + row/overlay resources. Controller code binds current data/actions to those views.

Do not replace an existing accepted legacy XML screen with an approximate programmatic `LinearLayout` reconstruction. Do not use a global post-layout view-tree rewriter to alter business UI after render.

## Product credit

Web: `Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291`

Android/PDA: `Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291`

Keep credit visually secondary.

## Scope guard

Reference material never authorizes bin/location/pickface, stock quantity, maps, delivery orders, incident photos, offline reporting or unrelated features.

## Android lifecycle rendering

- Realtime refresh of Picker history and Reporter queue/results uses keyed in-place row replacement rather than rebuilding the whole operational screen.
- Stable rows remain attached where their business signature is unchanged so scroll/touch context is not reset unnecessarily.
- Picker `Thu hồi` is a normal visible tap action followed by an explicit confirmation; do not hide the action behind a long-press gesture.
- Admin/Root launcher Web-first entries deep-link to their exact allowed module; direct links remain role-checked by the Web client before rendering.

## Support diagnostics surface

- Web and Android expose a support-log action using bounded technical snapshots only.
- Allowed context includes app/build, platform/device class, network/service reachability, realtime state/cursor/epoch, catalog count/version and a bounded recent technical-error list.
- Credentials, authorization headers, ID/refresh tokens, passwords, API keys, private/signing material and raw session stores are never included.
- Diagnostic objects/strings/arrays are depth/count/length bounded and credential-like keys/values are redacted.
- Generating a support log is read-only and never triggers business mutation.
