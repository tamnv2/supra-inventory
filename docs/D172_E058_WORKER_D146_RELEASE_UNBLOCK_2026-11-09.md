# D172-E058 — Worker D146 legacy Web contract blocks D172-E057 release (09/11/2026)

Scope: exact release-gate repair for the already Owner-approved D172-E057, **not a new business requirement**. D172 remains PENDING/HOLD, FIELD/OWNER PASS false.

## Observed release failure (actual provider GitHub Actions)
- Owner approved E057 code and scoped release; [PR #877](https://github.com/tamnv2/supra-inventory/pull/877) merged protected main SHA `c5326f7849d8782e89ace4927ae3a6b16c694b9b`.
- D172 Android and Backend independent CI, D173 E123 shared Worker business regression, Repo Authority and Project State PASS at PR #877 exact head; release is not implied by merge.
- [Deploy Beta Worker run 42626915467](https://github.com/tamnv2/supra-inventory/actions/runs/42626915467) failed at `D146 source contract guard`, before Cloudflare deploy. The guard checked old 13:15/21:15 literal source strings unless merge subject was D173-E165 or D173-E170; this Owner-authorized D172-E057 merge was not listed. Current unchanged `web/src/runtime-logger.ts` implements approved E165/E167 ten-slot contract; each of the *new* four assertions matches. Rejecting the valid unchanged Web source for a D172 release is a guard-routing defect, not a Web runtime bug.
- [D172 APK release run 42626915344](https://github.com/tamnv2/supra-inventory/actions/runs/42626915344) blocked waiting for exact main Worker health before signing; no new APK release artifact at investigation time. Existing signed `obpp1291-v9` remains production fallback.

## Exact scoped repair
- `.github/workflows/deploy-beta.yml`: add **only** `D172-E057_RELEASE:` to the already approved E165/E170 D146 ten-slot contract assertion branch. Keep every individual real contract assertion; no Web, OAuth, Google provider, gateway, D173 app or Stable code changes; do **not** disable any security guard.
- `tools/d172_release_gate.py`: permit **only** the matching existing Worker deploy workflow under E057's exact-source protected-diff guard, and verify its **full contents** equal the pinned original workflow plus precisely the D146 branch condition and a three-line comment. All other after-pin protected changes remain denied. Preserve E057 source SHA `af2505e037ce89cffebd3bfe8cfecd3b66d6ad9a` and scoped Owner receipt unchanged.
- Required: protected PR CI including Python release gate preflight, D172 Backend/Android regression (existing code already PASS), D173 E123/shared Worker tests, authority/state guard, merge marker `D172-E057_RELEASE:`, successful Worker exact-main `/health` and `/api/obpp1291/status`, followed by separate signed OBPP APK v10+, OTA manifest and checksum readback. Do not reuse older D172 E053 permission or assume another module's passes.

## Evidence boundaries
- CODE merged; original E057 Worker RELEASE failed; signed APK E057 not yet released. FIELD and OWNER PASS false. No real Sheet writes or fabricated PDA tests in this recovery.
- The old APK release run can timeout waiting for Worker old merge SHA; new signed run must be bound to the **new** protected main merge SHA, never an orphaned run.
