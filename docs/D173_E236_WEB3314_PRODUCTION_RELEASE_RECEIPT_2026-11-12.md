# D173-E236 — Web 3.3.14 Production technical release receipt (12/11/2026)

## Nguồn thẩm quyền / phạm vi
- Owner yêu cầu ngày 12/11: **“Triển khai cập nhật sửa lỗi.”** Quyết định và kỹ thuật: `docs/D173_E234_WEB3314_OWNER_DEPLOY_2026-11-12.md`, PR [#959](https://github.com/tamnv2/supra-inventory/pull/959).
- Phạm vi **D173 Web 3.3.14 trên Worker hiện hữu** `supra-inventory-beta` tại `inventory.supra.cc.cd`; không thay đổi code nghiệp vụ Worker/DO/SQLite/D172/Agent/APK/Firebase/Gateway/Stable, không thêm provider.
- D172 **INDEPENDENT PENDING/HOLD**; Stable **OWNER-GATED**.

## Bằng chứng Code/CI, PR, main
- PR959 merged có bảo vệ ngày 12/11, merge commit/production source **`8671da348b371a79f09fc7cdc766cdcba137b80a`**, parent accepted main `99da97d69490f68818a5a1e49c566a0c5e12141b`, exact PR head `8a6f9a018359c4c9d87afc73c8c4690bf6443327`.
- HEAD cuối PR959 **4 scoped CI SUCCESS**:
  - Web3.3.14 executed 0/1/200/201/383/1000 row-paging, A→B→A RAM cache behavior, TypeScript/Vite, D172 independent regressions, scoped release preflight: [43237882976](https://github.com/tamnv2/supra-inventory/actions/runs/43237882976).
  - Independent D172 isolation: [43237882403](https://github.com/tamnv2/supra-inventory/actions/runs/43237882403).
  - Repo Authority: [43237883060](https://github.com/tamnv2/supra-inventory/actions/runs/43237883060).
  - Project State/continuity: [43237883160](https://github.com/tamnv2/supra-inventory/actions/runs/43237883160).
- Merged main Repo Authority và Project State tương ứng [43238438896](https://github.com/tamnv2/supra-inventory/actions/runs/43238438896) và [43238438571](https://github.com/tamnv2/supra-inventory/actions/runs/43238438571) đều **SUCCESS**.

## Production run và xác minh
- Worker/Web Production workflow [43238438595](https://github.com/tamnv2/supra-inventory/actions/runs/43238438595), **attempt 2 SUCCESS** (cùng main SHA, không thay đổi source).
- Attempt 1: Wrangler deploy Worker đã trả health chính xác source `8671da3...`, nhưng bước D166 post-secret guard FAIL do `source_commit` trả về không khớp ngay sau khi tạo secret-version; HTTP200 và môi trường `beta` vẫn đúng. **Không đánh đồng attempt 1 với RELEASE PASS**.
- Attempt 2: Worker upload/deploy thành công (Wrangler deploy Version ID `f5412104-ff31-4400-84b7-616a4af6a374`, trước khi D166 secret-version mới được tạo); health HTTP200, `environment=beta`, `source_commit=8671da348b371a79f09fc7cdc766cdcba137b80a`, SQLite/storage/root secret/missing-bindings PASS.
- Sau secret put: **`D166_WORKER_SECRET_VERSION_SOURCE_AND_ENV_PASS`** và `D166_WORKER_BETA_UNAUTHENTICATED_FAIL_CLOSED_PASS` (đúng 401 AUTH_REQUIRED); D170 domain/Worker/source, Beta Auth API, business API guard, PDA registry contract, Web shell, OAuth disclosure/start và Agent Drive broker đều **PASS**.
- Worker source và Web assets cùng main SHA, không có chứng cứ sửa logic nghiệp vụ hoặc triển khai tài nguyên D172 trong change set này.

## Mức độ hoàn thành
| Hạng mục | Kết quả |
|---|---|
| CODE Web3.3.14 | **PASS_SOURCE** |
| CI Web/D172/Authority/State | **PASS_EXACT_HEAD** |
| PR959 protected merge | **PASS** |
| Production Web3.3.14 | **PASS_TECHNICAL** — run43238438595 attempt2 |
| FIELD (Chrome/Edge, light/dark, 1366/1600/1920, zoom 100/125/150, 0–1000 SKU, actual last row) | **NOT VERIFIED** |
| OWNER PASS | **NOT CONFIRMED** |

Không suy diễn hiệu suất/chi phí tăng/giảm từ source tests; chưa có đo Network/DOM thực tế. Web3.3.14 đã phát hành về kỹ thuật, ba lỗi giao diện cần xác nhận trực tiếp bằng thiết bị và ảnh/Network thực tế trước FIELD/OWNER PASS.

Tài liệu E236 là receipt/chứng cứ **không được kích hoạt lại** Worker/Agent/D172 release; cập nhật chỉ `docs/` và `ops/`, đi qua PR có bảo vệ.
