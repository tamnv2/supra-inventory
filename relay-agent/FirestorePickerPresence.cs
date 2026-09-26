using System;
using System.Collections;
using System.Collections.Generic;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class PickerPresenceView
    {
        internal string UserId;
        internal string EmployeeCode;
        internal string DisplayName;
        internal string DeviceId;
        internal string Status;
        internal string LoginAt;
        internal string DeviceSeenAt;
    }

    internal sealed class FirestorePickerPresenceClient
    {
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly Action<string> _log;

        internal FirestorePickerPresenceClient(Action<string> log)
        {
            _log = log;
        }

        internal List<PickerPresenceView> Load(AgentSession session)
        {
            if (session == null || string.IsNullOrWhiteSpace(session.IdToken))
                throw new InvalidOperationException("Chưa có phiên Agent để đọc danh sách Picker.");

            var raw = FirestoreHttpTransport.SendJson(
                "GET",
                AgentConfig.FirestorePickerPresenceUrl,
                session.IdToken,
                null,
                "SUPRA-Inventory-Relay-Agent/" + AgentConfig.AgentBuild,
                10000,
                true,
                _log,
                "picker-presence");

            var root = AsMap(_json.DeserializeObject(raw));
            var fields = GetMap(root, "fields");
            var schemaVersion = ReadInteger(fields, "schema_version");
            var source = ReadString(fields, "presence_source");
            if (schemaVersion != 3 || !string.Equals(source, "ACTIVE_ANDROID_EVENT_DRIVEN", StringComparison.Ordinal))
            {
                _log("PICKER_PRESENCE projection=IGNORED reason=STALE_OR_LEGACY_SCHEMA schema=" + schemaVersion);
                return new List<PickerPresenceView>();
            }
            var pickersField = GetMap(fields, "pickers");
            var array = GetMap(pickersField, "arrayValue");
            object valuesObj;
            var values = array != null && array.TryGetValue("values", out valuesObj)
                ? valuesObj as IEnumerable
                : null;

            var result = new List<PickerPresenceView>();
            if (values != null)
            {
                foreach (var rawValue in values)
                {
                    var value = rawValue as Dictionary<string, object>;
                    var mapValue = GetMap(value, "mapValue");
                    var itemFields = GetMap(mapValue, "fields");
                    if (itemFields == null) continue;

                    var userId = ReadString(itemFields, "user_id");
                    var employeeCode = ReadString(itemFields, "employee_code");
                    var displayName = ReadString(itemFields, "display_name");
                    var status = ReadString(itemFields, "status");
                    if (string.IsNullOrWhiteSpace(userId) || !string.Equals(status, "PDA_READY", StringComparison.Ordinal))
                        continue;

                    result.Add(new PickerPresenceView
                    {
                        UserId = userId,
                        EmployeeCode = employeeCode,
                        DisplayName = displayName,
                        DeviceId = ReadString(itemFields, "device_id"),
                        Status = status,
                        LoginAt = ReadString(itemFields, "login_at"),
                        DeviceSeenAt = ReadString(itemFields, "device_seen_at")
                    });
                    if (result.Count >= 2000) break;
                }
            }

            result.Sort((a, b) =>
            {
                var left = string.IsNullOrWhiteSpace(a.EmployeeCode) ? a.UserId : a.EmployeeCode;
                var right = string.IsNullOrWhiteSpace(b.EmployeeCode) ? b.UserId : b.EmployeeCode;
                var byCode = string.Compare(left, right, StringComparison.OrdinalIgnoreCase);
                return byCode != 0 ? byCode : string.Compare(a.DisplayName, b.DisplayName, StringComparison.CurrentCultureIgnoreCase);
            });

            return result;
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

        private static string ReadString(Dictionary<string, object> fields, string key)
        {
            var field = GetMap(fields, key);
            if (field == null) return "";
            object value;
            if (field.TryGetValue("stringValue", out value)) return Convert.ToString(value) ?? "";
            if (field.ContainsKey("nullValue")) return "";
            return "";
        }

        private static int ReadInteger(Dictionary<string, object> fields, string key)
        {
            var field = GetMap(fields, key);
            if (field == null) return 0;
            object value;
            int parsed;
            return field.TryGetValue("integerValue", out value) &&
                   int.TryParse(Convert.ToString(value), out parsed)
                ? parsed
                : 0;
        }
    }
}
