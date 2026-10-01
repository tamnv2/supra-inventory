const PROJECT_ID = 'supra-inventory-beta';
const DATABASE_ID = '(default)';
const ROLE_ALLOWLIST = ['ADMIN', 'PICKPACK_ADMIN'];
const CACHE_KEY = 'D159_FIRESTORE_USAGE_V3_QUOTA_PROJECT';
const GATEWAY_REVISION = 'D159-GW-v3';
const CACHE_TTL_SECONDS = 15 * 60;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const METRICS = {
  reads: 'firestore.googleapis.com/document/read_ops_count',
  writes: 'firestore.googleapis.com/document/write_ops_count',
  deletes: 'firestore.googleapis.com/document/delete_ops_count',
  connections: 'firestore.googleapis.com/network/active_connections',
  listeners: 'firestore.googleapis.com/network/snapshot_listeners',
  rules: 'firestore.googleapis.com/rules/evaluation_count'
};

function doGet() {
  return json_({
    ok: true,
    service: 'SUPRA_FIRESTORE_USAGE_GATEWAY_D159',
    project: PROJECT_ID,
    cache_ttl_seconds: CACHE_TTL_SECONDS,
    revision: GATEWAY_REVISION
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (String(body.action || '') !== 'get_firestore_usage') throw new Error('ACTION_NOT_ALLOWED');
    validateIdToken_(String(body.id_token || ''));
    return json_(loadSnapshot_());
  } catch (err) {
    return json_({ ok: false, error: safeError_(err) });
  }
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
  const token = ScriptApp.getOAuthToken();

  const specs = [
    metricSpec_('reads', METRICS.reads, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    metricSpec_('writes', METRICS.writes, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    metricSpec_('deletes', METRICS.deletes, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', []),
    metricSpec_('connections', METRICS.connections, start, now, '60s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    metricSpec_('listeners', METRICS.listeners, start, now, '60s', 'ALIGN_MAX', 'REDUCE_SUM', []),
    metricSpec_('rules', METRICS.rules, start, now, '3600s', 'ALIGN_SUM', 'REDUCE_SUM', ['metric.labels.result'])
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

  return {
    ok: true,
    service: 'SUPRA_FIRESTORE_USAGE_GATEWAY_D159',
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
      rules: !results.rules.error
    },
    quota_day: {
      timezone: 'America/Los_Angeles',
      start_at: providerDayStart.toISOString(),
      reads: Math.round(quotaReads),
      writes: Math.round(quotaWrites),
      deletes: Math.round(quotaDeletes),
      reference_limits: {
        reads: 50000,
        writes: 20000,
        deletes: 20000
      }
    },
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
    hourly: hourly,
    note: 'Cloud Monitoring may lag provider activity by several minutes. Reference limits are informational, not a billing entitlement assertion.'
  };
}

function metricSpec_(key, metricType, start, end, alignmentPeriod, aligner, reducer, groupBy) {
  const filter =
    'metric.type="' + metricType + '" AND ' +
    'resource.type="firestore.googleapis.com/Database" AND ' +
    'resource.labels.database_id="' + DATABASE_ID + '"';
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
      out[key] = { series: payload.timeSeries || [], error: null };
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

function safeError_(err) {
  const value = String((err && err.message) || err || 'UNKNOWN');
  return value.replace(/[^A-Za-z0-9_.:-]/g, '_').substring(0, 160);
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
