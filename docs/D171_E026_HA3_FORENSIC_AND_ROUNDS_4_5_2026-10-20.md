# D171-E026 — Chẩn đoán HA vòng 3 + kiểm thử đúng vòng 4 và 5 (20/10/2026)

**Owner yêu cầu:** sửa bộ test để thu đủ bằng chứng nguyên nhân lỗi HA vòng 3 và thử hai vòng chưa chạy, nhưng KHÔNG lặp lại kiểm tra đường truyền 9/9 đã đạt ở vòng 1–3. Đây là nhánh thử nghiệm độc lập, không tác động Agent/VPS production, WMS, PRIMARY thực tế, Cloudflare Worker hoặc Firebase Rules.

## Bằng chứng cũ bất biến

- E023 vòng 1 (A NORMAL/B NORMAL/PDA NORMAL): A 9/9, B 9/9, PDA dual 9/9.
- E023 vòng 2 (A OFFICE/B NORMAL/PDA NORMAL): A 9/9, B 9/9, PDA dual 9/9; Firestore HTTPS REST qua System Proxy Office được xác thực.
- E023 vòng 3 (A NORMAL/B OFFICE/PDA NORMAL): A 9/9, B 9/9, PDA dual 9/9; **HA A→B khoảng 23,4s, vượt SLA 20s — FAIL lịch sử**.
- E023 vòng 4 và 5: chưa thử; không được gán PASS do CI hoặc giả lập.
- E026 giữ các PASS đường truyền và FAIL HA lịch sử ở các log E023 gốc. Không gắn lại PASS cho 1–3 trong session mới. E026 HA3 là **phép đo mới riêng HA**, không phải vòng 3 ACK 9/9 mới.

## Trình tự chỉ ba chặng (2 PC + 1 PDA)

| Chặng | Agent A admin | Agent B tamnv2 (VPS mô phỏng) | PDA 100 | Tác vụ |
| --- | --- | --- | --- | --- |
| HA3 | NORMAL | OFFICE | NORMAL | Chỉ 2 probe kết nối/thiết bị, ghi hai chuyển quyền B→A và A→B, lease+CAS timeline |
| 4/5 | OFFICE | OFFICE | NORMAL | Đúng 9 synthetic cases/Agent/PDA, dual ACK, route, latency và retry |
| 5/5 | NORMAL | NORMAL | NORMAL | Đúng 9 synthetic cases/Agent/PDA, dual ACK, restore và handback VPS mô phỏng (không chặn link PASS) |

Cả hai Windows **đăng nhập trên NORMAL trước**, sau đó chuyển riêng tamnv2(B) sang OFFICE để bắt đầu chặng HA3. A giữ NORMAL, PDA giữ NORMAL. Ấn nút BẮT ĐẦU HA3 trên hai EXE và BẮT ĐẦU HA3 → VÒNG 4/5, 5/5 trên PDA. Hai Agent tạo chung test session mới, bằng cùng phiên bản E026. Khi kết thúc HA3 phần mềm hướng dẫn đưa A sang OFFICE để vòng 4. Khi xong vòng 4, đưa cả A/B về NORMAL để vòng 5. Không đổi mạng trên PDA.

## Log nguyên nhân HA3 bắt buộc từ **cả hai EXE**

- Timestamp UTC và monotonic, network mode và network epoch, phase, role A/B, generation/lease term.
- Bước đọc Firestore / http status / GET latency / timeout / AUTH/RBAC failure, path category **không chứa URL nhạy cảm, JWT, raw UID, IP, token, password**.
- `HA3_POLL_SCHEDULE`: mỗi lần scheduler thực sự kiểm tra lease; khoảng cách thực tế giữa lần trước và lần sau, ngưỡng source 16s, listener loop 8s, mode/proxy.
- `HA3_LEASE_SCHEDULER`, `HA3_LEASE_TIMELINE`: lease remaining ms (có thể âm khi quá hạn), generation, role PRIMARY, elapsed từ lúc pause, proxy GET latency, local pause, số lỗi đọc.
- `HA3_LEASE_CAS`: CAS attempt, expected and new generation, thời gian PATCH, thành công hoặc từ chối fence.
- `HA3`: B incumbent pause → A tiếp quản → A pause → B OFFICE tiếp quản; phân biệt trước 20s, quá 20s nhưng dưới 45s, và không takeover trong 45s; phân biệt thiếu CAS, lỗi đọc và lỗi proxy. Kết quả A→B (tình huống E023 đã FAIL) phải có sự kiện riêng, không bị B→A PASS che lấp.
- `PHASE_CASES`, `PHASE_LINK_METRICS`: HA3 chỉ 2 probe khác với link round 4/5 9 trường hợp; chia tách Agent/PDA ACK, upper-bound timestamps, p50/p95/p99; nhãn terminal bound KHÔNG thay cho Network RTT. PDA riêng có `HA3_PROBE_PASS_NOT_ROUND3_LINK_PASS` hoặc `HA3_PROBE_FAIL_CONTINUE`.
- Local HTTP counts, write attempts; provider billed reads/write thực tế UNKNOWN trừ khi đối soát Cloud billing. Không gọi gRPC Listen production hay đo actual WMS chính trong bộ này.

## Quy tắc đánh giá và không cắt mất chặng sau

- SLA HA **≤20 giây**, không nới tiêu chuẩn để đạt PASS. 20–45 giây = `SLA_MISS`; không takeover = `HA_NO_TAKEOVER`. HA PASS chỉ khi capture đủ B→A và A→B với evidence, không tự suy ra từ vòng 4–5 link PASS.
- Bất kỳ HA trễ/không chuyển quyền phải log FAIL nhưng không tự hủy chặng 4–5. Một kịch bản mất kết nối/hết budget/auth 403 được ghi lỗi thật và dừng an toàn; không chế ra PASS.
- Vòng 4/5 và 5/5 chỉ đạt link PASS khi đúng A 9/9+B 9/9 và dual PDA 9/9 ở cùng phase. Lỗi giả lập handback ở vòng cuối báo HA FAIL riêng, không vứt bằng chứng ACK.
- Nếu không thể tiếp cận Office lần nữa, vòng 4/5 và 5/5 vẫn NOT TESTED, HA3 chưa FIELD re-pass; tuyệt đối không yêu cầu Owner thử lại chỉ vì CI xanh.

## An toàn, hạn mức, CI

- Chỉ dùng collection Firebase `d169_diag_sessions` trong project/Rules đã đăng ký; không tạo resource mới. Phiên E026 có pairing seed khác E023–E025 nhưng cùng namespace, không tự cleanup dữ liệu cũ khi chưa lưu log.
- Windows: tối đa 550 HTTP read/query, 350 write attempts/máy, 40 phút. PDA: 250 write attempts, 40 phút. 6 Agents/40 PDA tối đa chỉ mô phỏng offline. Đây là **local client budgets, không phải trần billing**.
- Hai EXE + APK phải được build từ cùng commit, source safety + offline HA/phase simulation + Android/Windows compile + Authority/Continuity toàn PASS trước khi Owner tải. Draft PR #655 chỉ là thay đổi test. Không merge hoặc đổi VPS, Firebase Rules hay Stable. D170 PAUSED, D169 accepted, D171 OWNER PASS đang pending.
