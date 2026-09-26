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

## D116 — Admin SKU workspace

- Admin/Root **Danh mục SKU** is not an upload-only screen. It shows authoritative catalog count, version and latest update timestamp from the existing catalog metadata endpoint.
- The workspace provides bounded search by SKU or product name and renders current SKU, product name and update timestamp.
- Excel import remains the approved validated/idempotent flow. Current catalog data remains authoritative until the uploaded workbook passes parsing/conflict checks and the user explicitly applies it.
- Same-SKU/different-name conflicts continue to require explicit resolution; D116 does not add stock quantity, location/bin management or offline catalog mutation.
- Loading/searching this workspace is on-demand when the route is opened or the user searches; it introduces no background polling loop.

## D119 — WMS Tồn Bin assisted SKU synchronization

- The registered Supra HY1 Tồn Bin endpoints may be used only as a read source for SKU catalog assistance.
- Only `SKU` and `product name` are admitted into SUPRA Inventory. Bin, location, stock quantity, pending quantity and other inventory fields are discarded before persistence/logging.
- Same SKU + same name is a no-op. A new SKU may be added. Existing SKU + changed name remains an explicit-confirmation conflict and cannot be silently overwritten.
- A SKU missing from a later WMS result remains in the catalog; WMS sync is merge/additive, not destructive replacement.
- One fleet sync lease/version prevents duplicate downloads. An expired lease may be taken over.
- Existing validated Excel import remains available as manual fallback and uses the same conflict semantics.
- D119 does not reopen bin/location/quantity product scope.

## D122 — Agent synchronization visibility

- A completed Agent/WMS SKU synchronization is an operational event even when every incoming SKU already matches the catalog.
- Manual Agent sync must explicitly show success/failure and counts for new, renamed and unchanged SKU rows.
- Web **Danh mục SKU** exposes the latest successful sync checkpoint independently from `sku_master.updated_at` / catalog max-update time.
- The checkpoint is derived from the existing successful `SKU_IMPORT_CHUNK` audit event; no new table, provider, polling loop or stock/location field is introduced.
- A no-op sync must not falsify the timestamp for actual SKU data mutation.
## D124 — Fleet-wide single-daily Agent sync and observable progress

- The D119 expired-lease takeover rule is narrowed by D124: an expired **pre-Service preparation lease** may still be retried, but after the first Service import job is submitted the Asia/Ho_Chi_Minh daily operation is locked and no second automatic or manual Agent operation may be submitted that day.
- The daily lease persists `service_started=true` before the first import job. Successful completion records `DONE`; an uncertain post-submit timeout remains day-locked rather than being released for duplicate retry.
- Agent waits up to 180 seconds for each Service job and surfaces `PENDING` versus `RUNNING` progress. The Beta Function writes `RUNNING` before calling the internal Worker import endpoint.
- Manual and automatic runs expose concise stages for lease check, Supra catalog read, chunk number, Service processing and terminal result. These messages are observability only and do not add polling outside the active synchronization operation.
- Pre-Service failures may release the short preparation lease because no import job has been submitted. Once Service submission starts, duplicate prevention takes precedence over same-day automatic recovery.
- The existing additive merge/conflict rules remain unchanged: only SKU + product name, no delete on absence, explicit confirmation for name changes, and no bin/location/quantity persistence.
