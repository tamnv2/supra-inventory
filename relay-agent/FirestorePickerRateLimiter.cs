using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class FirestorePickerRateLimiter
    {
        private const long StrikeWindowMs = 60L * 1000L;
        private const long ResetEscalationAfterMs = 24L * 60L * 60L * 1000L;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly object _cacheGate = new object();
        private readonly Dictionary<string, ReadResult> _cache =
            new Dictionary<string, ReadResult>(StringComparer.Ordinal);

        private sealed class State
        {
            internal string PickerUserId = "";
            internal int StrikeCount;
            internal long StrikeWindowStartedMs;
            internal int LockLevel;
            internal long LockedUntilMs;
            internal long LastLockAtMs;
            internal long LastNotFoundAtMs;
            internal long UpdatedAtMs;
            internal string LastRequestId = "";
        }

        private sealed class ReadResult
        {
            internal State Value;
            internal string UpdateTime = "";
            internal bool Exists;
        }

        internal void ClearCache()
        {
            lock (_cacheGate) _cache.Clear();
        }

        internal PickerRateDecision Check(AgentSession session, string pickerUid, string pickerUserId)
        {
            var read = ReadCached(session, pickerUid);
            var state = Clone(read.Value);
            if (state == null) return Decision(new State(), false);
            NormalizeExpiredEscalation(state, NowMs());
            return Decision(state, false);
        }

        internal PickerRateDecision RecordNotFound(
            AgentSession session,
            string pickerUid,
            string pickerUserId,
            string requestId)
        {
            for (var attempt = 0; attempt < 5; attempt++)
            {
                var read = ReadCached(session, pickerUid, attempt > 0);
                var state = Clone(read.Value) ?? new State();
                state.PickerUserId = pickerUserId ?? "";
                var now = NowMs();
                NormalizeExpiredEscalation(state, now);

                if (string.Equals(state.LastRequestId, requestId ?? "", StringComparison.Ordinal))
                    return Decision(state, false);

                if (state.LockedUntilMs > now)
                    return Decision(state, false);

                if (state.StrikeWindowStartedMs <= 0 || now - state.StrikeWindowStartedMs > StrikeWindowMs)
                {
                    state.StrikeWindowStartedMs = now;
                    state.StrikeCount = 1;
                }
                else
                {
                    state.StrikeCount++;
                }

                state.LastRequestId = requestId ?? "";
                state.LastNotFoundAtMs = now;
                state.UpdatedAtMs = now;

                var newlyLocked = false;
                if (state.StrikeCount >= 3)
                {
                    state.LockLevel = Math.Min(3, Math.Max(0, state.LockLevel) + 1);
                    var minutes = LockMinutesForLevel(state.LockLevel);
                    state.LockedUntilMs = now + minutes * 60L * 1000L;
                    state.LastLockAtMs = now;
                    state.StrikeCount = 0;
                    state.StrikeWindowStartedMs = 0;
                    newlyLocked = true;
                }

                if (WriteConditional(session, pickerUid, state, read))
                {
                    SetCache(pickerUid, new ReadResult
                    {
                        Exists = true,
                        Value = Clone(state),
                        UpdateTime = ""
                    });
                    // The next same-picker request may reuse the in-memory value.
                    // A conditional conflict invalidates this cache and refreshes from Firestore.
                    return Decision(state, newlyLocked);
                }
                Invalidate(pickerUid);
            }

            throw new InvalidOperationException("Không cập nhật được bộ đếm chống spam sau nhiều lần cạnh tranh.");
        }

        internal void ClearFound(AgentSession session, string pickerUid)
        {
            var read = ReadCached(session, pickerUid);
            var state = read.Value;
            var shouldDelete = read.Exists && state != null &&
                (state.StrikeCount > 0 ||
                 state.LockLevel > 0 ||
                 state.LockedUntilMs > 0 ||
                 state.LastLockAtMs > 0 ||
                 !string.IsNullOrWhiteSpace(state.LastRequestId));
            Invalidate(pickerUid);
            if (!shouldDelete) return;

            try
            {
                Send("DELETE", DocumentUrl(pickerUid), session.IdToken, null, false, "RATE_CLEAR_FOUND");
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status == 404) return;
                throw;
            }
        }

        private ReadResult ReadCached(AgentSession session, string pickerUid, bool forceFresh = false)
        {
            if (!forceFresh)
            {
                lock (_cacheGate)
                {
                    ReadResult cached;
                    if (_cache.TryGetValue(pickerUid, out cached))
                        return Clone(cached);
                }
            }

            var read = Read(session, pickerUid);
            SetCache(pickerUid, read);
            return Clone(read);
        }

        private void SetCache(string pickerUid, ReadResult value)
        {
            lock (_cacheGate) _cache[pickerUid] = Clone(value);
        }

        private void Invalidate(string pickerUid)
        {
            lock (_cacheGate) _cache.Remove(pickerUid);
        }

        private ReadResult Read(AgentSession session, string pickerUid)
        {
            EnsureSession(session);
            try
            {
                var raw = Send("GET", DocumentUrl(pickerUid), session.IdToken, null, true, "RATE_READ");
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (doc == null) return new ReadResult();

                object fieldsObj;
                var fields = doc.TryGetValue("fields", out fieldsObj)
                    ? fieldsObj as Dictionary<string, object>
                    : null;
                return new ReadResult
                {
                    Exists = true,
                    UpdateTime = StringValue(doc, "updateTime"),
                    Value = fields == null ? new State() : new State
                    {
                        PickerUserId = FieldString(fields, "picker_user_id"),
                        StrikeCount = (int)FieldLong(fields, "strike_count"),
                        StrikeWindowStartedMs = FieldLong(fields, "strike_window_started_ms"),
                        LockLevel = (int)FieldLong(fields, "lock_level"),
                        LockedUntilMs = FieldLong(fields, "locked_until_ms"),
                        LastLockAtMs = FieldLong(fields, "last_lock_at_ms"),
                        LastNotFoundAtMs = FieldLong(fields, "last_not_found_at_ms"),
                        UpdatedAtMs = FieldLong(fields, "updated_at_ms"),
                        LastRequestId = FieldString(fields, "last_request_id")
                    }
                };
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && (int)response.StatusCode == 404)
                {
                    try { response.Dispose(); } catch { }
                    return new ReadResult();
                }
                throw;
            }
        }

        private bool WriteConditional(AgentSession session, string pickerUid, State state, ReadResult previous)
        {
            EnsureSession(session);
            var fields = new Dictionary<string, object>
            {
                { "picker_user_id", StringField(state.PickerUserId ?? "") },
                { "strike_count", IntegerField(Math.Max(0, state.StrikeCount)) },
                { "strike_window_started_ms", IntegerField(Math.Max(0L, state.StrikeWindowStartedMs)) },
                { "lock_level", IntegerField(Math.Max(0, Math.Min(3, state.LockLevel))) },
                { "locked_until_ms", IntegerField(Math.Max(0L, state.LockedUntilMs)) },
                { "last_lock_at_ms", IntegerField(Math.Max(0L, state.LastLockAtMs)) },
                { "last_not_found_at_ms", IntegerField(Math.Max(0L, state.LastNotFoundAtMs)) },
                { "updated_at_ms", IntegerField(Math.Max(0L, state.UpdatedAtMs)) },
                { "last_request_id", StringField(state.LastRequestId ?? "") }
            };
            var url = DocumentUrl(pickerUid) + UpdateMask(fields.Keys);
            url += previous != null && previous.Exists && !string.IsNullOrWhiteSpace(previous.UpdateTime)
                ? "&currentDocument.updateTime=" + Uri.EscapeDataString(previous.UpdateTime)
                : "&currentDocument.exists=false";

            try
            {
                Send(
                    "PATCH",
                    url,
                    session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    false,
                    "RATE_WRITE");
                return true;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status == 409 || status == 412) return false;
                throw;
            }
        }

        private string Send(
            string method,
            string url,
            string token,
            string body,
            bool retrySafeRead,
            string component)
        {
            return FirestoreHttpTransport.SendJson(
                method,
                url,
                token,
                body,
                "Agent-Auto-Confirm-Pick-Pack/D097",
                8000,
                retrySafeRead,
                null,
                component);
        }

        private static string DocumentUrl(string pickerUid)
        {
            return AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                "/relay_poc_rate_limits/" + RateKey(pickerUid);
        }

        private static string RateKey(string pickerUid)
        {
            if (string.IsNullOrWhiteSpace(pickerUid))
                throw new InvalidOperationException("Relay job thiếu picker_uid.");
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(pickerUid));
                var builder = new StringBuilder(32);
                for (var i = 0; i < 16; i++) builder.Append(hash[i].ToString("x2"));
                return builder.ToString();
            }
        }

        private static bool NormalizeExpiredEscalation(State state, long now)
        {
            if (state == null || state.LastLockAtMs <= 0 || now < state.LockedUntilMs ||
                now - state.LastLockAtMs < ResetEscalationAfterMs) return false;
            state.LockLevel = 0;
            state.LockedUntilMs = 0;
            state.LastLockAtMs = 0;
            state.StrikeCount = 0;
            state.StrikeWindowStartedMs = 0;
            state.LastRequestId = "";
            state.UpdatedAtMs = now;
            return true;
        }

        private static PickerRateDecision Decision(State state, bool newlyLocked)
        {
            var now = NowMs();
            var locked = state != null && state.LockedUntilMs > now;
            var level = state == null ? 0 : Math.Max(0, state.LockLevel);
            return new PickerRateDecision
            {
                IsLocked = locked,
                NewlyLocked = newlyLocked,
                StrikeCount = state == null ? 0 : Math.Max(0, state.StrikeCount),
                LockLevel = level,
                LockMinutes = locked ? LockMinutesForLevel(level) : 0,
                LockedUntilMs = state == null ? 0 : Math.Max(0L, state.LockedUntilMs)
            };
        }

        private static int LockMinutesForLevel(int level)
        {
            if (level <= 1) return 5;
            if (level == 2) return 30;
            return 60;
        }

        private static ReadResult Clone(ReadResult read)
        {
            if (read == null) return new ReadResult();
            return new ReadResult
            {
                Exists = read.Exists,
                UpdateTime = read.UpdateTime ?? "",
                Value = Clone(read.Value)
            };
        }

        private static State Clone(State state)
        {
            if (state == null) return null;
            return new State
            {
                PickerUserId = state.PickerUserId ?? "",
                StrikeCount = state.StrikeCount,
                StrikeWindowStartedMs = state.StrikeWindowStartedMs,
                LockLevel = state.LockLevel,
                LockedUntilMs = state.LockedUntilMs,
                LastLockAtMs = state.LastLockAtMs,
                LastNotFoundAtMs = state.LastNotFoundAtMs,
                UpdatedAtMs = state.UpdatedAtMs,
                LastRequestId = state.LastRequestId ?? ""
            };
        }

        private static string UpdateMask(IEnumerable<string> fields)
        {
            var sb = new StringBuilder("?");
            var first = true;
            foreach (var field in fields)
            {
                if (!first) sb.Append("&");
                first = false;
                sb.Append("updateMask.fieldPaths=").Append(Uri.EscapeDataString(field));
            }
            return sb.ToString();
        }

        private static Dictionary<string, object> StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> IntegerField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString() } };
        }

        private static string FieldString(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            return value == null ? "" : StringValue(value, "stringValue");
        }

        private static long FieldLong(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            long parsed;
            return value != null && long.TryParse(StringValue(value, "integerValue"), out parsed) ? parsed : 0L;
        }

        private static string StringValue(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static void EnsureSession(AgentSession session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("Thiếu Firebase ADMIN session cho chống spam.");
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
