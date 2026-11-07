using System;
using System.Collections.Generic;
using System.Linq;
using System.Globalization;
using System.Threading.Tasks;

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
        private readonly Dictionary<string, D173SyncedActivity> _d173SyncedAgentActivities =
            new Dictionary<string, D173SyncedActivity>(StringComparer.Ordinal);
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
            PublishD173Activity(new D173SyncedActivity {
                Kind = "P", Key = work.PickerUserId, Owner = work.PickerUserId,
                Generation = generation, AtMs = at, RequestId = work.RequestId ?? "",
                Label = label, Terminal = terminal
            });
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
            // Fleet AdminUserId is the display login, not necessarily AppUserId.
            var displayLogin = string.IsNullOrWhiteSpace(current.LoginName)
                ? (current.AppUserId ?? "") : current.LoginName.Trim();
            var colon = displayLogin.LastIndexOf(':');
            if (colon >= 0 && colon < displayLogin.Length - 1)
                displayLogin = displayLogin.Substring(colon + 1).Trim();
            _d173AgentActivityUserId = displayLogin;
            _d173AgentActivityTimeMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            _d173AgentActivityLabel = label ?? "";
            RenderPickerOnlineSnapshot();
            PublishD173Activity(new D173SyncedActivity {
                Kind = "A", Key = _agentInstanceId, Owner = _d173AgentActivityUserId,
                AtMs = _d173AgentActivityTimeMs, Label = _d173AgentActivityLabel,
                Terminal = true
            });
        }

        private void PublishD173Activity(D173SyncedActivity activity)
        {
            // E150 durable outbox: do not silently lose activity on Fire timeout,
            // Agent restart, or PRIMARY lease handoff.
            QueueD173E150Activity(activity);
        }

        private bool ApplyD173SyncedActivity(string raw)
        {
            var changed = false;
            foreach (var entry in FirestoreAgentSyncClient.ParseActivity(raw))
            {
                if (entry.Kind == "P")
                {
                    D173LocalActivity old;
                    _d173PickerActivities.TryGetValue(entry.Key, out old);
                    if (!D173AcceptActivity(old, entry.Generation, entry.RequestId,
                        entry.AtMs, entry.Terminal)) continue;
                    _d173PickerActivities[entry.Key] = new D173LocalActivity {
                        Generation = entry.Generation, TimeMs = entry.AtMs,
                        RequestId = entry.RequestId, Label = entry.Label,
                        Terminal = entry.Terminal
                    };
                    changed = true;
                }
                else
                {
                    D173SyncedActivity old;
                    _d173SyncedAgentActivities.TryGetValue(entry.Key, out old);
                    if (old != null && old.AtMs >= entry.AtMs) continue;
                    _d173SyncedAgentActivities[entry.Key] = entry;
                    changed = true;
                }
            }
            if (changed) _pickerOnlineRenderSignature = "";
            return changed;
        }

        private void ResetD173LocalAgentActivity()
        {
            _d173AgentActivityUserId = "";
            _d173AgentActivityTimeMs = 0;
            _d173AgentActivityLabel = "";
            _d173SyncedAgentActivities.Clear();
            _pickerOnlineRenderSignature = "";
        }

        private string D173AgentActivityText(AgentPresenceView agent)
        {
            if (agent == null) return "Chưa ghi nhận thao tác";
            D173SyncedActivity shared;
            _d173SyncedAgentActivities.TryGetValue(agent.AgentInstanceId ?? "", out shared);
            var sharedValid = shared != null &&
                string.Equals(shared.Owner, agent.AdminUserId, StringComparison.Ordinal);
            var localValid = _d173AgentActivityTimeMs > 0 &&
                string.Equals(agent.AgentInstanceId, _agentInstanceId, StringComparison.Ordinal) &&
                string.Equals(agent.AdminUserId, _d173AgentActivityUserId, StringComparison.Ordinal);
            if (localValid && (!sharedValid || _d173AgentActivityTimeMs >= shared.AtMs))
                return _d173AgentActivityLabel + " · " + D173ActivityTime(_d173AgentActivityTimeMs);
            if (sharedValid)
                return shared.Label + " · " + D173ActivityTime(shared.AtMs);
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
            if (!D173AcceptActivity(prior, 4, "request-new-session", 2000, false)) return false;
            // E150 native roundtrip: exact actor key, session generation and
            // terminal outcome must survive the shared Firestore JSON mapping.
            var completed = new D173SyncedActivity {
                Kind = "P", Key = "selftest-picker", Owner = "selftest-picker",
                Generation = 9, AtMs = 5000, RequestId = "selftest-r",
                Label = "PickList: xác nhận thành công", Terminal = true
            };
            var raw = FirestoreAgentSyncClient.SerializeActivity(
                new List<D173SyncedActivity> { completed });
            var roundtrip = FirestoreAgentSyncClient.ParseActivity(raw);
            if (roundtrip.Count != 1 || roundtrip[0].Generation != 9 ||
                roundtrip[0].AtMs != 5000 || !roundtrip[0].Terminal ||
                roundtrip[0].RequestId != "selftest-r") return false;
            if (FirestoreAgentSyncClient.ActivityNewer(roundtrip[0], new D173SyncedActivity {
                Kind = "P", Key = "selftest-picker", Owner = "selftest-picker",
                Generation = 8, AtMs = 6000, RequestId = "old",
                Label = "Gửi yêu cầu PickList", Terminal = false
            })) return false;
            return FirestoreAgentSyncClient.ActivityPatchDailyHardLimit == 1500;
        }
    }
}
