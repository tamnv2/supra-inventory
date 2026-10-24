# D173-E022 — Đợt 1 A + C + log chẩn đoán, tích hợp sau tháo hostname cũ (25/10/2026)

**Owner order:** hoàn tất legacy, tiếp theo Đợt 1 A+C và log B; Đợt 2 chỉ sau tối thiểu ba ngày hoạt động thực tế để thu log/usage.

## Nền kỹ thuật
- Main `eb504576bb0f28946ab50df342a21744d680569b` đã có receipt Cloudflare old host 0, official host 1 với cùng Worker; Web/OTA/OAuth start smoke PASS. D172 độc lập PENDING/HOLD, Worker `supra-inventory-beta` và DO SQLite/Auth hiện hữu không đổi.
- Reintegrated **exact 15 unchanged-from-base source blobs** của E018/PR720 vào main sau E019-E021. Không đưa lại bản `service/src/index.ts` cũ: chỉ thêm tuyến role-limited Agent Reporter vào bản main official-only hiện tại; giữ nguyên D172 shared Worker và chặn OAuth hostname cũ.
- A1: tiến trình tải APK %, bytes, MiB/s; không đồng nhất tải xong với cài xong, giữ SHA và chữ ký APK, khôi phục lỗi an toàn.
- A2: tái phát chỉ được tính khi batch được giải quyết cùng ngày Việt Nam với báo mới; giữ toàn bộ lịch sử, ứng dụng các bề mặt queue/insights/Picker.
- C: hiển thị Reporter online read-only từ authenticated realtime WebSocket attachments, không tăng số Picker, không Kích/Liên hệ/Gọi về/nhóm và không phá WMS.
- Log nhóm B: local bounded counters và tối đa 32 frame UI Reporter; thu số frame bị loại, revision/seq, stale snapshot, lỗi tải Quá hạn, badge/scroll, Agent roster latency/error và session fence. Không thêm timer/ping/provider request chỉ để log; giờ gửi hiện tại 13:15/21:15 được giữ.

## Cổng trước phát hành
- Đợt 1 chỉ là source candidate khi chưa code+CI all PASS, chưa có signed vc118/Agent v141 hoặc pinned Worker release; không tự claim RELEASE/FIELD/OWNER PASS.
- Verify full TypeScript Worker, Android signed package, Windows Agent, role negative tests, source SHA, recurrence VN boundary 00:00/03:00, OTA SHA/signature + interrupted download, D172 auth/SQLite negative regression và no-release of D172.
- Nếu cần tăng phiên bản, phải phát hành đúng channel hiện hữu bằng version monotonically increasing (Android sau vc117, Agent sau v140); tuyệt đối không tái sử dụng signed tag hoặc source pin D171/D172/email.
- Before main merge kiểm tra Worker auto deploy, Agent/Android OTA workflow: mọi thay đổi chỉ được release bằng Owner-approved receipt exact HEAD, rollback, nguồn baseline đã kiểm thử, không dùng historical permission.
- Đợt 2 HOLD cho tới khi bản mới có >=3 ngày làm việc đủ log/usage Reporter, Picker, Agent Primary/Standby, Web, Worker/DO, Firebase trên cùng cửa sổ. Nếu thiếu coverage thì giữ HOLD.

**E022 initial:** CODE_INTEGRATED_ON_BRANCH__CI_PENDING__RELEASE_NOT_APPROVED__D172_PENDING_HOLD__PHASE2_HOLD.
