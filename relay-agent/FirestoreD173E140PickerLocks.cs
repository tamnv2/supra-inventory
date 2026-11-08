using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Google.Cloud.Firestore.V1;
using Grpc.Core;

namespace SupraInventoryRelayAgent
{
    internal sealed class D173E140LockedPicker
    {
        internal string Key = "";
        internal string UserId = "";
        internal long LockedUntilMs;
        internal int LockLevel;
    }

    // One event-driven query per authenticated Agent (PRIMARY and standbys).
    // This observes the existing rate-limit collection; no polling timer,
    // new database or unlock-history collection is created.
    internal sealed class FirestoreD173E140PickerLocks : IDisposable
    {
        private readonly Func<AgentSession> _session;
        private readonly Action _refreshToken;
        private readonly Func<bool> _enabled;
        private readonly Action<List<D173E140LockedPicker>> _changed;
        private readonly Action<string> _log;
        private readonly Dictionary<string, D173E140LockedPicker> _rows =
            new Dictionary<string, D173E140LockedPicker>(StringComparer.Ordinal);
        private CancellationTokenSource _cts;
        private Task _task;
        // Diagnostic counters are local only; no extra Firebase operations.
        private int _e169ConsecutiveListenFailures;

        internal FirestoreD173E140PickerLocks(
            Func<AgentSession> session,
            Action refreshToken,
            Func<bool> enabled,
            Action<List<D173E140LockedPicker>> changed,
            Action<string> log)
        {
            _session = session;
            _refreshToken = refreshToken;
            _enabled = enabled;
            _changed = changed;
            _log = log;
        }

        internal void Start()
        {
            if (_cts != null) return;
            _cts = new CancellationTokenSource();
            _task = Task.Run(() => Loop(_cts.Token));
        }

        internal void Stop()
        {
            var cts = _cts;
            _cts = null;
            try { if (cts != null) cts.Cancel(); } catch { }
            try { if (_task != null) _task.Wait(1000); } catch { }
            _task = null;
            try { if (cts != null) cts.Dispose(); } catch { }
        }

        private static long Number(
            IDictionary<string, Google.Cloud.Firestore.V1.Value> fields, string name)
        {
            Google.Cloud.Firestore.V1.Value raw;
            return fields != null && fields.TryGetValue(name, out raw) && raw != null
                ? raw.IntegerValue : 0L;
        }

        private static string StringValue(
            IDictionary<string, Google.Cloud.Firestore.V1.Value> fields, string name)
        {
            Google.Cloud.Firestore.V1.Value raw;
            return fields != null && fields.TryGetValue(name, out raw) && raw != null
                ? raw.StringValue ?? "" : "";
        }

        private void Publish()
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var snapshot = _rows.Values
                .Where(x => x.LockedUntilMs > now)
                .OrderBy(x => x.LockedUntilMs)
                .Select(x => new D173E140LockedPicker {
                    Key = x.Key, UserId = x.UserId,
                    LockedUntilMs = x.LockedUntilMs, LockLevel = x.LockLevel
                }).ToList();
            _changed(snapshot);
        }

        private static string E169SafeRole(string role)
        {
            return role == "ADMIN" ? "ADMIN" :
                role == "PICKPACK_ADMIN" ? "PICKPACK_ADMIN" : "OTHER";
        }

        private async Task Loop(CancellationToken token)
        {
            var retry = 2000;
            while (!token.IsCancellationRequested)
            {
                if (!_enabled())
                {
                    if (token.WaitHandle.WaitOne(2000)) return;
                    continue;
                }
                Channel channel = null;
                AgentSession diagnosticSession = null;
                var listenStartedAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                try
                {
                    _refreshToken();
                    var session = _session();
                    diagnosticSession = session;
                    if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                        throw new InvalidOperationException("Agent session unavailable");
                    FirestoreD157Grpc.ApplyGrpcProxyFromWindows();
                    FirestoreD157Grpc.PrepareGrpcNativeOverride();
                    channel = new Channel("firestore.googleapis.com", 443, new SslCredentials());
                    var client = new Google.Cloud.Firestore.V1.Firestore.FirestoreClient(channel);
                    using (var route = CancellationTokenSource.CreateLinkedTokenSource(token))
                    {
                        FirestoreD157Grpc.RegisterActiveRoute(route);
                        try
                        {
                            using (var stream = client.Listen(
                                FirestoreD157Grpc.Headers(session), cancellationToken: route.Token))
                            {
                                var query = new StructuredQuery
                                {
                                    Where = new StructuredQuery.Types.Filter
                                    {
                                        FieldFilter = new StructuredQuery.Types.FieldFilter
                                        {
                                            Field = new StructuredQuery.Types.FieldReference {
                                                FieldPath = "locked_until_ms"
                                            },
                                            Op = StructuredQuery.Types.FieldFilter.Types.Operator.GreaterThan,
                                            Value = new Google.Cloud.Firestore.V1.Value {
                                                IntegerValue = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                                            }
                                        }
                                    }
                                };
                                query.From.Add(new StructuredQuery.Types.CollectionSelector {
                                    CollectionId = "relay_poc_rate_limits"
                                });
                                await stream.RequestStream.WriteAsync(new ListenRequest {
                                    Database = AgentConfig.FirestoreDatabaseName,
                                    AddTarget = new Target {
                                        TargetId = 140,
                                        Query = new Target.Types.QueryTarget {
                                            Parent = AgentConfig.FirestoreDatabaseName + "/documents",
                                            StructuredQuery = query
                                        }
                                    }
                                }).ConfigureAwait(false);
                                _rows.Clear();
                                var initialized = false;
                                _log("D173_E140 PICKER_LOCK_LISTEN connected=pending");
                                while (await stream.ResponseStream.MoveNext(route.Token).ConfigureAwait(false))
                                {
                                    var response = stream.ResponseStream.Current;
                                    if (response == null) continue;
                                    var target = response.TargetChange;
                                    if (target != null && target.TargetChangeType ==
                                        TargetChange.Types.TargetChangeType.Current)
                                    {
                                        initialized = true;
                                        if (_e169ConsecutiveListenFailures > 0)
                                            _log("D173_E169 FIRESTORE_LISTEN_RECOVERED listener=PICKER_LOCKS failures=" +
                                                _e169ConsecutiveListenFailures + " elapsed_ms=" +
                                                Math.Max(0L, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - listenStartedAtMs));
                                        _e169ConsecutiveListenFailures = 0;
                                        Publish();
                                    }
                                    if (target != null && target.Cause != null && target.Cause.Code != 0)
                                        throw new RpcException(new Status(
                                            (StatusCode)target.Cause.Code,
                                            target.Cause.Message ?? "Lock listener rejected"));
                                    var change = response.DocumentChange;
                                    if (change != null && change.Document != null)
                                    {
                                        var doc = change.Document;
                                        var fields = (IDictionary<string, Google.Cloud.Firestore.V1.Value>)doc.Fields;
                                        var key = (doc.Name ?? "").Split('/').LastOrDefault() ?? "";
                                        if (key.Length == 32)
                                        {
                                            _rows[doc.Name] = new D173E140LockedPicker {
                                                Key = key,
                                                UserId = StringValue(fields, "picker_user_id"),
                                                LockedUntilMs = Number(fields, "locked_until_ms"),
                                                LockLevel = (int)Number(fields, "lock_level")
                                            };
                                            if (initialized) Publish();
                                        }
                                    }
                                    var removal = response.DocumentRemove;
                                    if (removal != null && !string.IsNullOrWhiteSpace(removal.Document))
                                    {
                                        _rows.Remove(removal.Document);
                                        if (initialized) Publish();
                                    }
                                    var deletion = response.DocumentDelete;
                                    if (deletion != null && !string.IsNullOrWhiteSpace(deletion.Document))
                                    {
                                        _rows.Remove(deletion.Document);
                                        if (initialized) Publish();
                                    }
                                    retry = 2000;
                                }
                            }
                        }
                        finally { FirestoreD157Grpc.UnregisterActiveRoute(route); }
                    }
                }
                catch (OperationCanceledException)
                {
                    if (token.IsCancellationRequested) return;
                }
                catch (RpcException ex)
                {
                    _e169ConsecutiveListenFailures++;
                    // The gRPC code proves a denial, not whether Rules, claims or query caused it.
                    // Deliberately omit RPC detail, token, UID, document names and query values.
                    _log("D173_E169 FIRESTORE_LISTEN_FAILURE listener=PICKER_LOCKS query=ACTIVE_LOCKS_GT_NOW" +
                         " collection=RELAY_POC_RATE_LIMITS" +
                         " grpc=" + ex.Status.StatusCode +
                         " role=" + E169SafeRole(diagnosticSession == null ? null : diagnosticSession.Role) +
                         " base_role=" + E169SafeRole(diagnosticSession == null ? null : diagnosticSession.BaseRole) +
                         " app_user_claim_present=" + (diagnosticSession != null &&
                            !string.IsNullOrWhiteSpace(diagnosticSession.AppUserId) ? "1" : "0") +
                         " token_expired=" + (diagnosticSession != null && diagnosticSession.ExpiresUtc <= DateTime.UtcNow ? "1" : "0") +
                         " attempt=" + _e169ConsecutiveListenFailures +
                         " elapsed_ms=" + Math.Max(0L, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - listenStartedAtMs));
                    if (ex.Status.StatusCode == StatusCode.PermissionDenied ||
                        ex.Status.StatusCode == StatusCode.FailedPrecondition ||
                        ex.Status.StatusCode == StatusCode.InvalidArgument)
                    {
                        // A permanent Firestore Rules/query rejection cannot be
                        // solved by 2-second retries. Keep the listener fail-closed.
                        retry = Math.Max(retry, 300000);
                        _log("D173_E140 PICKER_LOCK_LISTEN state=COOLDOWN grpc=" +
                            ex.Status.StatusCode + " retry_ms=" + retry);
                    }
                    else
                        _log("D173_E140 PICKER_LOCK_LISTEN state=RECONNECT grpc=" +
                            ex.Status.StatusCode);
                }
                catch (Exception ex)
                {
                    _log("D173_E140 PICKER_LOCK_LISTEN state=RECONNECT type=" +
                        ex.GetType().Name);
                }
                finally
                {
                    if (channel != null)
                        try { await channel.ShutdownAsync().ConfigureAwait(false); } catch { }
                }
                if (token.WaitHandle.WaitOne(retry)) return;
                retry = retry >= 300000 ? 300000 : Math.Min(60000, retry * 2);
            }
        }

        public void Dispose() { Stop(); }
    }
}
