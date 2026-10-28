# D173-E096 — Agent157 FIELD UI/Usage corrections (28/10/2026)

## Owner's 13 requested changes
Exact VPS/admin/tamnv2 Usage rights; borderless maximized Agent and in-app hide; accurate 06:00 / 14:00 / 22:00 usage charts; Email actual and target percentage without forecast; restore v151–153 visual principles; stronger predicted-overage background; all authenticated toolbar operations on one line; roster from 50% to 70%; true 1-second Desktop resource sampling; distinct Cloudflare/Firebase/Google surfaces; remove AI-to-Owner explanations; larger service headings; single Vietnamese-local HH:mm:ss dd/MM/yyyy source time below title.

## Impact and safety
- WinForms Agent-only presentation changes; no new polling, timer, storage or business WMS/HA/Confirm/Picker/ACK operations. Absolute 06:00–22:00 axis positions from sample timestamps; future time and provider gaps stay blank. Source timestamp from collected_at, not the device clock.
- Borderless maximization uses working area, existing in-app hide/tray/restore/protected exit and RDP resizing. One compact action row has short labels where needed; auto-column sizing remains forced on. Operational roster gets 70% main height and upper area 30% (low screens may scroll).
- Cloudflare blue / Firebase amber / Google green dark/light tinted backgrounds; valid forecast or actual >=100% gives red high-risk whole-card emphasis, >=85% amber; missing data remains dimmed. Bring visual hierarchy back in line with v151–153 design intent; verify physical native render before Owner acceptance.
- Worker read-only Usage authorization expands from exact vps to exact vps, admin, tamnv2 only, independently verified Agent Firebase session and base ADMIN or PICKPACK_ADMIN role; no generic ADMIN broadening. This touches shared production Worker ingress: D172 auth and API isolated regression mandatory.
- Cloudflare Email Sending Analytics is zone-wide, not per no-reply sender. The previously requested approximately 100/day is treated ONLY as an internal planning objective, normalized here as 100 per rolling 24h to match the available Zone Analytics 24h source; never a verified Cloudflare free allowance. When a valid 24h total exists but no email was sent within the 06:00 operational shift, show the authentic 24h total instead of N/A; label the rolling interval explicitly. Actual count must come from zone data, never fabricate a zero, percentage, or projected count from missing source.
- Each newly allowed Agent can query the existing 5-minute read-only Worker route; isolate-local cache mitigates repeat provider calls but does not guarantee a cross-isolate shared cache. Extra Worker requests/CPU/upstream cache misses are possible. No API source token in EXE or public repo.

## Test matrix
1. Login vps/admin/tamnv2 with authorized real base roles -> tab and 200; generic Admin, Reporter, Picker, invalid session/role -> no access/403.
2. Native Windows x64 build/startup; 100/125/150% DPI, RDP, Alt+Tab, borderless tray/restore; all action labels visible and responsive; compare true 1-second samples vs selector after startup and restore.
3. Chart sample 06:00–18:00 positions 14:00 correctly, leaves 18:00–22:00 empty, breaks over missing intervals. Warning visible in light/dark; Email valid/missing/no permission values.
4. Worker TypeScript, auth negative tests and complete shared D172 business/Sheet isolation, Agent WMS/HA regressions, source pin and protected PR CI.

## Boundaries
CODE CANDIDATE / CI PENDING / RELEASE NOT AUTHORIZED / FIELD NOT PASS / OWNER NOT PASS. No signed Agent158 or Worker production deploy in this change without a new explicit release authorization. D172 remains independent PENDING/HOLD and historical Stable remains OWNER-GATED.

## Live-provider uncertainty
Source shows the Email screenshot's N/A arises when source-backed current-window count is unavailable. Without a captured real Cloudflare zone response one cannot yet distinguish provider NO_DATA, NO_SCOPE_DATA, permission, or interval mismatch. The source change must not be described as actual Email production data PASS before FIELD verification.

## Owner signed release approval (28/10/2026)
Owner explicitly commands CODE+deployment to Agent158. Previous CODE-only release boundary is superseded solely for the existing registered read-only Worker Usage RBAC and signed Agent158. Authorization: `ops/d173-e096-agent158-release-authorization.json`; protected marker `D173-E096_AGENT158_WORKER_RELEASE:`; source-pin gate `tools/d173_e096_agent158_release_gate.py`. Worker-first production health + same-SHA verify, then native signed Agent158 OTA tag + inventory-channel SHA256 receipt. Do not touch Android/Web/OBPP/Firebase Rules/Gateway/Stable, and do not mark real Windows FIELD or Owner PASS without evidence. Existing E096 source/UI test must be rerun at the exact final HEAD after version bump.
