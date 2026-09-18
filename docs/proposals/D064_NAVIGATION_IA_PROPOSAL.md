# D064 Navigation IA Proposal — PENDING OWNER DECISION

Status: **PROPOSAL ONLY — DO NOT IMPLEMENT UNTIL OWNER APPROVES**

## Why the current left navigation still feels wrong

The current D063/D064 sidebar is technically tidy but still reflects the implementation structure more than the daily business flow:

- `DỮ LIỆU` and `QUẢN TRỊ` split closely related people/account setup across separate groups. `Nguồn nhân sự` is a configuration source for Picker provisioning, not a daily data workspace.
- `Nhân sự & tài khoản` and `Nguồn nhân sự` are two steps of one management process but sit in different large groups.
- `Thiết lập nghiệp vụ` is too abstract. The actual business function is the processing-time warning/escalation configuration.
- `Tài khoản & mật khẩu` is a personal identity action, not a system business module. Keeping it as a left-nav business item makes the sidebar longer without improving operations.
- `Trạng thái hệ thống` is now a real monitoring console under D064; it should stay under Hệ thống, with capacity/load-test details inside it rather than spawning more sidebar entries.
- The left navigation should optimize for frequency: live processing first, management second, analysis third, technical monitoring last.

## Proposed large business groups

### 1. VẬN HÀNH

**Left-nav item: `Xử lý báo hàng`**

Internal small modules/tabs:
- `Đang chờ xử lý`
- `Kết quả gần đây`

Purpose:
- This is the primary Reporter/Admin/Root operational surface.
- Keep live queue, affected Picker count, elapsed time, recurrence and result acknowledgement context in one workspace.
- Default landing for Reporter/Admin/Root remains this workspace.

### 2. QUẢN LÝ

**Left-nav item: `Danh mục SKU`**

Internal small modules:
- `Tra cứu SKU`
- `Cập nhật từ Excel`
- `Xung đột / thay đổi tên` only when a real import needs review

**Left-nav item: `Nhân sự & tài khoản`**

Internal small modules/tabs:
- `Danh sách tài khoản`
- `Nguồn nhân sự`
- `Đồng bộ Picker`

Purpose:
- Move the current separate `Nguồn nhân sự` route into this workspace because configuring the HR Sheet and applying Picker provisioning are one administrative process.
- Keep role-safe create/edit/disable/delete/password operations here.
- ROOT-only Admin management remains inside the same workspace under RBAC, not as another sidebar item.

**Left-nav item: `Thời gian xử lý`**

Internal small modules:
- `Cảnh báo`
- `Quá thời gian`

Purpose:
- Replace the vague `Thiết lập nghiệp vụ` wording with the exact setting being controlled.
- Do not expose raw SLA jargon as the main visible label.

### 3. BÁO CÁO

**Left-nav item: `Tổng quan & báo cáo`**

Internal small modules/tabs:
- `Tổng quan`
- `Báo cáo chi tiết`

Purpose:
- Keep analysis separate from live operations.
- No employee scoring/ranking and no out-of-scope stock/location metrics.

### 4. HỆ THỐNG

**Left-nav item: `Trạng thái hệ thống`**

Internal small modules/sections:
- `Dịch vụ`
- `Dung lượng & giới hạn`
- `Test tải gần nhất`
- technical details remain expandable secondary information

**Left-nav item: `Nhật ký`**

Internal small modules/tabs:
- `Web`
- `Android`

Purpose:
- Keep diagnostics and logs together at the bottom because they are support/monitoring functions, not normal business flow.

## Remove from left navigation

`Tài khoản & mật khẩu` should move to the pinned top-right identity area/user menu.

Reason:
- It is personal account maintenance, not a business module.
- It remains reachable for every role without consuming a permanent business-nav slot.
- ROOT effective-role selector remains pinned separately as already approved.

## Proposed Admin/Root sidebar

```text
VẬN HÀNH
  Xử lý báo hàng

QUẢN LÝ
  Danh mục SKU
  Nhân sự & tài khoản
  Thời gian xử lý

BÁO CÁO
  Tổng quan & báo cáo

HỆ THỐNG
  Trạng thái hệ thống
  Nhật ký
```

This reduces the current Admin/Root information architecture from **5 large groups / 9 visible items** to **4 large groups / 7 visible business items**, while preserving all current approved capabilities through internal tabs/sections.

## Role-specific left navigation

### Reporter
- `Xử lý báo hàng`
- personal password/account action moves to the top-right identity menu

### Picker Web test surface
- `Báo thiếu hàng`
- personal password/account action moves to the top-right identity menu

Android/PDA navigation is not changed by this proposal unless Owner explicitly extends the decision to Android.

## Recommendation for implementation order after Owner approval

1. Rebuild only the navigation/workspace composition; do not alter business state or API behavior.
2. Merge `Nguồn nhân sự` into `Nhân sự & tài khoản` as internal tabs.
3. Rename `Thiết lập nghiệp vụ` to `Thời gian xử lý`.
4. Move personal password/account action from sidebar to the pinned identity menu.
5. Keep D064 `Trạng thái hệ thống` intact and use internal sections for service/capacity/load-test detail.
6. Re-run UI/realtime/RBAC regression and Owner screen-by-screen review on Beta only.

Stable remains OWNER-GATED.
