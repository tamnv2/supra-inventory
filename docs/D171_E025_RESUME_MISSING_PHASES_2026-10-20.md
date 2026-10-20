# D171-E025 — Tiếp tục đúng hai vòng chưa kiểm thử (4/5 và 5/5)

**Owner 20/10/2026:** Không chạy lại các vòng đã có bằng chứng PASS hợp lệ. Đánh giá HA FAIL riêng; không biến PASS mạng thành PASS toàn bộ.

## Bằng chứng thực địa E023 giữ nguyên, không replay

| Vòng | Agent A / admin | Agent B / tamnv2 | PDA 100 | Bằng chứng |
| --- | --- | --- | --- | --- |
| 1 | NORMAL | NORMAL | NORMAL | Agent A 9/9, Agent B 9/9, PDA dual 9/9 |
| 2 | OFFICE | NORMAL | NORMAL | Agent A 9/9, Agent B 9/9, PDA dual 9/9; Office REST/System Proxy đã chứng minh |
| 3 | NORMAL | OFFICE | NORMAL | Agent A 9/9, Agent B 9/9, PDA dual 9/9; **HA vượt 20s, FAIL** |
| 4 | OFFICE | OFFICE | NORMAL | **Chưa kiểm thử** |
| 5 | NORMAL | NORMAL | NORMAL | **Chưa kiểm thử** |

Phiên E025 phải ghi rõ ba vòng trước là bằng chứng ngoài phiên (historical external evidence), **không được tự phát sinh PASS mới** cho vòng 1–3. Kết quả tổng hợp chỉ được đối soát từ log gốc E023 và log mới E025; ngay cả đủ 5/5 đường truyền thì mục tiêu HA vẫn chưa đạt.

## Cài và chạy E025 nếu vẫn còn khả năng dùng Office

1. Hai PC phải dùng EXE E025 cùng một commit và PDA dùng APK E025 cùng commit. Không trộn E023/E024: phiên mới dùng pairing seed độc lập. Admin=A, tamnv2=B, PDA Picker 100.
2. **Đăng nhập trên cả hai PC bằng mạng thường trước** (do Worker login có thể không hoạt động qua Office); PDA đăng nhập trên mạng thường và luôn giữ nguyên.
3. Sau khi hai PC đăng nhập thành công, chuyển **cả PC A và PC B sang Office**. Bấm BẮT ĐẦU VÒNG 4/5 trên cả hai EXE, và BẮT ĐẦU TIẾP TỪ VÒNG 4/5 trên PDA (thứ tự bấm tùy ý). Kit chỉ phát tín hiệu/kết quả cho phase index 3; yêu cầu đúng 3 bên READY, role và route có xác thực; chờ dual ACK.
4. Khi được hướng dẫn đến vòng 5/5, chuyển **cả hai PC về mạng thường**; xác nhận ĐÃ CHUYỂN MẠNG · TEST TIẾP trên EXE. PDA tự chạy theo phase index 4.
5. Xuất log EXE, network probes và PDA, lưu riêng với E023. Không chia sẻ token, mật khẩu, UID, IP hay toàn bộ log lên GitHub public.

Nếu Office không còn khả dụng, **không yêu cầu thử lại**. Giữ vòng 4 và 5 là UNVERIFIED, tiếp tục đánh giá phương án theo ba vòng có bằng chứng và giả lập offline, nêu đầy đủ giới hạn.

## Safety gates

- Windows bắt đầu từ phase index 3; PDA phase index 3 và lastPassedPhase=2 **chỉ là sequencer baseline**, không đồng nghĩa PASS vòng cũ.
- Chỉ dùng existing scoped D171 Firestore diagnostic namespace. Không gọi WMS, PRIMARY thật, Worker nghiệp vụ, Kick/Gọi/Chat thật, Rules hoặc Stable.
- Cap phía ứng dụng: tối đa 40 phút, Windows 550 HTTP read/query và 350 write attempts mỗi máy, PDA 250 write attempts; test 6 Agent/40 PDA tải lớn chỉ offline. Các cap này không bảo đảm trần billing toàn dự án.
- Giữ SLA failover 20 giây; >20 giây HA FAIL dù tiếp tục quan sát tối đa 45 giây để không hủy thử đường truyền.
- Chỉ phát hành hai test artifacts từ **một commit** sau khi authority/continuity/Windows/APK/offline CI đều PASS. D170 paused, D169 accepted, Stable OWNER-GATED; D171 chưa được Owner PASS.
