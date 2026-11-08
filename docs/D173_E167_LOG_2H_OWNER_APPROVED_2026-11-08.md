# D173-E167 — Owner APPROVED: đồng bộ log 2 giờ và Service Drive (08/11/2026)

## Owner Scope
Theo lệnh Owner 08/11/2026: **phê duyệt và yêu cầu phát hành Production toàn bộ** ba mục E165 (Agent174 tray HWND, GitHub usage 05:30 VN, Agent usage 00-24 đồng bộ 06-24) cùng thiết kế log dưới đây. **Lệnh này thay thế E165/E166 proposal-only chưa phê duyệt**, áp dụng đúng mốc 05/07/...03 được đề xuất ở E166. Stable vẫn OWNER-GATED, D172 độc lập PENDING/HOLD.

## Exact contract
- Client **Agent/Android/Web**: mốc cố định VN 01:00, 03:00, 05:00, 07:00, 09:00, 11:00, 13:00, 15:00, 17:00, 19:00, 21:00, 23:00. Mỗi device/session stagger deterministic 0–10 phút, không gửi per-event khi không cần; exception lỗi nghiêm trọng hoặc Agent phát request riêng. Không chờ 13:15/21:15.
- Agent: `AgentLogUploadBridge.DueSlot` chốt immutable checkpoint `agent-log-pending`; retry 15 phút bounded; chỉ purge khi server/Drive receipt thực sự xác nhận. Không tạo resource mới.
- Android: WorkManager OneTimeWorkRequest riêng cho từng slot, network required, cho phép Doze trì hoãn, journal local giữ tới `DRIVE_SYNCED`; nếu không có session thì ngày kế tiếp tiếp tục; không dùng foreground service hay exact alarm.
- Web: lịch 12 slot JS khi có phiên; browser offline/closed không thể tạo UI log. Journal local giữ tới receipt. Web scheduled log được `uploadRuntimeLog` ghi **bền InventoryCore** qua `runtime-logs/upsert`, sau đó xác nhận `CORE_STAGED`; Web được purge bản ghi đã được Core ACK, không phải tuyên bố Drive đã xong. Manual/support flow giữ direct Drive behavior.
- Service: Worker cron **đã tồn tại** `*/5` tiếp tục (D172 OBPP và HR không thay); lên kế hoạch Drive drainer 30 phút/lần và bổ sung lần xả 05:15 VN trước báo cáo 05:30, bounded `retryBufferedRuntimeLogArchives(limit=20)`, fail retained for next attempt. Service báo server-only marker mỗi 30 phút, **không giả đó là Web UI log**. Không cần Web còn mở khi Service đã ghi bền vào Core.
- Đối soát ngày báo cáo 05:30: `05:00 N-1 → 05:00 N` gắn ngày N-1. Vì gói 05:00 có jitter 0–10 phút, Service xả 05:15 VN và thiết bị có thể offline/Doze nên phần log đến muộn phải backfill về đúng ngày; do đó **không được tuyên bố log đầy đủ 100% khi thiếu**. Report hiện mới có trường `PENDING_VERIFIED_DRIVE_LOG_COVERAGE`, `root_cause_status=UNVERIFIED_NO_JOINED_DRIVE_LOGS`. Tích hợp tự động full Drive logs cần chứng minh đường đọc chứng cứ an toàn trên GitHub Actions, chưa được gắn DONE nếu chưa có.
- Estimated 40 PDA + 5 Agent + 5 browser sessions × 12 slots = **600 bundle requests tối đa/ngày** nếu đều online tại tất cả slot, chưa tính lỗi/retry; đây không phải billing thực tế.
- Toàn bộ uploads phải lọc secret/token/password/cookie, immutable `bundle_id`, idempotent, lưu nhật ký ngày, và không tăng Firestore/DO write per event.

## Release truth / evidence boundary
PR #868 `feat/d173-e165-tray-usage0530-dayline-20261108` là branch code, không phải Production. Source CI Windows native + Android/Web/Worker + D172 regression cần PASS, pin SHA, merge protected main, workflow deploy/OTA thành công và receipts cập nhật. Không nhận FIELD/OWNER PASS trước xác nhận thực tế.
