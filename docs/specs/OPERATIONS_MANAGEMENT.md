# Consolidated Workforce & Operations Management

Status: **OWNER DIRECTION RECORDED — FUTURE MODEL — IMPLEMENTATION BLOCKED UNTIL D165 OWNER PASS**.

This specification records the Owner decision on 2026-10-07 to stop the standalone D164 PDA Management product direction and replace it with one broader operational management model. No new change ID is assigned by this record. Under serial Owner-PASS governance, implementation cannot start until current D165 receives explicit Owner PASS.

## Product direction

The future model is one integrated operational workspace covering:

1. **Nhân sự** — employee master, operational identity, assignment and status needed by the modules below.
2. **Ra / vào ca** — shift start/end attendance records and operational presence.
3. **Công nhật** — daily work/labor records and the supporting approval/reporting workflow.
4. **Công cụ dụng cụ (CCDC)** — asset registry, issue/return/status/history. **PDA is one CCDC asset type**, not a standalone product.
5. **Biên bản** — structured operational incident/minutes records, attachments/status/history as later approved.
6. **Nhận hàng rớt** — receiving and tracking of dropped/found goods under a later Owner-approved detailed workflow.

## D164 disposition

- D164 standalone PDA Management is **cancelled by Owner before Owner field PASS**.
- D164 is **not** promoted to the accepted project base.
- Existing D164 source, Beta releases and runtime resources are historical/reuse candidates only.
- Do not delete, redeploy, migrate or repurpose those resources under this record.
- Any future reuse must first pass resource-scope reconciliation and the active change gate.
- D164 code may be consulted as an implementation reference for PDA/CCDC workflows, but it is not business authority for the successor model.

## Consolidation principles

- One employee identity model should be reused across attendance, daily labor, CCDC, minutes and dropped-goods workflows rather than duplicating staff data per module.
- Asset logic must be generic enough for multiple CCDC categories; PDA-specific fields may exist as subtype metadata.
- Cross-module actions must be auditable by actor, timestamp, site/area and before/after state where applicable.
- Permissions, forms, approval chains, data retention, reporting, realtime behavior and offline policy are **not yet finalized** for the successor model and must not be inferred from D164.
- Existing SUPRA Inventory Báo hàng runtime, D163 accepted base and D165 work remain isolated unless a later Owner-approved design explicitly defines an integration boundary.

## Governance gate

Current authority after this decision:

- Accepted Inventory base: **D163 Owner PASS**.
- Current open change: **D165**, field/usage Owner PASS pending.
- D164: **Owner-cancelled, closed without PASS**.
- Successor consolidated model: **direction recorded only; no change ID; no implementation authorization**.
- Stable: **OWNER-GATED and untouched**.

Before implementation starts, create a new Owner-approved change only after D165 PASS and complete at minimum:
- exact scope and module boundaries;
- role/RBAC matrix;
- forms and business state machines;
- data model and retention;
- reporting/audit requirements;
- realtime/offline rules;
- resource map and reuse-vs-new-resource decision;
- migration policy for any D164 data/artifacts;
- Beta acceptance plan.

## 2026-10-11 — latest D167 scope clarification

Previous D165 status statements above are historical and superseded by canonical ops/project-state.json. Owner D01–D10 authorizes future D167 Web/Excel Picker onboarding, read-only coarse LTA/Shelving reporting and automated PRIMARY read-only SKU export, not the cancelled D164 PDA Management application. Launcher and other project repositories remain excluded. D167 is currently OPEN and D166 remains Owner-accepted base; no new code or deployment is approved by this decision receipt. See docs/D167_OWNER_DECISIONS_D01_D10_2026-10-11.md.
