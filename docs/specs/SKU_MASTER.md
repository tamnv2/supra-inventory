# SKU_MASTER — Canonical SKU master and import rules

Status: **CANONICAL PRODUCT SPEC**.

## Scope

Master data contains only `SKU` + `product name`. Do not add location/bin/pickface/quantity inventory fields.

## Excel import

- File type: `.xlsx`.
- Intended operating range: 10,000–50,000 rows.
- Detect SKU/name headers from the initial header area.
- Trim/normalize values; blank rows are skipped.
- Unsafe numeric SKU precision is rejected rather than silently changed.
- Same SKU + same name duplicates merge.
- Same SKU + conflicting names inside one file requires explicit Owner/Admin user choice in UI.
- Existing SKU with a changed name requires explicit confirmation.
- Existing SKUs absent from a later file remain; import is not destructive reset.
- Preview precedes Apply.
- Apply uses bounded idempotent chunks/retries; current client chunk target is 1,000 and backend maximum is bounded.
- File hash/request IDs support deterministic retry semantics.

## PDA catalog synchronization

- Server is catalog authority.
- PDA maintains local SQLite cache for operational search.
- Delta-first synchronization is required after bootstrap.
- Full 10k–50k catalog fetch is bootstrap/fallback only, not the normal response to every Master SKU change.
- Cache replacement must not destroy a valid old cache when a new download is incomplete/invalid.

## Open item

Exact Owner semantics for the SKU-reset confirmation described historically as random “6 chữ” remain unresolved. Do not invent them.

## PDA catalog atomic-cache contract

- Android/PDA catalog persistence uses local SQLite, not a TSV file as the authoritative cache.
- Delta/full synchronization writes into a staging table first.
- The app rechecks authoritative catalog version/count before promoting staged rows.
- Promotion to the active catalog is one local SQLite transaction.
- If download, pagination, validation, version recheck or promotion fails, the last valid active catalog remains usable for read-only search; no partial catalog replaces it.
- Existing legacy TSV cache may be migrated once into SQLite, then the TSV artifacts are retired.
