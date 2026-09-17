#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write(path: str, content: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content.rstrip() + "\n", encoding="utf-8")


project_context = r'''# PROJECT_CONTEXT — SUPRA Inventory

Status: **CANONICAL PROJECT CONTEXT**. Read this before any project work.

## Identity

- Project key: `supra-inventory`
- Product name: `SUPRA Inventory — Báo hàng`
- Canonical GitHub repository: `tamnv2/supra-inventory`
- GitHub repository ID: `1372407002`
- Default branch: `main`
- Timezone: `Asia/Ho_Chi_Minh`
- Repository visibility: Public

This project is independent. Never import scope, logic, credentials, resources, or assumptions from Pick Pack 1291, Pickface Damage 1291, SupraCore, VHDCHY, or any other project.

## Product scope

The product manages the **SKU out-of-stock reporting and resolution workflow**.

In scope:
- SKU + product name master data.
- Picker reports that a SKU is out of stock.
- Reporter processing queue and resolution.
- Admin/Root operations, HR source, account management, dashboard/reporting, archive/retention.
- Web + Android/PDA clients.
- Server-authoritative realtime synchronization.

Explicitly out of scope unless Owner reopens it:
- bin/location/pickface inventory management;
- stock quantity management;
- Office-network fallback/provider research;
- a new offline primary transaction path or direct-to-Sheet business writes.

## Roles

- `PICKER`: MNV-based operational user; reports out-of-stock SKU, views own reports, may withdraw an unresolved mistaken report within 60 seconds.
- `REPORTER`: processes the priority queue; resolves `HAS_STOCK` or `SKIP_ALLOWED`; may correct `SKIP_ALLOWED` to `HAS_STOCK` within five minutes.
- `ADMIN`: inherits Reporter operations; manages Reporter accounts, Picker provisioning from HR, Master SKU, dashboard/reporting, settings allowed to Admin.
- `ROOT`: highest application role; inherits Admin/Reporter operations and manages Admin accounts. ROOT is protected from normal subordinate management flows.

The service is authoritative for identity, role, deadlines and state transitions. Client-supplied role is never trusted.

## Runtime topology

`Web / Android PDA → Cloudflare Worker → InventoryCore Durable Object → SQLite`

Supporting systems:
- Firebase Authentication for application identity/session exchange.
- Firebase Cloud Messaging for background notifications.
- Google Sheets as Admin/Root-configured HR source.
- Google Drive/Sheets for batched archive/supporting exports.
- GitHub for code, durable Owner decisions, specifications, work state and CI/deploy evidence.

## Environment identity

### Beta
- GCP/Firebase project: `supra-inventory-beta`
- Worker: `supra-inventory-beta`
- Host: `inventory-beta.supra.cc.cd`
- Android package: `cd.cc.supra.inventory.beta`
- Durable Object: `InventoryCore`
- Current SQLite schema and build/release status: **read `ops/project-state.json`; do not copy a version number from this document.**

### Stable
- GCP/Firebase project: `supra-inventory-stable`
- Worker/config name: `supra-inventory-stable`
- Host: `inventory.supra.cc.cd`
- Android package: `cd.cc.supra.inventory`
- Stable is **OWNER-GATED**. Configuration may exist; deployment/provisioning/public traffic/real-user bootstrap/Stable release requires an explicit current Owner command.

## Canonical authority graph

Read in this order before mutation:
1. Current explicit Owner command in the active conversation.
2. `AGENTS.md`.
3. `docs/PROJECT_CONTEXT.md` — identity and scope.
4. `ops/project-state.json` — live work state: done / in-progress / next / blockers / runtime evidence.
5. `docs/OWNER_DECISIONS.md` — durable Owner-approved decisions and open decisions.
6. `docs/specs/` — approved product forms, workflows and design system.
7. `ops/resource-registry.json` — resource aliases/identifiers and environment status.
8. Current source code + recent commits + CI/deploy evidence.
9. Generated/derived views such as `docs/handovers/HANDOVER_CURRENT.md` and `docs/SERVICE_READINESS.md`.
10. Chat memory/old handovers are retrieval aids only and never override current repo authority.

If canonical sources conflict in a way that could change behavior or target resources, fail closed and reconcile before mutation.

## Continuity contract

GitHub is the durable project memory. Chat is the control surface, not the source of truth.

Every Owner-approved requirement must be captured in GitHub in the same workstream. Every meaningful implementation change must update project state in the same change set. Generated summaries are never manually authoritative.
'''

role_workflows = r'''# ROLE_WORKFLOWS — Owner-approved business scenarios

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
'''

forms = r'''# FORMS — Approved UI input and action contracts

Status: **CANONICAL PRODUCT SPEC**. This documents business-facing form intent; source code remains implementation evidence. Fields not approved by Owner must not be invented.

## Login — Web + Android

Inputs:
- Username / MNV
- Password

Rules:
- Do not prefill `root` or any credential.
- Backend is authoritative for role and account status.
- Login errors must not reveal credential secrets.

## Picker report — Android/PDA

Inputs/actions:
- Search/select SKU from local server-synchronized catalog.
- Product name is derived from selected SKU, not free-form inventory data.
- Submit out-of-stock report.
- View own current/recent reports.
- Withdraw button appears only when server rules allow unresolved withdrawal within 60 seconds.

Do not add location/bin or quantity fields.

## Reporter queue — Web/Android where allowed

Display/actions:
- SKU + product name.
- affected Picker count.
- report timing/priority context.
- affected Picker ticket detail.
- `Có hàng` (`HAS_STOCK`).
- `Cho phép bỏ qua` (`SKIP_ALLOWED`).
- correction to `HAS_STOCK` only while server 5-minute correction deadline remains valid.

## HR source — Admin/Root Web

Inputs:
- Google Sheet URL.
- Exact tab name.

Backend validates before save:
- readable Google Sheet;
- exact tab exists;
- required MNV + Họ tên columns.

UI shows human-readable source status/row metadata. Picker sync is Preview → explicit Apply.

## Managed user creation

ROOT form:
- username/MNV
- display name
- creates ADMIN only.

ADMIN form:
- username/MNV
- display name
- creates REPORTER only.

Normal subordinate controls may enable/disable/reset permitted accounts but must never manage ROOT.

## Master SKU import — Admin/Root Web

Inputs/actions:
- select `.xlsx` file;
- preview/validate;
- resolve in-file SKU/name conflicts explicitly;
- confirm existing SKU rename conflicts;
- apply in bounded chunks with progress/status.

## Admin dashboard

Shared date filter with quick presets. Compact operational overview only:
- core report KPIs;
- report/resolution trend;
- outcome breakdown;
- top reported SKUs;
- drill-down to detailed Reporting.

Do not add stock quantity/location metrics or employee performance scoring without Owner approval.

## Reporting — Admin/Root Web

Approved controls:
- date range;
- status;
- SKU/query;
- pagination;
- explicit chunked CSV export.

Final export columns and any expanded Reporter dashboard visibility remain Owner-open decisions.

## Account/password

Authenticated user may access account functions allowed by role. Password reset/bootstrap values are protected runtime secrets and must never be rendered from repo/config.
'''

ui_design = r'''# UI_DESIGN_SYSTEM — Concept 3

Status: **CANONICAL OWNER-SELECTED DESIGN DIRECTION**.

## Visual language

- Light background.
- Green is the primary action/positive accent.
- Orange is reserved for attention/warning states.
- Red is reserved for error/destructive states.
- Clean borders, restrained shadows, low visual clutter.
- Clear typography hierarchy and consistent status chips/cards.
- Web and Android share component language but do not copy desktop layout onto PDA.

## Web information architecture

Role-aware navigation:
- Tổng quan (Admin/Root)
- Hàng chờ (Reporter/Admin/Root)
- Báo cáo (Admin/Root)
- Master SKU (Admin/Root)
- Nhân sự (Admin/Root according to hierarchy)
- Tài khoản

Dashboard is an overview; detailed data lives in Reporting. Tables/actions must remain usable at narrow widths.

## Android/PDA information architecture

Optimize for fast warehouse operation:
- large touch targets;
- minimal steps;
- strong status hierarchy;
- Picker flow prioritizes SKU search/report/current status;
- Reporter/Admin/Root operational mode prioritizes queue → batch detail → resolve/correct.

Deep desktop administration does not need to be duplicated onto PDA unless Owner approves it.

## Semantic states

- Success: green.
- Warning/attention/in-progress: orange/neutral as context requires.
- Error/destructive: red.
- Status must not rely on color alone; include text/icon/shape semantics.

## Scope guard

Concept artwork is visual direction, not business authority. Never import mock fields such as stock quantity, location/bin, or unapproved capabilities simply because they appeared in a generated concept image.
'''

spec_index = r'''# Product Specification Index

These files are canonical durable product knowledge and must be read before changing the matching area:

- `ROLE_WORKFLOWS.md` — Picker/Reporter/Admin/Root scenarios and data lifecycle.
- `FORMS.md` — approved business-facing form/action contracts.
- `UI_DESIGN_SYSTEM.md` — Owner-selected Concept 3 design authority.
- `../OWNER_DECISIONS.md` — decision ledger, superseded history and open decisions.
- `../PROJECT_CONTEXT.md` — project identity/scope and authority graph.

Rule: a new Owner-approved form, workflow, design rule or scenario must update the relevant spec and `OWNER_DECISIONS.md` in the same workstream. Do not leave approved requirements only in chat history.
'''

authority_manifest = {
    "schema_version": 1,
    "authority_model": "REPO_NATIVE_V2",
    "project_key": "supra-inventory",
    "bootstrap_order": [
        "AGENTS.md",
        "docs/PROJECT_CONTEXT.md",
        "ops/project-state.json",
        "docs/OWNER_DECISIONS.md",
        "docs/specs/README.md",
        "docs/specs/ROLE_WORKFLOWS.md",
        "docs/specs/FORMS.md",
        "docs/specs/UI_DESIGN_SYSTEM.md",
        "ops/resource-registry.json",
        "recent_commits_and_ci",
        "relevant_live_source"
    ],
    "canonical_sources": {
        "context_scope": "docs/PROJECT_CONTEXT.md",
        "owner_decisions": "docs/OWNER_DECISIONS.md",
        "work_state": "ops/project-state.json",
        "resource_registry": "ops/resource-registry.json",
        "product_specs": "docs/specs/",
        "implementation": ["service/", "web/", "android/"],
        "ci": ".github/workflows/"
    },
    "derived_views": [
        "docs/handovers/HANDOVER_CURRENT.md",
        "docs/SERVICE_READINESS.md"
    ],
    "update_coupling": {
        "owner_requirement_change": ["docs/OWNER_DECISIONS.md", "relevant docs/specs/*"],
        "meaningful_implementation_change": ["ops/project-state.json"],
        "resource_change": ["ops/resource-registry.json"],
        "derived_view_freshness": "CI_FAIL_IF_CURRENT_STATE_MARKERS_MISMATCH"
    },
    "security": {
        "repository_visibility": "public",
        "secret_values_allowed_in_repo": False,
        "operational_identifier_policy": "MINIMIZE_PUBLIC_EXPOSURE__PREFER_ALIASES_AND_RUNTIME_VARIABLES_FOR_NEW_SENSITIVE_OPERATIONAL_IDS",
        "chat_memory_authority": "NON_CANONICAL_RETRIEVAL_AID_ONLY"
    }
}

agents = r'''# AGENTS.md — SUPRA Inventory

This repository belongs only to `SUPRA Inventory — Báo hàng` (`supra-inventory`). Do not import assumptions, credentials, resources, business rules or memories from Pick Pack 1291, Pickface Damage, SupraCore, VHDCHY, or any other project.

## Mandatory bootstrap before project mutation

Read, in order:
1. `AGENTS.md`
2. `docs/PROJECT_CONTEXT.md`
3. `ops/project-state.json`
4. `docs/OWNER_DECISIONS.md`
5. `docs/specs/README.md` and the relevant spec files
6. `ops/resource-registry.json`
7. recent commits/CI evidence and the live source relevant to the requested task

`ops/authority-manifest.json` defines the machine-readable authority map. Generated/derived views such as `docs/handovers/HANDOVER_CURRENT.md` and `docs/SERVICE_READINESS.md` are convenience views only.

## Authority

1. Current explicit Owner command in the active conversation.
2. Repo canonical context/state/decision/spec/resource files listed above.
3. Current implementation source + recent commits + CI/deploy evidence.
4. Generated views.
5. Chat memory / old handovers only as historical retrieval aids.

If a current Owner command changes a durable rule, update the repo authority in the same workstream. If canonical sources conflict in a way that could change behavior or target resources, fail closed and reconcile before mutation.

## Repo-as-project-memory rule

GitHub is the durable project memory. Chat is the control surface, not the canonical source of truth.

- Do not rely on remembered chat details when the repo can answer the question.
- New Owner-approved forms, workflows, UI rules, scenarios and scope changes must be captured in `docs/OWNER_DECISIONS.md` plus the relevant `docs/specs/*` file.
- Superseded decisions are marked; they are not silently deleted.
- Meaningful implementation progress must update `ops/project-state.json` in the same change set.
- Resource changes must update `ops/resource-registry.json`.
- Manual end-of-chat handover creation is not required.

## Work-state rule

`ops/project-state.json` must always expose current status, completed capability, pending/field work, current workboard and next action. A session that receives “continue” must fresh-read it before acting.

Technical CI PASS is not Owner business acceptance. Physical PDA/field acceptance stays explicitly separate.

## Automation-first rule

Maximize safe automation. For finite jobs: trigger → poll → inspect failure → repair within scope → rerun until terminal PASS or a real Owner-only blocker/hard tool limit.

If Owner action is genuinely required:
- first verify it cannot be done through available connected tools/CI;
- provide the shortest safe official UI path;
- batch permissions/setup so Owner does it once where possible;
- avoid requiring local software installation, terminal commands or local scripts unless there is no practical web/connected-tool alternative;
- after Owner action, immediately recheck automatically.

## Stable guard

Stable is Owner-gated. Do not deploy, provision, publish, route traffic, create real-user data, activate Stable OAuth refresh tokens, promote Beta, or release Stable without explicit current Owner authorization.

## Public-repo security guard

Never commit/log/paste secret values: service-account JSON/private keys, OAuth client secrets/refresh tokens, Cloudflare tokens, signing keystores/passwords, root/admin passwords, session/access tokens, or private API keys.

For new operational identifiers, minimize public exposure. Prefer logical aliases and GitHub/Cloudflare runtime variables where practical. Exact non-secret identifiers may only be public when needed for reproducible automation and after considering exposure. Never move a secret into a normal Actions variable; GitHub variables are for non-sensitive configuration.

Existing historical public identifiers are not made private merely by deleting them from the latest commit. Do not claim otherwise.

## Change guards

- Keep Beta and Stable isolated.
- Verify target environment/resource before cloud mutation.
- Do not broaden IAM/OAuth scopes without documented need.
- Do not weaken organization-wide service-account-key policy.
- Keep UI realtime; reload is not synchronization logic.
- Do not add location/bin/stock-quantity inventory scope.
- Do not reopen Office fallback research unless Owner reopens it.
'''

architecture = r'''# Architecture — SUPRA Inventory

Status: **CANONICAL STRUCTURAL SPEC**. Current version/build/readiness numbers belong in `ops/project-state.json`, not here.

## Topology

`Web / Android PDA → Cloudflare Worker → InventoryCore Durable Object → SQLite`

Supporting systems:
- Firebase Authentication: identity/session exchange.
- FCM: background best-effort notification.
- Google Sheets: configurable HR source.
- Google Drive/Sheets: batched archive/supporting exports.
- GitHub: source, durable Owner decisions/specs/work state, CI/deploy evidence.

## Authority boundaries

- Business transaction authority: Worker + InventoryCore SQLite.
- Client state is not authoritative; reconnect/resume must resync from API.
- Foreground realtime: WebSocket invalidation/resync.
- Background: FCM notification; delivery failure must not fail a committed business mutation.
- Google Sheets is not a competing transaction store.

## Data model semantics

Keep separate:
- report ticket: one Picker's report;
- processing batch: grouped work for a SKU;
- lifecycle/audit event: state-change history.

Open dedupe: Picker + SKU. Multiple Pickers may share one batch while retaining individual tickets.

## Environment isolation

Beta and Stable have separate project/application/runtime identities. Stable remains Owner-gated. Do not copy Beta runtime data into Stable.

## Security boundary

Secrets stay in runtime secret stores / GitHub secrets, never source. Public operational metadata should be minimized. Read `docs/SECURITY_BOUNDARIES.md` and `ops/resource-registry.json`.

## Current implementation status

Do not maintain a duplicate checklist here. Read `ops/project-state.json` and current CI/deploy evidence.
'''

security = r'''# Security Boundaries

## Public repository policy

The repository is public. Store code, durable non-secret project knowledge and only the operational metadata needed for reproducible work.

Never commit:
- service-account JSON/private keys;
- OAuth client secrets or refresh tokens;
- Cloudflare API tokens;
- Android signing keystores/passwords;
- root/admin passwords;
- session/access tokens;
- private API keys.

GitHub Actions **variables are for non-sensitive configuration**. Sensitive values belong in secrets/runtime secret stores. GitHub secret scanning/push protection helps detect supported credentials, but ordinary resource IDs such as Drive/Sheet IDs may not be treated as secrets; therefore exposure minimization is still required.

## Operational identifier policy

For new resources:
1. Publicly store logical resource name/alias and environment.
2. Prefer GitHub/Cloudflare runtime variables for exact operational IDs when automation can consume them without exposing them in source.
3. Publicly record an exact non-secret ID only when it is required for reproducible automation and the exposure is acceptable.
4. Never record access tokens/credential values, even if convenient.

Legacy exact IDs already committed to public Git history remain historical public metadata. Removing them from HEAD alone does not erase history. Any future privacy hardening must be treated as a deliberate migration, not cosmetic redaction.

## Cloudflare/runtime secrets

Environment credentials stay environment-specific. Beta and Stable values must never be cross-used. Wrangler/source declares secret names only; values remain in runtime secret stores.

## Durable Object / SQLite boundary

- Beta `InventoryCore` is the current operational store.
- Stable is Owner-gated until explicit release/provision command.
- Health endpoints may expose status/schema/binding presence only, not secrets or business data.

## HR boundary

Admin/Root configures HR source through authenticated UI. Backend validates URL, exact tab and required MNV + Họ tên columns before save. Minimum read access is preferred.

## IAM/OAuth

- Keep organization-wide service-account-key restrictions; only documented project exceptions are allowed.
- Do not broaden runtime IAM roles without reviewed need.
- Current Google Drive scope remains `drive.file` unless a documented requirement proves it insufficient.

## CI/deploy

- Environment secrets are consumed only by jobs that need them.
- Do not print authorization payloads or credential values.
- Prefer least privilege and environment isolation.
- Stable deploy remains Owner-gated.
'''

service_readiness_template = r'''# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `{beta}`
- Stable: `{stable}`
- SQLite schema: `{schema}`
- Web: `{web}`
- Android: `{android}`
- Latest signed Beta APK: `{apk}`
- Realtime: `{realtime}`
- FCM: `{fcm}`
- User management: `{users}`
- Archive: `{archive}`
- Admin dashboard: `{dashboard}`
- Quota/resilience: `{quota}`

## Remaining acceptance/build work

{pending}

## Next action

{next_action}

Stable remains Owner-gated.
'''

handover_template = r'''# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `{beta}`
- Stable: `{stable}`
- SQLite schema: `{schema}`
- Web: `{web}`
- Android: `{android}`
- Latest signed Beta APK: `{apk}`
- Realtime: `{realtime}`
- FCM: `{fcm}`
- Admin dashboard/reporting: `{dashboard}`
- Quota/resilience: `{quota}`

## Workboard

### In progress
{in_progress}

### Next
{next_items}

### Blocked / Owner-field dependent
{blocked}

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `AGENTS.md` and `ops/authority-manifest.json`, then read canonical files before mutation.
'''


def bullets(items: list[str]) -> str:
    return "\n".join(f"- {x}" for x in items) if items else "- None"


# Write canonical context/specs.
write("docs/PROJECT_CONTEXT.md", project_context)
write("docs/specs/README.md", spec_index)
write("docs/specs/ROLE_WORKFLOWS.md", role_workflows)
write("docs/specs/FORMS.md", forms)
write("docs/specs/UI_DESIGN_SYSTEM.md", ui_design)
write("ops/authority-manifest.json", json.dumps(authority_manifest, ensure_ascii=False, indent=2))
write("AGENTS.md", agents)
write("docs/ARCHITECTURE.md", architecture)
write("docs/SECURITY_BOUNDARIES.md", security)

# Record Owner decisions without rewriting history.
decisions_path = ROOT / "docs/OWNER_DECISIONS.md"
decisions = decisions_path.read_text(encoding="utf-8")
if "| D027 |" not in decisions:
    marker = "\n## Superseded historical state\n"
    additions = r'''
| D027 | ACTIVE | GitHub is the durable project memory for SUPRA Inventory. New AI sessions must bootstrap from repo-native context/state/decision/spec/resource files before mutation; chat memory and old handovers are non-canonical retrieval aids only. |
| D028 | ACTIVE | All Owner-approved project scope, forms, design rules, business logic and scenarios must be captured in the canonical GitHub decision/spec structure in the same workstream. Superseded rules remain historically marked rather than silently deleted. |
| D029 | ACTIVE | Live work continuity is maintained in `ops/project-state.json`: meaningful implementation work records current status, completed work, pending/field work and next action in the same change set. Generated handover/readiness views are derived only and CI must detect stale key markers. |
| D030 | ACTIVE | Automation-first operating rule: use connected tools/CI for setup/build/deploy/verification wherever safely possible. If Owner action is genuinely required, give the shortest official UI path, batch setup/permissions where possible, avoid local installs/CLI unless necessary, then automatically recheck after Owner action. |
| D031 | ACTIVE | Public-repo security is fail-closed for secret values. New operational metadata exposure must be minimized: prefer aliases and runtime variables/secrets when practical; exact non-secret IDs are public only when needed for reproducible automation. Existing IDs already in public Git history are not made private by deleting them from HEAD. |
'''
    if marker not in decisions:
        raise SystemExit("OWNER_DECISIONS marker missing")
    decisions = decisions.replace(marker, "\n" + additions + marker, 1)
    decisions_path.write_text(decisions, encoding="utf-8")

# Upgrade machine-readable work state.
state_path = ROOT / "ops/project-state.json"
state = json.loads(state_path.read_text(encoding="utf-8"))
state["state_model"] = "REPO_NATIVE_CONTINUITY_V2"
state["authority"] = {
    "manifest": "ops/authority-manifest.json",
    "context": "docs/PROJECT_CONTEXT.md",
    "decisions": "docs/OWNER_DECISIONS.md",
    "specs": "docs/specs/",
    "generated_views_are_authoritative": False,
    "chat_memory_authoritative": False
}
state["workboard"] = {
    "in_progress": [],
    "next": [
        "Owner field-test beta-vc30 on physical PDA/Web and report business/UI findings for iterative Beta adjustment",
        "Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA",
        "Define Owner workload target before isolated destructive/mutation load acceptance"
    ],
    "blocked_or_owner_field_dependent": [
        "Owner business acceptance",
        "Physical PDA FCM delivery acceptance",
        "Isolated mutation load acceptance requires an Owner workload target/test boundary"
    ],
    "last_runtime_evidence": {
        "schema": 5,
        "signed_beta_release": "beta-vc30",
        "concept3_runtime_source_commit": "8e2d6f440b312206e231ece4e4e51d3b3172b785",
        "verification_basis": "GitHub Actions Concept 3 finish deploy/smoke/signing PASS plus permanent UI guard PASS"
    }
}
completed = state.setdefault("completed_capabilities", [])
cap = "Repo-native authority v2: canonical context + Owner decision ledger + product specs + live workboard + stale-view CI guard"
if cap not in completed:
    completed.append(cap)
state["next_action"]["primary"] = "Owner field-test current Beta beta-vc30 on Web/PDA; future AI sessions bootstrap from GitHub authority v2 and apply new feedback on Beta. Stable remains gated."
state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Build derived views from current state.
cs = state["current_status"]
wb = state["workboard"]
service = service_readiness_template.format(
    beta=cs["beta"], stable=cs["stable"], schema=cs["sqlite_schema"], web=cs["web"], android=cs["android"], apk=cs["latest_beta_apk"],
    realtime=cs["realtime"], fcm=cs["fcm"], users=cs["user_management"], archive=cs["archive"], dashboard=cs["admin_dashboard"], quota=cs["quota_resilience"],
    pending=bullets(state.get("pending_build", [])), next_action=state["next_action"]["primary"]
)
write("docs/SERVICE_READINESS.md", service)

handover = handover_template.format(
    beta=cs["beta"], stable=cs["stable"], schema=cs["sqlite_schema"], web=cs["web"], android=cs["android"], apk=cs["latest_beta_apk"], realtime=cs["realtime"], fcm=cs["fcm"], dashboard=cs["admin_dashboard"], quota=cs["quota_resilience"],
    in_progress=bullets(wb["in_progress"]), next_items=bullets(wb["next"]), blocked=bullets(wb["blocked_or_owner_field_dependent"])
)
write("docs/handovers/HANDOVER_CURRENT.md", handover)

# Permanent authority guard.
authority_guard = r'''#!/usr/bin/env python3
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
    if manifest.get("authority_model") != "REPO_NATIVE_V2": fail("authority model mismatch")
    for path in manifest.get("bootstrap_order", []):
        if path in {"recent_commits_and_ci", "relevant_live_source"}: continue
        p = ROOT / path
        if path.endswith("/"):
            if not p.is_dir(): fail(f"missing directory {path}")
        elif not p.exists(): fail(f"missing bootstrap source {path}")
    if state.get("state_model") != "REPO_NATIVE_CONTINUITY_V2": fail("project state model is not V2")
    if not isinstance(state.get("workboard"), dict): fail("workboard missing")
    cs = state.get("current_status", {})
    required_markers = [str(cs.get("sqlite_schema")), str(cs.get("latest_beta_apk")), str(cs.get("web")), str(cs.get("android"))]
    for derived in manifest.get("derived_views", []):
        text = (ROOT / derived).read_text(encoding="utf-8")
        for marker in required_markers:
            if marker and marker not in text: fail(f"stale derived view {derived}: missing {marker}")
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for marker in ("docs/PROJECT_CONTEXT.md", "ops/authority-manifest.json", "docs/specs/README.md"):
        if marker not in agents: fail(f"AGENTS bootstrap missing {marker}")
    decisions = (ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8")
    for did in ("D027", "D028", "D029", "D030", "D031"):
        if did not in decisions: fail(f"decision ledger missing {did}")
    print("AUTHORITY_GUARD_PASS")

if __name__ == "__main__": main()
'''
write("tools/authority_guard.py", authority_guard)

authority_workflow = r'''name: Repo Authority Guard

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  authority:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Validate canonical authority graph and derived-view freshness
        run: |
          python3 tools/project_state_guard.py
          python3 tools/authority_guard.py
      - name: Public repository secret-value heuristic guard
        run: |
          set -euo pipefail
          ! git grep -nE -- '-----BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY-----' -- ':!*.lock'
          ! git grep -nE -- '(GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN|CF_API_TOKEN_INVENTORY_BETA|BETA_KEYSTORE_PASSWORD|ROOT_BOOTSTRAP_PASSWORD)[[:space:]]*=[[:space:]]*["'"'][^$<{][^"'"']+' -- ':!*.md' ':!*.py' || { echo 'Potential committed secret value'; exit 1; }
          echo "PUBLIC_REPO_SECRET_HEURISTIC_PASS"
'''
write(".github/workflows/authority-guard.yml", authority_workflow)

print("REPO_AUTHORITY_V2_PATCH_PASS")
