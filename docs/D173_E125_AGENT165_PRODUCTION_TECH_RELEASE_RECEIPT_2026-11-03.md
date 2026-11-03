# D173-E125 — Agent v165 Production technical release receipt (03/11/2026)

- Scope: **ONLY Agent165**, layout Danh sách phiên 60% / thao tác 40%, responsive theo Windows work area, khắc phục Agent WMS SKU CDP replay.
- Source pin `695f9adf1b230ab2f251e8c8e940d967c58fbc35` — 37 GitHub checks SUCCESS, 0 FAIL, 11 inapplicable SKIPPED; Windows native startup/CDP/roster/HA và D172 độc lập đều PASS.
- Merge PR #831: `72a18a2749f104d5608fd2d0b62118757fa219d8`. Production Actions [run 41555653528](https://github.com/tamnv2/supra-inventory/actions/runs/41555653528): **SUCCESS**.
- GitHub Release [relay-agent-v165](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v165) và [inventory-channel](https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel): bản EXE đồng nhất SHA256 `f5c57a36f379963f21402f21bc5ed6eaf372f7d9c894fea990bd39f91b11b773`; checksum file tương ứng hiện diện.
- Existing Production Worker & Firestore deployment workflows: SKIPPED. Không deploy Worker/DO/Web, Android, Gateway, D172, Stable, không sửa database hoặc credentials.
- **CODE PASS · CI PASS · RELEASE TECH PASS. FIELD chưa xác nhận; OWNER PASS chưa xác nhận.** Để nghiệm thu: thực tế Agent v165 trên Windows 1920×1080 và 1280×720, kiểm tra sidebar, nội dung không bị tràn, danh sách phiên 60%, thao tác WMS/PickList, tự động FULL SKU hoàn tất với biên nhận DONE. Không tự đánh dấu DONE nghiệp vụ SKU chỉ từ lease RESERVED.
- D172 OBPP1291 vẫn PENDING/HOLD độc lập; Stable OWNER-GATED.
