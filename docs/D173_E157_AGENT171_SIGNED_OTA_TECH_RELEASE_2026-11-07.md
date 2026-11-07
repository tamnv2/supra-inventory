# D173-E157 — Agent171 / Host13 signed OTA technical release receipt (07/11/2026)

## Owner approval, source and previous failure
- Owner explicitly ordered **“Phát hành agent đi”** on 07/11/2026 for the Agent170 Web Confirm blank tab field failure.
- Original Agent171 code PR [#857](https://github.com/tamnv2/supra-inventory/pull/857) merged main `4006a9ed5b2cecd093dc45bfe1790c984695a38a`. Exact-source CI had 34 SUCCESS, 1 SKIPPED, 0 FAILED; native Windows and D172 guards PASS.
- Initial Agent main run [42342909553](https://github.com/tamnv2/supra-inventory/actions/runs/42342909553) FAILED **before build/release** at the historical D167 release gate. No `relay-agent-v171` tag or OTA mutation occurred in that attempt. Worker and Firestore Rules release gates also failed closed before provider mutation.
- Recovery PR [#858](https://github.com/tamnv2/supra-inventory/pull/858) routed only `D173-E153_AGENT171_ONLY_RELEASE:` through exact Owner E153 gate, preserving the historical D167 gate for every other release. Recovery source CI pin `92dbb4ccbfd459eeeb7d3e1714a429de7d654c15`: 22/22 workflows SUCCESS, including native Agent and D172 isolation.

## Verified protected release
- Protected merge and signed release main SHA: `2d7e8c09ffc01d617ab8e98e38a8a18a39105dd2`.
- Agent release workflow [42343775911](https://github.com/tamnv2/supra-inventory/actions/runs/42343775911) **SUCCESS**.
- GitHub tag [`relay-agent-v171`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v171) points to the exact main release SHA.
- `Agent.Auto.Confirm.Pick.Pack.exe`: 8,863,232 bytes; SHA-256 **`e9052c86d2942a7180157f9b41979a51186fbde453b9474d8ff944ea4e6cc4b3`**. GitHub tag release asset and mutable `inventory-channel` Agent EXE have **matching SHA-256**.
- The existing `inventory-channel` EXE/manifest updated 2026-11-07 05:42:55 UTC; workflow states `Updated stable Agent runtime channel inventory-channel -> relay-agent-v171`. This is the **existing official Agent OTA distribution channel**, not authorization for the separately protected Stable environment.
- Existing WebView2 Host13 x64 ZIP 321,605,288 bytes, SHA-256 **`36ba2f8184f8f6dc59b572147b08ca5c43fe5ebe3ff84a181d75b5fbd729c694`** stayed unchanged (channel asset last updated 04:23:19 UTC). Workflow verified exact Host13 SHA and architecture without republishing its runtime.
- Release run confirms `E153_EXISTING_WORKER_HEALTH_PASS__NO_DEPLOY`, `E153_EXISTING_GATEWAY_UNCHANGED__NO_DEPLOY`, `E153_EXISTING_FIRESTORE_RULES_UNCHANGED__NO_DEPLOY`, `E153_EXISTING_HOST13_SHA256_AND_ARCH_PASS__NO_REPUBLISH`, `E153_EXISTING_HOST13_READBACK_PASS`.

## Scope and acceptance
- Only signed Agent171 published; Web, Android/PDA, Worker/SQLite, Firebase Rules, Gateway, D172 and historical Stable were not deployed by E153. No new provider resources.
- `PICKER_LOCK_LISTEN grpc=PermissionDenied` is separate and **not** declared fixed by this scoped WebView2 repair.
- **CODE PASS, SOURCE CI PASS, TECHNICAL RELEASE PASS** are verified. **FIELD PASS and OWNER PASS remain PENDING**, including Windows tamnv2 physical verification that Web Confirm is visible after embed, protected input remains effective, no separate popup appears, WMS session expiration/login works and confirmations/HA remain stable.
- D172 OBPP independent **PENDING/HOLD**; Stable **OWNER-GATED**. No universal real-field proof inferred from GitHub CI.
