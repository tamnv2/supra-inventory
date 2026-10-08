const PROJECT_ID = 'supra-inventory-beta';
const ROLE_ALLOWLIST = ['ADMIN', 'PICKPACK_ADMIN'];
const MAX_PAYLOAD_CHARS = 4500000;
const INDEX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DATABASE_ID = '(default)';
const CACHE_KEY = 'D160_AGENT_USAGE_V1';
const GATEWAY_REVISION = 'D161-GW-v2';
const CACHE_TTL_SECONDS = 15 * 60;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const METRICS = {
  reads: 'firestore.googleapis.com/document/read_ops_count',
  writes: 'firestore.googleapis.com/document/write_ops_count',
  deletes: 'firestore.googleapis.com/document/delete_ops_count',
  connections: 'firestore.googleapis.com/network/active_connections',
  listeners: 'firestore.googleapis.com/network/snapshot_listeners',
  rules: 'firestore.googleapis.com/rules/evaluation_count',
  storage: 'firestore.googleapis.com/storage/data_and_index_storage_bytes',
  serviceRequests: 'serviceruntime.googleapis.com/api/request_count',
  functionRequests: 'run.googleapis.com/request_count',
  functionInstances: 'run.googleapis.com/container/instance_count',
  functionBillableTime: 'run.googleapis.com/container/billable_instance_time'
};

const SERVICE_ENDPOINTS = {
  fcm: 'fcm.googleapis.com',
  identityToolkit: 'identitytoolkit.googleapis.com',
  secureToken: 'securetoken.googleapis.com'
};
const PICKER_ALERT_CLOUD_RUN_SERVICE = 'inventory-beta-picker-alerts';
const FIRESTORE_FREE_STORAGE_BYTES_REFERENCE = 1024 * 1024 * 1024;


function doGet() {
  return json_({ ok: true, service: 'SUPRA_AGENT_OPERATIONS_GATEWAY_D160', project: PROJECT_ID, revision: GATEWAY_REVISION, cache_ttl_seconds: CACHE_TTL_SECONDS });
}

function authorizeD160Monitoring() {
  const requiredScopes = [
    'https://www.googleapis.com/auth/monitoring.read',
    'https://www.googleapis.com/auth/script.external_request'
  ];
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, requiredScopes);

  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEY);
  const snapshot = collectUsage_();
  const ready = !!(snapshot && snapshot.availability && snapshot.availability.reads === true);
  if (!ready) {
    const readError = (snapshot && snapshot.errors || [])
      .map(String)
      .find(value => value.indexOf('reads:') === 0) || 'reads:UNKNOWN';
    throw new Error(
      'D160_MONITORING_PROBE_NOT_READY:' +
      readError.replace(/[^A-Za-z0-9_.:-]/g, '_').substring(0, 120)
    );
  }
  cache.put(CACHE_KEY, JSON.stringify(snapshot), CACHE_TTL_SECONDS);
  return 'D160_MONITORING_AUTH_PASS';
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');

    // D165 privileged auth bootstrap: these two actions intentionally run before
    // Firebase validation because a fresh Agent does not yet have an ID token.
    // Secrets are forwarded only to the Beta Worker and are never persisted/logged here.
    if (action === 'request_privileged_auth_code') {
      const username = String(body.username || '').trim().toLowerCase();
      if (!/^(admin|tamnv2)$/.test(username)) throw new Error('PRIVILEGED_AGENT_ACCOUNT_REQUIRED');
      return proxyWorkerJson_('/api/auth/privileged-code', { username: username }, '');
    }
    if (action === 'privileged_agent_login') {
      const username = String(body.username || '').trim().toLowerCase();
      const proof = String(body.password || '');
      if (!/^(admin|tamnv2)$/.test(username) || !proof || proof.length > 128) {
        throw new Error('PRIVILEGED_AGENT_CREDENTIAL_REQUIRED');
      }
      return proxyWorkerJson_('/api/auth/privileged-agent-login', { username: username, password: proof }, '');
    }

    const idToken = String(body.id_token || '');
    const auth = validateIdToken_(idToken);
    if (action === 'privileged_agent_reauth') {
      const proof = String(body.proof || '');
      if (!proof || proof.length > 128) throw new Error('PRIVILEGED_AGENT_PROOF_REQUIRED');
      return proxyWorkerJson_('/api/agent/reauth', { proof: proof }, idToken);
    }
    if (action === 'provision_d166_cloudflare') return json_(provisionD166Cloudflare_(auth, body));
    if (action === 'get_firestore_usage') return json_(loadSnapshot_());
    if (action === 'get_usage_export') {
      // Existing Firebase role validation is mandatory; new action cannot run pre-auth.
      const mode = String(body.window || 'today');
      if (['today', 'rolling', 'shift'].indexOf(mode) < 0) throw new Error('D166_WINDOW_INVALID');
      return json_(collectD166UsageExport_(mode));
    }
    if (action === 'request_support_logs') {
      const requestId = String(body.request_id || '');
      if (!/^support-[A-Za-z0-9]{16,80}$/.test(requestId)) throw new Error('INVALID_SUPPORT_REQUEST_ID');
      const authHeader = ['Bea', 'rer ', idToken].join('');
      const worker = UrlFetchApp.fetch(
        'https://inventory-beta.supra.cc.cd/api/agent/support-log-request',
        {
          method: 'post',
          contentType: 'application/json',
          headers: { authorization: authHeader },
          payload: JSON.stringify({ request_id: requestId }),
          muteHttpExceptions: true
        }
      );
      const status = worker.getResponseCode();
      let result = {};
      try { result = JSON.parse(worker.getContentText() || '{}'); } catch (_) { result = {}; }
      if (status < 200 || status >= 300) {
        throw new Error(String(result.error || ('WORKER_HTTP_' + status)).substring(0, 120));
      }
      return json_({
        ok: true,
        service: 'SUPRA_AGENT_SUPPORT_CONTROL_D161',
        project: PROJECT_ID,
        revision: GATEWAY_REVISION,
        request_id: String(result.request_id || requestId),
        trace_id: String(result.trace_id || requestId),
        expires_at_ms: Number(result.expires_at_ms || 0),
        idempotent_replay: result.idempotent_replay === true,
        propagation: result.propagation || {}
      });
    }
    if (action !== 'upload_agent_log') throw new Error('ACTION_NOT_ALLOWED');
    const bundleId = String(body.bundle_id || '').toLowerCase();
    const fileName = String(body.file_name || '');
    const contentHash = String(body.content_hash || '').toLowerCase();
    const rawPayload = String(body.payload || '');

    if (!/^[0-9a-f]{64}$/.test(bundleId)) throw new Error('INVALID_BUNDLE_ID');
    if (!/^[0-9a-f]{64}$/.test(contentHash)) throw new Error('INVALID_CONTENT_HASH');
    if (!/^(session|checkpoint|error|crash|recovery|manual)_agent_[A-Za-z0-9_-]{1,48}_[0-9]{8}_[0-9]{6}\.log$/.test(fileName)) {
      throw new Error('INVALID_FILENAME');
    }
    if (!rawPayload || rawPayload.length > MAX_PAYLOAD_CHARS) throw new Error('INVALID_PAYLOAD_SIZE');
    if (sha256Hex_(rawPayload) !== contentHash) throw new Error('CONTENT_HASH_MISMATCH');
    const payload = sanitize_(rawPayload);

    const props = PropertiesService.getScriptProperties();
    const folderId = String(props.getProperty('BETA_LOG_FOLDER_ID') || '');
    if (!folderId) throw new Error('MISSING_LOG_FOLDER_ID');
    const rootFolder = DriveApp.getFolderById(folderId);
    const key = 'B_' + bundleId;
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const daily = resolveDailyLogFolder_(rootFolder, new Date());
      const folder = daily.folder;
      const known = props.getProperty(key);
      if (known) {
        const parsed = JSON.parse(known);
        return json_({ ok: true, existing: true, drive_synced: true, archive_date: daily.date_key, file_id: String(parsed.file_id || '') });
      }

      const deterministicName = fileName.replace(/\.log$/, '_' + bundleId.substring(0, 12) + '.log');
      const existing = folder.getFilesByName(deterministicName);
      if (existing.hasNext()) {
        const file = existing.next();
        props.setProperty(key, JSON.stringify({ file_id: file.getId(), at_ms: Date.now() }));
        pruneIndex_(props);
        return json_({ ok: true, existing: true, drive_synced: true, archive_date: daily.date_key, file_id: file.getId() });
      }

      const file = folder.createFile(deterministicName, payload, MimeType.PLAIN_TEXT);
      props.setProperty(key, JSON.stringify({
        file_id: file.getId(),
        at_ms: Date.now(),
        uid: auth.uid,
        app_user_id: auth.app_user_id
      }));
      pruneIndex_(props);
      return json_({ ok: true, existing: false, drive_synced: true, archive_date: daily.date_key, file_id: file.getId() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: safeError_(err) });
  }
}

function resolveDailyLogFolder_(rootFolder, when) {
  const dateKey = Utilities.formatDate(when || new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  const cache = CacheService.getScriptCache();
  const cacheKey = 'D165_LOG_DAY_' + rootFolder.getId() + '_' + dateKey;
  const cachedId = String(cache.get(cacheKey) || '');
  if (cachedId) {
    try {
      return { folder: DriveApp.getFolderById(cachedId), date_key: dateKey };
    } catch (_) {
      cache.remove(cacheKey);
    }
  }

  const canonicalId = canonicalDailyFolderId_(rootFolder.getId(), dateKey);
  const folder = canonicalId
    ? DriveApp.getFolderById(canonicalId)
    : createAndConvergeDailyFolder_(rootFolder, dateKey);
  cache.put(cacheKey, folder.getId(), 6 * 60 * 60);
  return { folder: folder, date_key: dateKey };
}

function canonicalDailyFolderId_(rootId, dateKey) {
  const query = [
    "'" + String(rootId).replace(/'/g, "\\'") + "' in parents",
    "trashed = false",
    "mimeType = 'application/vnd.google-apps.folder'",
    "name = '" + String(dateKey).replace(/'/g, "\\'") + "'"
  ].join(' and ');
  const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(query) +
    '&orderBy=createdTime%20asc&pageSize=10&spaces=drive&fields=files(id,name,createdTime)';
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('LOG_DAY_LIST_' + response.getResponseCode());
  const payload = JSON.parse(response.getContentText() || '{}');
  return payload.files && payload.files.length ? String(payload.files[0].id || '') : '';
}

function createAndConvergeDailyFolder_(rootFolder, dateKey) {
  const created = rootFolder.createFolder(dateKey);
  const canonicalId = canonicalDailyFolderId_(rootFolder.getId(), dateKey) || created.getId();
  if (canonicalId !== created.getId()) {
    try { created.setTrashed(true); } catch (_) {}
  }
  return DriveApp.getFolderById(canonicalId);
}

function loadSnapshot_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    const value = JSON.parse(cached);
    value.cache_hit = true;
    return value;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    const raced = cache.get(CACHE_KEY);
    if (raced) {
      const value = JSON.parse(raced);
      value.cache_hit = true;
      return value;
    }
    throw new Error('USAGE_BUSY_RETRY');
  }

  try {
    const recheck = cache.get(CACHE_KEY);
    if (recheck) {
      const value = JSON.parse(recheck);
      value.cache_hit = true;
      return value;
    }
    const snapshot = collectUsage_();
    cache.put(CACHE_KEY, JSON.stringify(snapshot), CACHE_TTL_SECONDS);
    snapshot.cache_hit = false;
    return snapshot;
  } finally {
    lock.releaseLock();
  }
}

function collectUsage_() {
  const now = new Date();
  const start = new Date(now.getTime() - DAY_MS);
  const providerDayStart = zonedMidnightUtc_(now, 'America/Los_Angeles');
  const providerDayReset = nextZonedMidnightUtc_(now, 'America/Los_Angeles');
  const token = ScriptApp.getOAuthToken();

  const specs = [
    metricSpec_('reads', METRICS.reads, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    metricSpec_('writes', METRICS.writes, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    metricSpec_('deletes', METRICS.deletes, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    metricSpec_('connections', METRICS.connections, start, now, '60s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    metricSpec_('listeners', METRICS.listeners, start, now, '60s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    metricSpec_('rules', METRICS.rules, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', ['metric.labels.result']),
    metricSpec_('storage', METRICS.storage, start, now, '300s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    consumedApiMetricSpec_('fcm_requests', SERVICE_ENDPOINTS.fcm, start, now),
    consumedApiMetricSpec_('identity_requests', SERVICE_ENDPOINTS.identityToolkit, start, now),
    consumedApiMetricSpec_('secure_token_requests', SERVICE_ENDPOINTS.secureToken, start, now),
    cloudRunMetricSpec_('function_requests', METRICS.functionRequests, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', ['metric.labels.response_code_class']),
    cloudRunMetricSpec_('function_instances', METRICS.functionInstances, start, now, '60s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    cloudRunMetricSpec_('function_billable_time', METRICS.functionBillableTime, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', [])
  ];

  const results = fetchMetrics_(specs, token);
  const hours = buildHourBuckets_(now);
  const errors = [];

  specs.forEach(spec => {
    if (results[spec.key].error) errors.push(spec.key + ':' + results[spec.key].error);
  });

  applyHourlySum_(hours, results.reads.series, 'reads');
  applyHourlySum_(hours, results.writes.series, 'writes');
  applyHourlySum_(hours, results.deletes.series, 'deletes');

  const connections = applyGauge_(hours, results.connections.series, 'connections_peak');
  const listeners = applyGauge_(hours, results.listeners.series, 'listeners_peak');
  applyRules_(hours, results.rules.series);

  let quotaReads = 0;
  let quotaWrites = 0;
  let quotaDeletes = 0;
  Object.keys(hours).forEach(key => {
    const startMs = new Date(key).getTime();
    if (startMs >= providerDayStart.getTime()) {
      quotaReads += Number(hours[key].reads || 0);
      quotaWrites += Number(hours[key].writes || 0);
      quotaDeletes += Number(hours[key].deletes || 0);
    }
  });

  let rulesAllow = 0;
  let rulesDeny = 0;
  let rulesError = 0;
  Object.keys(hours).forEach(key => {
    rulesAllow += Number(hours[key].rules_allow || 0);
    rulesDeny += Number(hours[key].rules_deny || 0);
    rulesError += Number(hours[key].rules_error || 0);
  });

  const hourly = Object.keys(hours).sort().map(key => hours[key]);
  const traffic = summarizeTraffic_(hourly);
  const storage = summarizeGaugeSeries_(results.storage.series);
  const fcm = summarizeRequestSeries_(results.fcm_requests.series);
  const identity = summarizeRequestSeries_(results.identity_requests.series);
  const secureToken = summarizeRequestSeries_(results.secure_token_requests.series);
  const functionRequests = summarizeRequestSeries_(results.function_requests.series);
  const functionInstances = summarizeGaugeSeries_(results.function_instances.series);
  const functionBillableSeconds = sumSeries_(results.function_billable_time.series);

  return {
    ok: true,
    service: 'SUPRA_AGENT_OPERATIONS_USAGE_D160',
    project: PROJECT_ID,
    database: DATABASE_ID,
    generated_at: now.toISOString(),
    cache_ttl_seconds: CACHE_TTL_SECONDS,
    revision: GATEWAY_REVISION,
    partial: errors.length > 0,
    errors: errors,
    availability: {
      reads: !results.reads.error,
      writes: !results.writes.error,
      deletes: !results.deletes.error,
      connections: !results.connections.error,
      listeners: !results.listeners.error,
      rules: !results.rules.error,
      storage: !results.storage.error,
      fcm: !results.fcm_requests.error,
      auth_identity: !results.identity_requests.error,
      auth_refresh: !results.secure_token_requests.error,
      functions_requests: !results.function_requests.error,
      functions_instances: !results.function_instances.error,
      functions_billable: !results.function_billable_time.error
    },
    quota_day: {
      timezone: 'America/Los_Angeles',
      start_at: providerDayStart.toISOString(),
      reset_at: providerDayReset.toISOString(),
      reads: Math.round(quotaReads),
      writes: Math.round(quotaWrites),
      deletes: Math.round(quotaDeletes),
      reference_limits: {
        reads: 50000,
        writes: 20000,
        deletes: 20000
      }
    },
    firestore_storage: {
      data_and_index_bytes: Math.round(storage.current),
      peak_24h_bytes: Math.round(storage.peak),
      free_reference_bytes: FIRESTORE_FREE_STORAGE_BYTES_REFERENCE
    },
    firestore_24h: traffic,
    realtime_24h: {
      active_connections_current: connections.current,
      active_connections_peak: connections.peak,
      snapshot_listeners_current: listeners.current,
      snapshot_listeners_peak: listeners.peak
    },
    rules_24h: {
      allow: Math.round(rulesAllow),
      deny: Math.round(rulesDeny),
      error: Math.round(rulesError)
    },
    firebase_24h: {
      fcm: fcm,
      identity_toolkit: identity,
      secure_token: secureToken
    },
    functions_24h: {
      service: PICKER_ALERT_CLOUD_RUN_SERVICE,
      requests: functionRequests,
      instances_current: functionInstances.current,
      instances_peak: functionInstances.peak,
      billable_instance_seconds: Math.round(functionBillableSeconds)
    },
    hourly: hourly,
    notes: [
      'Cloud Monitoring can lag provider activity by several minutes; generic API metrics can lag longer.',
      'Reference limits are informational and do not assert the active billing plan.',
      'D159 uses Cloud Monitoring only and performs zero Firestore document reads/writes/deletes for usage collection.'
    ]
  };
}

function metricSpec_(key, metricType, start, end, alignmentPeriod, aligner, reducer, groupBy) {
  return monitoringMetricSpec_(
    key,
    metricType,
    'resource.type="firestore.googleapis.com/Database" AND resource.labels.database_id="' + DATABASE_ID + '"',
    start,
    end,
    alignmentPeriod,
    aligner,
    reducer,
    groupBy
  );
}

function consumedApiMetricSpec_(key, serviceName, start, end) {
  return monitoringMetricSpec_(
    key,
    METRICS.serviceRequests,
    'resource.type="consumed_api" AND resource.labels.service="' + serviceName + '"',
    start,
    end,
    '3600s',
    'ALIGN_SUM',
    'REDUCE_SUM',
    ['metric.labels.response_code_class']
  );
}

function cloudRunMetricSpec_(key, metricType, start, end, alignmentPeriod, aligner, reducer, groupBy) {
  return monitoringMetricSpec_(
    key,
    metricType,
    'resource.type="cloud_run_revision" AND resource.labels.service_name="' + PICKER_ALERT_CLOUD_RUN_SERVICE + '"',
    start,
    end,
    alignmentPeriod,
    aligner,
    reducer,
    groupBy
  );
}

function monitoringMetricSpec_(key, metricType, resourceFilter, start, end, alignmentPeriod, aligner, reducer, groupBy) {
  const filter = 'metric.type="' + metricType + '" AND ' + resourceFilter;
  const params = [
    ['filter', filter],
    ['interval.startTime', start.toISOString()],
    ['interval.endTime', end.toISOString()],
    ['view', 'FULL'],
    ['pageSize', '1000'],
    ['aggregation.alignmentPeriod', alignmentPeriod],
    ['aggregation.perSeriesAligner', aligner],
    ['aggregation.crossSeriesReducer', reducer]
  ];
  (groupBy || []).forEach(field => params.push(['aggregation.groupByFields', field]));
  const query = params
    .map(pair => encodeURIComponent(pair[0]) + '=' + encodeURIComponent(pair[1]))
    .join('&');
  return {
    key: key,
    url: 'https://monitoring.googleapis.com/v3/projects/' +
      encodeURIComponent(PROJECT_ID) + '/timeSeries?' + query
  };
}

function fetchMetrics_(specs, token) {
  const requests = specs.map(spec => ({
    url: spec.url,
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Goog-User-Project': PROJECT_ID,
      Accept: 'application/json'
    },
    muteHttpExceptions: true
  }));
  const responses = UrlFetchApp.fetchAll(requests);
  const out = {};
  responses.forEach((response, index) => {
    const key = specs[index].key;
    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      out[key] = {
        series: [],
        error: monitoringFailureCode_(status, response.getContentText())
      };
      return;
    }
    try {
      const payload = JSON.parse(response.getContentText() || '{}');
      out[key] = { series: payload.timeSeries || [], error: null, truncated: !!payload.nextPageToken };
    } catch (_) {
      out[key] = { series: [], error: 'MONITORING_BAD_JSON' };
    }
  });
  return out;
}

function monitoringFailureCode_(httpStatus, content) {
  let status = '';
  let reason = '';
  let message = '';
  try {
    const payload = JSON.parse(content || '{}');
    const error = payload && payload.error || {};
    status = String(error.status || '');
    message = String(error.message || '');
    const details = error.details || [];
    details.forEach(detail => {
      if (!reason && detail && detail.reason) reason = String(detail.reason);
    });
  } catch (_) {}

  const messageUpper = message.toUpperCase();
  let category = '';
  if (messageUpper.indexOf('MONITORING.TIMESERIES.LIST') >= 0) category = 'MISSING_MONITORING_TIMESERIES_LIST';
  else if (messageUpper.indexOf('SERVICEUSAGE.SERVICES.USE') >= 0) category = 'MISSING_SERVICEUSAGE_SERVICES_USE';
  else if (messageUpper.indexOf('INSUFFICIENT AUTHENTICATION SCOPES') >= 0) category = 'OAUTH_SCOPE_INSUFFICIENT';
  else if (messageUpper.indexOf('API HAS NOT BEEN USED') >= 0 || messageUpper.indexOf('API IS DISABLED') >= 0) category = 'MONITORING_API_DISABLED';
  else if (messageUpper.indexOf('QUOTA PROJECT') >= 0) category = 'QUOTA_PROJECT_REQUIRED';

  const parts = ['MONITORING_HTTP_' + httpStatus];
  if (status) parts.push(status.replace(/[^A-Z0-9_]/gi, '_').substring(0, 64));
  if (reason) parts.push(reason.replace(/[^A-Z0-9_]/gi, '_').substring(0, 96));
  if (category) parts.push(category);
  return parts.join(':');
}

function buildHourBuckets_(now) {
  const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const out = {};
  for (let i = 23; i >= 0; i--) {
    const start = new Date(currentHour - i * HOUR_MS);
    const end = new Date(start.getTime() + HOUR_MS);
    const key = start.toISOString();
    out[key] = {
      hour_start: key,
      hour_label_vn:
        Utilities.formatDate(start, 'Asia/Ho_Chi_Minh', 'HH:mm') + '–' +
        Utilities.formatDate(end, 'Asia/Ho_Chi_Minh', 'HH:mm'),
      reads: 0,
      writes: 0,
      deletes: 0,
      listeners_peak: 0,
      connections_peak: 0,
      rules_allow: 0,
      rules_deny: 0,
      rules_error: 0
    };
  }
  return out;
}

function applyHourlySum_(hours, series, field) {
  (series || []).forEach(row => {
    (row.points || []).forEach(point => {
      const key = pointHourKey_(point);
      if (hours[key]) hours[key][field] += pointNumber_(point);
    });
  });
}

function applyGauge_(hours, series, field) {
  let current = 0;
  let currentAt = 0;
  let peak = 0;
  (series || []).forEach(row => {
    (row.points || []).forEach(point => {
      const value = pointNumber_(point);
      const endMs = pointEndMs_(point);
      if (endMs > currentAt) {
        currentAt = endMs;
        current = value;
      }
      if (value > peak) peak = value;
      const key = pointHourKey_(point);
      if (hours[key]) hours[key][field] = Math.max(Number(hours[key][field] || 0), value);
    });
  });
  return { current: Math.round(current), peak: Math.round(peak) };
}

function applyRules_(hours, series) {
  (series || []).forEach(row => {
    const result = String(row.metric && row.metric.labels && row.metric.labels.result || '').toUpperCase();
    const field = result === 'ALLOW' ? 'rules_allow' :
      (result === 'DENY' ? 'rules_deny' : (result === 'ERROR' ? 'rules_error' : ''));
    if (!field) return;
    (row.points || []).forEach(point => {
      const key = pointHourKey_(point);
      if (hours[key]) hours[key][field] += pointNumber_(point);
    });
  });
}

function summarizeRequestSeries_(series) {
  let total = 0;
  let clientErrors = 0;
  let serverErrors = 0;
  (series || []).forEach(row => {
    const responseClass = String(row.metric && row.metric.labels && row.metric.labels.response_code_class || '').toLowerCase();
    let rowTotal = 0;
    (row.points || []).forEach(point => { rowTotal += pointNumber_(point); });
    total += rowTotal;
    if (responseClass === '4xx') clientErrors += rowTotal;
    if (responseClass === '5xx') serverErrors += rowTotal;
  });
  return {
    requests: Math.round(total),
    client_errors: Math.round(clientErrors),
    server_errors: Math.round(serverErrors)
  };
}

function summarizeGaugeSeries_(series) {
  let current = 0;
  let currentAt = 0;
  let peak = 0;
  (series || []).forEach(row => {
    (row.points || []).forEach(point => {
      const value = pointNumber_(point);
      const endMs = pointEndMs_(point);
      if (endMs > currentAt) {
        currentAt = endMs;
        current = value;
      }
      if (value > peak) peak = value;
    });
  });
  return { current: current, peak: peak };
}

function sumSeries_(series) {
  let total = 0;
  (series || []).forEach(row => {
    (row.points || []).forEach(point => { total += pointNumber_(point); });
  });
  return total;
}

function summarizeTraffic_(hourly) {
  let reads = 0;
  let writes = 0;
  let deletes = 0;
  let peakRead = { hour: '', value: 0 };
  let peakWrite = { hour: '', value: 0 };
  (hourly || []).forEach(row => {
    const r = Number(row.reads || 0);
    const w = Number(row.writes || 0);
    const d = Number(row.deletes || 0);
    reads += r;
    writes += w;
    deletes += d;
    if (r > peakRead.value) peakRead = { hour: String(row.hour_label_vn || ''), value: r };
    if (w > peakWrite.value) peakWrite = { hour: String(row.hour_label_vn || ''), value: w };
  });
  return {
    reads: Math.round(reads),
    writes: Math.round(writes),
    deletes: Math.round(deletes),
    peak_read_hour: peakRead.hour,
    peak_read_value: Math.round(peakRead.value),
    peak_write_hour: peakWrite.hour,
    peak_write_value: Math.round(peakWrite.value)
  };
}

function pointNumber_(point) {
  const value = point && point.value || {};
  if (value.int64Value != null) {
    const parsed = Number(value.int64Value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value.doubleValue != null) {
    const parsed = Number(value.doubleValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pointEndMs_(point) {
  const raw = point && point.interval && point.interval.endTime;
  const value = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function pointHourKey_(point) {
  const endMs = pointEndMs_(point);
  if (!endMs) return '';
  return new Date(Math.floor((endMs - 1) / HOUR_MS) * HOUR_MS).toISOString();
}

function nextZonedMidnightUtc_(now, timeZone) {
  const localDate = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd').split('-').map(Number);
  const nextDateReference = new Date(Date.UTC(localDate[0], localDate[1] - 1, localDate[2] + 1, 12, 0, 0));
  return zonedMidnightUtc_(nextDateReference, timeZone);
}

function zonedMidnightUtc_(now, timeZone) {
  const local = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd-HH-mm').split('-').map(Number);
  const desired = Date.UTC(local[0], local[1] - 1, local[2], 0, 0, 0);
  let guess = desired;
  for (let i = 0; i < 3; i++) {
    const representedParts = Utilities.formatDate(new Date(guess), timeZone, 'yyyy-MM-dd-HH-mm').split('-').map(Number);
    const represented = Date.UTC(
      representedParts[0],
      representedParts[1] - 1,
      representedParts[2],
      representedParts[3],
      representedParts[4],
      0
    );
    guess += desired - represented;
  }
  return new Date(guess);
}

function proxyWorkerJson_(path, payload, idToken) {
  const headers = {};
  if (idToken) headers.authorization = ['Bea', 'rer ', idToken].join('');
  const worker = UrlFetchApp.fetch(
    'https://inventory-beta.supra.cc.cd' + String(path || ''),
    {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(payload || {}),
      muteHttpExceptions: true
    }
  );
  const status = worker.getResponseCode();
  let result = {};
  try { result = JSON.parse(worker.getContentText() || '{}'); } catch (_) { result = {}; }
  if (status < 200 || status >= 300) {
    return json_({
      ok: false,
      error: String(result.error || ('WORKER_HTTP_' + status)).substring(0, 120),
      message: String(result.message || '').substring(0, 240),
      retry_after_seconds: Number(result.retry_after_seconds || 0),
      worker_status: status
    });
  }
  result.ok = true;
  return json_(result);
}

function validateIdToken_(token) {
  if (!token || token.length < 100 || token.length > 10000) throw new Error('MISSING_ID_TOKEN');
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('FIREBASE_WEB_API_KEY_BETA') || '');
  if (!apiKey) throw new Error('MISSING_FIREBASE_API_KEY');

  const response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: token }),
      muteHttpExceptions: true
    }
  );
  if (response.getResponseCode() !== 200) throw new Error('AUTH_INVALID');
  const verified = JSON.parse(response.getContentText() || '{}');
  if (!verified.users || verified.users.length !== 1) throw new Error('AUTH_USER_NOT_FOUND');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('AUTH_TOKEN_FORMAT');
  const claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
  const now = Math.floor(Date.now() / 1000);
  if (String(claims.aud || '') !== PROJECT_ID) throw new Error('AUTH_AUDIENCE');
  if (String(claims.iss || '') !== 'https://securetoken.google.com/' + PROJECT_ID) throw new Error('AUTH_ISSUER');
  if (Number(claims.exp || 0) <= now) throw new Error('AUTH_EXPIRED');

  const role = String(claims.app_role || '');
  const baseRole = String(claims.app_base_role || '');
  const appUserId = String(claims.app_user_id || '');
  if (ROLE_ALLOWLIST.indexOf(role) < 0 || role !== baseRole || !appUserId) throw new Error('AUTH_ROLE');
  return { uid: String(claims.user_id || claims.sub || ''), app_user_id: appUserId, role: role };
}

function pruneIndex_(props) {
  const all = props.getProperties();
  const keys = Object.keys(all).filter(k => /^B_[0-9a-f]{64}$/.test(k));
  if (keys.length <= 220) return;
  const cutoff = Date.now() - INDEX_RETENTION_MS;
  keys.forEach(k => {
    try {
      const parsed = JSON.parse(all[k]);
      if (Number(parsed.at_ms || 0) < cutoff) props.deleteProperty(k);
    } catch (_) {
      props.deleteProperty(k);
    }
  });
}

function sha256Hex_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => {
    const n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function sanitize_(value) {
  let next = String(value || '');
  next = next.replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT]');
  next = next.replace(/\b(authorization|bearer|password|secret|private[_ -]?key|refresh[_ -]?token|id[_ -]?token|cookie)\b\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
  next = next.replace(/([?&](?:auth|access_token|token)=)[^&\s]+/gi, '$1[REDACTED]');
  return next;
}

function safeError_(err) {
  const value = String((err && err.message) || err || 'UNKNOWN');
  return value.replace(/[^A-Za-z0-9_.:-]/g, '_').substring(0, 160);
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * D166: one explicit Owner-initiated export request. Not used by the existing
 * 15-minute D160 tab cache and never writes Firestore or cloud business data.
 * All Monitoring queries are restricted to the existing Beta Cloud project.
 */
function collectD166UsageExport_(mode) {
  const now = new Date();
  const vietnam = 'Asia/Ho_Chi_Minh';
  let start = new Date(now.getTime() - DAY_MS);
  let shiftEnd = now;
  if (mode === 'today') {
    start = zonedMidnightUtc_(now, vietnam);
  } else if (mode === 'shift') {
    const localDay = Utilities.formatDate(now, vietnam, 'yyyy-MM-dd');
    const dateParts = localDay.split('-').map(Number);
    const localReference = new Date(Date.UTC(dateParts[0], dateParts[1]-1, dateParts[2], 6, 0, 0));
    start = new Date(localReference.getTime() - 7 * HOUR_MS);
    if (now.getTime() < start.getTime()) start = new Date(start.getTime() - DAY_MS);
    shiftEnd = new Date(start.getTime() + 16 * HOUR_MS);
  }
  const end = new Date(Math.min(now.getTime(), shiftEnd.getTime()));
  const token = ScriptApp.getOAuthToken();
  const storageFilter = 'resource.type="firebase_namespace"';
  const firestoreKeys = ['reads','writes','deletes','connections','listeners','rules','storage'];
  const specs = [
    metricSpec_('reads', METRICS.reads, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    metricSpec_('writes', METRICS.writes, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    metricSpec_('deletes', METRICS.deletes, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    metricSpec_('connections', METRICS.connections, start, end, '3600s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    metricSpec_('listeners', METRICS.listeners, start, end, '3600s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    metricSpec_('rules', METRICS.rules, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', ['metric.labels.result']),
    metricSpec_('storage', METRICS.storage, start, end, '3600s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    consumedApiMetricSpec_('fcm_requests', SERVICE_ENDPOINTS.fcm, start, end),
    consumedApiMetricSpec_('identity_requests', SERVICE_ENDPOINTS.identityToolkit, start, end),
    consumedApiMetricSpec_('secure_token_requests', SERVICE_ENDPOINTS.secureToken, start, end),
    consumedApiMetricSpec_('sheets_requests', 'sheets.googleapis.com', start, end),
    consumedApiMetricSpec_('drive_requests', 'drive.googleapis.com', start, end),
    cloudRunMetricSpec_('function_requests', METRICS.functionRequests, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', ['metric.labels.response_code_class']),
    cloudRunMetricSpec_('function_instances', METRICS.functionInstances, start, end, '3600s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    cloudRunMetricSpec_('function_billable_time', METRICS.functionBillableTime, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    monitoringMetricSpec_('agent_log_function_requests', METRICS.functionRequests,
      'resource.type="cloud_run_revision" AND resource.labels.service_name="agentloguploadwritten"',
      start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_api_hits', 'firebasedatabase.googleapis.com/network/api_hits_count',
      storageFilter, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_https_requests', 'firebasedatabase.googleapis.com/network/https_requests_count',
      storageFilter, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_connections', 'firebasedatabase.googleapis.com/network/active_connections',
      storageFilter, start, end, '3600s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_monthly_sent', 'firebasedatabase.googleapis.com/network/monthly_sent',
      storageFilter, start, end, '3600s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_monthly_sent_limit', 'firebasedatabase.googleapis.com/network/monthly_sent_limit',
      storageFilter, start, end, '3600s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_sent_bytes', 'firebasedatabase.googleapis.com/network/sent_bytes_count',
      storageFilter, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_payload_bytes', 'firebasedatabase.googleapis.com/network/sent_payload_bytes_count',
      storageFilter, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_protocol_bytes', 'firebasedatabase.googleapis.com/network/sent_payload_and_protocol_bytes_count',
      storageFilter, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_storage_bytes', 'firebasedatabase.googleapis.com/storage/total_bytes',
      storageFilter, start, end, '3600s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    monitoringMetricSpec_('rtdb_rules_count', 'firebasedatabase.googleapis.com/rules/evaluation_count',
      storageFilter, start, end, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', [])
  ];
  // One batch per explicit click. No timer, retry loop, sampling daemon or write.
  const results = fetchMetrics_(specs, token);
  const firstHour = Math.floor(start.getTime() / HOUR_MS) * HOUR_MS;
  const endHour = Math.floor(end.getTime() / HOUR_MS) * HOUR_MS;
  const hours = {};
  for (let t = firstHour; t <= endHour && t < firstHour + 26 * HOUR_MS; t += HOUR_MS) {
    const when = new Date(t);
    const key = when.toISOString();
    hours[key] = {
      hour_start: key,
      hour_label_vn: Utilities.formatDate(when, vietnam, 'yyyy-MM-dd HH:mm'),
      reads: null, writes: null, deletes: null,
      rtdb_sent_bytes: null, rtdb_payload_bytes: null,
      rtdb_api_hits: null, rtdb_https_requests: null,
      sheets_requests: null, drive_requests: null
    };
  }
  const metrics = {};
  const availability = {};
  const warnings = [];
  const sumFields = ['reads','writes','deletes','rtdb_sent_bytes',
    'rtdb_payload_bytes','rtdb_api_hits','rtdb_https_requests','sheets_requests','drive_requests'];
  const gaugeKeys = ['storage','connections','listeners','function_instances','rtdb_storage_bytes'];
  specs.forEach(spec => {
    const result = results[spec.key] || { series: [], error: 'MISSING_RESULT' };
    const list = result.series || [];
    const error = result.error || null;
    const truncated = result.truncated === true;
    const points = [];
    list.forEach(row => (row.points || []).forEach(p => {
      const n = pointNumber_(p);
      const at = pointEndMs_(p);
      if (at > 0 && Number.isFinite(n)) points.push({ at: at, value: n });
    }));
    let total = 0;
    let peak = 0;
    let current = null;
    let last = -1;
    const hourlySum = {};
    points.forEach(p => {
      total += p.value;
      if (p.value > peak) peak = p.value;
      if (p.at > last) { last = p.at; current = p.value; }
      const key = new Date(Math.floor((p.at - 1) / HOUR_MS) * HOUR_MS).toISOString();
      hourlySum[key] = Number(hourlySum[key] || 0) + p.value;
    });
    const empty = !error && points.length === 0;
    availability[spec.key] = error ? 'ERROR' : (truncated ? 'TRUNCATED' : (empty ? 'NO_DATA' : 'OK'));
    if (error) warnings.push(spec.key + ':' + error);
    else if (truncated) warnings.push(spec.key + ':PAGE_LIMIT');
    metrics[spec.key] = {
      status: availability[spec.key],
      total: error || empty || truncated ? null : Math.round(total),
      peak_point: error || empty || truncated ? null : Math.round(peak),
      latest: error || empty || truncated ? null : Math.round(current),
      time_series_count: list.length,
      last_point_at: last > 0 ? new Date(last).toISOString() : null,
      error_code: error
    };
    if (sumFields.indexOf(spec.key) >= 0) {
      Object.keys(hours).forEach(key => {
        hours[key][spec.key] = !error && !empty && !truncated ?
          Math.round(Number(hourlySum[key] || 0)) : null;
      });
    }
  });

  // Existing Owner-authorized full Drive OAuth scope; one read-only metadata
  // request, not a folder listing. This is a shared Google account snapshot.
  let driveQuota = { status: 'UNAVAILABLE', account_scope: 'SHARED_GOOGLE_ACCOUNT_NOT_INVENTORY_ATTRIBUTABLE' };
  try {
    const response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() === 200) {
      const parsed = JSON.parse(response.getContentText() || '{}');
      const quota = parsed.storageQuota || {};
      driveQuota = {
        status: 'OK',
        account_scope: 'SHARED_GOOGLE_ACCOUNT_NOT_INVENTORY_ATTRIBUTABLE',
        limit_bytes: quota.limit || null,
        usage_bytes: quota.usage || null,
        usage_in_drive_bytes: quota.usageInDrive || null
      };
    } else {
      driveQuota.status = 'HTTP_' + response.getResponseCode();
    }
  } catch (_) { driveQuota.status = 'READ_UNAVAILABLE'; }
  const cloudflare = collectD166Cloudflare_(start, end);
  function attachCloudflare(source, fields) {
    if (source.status !== 'OK') return;
    (source.hourly || []).forEach(point => {
      const row = hours[point.hour_start_utc];
      if (!row) return;
      Object.keys(fields).forEach(key => {
        const value = d166CloudflareNumber_(point[key]);
        if (value !== null) row[fields[key]] = value;
      });
    });
  }
  attachCloudflare(cloudflare.workers, {requests:'cf_worker_requests',errors:'cf_worker_errors',subrequests:'cf_worker_subrequests'});
  attachCloudflare(cloudflare.durable_objects_account, {rowsRead:'cf_do_account_rows_read',rowsWritten:'cf_do_account_rows_written'});
  const hourly = Object.keys(hours).sort().map(key => hours[key]);
  return {
    ok: true,
    service: 'SUPRA_AGENT_USAGE_EXPORT_D166',
    revision: GATEWAY_REVISION,
    project: PROJECT_ID,
    generated_at: now.toISOString(),
    window: {
      mode: mode,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      timezone: vietnam,
      provider_firestore_timezone: 'America/Los_Angeles',
      provider_firestore_quota_day_start: zonedMidnightUtc_(now, 'America/Los_Angeles').toISOString(),
      partial_hour_possible: true,
      monitoring_data_delay_possible: true
    },
    summary: {
      metric_groups_requested: specs.length,
      success_groups: Object.keys(availability).filter(k => availability[k] === 'OK').length,
      failed_groups: warnings.length,
      firebasedatabase_sent_bytes: metrics.rtdb_sent_bytes.total,
      firebasedatabase_api_hits: metrics.rtdb_api_hits.total,
      firebasedatabase_https_requests: metrics.rtdb_https_requests.total,
      firebasedatabase_connections_peak: metrics.rtdb_connections.peak_point,
      firebasedatabase_monthly_sent_bytes: metrics.rtdb_monthly_sent.latest,
      firestore_reads: metrics.reads.total,
      firestore_writes: metrics.writes.total,
      firestore_deletes: metrics.deletes.total,
      warning_count: warnings.length,
      cost_usd: null,
      cost_status: 'BILLING_NOT_AVAILABLE_USE_OWNER_SCREENSHOT'
    },
    metrics: metrics,
    google_drive_account: driveQuota,
    cloudflare: cloudflare,
    hourly: hourly,
    status: {
      metric_availability: availability,
      warnings: warnings,
      unsupported_sources: {
        cloudflare_workers_do: cloudflare.workers.status,
        cloudflare_do_account: cloudflare.durable_objects_account.status,
        cloudflare_billing: cloudflare.billing_account.status,
        google_cloud_billing: 'MANUAL_BILLING_REPORT_CSV_OR_SCREENSHOT',
        github_account_usage: 'OUT_OF_SCOPE_ACCOUNT_WIDE',
        unregistered_resources: 'NOT_IN_INVENTORY_SCOPE'
      },
      source: 'GOOGLE_CLOUD_MONITORING_AND_DRIVE_ABOUT_READ_ONLY',
      monitoring_queries_per_click: specs.length,
      cloudflare_requests_per_click: 3,
      google_drive_api_reads_per_click: 1,
      firestore_document_operations_added: 0,
      provider_notes: [
        'Actual Billing cost is unavailable from this API and must not be estimated as exact USD.',
        'Monitoring API calls count returned time series against the billing-account read tier.',
        'No-data is not equivalent to zero activity; provider data can lag.',
        'Current Drive storage is a shared-account snapshot, not 24h usage.'
      ]
    }
  };
}



// D166: Only an ephemeral GitHub Actions Firebase identity may provision the
// read-only Cloudflare token. Regular Agent logins cannot assert this identity.
// More than 50 script properties is supported by PropertiesService (UI limit).
function provisionD166Cloudflare_(auth, body) {
  if (auth.role !== 'ADMIN' || auth.app_user_id !== 'd166-cloudflare-ci' ||
      !/^d166-gh-[0-9]{1,24}-[0-9]{1,5}$/.test(auth.uid))
    throw new Error('D166_PROVISION_FORBIDDEN');
  const id = String(body.account_id || '');
  const token = String(body.read_token || '');
  if (!/^[a-f0-9]{32}$/.test(id) || !/^[A-Za-z0-9_-]{20,256}$/.test(token))
    throw new Error('D166_CONFIG_INVALID');
  PropertiesService.getScriptProperties().setProperties({
    D166_CF_READ_TOKEN: token,
    D166_CF_ACCOUNT_ID: id
  }, false);
  return {ok:true,service:'D166_CF_PROVISION',configured:true};
}
function d166CloudflareNumber_(value) {
  const n = Number(value);
  return (value == null || !Number.isFinite(n) || n < 0) ? null : n;
}
// Provider errors must never reveal raw Cloudflare response bodies or secrets.
function d166CloudflareHttp_(url, token, payload) {
  try {
    const opts = {
      method: payload ? 'post' : 'get',
      headers: {Authorization: 'Bearer ' + token,Accept:'application/json'},
      muteHttpExceptions: true
    };
    if (payload) {opts.contentType='application/json';opts.payload=JSON.stringify(payload);}
    const res = UrlFetchApp.fetch(url, opts);
    const code = res.getResponseCode();
    if (code < 200 || code >= 300) return {ok:false,status:'HTTP_'+code};
    const body = JSON.parse(res.getContentText() || '{}');
    if (body.success === false || (Array.isArray(body.errors) && body.errors.length))
      return {ok:false,status:'PROVIDER_ERROR'};
    return {ok:true,body:body};
  } catch (_) {return {ok:false,status:'UNAVAILABLE'};}
}
function d166CloudflareQuery_(token, account, query, start, end, dataset) {
  const response = d166CloudflareHttp_('https://api.cloudflare.com/client/v4/graphql',token,
    {query:query,variables:{accountTag:account,start:start.toISOString(),end:end.toISOString()}});
  if (!response.ok) return {status:response.status,source:'CLOUDFLARE_GRAPHQL'};
  const accounts = response.body.data && response.body.data.viewer && response.body.data.viewer.accounts || [];
  if (accounts.length !== 1) return {status:'ACCOUNT_SCOPE_ERROR',source:'CLOUDFLARE_GRAPHQL'};
  const rows = accounts[0][dataset];
  if (!Array.isArray(rows)) return {status:'DATASET_UNAVAILABLE',source:'CLOUDFLARE_GRAPHQL'};
  const hourly = {};
  rows.forEach(row => {
    const name = String(row.dimensions && row.dimensions.datetimeHour || '');
    if (!/^\d{4}-\d\d-\d\dT\d\d:/.test(name)) return;
    const hour = new Date(name).toISOString();
    const item = hourly[hour] || (hourly[hour] = {hour_start_utc:hour});
    const keys = dataset === 'workersInvocationsAdaptiveGroups'
      ? ['requests','errors','subrequests'] : ['rowsRead','rowsWritten','duration'];
    keys.forEach(key=>{
      const n = d166CloudflareNumber_(row.sum && row.sum[key]);
      if (n !== null) item[key]=(item[key] || 0)+n;
    });
  });
  return {
    status: rows.length >= 100 ? 'TRUNCATED' : (rows.length ? 'OK' : 'NO_DATA'),
    source:'CLOUDFLARE_GRAPHQL',row_count:rows.length,
    hourly:Object.keys(hourly).sort().map(key=>hourly[key]),
    sampled_or_delayed_possible:true
  };
}
function collectD166Cloudflare_(start,end) {
  const props=PropertiesService.getScriptProperties();
  const token=String(props.getProperty('D166_CF_READ_TOKEN') || '');
  const account=String(props.getProperty('D166_CF_ACCOUNT_ID') || '');
  const missing={status:'NOT_CONFIGURED',source:'CLOUDFLARE'};
  if (!/^[a-f0-9]{32}$/.test(account) || !/^[A-Za-z0-9_-]{20,256}$/.test(token))
    return {workers:missing,durable_objects_account:missing,billing_account:missing};
  const workerQuery='query($accountTag:string,$start:string,$end:string){viewer{accounts(filter:{accountTag:$accountTag}){workersInvocationsAdaptiveGroups(limit:100,filter:{scriptName:"supra-inventory-beta",datetime_geq:$start,datetime_leq:$end}){dimensions{datetimeHour}sum{requests errors subrequests}}}}}';
  const doQuery='query($accountTag:string,$start:string,$end:string){viewer{accounts(filter:{accountTag:$accountTag}){durableObjectsPeriodicGroups(limit:100,filter:{datetime_geq:$start,datetime_leq:$end}){dimensions{datetimeHour}sum{rowsRead rowsWritten duration}}}}}';
  const workers=d166CloudflareQuery_(token,account,workerQuery,start,end,'workersInvocationsAdaptiveGroups');
  workers.scope='INVENTORY_BETA_WORKER_ONLY';
  const durable=d166CloudflareQuery_(token,account,doQuery,start,end,'durableObjectsPeriodicGroups');
  // InventoryCore namespace ID is not canonically registered. This account
  // aggregate is not Inventory usage; do not expose other namespaces' IDs.
  durable.scope='SHARED_ACCOUNT_UNATTRIBUTABLE_NOT_INVENTORY';
  const response=d166CloudflareHttp_(
    'https://api.cloudflare.com/client/v4/accounts/'+account+'/billable-usage',token,null);
  const billing={
    status:response.ok?'UNSUPPORTED_RESPONSE':response.status,
    source:'CLOUDFLARE_BILLABLE_USAGE_V1',period:'CURRENT_MONTH_PROVIDER_LAG',
    scope:'SHARED_ACCOUNT_UNATTRIBUTABLE_NOT_INVENTORY',actual_invoice:false
  };
  if (response.ok && Array.isArray(response.body.result)) {
    const records=response.body.result;
    billing.status=records.length>=250?'TRUNCATED':'OK';
    billing.cost_data_complete=records.every(row=>typeof row.BilledCost==='number');
    billing.metrics=records.slice(0,250).map(row=>({
      metric_id:String(row.x_BillableMetricId||'').slice(0,100),
      description:String(row.ChargeDescription||'').slice(0,120),
      charge_period_start:String(row.ChargePeriodStart||'').slice(0,24),
      consumed_quantity:d166CloudflareNumber_(row.ConsumedQuantity),
      consumed_unit:String(row.ConsumedUnit||'').slice(0,40),
      billed_cost:typeof row.BilledCost==='number'?row.BilledCost:null,
      billing_currency:String(row.BillingCurrency||'').slice(0,12)
    }));
  }
  return {workers:workers,durable_objects_account:durable,billing_account:billing};
}
