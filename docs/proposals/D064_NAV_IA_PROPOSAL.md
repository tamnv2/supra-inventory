# D064 Navigation IA Proposal — PENDING OWNER DECISION

> This is a non-authoritative post-test proposal. It does not replace D063 until Owner explicitly approves a rebuild.

## Evidence used

D064 Beta load test `d064-20260918174507-c9c3822f` completed successfully:
- 1,000 / 1,000 normal Picker report requests returned HTTP 201.
- 100 existing active Picker identities authenticated through Firebase.
- 400 / 400 selected existing Master SKUs were exercised.
- Traffic duration: 525.423 seconds.
- Average response: 250.34 ms; 95% of measured requests completed within 348.72 ms; maximum 625.64 ms.
- No load-test request error was recorded.
- InventoryCore SQLite grew from 1,433,600 bytes to 4,005,888 bytes (+2,572,288 bytes).
- Row deltas: +400 batches, +1,000 tickets, +1,000 report events, +1,000 realtime events, +1,000 audit rows.
- The temporary load-test gate was verified closed after the run.

The measured result shows the navigation problem is information architecture rather than a need to expose more infrastructure or split more business routes.

## Problems in current D063 sidebar

Current Admin/Root grouping:
- VẬN HÀNH → Vận hành báo hàng
- DỮ LIỆU → Danh mục SKU; Nguồn nhân sự
- QUẢN TRỊ → Nhân sự & tài khoản; Thiết lập nghiệp vụ
- BÁO CÁO → Tổng quan & báo cáo
- HỆ THỐNG → Trạng thái hệ thống; Nhật ký; Tài khoản & mật khẩu

Issues:
1. Five large groups are excessive for the number of actual daily business modules; several groups contain only one or two children.
2. `DỮ LIỆU` versus `QUẢN TRỊ` is an implementation-oriented distinction. Warehouse/Admin users primarily think in terms of managing SKU, people and business settings.
3. `Nguồn nhân sự` is not a standalone daily workflow. It is configuration for `Nhân sự & tài khoản` and should be an internal tab/subsection there.
4. `BÁO CÁO` as a large group with one combined `Tổng quan & báo cáo` child adds one extra hierarchy level while also overloading that child with two different jobs.
5. `Tài khoản & mật khẩu` is personal profile/security, not a system business module. It should be opened from the top-right identity/profile area instead of consuming a left-nav business slot.
6. `Kết quả gần đây` belongs with the live shortage-processing workflow and should remain an internal view of the same operational module rather than becoming another sidebar item.

## Proposed Admin/Root sidebar

### 1. VẬN HÀNH
Maximum three children:
1. **Xử lý báo hàng**
   - internal views: `Đang xử lý`, `Kết quả gần đây`
   - live queue, affected Picker count, result correction and Picker receipt state
2. **Tổng quan**
   - current/selected-period operational health
   - pending workload, outcomes, recurrence, online users and service-relevant headline metrics
3. **Báo cáo**
   - historical/detail filters, drill-down and export

Why: these are the three views Admin/Reporter use to understand and act on the same business flow. Keeping overview/reporting beside the live queue reduces context switching without merging them into one overloaded page.

### 2. QUẢN LÝ
Maximum three children:
1. **Danh mục SKU**
2. **Nhân sự & tài khoản**
   - internal views: `Danh sách`, `Nguồn đồng bộ`, `Tạo / phân quyền`
   - `Nguồn nhân sự` is moved here as an internal configuration view
3. **Thiết lập nghiệp vụ**
   - warning/overdue timing and other approved business settings

Why: these are configuration/master-data responsibilities rather than live operations. A single management group is easier to understand than separate Data and Administration groups.

### 3. HỆ THỐNG
Two children:
1. **Trạng thái hệ thống**
2. **Nhật ký**

Why: both are technical support/diagnostic surfaces. The newly rebuilt D064 system-status console already consolidates service/version/device/capacity information, so there is no reason to split more infrastructure entries.

## Personal account placement

Move **Tài khoản & mật khẩu** out of the left sidebar. Open it from the top-right identity/profile area together with:
- account/password;
- logout;
- Root-only effective-role tester where already approved;
- theme preference remains in the pinned top control per current authority.

This prevents a personal utility from being presented as a business/system module.

## Role-specific projection

- **ROOT / ADMIN:** all three groups above, subject to existing RBAC.
- **REPORTER:** `Xử lý báo hàng`; personal account from header. Do not expose Admin management/system items.
- **PICKER Web:** shortage report/results workflow appropriate to Picker; personal account from header.
- **Android:** keep native role workflow; this proposal concerns Web left navigation only unless Owner later explicitly extends it.

## Recommendation pending Owner approval

Proposed target is **3 large groups instead of 5**, with **no group above 3 children**:
- VẬN HÀNH: Xử lý báo hàng / Tổng quan / Báo cáo
- QUẢN LÝ: Danh mục SKU / Nhân sự & tài khoản / Thiết lập nghiệp vụ
- HỆ THỐNG: Trạng thái hệ thống / Nhật ký

Do not implement this proposal until Owner explicitly accepts or modifies it.
