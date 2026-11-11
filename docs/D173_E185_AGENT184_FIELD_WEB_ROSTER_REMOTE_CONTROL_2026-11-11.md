# D173-E185 — Owner phê duyệt mục 1–7, hoãn Reporter PDA (11/11/2026)

## Quyết định Owner
- Triển khai CODE + Production mục 1–7: sửa màn hình Web Agent183 trắng; tách 4 cột nhân sự và auto-fit; bỏ hiển thị cột kỹ thuật; điều khiển từ xa Agent bằng admin/tamnv2/vps (mật khẩu/OTP, hai hành động logout giữ EXE hoặc exit không logout); đổi nhãn và di chuyển nút Agent; sửa cắt chữ Supra; Agent kích phiên Web sau reauth, Web tự logout.
- **Mục 8 = D173 backlog, chưa chạy code, không triển khai:** Reporter tự đăng xuất theo giờ **chỉ PDA**, không áp dụng Web. Khi xử lý sau phải review Worker + APK; không sửa `android/` trong E185.
- Không sửa D172, OBPP, Stable, Rules, WMS business/PickList, Android, signing secrets.

## Code candidate
- Agent native WinForms: 4 ô nhân sự, ẩn technical, auto-fit, nút và điều khiển Agent/Web.
- Host13: thử khởi tạo WebView2 tại viewport hợp lệ như nguồn trước khi hồi quy; giả thuyết compositor chưa vẽ khi Host đặt tọa độ (-32000,-32000). Chưa chứng minh FIELD PASS; yêu cầu Windows hiển thị WMS thực.
- Worker+InventoryCore: password/OTP reauth Worker, CAS Web generation, one-time Agent command TTL/target/auth claim; Web logout sau server websocket close. Reuse existing Firestore agent_sync listener; no new collection/poll.
- Các mutation là nghiệp vụ quản trị mới Owner phê duyệt, **không kế thừa release gate D173-E097, E175, E183 hoặc D172**.

## Chấp nhận
1. Real Windows WebView2 hiển thị, thao tác WMS sau khóa/mở khóa, đổi tab, tray restore. Log DOM READY không phải visual PASS.
2. 1280/1600/1920 và DPI 100/125/150, sáng/tối; 0/40/140 phiên; auto-fit 4 cột, nút không che nội dung, không scroll ngoài bảng dưới.
3. Agent khác: chỉ admin/tamnv2/vps; password đúng; two-actions đúng nghĩa, CAS/HA hồi quy; invalid proof/stale/khác target không tác động. Chính Agent không bị kick nhầm.
4. Web: đúng user+generation, Web tự đăng xuất, lỗi auth và phiên mới không bị ảnh hưởng, Reporter PDA không bị kick bằng Web action.
5. Source TS/native + tests + D172 shared regression; signed Agent mới + Worker/Web preflight/Production receipt và channel hash. Không sửa APK.

## Trạng thái
OWNER CODE/PRODUCTION SCOPE APPROVED; **SOURCE CI PASS** trên `1066c15011251e32e0afed9645cadaa344eb1af6`: 46 workflow duy nhất (44 SUCCESS, 2 SKIPPED có điều kiện, 0 FAILED). Windows Agent build PASS (run 42947593238); Worker TS + Web Production build + E185 security PASS (run 42947593206); D172 backend và shared-isolation PASS (runs 42947593219, 42947593165). Chứng cứ được pin tại `ops/d173-e185-release-authorization.json`.

**PRODUCTION MERGE, Worker/Web deploy, Agent184 signed OTA, Windows FIELD và OWNER PASS vẫn PENDING.** Không xem CI PASS là RELEASE PASS. Không sửa APK; Reporter PDA mục 8 vẫn backlog.
