# D173-E204 — Puzzle Diagnostic V2.1 (Owner-approved FIELD FAIL investigation)

Date: 2026-11-12. Owner approved V2.1 diagnostic work after 35 V2 field tests (0 PASS).

## Evidence and problem

- 35 one-shot tests; 25 no drag (12 SOURCE_OUTLINE_NOT_FOUND, 11 IMAGE_AMBIGUOUS, 2 HANDLE_NOT_FOUND), 10 drag attempts all Owner FAIL.
- Existing V2 logs have no image pair or independent true slot annotation; intermittent short drag cannot be attributed to visual positioning or actual mouse mechanics.
- Keep V2 matcher/input path unchanged in V2.1; diagnostics are **not an accuracy fix**. Previous source/native CI PASS is not FIELD PASS.

## Owner-approved diagnostic scope

- Standalone Windows WinForms/WebView2 browser only, no login automation. Require Owner to manually pick the puzzle-only region on a live screenshot (size bounded to 80% of viewport width, 70% height), preview and explicitly confirm no sensitive content before enabling evidence.
- On each **Test**, keep selected ROI *only in RAM*: one pre-test and one post-test PNG; never write a full-page image, browser URL, credentials, cookies, token, typed data, or form content. When the browser area moves out of ROI, abort and require new manual region.
- Modal review of each pair: click center of left movable piece and center of target on BEFORE; optionally center of observed piece on AFTER. Confirm both images contain no sensitive material. If declined, discard image bytes, retain geometry-only Test record.
- Log exact predicted delta, independently annotated reference delta, signed error, acknowledged CDP pointer path, and optional observed position. Input event acknowledgments are not proof that the page physically moved the piece.
- Press PASS/FAIL separately as before for attempted drags; one Test button press = at most one existing bounded drag, no retries. No additional network calls beyond visiting Owner-entered site. No screenshots auto-upload.
- **Lưu bộ chẩn đoán** explicitly confirms and writes a ZIP of only reviewed cropped before/after images plus geometry-only JSON to a user-chosen path. Original JSON-only Lưu log is retained.

## Safety and acceptance

- Expected 10 varied Owner field attempts: ideally at least 3 short-drags, 3 detection failures, and several other images. Evidence collection is bounded to 20 Test attempts/session. No automatic target image or server verification claim.
- Source & native CI gates on exact commit, Win x64 startup smoke, no Worker/Web/Android/Agent/D172/Stable change, no secrets or WMS captures in public repository.
- If image review is canceled, image bytes are cleared; no field screenshot or user data committed publicly.
- Source uses same V2 diagnostic branch lineage, separate V2.1 PR; keep PR #931 V2 candidate and Agent190/191 Production independent. No merge/deploy or Owner PASS inferred.
