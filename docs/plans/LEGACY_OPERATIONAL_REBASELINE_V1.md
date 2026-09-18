# Legacy Operational Rebaseline V1

Status: **OWNER APPROVED IMPLEMENTATION PLAN**
Date: 2026-09-17
Scope: Beta only. Stable remains Owner-gated and untouched.

## Authority

This plan records the Owner-approved decision to use the prior Báo hàng 1291 product as a **business/UX reference only** while retaining the SUPRA Inventory canonical architecture and scope.

Reference principles that are approved to carry forward:
- operational-first Picker/Reporter UX;
- dense but readable SKU/report information;
- strong role-specific workflows;
- explicit critical-result acknowledgement;
- deterministic realtime state updates;
- SLA/escalation visibility without auto-Skip;
- recurrence/episode traceability;
- better diagnostics/support tooling;
- Admin/Root PDA entry points instead of treating Admin/Root as only Reporter.

Legacy resources, providers, credentials, databases, enum names, stock quantity/bin/location scope, direct-to-Sheet transaction logic and old backend architecture are **not** imported.

## Owner decisions captured by this plan

1. **No offline mode.** The product requires online authoritative service access for business operations. Do not create offline report outbox, offline mutation mode, direct-to-Sheet fallback or any other offline primary/secondary business transaction path.
2. The previous Practical Balanced/one-row Picker visual baseline is superseded as visual authority.
3. The new UI baseline is **Legacy Operational UI V2**: use the old product’s operational layout principles, rewritten cleanly for the current Worker + InventoryCore + WebSocket/FCM architecture.
4. Keep current better business rules unless explicitly superseded: Picker+SKU unresolved dedupe, same-SKU multi-Picker batch grouping, 60-second withdrawal, Reporter resolution values, 5-minute Skip correction, server authority, Beta/Stable isolation, mandatory Android update gate and 10k–50k SKU import.

## Target business model

### Picker

- Login with provisioned username/MNV + password.
- Search/select from server-synchronized local SKU catalog.
- Show selected SKU and product name prominently.
- Primary full-width `BÁO HẾT HÀNG` action.
- Server creates one ticket per Picker report and groups unresolved same-SKU tickets into one batch.
- No duplicate unresolved Picker+SKU ticket.
- Today history is immediately visible under the entry area.
- Server-controlled 60-second withdrawal.
- Critical final result (`HAS_STOCK` / `SKIP_ALLOWED`) requires explicit acknowledgement tied to user + notification event + batch/version.
- No offline report creation or offline success state.

### Reporter

- Operational queue is the default/focus view.
- Preserve primary order: affected Picker count descending, then first report ascending.
- SLA state is visible/escalated but does not silently redefine queue ordering until a separate deterministic priority formula is explicitly approved.
- Pending item shows SKU, product name, affected Picker count, first-report time, waiting duration, SLA state and expandable Picker detail.
- Two large actions: `CÓ HÀNG` and `CHO SKIP HÀNG`.
- Skip requires a deliberate confirmation showing impact count.
- `SKIP_ALLOWED` may be corrected to `HAS_STOCK` within five minutes server time.
- Result notification/ACK state is visible to operations where useful.

### Admin / Root

- Inherit Reporter operations.
- Web remains the deep management surface.
- PDA gains a concise operational launcher with entries for queue/results plus role-allowed management/system tools; Admin/Root must no longer be rendered as only Reporter.
- Root-only authority remains protected.

## New data/runtime contracts

### Event sequence + delta

- Add monotonic server event sequence to business lifecycle events.
- Realtime frame carries at least `event`, `seq`, `scopes`, target/batch identity and current version metadata where relevant.
- Client tracks last applied sequence.
- Normal foreground update patches the affected row/card/view rather than simulating a page refresh.
- Sequence gaps trigger bounded delta fetch after `last_seq`; full authoritative reconcile is fallback only.
- Database remains authority; WebSocket/FCM never becomes a transaction store.

### Batch version / recurrence

- Add batch version incremented on authoritative state mutation.
- When a resolved SKU is reported again, create a new batch episode and preserve `previous_batch_id`.
- Expose recurrence context such as previous resolved time and elapsed recurrence interval.
- Never reopen/mutate an old finalized episode into a new shortage episode.

### Critical result acknowledgement

Track critical result delivery separately from business resolution:
- notification event created;
- delivery accepted/attempted;
- client received;
- client displayed;
- user acknowledged.

ACK must be idempotent and tied to target Picker, event and batch/version. Business resolution succeeds even if notification delivery fails; ACK state is operational telemetry/audit, not transaction authority.

### SLA

- SLA is configurable operational timing/escalation metadata.
- SLA must never auto-resolve or auto-Skip.
- Initial implementation: server-derived waiting/SLA state, UI warning/escalation and Admin/Root configuration surface.
- Exact configurable thresholds must use explicit current settings/defaults recorded in canonical spec/source; no hidden inference from old legacy values.

### Diagnostics

Provide redacted support diagnostics containing only non-secret technical state such as app version, Android/device platform, network/service reachability, realtime state/last sequence, catalog version and recent bounded errors. Never include passwords, access/session tokens, refresh tokens, raw Firebase/Google credentials, signing material or private keys.

## Target UI

### Picker Android/PDA

Vertical operational composition:
1. compact product/identity header with overflow tools;
2. large SKU input;
3. selected SKU + product name block;
4. full-width `BÁO HẾT HÀNG` button;
5. `BÁO HÔM NAY` / today history;
6. readable status cards and conditional withdrawal.

Do not compress SKU input and primary action into one narrow row.

### Reporter Android/PDA

- Four business-state filters remain: `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`.
- Pending cards prioritize SKU/product, Picker impact, waiting/SLA context, then two large actions.
- Picker detail expands without shrinking the two primary actions.

### Admin/Root Android/PDA

Operational launcher groups:
- Vận hành;
- Quản trị (role allowed);
- Hệ thống.

Deep HR/SKU/report administration remains Web-first.

### Web

Information architecture becomes operational-first:
- **Vận hành:** Hàng đang xử lý, kết quả/lịch sử;
- **Dữ liệu:** Master SKU, nguồn nhân sự;
- **Quản trị:** tài khoản, Picker lifecycle, cấu hình nghiệp vụ/SLA;
- **Báo cáo:** tổng quan, chi tiết báo hàng, recurrence/SLA views;
- **Hệ thống:** trạng thái dịch vụ, archive/sync, logs/version where implemented.

Reporter Web opens/focuses on a dense operational list/table. KPI/dashboard content stays in Admin/Root reporting areas and must not displace the live queue.

## Explicit non-goals

- no offline business mode;
- no direct-to-Sheet transaction fallback;
- no stock quantity management;
- no bin/location/pickface management;
- no legacy Neon/Firestore transaction architecture import;
- no auto-Skip;
- no employee performance scoring;
- no Stable activation/deploy/release.

## Owner sequencing override — 2026-09-18

The active execution order is now **UI first**:

1. **Visual extraction:** read only the legacy Web/Android UI source and inventory the exact reusable layout/style patterns.
2. **Web parity shell:** reproduce the approved legacy visual hierarchy and interaction density using the current Web stack, without intentional business-rule changes.
3. **Android/PDA parity shell:** reproduce the approved legacy login/header/Picker/Reporter/Admin presentation using the current Android stack, without intentional business-rule changes.
4. **Owner UI gate:** deploy/build Beta UI candidates and collect explicit Owner layout acceptance. CI/build success is not acceptance.
5. **Business rebuild/wiring:** only after the UI gate PASS, continue the canonical logic/scenario/business-rule rebuild inside the accepted shell.
6. **Runtime/field verification:** then run business/realtime/FCM/device/load acceptance as separate evidence levels.

This sequencing overrides the previous implementation frontier that treated backend/business acceptance as the immediate next action. It does not change the canonical business rules themselves.

## Implementation phases and gates

### Phase A — authority/spec rebaseline

Update decision ledger, workflows/forms/realtime/data/reporting/UI/acceptance specs, project scope/state and resource registry network policy.

Gate: Repo Authority Guard + Project State/continuity requirements PASS.

### Phase B — backend contract

Implement schema migration and APIs for event sequence/delta, batch version/recurrence, critical ACK and SLA settings/state while preserving existing business transactions and idempotency.

Gate: service typecheck/tests + business regression + schema/runtime smoke PASS.

### Phase C — Web operational UI

Rewrite Reporter operations to dense operational-first layout; reorganize Admin/Root navigation; add ACK/SLA/recurrence visibility and event-delta client behavior.

Gate: Web build + UI guard + Beta deploy/smoke PASS.

### Phase D — Android operational UI

Rewrite Picker vertical composition, Reporter cards, Admin/Root launcher, critical ACK flow, event-delta handling and redacted diagnostics while preserving update gate/FCM/catalog cache.

Gate: Android debug/release build + UI guard + signed Beta release PASS.

### Phase E — runtime verification

- Beta health/schema check;
- authenticated role/business smoke;
- realtime sequence/delta smoke;
- critical ACK smoke using isolated test data where available;
- signed APK release evidence;
- no Stable mutation.

Technical PASS does not equal physical-device/Owner business acceptance. Field evidence remains a distinct acceptance level.
