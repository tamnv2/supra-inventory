using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Google.Cloud.Firestore.V1;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;

namespace SupraInventoryRelayAgent
{
    internal sealed class D157PrimaryHandoffRequest
    {
        internal string RequestId = "";
        internal string Status = "";
        internal string TargetAgentInstanceId = "";
        internal string TargetMachine = "";
        internal string TargetAdminUserId = "";
        internal string RequesterAgentInstanceId = "";
        internal string RequesterUserId = "";
        internal string RequesterLogin = "";
        internal long CreatedAtMs;
        internal long ExpiresAtMs;
        internal long CompletedAtMs;
        internal string ResultDetail = "";
        internal string PrimaryGeneration = "";
        internal string SupportRequestId = "";
        internal string SupportTraceId = "";
        internal long SupportIssuedAtMs;
        internal long SupportExpiresAtMs;
        internal string SupportIssuedByUserId = "";
        internal string SupportIssuedByLogin = "";
    }

    internal static class D157PendingWakeSignal
    {
        private static readonly AutoResetEvent Wake = new AutoResetEvent(false);
        private static readonly object Gate = new object();
        // D158 hotfix: business identity is the Firestore document name (request id),
        // not Name+UpdateTime. Keep only the newest snapshot for a queued request.
        private static readonly Queue<string> PendingDocumentNames = new Queue<string>();
        private static readonly Dictionary<string, Google.Cloud.Firestore.V1.Document> PendingDocuments =
            new Dictionary<string, Google.Cloud.Firestore.V1.Document>(StringComparer.Ordinal);
        private static long _lastPulseUtcTicks;
        private static int _connected;

        internal static bool IsConnected { get { return Interlocked.CompareExchange(ref _connected, 0, 0) != 0; } }

        internal static void MarkConnected(bool connected)
        {
            Interlocked.Exchange(ref _connected, connected ? 1 : 0);
        }

        internal static void Pulse(Google.Cloud.Firestore.V1.Document document)
        {
            Interlocked.Exchange(ref _lastPulseUtcTicks, DateTime.UtcNow.Ticks);
            if (document != null)
            {
                var documentName = document.Name ?? "";
                if (!string.IsNullOrWhiteSpace(documentName))
                {
                    lock (Gate)
                    {
                        if (!PendingDocuments.ContainsKey(documentName))
                            PendingDocumentNames.Enqueue(documentName);
                        PendingDocuments[documentName] = document;
                        while (PendingDocumentNames.Count > 256)
                        {
                            var droppedName = PendingDocumentNames.Dequeue();
                            PendingDocuments.Remove(droppedName);
                        }
                    }
                }
            }
            try { Wake.Set(); } catch { }
        }

        internal static void Remove(string documentName)
        {
            if (string.IsNullOrWhiteSpace(documentName)) return;
            lock (Gate)
            {
                // D160: DocumentRemove is a tombstone for the newest cached listener
                // snapshot. PendingDocumentNames may still contain the name, but Drain
                // will skip it because the dictionary entry is gone.
                PendingDocuments.Remove(documentName);
            }
        }

        internal static List<Google.Cloud.Firestore.V1.Document> DrainDocuments(int max)
        {
            var result = new List<Google.Cloud.Firestore.V1.Document>();
            lock (Gate)
            {
                while (PendingDocumentNames.Count > 0 && result.Count < Math.Max(1, max))
                {
                    var documentName = PendingDocumentNames.Dequeue();
                    Google.Cloud.Firestore.V1.Document item;
                    if (!PendingDocuments.TryGetValue(documentName, out item))
                        continue;
                    PendingDocuments.Remove(documentName);
                    result.Add(item);
                }
            }
            return result;
        }

        internal static bool HasRecentPulse(TimeSpan age)
        {
            var ticks = Interlocked.Read(ref _lastPulseUtcTicks);
            return ticks > 0L && DateTime.UtcNow - new DateTime(ticks, DateTimeKind.Utc) <= age;
        }

        internal static bool Wait(CancellationToken token, int timeoutMs)
        {
            var index = WaitHandle.WaitAny(new[] { token.WaitHandle, Wake }, Math.Max(1, timeoutMs));
            return index == 0;
        }
    }

    internal static class FirestoreD157Grpc
    {
        internal static readonly TimeSpan PermanentFailureCooldown = TimeSpan.FromMinutes(5);
        internal const int InitialRetryMs = 2000;
        internal const int MaxRetryMs = 60000;

        internal static Metadata Headers(AgentSession session)
        {
            return new Metadata
            {
                { "authorization", "Bearer " + session.IdToken },
                { "google-cloud-resource-prefix", AgentConfig.FirestoreDatabaseName },
                { "x-goog-request-params", RequestParamsHeader() }
            };
        }

        internal static void ApplyGrpcProxyFromWindows()
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

        internal static void PrepareGrpcNativeOverride()
        {
            var assemblyDirectory = Path.GetDirectoryName(typeof(Channel).Assembly.Location) ?? "";
            var nativePath = Path.Combine(assemblyDirectory, "win-x64", "grpc_csharp_ext.x64.dll");
            if (!File.Exists(nativePath))
                throw new FileNotFoundException("Costura gRPC native runtime was not extracted.", nativePath);
            Environment.SetEnvironmentVariable("GRPC_CSHARP_EXT_OVERRIDE_LOCATION", nativePath);
        }

        internal static bool IsPermanent(StatusCode status)
        {
            switch (status)
            {
                case StatusCode.InvalidArgument:
                case StatusCode.PermissionDenied:
                case StatusCode.FailedPrecondition:
                case StatusCode.NotFound:
                case StatusCode.ResourceExhausted:
                case StatusCode.Unimplemented:
                    return true;
                default:
                    return false;
            }
        }

        internal static string RequestParamsHeader()
        {
            // Firestore Listen routes by the full database resource name.  The v92
            // project_id/database_id pair could disagree with ListenRequest.Database
            // and was observed in the field as intermittent InvalidArgument.
            return "database=" + Uri.EscapeDataString(AgentConfig.FirestoreDatabaseName ?? "");
        }
    }

    internal sealed class FirestoreD157PendingWakeListener : IDisposable
    {
        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly Action _forceRefreshToken;
        private readonly Func<bool> _enabled;
        private readonly Action<string> _log;
        private CancellationTokenSource _cts;
        private Task _task;

        internal FirestoreD157PendingWakeListener(
            Func<AgentSession> sessionProvider,
            Action ensureFreshToken,
            Action forceRefreshToken,
            Func<bool> enabled,
            Action<string> log)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _forceRefreshToken = forceRefreshToken ?? ensureFreshToken ?? delegate { };
            _enabled = enabled ?? (() => false);
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

        private async Task Loop(CancellationToken token)
        {
            var backoff = FirestoreD157Grpc.InitialRetryMs;
            while (!token.IsCancellationRequested)
            {
                if (!_enabled() || !FirestoreQuotaGuard.AllowOptionalFastPath())
                {
                    if (token.WaitHandle.WaitOne(2000)) return;
                    continue;
                }

                Channel channel = null;
                var accepted = false;
                var permanent = false;
                var retryMs = backoff;
                try
                {
                    _ensureFreshToken();
                    var session = _sessionProvider();
                    if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                        throw new InvalidOperationException("D157 fast-path thiếu Firebase token.");

                    FirestoreD157Grpc.ApplyGrpcProxyFromWindows();
                    FirestoreD157Grpc.PrepareGrpcNativeOverride();
                    channel = new Channel("firestore.googleapis.com", 443, new SslCredentials());
                    var client = new Google.Cloud.Firestore.V1.Firestore.FirestoreClient(channel);
                    using (var call = client.Listen(FirestoreD157Grpc.Headers(session), cancellationToken: token))
                    {
                        var cutoff = Timestamp.FromDateTime(DateTime.UtcNow.AddMilliseconds(-FirestoreConfirmationTransport.MaxPendingAgeMs));
                        var statusFilter = new StructuredQuery.Types.Filter
                        {
                            FieldFilter = new StructuredQuery.Types.FieldFilter
                            {
                                Field = new StructuredQuery.Types.FieldReference { FieldPath = "status" },
                                Op = StructuredQuery.Types.FieldFilter.Types.Operator.Equal,
                                Value = new Google.Cloud.Firestore.V1.Value { StringValue = "PENDING" }
                            }
                        };
                        var createdFilter = new StructuredQuery.Types.Filter
                        {
                            FieldFilter = new StructuredQuery.Types.FieldFilter
                            {
                                Field = new StructuredQuery.Types.FieldReference { FieldPath = "created_at" },
                                Op = StructuredQuery.Types.FieldFilter.Types.Operator.GreaterThanOrEqual,
                                Value = new Google.Cloud.Firestore.V1.Value { TimestampValue = cutoff }
                            }
                        };
                        var query = new StructuredQuery
                        {
                            Where = new StructuredQuery.Types.Filter
                            {
                                CompositeFilter = new StructuredQuery.Types.CompositeFilter
                                {
                                    Op = StructuredQuery.Types.CompositeFilter.Types.Operator.And
                                }
                            }
                        };
                        query.From.Add(new StructuredQuery.Types.CollectionSelector { CollectionId = "relay_poc_jobs" });
                        query.Where.CompositeFilter.Filters.Add(statusFilter);
                        query.Where.CompositeFilter.Filters.Add(createdFilter);
                        query.OrderBy.Add(new StructuredQuery.Types.Order
                        {
                            Field = new StructuredQuery.Types.FieldReference { FieldPath = "created_at" },
                            Direction = StructuredQuery.Types.Direction.Ascending
                        });

                        await call.RequestStream.WriteAsync(new ListenRequest
                        {
                            Database = AgentConfig.FirestoreDatabaseName,
                            AddTarget = new Target
                            {
                                TargetId = 157,
                                Query = new Target.Types.QueryTarget
                                {
                                    Parent = AgentConfig.FirestoreDatabaseName + "/documents",
                                    StructuredQuery = query
                                }
                            }
                        }).ConfigureAwait(false);
                        _log("D157 FAST_PATH listen=OPEN primary_only=true rest_fallback=true");

                        while (await call.ResponseStream.MoveNext(token).ConfigureAwait(false))
                        {
                            var response = call.ResponseStream.Current;
                            var targetChange = response == null ? null : response.TargetChange;
                            if (targetChange != null && targetChange.Cause != null && targetChange.Cause.Code != 0)
                                throw new RpcException(new Status((StatusCode)targetChange.Cause.Code, targetChange.Cause.Message ?? "D157 target rejected."));

                            if (!accepted)
                            {
                                accepted = true;
                                backoff = FirestoreD157Grpc.InitialRetryMs;
                                D157PendingWakeSignal.MarkConnected(true);
                                _log("D157 FAST_PATH listen=CONNECTED primary_only=true");
                            }

                            if (!_enabled() || !FirestoreQuotaGuard.AllowOptionalFastPath())
                            {
                                D157PendingWakeSignal.MarkConnected(false);
                                _log("D157 FAST_PATH listen=PAUSE reason=ROLE_OR_READ_BUDGET");
                                break;
                            }

                            var changed = response != null && response.DocumentChange != null && response.DocumentChange.Document != null;
                            var removed = response != null && response.DocumentRemove != null;
                            if (removed)
                            {
                                FirestoreQuotaGuard.Record("GET", AgentConfig.FirestoreRelayCollectionUrl, "D157_PENDING_LISTEN_REMOVE", _log);
                                D157PendingWakeSignal.Remove(response.DocumentRemove.Document);
                            }
                            if (!changed) continue;
                            FirestoreQuotaGuard.Record("GET", AgentConfig.FirestoreRelayCollectionUrl, "D157_PENDING_LISTEN_EVENT", _log);
                            D157PendingWakeSignal.Pulse(response.DocumentChange.Document);
                        }
                    }
                }
                catch (OperationCanceledException) { D157PendingWakeSignal.MarkConnected(false); return; }
                catch (RpcException ex)
                {
                    if (ex.Status.StatusCode == StatusCode.Unauthenticated)
                    {
                        permanent = false;
                        retryMs = FirestoreD157Grpc.InitialRetryMs;
                        backoff = FirestoreD157Grpc.InitialRetryMs;
                        try
                        {
                            _forceRefreshToken();
                            _log("D157 FAST_PATH listen=RECONNECT grpc=Unauthenticated auth_refresh=PASS retry_ms=" + retryMs + " circuit=CLOSED");
                        }
                        catch (Exception refreshEx)
                        {
                            _log("D157 FAST_PATH listen=RECONNECT grpc=Unauthenticated auth_refresh=FAIL type=" +
                                 refreshEx.GetType().Name + " retry_ms=" + retryMs + " circuit=CLOSED");
                        }
                    }
                    else
                    {
                        permanent = FirestoreD157Grpc.IsPermanent(ex.Status.StatusCode);
                        retryMs = permanent ? (int)FirestoreD157Grpc.PermanentFailureCooldown.TotalMilliseconds : backoff;
                        _log("D157 FAST_PATH listen=RECONNECT grpc=" + ex.Status.StatusCode +
                             " retry_ms=" + retryMs +
                             " circuit=" + (permanent ? "OPEN" : "CLOSED"));
                    }
                }
                catch (Exception ex)
                {
                    retryMs = backoff;
                    _log("D157 FAST_PATH listen=RECONNECT type=" + ex.GetType().Name +
                         " detail=" + AgentDiagnostics.Sanitize(ex.Message) +
                         " retry_ms=" + retryMs);
                }
                finally
                {
                    D157PendingWakeSignal.MarkConnected(false);
                    if (channel != null)
                    {
                        try { await channel.ShutdownAsync().ConfigureAwait(false); } catch { }
                    }
                }

                if (token.WaitHandle.WaitOne(Math.Max(FirestoreD157Grpc.InitialRetryMs, retryMs))) return;
                backoff = permanent
                    ? FirestoreD157Grpc.InitialRetryMs
                    : Math.Min(FirestoreD157Grpc.MaxRetryMs, Math.Max(FirestoreD157Grpc.InitialRetryMs, backoff) * 2);
            }
        }

        public void Dispose() { Stop(); }
    }

    internal sealed class FirestoreD157HandoffListener : IDisposable
    {
        private readonly Func<AgentSession> _sessionProvider;
        private readonly Action _ensureFreshToken;
        private readonly Action _forceRefreshToken;
        private readonly Action<D157PrimaryHandoffRequest> _onRequest;
        private readonly Action<string> _log;
        private CancellationTokenSource _cts;
        private Task _task;

        internal FirestoreD157HandoffListener(
            Func<AgentSession> sessionProvider,
            Action ensureFreshToken,
            Action forceRefreshToken,
            Action<D157PrimaryHandoffRequest> onRequest,
            Action<string> log)
        {
            _sessionProvider = sessionProvider;
            _ensureFreshToken = ensureFreshToken;
            _forceRefreshToken = forceRefreshToken ?? ensureFreshToken ?? delegate { };
            _onRequest = onRequest ?? delegate { };
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

        private async Task Loop(CancellationToken token)
        {
            var backoff = FirestoreD157Grpc.InitialRetryMs;
            while (!token.IsCancellationRequested)
            {
                Channel channel = null;
                var permanent = false;
                var retryMs = backoff;
                try
                {
                    _ensureFreshToken();
                    var session = _sessionProvider();
                    if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                        throw new InvalidOperationException("D157 handoff thiếu Firebase token.");

                    FirestoreD157Grpc.ApplyGrpcProxyFromWindows();
                    FirestoreD157Grpc.PrepareGrpcNativeOverride();
                    channel = new Channel("firestore.googleapis.com", 443, new SslCredentials());
                    var client = new Google.Cloud.Firestore.V1.Firestore.FirestoreClient(channel);
                    using (var call = client.Listen(FirestoreD157Grpc.Headers(session), cancellationToken: token))
                    {
                        var docs = new Target.Types.DocumentsTarget();
                        docs.Documents.Add(AgentConfig.FirestorePrimaryHandoffDocumentName);
                        await call.RequestStream.WriteAsync(new ListenRequest
                        {
                            Database = AgentConfig.FirestoreDatabaseName,
                            AddTarget = new Target { TargetId = 158, Documents = docs }
                        }).ConfigureAwait(false);

                        _log("D157 HANDOFF listen=OPEN fleet_wake=true");
                        while (await call.ResponseStream.MoveNext(token).ConfigureAwait(false))
                        {
                            var response = call.ResponseStream.Current;
                            var targetChange = response == null ? null : response.TargetChange;
                            if (targetChange != null && targetChange.Cause != null && targetChange.Cause.Code != 0)
                                throw new RpcException(new Status((StatusCode)targetChange.Cause.Code, targetChange.Cause.Message ?? "D157 handoff target rejected."));

                            backoff = FirestoreD157Grpc.InitialRetryMs;
                            var doc = response == null || response.DocumentChange == null
                                ? null : response.DocumentChange.Document;
                            if (doc == null || !string.Equals(doc.Name, AgentConfig.FirestorePrimaryHandoffDocumentName, StringComparison.Ordinal))
                                continue;
                            FirestoreQuotaGuard.Record("GET", AgentConfig.FirestorePrimaryHandoffUrl, "D157_HANDOFF_LISTEN_EVENT", _log);
                            _onRequest(Parse(doc));
                        }
                    }
                }
                catch (OperationCanceledException) { return; }
                catch (RpcException ex)
                {
                    if (ex.Status.StatusCode == StatusCode.Unauthenticated)
                    {
                        permanent = false;
                        retryMs = FirestoreD157Grpc.InitialRetryMs;
                        backoff = FirestoreD157Grpc.InitialRetryMs;
                        try
                        {
                            _forceRefreshToken();
                            _log("D157 HANDOFF listen=RECONNECT grpc=Unauthenticated auth_refresh=PASS retry_ms=" + retryMs + " circuit=CLOSED");
                        }
                        catch (Exception refreshEx)
                        {
                            _log("D157 HANDOFF listen=RECONNECT grpc=Unauthenticated auth_refresh=FAIL type=" +
                                 refreshEx.GetType().Name + " retry_ms=" + retryMs + " circuit=CLOSED");
                        }
                    }
                    else
                    {
                        permanent = FirestoreD157Grpc.IsPermanent(ex.Status.StatusCode);
                        retryMs = permanent ? (int)FirestoreD157Grpc.PermanentFailureCooldown.TotalMilliseconds : backoff;
                        _log("D157 HANDOFF listen=RECONNECT grpc=" + ex.Status.StatusCode +
                             " retry_ms=" + retryMs +
                             " circuit=" + (permanent ? "OPEN" : "CLOSED"));
                    }
                }
                catch (Exception ex)
                {
                    retryMs = backoff;
                    _log("D157 HANDOFF listen=RECONNECT type=" + ex.GetType().Name +
                         " detail=" + AgentDiagnostics.Sanitize(ex.Message) +
                         " retry_ms=" + retryMs);
                }
                finally
                {
                    if (channel != null)
                    {
                        try { await channel.ShutdownAsync().ConfigureAwait(false); } catch { }
                    }
                }

                if (token.WaitHandle.WaitOne(Math.Max(FirestoreD157Grpc.InitialRetryMs, retryMs))) return;
                backoff = permanent
                    ? FirestoreD157Grpc.InitialRetryMs
                    : Math.Min(FirestoreD157Grpc.MaxRetryMs, Math.Max(FirestoreD157Grpc.InitialRetryMs, backoff) * 2);
            }
        }

        private static D157PrimaryHandoffRequest Parse(Google.Cloud.Firestore.V1.Document doc)
        {
            return new D157PrimaryHandoffRequest
            {
                RequestId = String(doc, "request_id"),
                Status = String(doc, "status"),
                TargetAgentInstanceId = String(doc, "target_agent_instance_id"),
                TargetMachine = String(doc, "target_machine"),
                TargetAdminUserId = String(doc, "target_admin_user_id"),
                RequesterAgentInstanceId = String(doc, "requester_agent_instance_id"),
                RequesterUserId = String(doc, "requester_user_id"),
                RequesterLogin = String(doc, "requester_login"),
                CreatedAtMs = Long(doc, "created_at_ms"),
                ExpiresAtMs = Long(doc, "expires_at_ms"),
                CompletedAtMs = Long(doc, "completed_at_ms"),
                ResultDetail = String(doc, "result_detail"),
                PrimaryGeneration = String(doc, "primary_generation"),
                SupportRequestId = String(doc, "support_request_id"),
                SupportTraceId = String(doc, "support_trace_id"),
                SupportIssuedAtMs = Long(doc, "support_issued_at_ms"),
                SupportExpiresAtMs = Long(doc, "support_expires_at_ms"),
                SupportIssuedByUserId = String(doc, "support_issued_by_user_id"),
                SupportIssuedByLogin = String(doc, "support_issued_by_login")
            };
        }

        private static string String(Google.Cloud.Firestore.V1.Document doc, string key)
        {
            Google.Cloud.Firestore.V1.Value value;
            return doc != null && doc.Fields.TryGetValue(key, out value) && value != null
                ? value.StringValue ?? ""
                : "";
        }

        private static long Long(Google.Cloud.Firestore.V1.Document doc, string key)
        {
            Google.Cloud.Firestore.V1.Value value;
            return doc != null && doc.Fields.TryGetValue(key, out value) && value != null
                ? value.IntegerValue
                : 0L;
        }

        public void Dispose() { Stop(); }
    }

    internal sealed class FirestoreD157HandoffClient
    {
        private readonly System.Web.Script.Serialization.JavaScriptSerializer _json =
            new System.Web.Script.Serialization.JavaScriptSerializer();
        private readonly Action<string> _log;

        internal FirestoreD157HandoffClient(Action<string> log)
        {
            _log = log ?? delegate { };
        }

        internal string CreateRequest(AgentSession session, string sourceInstanceId, AgentPresenceView target)
        {
            EnsureOwnerLogin(session);
            if (target == null || string.IsNullOrWhiteSpace(target.AgentInstanceId))
                throw new InvalidOperationException("Chưa chọn Agent đích hợp lệ.");

            var now = NowMs();
            var requestId = Guid.NewGuid().ToString("N");
            var fields = new Dictionary<string, object>
            {
                { "schema_version", IntField(1) },
                { "request_id", StringField(requestId) },
                { "status", StringField("PENDING") },
                { "target_agent_instance_id", StringField(target.AgentInstanceId) },
                { "target_machine", StringField(target.Machine ?? "") },
                { "target_admin_user_id", StringField(target.AdminUserId ?? "") },
                { "requester_agent_instance_id", StringField(sourceInstanceId ?? "") },
                { "requester_user_id", StringField(session.AppUserId ?? "") },
                { "requester_login", StringField((session.LoginName ?? "").Trim().ToLowerInvariant()) },
                { "created_at_ms", IntField(now) },
                { "expires_at_ms", IntField(now + 30000L) },
                { "completed_at_ms", IntField(0L) },
                { "result_detail", StringField("") },
                { "primary_generation", StringField("") }
            };
            var mask = "?" + string.Join("&", new[]
            {
                "schema_version", "request_id", "status", "target_agent_instance_id",
                "target_machine", "target_admin_user_id", "requester_agent_instance_id",
                "requester_user_id", "requester_login", "created_at_ms", "expires_at_ms",
                "completed_at_ms", "result_detail", "primary_generation"
            }.Select(name => "updateMask.fieldPaths=" + Uri.EscapeDataString(name)));
            FirestoreHttpTransport.SendJson(
                "PATCH",
                AgentConfig.FirestorePrimaryHandoffUrl + mask,
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                "Agent-Auto-Confirm-Pick-Pack/D157",
                7000,
                false,
                _log,
                "D157_HANDOFF_REQUEST");
            _log("D157 HANDOFF request=PASS id=" + Short(requestId) +
                 " target=" + Short(target.AgentInstanceId));
            return requestId;
        }

        internal void Complete(
            AgentSession session,
            D157PrimaryHandoffRequest request,
            bool success,
            string detail,
            string generation)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken) || request == null)
                return;
            var fields = new Dictionary<string, object>
            {
                { "status", StringField(success ? "SUCCESS" : "FAILED") },
                { "completed_at_ms", IntField(NowMs()) },
                { "result_detail", StringField(Safe(detail)) },
                { "primary_generation", StringField(generation ?? "") }
            };
            var mask = "?updateMask.fieldPaths=status&updateMask.fieldPaths=completed_at_ms" +
                       "&updateMask.fieldPaths=result_detail&updateMask.fieldPaths=primary_generation";
            FirestoreHttpTransport.SendJson(
                "PATCH",
                AgentConfig.FirestorePrimaryHandoffUrl + mask,
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                "Agent-Auto-Confirm-Pick-Pack/D157",
                7000,
                false,
                _log,
                "D157_HANDOFF_RESULT");
        }

        private static void EnsureOwnerLogin(AgentSession session)
        {
            var login = session == null ? "" : (session.LoginName ?? "").Trim();
            if (!string.Equals(login, "tamnv2", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(login, "admin", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Tài khoản này không có quyền chuyển Agent chính.");
        }

        private static Dictionary<string, object> StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> IntField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString(CultureInfo.InvariantCulture) } };
        }

        private static long NowMs() { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); }
        private static string Short(string value)
        {
            var next = (value ?? "").Trim();
            return next.Length <= 10 ? next : next.Substring(0, 10);
        }
        private static string Safe(string value)
        {
            var next = AgentDiagnostics.Sanitize(value ?? "");
            return next.Length <= 160 ? next : next.Substring(0, 160);
        }
    }
}
