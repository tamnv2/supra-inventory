# D173-E199 — Puzzle Recorder V1 độc lập (12/11/2026)

## Lệnh Owner
Tạo trình duyệt độc lập tương tự Agent, tự nhập URL, Bắt đầu/Kết thúc ghi thao tác kéo ghép hình. Không lưu user/pass/token nhạy cảm. Không giả định vị trí mảnh ghép cố định. Sau khi có log thực tế mới phân tích công cụ V2 có đúng một lượt thử mỗi lần nhấn Test.

## Phạm vi V1 và quyền riêng tư
- WinForms WebView2 x64; browser URL chỉ dùng để điều hướng, không ghi URL vào JSON.
- Capture geometry-only chuỗi pointer drag x/y/time, CSS viewport, DPR và frame; giới hạn dữ liệu, không keypress, HTML/DOM text, cookies, request/body, screenshot full-page hoặc gửi mạng trong logger.
- Tự mở bằng phiên WebView2 InPrivate, tắt autosave/autofill, thư mục profile TEMP riêng và xoá best-effort; InPrivate **không bảo đảm zero disk cache** khi trình duyệt đang chạy.
- Ảnh phục vụ phân tích chỉ lưu khi Owner chủ động chọn vùng trò chơi từ preview đang ở RAM. Bắt buộc tự kiểm tra PNG trước khi chia sẻ.
- Không có auto kéo/auto giải trong V1. V2 phải xác minh bằng dữ liệu ảnh vùng trò chơi thực tế, không hard-code pixel.
- D173 diagnostic source riêng, không sửa Agent189/Host14/Worker/Web/Android/Firebase/D172/Stable.

## Evidence
- PR #930: https://github.com/tamnv2/supra-inventory/pull/930
- Exact source commit: d836333acc35f82757006c79dd9e5838eceaac3a
- Source + Windows-native diagnostic workflow: https://github.com/tamnv2/supra-inventory/actions/runs/43079223016 — cả 2 job SUCCESS.
- GitHub Actions artifact: SUPRA-Puzzle-Recorder-V1-win-x64 (retention 7 days); không phải Production OTA/Release.
- Local geometry+privacy JavaScript tests 3/3 PASS. Actual WMS or game page FIELD chưa được kiểm thử.

## Gates
CODE_SOURCE: PASS candidate. NATIVE_BUILD: PASS. FULL CI exact working HEAD: cần chứng cứ sau authority sync. TEST ARTIFACT: available. Production RELEASE: NOT REQUESTED / NONE. FIELD: PENDING. OWNER PASS: PENDING. D172 HOLD. Stable OWNER-GATED.
