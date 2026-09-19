using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class PickerRateDecision
    {
        internal bool IsLocked;
        internal bool NewlyLocked;
        internal int StrikeCount;
        internal int LockLevel;
        internal int LockMinutes;
        internal long LockedUntilMs;
    }

    internal sealed class PickerRateLimiter
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
            internal string ETag = "";
        }

        internal PickerRateDecision Check(AgentSession session, string pickerUid, string pickerUserId)
        {
            var now = NowMs();
            var read = Read(session, pickerUid);
            var state = read.Value;
            if (state == null)
                return Decision(new State(), false);

            var changed = NormalizeExpiredEscalation(state, now);
            if (changed)
                WriteConditional(session, pickerUid, state, read.ETag);

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

                if (state.LockedUntilMs > now)
                    return false;

                if (state.StrikeWindowStartedMs <= 0 || now - state.StrikeWindowStartedMs > StrikeWindowMs)
                {
                    state.StrikeWindowStartedMs = now;
                    state.StrikeCount = 1;
                }
                else
                {
                    state.StrikeCount++;
                }

                state.LastNotFoundAtMs = now;
                state.UpdatedAtMs = now;

                if (state.StrikeCount < 3)
                    return false;

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
            for (var attempt = 0; attempt < 4; attempt++)
            {
                var read = Read(session, pickerUid);
                var state = read.Value ?? new State();
                state.PickerUserId = pickerUserId ?? "";
                var newlyLocked = mutate(state, NowMs());

                if (WriteConditional(session, pickerUid, state, read.ETag))
                    return Decision(state, newlyLocked);
            }

            throw new InvalidOperationException("Không cập nhật được bộ đếm chống spam sau nhiều lần cạnh tranh.");
        }

        private static bool NormalizeExpiredEscalation(State state, long now)
        {
            if (state == null) return false;
            if (state.LastLockAtMs <= 0) return false;
            if (now < state.LockedUntilMs) return false;
            if (now - state.LastLockAtMs < ResetEscalationAfterMs) return false;

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

        private ReadResult Read(AgentSession session, string pickerUid)
        {
            var request = (HttpWebRequest)WebRequest.Create(RateUrl(session, pickerUid));
            request.Method = "GET";
            request.Accept = "application/json";
            request.UserAgent = "SUPRA-Inventory-Relay-Test/RateLimit";
            request.Timeout = 7000;
            request.ReadWriteTimeout = 7000;
            request.Headers["X-Firebase-ETag"] = "true";

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                var raw = reader.ReadToEnd();
                var result = new ReadResult { ETag = response.Headers["ETag"] ?? "" };
                if (string.IsNullOrWhiteSpace(raw) || string.Equals(raw.Trim(), "null", StringComparison.OrdinalIgnoreCase))
                    return result;

                var map = _json.DeserializeObject(raw) as Dictionary<string, object>;
                if (map == null) return result;
                result.Value = new State
                {
                    PickerUserId = StringValue(map, "picker_user_id"),
                    StrikeCount = IntValue(map, "strike_count"),
                    StrikeWindowStartedMs = LongValue(map, "strike_window_started_ms"),
                    LockLevel = IntValue(map, "lock_level"),
                    LockedUntilMs = LongValue(map, "locked_until_ms"),
                    LastLockAtMs = LongValue(map, "last_lock_at_ms"),
                    LastNotFoundAtMs = LongValue(map, "last_not_found_at_ms"),
                    UpdatedAtMs = LongValue(map, "updated_at_ms")
                };
                return result;
            }
        }

        private bool WriteConditional(AgentSession session, string pickerUid, State state, string etag)
        {
            var payload = _json.Serialize(new Dictionary<string, object>
            {
                { "picker_user_id", state.PickerUserId ?? "" },
                { "strike_count", Math.Max(0, state.StrikeCount) },
                { "strike_window_started_ms", Math.Max(0L, state.StrikeWindowStartedMs) },
                { "lock_level", Math.Max(0, Math.Min(3, state.LockLevel)) },
                { "locked_until_ms", Math.Max(0L, state.LockedUntilMs) },
                { "last_lock_at_ms", Math.Max(0L, state.LastLockAtMs) },
                { "last_not_found_at_ms", Math.Max(0L, state.LastNotFoundAtMs) },
                { "updated_at_ms", Math.Max(0L, state.UpdatedAtMs) }
            });

            var request = (HttpWebRequest)WebRequest.Create(RateUrl(session, pickerUid));
            request.Method = "PUT";
            request.Accept = "application/json";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "SUPRA-Inventory-Relay-Test/RateLimit";
            request.Timeout = 7000;
            request.ReadWriteTimeout = 7000;
            if (!string.IsNullOrWhiteSpace(etag))
                request.Headers[HttpRequestHeader.IfMatch] = etag;

            var bytes = Encoding.UTF8.GetBytes(payload);
            request.ContentLength = bytes.Length;
            using (var output = request.GetRequestStream())
                output.Write(bytes, 0, bytes.Length);

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                    return (int)response.StatusCode >= 200 && (int)response.StatusCode < 300;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null && (int)response.StatusCode == 412)
                {
                    try { response.Dispose(); } catch { }
                    return false;
                }
                throw;
            }
        }

        private static string RateUrl(AgentSession session, string pickerUid)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("Thiếu Firebase ADMIN session cho chống spam.");
            return AgentConfig.DatabaseUrl.TrimEnd('/') +
                   "/relay_poc/rate_limits/" + RateKey(pickerUid) +
                   ".json?auth=" + Uri.EscapeDataString(session.IdToken);
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

        private static int LockMinutesForLevel(int level)
        {
            if (level <= 1) return 5;
            if (level == 2) return 30;
            return 60;
        }

        private static string StringValue(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static int IntValue(Dictionary<string, object> map, string key)
        {
            object value;
            int parsed;
            return map != null && map.TryGetValue(key, out value) &&
                   int.TryParse(Convert.ToString(value), out parsed) ? parsed : 0;
        }

        private static long LongValue(Dictionary<string, object> map, string key)
        {
            object value;
            long parsed;
            return map != null && map.TryGetValue(key, out value) &&
                   long.TryParse(Convert.ToString(value), out parsed) ? parsed : 0L;
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
