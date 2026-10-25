# D173-E030 — Sửa lỗi GitHub Actions email guard không tạo job (25/10/2026)

## Nguyên nhân đã đối chiếu trực tiếp source và GitHub

Workflow `.github/workflows/d173-email-sender-guard.yml` xuất hiện `failure` sự kiện `push` nhưng **0 job** trên nhiều commit E027/E028/E029. Lỗi không chứng minh mail, OTP hay no-reply runtime hỏng: GitHub không thể parse workflow YAML.

Trong step `run: |`, đoạn chuỗi ba nháy Python chứa route Reporter D173 không bảo toàn thụt lề YAML. Nhiều dòng khác 0, 6, 8 spaces khi block yêu cầu tối thiểu 10 spaces. Một phần nội dung thành top-level YAML sai, khiến GitHub từ chối khai báo workflow **trước khi chạy job**.

## Thay đổi được phép và kiểm chứng

- Thay riêng biểu diễn chuỗi route Python bằng `"\\n".join([...])` giữ **đúng từng byte** chuỗi TypeScript của `service/src/index.ts`, bao gồm 2 newline cuối. Không sửa Worker code, route, vai trò hay xác thực.
- Bổ sung `tests/d173-e030-email-guard-yaml.test.mjs` kiểm tra các `run: |` không có dòng thụt lề sai, đồng thời route có trong Worker source và hồi quy D172 còn nguyên.
- Thêm nhánh **PR-only** cho đúng `fix/d173-e030-email-guard-yaml-indent-20261025` trong workflow, giới hạn danh sách file cho phép ở CI/authority/docs, đối chiếu chính xác nguyên byte mail/Worker runtime với `origin/main`. Không sử dụng receipt cũ E005 làm quyền phát hành, không cấp quyền Worker Deploy hoặc gửi mail từ PR.
- Giữ nguyên `d173_email_release_gate.py` và `d173_email_activate_gate.py`, `PROJECT_MAIL_SENDER`, token/binding, toàn bộ no-reply logic, D172 riêng và Stable gate.
- Trên bản commit tạo PR734 sau sửa YAML, GitHub đã nhận dạng lại tên thực `D173 Email Service Sender Guard` và bắt đầu chạy job, thay cho lỗi file-path `0-job`; chỉ đánh dấu CI PASS sau khi workflow thật sự SUCCESS.

Đợt 1 D173 Production kỹ thuật đã PASS theo E029 (Worker + signed Agent141 + signed Android118/OTA); E030 là vệ sinh CI độc lập, FIELD/OWNER vẫn PENDING, Phase2 HOLD và D172 PENDING/HOLD.

## E031 — Chứng cứ CI và merge đã xác minh

- PR [#734](https://github.com/tamnv2/supra-inventory/pull/734) toàn bộ **18/18 `pull_request` workflows SUCCESS** tại source `052622d02e4c10198513894943d6366652ea4de5`. Trong đó `D173 Email Service Sender Guard` chạy job thật và SUCCESS (không còn 0-job), D172 isolation, Authority, Project State, UI và D159 đều SUCCESS.
- Protected merge commit [`942847bd50d92c52f6dd715de6b99957efbd672c`](https://github.com/tamnv2/supra-inventory/commit/942847bd50d92c52f6dd715de6b99957efbd672c) chỉ mang CI test/workflow + authority + docs. Đã đối chiếu GitHub Actions sau merge: không còn workflow lỗi được hiển thị với tên file `.github/workflows/d173-email-sender-guard.yml` 0-job; chỉ các guard/source read-only chạy.
- **Không phát hành lại Production**, không đổi mail sender; mốc release Worker/Agent141/Android118 vẫn là E029, FIELD/OWNER PENDING.
