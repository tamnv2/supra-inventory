# D173-E251 — Web 3.3.17 Production technical release receipt (13/11/2026)

## Nguồn & quyền phát hành
- Owner ra lệnh “done code hoàn chỉnh và phát hành 3.3.17” (D173-E249). Phạm vi: Web UI + D173 InventoryCore contractor catalog/API trên Worker hiện hữu `supra-inventory-beta` phục vụ `inventory.supra.cc.cd`.
- Source PR [#968](https://github.com/tamnv2/supra-inventory/pull/968) MERGED (không bypass rule), merge **hai cha**:
  - Main Production SHA `d8aa54cfbff78b5480f7fb17c4489ae06f6d9181`
  - Parent accepted main `648cbe69d4925aa8a61c7ff978b798711d9e9ab3`
  - Parent PR head `bde0181581c8d535af62b1d1eaeb7e8a0178167c`.
- Merge marker `D173-E249_WEB3317_PRODUCTION_RELEASE:`. `tools/d173_e249_web3317_release_gate.py` và `ops/d173-e249-web3317-release-authorization.json` xác nhận nguồn và quyền Owner, D172 independent.
- Source CI SHA `e25524f3b17832e645c5f6d4630b6401b9ab4786`, 7 nhóm scoped SUCCESS:
  - E247 Web3.3.17 UI/Service build + release preflight + D172 regression: [43362168997](https://github.com/tamnv2/supra-inventory/actions/runs/43362168997)
  - Repo Authority: [43362169192](https://github.com/tamnv2/supra-inventory/actions/runs/43362169192)
  - Project State continuity: [43362169213](https://github.com/tamnv2/supra-inventory/actions/runs/43362169213)
  - D173/D172 business isolation: [43362168847](https://github.com/tamnv2/supra-inventory/actions/runs/43362168847)
  - D172 backend isolation: [43362169273](https://github.com/tamnv2/supra-inventory/actions/runs/43362169273)
  - D169 Picker RBAC: [43362169215](https://github.com/tamnv2/supra-inventory/actions/runs/43362169215)
  - E123 SQL/Auth/D172: [43362168982](https://github.com/tamnv2/supra-inventory/actions/runs/43362168982)
- Branch protection của main yêu cầu hai check `authority`/`continuity`, đúng GitHub ruleset id 23574276; cả hai **SUCCESS** tại PR head cuối trước merge.

## Production verified (không suy diễn FIELD)
- Existing GitHub Actions [Deploy Beta Worker run 43362731384](https://github.com/tamnv2/supra-inventory/actions/runs/43362731384) **completed / success**, attempt 1 trên đúng main SHA `d8aa54cfbff78b5480f7fb17c4489ae06f6d9181`.
- Workflow đã upload 3 Web assets, triển khai Worker hiện hữu, hoàn thành bước Cloudflare API/token, auth, PDA registry, Web shell, OAuth và Agent Drive broker guarded.
- `GET https://inventory.supra.cc.cd/health` qua GitHub runner: `HTTP 200`, `status=ok`, `source_commit=d8aa54cfbff78b5480f7fb17c4489ae06f6d9181` khớp merge SHA, `missing_bindings=0`, `storage=true`, `schema=17/17`, `operational=true:7/7`, `agent_migration=0/0`. Secret rebinding post-health và source check cũng PASS.
- D173 Web3.3.17 thực tế có các chỉnh sửa giao diện Dashboard/Report, nút ngày, SKU import, contractor directory + API/SQLite riêng D173, tải đầy đủ tài khoản trong Web mà không phân trang.
- Không sửa nghiệp vụ dữ liệu D172; shared Worker được hồi quy D172 tại CI. Không thay đổi Agent/APK, Firebase, Gateway, Stable hoặc resource/provider ngoài scope.
- **Giới hạn được công bố trước release**: danh sách nhân sự chỉ lưu cache **RAM theo phiên/quyền (TTL 120 giây)**; không ghi dữ liệu nhân sự xuống ổ đĩa/IndexedDB dùng chung vì chưa có biện pháp bảo vệ dữ liệu at rest. Không được ghi nhận mục lưu đĩa dài hạn là PASS.
- **FIELD:** chưa có đăng nhập và kiểm thử giao diện Web thực trên HD/HD+/zoom/dark-light, chưa chạy trực tiếp các thao tác authenticated CRUD nhà thầu; chỉ có source CI và smoke Web shell. **OWNER PASS:** chưa có xác nhận FIELD từ Owner. Không gộp các trạng thái này vào RELEASE PASS.

## Trạng thái tách biệt
- CODE: PASS scoped; CI: PASS 7/7 scoped; RELEASE: **PASS technical official Production**; FIELD: PENDING; OWNER PASS: PENDING.
- D172 remains independent PENDING/HOLD; Stable OWNER-GATED.
- Receipt PR chỉ tài liệu + metadata, tuyệt đối không mở một đợt deploy runtime mới.
