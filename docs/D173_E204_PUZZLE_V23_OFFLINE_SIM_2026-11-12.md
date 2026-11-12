# D173-E204 — Puzzle Diagnostic V2.3: synthetic-only ROI tolerance + drag simulator

Date: 2026-11-12. Owner requested V2.3 to evaluate puzzle recognition and actual dragging in a user-defined region that can be slightly inaccurate.

## Verified baseline

- V2.2 PR938 remains Draft, independent from Agent production and stacked on V2.1 PR935.
- V2.2 Owner field observation: a selected 421 × 290 px puzzle-only ROI at [379,156] stayed aligned while resizing the application and changing Windows Scale and Display Resolution. This is **ROI-only field evidence**, not anti-bot solving evidence.
- Earlier V2.1 diagnostic had 8 attempts, one attempted drag FAIL and seven IMAGE_AMBIGUOUS no-drags; no validated generic recognition/movement fix.

## Allowed V2.3 implementation

- Add **Mô phỏng kéo (offline)** as a separate dialog, with a hardcoded synthetic scene (a source rectangle, a target rectangle, and an orange ROI outline).
- Adjust ROI offsets independently on X/Y from -15 to +15 px to exercise small user-selection drift. The plan refuses to run if the ROI no longer contains both synthetic objects.
- **Mô phỏng kéo** animates a rectangle locally (WinForms timer); the predicted distance is computed from two known synthetic positions, not inferred from a real challenge. It does not read browser pixels or send any mouse command to WebView2.
- Export a numeric local JSON with explicit `synthetic_only=true`, `browser_input_sent=false`, ROI, synthetic expected/simulated distance, and synthetic pass boolean. No account, image, URL, token, or WMS state is exported.
- Retain V2.2 fixed viewport/ROI review and hide the unused live `Test (1 lần)` button; V2.1 implementation is historical and **not** connected to the V2.3 GUI.

## Explicitly not implemented

- Detection/classification of real WMS CAPTCHA images, automated prediction of the missing puzzle-piece slot from challenge pixels, browser input dispatch to pass the challenge, login submission, retries or automatic Confirm Picklist navigation.
- No Agent/Host/Worker/Web/Android/Firebase/OBPP1291/Stable change or production release.
- Synthetic simulator PASS only proves coordinate arithmetic and local animation for pre-labeled rectangular shapes. It cannot substantiate accuracy on random puzzle challenges or actual browser/server acceptance.

## Test gates and acceptance

1. Node source tests: offsets -15/0/+15, no real browser input or image recognition in simulator, local synthetic-only JSON, V2.2 fixed viewport retained, V2.1/V2.2 existing source assertions.
2. Windows x64 native build and startup smoke: synthetic V2.3 TryPlan and existing V2/V2.1/V2.2 synthetic checks.
3. CI artifact exact SHA receipt; PR Draft only. FIELD and OWNER PASS remain separate.
