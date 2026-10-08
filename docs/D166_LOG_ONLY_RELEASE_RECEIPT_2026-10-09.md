# D166 — technical release receipt (2026-10-09 VN)

Scope: **same D166**, no new workstream, no new runtime change in this receipt.

- Source PR [#516](https://github.com/tamnv2/supra-inventory/pull/516) merged to main `d541c45e57f5c788dda609a15a92d7faa2915378`.
- PR checks: 15/15 PASS including Repo Authority, Project State, Verify Beta Relay Agent, Verify Beta Android, UI Design, D166 Log Only Regression, Web typecheck and related guards.
- GitHub version reference readback: `refs/tags/relay-agent-v123` exists and file `relay-agent/VERSION` reads `123`; `refs/tags/beta-vc103` exists and points to the source containing log-only Android implementation.
- Beta Web source uses `WEB_VERSION=3`; web live release/deployment readback is **not independently verified** by this record.
- Agent v122 is the Owner-selected development baseline for v123, separate from the D165 v120 historic Owner-accepted runtime. A v122 Usage ZIP previous field failure remains independent, Gateway code repaired but authenticated ZIP Owner retest unverified.
- Agent v123/Android vc103/Web v3 instrumentation is logging-only. No added Firestore API call/document read/write, no new RTDB listener or heartbeat, no new timer, no WMS confirmation/ACK/failover code change. Existing log payloads may contain small additional bytes and RAM aggregation costs non-zero CPU; field verify, do not claim no overhead.
- `docs/D166_USAGE_AUDIT_2026-10-06_08.md` retains comparison, read analysis and open hypotheses. No optimization of Firestore/DO approved or implemented yet.
- **Owner field verification PENDING**: true end-to-end usage ZIP, release channel asset/checksum and OTA pickup, HA role stability, WMS/ACK latency, Android real-PDA log completeness, Web actual deployed version, 09/10 provider reads normalized by workload. Stable remains OWNER-GATED.
