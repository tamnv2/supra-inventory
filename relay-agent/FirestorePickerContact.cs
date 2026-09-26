using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class PickerContactCommand
    {
        internal string AlertId;
        internal string TargetUserId;
        internal string CommandType;
        internal string Message;
    }

    internal sealed class FirestorePickerContactClient
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly Action<string> _log;

        internal FirestorePickerContactClient(Action<string> log)
        {
            _log = log ?? delegate { };
        }

        internal Dictionary<string, PickerContactCommand> LoadOpen(AgentSession session)
        {
            EnsureSession(session);
            var query = new Dictionary<string, object>
            {
                {
                    "structuredQuery", new Dictionary<string, object>
                    {
                        { "from", new object[] { new Dictionary<string, object> { { "collectionId", "picker_alerts" } } } },
                        {
                            "where", new Dictionary<string, object>
                            {
                                {
                                    "fieldFilter", new Dictionary<string, object>
                                    {
                                        { "field", new Dictionary<string, object> { { "fieldPath", "status" } } },
                                        { "op", "IN" },
                                        { "value", new Dictionary<string, object>
                                            {
                                                { "arrayValue", new Dictionary<string, object>
                                                    {
                                                        { "values", new object[]
                                                            {
                                                                new Dictionary<string, object> { { "stringValue", "PENDING" } },
                                                                new Dictionary<string, object> { { "stringValue", "SENT" } }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        { "limit", 100 }
                    }
                }
            };

            var raw = FirestoreHttpTransport.SendJson(
                "POST",
                AgentConfig.FirestoreDocumentsBaseUrl + ":runQuery",
                session.IdToken,
                _json.Serialize(query),
                "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild,
                10000,
                true,
                _log,
                "picker-contact-open-query");

            var rows = _json.DeserializeObject(raw) as System.Collections.IEnumerable;
            var result = new Dictionary<string, PickerContactCommand>(StringComparer.Ordinal);
            if (rows == null) return result;

            foreach (var item in rows)
            {
                var row = item as Dictionary<string, object>;
                object docRaw;
                var doc = row != null && row.TryGetValue("document", out docRaw)
                    ? docRaw as Dictionary<string, object>
                    : null;
                if (doc == null) continue;
                var fields = GetMap(doc, "fields");
                var target = FieldString(fields, "target_user_id");
                var alertId = FieldString(fields, "alert_id");
                var expiresAt = FieldLong(fields, "expires_at_ms");
                if (string.IsNullOrWhiteSpace(target) || string.IsNullOrWhiteSpace(alertId)) continue;
                if (expiresAt > 0 && expiresAt <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) continue;

                result[target] = new PickerContactCommand
                {
                    AlertId = alertId,
                    TargetUserId = target,
                    CommandType = FieldString(fields, "command_type"),
                    Message = FieldString(fields, "message")
                };
            }
            return result;
        }

        internal PickerContactCommand Send(
            AgentSession session,
            string agentInstanceId,
            PickerPresenceView picker,
            string commandType)
        {
            EnsureSession(session);
            if (picker == null || string.IsNullOrWhiteSpace(picker.UserId))
                throw new InvalidOperationException("Picker không hợp lệ.");
            if (string.IsNullOrWhiteSpace(agentInstanceId))
                throw new InvalidOperationException("Agent instance id trống.");
            if (!string.Equals(commandType, "CALL_SPECIALIST", StringComparison.Ordinal) &&
                !string.Equals(commandType, "BRING_TO_PACK", StringComparison.Ordinal))
                throw new InvalidOperationException("Loại yêu cầu Picker không hợp lệ.");

            var alertId = "alert-" + Guid.NewGuid().ToString("N");
            var message = string.Equals(commandType, "CALL_SPECIALIST", StringComparison.Ordinal)
                ? "Vui lòng về bàn Chuyên viên để xử lý."
                : "Vui lòng lấy hàng về bàn Pack.";
            var expiresAtMs = DateTimeOffset.UtcNow.AddHours(6).ToUnixTimeMilliseconds();

            var fields = new Dictionary<string, object>
            {
                { "alert_id", StringField(alertId) },
                { "target_user_id", StringField(picker.UserId) },
                { "command_type", StringField(commandType) },
                { "message", StringField(message) },
                { "status", StringField("PENDING") },
                { "source", StringField("AGENT_PICKER_CONTACT_V1") },
                { "sender_user_id", StringField(session.AppUserId ?? "") },
                { "sender_agent_id", StringField(agentInstanceId) },
                { "expires_at_ms", IntField(expiresAtMs) }
            };

            FirestoreHttpTransport.SendJson(
                "PATCH",
                AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                    "/picker_alerts/" + Uri.EscapeDataString(alertId) +
                    "?currentDocument.exists=false",
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild,
                10000,
                false,
                _log,
                "picker-contact-create");

            _log("PICKER_CONTACT create=PASS target=" + Safe(picker.EmployeeCode) +
                 " command=" + commandType + " alert=" + Short(alertId));
            return new PickerContactCommand
            {
                AlertId = alertId,
                TargetUserId = picker.UserId,
                CommandType = commandType,
                Message = message
            };
        }

        internal void Resolve(AgentSession session, string agentInstanceId, PickerContactCommand command)
        {
            EnsureSession(session);
            if (command == null || string.IsNullOrWhiteSpace(command.AlertId))
                throw new InvalidOperationException("Không có yêu cầu Picker để đóng.");

            var fields = new Dictionary<string, object>
            {
                { "status", StringField("RESOLVED") },
                { "resolved_by_user_id", StringField(session.AppUserId ?? "") },
                { "resolved_by_agent_id", StringField(agentInstanceId ?? "") }
            };
            var mask =
                "?updateMask.fieldPaths=status" +
                "&updateMask.fieldPaths=resolved_by_user_id" +
                "&updateMask.fieldPaths=resolved_by_agent_id";

            FirestoreHttpTransport.SendJson(
                "PATCH",
                AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                    "/picker_alerts/" + Uri.EscapeDataString(command.AlertId) + mask,
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild,
                10000,
                false,
                _log,
                "picker-contact-resolve");

            _log("PICKER_CONTACT resolve=PASS alert=" + Short(command.AlertId));
        }

        private static void EnsureSession(AgentSession session)
        {
            var realAdmin = session != null &&
                string.Equals(session.Role, "ADMIN", StringComparison.Ordinal) &&
                string.Equals(session.BaseRole, "ADMIN", StringComparison.Ordinal);
            var realPickPackAdmin = session != null &&
                string.Equals(session.Role, "PICKPACK_ADMIN", StringComparison.Ordinal) &&
                string.Equals(session.BaseRole, "PICKPACK_ADMIN", StringComparison.Ordinal);
            if (session == null ||
                string.IsNullOrWhiteSpace(session.IdToken) ||
                string.IsNullOrWhiteSpace(session.AppUserId) ||
                (!realAdmin && !realPickPackAdmin))
                throw new InvalidOperationException("Thiếu phiên quản trị hợp lệ cho yêu cầu Picker.");
        }

        private static Dictionary<string, object> AsMap(object value)
        {
            return value as Dictionary<string, object> ?? new Dictionary<string, object>();
        }

        private static Dictionary<string, object> GetMap(Dictionary<string, object> map, string key)
        {
            if (map == null) return null;
            object value;
            return map.TryGetValue(key, out value) ? value as Dictionary<string, object> : null;
        }

        private static string FieldString(Dictionary<string, object> fields, string key)
        {
            var field = GetMap(fields, key);
            object value;
            return field != null && field.TryGetValue("stringValue", out value)
                ? Convert.ToString(value) ?? ""
                : "";
        }

        private static long FieldLong(Dictionary<string, object> fields, string key)
        {
            var field = GetMap(fields, key);
            object value;
            long parsed;
            return field != null &&
                   field.TryGetValue("integerValue", out value) &&
                   long.TryParse(Convert.ToString(value), out parsed)
                ? parsed
                : 0L;
        }

        private static Dictionary<string, object> StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> IntField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString() } };
        }

        private static string Short(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            return value.Substring(0, Math.Min(10, value.Length));
        }

        private static string Safe(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var next = value.Trim();
            return next.Length <= 48 ? next : next.Substring(0, 48);
        }
    }
}
