using System;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;

namespace SupraInventoryRelayAgent
{
    // D173-E103: in-process activity projection. Never call a provider or publish
    // these records to Firestore/Worker; they are strictly observations already
    // delivered by the existing Agent transport.
    internal sealed partial class AgentForm
    {
        private sealed class D173LocalActivity
        {
            internal long Generation;
            internal long TimeMs;
            internal string RequestId = "";
            internal string Label = "";
            internal bool Terminal;
        }

        private readonly Dictionary<string, D173LocalActivity> _d173PickerActivities =
            new Dictionary<string, D173LocalActivity>(StringComparer.Ordinal);
        private long _d173AgentActivityTimeMs;
        private string _d173AgentActivityUserId = "";
        private string _d173AgentActivityLabel = "";

        private static string D173ActivityTime(long ms)
        {
            try {
                return DateTimeOffset.FromUnixTimeMilliseconds(ms)
                    .ToOffset(TimeSpan.FromHours(7))
                    .ToString("HH:mm:ss dd/MM/yyyy", CultureInfo.InvariantCulture);
            } catch (ArgumentOutOfRangeException) { return "—"; }
        }

        private static bool D173AcceptActivity(D173LocalActivity previous,
            long generation, string requestId, long timeMs, bool terminal)
        {
            if (generation <= 0 || timeMs <= 0 || string.IsNullOrWhiteSpace(requestId)) return false;
            if (previous == null) return true;
            if (generation < previous.Generation) return false;
            if (generation > previous.Generation) return true;
            if (string.Equals(previous.RequestId, requestId, StringComparison.Ordinal))
                return !previous.Terminal && terminal && timeMs >= previous.TimeMs;
            return timeMs > previous.TimeMs;
        }

        private void RecordD173PickerActivity(
            FirestoreConfirmationWorkItem work, FirestoreConfirmationOutcome outcome)
        {
            if (work == null || string.IsNullOrWhiteSpace(work.PickerUserId)) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action<FirestoreConfirmationWorkItem, FirestoreConfirmationOutcome>(
                    RecordD173PickerActivity), work, outcome);
                return;
            }
            if (IsDisposed || Disposing) return;
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var terminal = outcome != null;
            var generation = work.PickerSessionGeneration;
            long revokedGeneration;
            if (_pickerSessionTombstones.TryGetValue(work.PickerUserId, out revokedGeneration) &&
                generation <= revokedGeneration) return;
            var picker = _pickerOnlineSnapshot.FirstOrDefault(row =>
                row != null && string.Equals(row.UserId, work.PickerUserId, StringComparison.Ordinal));
            if (picker != null && picker.SessionGeneration > 0 &&
                picker.SessionGeneration != generation) return;
            // Source timestamp comes from the server-created request. Old replayed
            // jobs are not new user activity. A result may arrive after job age
            // exceeds the ingress deadline, but only if this Agent saw that job.
            if (work.CreatedAtMs <= 0 || work.CreatedAtMs > now) return;
            D173LocalActivity previous;
            _d173PickerActivities.TryGetValue(work.PickerUserId, out previous);
            if (!terminal && now - work.CreatedAtMs > FirestoreConfirmationTransport.MaxPendingAgeMs) return;
            if (terminal && (previous == null ||
                !string.Equals(previous.RequestId, work.RequestId, StringComparison.Ordinal)) &&
                now - work.CreatedAtMs > FirestoreConfirmationTransport.MaxPendingAgeMs) return;
            var at = terminal ? now : work.CreatedAtMs;
            if (!D173AcceptActivity(previous, generation, work.RequestId, at, terminal)) return;
            var label = "Gửi yêu cầu PickList";
            if (terminal)
            {
                switch ((outcome.Result ?? "").ToUpperInvariant())
                {
                    case "CONFIRMED": label = "PickList: xác nhận thành công"; break;
                    case "ALREADY_CONFIRMED": label = "PickList: đã xác nhận trước đó"; break;
                    case "NOT_FOUND": label = "PickList: không tìm thấy"; break;
                    case "AMBIGUOUS_PICKLIST": label = "PickList: nhiều kết quả"; break;
                    case "PICKER_LOCKED": label = "PickList: tạm khóa"; break;
                    default: label = "PickList: có kết quả xử lý"; break;
                }
            }
            _d173PickerActivities[work.PickerUserId] = new D173LocalActivity {
                Generation = generation, TimeMs = at, RequestId = work.RequestId,
                Label = label, Terminal = terminal
            };
            if (_d173PickerActivities.Count > 500)
            {
                var oldest = _d173PickerActivities.OrderBy(pair => pair.Value.TimeMs).First();
                _d173PickerActivities.Remove(oldest.Key);
            }
            RenderPickerOnlineSnapshot(); // incremental UI only
        }

        internal void ApplyD173PickerTerminalActivity(FirestoreConfirmationWorkItem work,
            FirestoreConfirmationOutcome outcome)
        {
            RecordD173PickerActivity(work, outcome);
        }

        private string D173PickerActivityText(PickerPresenceView picker)
        {
            D173LocalActivity entry;
            if (picker != null && _d173PickerActivities.TryGetValue(picker.UserId ?? "", out entry) &&
                entry.Generation == picker.SessionGeneration)
                return entry.Label + " · " + D173ActivityTime(entry.TimeMs);
            return "Đăng nhập: " + E090LocalSessionTime(picker == null ? "" : picker.LoginAt);
        }

        private long D173PickerActivitySignature(PickerPresenceView picker)
        {
            D173LocalActivity entry;
            return picker != null && _d173PickerActivities.TryGetValue(picker.UserId ?? "", out entry) &&
                entry.Generation == picker.SessionGeneration ? entry.TimeMs : 0L;
        }

        private void RecordD173LocalAgentActivity(string label)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(RecordD173LocalAgentActivity), label);
                return;
            }
            var current = SnapshotSession();
            if (current == null || string.IsNullOrWhiteSpace(current.AppUserId)) return;
            _d173AgentActivityUserId = current.AppUserId;
            _d173AgentActivityTimeMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            _d173AgentActivityLabel = label ?? "";
            RenderPickerOnlineSnapshot();
        }

        private void ResetD173LocalAgentActivity()
        {
            _d173AgentActivityUserId = "";
            _d173AgentActivityTimeMs = 0;
            _d173AgentActivityLabel = "";
            _pickerOnlineRenderSignature = "";
        }

        private string D173AgentActivityText(AgentPresenceView agent)
        {
            if (agent != null && _d173AgentActivityTimeMs > 0 &&
                string.Equals(agent.AgentInstanceId, _agentInstanceId, StringComparison.Ordinal) &&
                string.Equals(agent.AdminUserId, _d173AgentActivityUserId, StringComparison.Ordinal))
                return _d173AgentActivityLabel + " · " + D173ActivityTime(_d173AgentActivityTimeMs);
            return "Chưa ghi nhận thao tác"; // heartbeat is connectivity, not activity
        }

        internal static bool D173E103ActivitySelfTest()
        {
            var prior = new D173LocalActivity {
                Generation = 3, TimeMs = 1000, RequestId = "request-a", Terminal = false
            };
            if (D173AcceptActivity(prior, 2, "request-b", 4000, false)) return false;
            if (D173AcceptActivity(prior, 3, "request-a", 2000, false)) return false;
            if (!D173AcceptActivity(prior, 3, "request-a", 2000, true)) return false;
            prior.Terminal = true;
            if (D173AcceptActivity(prior, 3, "request-a", 3000, true)) return false;
            if (D173AcceptActivity(prior, 3, "request-b", 999, false)) return false;
            return D173AcceptActivity(prior, 4, "request-new-session", 2000, false);
        }
    }
}
