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
        }

        private sealed class ReadResult
        {
            internal State Value;
            internal string UpdateTime = "";
            internal bool Exists;
        }

        internal PickerRateDecision Check(AgentSession session, string pickerUid, string pickerUserId)
        {
            var read = Read(session, pickerUid);
            var state = read.Value;
            if (state == null) return Decision(new State(), false);
            if (NormalizeExpiredEscalation(state, NowMs()))
                WriteConditional(session, pickerUid, state, read);
            return Decision(state, false);
        }

        internal PickerRateDecision RecordFound(AgentSession session, string pickerUid, string pickerUserId)
        {
            return Mutate(session, pickerUid, pickerUserId, (state, now) =>
            {
                NormalizeExpiredEscalation(state, now);
                state.StrikeCount = 0;
                state.StrikeWindowStartedMs = 0;
                state.UpdatedAtMs = now;
                return false;
            });
        }

        internal PickerRateDecision RecordNotFound(AgentSession session, string pickerUid, string pickerUserId)
        {
            return Mutate(session, pickerUid, pickerUserId, (state, now) =>
            {
                NormalizeExpiredEscalation(state, now);
                if (state.LockedUntilMs > now) return false;

                if (state.StrikeWindowStartedMs <= 0 || now - state.StrikeWindowStartedMs > StrikeWindowMs)
                {
                    state.StrikeWindowStartedMs = now;
                    state.StrikeCount = 1;
                }
                else state.StrikeCount++;

                state.LastNotFoundAtMs = now;
                state.UpdatedAtMs = now;
                if (state.StrikeCount < 3) return false;

                state.LockLevel = Math.Min(3, Math.Max(0, state.LockLevel) + 1);
                var minutes = LockMinutesForLevel(state.LockLevel);
                state.LockedUntilMs = now + minutes * 60L * 1000L;
                state.LastLockAtMs = now;
                state.StrikeCount = 0;
                state.StrikeWindowStartedMs = 0;
                return true;
            });
        }

        private PickerRateDecision Mutate(
            AgentSession session,
            string pickerUid,
            string pickerUserId,
            Func<State, long, bool> mutate)
        {
            for (var attempt = 0; attempt < 5; attempt++)
            {
                var read = Read(session, pickerUid);
                var state = read.Value ?? new State();
                state.PickerUserId = pickerUserId ?? "";
                var newlyLocked = mutate(state, NowMs());
                if (WriteConditional(session, pickerUid, state, read))
                    return Decision(state, newlyLocked);
            }
            throw new InvalidOperationException("Không cập nhật được bộ đếm chống spam sau nhiều lần cạnh tranh.");
        }

        private ReadResult Read(AgentSession session, string pickerUid)
        {
            EnsureSession(session);
            var request = (HttpWebRequest)WebRequest.Create(DocumentUrl(pickerUid));
            request.Method = "GET";
            request.Accept = "application/json";
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/Rate";
            request.Timeout = 8000;
            request.ReadWriteTimeout = 8000;
            request.Headers[HttpRequestHeader.Authorization] = "Bearer " + session.IdToken;
            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                using (var reader = new StreamReader(response.GetResponseStream()))
                {
                    var doc = _json.DeserializeObject(reader.ReadToEnd()) as Dictionary<string, object>;
                    if (doc == null) return new ReadResult();
                    object fieldsObj;
                    var fields = doc.TryGetValue("fields", out fieldsObj) ? fieldsObj as Dictionary<string, object> : null;
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
                            UpdatedAtMs = FieldLong(fields, "updated_at_ms")
                        }
                    };
                }
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
                { "updated_at_ms", IntegerField(Math.Max(0L, state.UpdatedAtMs)) }
            };
            var url = DocumentUrl(pickerUid) + UpdateMask(fields.Keys);
            url += previous != null && previous.Exists && !string.IsNullOrWhiteSpace(previous.UpdateTime)
                ? "&currentDocument.updateTime=" + Uri.EscapeDataString(previous.UpdateTime)
                : "&currentDocument.exists=false";

            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "PATCH";
            request.Accept = "application/json";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/Rate";
            request.Timeout = 8000;
            request.ReadWriteTimeout = 8000;
            request.Headers[HttpRequestHeader.Authorization] = "Bearer " + session.IdToken;

            var payload = _json.Serialize(new Dictionary<string, object> { { "fields", fields } });
            var bytes = Encoding.UTF8.GetBytes(payload);
            request.ContentLength = bytes.Length;
            using (var output = request.GetRequestStream()) output.Write(bytes, 0, bytes.Length);

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                    return (int)response.StatusCode >= 200 && (int)response.StatusCode < 300;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && ((int)response.StatusCode == 409 || (int)response.StatusCode == 412))
                {
                    try { response.Dispose(); } catch { }
                    return false;
                }
                throw;
            }
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
