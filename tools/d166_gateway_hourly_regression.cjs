// Regression: a valid Cloudflare Worker hourly response must not make the
// Apps Script D166 export return ok:false. Runs without provider secrets.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const gateway = fs.readFileSync(path.join(__dirname, '..', 'ops/apps-script/agent-log-gateway/Code.gs'), 'utf8');
const nowHour = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
let workerResponse = {
  workers: {
    status: 'OK',
    hourly: [{hour_start_utc: nowHour, requests: 7, errors: 0, subrequests: '2'}]
  },
  durable_objects_account: {status: 'NAMESPACE_NOT_CANONICALLY_SCOPED'},
  billing_account: {status: 'HTTP_403', scope: 'SHARED_ACCOUNT_UNATTRIBUTABLE'},
  collection: {requests: 2}
};
function formatDate(date, _zone, pattern) {
  const iso = new Date(date).toISOString();
  if (pattern === 'yyyy-MM-dd') return iso.slice(0, 10);
  if (pattern === 'yyyy-MM-dd-HH-mm')
    return iso.slice(0, 16).replace('T', '-').replace(':', '-');
  if (pattern === 'yyyy-MM-dd HH:mm')
    return iso.slice(0, 16).replace('T', ' ');
  throw new Error('UNEXPECTED_MOCK_DATE_PATTERN');
}
const sandbox = {
  ScriptApp: {getOAuthToken: () => 'test-monitoring-oauth'},
  Utilities: {formatDate},
  UrlFetchApp: {
    fetch: (url) => ({
      getResponseCode: () => 200,
      getContentText: () => url.includes('/drive/v3/about')
        ? JSON.stringify({storageQuota: {usage: '1250'}})
        : JSON.stringify({
          ok: true,
          service: 'SUPRA_D166_CLOUDFLARE_WORKER_READONLY',
          project: 'supra-inventory-beta',
          cloudflare: workerResponse
        })
    })
  }
};
vm.createContext(sandbox);
vm.runInContext(gateway, sandbox, {filename: 'Code.gs'});
// Monitoring is intentionally mocked: this regression checks only hourly
// Cloudflare postprocessing, not the 26 external metrics themselves.
sandbox.fetchMetrics_ = (specs) => Object.fromEntries(
  specs.map(spec => [spec.key, {series: [], error: null, truncated: false}])
);
for (const [value, expected] of [
  [null, null], [undefined, null], ['', null], [0, 0],
  ['2', 2], ['x', null], [-1, null], [Infinity, null]
]) {
  assert.equal(sandbox.d166CloudflareNumber_(value), expected);
}
const actual = sandbox.collectD166UsageExport_('rolling', 'test-firebase-id-token');
assert.equal(actual.ok, true);
assert.equal(actual.service, 'SUPRA_AGENT_USAGE_EXPORT_D166');
const target = actual.hourly.find(row => row.hour_start === nowHour);
assert.ok(target, 'hourly provider entry must align to Monitoring UTC hour');
assert.equal(target.cf_worker_requests, 7);
assert.equal(target.cf_worker_errors, 0);
assert.equal(target.cf_worker_subrequests, 2);
assert.equal(actual.status.unsupported_sources.cloudflare_billing, 'HTTP_403');
assert.equal(actual.status.unsupported_sources.cloudflare_do_account, 'NAMESPACE_NOT_CANONICALLY_SCOPED');
// Partial/unavailable upstream data must not break the entire local ZIP.
workerResponse = {
  workers: {status: 'WORKER_HTTP_429'},
  durable_objects_account: {status: 'NAMESPACE_NOT_CANONICALLY_SCOPED'},
  billing_account: {status: 'HTTP_403'}, collection: {requests: 0}
};
const partial = sandbox.collectD166UsageExport_('rolling', 'test-firebase-id-token');
assert.equal(partial.ok, true);
assert.equal(partial.status.unsupported_sources.cloudflare_workers_do, 'WORKER_HTTP_429');
assert.equal(partial.hourly.some(row => Object.hasOwn(row, 'cf_worker_requests')), false);
console.log('D166_GATEWAY_HOURLY_NUMERIC_AND_PARTIAL_EXPORT=PASS');
