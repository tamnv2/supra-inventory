# D172-E063 — Worker Production và signed OBPP v12 technical release receipt (10/11/2026 VN)

## Owner scope / hủy dữ liệu giả Production
- Owner phê duyệt phát hành hai lỗi E063: Core đã Google Sheet ACK nhưng lịch sử PDA còn PENDING; thao tác lưu/xóa hiện thông báo cũ tới khi đổi tab.
- Owner hủy yêu cầu chèn 200 bản ghi ngẫu nhiên vào Production. **Số bản ghi giả đã thêm lên Production từ yêu cầu E062 = 0**. CI isolated 200 record vẫn giữ làm kiểm thử hồi quy, không chuyển vào Production.
- Chỉ sửa D172 isolated Core change-feed và standalone Android `cd.cc.supra.obpp1291`; giữ nguyên Firebase, Sheet nghiệp vụ, Web/Agent/Inventory Android, signed channel Báo hàng, Stable và tài nguyên ngoài scope.

## CODE / CI / protected merge
- [PR #890](https://github.com/tamnv2/supra-inventory/pull/890), reviewed executable source `5abbac639c8f676962000804f59e3b3ff8b1354e`, owner-scoped release/authority source `50df334618f69b0685f4a8f8ac32926be19c210d`.
- D172 Backend [42718823030](https://github.com/tamnv2/supra-inventory/actions/runs/42718823030): SUCCESS.
- D172 Android code-only (actual Gradle/debug + disposable CI signing, **not** Production APK) [42718823236](https://github.com/tamnv2/supra-inventory/actions/runs/42718823236): SUCCESS.
- D173 E123 shared Worker / D172 regression [42718823288](https://github.com/tamnv2/supra-inventory/actions/runs/42718823288): SUCCESS.
- E063 Owner exact-source preflight [42718823326](https://github.com/tamnv2/supra-inventory/actions/runs/42718823326): SUCCESS, release job SKIPPED on pull_request by design.
- Repo Authority [42718822667](https://github.com/tamnv2/supra-inventory/actions/runs/42718822667) and Project State [42718823362](https://github.com/tamnv2/supra-inventory/actions/runs/42718823362): SUCCESS.
- Protected main `merge` commit: `c05f3f4ccd2cbbc46c7b0b9af6bb3efb772df6c9`, release subject `D172-E063_RELEASE:`. Immutable source SHA remains an ancestor; unrelated D173-only gates do not grant D172 permission.

## Production Worker / Android release
- [Existing Worker Production run 42719275932](https://github.com/tamnv2/supra-inventory/actions/runs/42719275932): **COMPLETED SUCCESS**. D167→D172 E063 owner-gate, D170 existing-host exact-source/SQLite, Beta health/Root/schema, and existing Inventory auth/business/Web safety steps PASS. Wrangler Worker+Web assets deployed same protected main source SHA `c05f3f4...` (existing Worker only; not Stable/new resource).
- [Signed OBPP workflow 42719275798](https://github.com/tamnv2/supra-inventory/actions/runs/42719275798): **COMPLETED SUCCESS**. E063 source gate PASS; verifies current Worker `/health` exact `c05f3f4...`, OBPP `READY/SCOPED_CONNECTED`, negative login HTTP401, then builds/signs and publishes separate APK+OTA.
- [GitHub Release obpp1291-v12](https://github.com/tamnv2/supra-inventory/releases/tag/obpp1291-v12): published 2026-11-09 23:21:57 UTC = **06:21:57 ngày 10/11/2026 Việt Nam**. `obpp1291.apk` size **6,176,196 bytes**, API asset SHA256 `e0f93b5633358fc7e55f3bd2ec43986e323905e8bea492cdf266d9e3178f07b5`. Release target `c05f3f4ccd2cbbc46c7b0b9af6bb3efb772df6c9`.
- [Mutable channel obpp1291-latest](https://github.com/tamnv2/supra-inventory/releases/tag/obpp1291-latest): asset `obpp1291-latest.json` updated at 2026-11-09 23:21:58 UTC. Signed release workflow performed manifest update; GitHub asset metadata verified. Manifest body itself was **not** independently downloaded through current tool, so do not claim independent payload readback.

## Phân biệt PASS
| Cổng | Trạng thái |
|---|---|
| CODE / D172 Backend / Android CI / shared D173 regression / source and authority | **PASS** |
| Existing Worker Production /health exact main SHA / ready and negative auth | **PASS** |
| OBPP signed v12 GitHub APK and OTA asset publication | **PASS** |
| Owner physical PDA: nhận badge SYNCED ngay sau Google ACK, lưu/xóa cập nhật ngay không đổi tab, test timeout/retry và nhiều PDA | **FIELD PENDING** |
| D172 Owner nghiệm thu / đóng D172 | **FALSE — PENDING/HOLD** |

Không tạo record QA thực trên Production, không thay đổi Sheet ngoài outbox nghiệp vụ bình thường, không thao tác Stable hoặc thay đổi logic D173.
