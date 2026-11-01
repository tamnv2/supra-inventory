import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from '../web/node_modules/typescript/lib/typescript.js';
import vm from 'node:vm';

async function moduleAt(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Math.random()}`);
}
const transport = await moduleAt('../web/src/d173-command-transport.ts');
const models = await moduleAt('../web/src/d173-read-model.ts');
const intents = await moduleAt('../web/src/d173-intent-journal.ts');
const audience = await moduleAt('../web/src/d173-audience-coverage.ts');
function connect(owner, operations, send) {
  const socket = { readyState: 1, send };
  transport.configureCommandTransport(socket, owner, { capabilities: { protocol: 'd173-v2', operations }, auth_expires_at_ms: Date.now() + 60_000 });
  return socket;
}
test('legacy, unavailable and expired capability use HTTP immediately', async () => {
  transport.resetCommandTransport();
  const owner = {};
  let calls = 0;
  const http = async () => { calls++; return Response.json({ source: 'http' }); };
  await transport.negotiatedCommandFetch('/api/realtime/presence', {}, owner, () => true, http);
  transport.configureCommandTransport({ readyState: 1, send() { assert.fail('expired channel sent'); } }, owner,
    { capabilities: { protocol: 'd173-v2', operations: ['realtime.presence'] }, auth_expires_at_ms: Date.now() - 1 });
  await transport.negotiatedCommandFetch('/api/realtime/presence', {}, owner, () => true, http);
  assert.equal(calls, 2);
});
test('negotiated response completes read without HTTP and late result stays outside cursor', async () => {
  const owner = {};
  let calls = 0;
  let id;
  connect(owner, ['realtime.presence'], text => {
    id = JSON.parse(text).request_id;
    queueMicrotask(() => transport.acceptCommandResponse({ type: 'response', request_id: id, status: 200, payload: { online: 2 } }, owner));
  });
  const result = await transport.negotiatedCommandFetch('/api/realtime/presence', {}, owner, () => true, async () => { calls++; return Response.json({}); });
  assert.deepEqual(await result.json(), { online: 2 });
  assert.equal(calls, 0);
  assert.equal(transport.acceptCommandResponse({ type: 'response', request_id: id, status: 200, payload: {} }, owner), true);
  transport.resetCommandTransport();
});
test('lost mutation response hedges HTTP with the original durable request ID', async () => {
  const owner = {};
  let frame;
  let calls = 0;
  connect(owner, ['shortage.resolve'], text => { frame = JSON.parse(text); });
  const body = { request_id: 'stable-key', d173_request_id: 'stable-key', batch_id: 'b', resolution: 'HAS_STOCK' };
  const result = await transport.negotiatedCommandFetch('/api/reporter/batches/resolve', { method: 'POST', body: JSON.stringify(body) }, owner, () => true,
    async () => { calls++; assert.equal(frame.request_id, body.d173_request_id); assert.deepEqual(frame.args, body); return Response.json({ replay: true }); });
  assert.equal(calls, 1);
  assert.equal((await result.json()).replay, true);
  transport.resetCommandTransport();
});
test('session replacement discards in-flight data and never starts old-session hedge', async () => {
  const owner = {};
  let current = true;
  let calls = 0;
  connect(owner, ['realtime.presence'], text => {
    current = false;
    queueMicrotask(() => transport.acceptCommandResponse({ type: 'response', request_id: JSON.parse(text).request_id, status: 200, payload: {} }, owner));
  });
  await assert.rejects(transport.negotiatedCommandFetch('/api/realtime/presence', {}, owner, () => current,
    async () => { calls++; return Response.json({}); }), /SESSION_CHANGED/);
  assert.equal(calls, 0);
  transport.resetCommandTransport();
});
test('oversized request falls back before sending and unsupported operations remain HTTP', async () => {
  const owner = {};
  let calls = 0;
  connect(owner, ['shortage.create'], () => assert.fail('oversized frame sent'));
  const http = async () => { calls++; return Response.json({}); };
  await transport.negotiatedCommandFetch('/api/picker/reports', { method: 'POST', body: JSON.stringify({ sku: 'x'.repeat(17000) }) }, owner, () => true, http);
  await transport.negotiatedCommandFetch('/api/picker/results/receipt', { method: 'POST', body: '{}' }, owner, () => true, http);
  assert.equal(calls, 2);
  transport.resetCommandTransport();
});
test('server auth/RBAC error is authoritative; no successful fallback hides denial', async () => {
  const owner = {};
  connect(owner, ['realtime.presence'], text => queueMicrotask(() => transport.acceptCommandResponse({ type: 'response', request_id: JSON.parse(text).request_id, status: 403, payload: { error: 'FORBIDDEN' } }, owner)));
  const result = await transport.negotiatedCommandFetch('/api/realtime/presence', {}, owner, () => true, async () => assert.fail('denial hidden by fallback'));
  assert.equal(result.status, 403);
  transport.resetCommandTransport();
});

test('pending window is bounded and excess requests go straight to HTTP', async () => {
  const owner = {};
  let sent = 0;
  let http = 0;
  connect(owner, ['realtime.presence'], () => { sent++; });
  await Promise.all(Array.from({ length: 33 }, () => transport.negotiatedCommandFetch('/api/realtime/presence', {}, owner, () => true,
    async () => { http++; return Response.json({}); })));
  assert.equal(sent, 32);
  assert.equal(http, 33);
  transport.resetCommandTransport();
});
test('snapshot application requires the same identity of view, filters and paging', () => {
  const request = { kind: 'REPORTER', params: { from: '2026-11-01', recent_offset: '50', status: 'HAS_STOCK' } };
  const value = { snapshot: { queue: {}, recent: {}, counters: {} }, view: { kind: 'REPORTER', params: { ...request.params } } };
  assert.equal(models.readModelMatches(value, request), true);
  assert.equal(models.readModelMatches(value, { ...request, params: { ...request.params, recent_offset: '0' } }), false);
  assert.equal(models.readModelMatches(value, { ...request, kind: 'PICKER' }), false);
  assert.equal(models.readModelMatches({}, request), false);
});

test('uncertain online intent keeps both retry transports on the first key, success clears it', () => {
  intents.clearIntents();
  const args = { request_id: 'a', sku: 'SKU', read_model: { kind: 'PICKER' } };
  const first = intents.beginIntent('user|WEB|7', 'shortage.create', args, 'a');
  intents.settleIntent(first, 503);
  const retry = intents.beginIntent('user|WEB|7', 'shortage.create', { ...args, request_id: 'b', read_model: { params: {} } }, 'b');
  assert.equal(retry.requestId, 'a');
  assert.notEqual(intents.beginIntent('user|WEB|8', 'shortage.create', args, 'new-session').requestId, 'a');
  intents.settleIntent(retry, 200);
  assert.equal(intents.beginIntent('user|WEB|7', 'shortage.create', args, 'c').requestId, 'c');
  intents.clearIntents();
});

test('WS503 after an unknown commit recovers the same durable key by HTTP', async () => {
  const owner = {};
  let calls = 0;
  connect(owner, ['shortage.create'], text => queueMicrotask(() => transport.acceptCommandResponse({ type: 'response', request_id: JSON.parse(text).request_id, status: 503, payload: { error: 'COMMAND_TEMPORARILY_UNAVAILABLE' } }, owner)));
  const result = await transport.negotiatedCommandFetch('/api/picker/reports', { method: 'POST', body: JSON.stringify({ request_id: 'committed-key', d173_request_id: 'committed-key', sku: 'S' }) }, owner, () => true,
    async () => { calls++; return Response.json({ idempotent_replay: true }); });
  assert.equal(calls, 1);
  assert.equal((await result.json()).idempotent_replay, true);
  transport.resetCommandTransport();
});

function actualViewFunctions(names, globals, sourcePath = '../web/src/operational-app.ts') {
  const source = fs.readFileSync(new URL(sourcePath, import.meta.url), 'utf8');
  const ast = ts.createSourceFile('operational-app.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const selected = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(selected.length, names.length);
  const code = selected.map(node => node.getText(ast)).join('\n');
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const context = vm.createContext(globals);
  vm.runInContext(js, context);
  return context;
}

test('actual Picker view rejects old sequence/epoch and never advances applied cursor', () => {
  const context = actualViewFunctions(['currentReadModel', 'applyPickerReadModel'], {
    realtimeLastSeq: 12, realtimeStreamEpoch: 'epoch-A', pickerReportOffset: 0,
    pickerReports: ['new-event'], pickerReportTotal: 1, pickerResults: [], profile: { user_id: 'u' },
    readModelSnapshot: models.readModelSnapshot, markWebUpdateReceived() {}, flushWebDisplayed() {},
  });
  const wrapper = { snapshot: { reports: { items: ['snapshot'], total: 1 }, results: { items: [] } }, revision: { latest_seq: 11, stream_epoch: 'epoch-A' } };
  assert.equal(context.applyPickerReadModel(wrapper), false);
  assert.deepEqual(context.pickerReports, ['new-event']);
  wrapper.revision.latest_seq = 12;
  wrapper.revision.stream_epoch = 'old-epoch';
  assert.equal(context.applyPickerReadModel(wrapper), false);
  wrapper.revision.stream_epoch = 'epoch-A';
  assert.equal(context.applyPickerReadModel(wrapper), true);
  assert.deepEqual(context.pickerReports, ['snapshot']);
  assert.equal(context.realtimeLastSeq, 12);
});

function audienceToken(generation = 7, channel = 'WEB') {
  return 'x.' + Buffer.from(JSON.stringify({ app_session_generation: generation, app_session_channel: channel })).toString('base64url') + '.x';
}
function audienceProof(changes = {}) {
  return { complete: true, stream_epoch: 'epoch-A', user_id: 'picker-u', role: 'PICKER', session_channel: 'WEB', session_generation: 7,
    from_seq: 6, through_seq: 9, ...changes };
}
function actualFrameContext() {
  const owner = {};
  let context;
  const counters = { applied: 0, recovered: 0, reconciled: 0 };
  const globals = { appliedSeq: 5, streamEpoch: 'epoch-A', dirty: false,
    readSession: () => ({ id_token: audienceToken(), user: { user_id: 'picker-u', role: 'PICKER' } }),
    getCommandSessionOwner: () => owner, audienceCoversGap: audience.audienceCoversGap, audienceSessionScope: audience.audienceSessionScope,
    applyThrough: async () => { counters.applied++; return true; }, recoverDelta: async () => { counters.recovered++; },
    authoritativeReconcile: async () => { counters.reconciled++; }, clearDirtyTimer() {}, markDirty() {},
    saveAppliedState: (_user, seq, epoch) => { context.appliedSeq = seq; context.streamEpoch = epoch; },
  };
  context = actualViewFunctions(['handleFrame'], globals, '../web/src/realtime-client.ts');
  return { context, counters };
}
test('actual realtime handler skips only proven filtered interval and applies current event before advancing', async () => {
  const { context, counters } = actualFrameContext();
  await context.handleFrame({ type: 'invalidate', stream_epoch: 'epoch-A', seq: 10, audience_coverage: audienceProof() });
  assert.equal(counters.recovered, 0);
  assert.equal(counters.applied, 1);
  assert.equal(context.appliedSeq, 10);
});
test('actual realtime handler recovers true gaps and rejects stale identity/epoch/session/partial proof', async () => {
  for (const proof of [undefined, audienceProof({ complete: false }), audienceProof({ user_id: 'other' }), audienceProof({ role: 'REPORTER' }),
    audienceProof({ stream_epoch: 'old' }), audienceProof({ session_generation: 6 }), audienceProof({ session_channel: 'ANDROID' }),
    audienceProof({ from_seq: 7 }), audienceProof({ through_seq: 8 }), audienceProof({ from_seq: '6' })]) {
    const { context, counters } = actualFrameContext();
    await context.handleFrame({ type: 'invalidate', stream_epoch: 'epoch-A', seq: 10, audience_coverage: proof });
    assert.equal(counters.recovered, 1);
    assert.equal(counters.applied, 0);
    assert.equal(context.appliedSeq, 5);
  }
});
test('audience proof cannot authorize connect cursor jumps or an out-of-order event', async () => {
  const { context, counters } = actualFrameContext();
  await context.handleFrame({ type: 'connected', latest_seq: 10, stream_epoch: 'epoch-A', audience_coverage: audienceProof() });
  assert.equal(counters.recovered, 1);
  assert.equal(context.appliedSeq, 5);
  context.appliedSeq = 12;
  await context.handleFrame({ type: 'invalidate', stream_epoch: 'epoch-A', seq: 10, audience_coverage: audienceProof() });
  assert.equal(counters.applied, 0);
  assert.equal(context.appliedSeq, 12);
});
test('session replacement during current event application never commits old cursor', async () => {
  const { context } = actualFrameContext();
  let owner = {};
  context.getCommandSessionOwner = () => owner;
  context.applyThrough = async () => { owner = {}; return true; };
  await context.handleFrame({ type: 'invalidate', stream_epoch: 'epoch-A', seq: 10, audience_coverage: audienceProof() });
  assert.equal(context.appliedSeq, 5);
});
test('same authenticated generation permits token refresh but rejects another login or role', () => {
  const session = { id_token: audienceToken(), user: { user_id: 'picker-u', role: 'PICKER' } };
  assert.equal(audience.sameAudienceSession(session, { ...session, id_token: audienceToken() }), true);
  assert.equal(audience.sameAudienceSession(session, { ...session, id_token: audienceToken(8) }), false);
  assert.equal(audience.sameAudienceSession(session, { ...session, user: { ...session.user, role: 'REPORTER' } }), false);
});

test('existing local usage buckets distinguish HTTP attempts, WS frames and hedges without I/O', () => {
  const buckets = new Map();
  const context = actualViewFunctions(['safeD173ApiFamily', 'recordD171UsageEvent'], {
    d171UsageBuckets: buckets, MAX_D171_USAGE_BUCKETS: 180, d171UsageOverflow: 0,
    fetch: () => assert.fail('telemetry caused network I/O'), localStorage: { setItem() { assert.fail('per-event storage write'); } },
  }, '../web/src/runtime-logger.ts');
  for (const [transport, http, frames] of [['WEBSOCKET', 0, 1], ['WS_HTTP_HEDGE', 1, 1], ['HTTP', 2, 0]]) {
    context.recordD171UsageEvent({ at: '2026-11-01T12:00:00Z', category: 'API', name: 'authorized_request', level: 'INFO',
      data: { method: 'GET', route: '/api/picker/snapshot', transport, http_attempts: http, websocket_frames_sent: frames } });
  }
  const rows = [...buckets.values()];
  assert.equal(rows.length, 3);
  assert.equal(rows.find(row => row.family.includes('WEBSOCKET')).http_attempts, 0);
  assert.equal(rows.find(row => row.family.includes('WS_HTTP_HEDGE')).http_attempts, 1);
  assert.equal(rows.find(row => row.family === 'API:HTTP.GET.PICKER_SNAPSHOT').http_attempts, 2);
  assert.equal(rows.reduce((sum, row) => sum + row.websocket_frames_sent, 0), 2);
});

test('actual initial Picker load retries a raced snapshot once instead of rewinding a newer event', async () => {
  let context;
  let reads = 0;
  const globals = {
    sessionViewGeneration: 1, profile: { user_id: 'u' }, PICKER_REPORT_PAGE_SIZE: 50, pickerReportOffset: 0,
    realtimeLastSeq: 5, realtimeStreamEpoch: 'e', pickerReports: ['event'], pickerReportTotal: 1, pickerResults: [],
    skuCatalogInfo: { sku_day_vn: '2026-11-01' }, dateDaysAgo: () => '2026-11-01',
    readModelSnapshot: models.readModelSnapshot, readModelMatches: models.readModelMatches,
    getPickerReadModelV2: async params => {
      reads++;
      if (reads === 1) context.realtimeLastSeq = 6;
      return { view: { kind: 'PICKER', params }, snapshot: { reports: { items: [reads === 1 ? 'stale' : 'fresh'], total: 1 }, results: { items: [] } },
        revision: { latest_seq: reads === 1 ? 5 : 6, stream_epoch: 'e' } };
    },
    getPickerReportsV2: () => assert.fail('unexpected legacy fallback'), getPickerResultsV2: () => assert.fail('unexpected legacy fallback'),
    markWebUpdateReceived() {}, flushWebDisplayed() {}, window: { dispatchEvent() { assert.fail('unnecessary dirty recovery'); } },
  };
  context = actualViewFunctions(['pickerReadModelRequest', 'currentReadModel', 'loadPicker'], globals);
  await context.loadPicker();
  assert.equal(reads, 2);
  assert.deepEqual(context.pickerReports, ['fresh']);
  assert.equal(context.realtimeLastSeq, 6);
});
