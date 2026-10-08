# SUPRA Shared Quota Governance — Owner-approved policy (2026-10-08)

Status: **OWNER POLICY APPROVED; AUTHORITY-ONLY RECORD**. Scope of this file is governance/account-level planning **as it relates to SUPRA Inventory**; it does not authorize mutation of any other project's resources. Canonical Inventory repository: `tamnv2/supra-inventory`. Existing D165 Beta deployed baseline is preserved, and D166 remains reserved for a future separate post-shift HA/usage analysis.

## 1. Owner-approved provider plans and financial envelope

- Cloudflare: existing **Workers Paid USD 5/month base subscription**, shared provider account; no plan change. The base fee is **not** a hard limit on additional usage charges, taxes or independent products.
- Firebase / Google Cloud: **Blaze (pay as you go)**. Aggregate internal **soft budget USD 10/month** for applicable Google Cloud billable charges, not an enforceable spending ceiling and not a directive to disable services. Usage/charges must be checked against actual Cloud Billing projects, billing accounts and SKU invoices before claiming project allocation.
- Google consumer account (Drive, Sheets, Gmail): **Free**. No automatic upgrade to Google One/Google AI Pro, Google Workspace, or any paid Google product. Google AI Pro is not a substitute for API or Cloud Billing quota increase.
- GitHub: **Free**. Other providers: Free unless separately explicitly authorized by Owner.
- Illustrative **monthly financial planning target: USD 15** = USD 5 Cloudflare base + USD 10 Google Cloud soft budget, **excluding Cloudflare overage, taxes, noncovered Google costs and separately authorized services**. Do not present USD 15 as a guaranteed invoice cap.

## 2. Allocation of genuinely shared pools

Internal allocation: **Inventory 30% / Pick Pack 30% / third project (identity pending verification) 30% / central reserve 10%**. Each usage metric is tracked independently (requests, CPU, storage, reads, writes, network, billable SKU cost). It is invalid to transfer spare usage of one metric into another or to assume all provider quotas are account-wide.

Google Cloud USD 10 soft budget: Inventory USD 3 / Pick Pack USD 3 / third project USD 3 / reserve USD 1 per month. Cloudflare base subscription is a shared overhead; for internal cost reporting only, USD 1.50 / USD 1.50 / USD 1.50 / USD 0.50 are illustrative 30/30/30/10 allocations **of the fixed base fee**, not additional purchasable capacity or a charge limit.

**Quota scope must be verified per product:** Cloudflare Workers/Durable Objects/D1/R2/KV/Queues have distinct billing and included-usage pools. Firebase project/database and Google Cloud Billing Account have differing scopes; separate eligible Firestore project/database free tiers must **not** be arbitrarily divided between unrelated projects. Google Sheets/Drive API scopes can vary by Cloud project, user, request weight and daily/minute reset. Shared consumer Google storage excludes already-used personal Gmail/Drive/Photos storage before splitting remaining allocatable capacity. GitHub REST API auth vs unauthenticated limits, public Actions runners and artifact/storage are separate.

**Provider account login ownership does not establish a single shared technical quota pool or a shared Billing Account.** Enumerate project IDs only from verified provider resources; never infer a third-project identity or edit its resources from Inventory authority. Inventory's `ops/project-scope.json` remains the only mutation boundary.

## 3. Alerts and Owner control

Soft-budget alerts at **70%, 85%, 95%** of each applicable project allocation and overall monthly USD 10 Google Cloud budget; at **100%** report an over-budget incident, without automatically stopping or throttling business-critical services.

- 70%: inform and reconcile trend/cycle/forecast with actual load.
- 85%: investigate leading drivers and propose noncritical efficiency options for Owner review.
- 95%: high-priority notification with forecasts and concrete actions requiring approval.
- 100%/forecast breach: alert Owner and maintain critical workflows. Central 10% reserve requires **explicit Owner approval** before reallocation; there is no silent cross-project borrowing.
- For Cloudflare, monitor actual usage for each relevant included metric as well as possible overage; USD 5 Workers Paid fee remains payable independently of use. Any overage approval is separate from the USD 10 Google budget.
- Use actual provider quota/reset/billing periods (Firestore daily quota vs Workers monthly included use vs API per-minute quotas); provide Vietnam-local operational reports without misrepresenting reset boundaries.
- Monitor forecasts and abnormal *rate of consumption* before static threshold crossings. Include data freshness, provider reporting latency, actual vs estimated vs missing values, service/project attribution and anti-duplicate alert suppression.
- Never claim a provider has 0 usage when data is unavailable; mark `N/A` and last-updated time.
- Do not add short-cadence quota polling, per-device accounting writes or usage-driven network spikes. Prefer existing provider billing alerts/monitoring, cached read-only metrics and event/log analysis.

**Business protection:** No automatic provider upgrade, enforced billing cap, scale-to-zero, credential changes, quota-based blocking of reports or Picklist confirmations, loss of Picker ACK/session fences, weakened realtime/HA, or removal of important logs. Any runtime/provider/billing mutation demands a separate explicit Owner authorization and regression/security/usage review.

## 4. Inventory Beta and Stable

Inventory future development is **Beta-first / no new Stable build planned**. This is a planning decision only: existing Stable resources, source configuration and scope entries remain intact and **OWNER-GATED**. Do not delete, deprovision, modify, deploy to, or activate Stable. Beta operates real business traffic and must retain production-grade availability and safeguards. D165 Agent v120, Android vc102, Web/Worker and existing Firebase RTDB rules remain unchanged. D166 HA/Firestore/RTDB investigation is separate and not opened by this documentation-only decision.

## 5. Audit and pending separate approvals

This change records policy only. It does not create/modify Cloudflare Billing or Workers, Google Cloud budgets/alerts, Firebase resource/rules, Sheets/Drive/Apps Script, GitHub settings, SDK/Agent/PDA/Web/Worker, or another repository. Before operationalizing alerts/budgets:
1. Read-only inventory provider account, Cloudflare usage, exact Google Cloud projects and actual Billing Account linkage, Drive used/free storage, GitHub repo/private/public entitlements, and the third project's canonical identity. Unknown/external resources fail closed.
2. Confirm which pools truly aggregate, the corresponding provider quota sources and free-tier eligibility, and whether costs are gross/net of credits and tax.
3. Present exact provider configuration steps, any Owner-only billing permissions, alert delivery channel, impact/rollback, optional new resources, and request **separate approval**.
4. For Inventory-only authority follow the repository's branch -> PR -> authority and continuity PASS -> merge gate. A technical CI pass or policy approval is **not** a claim of runtime PASS or post-change Owner acceptance.

Official reference starting points (read/reverify at configuration time):
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/pricing
- https://cloud.google.com/billing/docs/how-to/budgets
- https://developers.google.com/workspace/sheets/api/limits
- https://developers.google.com/drive/api/guides/limits
- https://developers.google.com/apps-script/guides/services/quotas
- https://docs.github.com/en/billing
