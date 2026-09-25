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
