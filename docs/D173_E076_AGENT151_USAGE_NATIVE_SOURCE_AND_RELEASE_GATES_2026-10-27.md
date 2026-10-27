# D173-E076 — Agent151 Usage Cloudflare-first (Owner approved code/build + gated signed OTA)

## Scope
Owner approved E075 combined 5-in-1 interface on 27/10/2026, and explicitly requested build and deploy the native WinForms design. Only Agent Windows net48, read-only VPS Usage calculations, theme & local scrolling, source regression tests and release controls may change. Keep existing Worker, Web, Android, Firebase Rules, Gateway, D172 OBPP source/data/Sheet and historical Stable untouched.

## Implemented in PR765
- WinForms native 13-row content layout; Cloudflare fixed account subscription 5 USD versus **per-metric internal 50% included quota**, Cloudflare four primary metrics, Google/Firestore daily panels, dated DO history, concise actual/forecast warnings, audited source detail grid.
- Remove the Usage theme button, Settings theme dropdown, AI–Owner instruction text. One permanent sidebar trackbar 3-position Light/Auto/Dark; AUTO reads Windows AppsUseLightTheme and repaints only on changes. Navigation scrolls independently.
- Outer Usage viewport uses WinForms AutoScroll; nested scrollable cards and DataGridView scroll vertically by pointer wheel and hand wheel to parent at ends. DataGridView retains first visible row/horizontal scroll and outer viewport preserves offset after data refresh.
- Cloudflare day reference: validated included 30-day pool ×0.5/30; **this is an internal daily planning reference and not a provider daily hard limit**. Cloudflare daily actual and source-covered 22:00 projection show 70/85/95/100% severity. Firebase Reads/Writes/Deletes use only their daily quotas.
- Provider does not presently expose an independently verified account billing-cycle start/end and full-period source-backed Cloudflare consumption. **Cloudflare actual cycle alerts and end-of-cycle variable USD charges remain N/A, explicitly missing source**, never invented from a rolling-30d chart. The example numbers in image mockups are not runtime values. Fixed 5 USD subscription is not a 2.50 USD bill limit.

## Source/test/release gates
- Production Agent150 E073 release technical PASS; Usage FIELD FAIL reported by Owner; no inferred OWNER PASS.
- Candidate Agent151 uses exact Owner E076 signed-release gate with fail-closed receipt, cross-module D172 isolation, Windows net48 compile, native light/dark 1376x900 offscreen screenshot smoke, history grid regression, Office/WMS/HA unchanged source, precise version and full channel SHA256 readback.
- New Worker or Firebase Rules deployment must be blocked; existing official Worker health and registered Gateway/Rules source unchanged are verified in the Agent publish workflow.
- Gate order: branch PR source CI → exact tested source SHA pin → protected main merge with E076 release marker → signed `relay-agent-v151` and existing `inventory-channel` manifest verified checksum → independent real installed VPS/FIELD/OWNER acceptance.
- Native offscreen screenshots are not physical Windows 100/125/150% DPI or operator wheel tests; do not infer FIELD PASS.
- D172 always PENDING/HOLD, historical Stable OWNER-GATED.

## Checkpoints
- E076 Owner code/build/deploy approval: 27 Oct.
- CODE/CI status: **pending exact latest PR source verification** at creation.
- Signed OTA RELEASE: **pending**, not inferred.
