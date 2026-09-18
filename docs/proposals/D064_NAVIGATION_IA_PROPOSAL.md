# D065/D066 Navigation IA — THREE LARGE GROUPS — OWNER APPROVED

Status: **OWNER APPROVED by D066 and DEPLOYED ON BETA — exactly 3 large groups, at most 5 visible children per large group. Owner visual acceptance remains pending.**

## Owner refinement

The previous four-group D064 proposal is superseded for navigation design. The left navigation must now use:

- exactly **3 large groups** for Admin/Root;
- at most **5 visible child items per large group**;
- related small functions should become tabs/sections inside one child workspace rather than additional sidebar rows;
- personal account actions should not consume a business-navigation row.

## Analysis

The product has three fundamentally different kinds of work:

1. **VẬN HÀNH** — perform and review the shortage-reporting business flow.
2. **QUẢN LÝ** — maintain the business inputs, users and processing rules that make the flow work.
3. **HỆ THỐNG** — observe technical health, capacity and diagnostics.

A separate top-level `BÁO CÁO` group is unnecessary in a three-group model because reporting is a read/analysis view of the same operational flow, not an independent data domain. A separate `DỮ LIỆU` group is also unnecessary because SKU master and HR/personnel sources are managed business inputs.

This model follows user intent instead of implementation modules:
- **Do the work / understand the work** → Vận hành.
- **Configure who/what/how the work uses** → Quản lý.
- **Check whether the platform is healthy** → Hệ thống.

## Proposed Admin/Root sidebar

### 1. VẬN HÀNH

Visible children: **2 / maximum 5**

#### `Xử lý báo hàng`
Internal tabs/sections:
- `Đang chờ xử lý`
- `Kết quả gần đây`

Contains:
- Reporter priority queue;
- affected Picker count;
- waiting time and warning/escalation state;
- recurrence context;
- HAS_STOCK / SKIP_ALLOWED resolution;
- result receipt/acknowledgement progress;
- correction/withdraw context where role-allowed.

This remains the default landing for Reporter/Admin/Root because it is the highest-frequency business task.

#### `Tổng quan & báo cáo`
Internal tabs:
- `Tổng quan`
- `Báo cáo chi tiết`

Contains:
- operational summary;
- period filters;
- trend/outcome/recurrence views;
- online-user summary where approved;
- detailed rows and CSV export.

Reason for placing it under VẬN HÀNH:
- it analyzes the exact same shortage-reporting flow;
- users move naturally from “what is happening now?” to “what happened / how much?”;
- keeping a separate one-item `BÁO CÁO` large group adds hierarchy without adding a new business domain.

### 2. QUẢN LÝ

Visible children: **3 / maximum 5**

#### `Danh mục SKU`
Internal sections:
- `Tra cứu`
- `Cập nhật Excel`
- `Xử lý xung đột` only when an import actually requires review

Contains only approved SKU + product-name master functions. No stock quantity/location scope.

#### `Nhân sự & tài khoản`
Internal tabs/sections:
- `Danh sách tài khoản`
- `Nguồn nhân sự`
- `Đồng bộ Picker`
- role-safe create/change/disable/delete actions inside the relevant list/detail surface

Reason for merging the former `Nguồn nhân sự` child:
- HR Sheet configuration is not a standalone daily domain;
- its purpose is to provision/synchronize Picker accounts;
- source configuration + Preview/Apply + account lifecycle are one continuous administrative workflow.

ROOT-only Admin management remains inside this workspace under server RBAC rather than becoming another sidebar child.

#### `Thời gian xử lý`
Internal sections:
- `Cảnh báo`
- `Quá thời gian`

Reason:
- this is clearer than generic `Thiết lập nghiệp vụ`;
- it directly describes the only currently approved configurable SLA/time behavior;
- configuration belongs with management, not with technical system health.

### 3. HỆ THỐNG

Visible children: **2 / maximum 5**

#### `Trạng thái hệ thống`
Internal sections:
- `Dịch vụ`
- `Dung lượng & giới hạn`
- `Test tải gần nhất`
- expandable technical detail

Contains the D064 service/capacity console:
Cloudflare Worker, InventoryCore/SQLite, Firebase Auth, FCM, Google Drive, Google Sheets, GitHub and realtime.

Do not split providers into separate sidebar children.

#### `Nhật ký`
Internal tabs:
- `Web`
- `Android`

Contains sanitized support/error logs and manual log-send actions.

## Remove from the left navigation

### `Tài khoản & mật khẩu`
Move to the pinned identity/user control in the top-right.

Reason:
- it is a personal account action, not a business domain;
- every role still needs access, but it should follow the user identity rather than consume sidebar space;
- ROOT effective-role selector remains separately pinned and protected.

## Final proposed structure

```text
VẬN HÀNH
  Xử lý báo hàng
  Tổng quan & báo cáo

QUẢN LÝ
  Danh mục SKU
  Nhân sự & tài khoản
  Thời gian xử lý

HỆ THỐNG
  Trạng thái hệ thống
  Nhật ký
```

Result:
- **3 large groups exactly**
- **7 visible children total**
- group distribution: **2 / 3 / 2**
- no group exceeds the Owner limit of 5
- all currently approved Admin/Root functions remain reachable without adding hidden business behavior.

## Role-specific projection

### ROOT / ADMIN
Show all three large groups, with individual actions still enforced by server RBAC.

### REPORTER
Show only:
- **VẬN HÀNH**
  - `Xử lý báo hàng`

Do not show empty/unauthorized QUẢN LÝ or HỆ THỐNG groups. Personal password/account action remains in the identity control.

### PICKER Web test surface
Do not force the three-group Admin IA onto Picker. Keep the single Picker operational workspace `Báo thiếu hàng`; personal password/account action moves to identity control.

Android/PDA remains unchanged by this proposal unless Owner explicitly extends this navigation decision to Android.

## Implementation guard

- Recompose navigation/workspaces only; do not alter business state transitions or API behavior.
- Merge current `Nguồn nhân sự` route into `Nhân sự & tài khoản` as an internal tab/section.
- Keep `Kết quả gần đây` inside `Xử lý báo hàng`.
- Move `Tổng quan & báo cáo` under the VẬN HÀNH large group without changing its data logic.
- Rename `Thiết lập nghiệp vụ` to `Thời gian xử lý`.
- Move personal `Tài khoản & mật khẩu` from sidebar to pinned identity/user control.
- Preserve D064 `Trạng thái hệ thống` functionality and D063 logs.
- Beta Web only; Stable remains OWNER-GATED.
- Run authority/state/UI/realtime/RBAC guards and Owner visual review after implementation.

## Runtime evidence

- PR #50 merged at `2e12e6d4e94b195e3b505b3f2abe9822ca91632c`.
- PR authority/state/UI guards PASS.
- Main UI Design Guard run `35407227884` PASS.
- Beta deploy run `35407227911` PASS.
- Stable was not changed.
