using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    // D165: RTDB carries only ephemeral HA liveness. Firestore role/generation
    // remains authoritative and is always re-checked before takeover/WMS mutation.
    internal sealed class RtdbHaLiveness : IDisposable
    {
        private const string Path = "/relay_poc/coordination/ha_liveness.json";
        private readonly string _instanceId;
        private readonly Action<string> _log;
        private readonly Action _updated;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly object _gate = new object();

        private CancellationTokenSource _observerCts;
        private Thread _observerThread;
        private string _observerToken = "";
        private string _expectedGeneration = "";
        private string _expectedPrimary = "";
        private string _primaryId = "";
        private string _generation = "";
        private long _heartbeatAtMs;
        private bool _lastWriteHealthy = true;
        private bool _lastStreamHealthy = true;

        internal RtdbHaLiveness(string instanceId, Action<string> log, Action updated)
        {
            _instanceId = instanceId ?? "";
            _log = log ?? delegate { };
            _updated = updated ?? delegate { };
        }

        internal bool WriteHeartbeat(AgentSession session, string generation)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken) ||
                string.IsNullOrWhiteSpace(generation) || string.IsNullOrWhiteSpace(_instanceId))
                return false;

            var now = NowMs();
            var payload = _json.Serialize(new Dictionary<string, object>
            {
                { "agent_instance_id", _instanceId },
                { "agent_admin_user_id", session.AppUserId ?? session.UserId ?? "" },
                { "generation", generation ?? "" },
                { "heartbeat_at_ms", now },
                { "wms_ready", true }
            });

            try
            {
                var request = CreateRequest("PUT", session.IdToken, 4500);
                var bytes = Encoding.UTF8.GetBytes(payload);
                request.ContentLength = bytes.Length;
                using (var output = request.GetRequestStream())
                    output.Write(bytes, 0, bytes.Length);
                using (var response = (HttpWebResponse)request.GetResponse())
                using (var stream = response.GetResponseStream())
                using (var reader = stream == null ? null : new StreamReader(stream))
                {
                    if (reader != null) reader.ReadToEnd();
                }
                if (!_lastWriteHealthy)
                    _log("RTDB HA liveness write recovered.");
                _lastWriteHealthy = true;
                lock (_gate)
                {
                    _primaryId = _instanceId;
                    _generation = generation ?? "";
                    _heartbeatAtMs = now;
                }
                return true;
            }
            catch (Exception ex)
            {
                if (_lastWriteHealthy)
                    _log("RTDB HA liveness unavailable; Firestore lease fallback active type=" + ex.GetType().Name +
                         " reason=" + SafeFailureCode(ex));
                _lastWriteHealthy = false;
                return false;
            }
        }

        internal void EnsureObserver(AgentSession session, string generation, string primaryId)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken) ||
                string.IsNullOrWhiteSpace(generation) || string.IsNullOrWhiteSpace(primaryId))
            {
                StopObserver();
                return;
            }

            lock (_gate)
            {
                if (_observerThread != null && _observerThread.IsAlive &&
                    string.Equals(_observerToken, session.IdToken, StringComparison.Ordinal) &&
                    string.Equals(_expectedGeneration, generation ?? "", StringComparison.Ordinal) &&
                    string.Equals(_expectedPrimary, primaryId ?? "", StringComparison.Ordinal))
                    return;
            }

            StopObserver();
            var cts = new CancellationTokenSource();
            var token = session.IdToken;
            lock (_gate)
            {
                _observerCts = cts;
                _observerToken = token;
                _expectedGeneration = generation ?? "";
                _expectedPrimary = primaryId ?? "";
                _heartbeatAtMs = 0;
                _generation = "";
                _primaryId = "";
            }
            var thread = new Thread(() => ObserveLoop(token, cts.Token))
            {
                IsBackground = true,
                Name = "SUPRA-RTDB-HA-Liveness"
            };
            lock (_gate) _observerThread = thread;
            thread.Start();
        }

        internal bool TryGetFresh(string expectedGeneration, string expectedPrimary, out long ageMs)
        {
            string generation;
            string primary;
            long heartbeat;
            lock (_gate)
            {
                generation = _generation ?? "";
                primary = _primaryId ?? "";
                heartbeat = _heartbeatAtMs;
            }
            ageMs = heartbeat <= 0 ? long.MaxValue : Math.Max(0L, NowMs() - heartbeat);
            return heartbeat > 0 &&
                   string.Equals(generation, expectedGeneration ?? "", StringComparison.Ordinal) &&
                   string.Equals(primary, expectedPrimary ?? "", StringComparison.Ordinal) &&
                   ageMs < FirestoreAgentLeaderCoordinator.FailoverAfterMs;
        }

        internal void StopObserver()
        {
            CancellationTokenSource cts;
            Thread thread;
            lock (_gate)
            {
                cts = _observerCts;
                thread = _observerThread;
                _observerCts = null;
                _observerThread = null;
                _observerToken = "";
                _expectedGeneration = "";
                _expectedPrimary = "";
            }
            try { if (cts != null) cts.Cancel(); } catch { }
            try { if (thread != null && thread.IsAlive) thread.Join(250); } catch { }
            try { if (cts != null) cts.Dispose(); } catch { }
        }

        private void ObserveLoop(string idToken, CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    var request = CreateRequest("GET", idToken, 15000);
                    request.Accept = "text/event-stream";
                    request.ReadWriteTimeout = 25000;
                    using (var response = (HttpWebResponse)request.GetResponse())
                    using (var stream = response.GetResponseStream())
                    using (var reader = stream == null ? null : new StreamReader(stream))
                    {
                        if (reader == null) throw new IOException("RTDB stream unavailable.");
                        if (!_lastStreamHealthy)
                            _log("RTDB HA realtime observer recovered.");
                        _lastStreamHealthy = true;
                        while (!token.IsCancellationRequested)
                        {
                            var line = reader.ReadLine();
                            if (line == null) break;
                            if (!line.StartsWith("data:", StringComparison.Ordinal)) continue;
                            ApplyStreamData(line.Substring(5).Trim());
                        }
                    }
                }
                catch (Exception ex)
                {
                    if (token.IsCancellationRequested) return;
                    if (_lastStreamHealthy)
                    {
                        _log("RTDB HA realtime observer unavailable; Firestore lease fallback armed type=" + ex.GetType().Name +
                             " reason=" + SafeFailureCode(ex));
                        _lastStreamHealthy = false;
                        // Only signal on HEALTHY -> UNAVAILABLE. Repeated failed SSE retries
                        // must not wake the HA coordinator into an extra Firestore lease GET.
                        try { _updated(); } catch { }
                    }
                    if (token.WaitHandle.WaitOne(1000)) return;
                }
            }
        }

        private void ApplyStreamData(string raw)
        {
            try
            {
                var envelope = _json.DeserializeObject(raw) as Dictionary<string, object>;
                object dataObj;
                var data = envelope != null && envelope.TryGetValue("data", out dataObj)
                    ? dataObj as Dictionary<string, object>
                    : null;
                if (data == null) return;

                var primary = ReadString(data, "agent_instance_id");
                var generation = ReadString(data, "generation");
                var heartbeat = ReadLong(data, "heartbeat_at_ms");
                lock (_gate)
                {
                    _primaryId = primary;
                    _generation = generation;
                    _heartbeatAtMs = heartbeat;
                }
                try { _updated(); } catch { }
            }
            catch
            {
                // A malformed/non-data SSE frame is not authority. NEXT_A falls
                // back to Firestore if no valid fresh heartbeat is available.
            }
        }

        private static string ReadString(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) && value != null ? Convert.ToString(value) ?? "" : "";
        }

        private static long ReadLong(Dictionary<string, object> map, string key)
        {
            object value;
            if (map == null || !map.TryGetValue(key, out value) || value == null) return 0;
            try { return Convert.ToInt64(value); } catch { return 0; }
        }

        private static HttpWebRequest CreateRequest(string method, string idToken, int timeoutMs)
        {
            var root = AgentConfig.DatabaseUrl.TrimEnd('/');
            var url = root + Path + "?auth=" + Uri.EscapeDataString(idToken ?? "");
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = method;
            request.Accept = "application/json";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild;
            request.Timeout = timeoutMs;
            request.ReadWriteTimeout = timeoutMs;
            request.KeepAlive = true;
            try
            {
                var proxy = WebRequest.DefaultWebProxy;
                if (proxy != null)
                {
                    proxy.Credentials = CredentialCache.DefaultNetworkCredentials;
                    request.Proxy = proxy;
                }
            }
            catch { }
            return request;
        }

        // Diagnostic category only: never expose request URLs, query-string ID tokens,
        // transport exception messages or serialized authentication material.
        private static string SafeFailureCode(Exception error)
        {
            var web = error as WebException;
            if (web != null)
            {
                var response = web.Response as HttpWebResponse;
                if (response != null) return "HTTP_" + (int)response.StatusCode;
                return "NETWORK_" + web.Status;
            }
            return error == null ? "UNKNOWN" : error.GetType().Name;
        }

        private static long NowMs()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }

        public void Dispose()
        {
            StopObserver();
        }
    }
}
