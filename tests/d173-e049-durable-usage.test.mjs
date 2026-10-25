import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('E049 aggregate-only DO SQLite survives isolate restart and bounds retention',()=>{
 const m=read('service/src/d173-persistent-usage.ts');
 const core=read('service/src/core.ts');
 assert.match(m,/CREATE TABLE IF NOT EXISTS d173_usage_counters/);
 assert.match(m,/PRIMARY KEY \(hour_utc, metric_kind, metric_id, method\)/);
 assert.match(m,/ON CONFLICT\(hour_utc, metric_kind, metric_id, method\) DO UPDATE SET/);
 assert.match(m,/executions = executions \+ 1/);
 assert.match(m,/const RETENTION_DAYS = 35/);
 assert.match(m,/DELETE FROM d173_usage_counters WHERE hour_utc < \?/);
 assert.match(core,/initializeD173MetricsTable\(this.state\)/);
 assert.match(m,/return true/);
 assert.match(m,/return false/);
 assert.doesNotMatch(m,/request\.json\(|JSON\.stringify\(request\)|url\.searchParams|headers\.get\(/);
});
test('E049 durable SQL rows/calls/latency count allowlisted query IDs only',()=>{
 const src=read('service/src/d166-sql-usage.ts');
 const m=read('service/src/d173-persistent-usage.ts');
 assert.match(src,/if \(!QUERY_IDS.has\(queryId\)\) return/);
 assert.match(src,/recordD173PersistedMetric\(state, "SQL", queryId, ""/);
 assert.match(src,/snapshotD173PersistentMetrics\(state, "SQL"\)/);
 assert.match(src,/rows_read: item\.rows_read/);
 assert.match(src,/rows_written: item\.rows_written/);
 assert.match(src,/latency_ms: item\.latency_ms/);
 assert.match(m,/MAX\(max_latency_ms, excluded.max_latency_ms\)/);
 assert.match(m,/unavailable_cursor_samples = unavailable_cursor_samples \+ excluded.unavailable_cursor_samples/);
});
test('E049 counts routed and scheduled DO runs, no new network or timer',()=>{
 const src=read('service/src/d167-route-usage.ts');
 const core=read('service/src/core.ts');
 const m=read('service/src/d173-persistent-usage.ts');
 assert.match(src,/recordD173PersistedMetric\(state, "ROUTE", family, action/);
 assert.match(core,/recordD167DoRequest\(this.state, "OTHER", "\/__system_alarm"\)/);
 assert.match(src,/return "ALARM"/);
 assert.match(src,/snapshotD173PersistentMetrics\(state, "ROUTE"\)/);
 assert.match(m,/telemetry_row_writes_estimate/);
 for(const banned of ['fetch(', 'setInterval(', 'setTimeout(', 'DurableObjectNamespace', 'CloudflareApiToken']) assert.ok(!m.includes(banned),banned);
});

test('E049 Worker release fails closed without pinned CI, keeps Agent146 and D172',()=>{
 const gate=read('tools/d173_e049_worker_release_gate.py');
 const release=JSON.parse(read('ops/d173-e049-worker-release-authorization.json'));
 const router=read('tools/d167_release_gate.py');
 const workflow=read('.github/workflows/deploy-beta.yml');
 assert.equal(release.d172_lifecycle,'PENDING_HOLD');
 assert.equal(release.telemetry_table_additive,true);
 assert.equal(release.business_schema_mutation,false);
 assert.equal(release.new_provider_resource,false);
 assert.equal(release.agent_mutation,false);
 assert.equal(release.stable_deploy_permission,false);
 assert.equal(release.field_pass,false);
 assert.equal(release.owner_pass,false);
 assert.match(gate,/source_ci_verified/);
 assert.match(gate,/d172_cross_regression_pass/);
 assert.match(gate,/sqlite_restart_fixture_pass/);
 assert.match(gate,/git\("diff", "--quiet", pin, "HEAD", "--", \*PROTECTED\)/);
 assert.match(router,/D173-E049_EXISTING_WORKER_RELEASE:/);
 assert.match(workflow,/D173-E049_EXISTING_WORKER_RELEASE:/);
 assert.match(workflow,/tools\/d173_e049_worker_release_gate\.py/);
});
