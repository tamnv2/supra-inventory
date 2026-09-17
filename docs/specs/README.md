# Product Specification Index

Status: **CANONICAL SPEC INDEX**.

All Owner-approved product behavior must live in this structure; approved behavior must not exist only in chat memory.

Read the matching spec before changing that area:
- `ROLE_WORKFLOWS.md` — Picker/Reporter/Admin/Root journeys and scenario ordering.
- `AUTH_RBAC.md` — authentication, provisioning hierarchy, role authority and unresolved Stable auth hardening.
- `FORMS.md` — business-facing inputs/actions/forms.
- `SKU_MASTER.md` — SKU master/import/cache synchronization.
- `REALTIME_NOTIFICATIONS.md` — WebSocket/FCM semantics.
- `DATA_LIFECYCLE.md` — ticket/batch/event data semantics, archive and retention.
- `REPORTING_DASHBOARD.md` — Admin/Root dashboard/reporting authority.
- `UI_DESIGN_SYSTEM.md` — Owner-selected Practical Balanced / Phương án 1 design authority.
- `ACCEPTANCE_TESTING.md` — CI/runtime/device/Owner acceptance levels and regression expectations.

Also canonical:
- `../PROJECT_CONTEXT.md` — identity and product scope.
- `../../ops/project-scope.json` — exact project-resource boundary by ID/name.
- `../OWNER_DECISIONS.md` — durable decisions, supersession and open questions.
- `../OPERATING_PROTOCOL.md` — automation-first working method.

## Update coupling

- Owner changes a rule → update `OWNER_DECISIONS.md` + every affected spec in the same workstream.
- New form/workflow/design/scenario → add it to the matching spec before/with implementation.
- Superseded behavior is marked historically; do not silently erase the decision trail.
- Meaningful implementation change → update `ops/project-state.json`.
- Resource change → update both `ops/project-scope.json` and `ops/resource-registry.json` as applicable.
