# SUPRA Inventory — Daily provider usage vs runtime logs

**Owner instruction:** 2026-10-20 D171-E038. Manual, indefinite, 21:30 Asia/Ho_Chi_Minh reminder already exists in ChatGPT. Screenshots are provided by Owner, not retrieved automatically. A successful reminder is not proof of supplied evidence or completed analysis.

## Daily workflow

1. Owner supplies images from official Firebase/Firestore/RTDB, Google Cloud Monitoring/Billing/Functions and Cloudflare Worker/Durable Object dashboard, with project/service, units, date window and timezone visible. Exclude account tokens/other secrets.
2. Read scoped `Inventory/Beta/Logs` Drive archives for the **actual same time span** and versioned App/Agent/Web/Worker receipts. Never infer missing device log coverage from Web server log.
3. Normalize Firebase Firestore quota window (Pacific midnight), Google/Cloudflare chart timezone and VN operating day. For 21:30 VN the actual day is not fully complete. Mark preliminary; next-day late arrivals / provider ingestion can update the conclusion.
4. Save one `YYYY-MM-DD.md` per Vietnam business day **after data actually arrives**, never fabricate one. Additional corrections keep clear revision history through PR, never erase earlier contrary findings.
5. Provide observed values by service, comparison, per-business-operation attribution where possible, available log sources and missing archives, failure/retry/HA chronology, confidence tiers, usage/latency trade-offs, and a prioritized owner-reviewed optimization proposal.

## Public-repository safety and evidence format

Do **NOT** commit actual provider screenshots, sensitive raw agent/device logs, credentials, detailed Picker identities, exact SKU/PL or other personal or corporate data. Only minimal necessary derived non-sensitive daily aggregates and uncertainty labels. Raw captures stay in authorized chat or private Drive and may be referred to with sanitized logical aliases (e.g. `log_bundle_A`), not unreviewed Drive links or secret-bearing filenames.

| Column | Meaning |
|---|---|
| date_vn | VN operational date, not automatic provider billing window |
| observation_as_of_vn | last chart capture moment |
| coverage | complete/partial/missing by Android, Agent, Web client, Worker, Google archival receipt |
| provider_window | each provider's actual start/end timezone and hourly/dayly granularity |
| metrics | read/write/delete, requests, CPU/duration, DO SQL/storage and other billed units as supplied |
| metrics_source | official provider dashboard (estimate) vs final billing invoice |
| origin | user traffic, periodic check, listener, retry/reconnect, HA, cron, log uploads or unknown |
| proof | confirmed / supported / unknown; trace/log evidence when authorized |
| candidate | optimization with counterfactual resource and 20/35s ACK, HA and business integrity guardrails |
| owner_gate | proposed / code-only / CI PASS / release authorized / FIELD PASS / Owner PASS, never inferred |

## What NOT to claim

- A local `FirestoreQuotaGuard` request count equals the Firestore billed read count.
- An SDK listener callback equals one billed read or none.
- Worker DO local SQL cursor rows are equal to billable Durable Object costs.
- A Web browser that is closed has sent its local runtime journal.
- An Android device that is off / force-stopped has uploaded at the scheduled minute.
- A log was deleted only because a Worker/Firestore first-hop accepted it: require `DRIVE_SYNCED` receipt.
- A 21:30 observation includes the rest of the calendar day.

This folder is versioned data **policy and template**, not a database of events. Every future day's record must be explicitly sourced and updated through the approved GitHub PR/authority/continuity flow.
