using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    // D173: read-only Reporter projection, NEVER accepted as PickerPresenceView.
    internal sealed class ReporterOnlineView
    {
        internal string EmployeeCode;
        internal string DisplayName;
        internal string Channel;
        internal string AppVersion;
        internal string Role = "REPORTER";
    }

    internal sealed class D173ReporterPresenceClient
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly Action<string> _log;
        internal D173ReporterPresenceClient(Action<string> log) { _log = log; }

        internal List<ReporterOnlineView> Load(AgentSession session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("AGENT_SESSION_REQUIRED");
            var raw = FirestoreHttpTransport.SendJson(
                "GET", AgentConfig.ApiBaseUrl + "/api/agent/d173/reporter-online",
                session.IdToken, null,
                "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild,
                10000, false, _log, "reporter-online", 1);
            var payload = _json.DeserializeObject(raw) as Dictionary<string, object>;
            if (payload == null || !payload.ContainsKey("schema_version") ||
                Convert.ToInt32(payload["schema_version"]) != 1 ||
                !payload.ContainsKey("source") ||
                !string.Equals(Convert.ToString(payload["source"]), "AUTHENTICATED_REALTIME_SOCKET", StringComparison.Ordinal))
                throw new InvalidOperationException("REPORTER_PRESENCE_INVALID_SOURCE");
            var rows = new List<ReporterOnlineView>();
            // New additive v1 sessions are typed Inventory WebSocket connections.
            // Only these authenticated attachments count; never read Firebase
            // user records or foreign app logins to infer online status.
            var sessions = payload.ContainsKey("sessions") ? payload["sessions"] as IEnumerable : null;
            if (sessions != null)
            {
                foreach (var value in sessions)
                {
                    var row = value as Dictionary<string, object>;
                    if (row == null) continue;
                    Func<string,string> valueOf = key =>
                        row.ContainsKey(key) ? Convert.ToString(row[key]) ?? "" : "";
                    var role = valueOf("role").Trim().ToUpperInvariant();
                    var channel = valueOf("channel").Trim().ToUpperInvariant();
                    var code = valueOf("employee_code").Trim();
                    var name = valueOf("display_name").Trim();
                    var version = valueOf("app_version").Trim();
                    if (!new[] { "PICKER", "REPORTER", "ADMIN", "PICKPACK_ADMIN", "ROOT" }.Contains(role)
                        || !new[] { "WEB", "ANDROID" }.Contains(channel)
                        || (role == "PICKER" && channel == "ANDROID")
                        || code.Length > 36 || name.Length > 96 || version.Length > 24
                        || (code.Length == 0 && name.Length == 0)) continue;
                    rows.Add(new ReporterOnlineView {
                        EmployeeCode = code, DisplayName = name,
                        Channel = channel, AppVersion = version,
                        Role = role
                    });
                    if (rows.Count >= 150) break;
                }
                return rows;
            }
            var values = payload.ContainsKey("reporters") ? payload["reporters"] as IEnumerable : null;
            if (values == null) throw new InvalidOperationException("REPORTER_PRESENCE_INVALID_ROWS");
            foreach (var value in values)
            {
                var row = value as Dictionary<string, object>;
                if (row == null) continue;
                Func<string,string> field = key => row.ContainsKey(key) ? Convert.ToString(row[key]) ?? "" : "";
                var code = field("employee_code").Trim();
                var name = field("display_name").Trim();
                var channel = field("channel");
                if (code.Length > 36 || name.Length > 96 ||
                    (channel != "ANDROID" && channel != "WEB" && channel != "ANDROID+WEB"))
                    continue;
                if (code.Length == 0 && name.Length == 0) continue;
                var android = field("android_version").Trim();
                var web = field("web_version").Trim();
                if (android.Length > 24 || web.Length > 24) continue;
                var version = string.Join(" / ", new[] {
                    android.Length > 0 ? android : null,
                    web.Length > 0 ? "Web " + web : null
                }.Where(x => !string.IsNullOrWhiteSpace(x)));
                rows.Add(new ReporterOnlineView { EmployeeCode = code, DisplayName = name, Channel = channel, AppVersion = version });
                if (rows.Count >= 100) break;
            }
            return rows;
        }
    }
}
