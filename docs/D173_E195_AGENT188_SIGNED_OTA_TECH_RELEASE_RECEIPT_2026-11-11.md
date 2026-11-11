# D173-E195 — Agent188 signed OTA technical release receipt (11/11/2026)

## Owner-approved scope
Owner directed signed Agent188 based on actual Agent185 runtime, with logging to diagnose blank Web tab after WMS login and overlapping buttons. Five Agent controls ordered `Chọn Agent chính | Cập nhật | Chạy nền | Đăng xuất Agent | Tắt Agent`; roster heading/sample text removed; search first within compact one-row roster toolbar. Horizontal toolbar scrolling is allowed only when the viewport cannot fit full measured caption widths. This is **D173 Agent-only**, unrelated D172 business change; Stable remains OWNER-GATED.

## Verified source, CI, release
- Signed Agent185 source base: `relay-agent-v185` tag commit `ca14deee4999f5f31066208c0baa957bec923de7`. Agent188 source pin `57c408ba25542ba61612d3ed38b0e9e485cce767`; only 10 reviewed Agent runtime files deviate from v185; v187 E190 in-process browser files deleted.
- Owner-approved source PR [#922](https://github.com/tamnv2/supra-inventory/pull/922), merged **two-parent** to main `a8ff7fa267702655558ffcb1acd53b159ff1f2a6` with marker `D173-E195_AGENT188_RELEASE:`.
- Scoped exact PR source/native CI: [43044129004](https://github.com/tamnv2/supra-inventory/actions/runs/43044129004), **SOURCE PASS, Windows x64 native build/smoke PASS, D172 source isolation test PASS**. This is NOT a statement that all legacy unrelated workflow checks passed.
- Protected signed OTA: [43044971567](https://github.com/tamnv2/supra-inventory/actions/runs/43044971567), **SUCCESS**. Release script injected and checked existing Firebase and Google Apps Script Gateway config in Windows beta build environment (values never committed). Log readback: `E195_AGENT188_TECHNICAL_OTA_SHA_PASS`.
- Public signed GitHub Release [relay-agent-v188](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v188) PUBLISHED **2026-11-11 15:08:08 UTC**. Asset `Agent.Auto.Confirm.Pick.Pack.exe` **8,906,752 bytes**, SHA-256 **`822a705fe1d099fd6ffec81558acd124c9c0410ec1da2b39a01cd78595551126`**.
- `inventory-channel` EXE and checksum updated **15:08:10–15:08:11 UTC**; `agent-latest.json` updated **15:08:12 UTC**. GitHub API confirms EXE asset size and digest **identical** between v188 tag and `inventory-channel`. Signed workflow downloaded tag and channel assets, compared manifest, EXE, SHA checksum, size and tag before PASS.
- Existing Host14 Fixed Runtime bundle was reused, no Host source release or new 320 MB upload. Worker and Firestore automatically triggered legacy runs but respective owner authorization steps **FAILED CLOSED** before provider modification: Worker run [43044971558](https://github.com/tamnv2/supra-inventory/actions/runs/43044971558), Firestore run [43044971581](https://github.com/tamnv2/supra-inventory/actions/runs/43044971581). These failures do not represent Agent188 release failure, and no Worker/Firestore deploy was authorized.
- No Worker/Web/Android APK, Firebase Rules, D172 business assets or Stable were released by E195.

## Acceptance boundaries
- **CODE PASS:** signed v185-derived Agent188 runtime + approved UI/diagnostics source.
- **Scoped CI PASS:** source/native Windows x64/D172 independent source tests, exact source pin.
- **Signed Agent188 RELEASE PASS:** GitHub tag, EXE SHA-256 and OTA channel readback verified.
- **FIELD PENDING, OWNER PASS PENDING:** v185 was described by Owner as `tạm ổn` not as a fully verified Web tab fix. Current v188 diagnostics report DOM/host state but **do not prove actual rendered pixels**. Real-world checks: install on original three Agents; Web Confirm login then visible content, manual confirm, tab/tray/reopen, 1280×720/1366×768/1600×900/1920×1080 with DPI 100/125/150%; roster five actions no overlapping; exact Drive-synced log receipt. A reported visual problem is not PASS until physically checked.

## Checkpoint policy
Only non-sensitive version, workflow, hash and test facts retained. No WMS page contents, personal data, tokens, URLs carrying credentials or raw log ZIP in public repository.

## VPS field-log review — 22:29–22:57 Vietnam time, 11/11/2026

**Evidence (Owner-supplied log uploaded through existing Google Drive, sanitized semantic summary only):**
- VPS installed `relay-agent-v188` at 22:29:31 with release SHA prefix `822a705fe1d0`; log upload `GOOGLE_APPS_SCRIPT` returned PASS at 22:29:45 and 22:29:49. No raw identifiers, URLs or log content are copied here.
- 22:29:53 login/dashboard popup flowed into WMS Confirm; `dom_ready=1 data_hydrated=1`. 22:30:00 `confirm_reload=PASS` and `state=READY`: backend navigation/data/authenticated DOM is available, but not proof of visible pixels.
- 22:30:04 `embedded_tab=ATTACHED host_owned=true` followed by `embed_visual_wake=NATIVE_PASS host_controller_sync=REQUESTED paint_proof=UNVERIFIED`.
- 22:32–22:56 repeated `state=READY dom_ready=1 data_hydrated=1 window_found=1 parented=1 visible=0 viewport=1793x897`. **Caveat:** `IsWindowVisible` also returns false when an ancestor tab is hidden. The same interval shows Agent action count returning to 5 at 22:30:06, consistent with switching away from Web. Thus `visible=0` alone does NOT establish the root cause. 22:57:08 a new `NATIVE_PASS` was logged on Web activation (method precondition checks visibility); actual painted pixels still unverified.
- `frames=0` is the reported DOM iframe count in the readiness result, **not GPU-composited frame count**; do not interpret as zero rendered frames.
- Agent188 still uses Agent185's separate-process Host14 exact source (both same Git blob SHA `633fb968ca9fcc2066587db889a82333c5ed371c`). `SupraConfirmBrowser.TryEmbedAgentWindow` rewrites top-level HWND to child and calls cross-process `SetParent`; Host14 `PresentationSyncMessage` immediately acknowledges **queue acceptance**, with actual `BeginInvoke` repaint callback guarded by `Visible`, `_activeWeb`, controller readiness and view dimensions, with no result ACK. The best-supported technical suspect for user-visible white content is **WebView2 compositor/presentation lost after HWND reparenting and popup transition**, not WMS login, Confirm DOM, or Drive delivery.
- **Not proven:** the exact cause inside CoreWebView2 compositor (including hidden ancestor, DPI mode, disabled input shield or GPU failure), or whether Host14 repaint callback ran and displayed actual pixels. A positive native ACK does not certify visual render. No device screenshot/per-frame verification is present in this log.

**Scope decision:** read-only analysis. Do not code or release based on this review alone. To prove the last causal step, instrument Host14's post-`BeginInvoke` repaint completion/skips plus effective parent-tab visibility/DPI and an on-device visual check; preserve WMS session, RBAC, input shield, and D172 isolation. FIELD/OWNER PASS stays pending.
