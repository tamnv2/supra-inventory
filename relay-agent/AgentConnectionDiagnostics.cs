using System;
using System.Collections.Generic;
using System.Net;

namespace SupraInventoryRelayAgent
{
    // Agent-only local diagnostics. Never makes network calls, carries tokens or changes HA authority.
    internal static class AgentConnectionDiagnostics
    {
        private sealed class Incident
        {
            internal string Reason;
            internal long StartedMs;
            internal long LastNoticeMs;
            internal int Repeated;
        }

        private static readonly object Gate = new object();
        private static readonly Dictionary<string, Incident> Incidents =
            new Dictionary<string, Incident>(StringComparer.Ordinal);
        private const long SummaryIntervalMs = 10L * 60L * 1000L;

        internal static string Reason(Exception error)
        {
            for (var current = error; current != null; current = current.InnerException)
            {
                var web = current as WebException;
                if (web != null)
                {
                    var response = web.Response as HttpWebResponse;
                    var status = response == null ? 0 : (int)response.StatusCode;
                    if (status == 401) return "HTTP_401_AUTH";
                    if (status == 403) return "HTTP_403_PERMISSION";
                    if (status == 429) return "HTTP_429_LIMIT";
                    if (status >= 500) return "HTTP_5XX_PROVIDER";
                    if (web.Status == WebExceptionStatus.NameResolutionFailure ||
                        web.Status == WebExceptionStatus.ProxyNameResolutionFailure)
                        return "NETWORK_DNS";
                    if (web.Status == WebExceptionStatus.Timeout) return "NETWORK_TIMEOUT";
                    if (web.Status == WebExceptionStatus.ConnectFailure ||
                        web.Status == WebExceptionStatus.KeepAliveFailure ||
                        web.Status == WebExceptionStatus.ConnectionClosed)
                        return "NETWORK_CONNECTIVITY";
                    return status > 0 ? "HTTP_" + status : "NETWORK_TRANSPORT";
                }
                if (current is TimeoutException) return "NETWORK_TIMEOUT";
                if (current is InvalidOperationException &&
                    (string.Equals(current.Message, "Chưa đăng nhập Agent.", StringComparison.Ordinal) ||
                     string.Equals(current.Message, "D167_SKU_AGENT_SESSION_REQUIRED", StringComparison.Ordinal)))
                    return "SESSION_REQUIRED";
            }
            return "OTHER_" + (error == null ? "UNKNOWN" : error.GetType().Name);
        }

        // True means emit the existing detail log; repeated identical errors are summarized locally.
        internal static bool ShouldLogFailure(string component, Exception error, Action<string> log)
        {
            if (string.IsNullOrEmpty(component)) return true;
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var reason = Reason(error);
            string notice = null;
            var emitDetail = false;
            lock (Gate)
            {
                Incident incident;
                if (!Incidents.TryGetValue(component, out incident) ||
                    !string.Equals(incident.Reason, reason, StringComparison.Ordinal))
                {
                    if (incident != null)
                        notice = "AGENT INCIDENT status=CHANGED component=" + component +
                            " previous_reason=" + incident.Reason +
                            " duration_ms=" + Math.Max(0L, now - incident.StartedMs) +
                            " repeat=" + incident.Repeated;
                    Incidents[component] = new Incident
                    {
                        Reason = reason,
                        StartedMs = now,
                        LastNoticeMs = now,
                        Repeated = 0
                    };
                    emitDetail = true;
                }
                else
                {
                    incident.Repeated++;
                    if (now - incident.LastNoticeMs >= SummaryIntervalMs)
                    {
                        notice = "AGENT INCIDENT status=ONGOING component=" + component +
                            " reason=" + reason +
                            " duration_ms=" + Math.Max(0L, now - incident.StartedMs) +
                            " repeat=" + incident.Repeated;
                        incident.LastNoticeMs = now;
                        incident.Repeated = 0;
                        emitDetail = true;
                    }
                }
            }
            if (notice != null && log != null) log(notice);
            return emitDetail;
        }

        internal static void Recovered(string component, Action<string> log)
        {
            Incident old = null;
            lock (Gate)
            {
                if (Incidents.TryGetValue(component, out old))
                    Incidents.Remove(component);
            }
            if (old == null || log == null) return;
            var elapsed = Math.Max(0L, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - old.StartedMs);
            log("AGENT INCIDENT status=RECOVERED component=" + component +
                " reason=" + old.Reason +
                " duration_ms=" + elapsed + " repeat=" + old.Repeated);
        }
    }
}
