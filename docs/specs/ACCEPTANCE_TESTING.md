# ACCEPTANCE_TESTING — Canonical verification and Owner acceptance rules

Status: **CANONICAL PRODUCT SPEC**.

## Evidence levels

1. Source/build PASS — compilation/static checks only.
2. Deploy/runtime smoke PASS — target Beta runtime responded as expected.
3. Signed APK/release PASS — signed artifact was produced/published.
4. Field/device PASS — physical PDA/Web user flow verified in real conditions.
5. Owner business acceptance — only explicit Owner confirmation.

Never collapse these levels into one generic “done”.

## Rebaseline frontier

The previous signed Beta `beta-vc35` is only the **pre-rebaseline runtime baseline**. Its Practical Balanced/one-row Picker UI is superseded by Owner decisions D043–D055.

The next technical baseline is accepted only after the Legacy Operational UI V2 change set passes authority/spec, service/schema, Web, Android, deploy/runtime and signed-release gates. Physical PDA/Owner acceptance remains separate even after all automatable gates pass.

## Authority/spec acceptance

Verify:
- D036/D042 are superseded, not silently deleted;
- D043 online-only rule is consistent across context/scope/spec/state/source;
- O006 is closed;
- Legacy Operational UI V2 is the active design authority;
- Stable remains Owner-gated;
- resource IDs/scopes remain canonical and no legacy project resource was imported.

## Backend regression and new-contract acceptance

Preserve existing rules:
- Picker+SKU unresolved dedupe;
- same-SKU multi-Picker batch grouping with separate tickets;
- Reporter queue ordering: affected Picker count DESC, then first report ASC;
- server-time 60-second withdrawal;
- `HAS_STOCK` / `SKIP_ALLOWED` resolution;
- five-minute `SKIP_ALLOWED → HAS_STOCK` correction;
- request idempotency;
- ticket/batch/audit separation;
- 10k–50k bounded SKU import contract;
- online-only mutations.

New contract must prove:
- batch version increments on affected-state mutations;
- a later same-SKU episode creates a new batch linked to prior resolved episode rather than reopening it;
- sequenced realtime events are strictly increasing for new events;
- bounded delta after `last_seq` is ordered and role-safe;
- sequence gaps trigger delta recovery and incomplete delta triggers reconcile;
- critical result target rows are created for affected Pickers;
- receipt/display/ACK transitions are idempotent and cannot regress;
- explicit Picker ACK cannot target another user’s result;
- ACK failure does not change resolved batch status;
- SLA configuration validates warning < escalation and no hidden default is inferred;
- SLA state never auto-resolves or auto-Skips.

## Web acceptance

Reporter:
- lands/focuses on the live operational queue, not a dashboard;
- no large KPI wall or explanatory design text precedes the queue;
- dense list/table exposes SKU, product, affected Picker count, wait time, SLA/recurrence and primary actions;
- Skip uses the required impact confirmation;
- Picker detail expands without displacing primary actions;
- normal WebSocket updates do not programmatically click refresh/full reload;
- event/delta updates preserve current filter, scroll and unrelated form context.

Admin/Root:
- Vận hành / Dữ liệu / Quản trị / Báo cáo / Hệ thống grouping is understandable and role-safe;
- existing HR, account, Picker lifecycle, Master SKU and reporting functions remain available;
- SLA configuration and recurrence/SLA reporting appear only within allowed roles;
- no stock quantity/bin/location or employee scoring is introduced.

## Android/PDA acceptance

Shared:
- narrow-screen `BÁO HÀNG 1291` header remains readable;
- utility actions do not squeeze core content;
- mandatory update gate remains fail-closed;
- no AI/design-discussion/non-operational prose;
- no offline queue/outbox/business-success UI;
- launcher icon remains adaptive/full brand without added white wrapper.

Picker:
- vertical composition: SKU input → selected SKU/product → full-width `BÁO HẾT HÀNG` → today history;
- former one-row input+button layout is absent;
- report action is disabled until valid SKU and online state;
- status cards remain explicit;
- server-authoritative 60-second withdrawal remains correct;
- critical result surface shows exact result and requires `XÁC NHẬN ĐÃ NHẬN`;
- multiple pending result ACKs are not lost.

Reporter:
- four filters remain exactly `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`;
- pending card hierarchy prioritizes SKU/product/affected count/wait-SLA context;
- `CÓ HÀNG` / `CHO SKIP HÀNG` are large operational actions;
- Picker detail does not squeeze those actions;
- Skip impact confirmation names SKU/product/affected count;
- real withdrawal-closed batches back the withdrawn view;
- five-minute correction remains correct;
- ACK progress may be shown but never treated as batch status.

Admin/Root:
- after login sees a concise launcher/menu, not automatic Reporter-only rendering;
- Vận hành entry opens the same Reporter workflow;
- management/system entries respect RBAC;
- deep management remains Web-first.

## Realtime/notification acceptance

- foreground Web and Android maintain `last_seq`;
- duplicate sequence is harmless;
- ordered event patch works for report create/withdraw/resolve/correct/ACK-visible changes;
- artificial or test sequence gap recovers through delta;
- reconnect uses delta/reconcile, not page reload;
- FCM critical payload includes event/batch/version correlation metadata;
- client reports received/displayed/acknowledged stages while online;
- invalid notification telemetry cannot mutate business resolution.

## Diagnostics acceptance

Support diagnostics are bounded/redacted and include only approved technical state. Automated secret-pattern guard must reject/logically prevent exposing credential/session/signing values.

## Beta runtime acceptance

After merge/deploy:
- `/health` reports expected schema and healthy core;
- authenticated role/business smoke passes;
- Web production build/deploy smoke passes;
- realtime ticket/connect/delta smoke passes;
- ACK/SLA/recurrence endpoint smoke passes with isolated/non-destructive test data where available;
- signed Beta APK is produced with monotonic versionCode and checksum/release evidence;
- Stable is untouched.

## Field acceptance

Physical logged-in PDA verification is still required for:
- actual narrow-screen layout;
- background FCM display;
- foreground critical result presentation;
- explicit ACK interaction;
- Android installer/update UX where applicable.

Only Owner confirmation marks business/UI acceptance.

## Load acceptance

Non-destructive CI tests may use declared synthetic tiers. Destructive/mutation load acceptance requires an isolated workload boundary and an Owner-defined operational scale target; do not invent production forecasts.
