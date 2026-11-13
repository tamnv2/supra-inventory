# D173 — Launcher v0.3.26 + Firebase Auth SSO PoC (CURRENT)

**Source Firebase Auth thật, chưa cấu hình hoặc triển khai Firebase QA, chưa FIELD PASS.**

Đọc [FIREBASE_REAL_TEST_SCOPE.md](FIREBASE_REAL_TEST_SCOPE.md) để biết kiến trúc, giới hạn an toàn, phần bắt buộc cần cấp QA project và ma trận kiểm thử.

- Source Launcher gốc tag `v0.3.26`, commit `c33a8262669f7ff33e698be86ce6d9c657686988`, sao chép chỉ trong `experiments/d173-launcher-session-poc/launcher/`.
- Hai APK thử nghiệm độc lập: `vn.supra.pdalauncher.identitytest`, `vn.supra.identitytest`; không sửa bản Production.
- Firebase SDK, backend QA open/grant/redeem/logout, cùng Firebase UID/session generation và thông báo thu hồi realtime đã có source. Test không dùng username format giả làm kết quả xác thực thật.
- CI: [run #43353330048](https://github.com/tamnv2/supra-inventory/actions/runs/43353330048) **SUCCESS** exact SHA `49a27c3d16bd49a8cd93f496b64cb15da86f4519`. Artifact `d173-firebase-identity-session-poc-debug-pair` ID `14004384190` (hết hạn 20/11/2026 02:39 UTC).
- **Build hiện thiếu Firebase QA project/SDK config**, kết nối được khóa bởi strict project guard, nên **không thể login thật** khi cài. Chỉ mở khóa runtime sau khi QA project độc lập được đăng ký và cấu hình, backend QA đã được triển khai trên đúng project.
- Không sử dụng Firebase hiện đang phục vụ Production; không sử dụng mật khẩu mặc định hardcode trong APK. QA enrollment lần đầu yêu cầu thông tin test account có mật khẩu được che và không log; không truyền mật khẩu qua Android Intent.
- Chưa triển khai hay tác động Firebase/Auth/Firestore/Worker/Agent/Android Production, D172, Stable.

## Historical mock

Bản mock local chạy thử IPC trước đó đạt build tại [run #43348954640](https://github.com/tamnv2/supra-inventory/actions/runs/43348954640), nhưng **không đạt** yêu cầu Firebase thật của Owner và đã được thay bằng code Firebase QA. Không sử dụng bộ mock để kết luận SSO.
