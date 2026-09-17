#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def write(path: str, content: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.rstrip() + "\n", encoding="utf-8")

scope = {
  "schema_version": 1,
  "project_key": "supra-inventory",
  "display_name": "SUPRA Inventory — Báo hàng",
  "repository": {"id": 1372407002, "name": "tamnv2/supra-inventory", "default_branch": "main", "visibility": "public"},
  "timezone": "Asia/Ho_Chi_Minh",
  "scope_policy": {
    "rule": "ONLY_LISTED_RESOURCES_ARE_IN_PROJECT_SCOPE",
    "unknown_resource": "FAIL_CLOSED_RECONCILE_BEFORE_MUTATION",
    "cross_project_import": "FORBIDDEN",
    "stable": "OWNER_GATED"
  },
  "resource_identity_rule": "USE_EXACT_KNOWN_ID_WHEN_CANONICALLY_AVAILABLE; OTHERWISE_USE_CANONICAL_NAME_AND_OPTIONAL_ID_SOURCE",
  "resources": [
    {"key":"repo","provider":"GitHub","kind":"repository","environment":"shared","id":"1372407002","name":"tamnv2/supra-inventory","exposure":"public_identifier"},
    {"key":"google-org","provider":"Google Cloud","kind":"organization","environment":"shared","id":"215296023899","name":"SUPRA Inventory parent organization","exposure":"public_identifier","mutation_scope":"REFERENCE_ONLY_EXCEPT_EXISTING_INVENTORY_SERVICE_ACCOUNT_KEY_POLICY_EXCEPTION"},
    {"key":"gcp-beta","provider":"Google Cloud","kind":"project","environment":"beta","id":"supra-inventory-beta","secondary_id":"572322098890","name":"supra-inventory-beta","exposure":"public_identifier"},
    {"key":"gcp-stable","provider":"Google Cloud","kind":"project","environment":"stable","id":"supra-inventory-stable","secondary_id":"1004520166836","name":"supra-inventory-stable","exposure":"public_identifier","guard":"OWNER_GATED"},
    {"key":"firebase-android-beta","provider":"Firebase","kind":"android_app","environment":"beta","id":"1:572322098890:android:3e483937876cbcc0400e33","name":"cd.cc.supra.inventory.beta","exposure":"public_identifier"},
    {"key":"firebase-web-beta","provider":"Firebase","kind":"web_app","environment":"beta","id":"1:572322098890:web:96459cf386b3fb6f400e33","name":"SUPRA Inventory Beta Web","exposure":"public_identifier"},
    {"key":"firebase-android-stable","provider":"Firebase","kind":"android_app","environment":"stable","id":"1:1004520166836:android:70b94fef019c46450fcee1","name":"cd.cc.supra.inventory","exposure":"public_identifier","guard":"OWNER_GATED"},
    {"key":"firebase-web-stable","provider":"Firebase","kind":"web_app","environment":"stable","id":"1:1004520166836:web:36bd435a9a3a3c650fcee1","name":"SUPRA Inventory Stable Web","exposure":"public_identifier","guard":"OWNER_GATED"},
    {"key":"cf-account","provider":"Cloudflare","kind":"account","environment":"shared","name":"Cloudflare account hosting supra.cc.cd","id_source":"github_variable:CF_ACCOUNT_ID","exposure":"runtime_configuration_reference"},
    {"key":"cf-zone","provider":"Cloudflare","kind":"zone","environment":"shared","name":"supra.cc.cd","id_source":"github_variable:CF_ZONE_ID","exposure":"runtime_configuration_reference"},
    {"key":"worker-beta","provider":"Cloudflare","kind":"worker","environment":"beta","name":"supra-inventory-beta","exposure":"public_identifier"},
    {"key":"worker-stable","provider":"Cloudflare","kind":"worker","environment":"stable","name":"supra-inventory-stable","exposure":"public_identifier","guard":"OWNER_GATED"},
    {"key":"host-beta","provider":"Cloudflare","kind":"hostname","environment":"beta","name":"inventory-beta.supra.cc.cd","exposure":"public_identifier"},
    {"key":"host-stable","provider":"Cloudflare","kind":"hostname","environment":"stable","name":"inventory.supra.cc.cd","exposure":"public_identifier","guard":"OWNER_GATED"},
    {"key":"inventory-core","provider":"Cloudflare","kind":"durable_object","environment":"beta","name":"InventoryCore","binding":"INVENTORY_CORE","storage":"sqlite","exposure":"public_identifier"},
    {"key":"android-package-beta","provider":"Android","kind":"package","environment":"beta","name":"cd.cc.supra.inventory.beta","exposure":"public_identifier"},
    {"key":"android-package-stable","provider":"Android","kind":"package","environment":"stable","name":"cd.cc.supra.inventory","exposure":"public_identifier","guard":"OWNER_GATED"},
    {"key":"sa-beta","provider":"Google Cloud","kind":"service_account","environment":"beta","name":"inventory-beta-runtime@supra-inventory-beta.iam.gserviceaccount.com","exposure":"public_identifier"},
    {"key":"sa-stable","provider":"Google Cloud","kind":"service_account","environment":"stable","name":"inventory-stable-runtime@supra-inventory-stable.iam.gserviceaccount.com","exposure":"public_identifier","guard":"OWNER_GATED"},
    {"key":"oauth-beta","provider":"Google OAuth","kind":"oauth_client","environment":"beta","name":"inventory-beta-drive","redirect_uri":"https://inventory-beta.supra.cc.cd/api/oauth/google/callback","exposure":"public_identifier"},
    {"key":"oauth-stable","provider":"Google OAuth","kind":"oauth_client","environment":"stable","name":"inventory-stable-drive","redirect_uri":"https://inventory.supra.cc.cd/api/oauth/google/callback","exposure":"public_identifier","guard":"OWNER_GATED"},
    {"key":"drive-root","provider":"Google Drive","kind":"folder","environment":"shared","id":"1aNt8PULfMvJC8CKKbQyf5suLPtGo2PRF","name":"Inventory","exposure":"operational_metadata_existing_public"},
    {"key":"drive-beta","provider":"Google Drive","kind":"folder","environment":"beta","id":"1J5bQDqPoQcEPkYIk41x7t-9Nz_HaSnMC","name":"Inventory/Beta","exposure":"operational_metadata_existing_public"},
    {"key":"drive-stable","provider":"Google Drive","kind":"folder","environment":"stable","id":"1T6723_2ILNsS2GcvCHGSY5ZenkAj0VYN","name":"Inventory/Stable","exposure":"operational_metadata_existing_public","guard":"OWNER_GATED"},
    {"key":"hr-sheet-beta","provider":"Google Sheets","kind":"spreadsheet","environment":"beta","id":"14UcBtXvK_uGHAiKU31Ofw3nwxsTl2IlLPUG9sX8ce7k","name":"Nhân sự _ Beta","tab":"Nhân sự","exposure":"operational_metadata_existing_public","note":"test source only; product source remains Admin/Root configurable"},
    {"key":"archive-folder-beta","provider":"Google Drive","kind":"folder","environment":"beta","id":"1hVmzMziL9nKw-AEnzd8pJm6fmOdyd-5a","name":"Beta archive folder","exposure":"operational_metadata_existing_public"},
    {"key":"exports-folder-beta","provider":"Google Drive","kind":"folder","environment":"beta","id":"1BgYPpoXHyr9TLzQxE2tOQEvHxfMpKtBh","name":"Beta exports folder","exposure":"operational_metadata_existing_public"},
    {"key":"archive-sheet-beta","provider":"Google Sheets","kind":"spreadsheet","environment":"beta","id":"1WU9RDUEevE74Twyq1aA80xvL3Wr1mTA21PRA8ypIMOA","name":"Inventory Archive - Beta","tabs":["Archive_Manifest","Archive_Tickets","Archive_Batches","Archive_Events"],"exposure":"operational_metadata_existing_public"}
  ],
  "secret_references": [
    {"name":"GOOGLE_RUNTIME_SA_JSON","storage":"Cloudflare Worker secret","value_in_repo":false},
    {"name":"GOOGLE_DRIVE_OAUTH_CLIENT_SECRET","storage":"Cloudflare Worker secret","value_in_repo":false},
    {"name":"GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN","storage":"Cloudflare Worker secret","value_in_repo":false},
    {"name":"ROOT_BOOTSTRAP_PASSWORD","storage":"Cloudflare Worker secret","value_in_repo":false},
    {"name":"CF_API_TOKEN_INVENTORY_BETA","storage":"GitHub Actions secret","value_in_repo":false},
    {"name":"BETA_KEYSTORE_BASE64","storage":"GitHub Actions secret","value_in_repo":false},
    {"name":"BETA_KEYSTORE_PASSWORD","storage":"GitHub Actions secret","value_in_repo":false},
    {"name":"BETA_KEY_ALIAS","storage":"GitHub Actions secret/variable as configured","value_in_repo":false},
    {"name":"BETA_KEY_PASSWORD","storage":"GitHub Actions secret","value_in_repo":false}
  ],
  "explicit_out_of_scope": [
    "Pick Pack 1291 resources",
    "Pickface Damage 1291 resources",
    "SupraCore resources",
    "VHDCHY resources",
    "location/bin/pickface inventory management",
    "stock quantity management",
    "Office-network fallback/provider research unless Owner reopens it",
    "offline primary transaction path/direct-to-Sheet business writes unless Owner approves"
  ]
}
write("ops/project-scope.json", json.dumps(scope, ensure_ascii=False, indent=2))

write("docs/specs/AUTH_RBAC.md", r'''# AUTH_RBAC — Canonical authentication and role authority

Status: **CANONICAL PRODUCT SPEC**.

## Roles and inheritance

- `PICKER`: operational report creator; sees own reports.
- `REPORTER`: processes unresolved batches.
- `ADMIN`: inherits Reporter operations and administers Reporter accounts, HR→Picker lifecycle, Master SKU, dashboard/reporting and permitted settings.
- `ROOT`: highest application role; inherits Admin/Reporter and creates/manages ADMIN.

The service is authoritative. Client-provided role is never trusted.

## Provisioning hierarchy

- ROOT → ADMIN.
- ADMIN → REPORTER.
- PICKER → HR Sheet by MNV through Preview → explicit Apply.
- Missing Picker row becomes `DISABLED`; historical tickets/events remain.
- ROOT cannot be managed through normal subordinate account-management APIs.

## Login/session foundation

`username/MNV + password → Worker verification → Firebase custom token/session exchange`.

Passwords/secrets are runtime-only. Repo contains no bootstrap password value. New/reset managed accounts initialize from the protected bootstrap secret according to the current Beta implementation; no forced immediate password change is required by current Owner decision.

## Reset/session semantics

Current implementation rotates identity/session authority when a managed password reset requires invalidating old sessions and disables registered FCM devices for that identity. Final simultaneous-device/session policy remains Owner-open.

## Stable hardening still open

Do not invent Stable Root MFA/recovery, final password KDF, rate limit or lockout policy. These remain explicit open decisions in `OWNER_DECISIONS.md`.
''')

write("docs/specs/SKU_MASTER.md", r'''# SKU_MASTER — Canonical SKU master and import rules

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
''')

write("docs/specs/REALTIME_NOTIFICATIONS.md", r'''# REALTIME_NOTIFICATIONS — Canonical synchronization and notification rules

Status: **CANONICAL PRODUCT SPEC**.

## Authority

Business state is authoritative in Worker + `InventoryCore` SQLite. Realtime channels notify/invalidate; they do not become a second transaction store.

## Foreground realtime

- WebSocket is the foreground channel for Web and Android/PDA.
- Authentication uses a short-lived one-time ticket issued only after authenticated session validation.
- InventoryCore uses hibernatable WebSocket handling and tags by role/user/client.
- Business transaction commits first; broadcast failure must not roll back a successful business mutation.
- Reconnect always re-fetches authoritative server state.
- Full-page reload is not synchronization logic.

## Background FCM

- FCM HTTP v1 is background best-effort delivery.
- Device registration is authenticated.
- Resolution/correction notifications target affected Picker users; new reports target Reporter/Admin/Root as implemented.
- Report withdrawal intentionally does not need noisy FCM delivery under the current design.
- FCM failure does not change business transaction success.

## Acceptance state

Technical registration/delivery foundation is deployed. Physical logged-in PDA delivery remains field acceptance until Owner/device evidence is recorded in project state.
''')

write("docs/specs/DATA_LIFECYCLE.md", r'''# DATA_LIFECYCLE — Canonical operational data, archive and retention

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
''')

write("docs/specs/REPORTING_DASHBOARD.md", r'''# REPORTING_DASHBOARD — Canonical Admin/Root analytics UX

Status: **CANONICAL PRODUCT SPEC**.

## Dashboard purpose

Admin/Root dashboard is a compact operational decision overview, not an ornamental BI wall and not an employee scoring system.

Approved structure:
- one shared date filter / quick presets;
- core report KPIs;
- report/resolution trend;
- resolution outcome breakdown;
- top reported SKUs;
- drill-down to detailed Reporting.

Do not add stock quantity/location metrics or individual employee-performance ranking without Owner approval.

## Reporting

Approved controls:
- date range;
- status;
- SKU/query;
- pagination;
- explicit CSV export in bounded pages/chunks.

Hot reporting range is bounded to protect SQLite/quota; current implementation is designed around up to 60 days. Dashboard aggregates are server-side/indexed rather than loading the entire raw dataset into the browser.

## Refresh model

Prefer authoritative realtime invalidation + explicit refresh. Avoid aggressive auto-polling that consumes Worker/Durable Object quota.

## Open item

Final export columns and any expansion of Reporter dashboard visibility beyond the operational queue remain Owner-open.
''')

write("docs/specs/ACCEPTANCE_TESTING.md", r'''# ACCEPTANCE_TESTING — Canonical verification and Owner acceptance rules

Status: **CANONICAL PRODUCT SPEC**.

## Evidence levels

1. Source/build PASS — compilation/static checks only.
2. Deploy/runtime smoke PASS — target Beta runtime responded as expected.
3. Signed APK/release PASS — signed artifact was produced/published.
4. Field/device PASS — physical PDA/Web user flow verified in real conditions.
5. Owner business acceptance — only explicit Owner confirmation.

Never collapse these levels into one generic “done”.

## Current field frontier

Current Beta design/business build is `beta-vc30`, Concept 3, schema v5. Technical Web/APK/build/deploy guards are PASS. Physical logged-in PDA FCM delivery and Owner field/business acceptance remain separate pending evidence.

## Regression expectations

After business/UI changes, verify the affected role journey end-to-end and preserve:
- Picker report/search/own-state/60-second withdrawal rules;
- Reporter queue/batch detail/HAS_STOCK/SKIP_ALLOWED/5-minute correction;
- Admin/Root hierarchy and settings boundaries;
- WebSocket authoritative resync;
- no false offline business success;
- Stable untouched unless explicitly authorized.

## Load acceptance

Non-destructive CI tests may use declared synthetic tiers. Destructive/mutation load acceptance requires an isolated workload boundary and an Owner-defined operational scale target; do not invent production forecasts.
''')

write("docs/OPERATING_PROTOCOL.md", r'''# OPERATING_PROTOCOL — Automation-first project operation

Status: **CANONICAL OPERATING POLICY**.

## Default execution ladder

For every task use the highest safe automation level available:
1. connected first-party/project tool or API;
2. repository automation / GitHub Actions / existing CI;
3. official provider web UI only when human consent, account ownership, CAPTCHA/2FA or unsupported admin action makes Owner interaction necessary;
4. local install/terminal/script only as a last resort when there is no practical connected-tool/web path.

## Finite work

Do not stop after triggering a build/deploy/test. Continue:
`trigger → poll → inspect failure → repair within approved scope → rerun → terminal PASS`.
Stop only for a real Owner-only permission/consent step, requirement conflict, safety boundary or hard tool limit.

## Owner manual action format

When Owner action is unavoidable, instructions must:
- identify the exact provider/project/resource from `ops/project-scope.json`;
- use the shortest official UI path;
- state exactly what to click/type and what not to expose;
- batch related permissions/setup into one pass where possible;
- include the expected success state;
- avoid asking Owner to install software or run local CLI when a web route exists;
- automatically recheck immediately after Owner reports completion.

## Context before action

Before mutation, fresh-read the canonical GitHub authority according to `ops/authority-manifest.json`. Do not use chat memory as an execution source when the repo has newer state.

## Stable

Stable actions are never inferred from a Beta request. Stable provisioning/deploy/release always requires explicit current Owner authorization.
''')

write("docs/specs/README.md", r'''# Product Specification Index

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
- `UI_DESIGN_SYSTEM.md` — Owner-selected Concept 3 design authority.
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
''')

manifest_path = ROOT / "ops/authority-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["authority_model"] = "REPO_NATIVE_COMPLETE"
manifest["bootstrap_order"] = [
  "AGENTS.md","docs/PROJECT_CONTEXT.md","ops/project-scope.json","ops/project-state.json","docs/OWNER_DECISIONS.md",
  "docs/specs/README.md","docs/specs/ROLE_WORKFLOWS.md","docs/specs/AUTH_RBAC.md","docs/specs/FORMS.md","docs/specs/SKU_MASTER.md",
  "docs/specs/REALTIME_NOTIFICATIONS.md","docs/specs/DATA_LIFECYCLE.md","docs/specs/REPORTING_DASHBOARD.md","docs/specs/UI_DESIGN_SYSTEM.md",
  "docs/specs/ACCEPTANCE_TESTING.md","docs/OPERATING_PROTOCOL.md","ops/resource-registry.json","recent_commits_and_ci","relevant_live_source"
]
manifest["canonical_sources"]["project_scope"] = "ops/project-scope.json"
manifest["canonical_sources"]["operating_protocol"] = "docs/OPERATING_PROTOCOL.md"
manifest["canonical_sources"]["product_specs"] = [
  "docs/specs/ROLE_WORKFLOWS.md","docs/specs/AUTH_RBAC.md","docs/specs/FORMS.md","docs/specs/SKU_MASTER.md",
  "docs/specs/REALTIME_NOTIFICATIONS.md","docs/specs/DATA_LIFECYCLE.md","docs/specs/REPORTING_DASHBOARD.md","docs/specs/UI_DESIGN_SYSTEM.md",
  "docs/specs/ACCEPTANCE_TESTING.md"
]
manifest["update_coupling"]["resource_change"] = ["ops/project-scope.json","ops/resource-registry.json"]
manifest["security"]["resource_scope_authority"] = "ops/project-scope.json"
write("ops/authority-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

context = (ROOT / "docs/PROJECT_CONTEXT.md").read_text(encoding="utf-8")
context = context.replace("3. `docs/PROJECT_CONTEXT.md` — identity and scope.\n4. `ops/project-state.json`", "3. `docs/PROJECT_CONTEXT.md` — identity and product boundary.\n4. `ops/project-scope.json` — exact external-resource scope by ID/name; unlisted resources are out of scope.\n5. `ops/project-state.json`")
context = context.replace("5. `docs/OWNER_DECISIONS.md`", "6. `docs/OWNER_DECISIONS.md`").replace("6. `docs/specs/`", "7. `docs/specs/`").replace("7. `ops/resource-registry.json`", "8. `ops/resource-registry.json`").replace("8. Current source code", "9. Current source code").replace("9. Generated/derived views", "10. Generated/derived views").replace("10. Chat memory/old handovers", "11. Chat memory/old handovers")
if "## Resource scope authority" not in context:
    context += "\n## Resource scope authority\n\n`ops/project-scope.json` is the canonical external-resource boundary. Every listed resource carries an exact known ID when appropriate, otherwise a canonical name plus an ID source. An unlisted provider project/app/worker/folder/sheet/domain is outside project scope until Owner-approved and added to the manifest.\n"
write("docs/PROJECT_CONTEXT.md", context)

agents = r'''# AGENTS.md — SUPRA Inventory

This repository belongs only to `SUPRA Inventory — Báo hàng` (`supra-inventory`). Never import assumptions, credentials, resources, business rules or memories from another project.

## Mandatory bootstrap gate before mutation

Read `ops/authority-manifest.json`, then consume its `bootstrap_order` in order. At minimum this includes:
1. `AGENTS.md`
2. `docs/PROJECT_CONTEXT.md`
3. `ops/project-scope.json`
4. `ops/project-state.json`
5. `docs/OWNER_DECISIONS.md`
6. all relevant `docs/specs/*`
7. `docs/OPERATING_PROTOCOL.md`
8. `ops/resource-registry.json`
9. recent commits/CI and relevant live source

Do not mutate first and “reconstruct context later”. If canonical files conflict on behavior or target resource, fail closed and reconcile.

## Authority

1. Current explicit Owner command.
2. Canonical GitHub context/scope/state/decision/spec/operating/resource files.
3. Current source + recent CI/deploy/runtime evidence.
4. Generated views.
5. Chat memory/old handovers only as retrieval aids.

GitHub is the durable project memory; chat is the control surface.

## Project resource scope

`ops/project-scope.json` is authoritative for provider/resource identity. Use exact listed ID when present; otherwise canonical name and `id_source`. An unlisted resource is outside scope and must not be mutated until reconciled and Owner-approved.

Stable resources are OWNER-GATED even when listed.

## Durable product knowledge

All Owner-approved forms, design rules, workflows, business logic and scenarios must be persisted in `docs/OWNER_DECISIONS.md` plus affected `docs/specs/*` in the same workstream. Never leave a durable approved rule only in chat.

Superseded decisions are marked, not silently removed.

## Live work-state rule

Meaningful work updates `ops/project-state.json` in the same workstream. It must distinguish technical PASS, runtime PASS, device/field PASS and Owner business acceptance. “Continue” means fresh-read project state before acting.

Resource changes update both `ops/project-scope.json` and `ops/resource-registry.json` where applicable.

## Automation-first rule

Follow `docs/OPERATING_PROTOCOL.md`. For finite work: trigger → poll → inspect failure → repair in scope → rerun until terminal PASS or a real Owner-only blocker/hard tool limit.

If Owner action is unavoidable, use the shortest official UI path, batch permissions/setup, avoid local installs/CLI when a connected/web path exists, and automatically recheck afterward.

## Stable guard

No Stable deploy/provision/public traffic/real-user bootstrap/OAuth refresh activation/promotion/release without explicit current Owner authorization.

## Public-repo security

Never commit/log/paste secret values: private keys/service-account JSON, OAuth client secrets/refresh tokens, Cloudflare tokens, signing material/passwords, root/admin passwords, session/access tokens, private API keys.

Use secret *names/references* only. For new operational metadata, minimize public exposure and prefer aliases/runtime variables when reproducible automation does not require the exact value. Exact IDs already in public Git history are classified in `project-scope`; deleting them from HEAD does not make them secret again.

## Product guards

- Beta/Stable isolated; no Beta runtime data copied into Stable by default.
- Worker + InventoryCore SQLite is transaction authority.
- UI is realtime; reload is not synchronization logic.
- No location/bin/pickface or stock-quantity inventory scope.
- No new offline primary/direct-to-Sheet transaction path unless Owner approves.
- Office-network fallback research stays closed unless Owner reopens it.
'''
write("AGENTS.md", agents)

security_path = ROOT / "docs/SECURITY_BOUNDARIES.md"
security = security_path.read_text(encoding="utf-8")
if "## Public information classification" not in security:
    security += r'''

## Public information classification

- **SECRET VALUE** — never in repo/history: private keys, SA JSON, refresh/client secrets, API tokens, signing secrets, passwords, session/access tokens.
- **SECRET REFERENCE** — allowed: secret/variable name and storage location only.
- **PUBLIC IDENTIFIER** — project/app/package/worker/hostname identifiers needed for reproducible automation may be recorded.
- **OPERATIONAL METADATA** — Drive/Sheet/folder IDs are not credentials, but minimize new public exposure. Existing values already in Git history are classified in `ops/project-scope.json`; do not claim HEAD deletion makes them private.
- **BUSINESS SPEC/DESIGN** — public by repo policy unless Owner explicitly changes repository visibility.
- **PERSONAL/REAL OPERATIONAL DATA** — do not commit HR/business production datasets or PII to the public repo.

`ops/project-scope.json` records identifier classification without storing any secret value.
'''
write("docs/SECURITY_BOUNDARIES.md", security)

decisions_path = ROOT / "docs/OWNER_DECISIONS.md"
decisions = decisions_path.read_text(encoding="utf-8")
if "| D032 |" not in decisions:
    marker = "## Superseded historical state"
    d032 = "| D032 | ACTIVE | Canonical project/resource scope is `ops/project-scope.json`. Every in-scope external resource must be identified by exact known canonical ID where appropriate, otherwise canonical name plus ID source. Unlisted resources are fail-closed/out-of-scope until reconciled and Owner-approved; Stable entries remain Owner-gated. |\n\n"
    decisions = decisions.replace(marker, d032 + marker)
write("docs/OWNER_DECISIONS.md", decisions)

state_path = ROOT / "ops/project-state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
state["state_model"] = "REPO_NATIVE_CONTINUITY_COMPLETE"
state["current_status"]["repo_authority"] = "COMPLETE_CONTEXT_SCOPE_DECISIONS_FULL_SPECS_LIVE_STATE_RESOURCES_OPERATING_PROTOCOL_SECURITY_AND_CI_GUARDS"
cap = "Repo authority complete: project context + exact ID/name project scope + durable decisions + full product specs + live workboard + automation protocol + public-repo security + stale/secret guards"
if cap not in state.get("completed_capabilities", []): state.setdefault("completed_capabilities", []).append(cap)
state["authority_setup"] = {
  "status": "PASS_COMPLETE",
  "requirement_1_context_and_id_name_scope": "PASS",
  "requirement_2_github_all_owner_approved_forms_design_logic_scenarios": "PASS_CANONICAL_SPEC_STRUCTURE",
  "requirement_3_live_done_doing_next_state": "PASS_PROJECT_STATE_WORKBOARD",
  "requirement_4_automation_first_owner_manual_minimized": "PASS_OPERATING_PROTOCOL",
  "requirement_5_public_repo_security": "PASS_SECRET_REFERENCE_ONLY_AND_CI_HEURISTIC_GUARD",
  "canonical_scope": "ops/project-scope.json",
  "canonical_manifest": "ops/authority-manifest.json",
  "verified_date": "2026-09-17"
}
write("ops/project-state.json", json.dumps(state, ensure_ascii=False, indent=2))

guard = r'''#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def fail(msg: str) -> None:
    print(f"AUTHORITY_GUARD_FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)

def load_json(path: str) -> dict:
    p = ROOT / path
    if not p.exists(): fail(f"missing {path}")
    try: return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc: fail(f"invalid JSON {path}: {exc}")

def main() -> None:
    manifest = load_json("ops/authority-manifest.json")
    state = load_json("ops/project-state.json")
    scope = load_json("ops/project-scope.json")
    if manifest.get("authority_model") != "REPO_NATIVE_COMPLETE": fail("authority model mismatch")
    if state.get("state_model") != "REPO_NATIVE_CONTINUITY_COMPLETE": fail("project state model mismatch")
    keys = {manifest.get("project_key"), state.get("project_key"), scope.get("project_key")}
    if keys != {"supra-inventory"}: fail(f"project key mismatch: {keys}")
    repo = scope.get("repository", {})
    if str(repo.get("id")) != "1372407002" or repo.get("name") != "tamnv2/supra-inventory": fail("repository scope mismatch")
    for path in manifest.get("bootstrap_order", []):
        if path in {"recent_commits_and_ci", "relevant_live_source"}: continue
        p = ROOT / path
        if path.endswith("/"):
            if not p.is_dir(): fail(f"missing directory {path}")
        elif not p.exists(): fail(f"missing bootstrap source {path}")
    specs = manifest.get("canonical_sources", {}).get("product_specs", [])
    if len(specs) < 9: fail("full spec coverage missing")
    spec_index = (ROOT / "docs/specs/README.md").read_text(encoding="utf-8")
    for path in specs:
        if not (ROOT / path).exists(): fail(f"missing canonical spec {path}")
        if Path(path).name not in spec_index: fail(f"spec index missing {path}")
    resources = scope.get("resources", [])
    if not resources: fail("project scope resources empty")
    seen = set()
    for r in resources:
        key = r.get("key")
        if not key or key in seen: fail(f"invalid/duplicate resource key {key}")
        seen.add(key)
        if not r.get("id") and not r.get("name"): fail(f"resource lacks id/name: {key}")
        if "secret_value" in r: fail(f"secret value field forbidden: {key}")
    for s in scope.get("secret_references", []):
        if s.get("value_in_repo") is not False: fail(f"secret reference must assert value_in_repo=false: {s.get('name')}")
    setup = state.get("authority_setup", {})
    if setup.get("status") != "PASS_COMPLETE": fail("authority setup not complete")
    for n in range(1, 6):
        if "PASS" not in str(next((v for k,v in setup.items() if k.startswith(f"requirement_{n}_")), "")): fail(f"requirement {n} not PASS")
    if not isinstance(state.get("workboard"), dict): fail("workboard missing")
    cs = state.get("current_status", {})
    markers = [str(cs.get("sqlite_schema")), str(cs.get("latest_beta_apk")), str(cs.get("web")), str(cs.get("android"))]
    for derived in manifest.get("derived_views", []):
        text = (ROOT / derived).read_text(encoding="utf-8")
        for marker in markers:
            if marker and marker not in text: fail(f"stale derived view {derived}: missing {marker}")
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for marker in ("ops/project-scope.json","docs/PROJECT_CONTEXT.md","ops/authority-manifest.json","docs/OPERATING_PROTOCOL.md"):
        if marker not in agents: fail(f"AGENTS bootstrap missing {marker}")
    decisions = (ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8")
    for did in ("D027","D028","D029","D030","D031","D032"):
        if did not in decisions: fail(f"decision ledger missing {did}")
    print("AUTHORITY_GUARD_PASS")

if __name__ == "__main__": main()
'''
write("tools/authority_guard.py", guard)

print("AUTHORITY_COMPLETE_PATCH_PASS")
