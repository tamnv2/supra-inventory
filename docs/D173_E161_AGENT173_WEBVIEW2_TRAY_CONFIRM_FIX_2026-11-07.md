# D173-E161 — Agent173 WebView2 tray/CDP persistence and SFT3 Confirm (07/11/2026)

## Owner-approved scope
Owner explicitly approved every P0/P1 repair in Agent172 VPS FIELD failure review, including code, gated CI, signed Agent-only OTA. Scope is Windows Agent173/Host13 reuse, source tests, owner authorization, CI and continuity only. No changes to Firebase Rules, Worker, Web, Android/PDA, service data, Cloudflare, WMS API, or OBPP D172. Stable remains OWNER-GATED.

## Sanitized VPS field facts (07/11, VN)
- Agent172 detected in 19:06 log from D173_E159 TRAY and Picker lock COOLDOWN 300000ms, unlike older 18:38 log.
- 18:40:12 TRAY HIDE; 18:40:15 NEW Host/INITIAL_NAVIGATE; 18:40:23 TRAY RESTORE; 18:40:27 NEW Host/INITIAL_NAVIGATE. 18:41:25–31 repeated hide/restore then NEW Host.
- 18:40:20 and 18:40:32: TARGET_NOT_UNIQUE, HY1_SFT3_AMBIGUOUS, arrows=3, targets=3; selection based on smallest card could vary by DOM layout.
- Prior session observed WMS_CONFIRM_RESPONSE_MISSING after final click, which is UNKNOWN, neither confirmed failure nor successful mutation.
- This proves recreation following tray changes, not whether a WebView2 ProcessFailed, a CDP fault or Windows HWND parent transition initiated it. No fabricated Windows crash attribution.

## Repairs
1. Keep WinForms parent maximized and hide instead of minimizing its HWND; intercept SC_MINIMIZE; tray restore never navigates.
2. Distinguish Host ALIVE with lost CDP from confirmed Host EXIT; never kill or navigate a live authenticated Host due to a transient CDP fault; back off reconnection 5s; restart only after real exit with initial 15s throttle; local sanitized Host generation/target drift audit, no URL/profile/token.
3. Dashboard arrow must belong to a uniquely scoped HY1/SFT3 card; never guess from geometry, retry DOM-only for up to 10 seconds on ambiguous rendering, then fail closed without extra navigation.
4. After final Confirm click with no fresh result, preserve read-only exact same-row verification and existing PDA public result codes. Log CLICKED_RESULT_UNKNOWN vs CONFIRMED_BY_EXACT_READBACK and forbid a second business click.
5. Preserve Host13 x64 profile, input shield, E159 5-minute sync, Office/WMS, Fire quota, HA leases, signed Agent channel, no new Cloudflare/Firestore traffic.

## Gates
- Agent173 x64/native/source CI, synthetic three-card DOM selection, prior E159/E149 tests, D172 independent regression, HA/PDA safety and no direct provider mutation.
- After signed OTA publication, Windows FIELD requires 100 tray/restore cycles, >2h hidden, same actual Host PID/CDP target and no tray-triggered navigation, real SFT3 multi-card login and WMS expiry, confirm exactly once, 5-Agent/40-PDA checks.
- Reuse exact signed Host13 ZIP SHA256 36ba2f8184f8f6dc59b572147b08ca5c43fe5ebe3ff84a181d75b5fbd729c694. Protected PR + exact source CI receipt + D173-E161_AGENT173_ONLY_RELEASE merge marker + signed relay-agent-v173 tag and inventory-channel digest.
- CODE: SOURCE READY; CI: 34 SUCCESS, 1 SKIPPED, 0 FAILED at 73470873fb6ebb623f783d711bc3728a8d189aaa (native E149 and D172 PASS); RELEASE: PENDING; FIELD: PENDING; OWNER PASS: PENDING. Green CI is not physical Windows field proof.
