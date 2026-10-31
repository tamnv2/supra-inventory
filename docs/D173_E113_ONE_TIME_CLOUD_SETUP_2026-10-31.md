# D173-E113 — Một lần cấp quyền để kiểm thử Cloudflare thực

Worker test riêng: **supra-inventory-m2-lab**; Durable Object SQLite riêng: **LabRealCore**. Dùng cùng quota Cloudflare account, nhưng không chung Worker, DO database, domain, user thực hoặc tài nguyên D172.

## Owner chỉ cần thiết lập một lần

1. Cloudflare → [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → tạo token tên SUPRA-M2-LAB-ONLY cho đúng account SUPRA: quyền tạo Workers mới (Workers Admin hoặc Workers Scripts Edit đủ quyền) và **Account Analytics Read**. Không cấp Routes/DNS/Billing Write. Không gửi token qua chat.
2. GitHub → [Environments](https://github.com/tamnv2/supra-inventory/settings/environments) → tạo **m2-cloud-lab** → thêm Environment secret **CF_API_TOKEN_M2_LAB** bằng token ở bước 1.
3. GitHub → [Actions variables](https://github.com/tamnv2/supra-inventory/settings/variables/actions) → kiểm tra repository variable **CF_ACCOUNT_ID** tương ứng account Cloudflare (nếu chưa có thì tạo).
4. Đợi job **offline-first PASS** tại [PR #809](https://github.com/tamnv2/supra-inventory/pull/809), rồi thêm một lần nhãn **m2-cloud-once** cho PR. Nếu chưa có nhãn, tạo ở Issues → Labels. Đây là lệnh kích hoạt đợt cloud; không cần chạy CMD.

GitHub Actions tự xác minh account, GraphQL, tên script chưa tồn tại; chỉ triển khai Worker test và DO riêng, cấp khóa ngẫu nhiên trong runner (hết hạn 120 phút), chạy mã InventoryCore thật qua HTTP/M2, 60 WS, 20 báo hàng, retry và đối chứng; xuất kết quả GraphQL trước/sau vào artifacts.

## An toàn và giới hạn

Chỉ chạy cloud khi thêm nhãn, không chạy khi push code hoặc chụp ảnh. Không đụng Production Worker, domain, Firebase, WMS, FCM, Drive và D172. Traffic runner giới hạn tối đa **700 lệnh/frames** và **120 giây**; khóa hết hạn 120 phút. Mọi thao tác API đều yêu cầu khóa.

**Quan trọng:** DO Requests / Rows Read / Duration và billable quota tính chung trên Cloudflare account với Production. Số liệu GraphQL raw invocations không phải hóa đơn billable DO request; đo từ provider có thể cập nhật trễ. Kết quả Core/cloud PASS chưa thay thế kiểm thử Native APK, Agent, WMS/FCM/Firebase, hoặc Owner Production release gate.
