const PROJECT_ID = 'supra-inventory-beta';
const ROLE_ALLOWLIST = ['ADMIN', 'PICKPACK_ADMIN'];
const MAX_PAYLOAD_CHARS = 4500000;
const INDEX_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function doGet() {
  return json_({ ok: true, service: 'SUPRA_AGENT_LOG_GATEWAY_D158', project: PROJECT_ID });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (String(body.action || '') !== 'upload_agent_log') throw new Error('ACTION_NOT_ALLOWED');
    const auth = validateIdToken_(String(body.id_token || ''));
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
    const folder = DriveApp.getFolderById(folderId);
    const key = 'B_' + bundleId;
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const known = props.getProperty(key);
      if (known) {
        const parsed = JSON.parse(known);
        return json_({ ok: true, existing: true, file_id: String(parsed.file_id || '') });
      }

      const deterministicName = fileName.replace(/\.log$/, '_' + bundleId.substring(0, 12) + '.log');
      const existing = folder.getFilesByName(deterministicName);
      if (existing.hasNext()) {
        const file = existing.next();
        props.setProperty(key, JSON.stringify({ file_id: file.getId(), at_ms: Date.now() }));
        pruneIndex_(props);
        return json_({ ok: true, existing: true, file_id: file.getId() });
      }

      const file = folder.createFile(deterministicName, payload, MimeType.PLAIN_TEXT);
      props.setProperty(key, JSON.stringify({
        file_id: file.getId(),
        at_ms: Date.now(),
        uid: auth.uid,
        app_user_id: auth.app_user_id
      }));
      pruneIndex_(props);
      return json_({ ok: true, existing: false, file_id: file.getId() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: safeError_(err) });
  }
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
