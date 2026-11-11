# D173-E187 — Agent185 / Host14 WebView2 white-screen field repair (11/11/2026)

## Lệnh Owner
Owner báo Agent phụ ADMIN-PC WebView2 trắng sau đăng nhập, Agent chính VPS không lỗi. Sau khi đọc log, Owner yêu cầu sửa và **phát hành Agent185**. Chỉ Agent + Host14; không đổi Web/Worker/Android/D172/Stable, Firebase/Cloudflare, WMS Confirm business logic.

## Bằng chứng
- Drive ADMIN-PC `manual_agent_ADMIN-PC_20261111_103219_7c1a46ffa28c.log`: `dashboard_popup=ATTACHED`, `confirm_reload=PASS`, `E141 WEB_MONITOR READY hydrated=1 dom=1` nhưng `embed_visual_wake=NATIVE_PASS paint_proof=UNVERIFIED`.
- VPS cùng ngày `session_agent_VPS_20261111_101518_b4e48a5e8c04.log`: WMS DOM READY, nghiệp vụ Confirm thành công. Không suy diễn lỗi quyền Agent/NEXT_B.
- Agent184 trước đó có Host13 khởi tạo trên viewport thực nhưng không có Controller-level HWND position sync; Host13 bundle update không được phân biệt thành build mới. **Compositor là giả thuyết**, chưa có pixel-based FIELD proof.

## Sửa giới hạn
1. Host14 xử lý WM_SIZE/WM_WINDOWPOSCHANGED và message native từ đúng Host HWND đã ghim, trên UI thread thực hiện cập nhật native WebView2 WinForms control bounds (thu chiều cao 1px rồi khôi phục) và invalidate khung hình; SDK hiện tại không công khai `CoreWebView2Controller`; cũng kích một lần sau popup WMS chuyển WebView2 con.
2. Agent185 sau native resize/redraw yêu cầu chính Host14 tự đồng bộ Controller, ghi rõ `host_controller_sync=REQUESTED/FAILED`; không reload WMS, không tạo profile/session, không thay đổi bảo vệ input.
3. Tăng RequiredHostBuild lên 14 (có package SHA và manifest mới), đảm bảo không âm thầm dùng Host13 cache. Giữ Web/Worker/API/dữ liệu nghiệp vụ không đổi, zero new provider polling/requests.

## Tiêu chí PASS
- CODE: tests E187 Host14/Agent185, E183/HA Confirm, native Windows x64 builds, D172 business-isolation CI trên exact PR HEAD.
- RELEASE: protected two-parent merge đúng marker, release tag `relay-agent-v185`, inventory-channel Agent EXE hash trùng Release; browser bundle manifest `host_build=14` và ZIP SHA256 đúng.
- FIELD: ADMIN-PC login/relogin, popup WMS, khóa/mở, đổi tab/tray, WMS Confirm bằng tay hiển thị thật (không trắng); VPS PRIMARY vẫn Confirm bình thường.
- OWNER PASS: chỉ theo xác nhận Owner, **không suy diễn từ DOM READY, CI hoặc signed release**.

**Trạng thái ban đầu:** CODE candidate; CI/RELEASE/FIELD/OWNER chưa được xác nhận.

## CODE / CI — GitHub exact-source verification (11/11/2026)
- Source pinned SHA: `79551cd63c8f5fbae5960f9059ddeed29f859cb5`.
- 36 workflows: **34 SUCCESS / 2 conditional SKIPPED / 0 FAILED**; native Windows Agent185, Host14 x64, D172 isolation, HA/WMS regressions, UI Design, repo authority/continuity PASS.
- Runs: Agent native [42964476392](https://github.com/tamnv2/supra-inventory/actions/runs/42964476392), Host native [42964476455](https://github.com/tamnv2/supra-inventory/actions/runs/42964476455), shared D172 [42964476465](https://github.com/tamnv2/supra-inventory/actions/runs/42964476465), UI [42964476654](https://github.com/tamnv2/supra-inventory/actions/runs/42964476654).
- **CODE/CI PASS**. **RELEASE PENDING** until two-parent protected merge + signed Agent185 and Host14 bundle SHA readback. FIELD/OWNER pending.

## D173-E187-R1 — Agent185 signed OTA recovery (11/11/2026)
- Verified main release workflow [42965200003](https://github.com/tamnv2/supra-inventory/actions/runs/42965200003) SUCCESS but **only** Host14 browser ZIP (321,797,691 bytes, uploaded 05:24 UTC) was updated. The dedicated `relay-agent-v185` tag is absent; agent-latest.json and Agent EXE still correspond to Agent184 (03:04 UTC).
- Root cause: `.github/workflows/verify-relay-agent.yml` Agent185 Host14 validation branch used `return`, skipping the rest of the release/OTA publish step. The Host13 legacy readback must be skipped only for Agent185, not the release itself.
- Recovery scope from main `6f533c0e53c7279a6e93748a799149f8ef8ec568`: workflow release-flow guard, exact-source gate, test and D173 checkpoint only. Runtime Agent185 and Host14 sources are byte-identical to original E187 merge `7ddecb85bc7d96dc3512ed6a0a07031715485a5d`; no Worker/Web/PDA/D172/Stable changes.
- Acceptance: new recovery PR source CI PASS, protected two-parent merge using exact E187 release marker, signed Agent185 Release tag exists, Agent channel manifest tag=relay-agent-v185 and EXE SHA matches signed Release. Host14 SHA/architecture remain verified. FIELD/OWNER separately pending.
