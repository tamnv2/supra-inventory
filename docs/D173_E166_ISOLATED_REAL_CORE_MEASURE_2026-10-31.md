# D173-E166 — isolated real-Core M2 candidate; actual Lab A/B/C evidence (2026-10-31)

**NO-GO Production.** Owner authorized build/test/usage only with no Production changes. Draft [PR #811](https://github.com/tamnv2/supra-inventory/pull/811) from E116/E115 source. This report distinguishes real-Core local results from provider metered usage and from business FIELD evidence.

## Exact scope and isolation

- Test-only code: `tools/d173_e112_real_core_lab/worker.ts`, `tools/d173_e113_cloud_lab/cloud-worker.ts`, `tools/d173_e166_lab/test-real-core-e166.mjs`, and `.github/workflows/d173-e166-isolated-core-abc.yml`.
- Source production `service/src/`, `web/`, `android/`, Agent/WMS/FCM, Worker Production and D172 OBPP are unchanged. Only existing registered test Worker `supra-inventory-m2-lab` and test SQLite DO `LabRealCore` are used for cloud activity. Same Cloudflare billing account; Lab is not free of quota use.
- A = existing real-Core command + simulated post-write reads; B = actual Core mutation HTTP + lab sidecar patch/push; C = same sidecar on WS. User actions and initial SQL fixture are equal. This is NOT an actual full Web/APK/Agent implementation.
- Core transaction and **test sidecar event insertion are separate**. Crash after Core commit before sidecar event = lost push. This structurally blocks Production acceptance independently of performance.
- Lab identity is synthetic; not Firebase ingress or a physical fleet. Test transports use independently provisioned 20 picker identities for burst and 60 unique dummy picker records, not real devices. No personal user/device/order/SKU data stored in public repo.

## Local real-Core test (PASS)

[Actions run 41198328725](https://github.com/tamnv2/supra-inventory/actions/runs/41198328725): 85 assertions PASS. [E112 Core regression](https://github.com/tamnv2/supra-inventory/actions/runs/41198328738) PASS; D172 source isolation PASS. Baseline HTTP vs HTTP+push vs WS+push results:

| Local metric | A baseline | B HTTP+push | C WS+push |
|---|---:|---:|---:|
| 20 Picker write burst, total ms | 192.31 | 179.53 | 85.40 |
| Write p95 ms | 190.51 | 178.73 | 84.08 |
| Reporter pushes | n/a | 20/20 | 20/20 |
| Final real-Core business state | PASS | PASS | PASS |

Local command counters across all variants: 117 HTTP requests, 42 WS connections, 20 incoming WS app messages; 60 simulated post-write GETs eliminated in B/C for a 20-command subset. **These are source test counts, not provider billed usage or production request savings.** The simulated A traffic is not a 24h replay of 27 October.

## Observed real Cloudflare, separated by execution

1. [Cloud run 41197503301](https://github.com/tamnv2/supra-inventory/actions/runs/41197503301): FAIL at first setup (`LAB_CLOSED`) after successful test Worker deploy and secret upload; no A/B/C comparable traffic.
2. [Cloud run 41197975812](https://github.com/tamnv2/supra-inventory/actions/runs/41197975812): local/E112 PASS, A burst 19/20 Core responses 201; one lab ingress HTTP401. Stopped fail-closed before B/C. Delayed Cloudflare namespace readback isolated fresh A object suffix `1a471b12`: 20 raw DO HTTP invocations, 5,503 SQLite Rows Read, 1,635 SQLite Rows Written, raw duration field 0.029788672. Partial A workload is **not economic A/B**.
3. Third bounded test run: [41198374876](https://github.com/tamnv2/supra-inventory/actions/runs/41198374876). Final error and delayed usage readback must be appended from finished log; no B/C saving claim pending evidence. **No additional Cloudflare load beyond these approved isolated attempts.**

Provider historical Vietnam day-27 baseline: 54,055 raw DO HTTP invocations, 2,577 hibernation, 29 alarms, 133,115,948 Rows Read and 177,739 Rows Written (shared namespace can include D172). Observed Android sample 10,403 attempts across 32 devices, including 5,038 realtime delta GET and 1,110 ticket POST. Neither equals billed DO Compute Requests. Only a partial synthetic workflow is tested; no true daily replay.

## Acceptance gate

**CODE(TEST) partial PASS; ISOLATION PASS; CLOUD A/B/C FAIL; BILLING/SQL parity UNPROVEN; FIELD FAIL/NOT TESTED; OWNER PASS NOT REQUESTED; RELEASE NO-GO.**

To advance: make Core business commit + audience event/patch persisted **atomic** and same-id retry durable, verify role/cursor/invalidation/replay including real Web/APK/Agent and WMS/FCM/Office, compare A/B/C under equal 27-Oct action/fault schedules with full provider billed usage after propagation, p95/p99/SLA, Firebase/Cloudflare whole-account costs, and shared D172 regression. Only a separate explicit Owner release command can change Production.
