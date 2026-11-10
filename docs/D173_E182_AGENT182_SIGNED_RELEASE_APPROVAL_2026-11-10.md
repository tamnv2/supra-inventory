# D173-E182 — Owner phê duyệt phát hành Agent182 (10/11/2026)

## Owner authorization
Owner command: **"Yêu cầu phát hành!"** immediately after reviewing D173-E182 PR #906 Agent181 FIELD FAIL correction. This is explicit approval to **finish source CI, protected merge and publish a new signed Agent182 version**. No overwrite/re-tag Agent181.
Scope strictly Windows Agent only: overview 40/60, top 34/33/33, middle Web/PickList 50/50, no Agent resource-sync flicker, evenly distributed session filter/action buttons, Website (online/known online+offline) and original UI functionality retained. No Worker, Web, Android/APK, D172, Firestore/provider mutation, Host13 or historical Stable change. Do not increase provider requests.

## CI and signed release gates
- Existing PR #906 branch `fix/d173-e182-agent181-field-40-60-flicker-20261110`. Use this same PR, do not push to main.
- Version increases once from v181 to v182 in `relay-agent/VERSION`, `AgentConfig.AgentBuild` and net48 assembly/file version.
- `ops/d173-e182-agent182-release-authorization.json` is the only new approval. Old v181 receipt/authorization and release marker remain immutable.
- Native WinForms Windows x64/net48 compile, source tests, D172 isolation, UI/continuity/state guards, no new provider usage must PASS at exact source SHA. Source CI unavailable/pending **must not be marked PASS**.
- Pin verified SHA and actual source CI run IDs in authorization; protected 2-parent merge commit subject begins **`D173-E182_AGENT182_ONLY_RELEASE:`**, release gate checks exact ancestor/source tree.
- Signed OTA workflow checks **Agent181 existing release and inventory-channel agent-latest.json tag v181**, Worker SQLite health, Host13, publishes tag **`relay-agent-v182`** only after all gates.
- Verify signed EXE digest equals `inventory-channel` EXE checksum and OTA manifest references v182. Unrelated Worker/Firestore deployment jobs must skip this exact Agent-only marker.
- FIELD and Owner PASS remain false until Owner tests actual workstation across window widths, 100/125/150% DPI, dark/light and Agent resource/overtime ticks. A technical release is not FIELD PASS.

## Status at authorization
Owner release permission: **YES**.
CODE: branch candidate; CI, exact-source pin, protected merge, release and channel verification: **PENDING until actual evidence**.
D172: independent **PENDING/HOLD**. Stable: **OWNER-GATED**.
