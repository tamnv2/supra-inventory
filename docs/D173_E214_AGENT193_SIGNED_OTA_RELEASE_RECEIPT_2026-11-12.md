# D173-E214 — Signed Agent193 OTA: technical release receipt (12/11/2026)

## Phạm vi và lệnh Owner
Owner duyệt phát hành các điều chỉnh Agent193 thuộc D173-E212 vào kênh OTA hiện hữu, recorded at `docs/D173_E213_AGENT193_RELEASE_AUTHORIZATION_2026-11-12.md`. Phạm vi **chỉ Agent WinForms**: 70/30 Agent+PickList vs Desktop (giữ 40/60 và 65/35), menu Thoát Agent có hai hành động được bảo vệ, làm mới phân loại mạng cùng toolbar, bốn nút roster căn phải, cột roster ổn định theo viewport/DPI, và đồng bộ hằng số `AgentBuild=193`. Không có Owner FIELD PASS suy diễn.

## Bằng chứng GitHub trực tiếp
- Source Candidate: `relay-agent` pin `5125b4750daf2a2b53f160ed979a2a279b296d18`; signed expected version `relay-agent/VERSION=193`, `AgentConfig.AgentBuild=193`, assembly/file `0.193.0.0`.
- [PR #945](https://github.com/tamnv2/supra-inventory/pull/945) **MERGED** protected two-parent main `4775ace79a072241ae8832d32b4781f6efefb93a`, marker `D173-E213_AGENT193_ONLY_RELEASE:`. Base `d06d1342706a77d8afb9b43b4dd7c02e77694053`.
- [Exact-source Agent193 CI #43166575729](https://github.com/tamnv2/supra-inventory/actions/runs/43166575729) **SUCCESS**, SHA `af88d95651c0e55363b7f3a25bb8ec12ee53273b`: Owner source/scope preflight, Authority/Project-State/Change-Continuity PASS, Agent UI 10/10, D172 independent 74/74, Windows x64 Agent193 + existing Host14 build, startup/roster/HA safety smoke.
- Workflow E213 earlier attempt at SHA `6ae8c326...` failed because CI referenced a nonexistent renamed test path; corrected to existing `tests/d173-e207-agent192-overview-layout.test.mjs` on `af88d956...`. Final exact-source CI confirmed PASS; no bypass or altered business tests.
- [Protected OTA run #43166939885](https://github.com/tamnv2/supra-inventory/actions/runs/43166939885) **SUCCESS**, action log `E213_AGENT193_TECHNICAL_OTA_SHA_PASS tag=relay-agent-v193 sha256=39ae9282bb56acbaee7b14a6e4b5e5748df50df12bd13f9e88ba4d8d6fec42ac FIELD_PENDING`.
- [GitHub Release `relay-agent-v193`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v193) **PUBLISHED** 2026-11-12 06:17:50 UTC, tag target exact merge SHA `4775ace79a072241ae8832d32b4781f6efefb93a`, x64 EXE `Agent.Auto.Confirm.Pick.Pack.exe` size **8,925,184 bytes**, SHA-256 **`39ae9282bb56acbaee7b14a6e4b5e5748df50df12bd13f9e88ba4d8d6fec42ac`**.
- GitHub API readback: `inventory-channel` EXE byte-identical size/hash to v193 tag; `agent-latest.json` last updated **2026-11-12 06:17:55 UTC** and release job independently downloaded/verified manifest tag/hash/size. Fixed Host14 ZIP unchanged SHA-256 **`f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2`**, last updated 2026-11-11 05:24:38 UTC.
- Agent192 signed tag preserved. No Worker/Web/Android/Firebase/D172/Stable source change in PR945. Shared Worker automatic job on main push was **blocked by its separate Owner release gate** (not a Worker release authorization). No changes to Cloudflare/Fire provider quotas requested by Agent193.

## Kết luận tách cấp
- **CODE:** PASS, source exact pin verified.
- **CI:** PASS, including independent D172 and Windows-native smoke.
- **RELEASE:** PASS signed Tag + official Agent OTA channel same EXE SHA + source merge.
- **FIELD:** PENDING (chưa kiểm tra Agent193 cài thực tế trên VPS/ADMIN-PC; HD/HD+, DPI 100/125/150%, menu OTP/exit, network button, realtime roster, tray/OTA).
- **OWNER PASS:** PENDING; không tự suy diễn.
- **D172:** PENDING/HOLD riêng. **Stable:** OWNER-GATED.

Tài liệu này là chứng nhận kỹ thuật sau phát hành, không ra lệnh phát hành lại, không cho phép đụng các thành phần nghiệp vụ dùng chung và không lưu user/log hoặc dữ liệu riêng tư.
