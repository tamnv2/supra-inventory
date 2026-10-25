# D173-E029 — Đợt 1 phát hành kỹ thuật PASS; FIELD và OWNER vẫn PENDING (25/10/2026)

## Nguồn thẩm quyền GitHub (chỉ xác nhận những gì có chứng cứ)

- **Release production source**: `8725ff454ccd7ed326d323cdee018fd7e0d73213`, protected-merge PR [#732](https://github.com/tamnv2/supra-inventory/pull/732), commit marker `D173-E026_PHASE1_RELEASE: E028_OTA_TAG_GUARD_REPAIR`.
- **Worker/Web official**: [run 40153859687](https://github.com/tamnv2/supra-inventory/actions/runs/40153859687) `completed/success`; các step `D167 Owner release authorization for worker`, `Deploy Beta Worker, Web assets and Durable Object`, `D170 verify official and legacy host map`, `Verify Beta health, Root secret and SQLite schema` đều SUCCESS. Worker hiện hữu `supra-inventory-beta`, hostname `inventory.supra.cc.cd`. Không tạo provider mới. Đây là **CI/RELEASE evidence**, không tự suy từ UI ảnh chụp FIELD.
- **Agent v141**: [run 40153859703](https://github.com/tamnv2/supra-inventory/actions/runs/40153859703) `completed/success`; cổng Owner, đối chiếu exact Worker source, Gateway/Rules, build Windows, publish/reuse dedicated release, cập nhật fixed WebView2 bundle đều SUCCESS. Release [relay-agent-v141](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v141) công bố và chứa `Agent.Auto.Confirm.Pick.Pack.exe`, `.sha256`. Tag immutable `refs/tags/relay-agent-v141` trỏ về `d73879ed38948026219a9b022929b10aa33af402`. Kiểm tra pipeline Agent tại HEAD release đảm bảo cùng cây mã `relay-agent/`.
- **Android vc118**: [run 40153859699](https://github.com/tamnv2/supra-inventory/actions/runs/40153859699) `completed/success`. Step bắt buộc `D173 require exact Agent v141 before signed Android vc118` PASS và `Publish signed Beta auto-update release` PASS. Tag [beta-vc118](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc118) trỏ commit `8725ff454ccd7ed326d323cdee018fd7e0d73213`, file `supra-inventory-beta.apk` 20,071,830 bytes và SHA256 sidecar. [inventory-channel](https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel) đã chứa `1291-Bao-Hang.apk`, `pda-latest.json`, APK canonical và `.sha256`.
- **CI protected source**: PR732 exact source SHA `68b729a664ed2a9f905f953df461eb22f176a194` đạt 20/20 PR workflows SUCCESS, gồm `D173 D172 Business Isolation Guard`, `D173 E022 A C and bounded telemetry source checks`, `Project State Guard`, `Repo Authority Guard`, `UI Design Guard`, Android debug build. Receipt gốc `ops/d173-phase1-release-authorization.json` ghim SHA này với Owner E026 scope; các thay đổi sau pin chỉ thuộc ops authority/state/receipt, không ảnh hưởng protected business source. Trên merge main `8725ff45`, Repo Authority, Project State, UI Design và các required deploy steps đều PASS.
- **Khác biệt mã hóa và metadata đã khắc phục**: E027 sửa Windows Python đọc release-notes tiếng Việt bằng `encoding='utf-8'`; E028 sửa kiểm chứng `targetCommitish=main` sang Git tag immutable + ancestor + cùng `relay-agent` tree và Agent workflow success, không bỏ qua gate. Các Android PR CI dùng hàng đợi riêng, Production ký OTA vẫn tuần tự. Lượt Android cũ `40152324251` kết thúc FAILED ở lỗi metadata; không dùng lại làm bằng chứng release.
- Workflow email legacy có một vài sự kiện `push` hiển thị `.github/workflows/d173-email-sender-guard.yml` `failure` nhưng trả **0 job**; đây không phải lỗi các run Production phía trên và chưa có đủ bằng chứng để tuyên bố chức năng gửi mail hỏng hoặc đã thay đổi. Để riêng backlog xác minh, không làm sai kết luận 3/3 phát hành kỹ thuật.

## Trạng thái đúng sau phát hành

| Lớp | Kết quả |
| --- | --- |
| D173 CODE | PASS, PR731/732 merge |
| D173 CI | PASS các regression bắt buộc |
| D173 RELEASE Production Worker | PASS run 40153859687 |
| D173 RELEASE Agent v141 | PASS run 40153859703, tag/exe/sha256 |
| D173 RELEASE Android vc118 | PASS run 40153859699, signed APK/channel |
| D173 FIELD trên PDA/Agent thật | **PENDING** |
| D173 OWNER PASS | **PENDING** |
| D173 Đợt 2 | **HOLD** tối thiểu ba ngày vận hành có log/usage theo cùng version |
| D172 OBPP độc lập | **PENDING/HOLD**; không đổi vòng đời, tài nguyên riêng, APK hoặc Sheet |
| Stable lịch sử | **OWNER-GATED**; không triển khai nhánh Stable |

## Nghiệm thu FIELD cần Owner thao tác thực tế

1. Kiểm tra một PDA đang vc117 nâng lên vc118: tải APK có tiến trình/progress; xác nhận checksum/signature cùng hệ cũ, cài đặt bình thường; App Reporter/Pick báo hàng vẫn hoạt động.
2. Trên một Agent v141, xác nhận danh sách Reporter online hiển thị **thông tin cơ bản, chỉ xem**, không được kick, liên hệ hoặc gọi về; xác nhận không tác động Picker và confirm PL.
3. Kiểm tra hành vi tái báo hàng theo ngày VN bằng thao tác an toàn, không tạo dữ liệu thử gây ảnh hưởng ca; sau ít nhất 3 ngày vận hành lấy log bounded và usage để đánh giá Đợt 2.
4. Lỗi runtime/field nếu có sẽ mở checkpoint D173 tiếp; không hồi tố các CI/release pass thành OWNER PASS.

**Ghi chú:** tài liệu xác nhận phát hành dựa trên GitHub run receipts; việc kiểm tra live Worker health từ môi trường ngoài không cần giả lập: step health thuộc run Worker và source-provenance step Agent đã PASS. Không công bố bất kỳ bí mật, OTP, session hoặc token nào.
