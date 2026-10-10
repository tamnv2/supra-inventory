# SUPRA Shared Quota Governance — Owner policy (2026-10-08; revised 2026-10-10)

Status: **OWNER-APPROVED POLICY — 2026-10-10 REVISION ACTIVE; DOCUMENTATION ONLY**.
Authority: explicit Owner instruction of 2026-10-10 supersedes incompatible 2026-10-08 wording on **cross-metric workload optimization, financial reserve and Google Drive capacity planning**. Original `GOV-QUOTA-20261008` Owner PASS remains historical. This revision is recorded inside the ongoing D166 usage-analysis scope; it **does not** mean D166 has Owner field PASS or permit opening D167. Inventory resource mutations are limited to `ops/project-scope.json`; Stable remains Owner-gated.

## 1. Current plans and spending envelope (Owner correction 2026-10-10)

- **Cloudflare:** Workers Paid base subscription currently **USD 5/month**; this is the only service subscription the Owner currently reports paying. It is a fixed fee, not an overage ceiling. Usage exceeding included limits may cause additional charges.
- **Firebase / Google Cloud:** Blaze billing is enabled, but all design and operation must **prioritize staying within applicable actual free-tier allowances**. Blaze is not itself a USD 0 guarantee.
- **One shared incremental-cost contingency reserve:** **maximum internal target USD 5/month across ALL additional provider usage charges combined**, including any Cloudflare overage, Firebase/Google Cloud billed usage and other currently-free products that incur usage charges. **Do not** interpret this as USD 5 per service, per project or per metric. There is **no longer a separate Google Cloud USD 10/month soft budget**. Do not pre-allocate/spend the reserve without Owner approval.
- **Planning total:** USD 5 Cloudflare base + up to USD 5 combined additional usage = **USD 10/month internal target**. This is not an enforceable provider invoice cap. Taxes, FX, existing unrelated subscriptions and billing-account scope must be checked separately; alert on risk before incurring expense.
- **Google Drive / Sheets / Gmail:** currently operated on free access. Drive storage capacity is **not a primary optimization constraint** because the Owner may use/upgrade to a **Google AI Pro (Gemini Pro) plan offering 5 TB storage** if/when separately confirmed and authorized. Do not claim a 5 TB entitlement is active today, automatically purchase it, or mistake storage entitlement for unlimited Drive/Sheets API rate, file, bandwidth, permission or Apps Script quotas.
- **GitHub and remaining services:** free-tier by default; no automatic plan upgrade or new paid product.

**Superseded 2026-10-08 finance statements:** the Google Cloud USD 10 monthly soft ceiling, its USD 3/3/3/1 allocations and the USD 15/month combined illustrative target are historical, **NOT ACTIVE**. Keep only as auditable superseded history, not as current thresholds.

## 2. Shared-account planning vs technical quota pools

Maintain the previously approved **Inventory 30% / Pick Pack 30% / third project (identity unverified) 30% / central reserve 10%** *only* as internal fairness/planning for **verified, actually shared account-level pools**. It does not automatically divide dedicated project/database free allowances, force equal usage per provider metric, or earmark the combined USD 5 financial contingency. A third project's resources remain out of Inventory mutation scope; unverified pools are `N/A`, not assumed shared.

Actual read/write/request/CPU/storage/egress quotas, billing rates, free-tier scopes and reset periods must be measured **individually**. Different metrics are not financially or technically fungible merely because they have unused numerical headroom. Do not algebraically transfer one provider quota to another, and do not add unlike units as a cost or efficiency score.

## 3. Mandatory cross-metric workload rebalance investigation (Owner correction 2026-10-10)

**New instruction replacing the earlier absolute prohibition on using spare usage across metrics:**

When one quota family (A) is near/above its internal safe target and other existing authorized metric families (B/C) have material free headroom, **proactively investigate and propose redesigning the same business operation** so that some genuine work moves from A to B/C. The objective is to reduce the constrained metric's actual consumption / expected bill, use otherwise underutilized free allowances, and achieve **equivalent or better verified business results**, not to transfer the provider's quota units.

Owner illustration: current A=100, B=5, C=5, targets 50 each; **illustrative alternative** A=40, B=30, C=40 with the same abstract total 110. These figures illustrate workload allocation, **not** a proof that 1 A request equals 1 B event or 1 C write. Real proposals must normalize units, usage cycle, prices and service effects.

For every genuine over-target/hot metric, produce a comparative decision record:
1. **Baseline:** exact provider/project/metric ownership, billing/free-tier denominator, quota/reset window, source freshness, consumption rate, per-hour/PDA-hour/Agent-hour/per-1,000-business-operations workload, likely root cause and attribution confidence.
2. **Candidate alternatives:** existing scoped services/underused metric families; what processing/data flow can actually move, what cannot, why; expected A reduction, B/C additions, provider per-operation tariff/free-tier risk, RAM/CPU/network/latency/storage effects, failure mode and extra operational complexity.
3. **Business equivalence:** maintain InventoryCore authoritative transactions, correct WMS/Agent single-PRIMARY fencing, idempotency, Picker ACK, result/event ordering, RBAC, audit/privacy, realtime UI, confirm P50/P90/P95, HA and device battery/stability at least as good as the accepted comparable baseline.
4. **No hidden cross-subsidy:** distinguish a measured architecture change from mere ratio/budget redistribution. Confirm no independent B/C per-minute, per-user, per-project, storage, API request or concurrency limit is exceeded; an alternative that shifts cost or bottleneck elsewhere is not an optimization.
5. **Cost and rollback:** forecast total combined incremental monthly spend against the **USD 5** shared contingency and compare at least two representative equivalent shifts before claiming savings; include rollback and release scope.
6. **Decision gate:** report measured findings and ranked proposals to Owner. **No automatic provider migration, extra service activation, plan upgrade, infrastructure refactor or behavior change** until separate explicit Owner approval after impact review.

Prioritize targeted SQL/query reductions, listener and query deduplication, batched events/exports, local ephemeral aggregation, safe caching and existing free/low-usage channels if they truly reduce the constrained meter. Examples are **candidates**, not authorization to make Drive/Sheets the transaction authority or weaken online-only reporting.

**Non-negotiable optimization invariants:** no worse speed/realtime/availability/correctness; no lost or duplicate confirmations/ACK; no new polling storms, expensive log writes or sensitive-data exposure. A small increase in a low-used metric is acceptable only if an actual measured net benefit is established. If no safe cross-metric substitute exists, say so; optimize A directly.

## 4. Monitoring, alerting and Owner control

Use provider-verified metrics and distinct quota periods. Soft usage alert levels **70% / 85% / 95% / 100%** remain applicable per relevant safe target and actual free/included quota, and additionally forecast **combined incremental monthly provider charges** relative to the shared USD 5 contingency:
- 70%: trend and root-cause review, identify alternative B/C headroom.
- 85%: investigate rebalance candidates with comparable usage and operational evidence.
- 95%: urgent Owner report with cost forecast, tradeoffs and rollback options.
- 100% / forecast over USD 5: escalate immediately; **do not silently spend, auto-upgrade, or stop critical operations**. Owner decides the mitigation/exception.

Monitoring must distinguish account vs project billing, gross vs credits, real billed usage vs estimated usage vs `N/A`, provider day vs Vietnam operating day, and missing/stale samples. Prefer existing provider native billing alerts, cached read-only metrics and local log analysis; no short-cadence usage polling or extra provider writes just to measure usage.

## 5. Owner-instruction precedence / supersession

**A later explicit Owner-confirmed directive overrides an earlier directive on the same subject and same scope from its effective confirmation date**, even if the older directive is present in a prior D-number, handover, spec, historical decision, or this governance file. Mark the older rule `SUPERSEDED_BY:<decision/date>` in active policy references; retain historical text/evidence for audit, but it has **no active normative force** where it conflicts. Unrelated/non-conflicting portions continue. Distinguish later suggestions or AI interpretations from actual Owner-confirmed decisions; no speculative overrides.

Apply the current explicit Owner instruction above historical GitHub text for the active task, then persist it through the same authorized branch/PR/CI flow. This precedence **does not waive** resource scope, secret safety, Stable Owner-gate, serial D166 Owner-PASS gate, or separate approval for runtime/billing mutations. Where newer Owner scope or exact meaning is unclear, reconcile the conflict rather than inventing permissions.

Specific supersessions:
- 2026-10-10 workload rebalance investigation **supersedes** the 2026-10-08 statement `It is invalid to transfer spare usage of one metric into another` **only insofar as that statement prohibited proposing real, measured cross-metric workload redesign**. Literal technical-quota conversion remains impossible.
- 2026-10-10 combined incremental **USD 5** reserve **supersedes** the separate Google Cloud USD 10 soft budget and its USD 15 total planning example.
- 2026-10-10 Drive optional 5 TB path **supersedes** treating consumer Drive storage exhaustion as a dominant near-term constraint; API limits and actual plan eligibility remain.

## 6. Scope, deployment and verification boundary

This revision is **authority/spec/state only**; does not mutate provider billing, Cloudflare, GCP/Firebase, Drive/Sheets/Apps Script, signed artifacts, Web/Android/Agent runtime, or unrelated projects. D166 release vc104/v124 and its outstanding real-device/usage/Owner field gates are unchanged. Stable remains **OWNER-GATED**.

Before implementing any rebalance or enabling a budget alert: verify actual provider fee/included quota by SKU/project, repository scope, security and operational regression; show the Owner baseline, option matrix, monthly forecast, rollout/rollback and explicit approval request. Branch → PR → Repo Authority + Project State continuity PASS → merge; no direct main push. All new decisions are tracked in `docs/OWNER_DECISIONS.md` and relevant spec/state within the same authorized change set.

References: https://developers.cloudflare.com/workers/platform/pricing/ ; https://firebase.google.com/pricing ; https://firebase.google.com/docs/firestore/quotas ; https://cloud.google.com/billing/docs/how-to/budgets ; https://one.google.com/intl/vi_vn/about/google-ai-plans/ ; https://developers.google.com/drive/api/guides/limits
