# D173-E197 — Agent189 signed OTA technical release receipt

Ngày ghi nhận (VN): 12/11/2026. Phạm vi: **D173 Agent-only**. Đây là receipt sau phát hành của E196; không phải một quyết định nghiệp vụ mới.

## Bằng chứng trực tiếp GitHub

- Owner yêu cầu kiểm thử, code và triển khai E196 trong phiên ngày 12/11.
- PR triển khai: [#926](https://github.com/tamnv2/supra-inventory/pull/926), đã merge đúng protected `main`.
- Main merge SHA: `174572136cfe68d8bf7a0055edc5fec776dc60b8`.
- Exact-source Agent189 CI: [run 43069671771](https://github.com/tamnv2/supra-inventory/actions/runs/43069671771), job source SUCCESS, Windows-native SUCCESS.
- E196 code-only: [run 43069671747](https://github.com/tamnv2/supra-inventory/actions/runs/43069671747), source + Windows-native SUCCESS.
- Authority: [43069671977](https://github.com/tamnv2/supra-inventory/actions/runs/43069671977) SUCCESS; continuity: [43069671934](https://github.com/tamnv2/supra-inventory/actions/runs/43069671934) SUCCESS; independent D172 guard: [43069671924](https://github.com/tamnv2/supra-inventory/actions/runs/43069671924) SUCCESS.
- Protected main release: [43070569628](https://github.com/tamnv2/supra-inventory/actions/runs/43070569628) agent189-ota SUCCESS; gate, beta build configuration injection, native smoke and GitHub tag + OTA SHA readback SUCCESS.
- Published release tag: [relay-agent-v189](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v189) (target exact merge SHA), EXE `Agent.Auto.Confirm.Pick.Pack.exe` SHA256 `679065c708ee8856d023fe80b740b5ef71be92f84c6717a9a1acafdd2e907ba2`; asset ID `736369711`.
- `inventory-channel` alias EXE asset ID `736369900` has **same sha256**; `agent-latest.json` asset ID `736370015` was updated `2026-11-11T17:42:57Z`. Release workflow independently downloaded and validated manifest tag, EXE size, checksum and tag digest, output `E196_AGENT189_TECHNICAL_OTA_SHA_PASS`.
- Host14 ZIP sha256 remains `f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2`, last updated `2026-11-11T05:24:38Z` (prior to Agent189) on `inventory-channel`. Host15/new host callback **NOT DEPLOYED**; existing Agent188 compatibility remains protected.

## Đánh giá PASS rạch ròi

| Gate | Kết quả |
|---|---|
| CODE (D173-E196) | PASS |
| CI source + native Agent189 | PASS |
| D172 isolation + canonical authority/continuity | PASS |
| TECH RELEASE tag & channel SHA | PASS |
| FIELD Web hiển thị không trắng / HD, HD+ / Kích Agent / WMS confirm trên cả ba máy | **PENDING**, chưa có chứng cứ kiểm thử thiết bị |
| OWNER PASS | **PENDING**, không tự suy luận từ CI/OTA |
| D172 trạng thái riêng | **PENDING/HOLD**, không đóng, không triển khai |
| Stable | **OWNER-GATED**, không thay đổi |

Agent189 giữ nguyên Host14 runtime đã phát hành. E196 Host callback/status mới chỉ có trong source và CI build, không tồn tại trong Host14 đã cài; tuyệt đối không báo tính năng Host callback FIELD PASS hoặc tuyên bố đã khắc phục Web trắng khi chưa có bằng chứng pixel thực tế.

Không ghi log nhạy cảm hoặc dữ liệu WMS lên repo công khai. Không tạo/đổi provider.
