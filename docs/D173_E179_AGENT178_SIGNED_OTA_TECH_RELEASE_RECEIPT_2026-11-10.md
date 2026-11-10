# D173-E179 — Agent178 signed OTA technical release receipt (2026-11-10)

## Scope and source
- Owner command: native Windows Agent Overview top 50% fully auto-sized, no horizontal/vertical scroll; active-session list bottom 50%, vertical-only scrolling. Preserve existing Agent business behavior, RBAC, WebView2 Host13, source services and providers.
- Repository: `tamnv2/supra-inventory`. Code PR **#897**, protected **merge** `0ee1ecc669ee992ab23e6a359fc678aca8e2fb06`, exact Owner marker `D173-E179_AGENT178_ONLY_RELEASE:`.
- Source candidate CI pin: `6a8dfe8206c0b0d7f465e00d584aa083b392e538`; **35 succeeded, 1 conditional skipped, 0 failed**. Receipt-only head `adfbcbd3671520758f048c22b2e09ab65efa3992` had the same CI result. Native Windows Agent, Android compatibility, D172 shared regression, UI guard and E175 scope tests passed. No agent source drift after source CI pin.

## Production signed and OTA evidence
- Protected GitHub Actions **run 42744235352** (Verify Beta Relay Agent; official `inventory-channel`), `head_sha=0ee1ecc669ee992ab23e6a359fc678aca8e2fb06`: **completed/success**.
- The release job logged `D173_E179_AGENT178_EXACT_OWNER_SIGNED_RELEASE_GATE_PASS`, `E179_SIGNED_AGENT177_CHANNEL_AND_EXISTING_WORKER_PASS__NO_PROVIDER_REDEPLOY`, `E153_EXISTING_HOST13_SHA256_AND_ARCH_PASS__NO_REPUBLISH`, and `Updated stable Agent runtime channel inventory-channel -> relay-agent-v178`. “stable Agent runtime channel” is the old script's naming for the official **inventory-channel**, **not** an authorization to modify the protected legacy Stable environment.
- Signed GitHub Release tag: **`relay-agent-v178`**, published `2026-11-10T02:41:55Z`, URL `https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v178`.
- Canonical EXE asset: `Agent.Auto.Confirm.Pick.Pack.exe`, **8,889,344 bytes**, SHA-256 `082dbb9cfe493bdc814d85b5fe6822ad65c05b38a2628dd9f89f43c431834807`. Released matching `.sha256` asset. The `inventory-channel` EXE asset has exactly the same size and SHA-256; `agent-latest.json` was republished.
- Prior Agent177 signed tag verified, active Worker SQLite health passed; existing Host13 reused unchanged. No Agent178 release of Web, Android, Worker, Firestore, D172 or Stable was authorized or performed by this Agent workflow.
- Other main-push Worker/Firestore/legacy host-compatibility checks rejected this Agent-only release scope and reported failure. Those are **not** evidence of Agent178 signed failure; they require separate authorization to deploy any provider resource. The Agent signed workflow itself succeeded.

## State boundaries
- **CODE:** COMPLETE (source CI pin above).
- **SOURCE CI:** PASS (35 executed PASS + 1 conditional skip).
- **SIGNED RELEASE / OTA CHANNEL:** TECHNICAL PASS (tag, assets, digests, channel and GitHub Actions receipt).
- **FIELD:** UNVERIFIED (no real Operator Windows screen/DPI inspection or live user installation attestation).
- **OWNER PASS:** false until explicit Owner acceptance.
- **D172:** PENDING/HOLD independent and unchanged. **Legacy Stable:** OWNER-GATED unchanged.

This receipt records an already-completed Agent178 release. It does **not** trigger another binary build, republish any provider, or infer FIELD/OWNER acceptance.
