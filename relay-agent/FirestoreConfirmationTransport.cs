using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class FirestoreConfirmationWorkItem
    {
        internal string RequestId;
        internal string Suffix;
        internal string PickerUid;
        internal string PickerUserId;
        internal string PickerEmployeeCode;
        internal string PickerDisplayName;
        internal long PickerSessionGeneration;
        internal long ClientSentAtMs;
        internal long CreatedAtMs;
    }

    internal sealed class FirestoreConfirmationOutcome
    {
        internal string Result = "CONFIRM_ERROR";
        internal string CacheMode = "NONE";
        internal string Route = "NONE";
        internal int Http;
        internal long OperationMs;
        internal int Matches;
        internal readonly List<string> Candidates = new List<string>();
        internal PickerRateDecision Rate = new PickerRateDecision();
        internal bool ShouldAck = true;
        internal string GuardId = "";
        internal long RetireAtMs;
    }

    internal sealed class FirestoreConfirmationTransport
    {
        internal const int PrimaryActivePollIntervalMs = 3000;
        internal const int PrimaryInactivePollIntervalMs = 15000;
        internal const int PrimaryHotPollIntervalMs = 1000;
        internal const int PrimaryPollIntervalMs = PrimaryActivePollIntervalMs;
        internal const int StandbyPollIntervalMs = 0;
        internal const int MaxDocumentsPerPoll = 100;
        internal const int MaxConcurrentJobs = 12;
        internal const long MaxPendingAgeMs = 20000L;

        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly string _instanceId;
        private readonly Func<string> _networkProvider;
        private readonly Action<string> _log;
        private readonly Action<string> _audit;
        private readonly Action _onRequest;
        private readonly Action _onResponse;
        private readonly Action<string, FirestoreConfirmationOutcome> _onDurableAck;
        private readonly Action<string> _state;
        private readonly Func<List<FirestoreConfirmationWorkItem>, Dictionary<string, FirestoreConfirmationOutcome>> _batchHandler;
        private readonly Action<List<PickerPresenceView>, string, string> _presenceSnapshotHandler;
        private readonly Action<FirestoreConfirmationWorkItem> _pickerActivityHandler;
        private readonly FirestoreAgentLeaderCoordinator _coordinator;
        private readonly Func<bool> _businessEnabled;
        private readonly Func<bool> _hasActivePda;
        private readonly Action<bool> _relayHealth;
        private long _lastPollTelemetryMs;
        private long _hotUntilMs;
        private int _lastBusinessPendingCount;
        private string _lastOutcomeState = "";
        private const int SummaryCheckpointAckThreshold = 50;
        private const long SummaryCheckpointIntervalMs = 5L * 60L * 1000L;
        private const long SummaryCheckpointRetryMs = 60L * 1000L;
        private readonly object _summaryCheckpointGate = new object();
        private readonly HashSet<string> _summaryDirtyDays = new HashSet<string>(StringComparer.Ordinal);
        private long _summaryDirtyVersion;
        private int _summaryDirtyAckCount;
        private long _summaryCheckpointRunning;
        private long _lastSummaryCheckpointMs;
        private long _lastSummaryCheckpointAttemptMs;
        private string _summaryCheckpointGeneration = "";
        private bool _summaryRecoveryRequired = true;
        private readonly object _currentBatchGate = new object();
        private readonly Dictionary<string, FirestoreConfirmationWorkItem> _currentBatchWorks =
            new Dictionary<string, FirestoreConfirmationWorkItem>(StringComparer.Ordinal);
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };

        internal FirestoreConfirmationTransport(
            Func<AgentSession> sessionProvider,
            Action ensureFreshToken,
            string instanceId,
            Func<string> networkProvider,
            Action<string> log,
            Action<string> audit,
            Action onRequest,
            Action onResponse,
            Action<string, FirestoreConfirmationOutcome> onDurableAck,
            Action<string> state,
            Func<List<FirestoreConfirmationWorkItem>, Dictionary<string, FirestoreConfirmationOutcome>> batchHandler,
            Action<List<PickerPresenceView>, string, string> presenceSnapshotHandler,
            Action<FirestoreConfirmationWorkItem> pickerActivityHandler,
            FirestoreAgentLeaderCoordinator coordinator,
            Func<bool> businessEnabled,
            Func<bool> hasActivePda,
            Action<bool> relayHealth)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _instanceId = instanceId ?? "";
            _networkProvider = networkProvider ?? (() => "UNKNOWN");
            _log = log ?? delegate { };
            _audit = audit ?? delegate { };
            _onRequest = onRequest ?? delegate { };
            _onResponse = onResponse ?? delegate { };
            _onDurableAck = onDurableAck ?? delegate { };
            _state = state ?? delegate { };
            _batchHandler = batchHandler;
            _presenceSnapshotHandler = presenceSnapshotHandler ?? delegate { };
            _pickerActivityHandler = pickerActivityHandler ?? delegate { };
            _coordinator = coordinator;
            _businessEnabled = businessEnabled ?? (() => true);
            _hasActivePda = hasActivePda ?? (() => true);
            _relayHealth = relayHealth ?? delegate { };
        }

        internal void Run(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                var waitMs = 10000;
                try
                {
                    if (!_businessEnabled())
                    {
                        _state("Relay PDA đang ngủ · xác nhận trực tiếp tại Agent vẫn hoạt động");
                        waitMs = 2000;
                    }
                    else if (_coordinator == null || !_coordinator.CanPollBusiness)
                    {
                        var role = _coordinator == null ? "FROZEN" : _coordinator.RoleName;
                        _state("Relay: " + role + " · không đọc queue PDA");
                        waitMs = _coordinator == null ? 5000 : _coordinator.BusinessPollIntervalMs;
                    }
                    else
                    {
                        _ensureFreshToken();
                        var session = _sessionProvider();
                        _coordinator.EnsureRoleCurrentBeforeBusiness(session);
                        var startedMs = NowMs();
                        var generation = _coordinator.Generation;
                        lock (_summaryCheckpointGate)
                        {
                            if (!string.Equals(_summaryCheckpointGeneration, generation, StringComparison.Ordinal))
                            {
                                _summaryCheckpointGeneration = generation ?? "";
                                _summaryRecoveryRequired = true;
                                _summaryDirtyDays.Add(FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow));
                                _summaryDirtyDays.Add(FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow.AddDays(-1)));
                            }
                        }

                        var processed = ProcessOnce(session);
                        QueueD157SummaryCheckpointIfDue();
                        if (processed > 0 && _lastBusinessPendingCount >= 2)
                            _hotUntilMs = NowMs() + 15000L;
                        else if (processed > 0)
                            _hotUntilMs = 0L;
                        if (NowMs() - startedMs >= FirestoreAgentLeaderCoordinator.FailoverAfterMs)
                            _coordinator.RequestRoleRefreshBeforeBusiness();
                        _relayHealth(true);
                        waitMs = NowMs() < _hotUntilMs
                            ? PrimaryHotPollIntervalMs
                            : (_hasActivePda() ? PrimaryActivePollIntervalMs : PrimaryInactivePollIntervalMs);
                        _state(processed > 0
                            ? (string.IsNullOrWhiteSpace(_lastOutcomeState) ? "Relay: PRIMARY · đã xử lý yêu cầu PDA" : _lastOutcomeState)
                            : (waitMs == PrimaryHotPollIntervalMs
                                ? "Relay: PRIMARY · HOT 1s · đang xả burst"
                                : (waitMs == PrimaryActivePollIntervalMs
                                    ? "Relay: PRIMARY · PDA hoạt động · 3s"
                                    : "Relay: PRIMARY · không có PDA hoạt động · 15s")));
                    }
                }
                catch (WebException ex)
                {
                    waitMs = _coordinator == null ? 2000 : Math.Min(4000, Math.Max(1000, _coordinator.BusinessPollIntervalMs));
                    try { _relayHealth(false); } catch { }
                    try { _state("Relay: FIRESTORE tạm gián đoạn · giữ vai trò / đang kết nối lại"); } catch { }
                    try { _log("FIRESTORE confirm transport fail role_preserved=true retry_ms=" + waitMs + " " + Describe(ex)); } catch { }
                }
                catch (Exception ex)
                {
                    waitMs = _coordinator == null ? 2000 : Math.Min(4000, Math.Max(1000, _coordinator.BusinessPollIntervalMs));
                    try { _relayHealth(true); } catch { }
                    try { _state("Relay: lỗi xử lý nội bộ · Firestore vẫn kết nối"); } catch { }
                    try { _log("FIRESTORE confirm logic fail transport_preserved=true retry_ms=" + waitMs + " " + Describe(ex)); } catch { }
                }

                // D157 realtime is acceleration only: it wakes this accepted REST
                // poll loop. All parsing, HA fences, WMS mutation and ACK logic remain
                // on this single pipeline.
                if (D157PendingWakeSignal.Wait(token, Math.Max(1000, waitMs))) break;
            }
        }

        private sealed class PendingDocument
        {
            internal string Name = "";
            internal string UpdateTime = "";
            internal string Source = "";
            internal FirestoreConfirmationWorkItem Work;
            internal List<PickerPresenceView> PresenceSnapshot;
            internal string PresenceReason = "";
            internal string PresenceRemovedSessionsJson = "[]";
        }

        private int ProcessOnce(AgentSession session)
        {
            var docs = ReadPendingDocuments(session);
            var eligible = new List<PendingDocument>();
            var processed = 0;

            foreach (var doc in docs)
            {
                if (doc == null) continue;
                if (string.Equals(doc.Source, "ANDROID_PRESENCE_V1", StringComparison.Ordinal))
                {
                    if (doc.PresenceSnapshot == null) continue;
                    _presenceSnapshotHandler(doc.PresenceSnapshot, doc.PresenceReason, doc.PresenceRemovedSessionsJson);
                    var applied = new FirestoreConfirmationOutcome
                    {
                        Result = "PRESENCE_APPLIED",
                        CacheMode = "EVENT_DRIVEN",
                        Route = "PRESENCE_SNAPSHOT",
                        Matches = doc.PresenceSnapshot.Count
                    };
                    if (TryAckControl(session, doc.Name, doc.UpdateTime, "picker_presence_current", applied))
                        processed++;
                    continue;
                }

                if (doc.Work == null) continue;
                try { _pickerActivityHandler(doc.Work); } catch { }
                var ageMs = NowMs() - doc.Work.CreatedAtMs;
                if (doc.Work.CreatedAtMs <= 0 || ageMs > MaxPendingAgeMs)
                {
                    _log("FIRESTORE CONFIRM stale-skip request=" + Short(doc.Work.RequestId) +
                         " age_ms=" + Math.Max(0L, ageMs));
                    continue;
                }
                if (!_coordinator.CanProcessJob(doc.Work.CreatedAtMs)) continue;
                eligible.Add(doc);
            }

            _lastBusinessPendingCount = eligible.Count;
            if (eligible.Count == 0) return processed;
            if (!_coordinator.VerifyPrimaryBeforeMutation(session))
            {
                _log("FIRESTORE CONFIRM mutation-fence=BLOCK role_or_generation_changed=true");
                return processed;
            }

            for (var offset = 0; offset < eligible.Count; offset += MaxConcurrentJobs)
            {
                var count = Math.Min(MaxConcurrentJobs, eligible.Count - offset);
                var batch = eligible.GetRange(offset, count);
                processed += ProcessBatch(session, batch);
            }
            return processed;
        }

        private int ProcessBatch(AgentSession session, List<PendingDocument> docs)
        {
            if (docs == null || docs.Count == 0) return 0;

            var works = new List<FirestoreConfirmationWorkItem>();
            foreach (var doc in docs)
            {
                var work = doc.Work;
                _log("FIRESTORE CONFIRM pending-found request=" + Short(work.RequestId) +
                     " picker=" + Safe(work.PickerUserId) +
                     " role=" + (_coordinator == null ? "UNKNOWN" : _coordinator.RoleName) +
                     " queue_age_ms=" + Math.Max(0L, NowMs() - work.CreatedAtMs));
                _onRequest();
                _audit("PDA_REQUEST request=" + Short(work.RequestId) +
                    " picker=" + Safe(work.PickerUserId) +
                    " picklist_suffix=redacted transport=FIRESTORE" +
                    " admin=" + Safe(session.AppUserId) +
                    " machine=" + Safe(Environment.MachineName) +
                    " instance=" + Short(_instanceId));
                works.Add(work);
            }

            lock (_currentBatchGate)
            {
                _currentBatchWorks.Clear();
                foreach (var work in works)
                    if (work != null && !string.IsNullOrWhiteSpace(work.RequestId))
                        _currentBatchWorks[work.RequestId] = work;
            }

            var businessStartedMs = NowMs();
            Dictionary<string, FirestoreConfirmationOutcome> outcomes;
            try
            {
                outcomes = _batchHandler == null
                    ? new Dictionary<string, FirestoreConfirmationOutcome>(StringComparer.Ordinal)
                    : _batchHandler(works);
            }
            catch (Exception ex)
            {
                _log("FIRESTORE batch business fail count=" + works.Count + " " + Describe(ex));
                outcomes = new Dictionary<string, FirestoreConfirmationOutcome>(StringComparer.Ordinal);
            }

            var businessMs = Math.Max(0L, NowMs() - businessStartedMs);
            _log("FIRESTORE CONFIRM business batch_ms=" + businessMs + " count=" + docs.Count);

            var processed = 0;
            foreach (var doc in docs)
            {
                var work = doc.Work;
                FirestoreConfirmationOutcome outcome;
                if (outcomes == null ||
                    !outcomes.TryGetValue(work.RequestId ?? "", out outcome) ||
                    outcome == null)
                {
                    outcome = new FirestoreConfirmationOutcome { Result = "CONFIRM_ERROR" };
                }

                if (!outcome.ShouldAck)
                {
                    _log("FIRESTORE ACK deferred request=" + Short(work.RequestId) +
                         " result=" + Safe(outcome.Result));
                    continue;
                }

                if (!TryAck(session, doc.Name, doc.UpdateTime, work.RequestId, outcome))
                    continue;

                _onResponse();
                var summaryDay = FindBusinessDay(work.RequestId);
                MarkD157SummaryDirty(summaryDay);
                try { _onDurableAck(summaryDay, outcome); } catch { }
                _lastOutcomeState = "Relay: PRIMARY · " + UserFacingOutcome(outcome);
                processed++;
            }

            lock (_currentBatchGate) _currentBatchWorks.Clear();
            _log("FIRESTORE CONFIRM batch count=" + docs.Count +
                 " acked=" + processed +
                 " role=" + (_coordinator == null ? "UNKNOWN" : _coordinator.RoleName));
            return processed;
        }

        private List<PendingDocument> ReadPendingDocuments(AgentSession session)
        {
            var cutoff = DateTime.UtcNow.AddMilliseconds(-MaxPendingAgeMs)
                .ToString("o", CultureInfo.InvariantCulture);
            var query = new Dictionary<string, object>
            {
                {
                    "structuredQuery", new Dictionary<string, object>
                    {
                        { "from", new object[] { new Dictionary<string, object> { { "collectionId", "relay_poc_jobs" } } } },
                        {
                            "where", new Dictionary<string, object>
                            {
                                {
                                    "compositeFilter", new Dictionary<string, object>
                                    {
                                        { "op", "AND" },
                                        { "filters", new object[]
                                            {
                                                new Dictionary<string, object>
                                                {
                                                    { "fieldFilter", new Dictionary<string, object>
                                                        {
                                                            { "field", new Dictionary<string, object> { { "fieldPath", "status" } } },
                                                            { "op", "EQUAL" },
                                                            { "value", StringField("PENDING") }
                                                        }
                                                    }
                                                },
                                                new Dictionary<string, object>
                                                {
                                                    { "fieldFilter", new Dictionary<string, object>
                                                        {
                                                            { "field", new Dictionary<string, object> { { "fieldPath", "created_at" } } },
                                                            { "op", "GREATER_THAN_OR_EQUAL" },
                                                            { "value", new Dictionary<string, object> { { "timestampValue", cutoff } } }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        {
                            "orderBy", new object[]
                            {
                                new Dictionary<string, object>
                                {
                                    { "field", new Dictionary<string, object> { { "fieldPath", "created_at" } } },
                                    { "direction", "ASCENDING" }
                                }
                            }
                        },
                        { "limit", MaxDocumentsPerPoll }
                    }
                }
            };

            try
            {
                var raw = SendSafeRead(
                    "POST",
                    AgentConfig.FirestoreDocumentsBaseUrl + ":runQuery",
                    session.IdToken,
                    Serialize(query));

                var rows = _json.DeserializeObject(raw) as IEnumerable;
                if (rows == null)
                    throw new InvalidOperationException("Firestore runQuery trả về JSON root không phải array.");

                var docs = new List<PendingDocument>();
                var rowCount = 0;
                foreach (var rowObj in rows)
                {
                    rowCount++;
                    var row = rowObj as Dictionary<string, object>;
                    if (row == null) continue;
                    object documentObj;
                    var document = row.TryGetValue("document", out documentObj)
                        ? documentObj as Dictionary<string, object>
                        : null;
                    var parsed = ParsePendingDocument(document);
                    if (parsed != null) docs.Add(parsed);
                }

                FirestoreQuotaGuard.RecordReadDocuments(docs.Count, "CONFIRM_PENDING_QUERY", _log);
                LogPollTelemetry("QUERY_FRESH_ONLY", docs.Count, rowCount);
                return docs;
            }
            catch (Exception ex)
            {
                _log("FIRESTORE CONFIRM pending-query fail-closed stale_list_fallback=false type=" +
                     ex.GetType().Name + " detail=" + AgentDiagnostics.Sanitize(ex.Message));
                throw;
            }
        }

        private PendingDocument ParsePendingDocument(Dictionary<string, object> doc)
        {
            if (doc == null) return null;
            var name = Get(doc, "name");
            var jobId = Last(name);
            object fieldsObj;
            var fields = doc.TryGetValue("fields", out fieldsObj)
                ? fieldsObj as Dictionary<string, object>
                : null;
            if (fields == null || string.IsNullOrWhiteSpace(jobId)) return null;
            if (FieldString(fields, "status") != "PENDING") return null;

            var source = FieldString(fields, "source");
            var requestId = FieldString(fields, "request_id");
            var createdAtMs = FieldTimestampMs(fields, "created_at");
            if (requestId != jobId || createdAtMs <= 0) return null;

            if (string.Equals(source, "ANDROID_PRESENCE_V1", StringComparison.Ordinal))
            {
                if (!string.Equals(jobId, "picker_presence_current", StringComparison.Ordinal) ||
                    FieldLong(fields, "schema_version") != 4)
                    return null;
                return new PendingDocument
                {
                    Name = name,
                    UpdateTime = Get(doc, "updateTime"),
                    Source = source,
                    PresenceSnapshot = ParsePresenceSnapshot(fields),
                    PresenceReason = FieldString(fields, "reason"),
                    PresenceRemovedSessionsJson = FieldString(fields, "removed_sessions_json")
                };
            }

            if (!string.Equals(source, "ANDROID_CONFIRM_V1", StringComparison.Ordinal)) return null;
            var suffix = FieldString(fields, "suffix");
            var pickerUid = FieldString(fields, "picker_uid");
            var pickerUserId = FieldString(fields, "picker_user_id");
            if (!ValidSuffix(suffix) ||
                string.IsNullOrWhiteSpace(pickerUid) || string.IsNullOrWhiteSpace(pickerUserId))
                return null;

            return new PendingDocument
            {
                Name = name,
                UpdateTime = Get(doc, "updateTime"),
                Source = source,
                Work = new FirestoreConfirmationWorkItem
                {
                    RequestId = jobId,
                    Suffix = suffix,
                    PickerUid = pickerUid,
                    PickerUserId = pickerUserId,
                    PickerEmployeeCode = FieldString(fields, "picker_employee_code"),
                    PickerDisplayName = FieldString(fields, "picker_display_name"),
                    PickerSessionGeneration = FieldLong(fields, "picker_session_generation"),
                    ClientSentAtMs = FieldLong(fields, "client_sent_at_ms"),
                    CreatedAtMs = createdAtMs
                }
            };
        }

        private static List<PickerPresenceView> ParsePresenceSnapshot(Dictionary<string, object> fields)
        {
            var result = new List<PickerPresenceView>();
            var pickersField = FieldMap(fields, "pickers");
            var array = pickersField == null ? null : MapValue(pickersField, "arrayValue");
            object valuesObj;
            var values = array != null && array.TryGetValue("values", out valuesObj)
                ? valuesObj as IEnumerable
                : null;
            if (values == null) return result;

            foreach (var raw in values)
            {
                var value = raw as Dictionary<string, object>;
                var mapValue = value == null ? null : MapValue(value, "mapValue");
                var item = mapValue == null ? null : MapValue(mapValue, "fields");
                if (item == null) continue;
                var userId = FieldString(item, "user_id");
                if (string.IsNullOrWhiteSpace(userId)) continue;
                result.Add(new PickerPresenceView
                {
                    UserId = userId,
                    FirebaseUid = FieldString(item, "firebase_uid"),
                    SessionGeneration = FieldLong(item, "session_generation"),
                    Source = string.Equals(FieldString(item, "source"), "PICKLIST", StringComparison.Ordinal) ? "PICKLIST" : "LOGIN",
                    EmployeeCode = FieldString(item, "employee_code"),
                    DisplayName = FieldString(item, "display_name"),
                    ContractorName = FieldString(item, "contractor_name"),
                    DeviceId = FieldString(item, "device_id"),
                    LoginAt = FieldString(item, "login_at"),
                    DeviceSeenAt = FieldString(item, "device_seen_at"),
                    Status = "PDA_READY"
                });
                if (result.Count >= 2000) break;
            }
            return result;
        }

        private static Dictionary<string, object> FieldMap(Dictionary<string, object> fields, string key)
        {
            object raw;
            return fields != null && fields.TryGetValue(key, out raw)
                ? raw as Dictionary<string, object>
                : null;
        }

        private static Dictionary<string, object> MapValue(Dictionary<string, object> map, string key)
        {
            object raw;
            return map != null && map.TryGetValue(key, out raw)
                ? raw as Dictionary<string, object>
                : null;
        }

        private void LogPollTelemetry(string mode, int pendingCount, int rowCount)
        {
            var now = NowMs();
            if (pendingCount <= 0 && now - _lastPollTelemetryMs < 30000) return;
            _lastPollTelemetryMs = now;
            _log("FIRESTORE CONFIRM poll=PASS mode=" + Safe(mode) +
                 " rows=" + Math.Max(0, rowCount) +
                 " pending=" + Math.Max(0, pendingCount) +
                 " role=" + (_coordinator == null ? "UNKNOWN" : _coordinator.RoleName));
        }

        private string SendSafeRead(string method, string url, string token, string body)
        {
            // D130: a dead Firestore route must not block the PRIMARY loop for 3 x 12s.
            // Two 4s safe-read attempts keep recovery bounded inside the PDA wait window.
            return FirestoreHttpTransport.SendJson(
                method,
                url,
                token,
                body,
                "Agent-Auto-Confirm-Pick-Pack/D130",
                4000,
                true,
                _log,
                "CONFIRM_QUERY",
                2);
        }

        private bool TryAckControl(
            AgentSession session,
            string name,
            string updateTime,
            string jobId,
            FirestoreConfirmationOutcome outcome)
        {
            var fields = new Dictionary<string, object>
            {
                { "status", StringField("ACK") },
                { "agent_id", StringField(Environment.MachineName) },
                { "agent_instance_id", StringField(_instanceId) },
                { "agent_admin_user_id", StringField(session.AppUserId ?? "") },
                { "agent_ack_at_ms", IntField(NowMs()) },
                { "lookup_status", StringField(outcome == null ? "PRESENCE_APPLIED" : (outcome.Result ?? "PRESENCE_APPLIED")) },
                { "lookup_matches", IntField(outcome == null ? 0 : Math.Max(0, outcome.Matches)) },
                { "lookup_route", StringField(outcome == null ? "PRESENCE_SNAPSHOT" : (outcome.Route ?? "PRESENCE_SNAPSHOT")) },
                { "cache_mode", StringField(outcome == null ? "EVENT_DRIVEN" : (outcome.CacheMode ?? "EVENT_DRIVEN")) }
            };
            var suffix = BuildMask(fields.Keys);
            if (!string.IsNullOrWhiteSpace(updateTime))
                suffix += "&currentDocument.updateTime=" + Uri.EscapeDataString(updateTime);

            try
            {
                Send("PATCH", DocumentUrl(name) + suffix, session.IdToken,
                    Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    false, "PRESENCE_ACK_CONTROL");
                _log("FIRESTORE PRESENCE ACK PASS request=" + Short(jobId) +
                     " count=" + (outcome == null ? 0 : Math.Max(0, outcome.Matches)) +
                     " durable_business_counter=false");
                return true;
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                var status = response == null ? 0 : (int)response.StatusCode;
                try { if (response != null) response.Dispose(); } catch { }
                if ((status == 409 || status == 412) && AckAlreadyVisible(session, name, jobId))
                    return true;
                throw;
            }
        }

        private bool TryAck(
            AgentSession session,
            string name,
            string updateTime,
            string jobId,
            FirestoreConfirmationOutcome outcome)
        {
            var ackStartedMs = NowMs();
            var rate = outcome.Rate ?? new PickerRateDecision();
            var retireAtMs = outcome.RetireAtMs > 0 ? outcome.RetireAtMs : NowMs();
            var terminalAtMs = NowMs();
            var terminalDurationMs = Math.Max(0L, terminalAtMs - Math.Max(0L, FindClientSentAt(jobId)));
            var businessDay = FindBusinessDay(jobId);
            var terminalConfirmed =
                string.Equals(outcome.Result, "CONFIRMED", StringComparison.Ordinal) ||
                string.Equals(outcome.Result, "ALREADY_CONFIRMED", StringComparison.Ordinal);

            var fields = new Dictionary<string, object>
            {
                { "status", StringField("ACK") },
                { "agent_id", StringField(Environment.MachineName) },
                { "agent_instance_id", StringField(_instanceId) },
                { "agent_admin_user_id", StringField(session.AppUserId ?? "") },
                { "agent_network", StringField(_networkProvider()) },
                { "agent_received_at_ms", IntField(terminalAtMs) },
                { "agent_ack_at_ms", IntField(terminalAtMs) },
                { "lookup_status", StringField(outcome.Result ?? "CONFIRM_ERROR") },
                { "lookup_matches", IntField(Math.Max(0, outcome.Matches)) },
                { "candidate_picklists", StringArrayField(outcome.Candidates) },
                { "lookup_ms", IntField(Math.Max(0L, outcome.OperationMs)) },
                { "lookup_route", StringField(outcome.Route ?? "NONE") },
                { "lookup_http", IntField(Math.Max(0, outcome.Http)) },
                { "cache_mode", StringField(outcome.CacheMode ?? "NONE") },
                { "rate_strikes", IntField(Math.Max(0, rate.StrikeCount)) },
                { "lock_level", IntField(Math.Max(0, rate.LockLevel)) },
                { "locked_until_ms", IntField(Math.Max(0L, rate.LockedUntilMs)) },
                { "guard_id", StringField(outcome.GuardId ?? "") },
                { "retire_at_ms", IntField(retireAtMs) },
                { "business_day", StringField(businessDay) },
                { "terminal_at_ms", IntField(terminalAtMs) },
                { "terminal_duration_ms", IntField(terminalDurationMs) }
            };

            var jobWrite = new Dictionary<string, object>
            {
                { "update", new Dictionary<string, object>
                    {
                        { "name", name },
                        { "fields", fields }
                    }
                },
                { "updateMask", new Dictionary<string, object> { { "fieldPaths", new List<string>(fields.Keys).ToArray() } } }
            };
            if (!string.IsNullOrWhiteSpace(updateTime))
                jobWrite["currentDocument"] = new Dictionary<string, object> { { "updateTime", updateTime } };

            // D157: the terminal PDA ACK is the latency-critical durable write.
            // Daily counters are rebuilt from Firestore ACK truth by a bounded
            // aggregate checkpoint, so this commit contains the job write only.
            var body = Serialize(new Dictionary<string, object>
            {
                { "writes", new object[] { jobWrite } }
            });
            var commitUrl =
                "https://firestore.googleapis.com/v1/projects/" + AgentConfig.FirebaseProjectId +
                "/databases/(default)/documents:commit";

            var attemptSession = session;
            for (var attempt = 1; attempt <= 3; attempt++)
            {
                try
                {
                    Send("POST", commitUrl, attemptSession.IdToken, body, false, "CONFIRM_ACK_DURABLE_COMMIT");
                    _audit("AGENT_RESPONSE request=" + Short(jobId) +
                        " result=" + Safe(outcome.Result) +
                        " business_day=" + businessDay +
                        " cache=" + Safe(outcome.CacheMode) +
                        " http=" + outcome.Http +
                        " strikes=" + rate.StrikeCount +
                        " lock_level=" + rate.LockLevel +
                        " instance=" + Short(_instanceId));
                    _log("FIRESTORE ACK PASS request=" + Short(jobId) +
                         " result=" + Safe(outcome.Result) +
                         " summary_checkpoint=queued attempt=" + attempt +
                         " ack_ms=" + Math.Max(0L, NowMs() - ackStartedMs));
                    return true;
                }
                catch (WebException ex)
                {
                    var response = ex.Response as HttpWebResponse;
                    var status = response == null ? 0 : (int)response.StatusCode;
                    try { if (response != null) response.Dispose(); } catch { }

                    if (status == 401 || status == 403)
                    {
                        try
                        {
                            _ensureFreshToken();
                            attemptSession = _sessionProvider();
                        }
                        catch { }
                    }

                    if (AckAlreadyVisible(attemptSession, name, jobId))
                    {
                        _audit("AGENT_RESPONSE_RECOVERED request=" + Short(jobId) +
                            " result=" + Safe(outcome.Result) +
                            " instance=" + Short(_instanceId));
                        _log("FIRESTORE ACK RECOVERED request=" + Short(jobId) +
                             " after_status=" + status +
                             " durable_commit_uncertain=true");
                        return true;
                    }

                    if (status == 409 || status == 412)
                    {
                        _log("FIRESTORE ACK conditional-lost request=" + Short(jobId) +
                             " status=" + status);
                        return false;
                    }

                    var retryable = status == 0 || status == 401 || status == 403 ||
                                    status == 408 || status == 429 || status >= 500;
                    if (!retryable || attempt >= 3) throw;
                    Thread.Sleep(150 * attempt);
                }
                catch
                {
                    if (AckAlreadyVisible(attemptSession, name, jobId))
                    {
                        _log("FIRESTORE ACK RECOVERED request=" + Short(jobId) +
                             " after_exception=true durable_commit_uncertain=true");
                        return true;
                    }
                    if (attempt >= 3) throw;
                    Thread.Sleep(150 * attempt);
                }
            }
            return false;
        }

        private void MarkD157SummaryDirty(string businessDay)
        {
            lock (_summaryCheckpointGate)
            {
                if (!string.IsNullOrWhiteSpace(businessDay)) _summaryDirtyDays.Add(businessDay);
                _summaryDirtyAckCount++;
                _summaryDirtyVersion++;
            }
        }

        private void QueueD157SummaryCheckpointIfDue()
        {
            var coordinator = _coordinator;
            if (coordinator == null || !coordinator.IsLeader) return;

            var now = NowMs();
            string generation;
            bool due;
            lock (_summaryCheckpointGate)
            {
                generation = _summaryCheckpointGeneration ?? "";
                var retryReady = _lastSummaryCheckpointAttemptMs == 0 ||
                                 now - _lastSummaryCheckpointAttemptMs >= SummaryCheckpointRetryMs;
                due = retryReady &&
                      (
                          _summaryRecoveryRequired ||
                          _summaryDirtyAckCount >= SummaryCheckpointAckThreshold ||
                          (_summaryDirtyAckCount > 0 &&
                           (_lastSummaryCheckpointMs == 0 ||
                            now - _lastSummaryCheckpointMs >= SummaryCheckpointIntervalMs))
                      );
                if (due) _lastSummaryCheckpointAttemptMs = now;
            }
            if (!due || string.IsNullOrWhiteSpace(generation)) return;
            if (Interlocked.CompareExchange(ref _summaryCheckpointRunning, 1L, 0L) != 0L) return;

            Task.Run(() =>
            {
                try
                {
                    _ensureFreshToken();
                    var session = _sessionProvider();
                    long capturedVersion;
                    List<string> days;
                    lock (_summaryCheckpointGate)
                    {
                        capturedVersion = _summaryDirtyVersion;
                        days = _summaryDirtyDays.ToList();
                        if (_summaryRecoveryRequired)
                        {
                            var current = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow);
                            var previous = FirestoreFleetMetricsClient.BusinessDayKey(DateTimeOffset.UtcNow.AddDays(-1));
                            if (!days.Contains(current)) days.Add(current);
                            if (!days.Contains(previous)) days.Add(previous);
                        }
                    }

                    if (_coordinator == null ||
                        !_coordinator.IsLeader ||
                        !string.Equals(_coordinator.Generation, generation, StringComparison.Ordinal) ||
                        !_coordinator.VerifyPrimaryBeforeMutation(session))
                    {
                        _log("D157 SUMMARY checkpoint=DEFER reason=PRIMARY_FENCE_CHANGED");
                        return;
                    }

                    foreach (var day in days.Where(value => !string.IsNullOrWhiteSpace(value)).Distinct().ToList())
                        RefreshD157DailySummaryAbsolute(session, day, generation);

                    lock (_summaryCheckpointGate)
                    {
                        _lastSummaryCheckpointMs = NowMs();
                        _summaryRecoveryRequired = false;
                        if (_summaryDirtyVersion == capturedVersion)
                        {
                            _summaryDirtyDays.Clear();
                            _summaryDirtyAckCount = 0;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _log("D157 SUMMARY checkpoint=DEFER type=" + ex.GetType().Name +
                         " detail=" + AgentDiagnostics.Sanitize(ex.Message));
                }
                finally
                {
                    Interlocked.Exchange(ref _summaryCheckpointRunning, 0L);
                }
            });
        }

        private void RefreshD157DailySummaryAbsolute(AgentSession session, string businessDay, string generation)
        {
            var total = RunD157AckCount(session, businessDay, false);
            var confirmed = RunD157AckCount(session, businessDay, true);
            confirmed = Math.Min(total, Math.Max(0L, confirmed));
            var error = Math.Max(0L, total - confirmed);
            var now = NowMs();

            if (_coordinator == null ||
                !_coordinator.IsLeader ||
                !string.Equals(_coordinator.Generation, generation, StringComparison.Ordinal))
                throw new InvalidOperationException("PRIMARY changed during D157 summary aggregation.");

            var fields = new Dictionary<string, object>
            {
                { "schema_version", IntField(2) },
                { "business_day", StringField(businessDay) },
                { "owner_agent_id", StringField(_instanceId) },
                { "updated_at_ms", IntField(now) },
                { "received_total", IntField(total) },
                { "confirmed_total", IntField(confirmed) },
                { "error_total", IntField(error) },
                { "checkpoint_mode", StringField("D157_AGGREGATE_ABSOLUTE") },
                { "checkpoint_generation", StringField(generation ?? "") }
            };
            var url = AgentConfig.FirestoreCoordinationBaseUrl + "/daily_" +
                      Uri.EscapeDataString(businessDay) + BuildMask(fields.Keys);
            Send(
                "PATCH",
                url,
                session.IdToken,
                Serialize(new Dictionary<string, object> { { "fields", fields } }),
                false,
                "D157_DAILY_SUMMARY_CHECKPOINT");
            _log("D157 SUMMARY checkpoint=PASS day=" + Safe(businessDay) +
                 " received=" + total +
                 " confirmed=" + confirmed +
                 " error=" + error +
                 " writes=1");
        }

        private long RunD157AckCount(AgentSession session, string businessDay, bool confirmedOnly)
        {
            var filters = new List<object>
            {
                new Dictionary<string, object>
                {
                    { "fieldFilter", new Dictionary<string, object>
                        {
                            { "field", new Dictionary<string, object> { { "fieldPath", "status" } } },
                            { "op", "EQUAL" },
                            { "value", StringField("ACK") }
                        }
                    }
                },
                new Dictionary<string, object>
                {
                    { "fieldFilter", new Dictionary<string, object>
                        {
                            { "field", new Dictionary<string, object> { { "fieldPath", "business_day" } } },
                            { "op", "EQUAL" },
                            { "value", StringField(businessDay) }
                        }
                    }
                }
            };
            if (confirmedOnly)
            {
                filters.Add(new Dictionary<string, object>
                {
                    { "fieldFilter", new Dictionary<string, object>
                        {
                            { "field", new Dictionary<string, object> { { "fieldPath", "lookup_status" } } },
                            { "op", "IN" },
                            { "value", new Dictionary<string, object>
                                {
                                    { "arrayValue", new Dictionary<string, object>
                                        {
                                            { "values", new object[]
                                                {
                                                    StringField("CONFIRMED"),
                                                    StringField("ALREADY_CONFIRMED")
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }

            var query = new Dictionary<string, object>
            {
                { "structuredAggregationQuery", new Dictionary<string, object>
                    {
                        { "structuredQuery", new Dictionary<string, object>
                            {
                                { "from", new object[]
                                    {
                                        new Dictionary<string, object> { { "collectionId", "relay_poc_jobs" } }
                                    }
                                },
                                { "where", new Dictionary<string, object>
                                    {
                                        { "compositeFilter", new Dictionary<string, object>
                                            {
                                                { "op", "AND" },
                                                { "filters", filters.ToArray() }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        { "aggregations", new object[]
                            {
                                new Dictionary<string, object>
                                {
                                    { "alias", "count" },
                                    { "count", new Dictionary<string, object>() }
                                }
                            }
                        }
                    }
                }
            };

            var url = AgentConfig.FirestoreDocumentsBaseUrl + ":runAggregationQuery";
            var raw = SendSafeRead(
                "POST",
                url,
                session.IdToken,
                Serialize(query));
            var rows = _json.DeserializeObject(raw) as IEnumerable;
            if (rows == null) throw new InvalidOperationException("D157 aggregation response is not an array.");

            long count = 0L;
            foreach (var rowObj in rows)
            {
                var row = rowObj as Dictionary<string, object>;
                var result = GetMap(row, "result");
                var aggregateFields = GetMap(result, "aggregateFields");
                var countField = GetMap(aggregateFields, "count");
                long parsed;
                if (countField != null &&
                    long.TryParse(Get(countField, "integerValue"), NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed))
                    count = Math.Max(count, parsed);
            }
            return Math.Max(0L, count);
        }

        private static Dictionary<string, object> GetMap(Dictionary<string, object> map, string key)
        {
            if (map == null) return null;
            object raw;
            return map.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
        }

        private long FindClientSentAt(string jobId)
        {
            lock (_currentBatchGate)
            {
                FirestoreConfirmationWorkItem item;
                return _currentBatchWorks.TryGetValue(jobId ?? "", out item) && item != null
                    ? item.ClientSentAtMs
                    : NowMs();
            }
        }

        private string FindBusinessDay(string jobId)
        {
            long createdAt;
            lock (_currentBatchGate)
            {
                FirestoreConfirmationWorkItem item;
                createdAt = _currentBatchWorks.TryGetValue(jobId ?? "", out item) && item != null
                    ? item.CreatedAtMs
                    : NowMs();
            }
            var hcm = DateTimeOffset.FromUnixTimeMilliseconds(Math.Max(0L, createdAt))
                .ToOffset(TimeSpan.FromHours(7))
                .AddHours(-5);
            return hcm.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        }

        private bool AckAlreadyVisible(AgentSession session, string name, string jobId)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken)) return false;
            try
            {
                var raw = Send(
                    "GET",
                    DocumentUrl(name),
                    session.IdToken,
                    null,
                    true,
                    "CONFIRM_ACK_VERIFY");
                var doc = _json.DeserializeObject(raw) as Dictionary<string, object>;
                object fieldsObj;
                var fields = doc != null && doc.TryGetValue("fields", out fieldsObj)
                    ? fieldsObj as Dictionary<string, object>
                    : null;
                var visible = string.Equals(FieldString(fields, "status"), "ACK", StringComparison.Ordinal);
                if (visible)
                {
                    _log("FIRESTORE ACK VERIFY PASS request=" + Short(jobId) +
                         " result=" + Safe(FieldString(fields, "lookup_status")));
                }
                return visible;
            }
            catch (Exception ex)
            {
                _log("FIRESTORE ACK VERIFY deferred request=" + Short(jobId) +
                     " " + Describe(ex));
                return false;
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
                "Agent-Auto-Confirm-Pick-Pack/D126",
                12000,
                retrySafeRead,
                _log,
                component);
        }

        private static string DocumentUrl(string name)
        {
            var value = (name ?? "").Trim();
            if (Uri.IsWellFormedUriString(value, UriKind.Absolute)) return value;
            if (!value.StartsWith("projects/", StringComparison.Ordinal))
                throw new InvalidOperationException("Firestore document resource name không hợp lệ.");
            return "https://firestore.googleapis.com/v1/" + value;
        }

        private string Serialize(object value)
        {
            lock (_json) return _json.Serialize(value);
        }

        private string Describe(Exception ex)
        {
            var web = ex as WebException;
            if (web == null) return "type=" + ex.GetType().Name + " detail=" + AgentDiagnostics.Sanitize(ex.Message);
            return FirestoreHttpTransport.Describe(web);
        }

        private static Dictionary<string, object> StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> IntField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString() } };
        }

        private static string BuildMask(IEnumerable<string> fields)
        {
            var parts = new List<string>();
            foreach (var field in fields ?? new string[0])
            {
                var value = (field ?? "").Trim();
                if (value.Length == 0) continue;
                parts.Add("updateMask.fieldPaths=" + Uri.EscapeDataString(value));
            }
            return parts.Count == 0 ? "" : "?" + string.Join("&", parts.ToArray());
        }

        private static Dictionary<string, object> StringArrayField(IEnumerable<string> values)
        {
            var rows = new List<object>();
            foreach (var raw in values ?? new string[0])
            {
                var value = (raw ?? "").Trim();
                if (value.Length == 0 || rows.Count >= 20) continue;
                rows.Add(StringField(value));
            }
            return new Dictionary<string, object>
            {
                { "arrayValue", new Dictionary<string, object> { { "values", rows.ToArray() } } }
            };
        }

        private static string UserFacingOutcome(FirestoreConfirmationOutcome outcome)
        {
            var status = outcome == null ? "CONFIRM_ERROR" : (outcome.Result ?? "CONFIRM_ERROR");
            switch (status)
            {
                case "CONFIRMED": return "Đã xác nhận PickList thành công";
                case "NOT_FOUND": return "Không tìm thấy PickList khớp đúng các số cuối";
                case "AMBIGUOUS_PICKLIST": return "Tìm thấy nhiều PickList · PDA cần chọn đúng một PickList";
                case "PICKER_LOCKED": return "PDA tạm khóa do nhập sai nhiều lần";
                case "WMS_SESSION_REQUIRED":
                case "SESSION_EXPIRED": return "Web Confirm chưa sẵn sàng";
                case "PROXY_BLOCK":
                case "PROXY_AUTH_REQUIRED":
                case "TRANSPORT_FAIL": return "Kết nối tới hệ thống Supra đang gián đoạn";
                case "FORBIDDEN": return "Hệ thống Supra từ chối quyền xác nhận";
                case "CONFIRM_REJECTED": return "Hệ thống Supra từ chối xác nhận PickList";
                case "CONFIRM_CONFLICT": return "PickList đang có xung đột trạng thái";
                case "CONFIRM_IN_PROGRESS_OR_UNCERTAIN": return "Trạng thái xác nhận chưa chắc chắn · không gửi lại";
                case "REQUEST_EXPIRED": return "Yêu cầu PDA đã quá thời gian xử lý";
                case "RATE_LIMITED": return "Hệ thống đang giới hạn yêu cầu";
                case "SERVER_ERROR": return "Hệ thống Supra đang lỗi máy chủ";
                case "SCHEMA_UNSUPPORTED": return "Không đọc được dữ liệu PickList an toàn";
                case "EXACT_CODE_NOT_RESOLVED": return "Dữ liệu PickList vừa thay đổi · cần tìm lại";
                default: return "Không thể hoàn tất xác nhận · mã " + status;
            }
        }

        private static string FieldString(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw)
                ? raw as Dictionary<string, object>
                : null;
            return value == null ? "" : Get(value, "stringValue");
        }

        private static long FieldLong(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw)
                ? raw as Dictionary<string, object>
                : null;
            long result;
            return value != null && long.TryParse(Get(value, "integerValue"), out result) ? result : 0L;
        }

        private static long FieldTimestampMs(Dictionary<string, object> fields, string key)
        {
            object raw;
            var value = fields != null && fields.TryGetValue(key, out raw)
                ? raw as Dictionary<string, object>
                : null;
            if (value == null) return 0L;
            var text = Get(value, "timestampValue");
            DateTimeOffset parsed;
            return DateTimeOffset.TryParse(text, out parsed) ? parsed.ToUnixTimeMilliseconds() : 0L;
        }

        private static string Get(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static string Last(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var parts = value.Split('/');
            return parts[parts.Length - 1];
        }

        private static string Mask(IEnumerable<string> fields)
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

        private static bool ValidSuffix(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length < 3 || value.Length > 20) return false;
            foreach (var ch in value) if (ch < '0' || ch > '9') return false;
            return true;
        }

        private static string Short(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "" : value.Substring(0, Math.Min(8, value.Length));
        }

        private static string Safe(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "unknown";
            var sb = new StringBuilder();
            foreach (var ch in value)
            {
                if (char.IsLetterOrDigit(ch) || ch == '.' || ch == '_' || ch == ':' || ch == '@' || ch == '-') sb.Append(ch);
                if (sb.Length >= 96) break;
            }
            return sb.Length == 0 ? "unknown" : sb.ToString();
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
