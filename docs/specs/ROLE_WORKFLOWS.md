# ROLE_WORKFLOWS — Owner-approved business scenarios

Status: **CANONICAL PRODUCT SPEC**. Derived only from active Owner decisions; open items are explicitly marked.

## Picker workflow

1. Authenticate with provisioned username/MNV + password.
2. Search the locally cached SKU catalog; catalog authority remains the server.
3. Select SKU/product and submit an out-of-stock report.
4. Server enforces unresolved dedupe by `Picker + SKU`.
5. If other Pickers already reported the same SKU, each Picker keeps a separate ticket while the work is grouped into one processing batch.
6. Picker sees own report state via authoritative API + foreground WebSocket resync.
7. An unresolved mistaken report may be withdrawn within **60 seconds server time**.
8. When a batch is resolved, affected Pickers receive foreground invalidation/reload-from-server; FCM is background best-effort notification only.

No fake offline success is allowed. Creation of a brand-new report while fully offline remains an open decision.

## Reporter workflow

1. View unresolved batches ordered by:
   - higher affected Picker count first;
   - tie → earlier `first_report_at` first.
2. Open batch detail and see affected Picker tickets.
3. Resolve as `HAS_STOCK` or `SKIP_ALLOWED`.
4. `SKIP_ALLOWED` may be corrected to `HAS_STOCK` within **5 minutes server time**.
5. Ticket, batch and lifecycle/audit event remain separate records.

## Admin workflow

Admin inherits Reporter workflow and additionally:
- manages Reporter accounts;
- configures HR Sheet source and runs Preview → explicit Apply for Picker lifecycle;
- manages Master SKU/import;
- uses Admin dashboard/reporting;
- uses allowed settings/account functions.

Admin does not manage ROOT and does not create ADMIN.

## Root workflow

ROOT inherits Admin + Reporter workflow and additionally:
- creates/manages ADMIN;
- accesses Root-only operations;
- remains protected from normal subordinate account-management flows.

## Account provisioning

- ROOT → creates/manages ADMIN.
- ADMIN → creates/manages REPORTER.
- PICKER → provisioned from configured HR Sheet by MNV.
- Picker missing from HR source → `DISABLED`, history retained; not deleted.
- HR synchronization is Preview → explicit Apply.

## SKU import

- Input: Excel `.xlsx`.
- Normal supported operating range: 10,000–50,000 rows.
- Extract only SKU + product name.
- Identical duplicate SKU/name rows merge.
- Same SKU with conflicting names inside one file requires explicit resolution.
- Existing SKU with changed product name requires explicit Admin/Root confirmation.
- Old SKUs absent from a later file remain.
- Large imports use bounded idempotent chunks/retries.

## Data lifecycle

- Operational authority: Worker + InventoryCore SQLite.
- Detailed hot retention target: about 60 days.
- Unresolved/pending data survives retention until handled.
- Long-term archive is batched to Drive/Sheets; no per-event hot write to Google.

## Open workflow decisions

Read `docs/OWNER_DECISIONS.md` open-decision table. Do not invent behavior for SKU-reset confirmation semantics, multi-device/session policy, Stable Root MFA/recovery, final Reporter dashboard scope, Stable password hardening, or offline new-report creation.
