# DATA_LIFECYCLE — Canonical operational data, archive and retention

Status: **CANONICAL PRODUCT SPEC**.

## Transaction authority

`Cloudflare Worker → InventoryCore Durable Object → SQLite` is operational authority.

Google Sheets/Drive support HR source, archive and export; they are not competing primary business stores.

## Core semantics

- report ticket = one Picker report identity/history.
- processing batch = grouped handling of same-SKU unresolved work across Pickers.
- lifecycle/audit event = immutable transition/audit semantics.

These must remain separate in APIs and reporting.

## Retention

- Detailed hot operational retention target: about 60 days.
- Pending/unresolved items survive retention until handled.
- Cleanup may remove only finalized data that has a confirmed archive-export marker.

## Archive

- Archive is batched to the configured Beta archive Sheet/Drive resources.
- Fixed row ranges + SQLite checkpoints/markers provide retry-idempotency.
- Archive mark occurs only after external write success.
- Cleanup runs after archive eligibility is proven.
- Current schedule is daily around 03:15 Asia/Ho_Chi_Minh plus Root manual execution where implemented.
- Do not hot-write every business event to Google.

## Environment isolation

Beta and Stable data are isolated. Do not copy Beta runtime data into Stable by default.
