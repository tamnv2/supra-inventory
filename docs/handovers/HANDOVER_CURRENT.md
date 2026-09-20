# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation. Canonical authority is the project state, Owner decisions, affected specs, scope/resource registry and current source/CI. This view is only a fast resume pointer.

## 1. Current canonical markers

- SQLite schema: `7`
- Latest Beta APK: `beta-vc52`
- Web: `D071_IMMEDIATE_RESPONSE_DENSITY_D072_SYSTEM_STATUS_QUOTA_GUARD_BETA_RUNTIME_PASS__OWNER_REVIEW_PENDING`
- Android/Agent: `D085_RELEASE_PASS__SIGNED_BETA_VC52__AGENT_V11__OWNER_FIELD_TEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta checkpoint: `BETA_RUNTIME_PASS_D086_AGENT_V11_RELEASE__OWNER_FIELD_TEST_PENDING`
- Active workstream: `XAC_NHAN_DON_D086`
- Stable: `OWNER_GATED`

## 2. D086 exact checkpoint

D086 Windows Agent v11 is technically released and ready for Owner physical review.

Evidence:
- Runtime/code PR: #92
- Runtime/code main commit: `207a57be6c4d95ab48d174b8af154f122bec7c5e`
- Main Verify Beta Relay Agent run: `35490227885` — PASS
- Main UI Design Guard run: `35490227907` — PASS
- Release tag: `relay-agent-v11`
- Release id: `392316320`
- EXE asset id: `576140376`
- EXE size: `148992` bytes
- EXE SHA-256: `dce3a779c86096a6a82ed1991e385e7e6acea2d9ba75078e8bf2371eb1387659`
- Signed Android remains `beta-vc52`.

D086 changes only Windows Agent local session/UI/lifecycle mechanics:
- captured HY1 WMS request-session may be stored only in a DPAPI `CurrentUser` encrypted local file;
- startup is saved-session first: decrypt → read-only validate → all-date Picklist preload → continue without browser when valid;
- if saved session is unusable, clear it and locally open the dedicated WMS browser for authorized reacquisition;
- successful real WMS preload/refresh renews the encrypted session file;
- main UI is `Tổng quan / Cài đặt`; overview focuses on Supra login/ready, connection status and concise model information;
- ADMIN login, network/transport tests, overlay settings and logs are under Settings;
- locked overlay uses true cross-process click-through behavior;
- normal title-bar close is removed; graceful shutdown requires the authenticated ADMIN's locally protected password verifier;
- current-user autostart remains and a best-effort sleep-only watchdog restarts unexpected main-process exits;
- old continuous ~4-second SSID/netsh polling is removed; background UI monitoring is coarse for weak laptops.

Important limitation: normal user-mode Windows software cannot truthfully prevent the same Windows user from killing both Agent and watchdog. Absolute anti-kill behavior would require elevated/service controls, which D086 does not add.

## 3. Unchanged D085 business/HA behavior

D086 does not replace the D085 processing model:
- one sticky WMS-ready ACTIVE Agent;
- 3-second active heartbeat;
- about 10-second failover to a standby Agent;
- pending request takeover exposes `Đang chuyển người xử lý...` to PDA;
- when no WMS-ready Agent exists, PDA instructs Picker to go to the specialist desk;
- all-date exact `PickListCode` cache;
- fresh-miss guard 10 seconds + single-flight refresh;
- final NOT_FOUND anti-spam: 3 within 60 seconds → 5m, then 30m, then 60m locks; escalation resets after 24h without new lock.

WMS remains signed read-only GET only. Confirmation/mutation is not implemented or authorized.

## 4. D078 remains open

D086 does **not** select the final PDA ↔ Agent transport.

- Current Beta RTDB relay remains the temporary carrier.
- Final transport selection waits for physical Office-network evidence under D078.
- Do not provision/switch to a new primary transport based on assumptions.
- Do not reopen normal Báo hàng offline/fallback architecture.

## 5. Owner physical review — next action

Use the released `relay-agent-v11` on the company laptop; signed Android remains `beta-vc52`.

Review:
1. Main layout: `Tổng quan` must stay clean; ADMIN/test/overlay/log controls belong in `Cài đặt`.
2. Establish one authorized WMS session, restart Agent, and verify saved-session validation + Picklist preload succeeds without reopening browser while the session is still usable.
3. Verify expired/invalid saved session is cleared and local browser reacquisition opens.
4. Lock overlay over a real desktop icon/application control and verify the underlying object receives the click; unlock and verify dragging works.
5. Verify no normal X shutdown; `Tắt Agent...` rejects the wrong ADMIN password and accepts the ADMIN password previously authenticated in Agent.
6. Kill only the main Agent process and verify watchdog restart. Do not treat this as protection against killing both processes.
7. Observe idle CPU/RAM on the weak laptop.
8. Where practical, verify D085 sticky ACTIVE/STANDBY, ~10-second takeover, no-Agent guidance, cache and anti-spam in the same field cycle.

If any point fails, provide the observed behavior/screenshot and sanitized Agent log only. Never provide password, token, WMS session file, Authorization/APISID/SID/SCID/USID, signature/nonce or raw WMS response payload.

## 6. Resume command for a new chat

A new session can start with:

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và tiếp tục từ checkpoint hiện tại.**

The AI must fresh-bootstrap GitHub and continue from the D086 Owner physical review unless the Owner gives a newer explicit command.

## 7. Authority pointers

Always bootstrap in this order:
1. `ops/authority-manifest.json`
2. every entry in its `bootstrap_order`
3. recent commits + CI
4. relevant live source

Primary canonical files:
- `ops/project-state.json`
- `docs/OWNER_DECISIONS.md`
- `docs/specs/`
- `ops/project-scope.json`
- `ops/resource-registry.json`
- `ops/owner-actions.json`
- `docs/OPERATING_PROTOCOL.md`

No manual end-of-session handover is required. No manual chat-memory reconstruction is authoritative. Stable remains OWNER-GATED.
