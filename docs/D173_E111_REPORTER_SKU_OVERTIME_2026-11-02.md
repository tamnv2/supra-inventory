# D173-E111 — Reporter realtime / SKU 05:00 / Agent overtime 21:45

**Date VN:** 2026-11-02. **Owner approval:** explicit code and protected production-release instruction; not an unconditional release PASS.

## Executable changes

- **Android Reporter:** filter realtime resolved rows and recent counters by VN calendar first_report_at, preserve pending/overdue legacy OPEN items, one midnight reconcile, preserve lazy overdue cache across unrelated combined snapshots. Do not add tab-driven polling.
- **Android transport:** read-only WebSocket negotiated commands wait up to 250 ms before HTTP hedging; existing mutation response fence and request-id idempotency keep the 50 ms hedge. Measure Cloudflare DO cost and latency after deploy, no unverified billing savings claimed.
- **Worker/InventoryCore:** SKU effective-day validation is based on 05:00–next 05:00 VN, while business report dates and 03:00 batch expiry keep their independent calendar logic. New reporting after 05:00 fails closed until a verified FULL on the new effective date.
- **Agent SKU:** manual before 05:00 references the preceding effective SKU date, with FULL/DELTA chosen durably by the Service. Manual FULL after 05:00 counts as the day's INITIAL_05 DONE; scheduled FULL must not duplicate it.
- **Agent overtime:** local modeless 21:45 yes/no notification; no answer -> normal OFF at 22:15 with no write; yes -> uninterrupted till 00:00, then a 15-minute pre-expiry prompt to extend by each hourly boundary, hard stop at 05:00. Shared CAS authority and first accepted decision remain unchanged.

## Safety acceptance matrix

1. SKU test: 00:00/04:59:59 old FULL accepted, 05:00 new FULL pending, 05:01 manual FULL DONE accepted, scheduled FULL does not rerun, noon/evening DELTA preserved. Manual before 05:00 always belongs to prior effective SKU day.
2. Reporter: replay old resolved events with queue/overdue pending separately; no N-1 rows or counters on recent tabs; tab switch causes zero extra snapshot and no repeated overdue GET. Test websocket gap/resync, no cursor corruption and bounded fallback.
3. Agent: 21:44 no prompt, 21:45 prompt appears once without blocking Confirm; no response or NO -> OFF 22:15. YES -> 22:15 through 00:00 online, subsequent T-15 yes/no +1h at full-hour boundaries, hard cutoff 05:00. Two Agents CAS compete; one winning decision is authoritative.
4. Existing release gates: TypeScript compile and Node tests, Android Gradle + current-version signing, native Windows Agent build and schedule self-test, no changes to WMS credential flow/Confirm, D172 shared-backend regression and isolation, owner-scoped resource/security checks. Never log secrets.
5. Deployment order after all required gates PASS: shared Worker/InventoryCore + Web assets exact SHA and official /health + persistence checks; signed Agent monotonic version and OTA channel, then signed Android monotonic vc and manifest. Keep D172 independent PENDING/HOLD; no Stable or new provider resource. Field and Owner PASS remain pending after technical release.

## State

- CODE: branch candidate, commits in PR; CI: PENDING until verified exact head; RELEASE: NOT YET VERIFIED; FIELD: PENDING; OWNER BUSINESS PASS: PENDING.
- Risk: authenticated user-visible business day changes, schedule Firestore coordination and Android realtime cursor; rollback must be forward-only compatible and protect existing business data.

## Release recovery R1 — 02/11/2026 (PR #818)

- PR #817 merged to main as `cb6b2d56feb1d4c4905ee784d40fc250b117e78a` under Owner-approved E111 release marker.
- Worker/DO/Web technical release run `41355402933` **SUCCESS**; verified official health, storage and business API, not FIELD/Owner acceptance.
- Agent163 release run `41355402895` **FAILED** at legacy `D169 require matching Beta Firestore Rules before publishing Agent`. Firestore Rules were intentionally unchanged and release job skipped; the old same-SHA dependency was not applicable to E111.
- PR #818 edits only Agent release workflow, targeted test and this E111 documentation/state: check original E111 owner/executable CI pin, byte-identical Firebase Rules versus original E111 base, then reuse existing Rules without re-deploying them; mandatory Worker-first health, native Agent build/signing, and Android Agent163-first guard remain active.
- No change to Service/Web/Android/Agent executable source, D172 OBPP, Firebase Rules, Gateway, Stable, secrets or production SQLite schema. The already published Worker is not declared rolled back.
- Follow-up release must be gated by fresh exact-head PR CI and release marker, then signed Agent163 and only afterward Android vc123. Push-only sender-guard zero-job failure remains a separately tracked CI workflow issue; no assertion of email delivery failure.
- Current status at recovery patch: Worker/Web RELEASE TECH PASS; Agent/APK RELEASE PENDING; FIELD/OWNER PENDING; D172 independently PENDING/HOLD.

## Release recovery E113 — 02/11/2026 (PR #819)

- Recovery PR #818 merged on main `0ae65f3fe35821634ca4226ced7a0b2d42e47aa2`. Worker/Web revalidation run `41356364926` SUCCESS.
- Agent163 release run `41356364949` then reached another historic same-SHA dependency: the unchanged registered Agent operations Gateway. This is not evidence of a Gateway failure; no E111 Gateway deployment was authorized or needed.
- PR #819 adds exact E111 source/Owner gate and byte-identity diff against accepted E111 base before reusing Gateway; it does **not** deploy or change the Gateway.
- Android vc123 requires another main push with an Android path change after Agent163 signing. A user-visible vc123 release-note addition (no APK behavioral source change) re-triggers the existing signed Android workflow and all its Worker-first/Agent-first protection.
- Before PR #819 can merge, fresh exact-head PR CI must PASS and `ops/d173-e111-release-authorization.json` must be repinned to the PR-tested Android notes tree; no use of the previous executable pin after notes changed.
- D172 PENDING/HOLD; Stable OWNER-GATED; no credential or source changes to shared Firebase Rules, Provider Gateway, WMS/HA or physical field status. Email sender guard zero-job failure remains separate.

