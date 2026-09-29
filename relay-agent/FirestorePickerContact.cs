using System;
using System.Collections;
using System.Collections.Generic;
using System.Net;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class PickerContactCommand
    {
        internal string AlertId;
        internal string TargetUserId;
        internal string CommandType;
        internal string Message;
        internal string SenderAgentId;
        internal string SenderRole;
        internal string UpdateTime;
        internal bool IsActiveCall;
        internal long LockUntilMs;
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
            var result = LoadActiveCalls(session);
            LoadLegacyAlerts(session, result);
            return result;
        }

        private Dictionary<string, PickerContactCommand> LoadActiveCalls(AgentSession session)
        {
            var result = new Dictionary<string, PickerContactCommand>(StringComparer.Ordinal);
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var query = new Dictionary<string, object>
            {
                {
                    "structuredQuery", new Dictionary<string, object>
                    {
                        { "from", new object[] { new Dictionary<string, object> { { "collectionId", "picker_active_calls" } } } },
                        {
                            "where", new Dictionary<string, object>
                            {
                                {
                                    "fieldFilter", new Dictionary<string, object>
                                    {
                                        { "field", new Dictionary<string, object> { { "fieldPath", "lock_until_ms" } } },
                                        { "op", "GREATER_THAN" },
                                        { "value", IntField(nowMs) }
                                    }
                                }
                            }
                        },
                        {
                            "orderBy", new object[]
                            {
                                new Dictionary<string, object>
                                {
                                    { "field", new Dictionary<string, object> { { "fieldPath", "lock_until_ms" } } },
                                    { "direction", "ASCENDING" }
                                }
                            }
                        },
                        { "limit", 500 }
                    }
                }
            };

            var raw = FirestoreHttpTransport.SendJson(
                "POST",
                AgentConfig.FirestoreDocumentsBaseUrl + ":runQuery",
                session.IdToken,
                _json.Serialize(query),
                UserAgent(),
                10000,
                true,
                _log,
                "picker-active-call-fresh-query");
            var rows = _json.DeserializeObject(raw) as IEnumerable;
            if (rows == null) return result;

            var returnedDocuments = 0;
            foreach (var item in rows)
            {
                var row = item as Dictionary<string, object>;
                var doc = row == null ? null : GetMap(row, "document");
                if (doc == null) continue;
                returnedDocuments++;
                var fields = GetMap(doc, "fields");
                if (fields == null || !string.Equals(FieldString(fields, "status"), "ACTIVE", StringComparison.Ordinal))
                    continue;
                var lockUntilMs = FieldLong(fields, "lock_until_ms");
                if (lockUntilMs <= nowMs) continue;
                var target = FieldString(fields, "target_user_id");
                var callId = FieldString(fields, "call_id");
                if (string.IsNullOrWhiteSpace(target) || string.IsNullOrWhiteSpace(callId)) continue;
                result[target] = new PickerContactCommand
                {
                    AlertId = callId,
                    TargetUserId = target,
                    CommandType = "CALL_SPECIALIST",
                    Message = FieldString(fields, "message"),
                    SenderAgentId = FieldString(fields, "sender_agent_id"),
                    SenderRole = FieldString(fields, "sender_role"),
                    UpdateTime = Get(doc, "updateTime"),
                    IsActiveCall = true,
                    LockUntilMs = lockUntilMs
                };
            }
            FirestoreQuotaGuard.RecordReadDocuments(returnedDocuments, "picker-active-call-fresh-query", _log);
            return result;
        }

        private void LoadLegacyAlerts(
            AgentSession session,
            Dictionary<string, PickerContactCommand> result)
        {
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
                                                                StringField("PENDING"),
                                                                StringField("SENT")
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
                UserAgent(),
                10000,
                true,
                _log,
                "picker-contact-open-query");
            var rows = _json.DeserializeObject(raw) as IEnumerable;
            if (rows == null) return;

            var returnedDocuments = 0;
            foreach (var item in rows)
            {
                var row = item as Dictionary<string, object>;
                var doc = row == null ? null : GetMap(row, "document");
                var fields = GetMap(doc, "fields");
                if (fields == null) continue;
                var target = FieldString(fields, "target_user_id");
                var alertId = FieldString(fields, "alert_id");
                var commandType = FieldString(fields, "command_type");
                if (string.Equals(commandType, "CHAT_MESSAGE", StringComparison.Ordinal)) continue;
                var expiresAt = FieldLong(fields, "expires_at_ms");
                if (string.IsNullOrWhiteSpace(target) || string.IsNullOrWhiteSpace(alertId)) continue;
                if (expiresAt > 0 && expiresAt <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) continue;
                if (result.ContainsKey(target)) continue;
                returnedDocuments++;
                result[target] = new PickerContactCommand
                {
                    AlertId = alertId,
                    TargetUserId = target,
                    CommandType = commandType,
                    Message = FieldString(fields, "message"),
                    SenderAgentId = FieldString(fields, "sender_agent_id"),
                    SenderRole = "",
                    UpdateTime = Get(doc, "updateTime"),
                    IsActiveCall = false
                };
            }
            FirestoreQuotaGuard.RecordReadDocuments(returnedDocuments, "picker-contact-open-query", _log);
        }

        internal PickerContactCommand Send(
            AgentSession session,
            string agentInstanceId,
            PickerPresenceView picker,
            string commandType,
            string message = "")
        {
            EnsureSession(session);
            if (picker == null || string.IsNullOrWhiteSpace(picker.UserId))
                throw new InvalidOperationException("Picker không hợp lệ.");
            if (string.IsNullOrWhiteSpace(agentInstanceId))
                throw new InvalidOperationException("Agent instance id trống.");

            if (string.Equals(commandType, "CALL_SPECIALIST", StringComparison.Ordinal))
                return SendActiveCall(session, agentInstanceId, picker);
            if (string.Equals(commandType, "BRING_TO_PACK", StringComparison.Ordinal))
                return SendLegacyPack(session, agentInstanceId, picker);
            if (string.Equals(commandType, "CHAT_MESSAGE", StringComparison.Ordinal))
                return SendChatMessage(session, agentInstanceId, picker, message);
            throw new InvalidOperationException("Loại yêu cầu Picker không hợp lệ.");
        }

        private PickerContactCommand SendActiveCall(
            AgentSession session,
            string agentInstanceId,
            PickerPresenceView picker)
        {
            var callId = "call-" + Guid.NewGuid().ToString("N");
            var senderRole = string.Equals(session.Role, "PICKPACK_ADMIN", StringComparison.Ordinal)
                ? "PICK_PACK"
                : "INVENTORY";
            var message = senderRole == "PICK_PACK"
                ? "Vui lòng di chuyển về bàn chuyên viên Pick Pack để phối hợp xử lý công việc."
                : "Vui lòng di chuyển về bàn chuyên viên Inventory để phối hợp xử lý công việc.";
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var lockUntilMs = nowMs + 60000L;
            var updateTime = "";

            try
            {
                var existingRaw = FirestoreHttpTransport.SendJson(
                    "GET", ActiveCallUrl(picker.UserId), session.IdToken, null,
                    UserAgent(), 7000, true, _log, "picker-active-call-read", 2);
                var existingDoc = _json.DeserializeObject(existingRaw) as Dictionary<string, object>;
                var existingFields = GetMap(existingDoc, "fields");
                var status = FieldString(existingFields, "status");
                var existingLock = FieldLong(existingFields, "lock_until_ms");
                if (string.Equals(status, "ACTIVE", StringComparison.Ordinal) && existingLock > nowMs)
                    throw new InvalidOperationException("Picker này đang trong thời gian Liên hệ picker 60 giây.");
                updateTime = Get(existingDoc, "updateTime");
            }
            catch (WebException ex)
            {
                var status = Status(ex);
                if (status != 404) throw;
            }

            var fields = new Dictionary<string, object>
            {
                { "call_id", StringField(callId) },
                { "target_user_id", StringField(picker.UserId) },
                { "command_type", StringField("CALL_SPECIALIST") },
                { "message", StringField(message) },
                { "status", StringField("ACTIVE") },
                { "source", StringField("AGENT_PICKER_ACTIVE_CALL_V2") },
                { "sender_user_id", StringField(session.AppUserId ?? "") },
                { "sender_agent_id", StringField(agentInstanceId) },
                { "sender_role", StringField(senderRole) },
                { "created_at_ms", IntField(nowMs) },
                { "lock_until_ms", IntField(lockUntilMs) }
            };

            var suffix = BuildMask(fields.Keys);
            suffix += string.IsNullOrWhiteSpace(updateTime)
                ? "&currentDocument.exists=false"
                : "&currentDocument.updateTime=" + Uri.EscapeDataString(updateTime);
            try
            {
                var raw = FirestoreHttpTransport.SendJson(
                    "PATCH", ActiveCallUrl(picker.UserId) + suffix, session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    UserAgent(), 10000, false, _log, "picker-active-call-upsert");
                var written = _json.DeserializeObject(raw) as Dictionary<string, object>;
                _log("PICKER_ACTIVE_CALL upsert=PASS target=" + Safe(picker.EmployeeCode) +
                     " role=" + senderRole + " call=" + Short(callId) + " lock_ms=60000");
                return new PickerContactCommand
                {
                    AlertId = callId,
                    TargetUserId = picker.UserId,
                    CommandType = "CALL_SPECIALIST",
                    Message = message,
                    SenderAgentId = agentInstanceId,
                    SenderRole = senderRole,
                    UpdateTime = Get(written, "updateTime"),
                    IsActiveCall = true,
                    LockUntilMs = lockUntilMs
                };
            }
            catch (WebException ex)
            {
                var status = Status(ex);
                if (status == 409 || status == 412)
                    throw new InvalidOperationException("Trạng thái Liên hệ picker vừa thay đổi trên Agent khác. Vui lòng thử lại.");
                throw;
            }
        }

        private PickerContactCommand SendChatMessage(
            AgentSession session,
            string agentInstanceId,
            PickerPresenceView picker,
            string requestedMessage)
        {
            var message = (requestedMessage ?? "").Trim();
            if (message.Length == 0) throw new InvalidOperationException("Nội dung thông báo không được để trống.");
            if (message.Length > 200) throw new InvalidOperationException("Nội dung thông báo tối đa 200 ký tự.");
            if (string.IsNullOrWhiteSpace(picker.FirebaseUid))
                throw new InvalidOperationException("Picker chưa có Firebase UID để nhận thông báo trực tiếp.");

            var alertId = "alert-" + Guid.NewGuid().ToString("N");
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var expiresAtMs = nowMs + 30L * 60L * 1000L;
            var senderRole = string.Equals(session.Role, "PICKPACK_ADMIN", StringComparison.Ordinal)
                ? "PICK_PACK"
                : "INVENTORY";

            // D144 authoritative realtime delivery: write the current chat onto the
            // same per-Picker control document already listened to by Android.
            // This avoids the D143 FCM-only gap while keeping zero Picker ACK writes.
            var directFields = new Dictionary<string, object>
            {
                { "firebase_uid", StringField(picker.FirebaseUid) },
                { "user_id", StringField(picker.UserId) },
                { "chat_id", StringField(alertId) },
                { "chat_command_type", StringField("CHAT_MESSAGE") },
                { "chat_message", StringField(message) },
                { "chat_sender_user_id", StringField(session.AppUserId ?? "") },
                { "chat_sender_agent_id", StringField(agentInstanceId) },
                { "chat_sender_role", StringField(senderRole) },
                { "chat_created_at_ms", IntField(nowMs) },
                { "chat_expires_at_ms", IntField(expiresAtMs) }
            };
            FirestoreHttpTransport.SendJson(
                "PATCH",
                AgentConfig.FirestorePickerSessionControlBaseUrl + "/" +
                    Uri.EscapeDataString(picker.FirebaseUid) + BuildMask(directFields.Keys),
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", directFields } }),
                UserAgent(),
                10000,
                false,
                _log,
                "picker-chat-direct");

            // Keep the D143 FCM path as a compatibility fast-path for already
            // installed vc84 clients. New clients deduplicate the same alert id locally.
            var legacyFields = new Dictionary<string, object>
            {
                { "alert_id", StringField(alertId) },
                { "target_user_id", StringField(picker.UserId) },
                { "command_type", StringField("CHAT_MESSAGE") },
                { "message", StringField(message) },
                { "status", StringField("PENDING") },
                { "source", StringField("AGENT_PICKER_CONTACT_V1") },
                { "sender_user_id", StringField(session.AppUserId ?? "") },
                { "sender_agent_id", StringField(agentInstanceId) },
                { "expires_at_ms", IntField(expiresAtMs) }
            };
            var legacy = "SKIPPED";
            try
            {
                FirestoreHttpTransport.SendJson(
                    "PATCH",
                    AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                        "/picker_alerts/" + Uri.EscapeDataString(alertId) +
                        "?currentDocument.exists=false",
                    session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", legacyFields } }),
                    UserAgent(),
                    10000,
                    false,
                    _log,
                    "picker-chat-fcm-fallback");
                legacy = "PASS";
            }
            catch (Exception ex)
            {
                legacy = "DEFERRED";
                _log("PICKER_CHAT fcm_fallback=DEFERRED reason=" + Safe(ex.Message));
            }

            _log("PICKER_CHAT direct=PASS fcm_fallback=" + legacy +
                 " target=" + Safe(picker.EmployeeCode) + " chars=" + message.Length);
            return new PickerContactCommand
            {
                AlertId = alertId,
                TargetUserId = picker.UserId,
                CommandType = "CHAT_MESSAGE",
                Message = message,
                SenderAgentId = agentInstanceId,
                SenderRole = senderRole,
                UpdateTime = "",
                IsActiveCall = false
            };
        }

        private PickerContactCommand SendLegacyPack(
            AgentSession session,
            string agentInstanceId,
            PickerPresenceView picker)
        {
            var alertId = "alert-" + Guid.NewGuid().ToString("N");
            const string message = "Vui lòng mang hàng về bàn Pack theo yêu cầu của chuyên viên.";
            var expiresAtMs = DateTimeOffset.UtcNow.AddHours(6).ToUnixTimeMilliseconds();
            var fields = new Dictionary<string, object>
            {
                { "alert_id", StringField(alertId) },
                { "target_user_id", StringField(picker.UserId) },
                { "command_type", StringField("BRING_TO_PACK") },
                { "message", StringField(message) },
                { "status", StringField("PENDING") },
                { "source", StringField("AGENT_PICKER_CONTACT_V1") },
                { "sender_user_id", StringField(session.AppUserId ?? "") },
                { "sender_agent_id", StringField(agentInstanceId) },
                { "expires_at_ms", IntField(expiresAtMs) }
            };
            var raw = FirestoreHttpTransport.SendJson(
                "PATCH",
                AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                    "/picker_alerts/" + Uri.EscapeDataString(alertId) +
                    "?currentDocument.exists=false",
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                UserAgent(),
                10000,
                false,
                _log,
                "picker-contact-create");
            var written = _json.DeserializeObject(raw) as Dictionary<string, object>;
            return new PickerContactCommand
            {
                AlertId = alertId,
                TargetUserId = picker.UserId,
                CommandType = "BRING_TO_PACK",
                Message = message,
                SenderAgentId = agentInstanceId,
                UpdateTime = Get(written, "updateTime"),
                IsActiveCall = false
            };
        }

        internal void Resolve(AgentSession session, string agentInstanceId, PickerContactCommand command)
        {
            EnsureSession(session);
            if (command == null || string.IsNullOrWhiteSpace(command.AlertId))
                throw new InvalidOperationException("Không có yêu cầu Picker để đóng.");

            if (command.IsActiveCall)
            {
                if (!string.Equals(command.SenderAgentId, agentInstanceId, StringComparison.Ordinal))
                    throw new InvalidOperationException("Chỉ Agent đã gọi Picker mới được kết thúc yêu cầu.");
                ResolveActiveCall(session, agentInstanceId, command);
                return;
            }

            var fields = new Dictionary<string, object>
            {
                { "status", StringField("RESOLVED") },
                { "resolved_by_user_id", StringField(session.AppUserId ?? "") },
                { "resolved_by_agent_id", StringField(agentInstanceId ?? "") }
            };
            FirestoreHttpTransport.SendJson(
                "PATCH",
                AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                    "/picker_alerts/" + Uri.EscapeDataString(command.AlertId) + BuildMask(fields.Keys),
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                UserAgent(),
                10000,
                false,
                _log,
                "picker-contact-resolve");
        }

        private void ResolveActiveCall(
            AgentSession session,
            string agentInstanceId,
            PickerContactCommand command)
        {
            var fields = new Dictionary<string, object>
            {
                { "status", StringField("RESOLVED") },
                { "resolved_by_user_id", StringField(session.AppUserId ?? "") },
                { "resolved_by_agent_id", StringField(agentInstanceId ?? "") },
                { "resolved_at_ms", IntField(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) }
            };
            var suffix = BuildMask(fields.Keys);
            if (!string.IsNullOrWhiteSpace(command.UpdateTime))
                suffix += "&currentDocument.updateTime=" + Uri.EscapeDataString(command.UpdateTime);
            FirestoreHttpTransport.SendJson(
                "PATCH",
                ActiveCallUrl(command.TargetUserId) + suffix,
                session.IdToken,
                _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                UserAgent(),
                10000,
                false,
                _log,
                "picker-active-call-resolve");
            _log("PICKER_ACTIVE_CALL resolve=PASS call=" + Short(command.AlertId));
        }

        private static string ActiveCallUrl(string targetUserId)
        {
            return AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                "/picker_active_calls/" + Uri.EscapeDataString(targetUserId ?? "");
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
            return field != null && field.TryGetValue("integerValue", out value) &&
                long.TryParse(Convert.ToString(value), out parsed) ? parsed : 0L;
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
            var first = true;
            var value = "?";
            foreach (var field in fields)
            {
                if (!first) value += "&";
                first = false;
                value += "updateMask.fieldPaths=" + Uri.EscapeDataString(field);
            }
            return value;
        }

        private static string Get(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value)
                ? Convert.ToString(value) ?? ""
                : "";
        }

        private static int Status(WebException ex)
        {
            var response = ex == null ? null : ex.Response as HttpWebResponse;
            if (response == null) return 0;
            var status = (int)response.StatusCode;
            try { response.Dispose(); } catch { }
            return status;
        }

        private static string UserAgent()
        {
            return "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild;
        }

        private static string Short(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            return value.Substring(0, Math.Min(10, value.Length));
        }

        private static string Safe(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var next = AgentDiagnostics.Sanitize(value);
            return next.Length <= 48 ? next : next.Substring(0, 48);
        }
    }
}
