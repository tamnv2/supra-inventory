using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using Google.Cloud.Firestore.V1;
using Grpc.Core;

namespace SupraInventoryRelayAgent
{
    internal sealed class PickerCallLockView
    {
        internal string TargetUserId = "";
        internal string CallId = "";
        internal string SenderAgentId = "";
        internal string SenderRole = "";
        internal bool Active;
        internal long LockUntilMs;
    }

    internal sealed class PickerKickView
    {
        internal string UserId = "";
        internal string FirebaseUid = "";
        internal long RevokedGeneration;
        internal long KickedAtMs;
    }

    internal sealed class AgentSyncSnapshot
    {
        internal long Version;
        internal long UpdatedAtMs;
        internal string UpdateTime = "";
        internal List<PickerPresenceView> Pickers = new List<PickerPresenceView>();
        internal Dictionary<string, PickerCallLockView> Calls = new Dictionary<string, PickerCallLockView>(StringComparer.Ordinal);
        internal Dictionary<string, PickerKickView> Kicks = new Dictionary<string, PickerKickView>(StringComparer.Ordinal);
        internal List<AgentPresenceView> Fleet = new List<AgentPresenceView>();
        internal string CounterDayKey = "";
        internal long ReceivedTotal;
        internal long ConfirmedTotal;
        internal long ErrorTotal;
    }

    internal sealed class FirestoreAgentSyncClient
    {
        internal const int MaxAgents = 10;
        internal static readonly TimeSpan ReconcileInterval = TimeSpan.FromMinutes(5);
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly Action<string> _log;
        private readonly object _cacheGate = new object();
        private AgentSyncSnapshot _cachedSnapshot = new AgentSyncSnapshot();

        internal FirestoreAgentSyncClient(Action<string> log)
        {
            _log = log ?? delegate { };
        }

        internal void Remember(AgentSyncSnapshot snapshot)
        {
            if (snapshot == null) return;
            lock (_cacheGate) _cachedSnapshot = CloneSnapshot(snapshot);
        }

        private AgentSyncSnapshot Cached()
        {
            lock (_cacheGate) return CloneSnapshot(_cachedSnapshot);
        }

        internal AgentSyncSnapshot Load(AgentSession session)
        {
            EnsureSession(session);
            try
            {
                var raw = FirestoreHttpTransport.SendJson(
                    "GET", AgentConfig.FirestoreAgentSyncUrl, session.IdToken, null,
                    "Agent-Auto-Confirm-Pick-Pack/D134", 7000, true, _log, "AGENT_SYNC_READ", 2);
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                var snapshot = ParseRestDocument(doc);
                Remember(snapshot);
                return snapshot;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if (status == 404)
                {
                    var empty = new AgentSyncSnapshot();
                    Remember(empty);
                    return empty;
                }
                throw;
            }
        }

        internal AgentSyncSnapshot Mutate(AgentSession session, Action<AgentSyncSnapshot> mutation, string component)
        {
            EnsureSession(session);
            Exception last = null;
            for (var attempt = 1; attempt <= 4; attempt++)
            {
                try
                {
                    // D158: the listener already carries the latest exact agent_sync
                    // document. Reuse that RAM snapshot on the normal path; CAS with
                    // updateTime preserves correctness. A conflict falls back to GET.
                    var current = attempt == 1 ? Cached() : Load(session);
                    if (current == null || current.Version <= 0 || string.IsNullOrWhiteSpace(current.UpdateTime))
                        current = Load(session);
                    Normalize(current);
                    var beforeState = SerializeMutableState(current);
                    if (mutation != null) mutation(current);
                    Normalize(current);
                    var afterState = SerializeMutableState(current);
                    if (string.Equals(beforeState, afterState, StringComparison.Ordinal))
                    {
                        _log(component + " write=SKIP_NO_CHANGE");
                        Remember(current);
                        return current;
                    }
                    current.Version = Math.Max(current.Version + 1L, NowMs());
                    current.UpdatedAtMs = NowMs();
                    var fields = SerializeFields(current);
                    var suffix = BuildMask(fields.Keys);
                    if (!string.IsNullOrWhiteSpace(current.UpdateTime))
                        suffix += "&currentDocument.updateTime=" + Uri.EscapeDataString(current.UpdateTime);
                    else
                        suffix += "&currentDocument.exists=false";
                    var raw = FirestoreHttpTransport.SendJson(
                        "PATCH", AgentConfig.FirestoreAgentSyncUrl + suffix, session.IdToken,
                        _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                        "Agent-Auto-Confirm-Pick-Pack/D158", 7000, false, _log, component);
                    var written = ParseRestDocument(_json.DeserializeObject(raw) as Dictionary<string, object>);
                    if (written.Version <= 0) written = current;
                    Remember(written);
                    return written;
                }
                catch (WebException ex)
                {
                    last = ex;
                    var response = ex.Response as HttpWebResponse;
                    var status = response == null ? 0 : (int)response.StatusCode;
                    try { if (response != null) response.Dispose(); } catch { }
                    if ((status == 409 || status == 412) && attempt < 4)
                    {
                        Thread.Sleep(80 * attempt);
                        continue;
                    }
                    throw;
                }
            }
            throw last ?? new InvalidOperationException("Không cập nhật được Agent sync.");
        }

        internal AgentSyncSnapshot Reconcile(
            AgentSession session,
            IEnumerable<PickerPresenceView> pickers,
            IDictionary<string, PickerContactCommand> openCalls,
            IEnumerable<AgentPresenceView> fleet,
            long received,
            long confirmed,
            long error)
        {
            return Mutate(session, snapshot =>
            {
                var incoming = ClonePickers(pickers);
                var incomingIds = new HashSet<string>(
                    incoming.Where(item => item != null && !string.IsNullOrWhiteSpace(item.UserId))
                        .Select(item => item.UserId),
                    StringComparer.Ordinal);

                // A valid PickList is an approved fallback presence source. Keep that
                // fallback through periodic reconciliation until the authoritative
                // LOGIN projection catches up or an explicit presence event/kick removes it.
                foreach (var previous in snapshot.Pickers ?? new List<PickerPresenceView>())
                {
                    if (previous == null ||
                        !string.Equals(previous.Source, "PICKLIST", StringComparison.Ordinal) ||
                        string.IsNullOrWhiteSpace(previous.UserId) ||
                        incomingIds.Contains(previous.UserId))
                        continue;
                    incoming.Add(ClonePicker(previous));
                    incomingIds.Add(previous.UserId);
                }
                snapshot.Pickers = incoming;

                var now = NowMs();
                var repairedCalls = new Dictionary<string, PickerCallLockView>(StringComparer.Ordinal);
                foreach (var pair in snapshot.Calls ?? new Dictionary<string, PickerCallLockView>())
                {
                    var existing = pair.Value;
                    if (existing != null && existing.LockUntilMs > now)
                    {
                        repairedCalls[pair.Key] = new PickerCallLockView
                        {
                            TargetUserId = existing.TargetUserId,
                            CallId = existing.CallId,
                            SenderAgentId = existing.SenderAgentId,
                            SenderRole = existing.SenderRole,
                            Active = false,
                            LockUntilMs = existing.LockUntilMs
                        };
                    }
                }
                if (openCalls != null)
                {
                    foreach (var pair in openCalls)
                    {
                        var command = pair.Value;
                        if (command == null || !command.IsActiveCall || string.IsNullOrWhiteSpace(command.TargetUserId))
                            continue;
                        var lockUntil = command.LockUntilMs > now ? command.LockUntilMs : now + 60000L;
                        repairedCalls[command.TargetUserId] = new PickerCallLockView
                        {
                            TargetUserId = command.TargetUserId,
                            CallId = command.AlertId ?? "",
                            SenderAgentId = command.SenderAgentId ?? "",
                            SenderRole = command.SenderRole ?? "",
                            Active = true,
                            LockUntilMs = lockUntil
                        };
                    }
                }
                snapshot.Calls = repairedCalls;
                snapshot.Fleet = CloneFleet(fleet);
                snapshot.CounterDayKey = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
                snapshot.ReceivedTotal = Math.Max(0L, received);
                snapshot.ConfirmedTotal = Math.Max(0L, confirmed);
                snapshot.ErrorTotal = Math.Max(0L, error);
            }, "AGENT_SYNC_RECONCILE");
        }

        internal AgentSyncSnapshot PublishPresence(AgentSession session, IEnumerable<PickerPresenceView> pickers)
        {
            return Mutate(session, snapshot => snapshot.Pickers = ClonePickers(pickers), "AGENT_SYNC_PRESENCE");
        }

        internal AgentSyncSnapshot UpsertPicker(AgentSession session, PickerPresenceView picker)
        {
            return Mutate(session, snapshot =>
            {
                if (picker == null || string.IsNullOrWhiteSpace(picker.UserId)) return;

                // D153: PickList is fallback presence only. A delayed fallback may not
                // downgrade authoritative LOGIN or rewrite the same/newer fallback.
                var existing = snapshot.Pickers.FirstOrDefault(item =>
                    item != null && string.Equals(item.UserId, picker.UserId, StringComparison.Ordinal));
                if (existing != null)
                {
                    var existingIsLogin = !string.Equals(existing.Source, "PICKLIST", StringComparison.Ordinal);
                    if (existingIsLogin &&
                        (picker.SessionGeneration <= 0 || existing.SessionGeneration >= picker.SessionGeneration))
                        return;
                    if (!existingIsLogin &&
                        (picker.SessionGeneration <= 0 || existing.SessionGeneration >= picker.SessionGeneration))
                        return;
                }

                PickerKickView kick;
                if (!string.IsNullOrWhiteSpace(picker.FirebaseUid) &&
                    snapshot.Kicks.TryGetValue(picker.FirebaseUid, out kick))
                {
                    if (picker.SessionGeneration <= kick.RevokedGeneration) return;
                    snapshot.Kicks.Remove(picker.FirebaseUid);
                }
                snapshot.Pickers.RemoveAll(item => item != null && string.Equals(item.UserId, picker.UserId, StringComparison.Ordinal));
                snapshot.Pickers.Add(ClonePicker(picker));
            }, "AGENT_SYNC_PICKLIST_UPSERT");
        }

        internal AgentSyncSnapshot SetCallLock(
            AgentSession session,
            string targetUserId,
            string callId,
            string senderAgentId,
            string senderRole,
            long lockUntilMs)
        {
            return Mutate(session, snapshot =>
            {
                snapshot.Calls[targetUserId ?? ""] = new PickerCallLockView
                {
                    TargetUserId = targetUserId ?? "",
                    CallId = callId ?? "",
                    SenderAgentId = senderAgentId ?? "",
                    SenderRole = senderRole ?? "",
                    Active = true,
                    LockUntilMs = Math.Max(NowMs(), lockUntilMs)
                };
            }, "AGENT_SYNC_CALL");
        }

        internal AgentSyncSnapshot SetCallResolved(AgentSession session, string targetUserId, string callId)
        {
            return Mutate(session, snapshot =>
            {
                PickerCallLockView current;
                if (!snapshot.Calls.TryGetValue(targetUserId ?? "", out current) || current == null) return;
                if (!string.Equals(current.CallId, callId ?? "", StringComparison.Ordinal)) return;
                current.Active = false;
            }, "AGENT_SYNC_CALL_RESOLVE");
        }

        internal void RevokePickerSession(
            AgentSession session,
            PickerPresenceView picker,
            string agentInstanceId)
        {
            EnsureSession(session);
            if (picker == null || string.IsNullOrWhiteSpace(picker.FirebaseUid) || picker.SessionGeneration <= 0)
                throw new InvalidOperationException("Picker thiếu generation hợp lệ để Kích User.");
            var fields = new Dictionary<string, object>
            {
                { "firebase_uid", StringField(picker.FirebaseUid) },
                { "user_id", StringField(picker.UserId ?? "") },
                { "revoked_generation", IntField(picker.SessionGeneration) },
                { "kicked_at_ms", IntField(NowMs()) },
                { "kicked_by_user_id", StringField(session.AppUserId ?? "") },
                { "kicked_by_agent_id", StringField(agentInstanceId ?? "") }
            };
            FirestoreHttpTransport.SendJson(
                "PATCH",
                AgentConfig.FirestorePickerSessionControlBaseUrl + "/" + Uri.EscapeDataString(picker.FirebaseUid) + BuildMask(fields.Keys),
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                "Agent-Auto-Confirm-Pick-Pack/D134", 7000, false, _log, "PICKER_SESSION_KICK");
        }

        internal AgentSyncSnapshot SetKick(
            AgentSession session,
            string userId,
            string firebaseUid,
            long revokedGeneration)
        {
            return Mutate(session, snapshot =>
            {
                if (string.IsNullOrWhiteSpace(firebaseUid)) return;
                snapshot.Kicks[firebaseUid] = new PickerKickView
                {
                    UserId = userId ?? "",
                    FirebaseUid = firebaseUid,
                    RevokedGeneration = Math.Max(1L, revokedGeneration),
                    KickedAtMs = NowMs()
                };
                snapshot.Pickers.RemoveAll(item => item != null &&
                    (string.Equals(item.UserId, userId, StringComparison.Ordinal) ||
                     string.Equals(item.FirebaseUid, firebaseUid, StringComparison.Ordinal)));
                snapshot.Calls.Remove(userId ?? "");
            }, "AGENT_SYNC_KICK");
        }

        internal static AgentSyncSnapshot ParseGrpcDocument(Google.Cloud.Firestore.V1.Document doc)
        {
            if (doc == null) return new AgentSyncSnapshot();
            var fields = new Dictionary<string, object>(StringComparer.Ordinal);
            foreach (var pair in doc.Fields)
            {
                if (pair.Value == null) continue;
                switch (pair.Value.ValueTypeCase)
                {
                    case Value.ValueTypeOneofCase.StringValue:
                        fields[pair.Key] = new Dictionary<string, object> { { "stringValue", pair.Value.StringValue } };
                        break;
                    case Value.ValueTypeOneofCase.IntegerValue:
                        fields[pair.Key] = new Dictionary<string, object> { { "integerValue", pair.Value.IntegerValue.ToString(CultureInfo.InvariantCulture) } };
                        break;
                }
            }
            var updateTime = doc.UpdateTime == null
                ? ""
                : doc.UpdateTime.ToDateTime().ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
            return ParseFields(fields, updateTime);
        }

        private static AgentSyncSnapshot ParseRestDocument(Dictionary<string, object> doc)
        {
            if (doc == null) return new AgentSyncSnapshot();
            object fieldsObj;
            var fields = doc.TryGetValue("fields", out fieldsObj) ? fieldsObj as Dictionary<string, object> : null;
            object updateObj;
            var updateTime = doc.TryGetValue("updateTime", out updateObj) ? Convert.ToString(updateObj) : "";
            return ParseFields(fields, updateTime);
        }

        private static AgentSyncSnapshot ParseFields(Dictionary<string, object> fields, string updateTime)
        {
            var snapshot = new AgentSyncSnapshot { UpdateTime = updateTime ?? "" };
            if (fields == null) return snapshot;
            snapshot.Version = FieldLong(fields, "version");
            snapshot.UpdatedAtMs = FieldLong(fields, "updated_at_ms");
            snapshot.CounterDayKey = FieldString(fields, "counter_business_day");
            snapshot.ReceivedTotal = FieldLong(fields, "received_total");
            snapshot.ConfirmedTotal = FieldLong(fields, "confirmed_total");
            snapshot.ErrorTotal = FieldLong(fields, "error_total");
            snapshot.Pickers = ParsePickers(FieldString(fields, "pickers_json"));
            snapshot.Calls = ParseCalls(FieldString(fields, "calls_json"));
            snapshot.Kicks = ParseKicks(FieldString(fields, "kicks_json"));
            snapshot.Fleet = ParseFleet(FieldString(fields, "fleet_json"));
            Normalize(snapshot);
            return snapshot;
        }

        private string SerializeMutableState(AgentSyncSnapshot snapshot)
        {
            snapshot = snapshot ?? new AgentSyncSnapshot();
            var stableFleet = (snapshot.Fleet ?? new List<AgentPresenceView>())
                .Where(item => item != null)
                .OrderBy(item => item.AgentInstanceId ?? "", StringComparer.Ordinal)
                .ThenBy(item => item.Role ?? "", StringComparer.Ordinal)
                .ToList();
            return _json.Serialize(new Dictionary<string, object>
            {
                { "pickers_json", SerializePickers(snapshot.Pickers) },
                { "calls_json", SerializeCalls(snapshot.Calls) },
                { "kicks_json", SerializeKicks(snapshot.Kicks) },
                { "fleet_json", SerializeFleet(stableFleet) },
                { "counter_business_day", snapshot.CounterDayKey ?? "" },
                { "received_total", Math.Max(0L, snapshot.ReceivedTotal) },
                { "confirmed_total", Math.Max(0L, snapshot.ConfirmedTotal) },
                { "error_total", Math.Max(0L, snapshot.ErrorTotal) }
            });
        }

        private Dictionary<string, object> SerializeFields(AgentSyncSnapshot snapshot)
        {
            return new Dictionary<string, object>
            {
                { "schema_version", IntField(4) },
                { "version", IntField(snapshot.Version) },
                { "updated_at_ms", IntField(snapshot.UpdatedAtMs) },
                { "pickers_json", StringField(SerializePickers(snapshot.Pickers)) },
                { "calls_json", StringField(SerializeCalls(snapshot.Calls)) },
                { "kicks_json", StringField(SerializeKicks(snapshot.Kicks)) },
                { "fleet_json", StringField(SerializeFleet(snapshot.Fleet)) },
                { "counter_business_day", StringField(snapshot.CounterDayKey ?? "") },
                { "received_total", IntField(snapshot.ReceivedTotal) },
                { "confirmed_total", IntField(snapshot.ConfirmedTotal) },
                { "error_total", IntField(snapshot.ErrorTotal) }
            };
        }

        private static void Normalize(AgentSyncSnapshot snapshot)
        {
            if (snapshot == null) return;
            if (snapshot.Pickers == null) snapshot.Pickers = new List<PickerPresenceView>();
            if (snapshot.Calls == null) snapshot.Calls = new Dictionary<string, PickerCallLockView>(StringComparer.Ordinal);
            if (snapshot.Kicks == null) snapshot.Kicks = new Dictionary<string, PickerKickView>(StringComparer.Ordinal);
            if (snapshot.Fleet == null) snapshot.Fleet = new List<AgentPresenceView>();
            var now = NowMs();
            foreach (var picker in snapshot.Pickers)
            {
                if (picker == null || string.IsNullOrWhiteSpace(picker.FirebaseUid)) continue;
                PickerKickView staleKick;
                if (snapshot.Kicks.TryGetValue(picker.FirebaseUid, out staleKick) &&
                    staleKick != null && picker.SessionGeneration > staleKick.RevokedGeneration)
                    snapshot.Kicks.Remove(picker.FirebaseUid);
            }
            var expiredCalls = new List<string>();
            foreach (var pair in snapshot.Calls)
                if (pair.Value == null || pair.Value.LockUntilMs <= now) expiredCalls.Add(pair.Key);
            foreach (var key in expiredCalls) snapshot.Calls.Remove(key);

            snapshot.Pickers.RemoveAll(item =>
            {
                if (item == null || string.IsNullOrWhiteSpace(item.UserId)) return true;
                PickerKickView kick;
                return !string.IsNullOrWhiteSpace(item.FirebaseUid) &&
                       snapshot.Kicks.TryGetValue(item.FirebaseUid, out kick) &&
                       item.SessionGeneration <= kick.RevokedGeneration;
            });
            snapshot.Pickers.Sort((a, b) => string.Compare(
                string.IsNullOrWhiteSpace(a.EmployeeCode) ? a.UserId : a.EmployeeCode,
                string.IsNullOrWhiteSpace(b.EmployeeCode) ? b.UserId : b.EmployeeCode,
                StringComparison.OrdinalIgnoreCase));
            if (snapshot.Pickers.Count > 500) snapshot.Pickers.RemoveRange(500, snapshot.Pickers.Count - 500);
            if (snapshot.Fleet.Count > MaxAgents) snapshot.Fleet.RemoveRange(MaxAgents, snapshot.Fleet.Count - MaxAgents);
        }

        private static AgentSyncSnapshot CloneSnapshot(AgentSyncSnapshot source)
        {
            source = source ?? new AgentSyncSnapshot();
            var next = new AgentSyncSnapshot
            {
                Version = source.Version,
                UpdatedAtMs = source.UpdatedAtMs,
                UpdateTime = source.UpdateTime ?? "",
                CounterDayKey = source.CounterDayKey ?? "",
                Pickers = ClonePickers(source.Pickers),
                Fleet = CloneFleet(source.Fleet),
                ReceivedTotal = Math.Max(0L, source.ReceivedTotal),
                ConfirmedTotal = Math.Max(0L, source.ConfirmedTotal),
                ErrorTotal = Math.Max(0L, source.ErrorTotal)
            };
            foreach (var pair in source.Calls ?? new Dictionary<string, PickerCallLockView>())
            {
                var item = pair.Value;
                if (item == null) continue;
                next.Calls[pair.Key] = new PickerCallLockView
                {
                    TargetUserId = item.TargetUserId ?? "",
                    CallId = item.CallId ?? "",
                    SenderAgentId = item.SenderAgentId ?? "",
                    SenderRole = item.SenderRole ?? "",
                    Active = item.Active,
                    LockUntilMs = item.LockUntilMs
                };
            }
            foreach (var pair in source.Kicks ?? new Dictionary<string, PickerKickView>())
            {
                var item = pair.Value;
                if (item == null) continue;
                next.Kicks[pair.Key] = new PickerKickView
                {
                    UserId = item.UserId ?? "",
                    FirebaseUid = item.FirebaseUid ?? "",
                    RevokedGeneration = item.RevokedGeneration,
                    KickedAtMs = item.KickedAtMs
                };
            }
            return next;
        }

        private static List<PickerPresenceView> ClonePickers(IEnumerable<PickerPresenceView> source)
        {
            var result = new List<PickerPresenceView>();
            foreach (var item in source ?? new PickerPresenceView[0])
            {
                if (item == null) continue;
                result.Add(ClonePicker(item));
                if (result.Count >= 500) break;
            }
            return result;
        }

        private static PickerPresenceView ClonePicker(PickerPresenceView item)
        {
            return new PickerPresenceView
            {
                UserId = item.UserId ?? "",
                FirebaseUid = item.FirebaseUid ?? "",
                EmployeeCode = item.EmployeeCode ?? "",
                DisplayName = item.DisplayName ?? "",
                ContractorName = item.ContractorName ?? "",
                DeviceId = item.DeviceId ?? "",
                LoginAt = item.LoginAt ?? "",
                DeviceSeenAt = item.DeviceSeenAt ?? "",
                Status = "PDA_READY",
                Source = string.Equals(item.Source, "PICKLIST", StringComparison.Ordinal) ? "PICKLIST" : "LOGIN",
                SessionGeneration = Math.Max(0L, item.SessionGeneration)
            };
        }

        private static List<AgentPresenceView> CloneFleet(IEnumerable<AgentPresenceView> source)
        {
            var result = new List<AgentPresenceView>();
            foreach (var item in source ?? new AgentPresenceView[0])
            {
                if (item == null) continue;
                result.Add(new AgentPresenceView
                {
                    AgentInstanceId = item.AgentInstanceId ?? "",
                    AdminUserId = item.AdminUserId ?? "",
                    Machine = item.Machine ?? "",
                    Role = item.Role ?? "DEEP_HIBERNATE",
                    Version = item.Version ?? "",
                    WmsReady = item.WmsReady,
                    HeartbeatAtMs = item.HeartbeatAtMs
                });
                if (result.Count >= MaxAgents) break;
            }
            return result;
        }

        private string SerializePickers(List<PickerPresenceView> items)
        {
            var list = new List<object>();
            foreach (var item in items ?? new List<PickerPresenceView>())
                list.Add(new Dictionary<string, object> {
                    { "user_id", item.UserId ?? "" }, { "firebase_uid", item.FirebaseUid ?? "" },
                    { "employee_code", item.EmployeeCode ?? "" }, { "display_name", item.DisplayName ?? "" },
                    { "contractor_name", item.ContractorName ?? "" },
                    { "device_id", item.DeviceId ?? "" }, { "login_at", item.LoginAt ?? "" },
                    { "source", item.Source ?? "LOGIN" }, { "session_generation", item.SessionGeneration }
                });
            return _json.Serialize(list);
        }

        private string SerializeCalls(Dictionary<string, PickerCallLockView> items)
        {
            var list = new List<object>();
            foreach (var pair in (items ?? new Dictionary<string, PickerCallLockView>())
                .OrderBy(item => item.Key, StringComparer.Ordinal))
            {
                var item = pair.Value; if (item == null) continue;
                list.Add(new Dictionary<string, object> {
                    { "target_user_id", item.TargetUserId ?? "" }, { "call_id", item.CallId ?? "" },
                    { "sender_agent_id", item.SenderAgentId ?? "" }, { "sender_role", item.SenderRole ?? "" },
                    { "active", item.Active }, { "lock_until_ms", item.LockUntilMs }
                });
            }
            return _json.Serialize(list);
        }

        private string SerializeKicks(Dictionary<string, PickerKickView> items)
        {
            var list = new List<object>();
            foreach (var pair in (items ?? new Dictionary<string, PickerKickView>())
                .OrderBy(item => item.Key, StringComparer.Ordinal))
            {
                var item = pair.Value; if (item == null) continue;
                list.Add(new Dictionary<string, object> {
                    { "user_id", item.UserId ?? "" }, { "firebase_uid", item.FirebaseUid ?? "" },
                    { "revoked_generation", item.RevokedGeneration }, { "kicked_at_ms", item.KickedAtMs }
                });
            }
            return _json.Serialize(list);
        }

        private string SerializeFleet(List<AgentPresenceView> items)
        {
            var list = new List<object>();
            foreach (var item in items ?? new List<AgentPresenceView>())
                list.Add(new Dictionary<string, object> {
                    { "agent_instance_id", item.AgentInstanceId ?? "" }, { "machine", item.Machine ?? "" },
                    { "role", item.Role ?? "DEEP_HIBERNATE" }, { "version", item.Version ?? "" },
                    { "wms_ready", item.WmsReady }, { "heartbeat_at_ms", item.HeartbeatAtMs }
                });
            return _json.Serialize(list);
        }

        private static List<PickerPresenceView> ParsePickers(string raw)
        {
            var result = new List<PickerPresenceView>();
            foreach (var map in JsonList(raw))
            {
                result.Add(new PickerPresenceView {
                    UserId = S(map, "user_id"), FirebaseUid = S(map, "firebase_uid"),
                    EmployeeCode = S(map, "employee_code"), DisplayName = S(map, "display_name"),
                    ContractorName = S(map, "contractor_name"),
                    DeviceId = S(map, "device_id"), LoginAt = S(map, "login_at"),
                    Status = "PDA_READY", Source = S(map, "source") == "PICKLIST" ? "PICKLIST" : "LOGIN",
                    SessionGeneration = L(map, "session_generation")
                });
            }
            return result;
        }

        private static Dictionary<string, PickerCallLockView> ParseCalls(string raw)
        {
            var result = new Dictionary<string, PickerCallLockView>(StringComparer.Ordinal);
            foreach (var map in JsonList(raw))
            {
                var user = S(map, "target_user_id"); if (user.Length == 0) continue;
                result[user] = new PickerCallLockView {
                    TargetUserId = user, CallId = S(map, "call_id"), SenderAgentId = S(map, "sender_agent_id"),
                    SenderRole = S(map, "sender_role"), Active = B(map, "active"), LockUntilMs = L(map, "lock_until_ms")
                };
            }
            return result;
        }

        private static Dictionary<string, PickerKickView> ParseKicks(string raw)
        {
            var result = new Dictionary<string, PickerKickView>(StringComparer.Ordinal);
            foreach (var map in JsonList(raw))
            {
                var uid = S(map, "firebase_uid"); if (uid.Length == 0) continue;
                result[uid] = new PickerKickView {
                    UserId = S(map, "user_id"), FirebaseUid = uid,
                    RevokedGeneration = L(map, "revoked_generation"), KickedAtMs = L(map, "kicked_at_ms")
                };
            }
            return result;
        }

        private static List<AgentPresenceView> ParseFleet(string raw)
        {
            var result = new List<AgentPresenceView>();
            foreach (var map in JsonList(raw))
            {
                result.Add(new AgentPresenceView {
                    AgentInstanceId = S(map, "agent_instance_id"), Machine = S(map, "machine"),
                    Role = S(map, "role"), Version = S(map, "version"),
                    WmsReady = B(map, "wms_ready"), HeartbeatAtMs = L(map, "heartbeat_at_ms")
                });
                if (result.Count >= MaxAgents) break;
            }
            return result;
        }

        private static List<Dictionary<string, object>> JsonList(string raw)
        {
            var result = new List<Dictionary<string, object>>();
            if (string.IsNullOrWhiteSpace(raw)) return result;
            try
            {
                var json = new JavaScriptSerializer();
                var array = json.DeserializeObject(raw) as IEnumerable;
                if (array == null) return result;
                foreach (var item in array)
                {
                    var map = item as Dictionary<string, object>;
                    if (map != null) result.Add(map);
                }
            }
            catch { }
            return result;
        }

        private static string S(Dictionary<string, object> map, string key)
        {
            object value; return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }
        private static long L(Dictionary<string, object> map, string key)
        {
            long value; return long.TryParse(S(map, key), out value) ? value : 0L;
        }
        private static bool B(Dictionary<string, object> map, string key)
        {
            object value; return map != null && map.TryGetValue(key, out value) && Convert.ToBoolean(value);
        }

        private static string FieldString(Dictionary<string, object> fields, string key)
        {
            object raw;
            var wrapper = fields != null && fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            object value;
            return wrapper != null && wrapper.TryGetValue("stringValue", out value) ? Convert.ToString(value) ?? "" : "";
        }
        private static long FieldLong(Dictionary<string, object> fields, string key)
        {
            object raw;
            var wrapper = fields != null && fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            object value;
            long parsed;
            return wrapper != null && wrapper.TryGetValue("integerValue", out value) &&
                   long.TryParse(Convert.ToString(value), NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed) ? parsed : 0L;
        }
        private static Dictionary<string, object> StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }
        private static Dictionary<string, object> IntField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString(CultureInfo.InvariantCulture) } };
        }
        private static string BuildMask(IEnumerable<string> fields)
        {
            var parts = new List<string>();
            foreach (var field in fields) parts.Add("updateMask.fieldPaths=" + Uri.EscapeDataString(field));
            return "?" + string.Join("&", parts.ToArray());
        }
        private static void EnsureSession(AgentSession session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("Thiếu phiên Agent cho đồng bộ.");
        }
        private static long NowMs() { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); }
    }

    internal sealed class FirestoreAgentSyncListener : IDisposable
    {
        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly Action<AgentSyncSnapshot> _onSnapshot;
        private readonly Action<List<PickerPresenceView>> _onDirectPresence;
        private readonly Action<PickerContactCommand> _onDirectActiveCall;
        private readonly Action<string> _onDirectActiveCallRemoved;
        private readonly Action<string> _log;
        private CancellationTokenSource _cts;
        private Task _task;

        internal FirestoreAgentSyncListener(
            Func<AgentSession> sessionProvider,
            Action ensureFreshToken,
            Action<AgentSyncSnapshot> onSnapshot,
            Action<List<PickerPresenceView>> onDirectPresence,
            Action<PickerContactCommand> onDirectActiveCall,
            Action<string> onDirectActiveCallRemoved,
            Action<string> log)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _onSnapshot = onSnapshot ?? delegate { };
            _onDirectPresence = onDirectPresence ?? delegate { };
            _onDirectActiveCall = onDirectActiveCall ?? delegate { };
            _onDirectActiveCallRemoved = onDirectActiveCallRemoved ?? delegate { };
            _log = log ?? delegate { };
        }

        internal void Start()
        {
            if (_cts != null) return;
            _cts = new CancellationTokenSource();
            _task = Task.Run(() => Loop(_cts.Token));
        }

        internal void Stop()
        {
            var cts = _cts; _cts = null;
            try { if (cts != null) cts.Cancel(); } catch { }
            try { if (_task != null) _task.Wait(1500); } catch { }
            _task = null;
            try { if (cts != null) cts.Dispose(); } catch { }
        }

        internal static readonly TimeSpan PermanentFailureCooldown = TimeSpan.FromMinutes(5);
        internal const int InitialRetryMs = 2000;
        internal const int MaxRetryMs = 60000;

        private async Task Loop(CancellationToken token)
        {
            var backoff = InitialRetryMs;
            while (!token.IsCancellationRequested)
            {
                Channel channel = null;
                var acceptedResponse = false;
                var permanentFailure = false;
                var retryDelayMs = backoff;
                try
                {
                    _ensureFreshToken();
                    var session = _sessionProvider();
                    if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                        throw new InvalidOperationException("Agent sync thiếu Firebase token.");

                    FirestoreD157Grpc.ApplyGrpcProxyFromWindows();
                    FirestoreD157Grpc.PrepareGrpcNativeOverride();
                    channel = new Channel("firestore.googleapis.com", 443, new SslCredentials());
                    var client = new Google.Cloud.Firestore.V1.Firestore.FirestoreClient(channel);
                    var headers = FirestoreD157Grpc.Headers(session);
                    using (var call = client.Listen(headers, cancellationToken: token))
                    {
                        var syncDocs = new Target.Types.DocumentsTarget();
                        syncDocs.Documents.Add(AgentConfig.FirestoreAgentSyncDocumentName);
                        await call.RequestStream.WriteAsync(new ListenRequest
                        {
                            Database = AgentConfig.FirestoreDatabaseName,
                            AddTarget = new Target { TargetId = 134, Documents = syncDocs }
                        }).ConfigureAwait(false);

                        var presenceDocs = new Target.Types.DocumentsTarget();
                        presenceDocs.Documents.Add(AgentConfig.FirestorePickerPresenceDocumentName);
                        await call.RequestStream.WriteAsync(new ListenRequest
                        {
                            Database = AgentConfig.FirestoreDatabaseName,
                            AddTarget = new Target { TargetId = 135, Documents = presenceDocs }
                        }).ConfigureAwait(false);

                        var activeCallsQuery = new StructuredQuery();
                        activeCallsQuery.From.Add(new StructuredQuery.Types.CollectionSelector { CollectionId = "picker_active_calls" });
                        activeCallsQuery.Where = new StructuredQuery.Types.Filter
                        {
                            FieldFilter = new StructuredQuery.Types.FieldFilter
                            {
                                Field = new StructuredQuery.Types.FieldReference { FieldPath = "status" },
                                Op = StructuredQuery.Types.FieldFilter.Types.Operator.Equal,
                                Value = new Google.Cloud.Firestore.V1.Value { StringValue = "ACTIVE" }
                            }
                        };
                        await call.RequestStream.WriteAsync(new ListenRequest
                        {
                            Database = AgentConfig.FirestoreDatabaseName,
                            AddTarget = new Target
                            {
                                TargetId = 136,
                                Query = new Target.Types.QueryTarget
                                {
                                    Parent = AgentConfig.FirestoreDatabaseName + "/documents",
                                    StructuredQuery = activeCallsQuery
                                }
                            }
                        }).ConfigureAwait(false);
                        _log("AGENT_SYNC listen=OPEN role_limited=true routing_headers=true direct_presence=true direct_calls=true cadence=EVENT_PLUS_5M");

                        while (await call.ResponseStream.MoveNext(token).ConfigureAwait(false))
                        {
                            var response = call.ResponseStream.Current;
                            var targetChange = response == null ? null : response.TargetChange;
                            if (targetChange != null && targetChange.Cause != null && targetChange.Cause.Code != 0)
                            {
                                throw new RpcException(new Status(
                                    (StatusCode)targetChange.Cause.Code,
                                    targetChange.Cause.Message ?? "Firestore listen target rejected."));
                            }

                            if (!acceptedResponse)
                            {
                                acceptedResponse = true;
                                backoff = InitialRetryMs;
                                _log("AGENT_SYNC listen=CONNECTED role_limited=true direct_sources=true cadence=EVENT_PLUS_5M");
                            }

                            var doc = response == null || response.DocumentChange == null
                                ? null : response.DocumentChange.Document;
                            if (doc != null)
                            {
                                if (string.Equals(doc.Name, AgentConfig.FirestoreAgentSyncDocumentName, StringComparison.Ordinal))
                                {
                                    var snapshot = FirestoreAgentSyncClient.ParseGrpcDocument(doc);
                                    _onSnapshot(snapshot);
                                    FirestoreQuotaGuard.Record("GET", AgentConfig.FirestoreAgentSyncUrl, "AGENT_SYNC_LISTEN_EVENT", _log);
                                    continue;
                                }

                                if (string.Equals(doc.Name, AgentConfig.FirestorePickerPresenceDocumentName, StringComparison.Ordinal))
                                {
                                    _onDirectPresence(FirestorePickerPresenceClient.ParseGrpcDocument(doc));
                                    FirestoreQuotaGuard.Record("GET", AgentConfig.FirestorePickerPresenceUrl, "D158_PRESENCE_LISTEN_EVENT", _log);
                                    continue;
                                }

                                if ((doc.Name ?? "").IndexOf("/picker_active_calls/", StringComparison.Ordinal) >= 0)
                                {
                                    var command = FirestorePickerContactClient.ParseGrpcActiveCall(doc);
                                    if (command != null) _onDirectActiveCall(command);
                                    FirestoreQuotaGuard.Record("GET", AgentConfig.FirestoreDocumentsBaseUrl + "/picker_active_calls", "D158_ACTIVE_CALL_LISTEN_EVENT", _log);
                                    continue;
                                }
                            }

                            var removedName = response != null && response.DocumentRemove != null
                                ? response.DocumentRemove.Document
                                : (response != null && response.DocumentDelete != null ? response.DocumentDelete.Document : "");
                            if (!string.IsNullOrWhiteSpace(removedName) &&
                                removedName.IndexOf("/picker_active_calls/", StringComparison.Ordinal) >= 0)
                            {
                                _onDirectActiveCallRemoved(FirestorePickerContactClient.TargetUserIdFromGrpcName(removedName));
                                FirestoreQuotaGuard.Record("GET", AgentConfig.FirestoreDocumentsBaseUrl + "/picker_active_calls", "D158_ACTIVE_CALL_LISTEN_REMOVE", _log);
                            }
                        }

                        retryDelayMs = backoff;
                        _log("AGENT_SYNC listen=ENDED retry_ms=" + retryDelayMs);
                    }
                }
                catch (OperationCanceledException) { return; }
                catch (RpcException ex)
                {
                    permanentFailure = IsPermanentRpcStatus(ex.Status.StatusCode);
                    retryDelayMs = permanentFailure
                        ? (int)PermanentFailureCooldown.TotalMilliseconds
                        : backoff;
                    _log(
                        "AGENT_SYNC listen=RECONNECT grpc=" + ex.Status.StatusCode +
                        " detail=" + AgentDiagnostics.Sanitize(ex.Status.Detail) +
                        " accepted=" + (acceptedResponse ? "true" : "false") +
                        " retry_ms=" + retryDelayMs +
                        " circuit=" + (permanentFailure ? "OPEN" : "CLOSED"));
                }
                catch (Exception ex)
                {
                    retryDelayMs = backoff;
                    _log(
                        "AGENT_SYNC listen=RECONNECT type=" + ex.GetType().Name +
                        " detail=" + AgentDiagnostics.Sanitize(ex.Message) +
                        " accepted=" + (acceptedResponse ? "true" : "false") +
                        " retry_ms=" + retryDelayMs +
                        " circuit=CLOSED");
                }
                finally
                {
                    if (channel != null)
                    {
                        try { await channel.ShutdownAsync().ConfigureAwait(false); } catch { }
                    }
                }

                if (token.WaitHandle.WaitOne(Math.Max(InitialRetryMs, retryDelayMs))) return;
                if (permanentFailure)
                    backoff = InitialRetryMs;
                else
                    backoff = Math.Min(MaxRetryMs, Math.Max(InitialRetryMs, backoff) * 2);
            }
        }

        private static bool IsPermanentRpcStatus(StatusCode status)
        {
            switch (status)
            {
                case StatusCode.InvalidArgument:
                case StatusCode.PermissionDenied:
                case StatusCode.Unauthenticated:
                case StatusCode.FailedPrecondition:
                case StatusCode.NotFound:
                case StatusCode.ResourceExhausted:
                case StatusCode.Unimplemented:
                    return true;
                default:
                    return false;
            }
        }

        private static string BuildRequestParamsHeader()
        {
            return FirestoreD157Grpc.RequestParamsHeader();
        }

        internal static bool SelfTestSafetyPolicy()
        {
            var routing = BuildRequestParamsHeader();
            return IsPermanentRpcStatus(StatusCode.InvalidArgument) &&
                   IsPermanentRpcStatus(StatusCode.ResourceExhausted) &&
                   !IsPermanentRpcStatus(StatusCode.Unavailable) &&
                   PermanentFailureCooldown >= TimeSpan.FromMinutes(5) &&
                   InitialRetryMs >= 2000 &&
                   MaxRetryMs >= 60000 &&
                   routing.IndexOf("database=", StringComparison.Ordinal) == 0 &&
                   !string.IsNullOrWhiteSpace(AgentConfig.FirestoreDatabaseName);
        }

        private static void ApplyGrpcProxyFromWindows()
        {
            try
            {
                var target = new Uri("https://firestore.googleapis.com");
                var proxy = WebRequest.DefaultWebProxy == null ? null : WebRequest.DefaultWebProxy.GetProxy(target);
                if (proxy != null && proxy.IsAbsoluteUri && !string.Equals(proxy.Host, target.Host, StringComparison.OrdinalIgnoreCase))
                    Environment.SetEnvironmentVariable("grpc_proxy", proxy.Scheme + "://" + proxy.Authority);
                else
                    Environment.SetEnvironmentVariable("grpc_proxy", null);
            }
            catch { }
        }

        private static string PrepareGrpcNativeOverride()
        {
            var assemblyDirectory = Path.GetDirectoryName(typeof(Channel).Assembly.Location) ?? "";
            var nativePath = Path.Combine(assemblyDirectory, "win-x64", "grpc_csharp_ext.x64.dll");
            if (!File.Exists(nativePath))
                throw new FileNotFoundException("Costura gRPC native runtime was not extracted.", nativePath);
            Environment.SetEnvironmentVariable("GRPC_CSHARP_EXT_OVERRIDE_LOCATION", nativePath);
            return nativePath;
        }

        internal static bool SelfTestNative()
        {
            Channel channel = null;
            try
            {
                PrepareGrpcNativeOverride();
                channel = new Channel("firestore.googleapis.com", 443, new SslCredentials());
                return channel != null;
            }
            finally
            {
                if (channel != null) try { channel.ShutdownAsync().Wait(1500); } catch { }
            }
        }

        public void Dispose() { Stop(); }
    }
}
