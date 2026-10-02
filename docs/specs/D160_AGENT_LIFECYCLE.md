# D160 Agent lifecycle repair

Status: **OWNER-APPROVED SAME-D160 REPAIR — V97 TARGET**

## Scope

This spec covers the relay-agent-v97 repair for the overlay/history startup lifecycle defect found during Owner field review of v95/v96. It does not change the accepted D160 WMS confirmation contract, provider cadence, Android beta-vc92 or Stable.

## Root cause authority

During Agent construction, D128 overlay initialization refreshes D135 display counters before the D160 History DataGridView is initialized. That path may load current-business-day Picker History. When same-day history already contains rows, the former implementation attempted to render them into a grid with zero columns, causing InvalidOperationException. Because overlay form initialization, initial refresh, show, Settings-card creation and tray-menu wiring were inside one try/catch, the exception also removed the overlay controls from Cài đặt. The business-day key could then suppress a later repaint after History UI construction.

## Required behavior

- History model load/reset is independent from WinForms rendering.
- Current-day history may load before the grid exists; rendering waits for History UI readiness and must repaint an already-loaded day.
- Row rendering is fail-safe when the grid is not ready and must never throw solely because columns are not initialized.
- Bảng nổi Picklist Settings is created independently from overlay-form success and remains visible on overlay failure.
- Overlay diagnostics record sanitized stage information for Settings card, tray menu, construct, counter refresh, show, complete and failure.
- Recovery is bounded to one automatic attempt after D160 UI initialization plus explicit manual **Thử lại bảng nổi**. No repeating timer, provider poll or provider write is introduced.
- Startup-smoke preloads a non-empty current-business-day History file before AgentForm construction and fails unless History repaint and overlay initialization both succeed.
- The v96 confirmation pipeline, WMS hydration/checkbox guards, Usage cadence, log lifecycle, existing agent_sync History transport and closed-day export remain unchanged.

## Acceptance

1. Restart with existing same-day History does not produce `D128_OVERLAY init=FAIL`.
2. Existing History rows are visible after restart.
3. Cài đặt always contains Bảng nổi Picklist, even when overlay-form initialization is forced to fail.
4. Failure state exposes manual retry; success state exposes overlay settings.
5. No new Firestore read/write/listener/poll cadence or provider resource is added.
6. Android remains beta-vc92 unchanged and Stable remains OWNER-GATED.
