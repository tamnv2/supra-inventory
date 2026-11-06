# D173-E145 — Agent168 signed technical release receipt (07/11/2026 VN)

**Scope:** Postrelease evidence checkpoint for Owner-approved E144 Agent168-only deployment from PR849. No new source/provider mutation, no new deployment or release, no D172/Stable change.

## Verified code and release evidence

| Gate | Result | Exact evidence |
|---|---|---|
| E143 source/Owner E144 authorization | PASS | [PR #849](https://github.com/tamnv2/supra-inventory/pull/849), base `c72bf989f69668bad677da47ccc76faa30908aee`; Owner receipt `ops/d173-e143-agent168-release-authorization.json` |
| Exact source CI | PASS | Code pin `412ff18272378a63f8a546c4bf038b88c14db7b7`: 55 checks = **41 SUCCESS, 14 SKIPPED, 0 FAILURE** |
| Final PR head CI | PASS | `08e94dc692e1547b6f8f7410b04b3d325b58f0b4`: 55 checks = **41 SUCCESS, 14 SKIPPED, 0 FAILURE**. Only receipt/state/docs after code source pin. |
| Protected merge | PASS | PR849 merged by GitHub merge commit `d739218ed67c628d70676ffa958d1365cf8d8f0a`, explicit marker `D173-E143_AGENT168_ONLY_RELEASE:` |
| Signed release GitHub Actions | **RELEASE TECH PASS** | [main run #42261720123](https://github.com/tamnv2/supra-inventory/actions/runs/42261720123), exact merge SHA, status `completed/success`. WinForms/native build, runtime regression, unchanged Worker health, Gateway/Firestore reuse, Host12 readback and publish steps all SUCCESS |
| Dedicated Agent168 release | PUBLISHED | [`relay-agent-v168`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v168), published 2026-11-06T17:29:00Z (07/11 VN) |
| Existing `inventory-channel` | VERIFIED | `Agent.Auto.Confirm.Pick.Pack.exe` updated 2026-11-06T17:29:03Z and `agent-latest.json` updated 2026-11-06T17:29:02Z. Tagged and channel EXE SHA-256 identical |
| Worker / Firestore deployments | SKIPPED | main push 42261720048 / 42261720014, intentional Agent-only source isolation |
| Physical Windows WMS/HA/WebView2 | **FIELD PENDING** | GitHub build/native CI does not prove VPS/desktop runtime input behavior, effective OTA installation or true WMS confirmation |
| Owner acceptance | **OWNER PASS PENDING** | No explicit post-install field approval received |

## Exact artifact identity

- Agent v168, canonical EXE asset `Agent.Auto.Confirm.Pick.Pack.exe`, **8,843,776 bytes**.
- SHA-256 **`c51b1aee4574ec190e79b1113380ab777c6d17bbcd4dbc394ac2397d69c30d60`**, identical at dedicated tag and existing runtime channel; corresponding published checksum assets exist.
- Existing WebView2 fixed x64 Host12 bundle unchanged: **321,605,186 bytes**, SHA-256 **`b98298d2c22e1fc963e62dbccf55ca9e06716ca3b3dc0672f66bcde5cb6b6b6a`**.
- No new WebView2 Host build/version. Agent168 uses the already-published owned Host12.

## Strict boundary

- E145 is a docs-only record of an already completed GitHub technical release: **not** a new publish grant.
- No Cloudflare Worker/SQL/DO changes, Android or Web code/deployment, Firebase Rules/RTDB deploy, Functions, Apps Script/Gateway, D172 OBPP, or historical Stable mutation.
- D172 **independent PENDING/HOLD**; Stable remains **OWNER-GATED**.
- To claim FIELD PASS: install/update on actual Windows/VPS, verify embedded WebView2 Host12 (same window, WMS session retained), pinned monitor and shield (no password), manual PickList same results, 50/50 roster and local contact controls, CPU/RAM/HA/PRIMARY and update stability; inspect sanitized device diagnostics. No fabricated pass.

Technical OTA is **DONE RELEASE**; physical rollout acceptance remains separately pending.
