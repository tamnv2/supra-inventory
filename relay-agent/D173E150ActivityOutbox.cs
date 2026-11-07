using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace SupraInventoryRelayAgent
{
    // D173-E150: only the latest sanitized observation per Picker / Agent is
    // replicated. A local outbox preserves that last observation through a
    // process restart or primary handoff, without moving WMS/ACK authority.
    internal sealed partial class AgentForm
    {
        private readonly object _d173E150OutboxGate = new object();
        private readonly Dictionary<string, D173SyncedActivity> _d173E150Pending =
            new Dictionary<string, D173SyncedActivity>(StringComparer.Ordinal);
        private bool _d173E150Loaded;
        private bool _d173E150StorageHealthy = true;
        private int _d173E150DeliveryRunning;
        private DateTime _d173E150LastPatchUtc = DateTime.MinValue;

        private string D173E150OutboxPath()
        {
            return Path.Combine(RelayDataDir, "d173-e150-activity-outbox.json");
        }

        private static string D173E150Key(D173SyncedActivity item)
        {
            return item.Kind + ":" + item.Key;
        }

        private void D173E150LoadLocked()
        {
            if (_d173E150Loaded) return;
            try
            {
                var path = D173E150OutboxPath();
                if (File.Exists(path))
                {
                    var info = new FileInfo(path);
                    if (info.Length > 128 * 1024)
                        throw new InvalidDataException("Activity outbox is too large.");
                    var raw = File.ReadAllText(path, Encoding.UTF8);
                    var rows = FirestoreAgentSyncClient.ParseActivity(raw);
                    if (rows.Count == 0 && raw.Trim() != "[]")
                        throw new InvalidDataException("Activity outbox cannot be parsed.");
                    foreach (var item in rows)
                    {
                        var key = D173E150Key(item);
                        D173SyncedActivity old;
                        _d173E150Pending.TryGetValue(key, out old);
                        if (FirestoreAgentSyncClient.ActivityNewer(old, item))
                            _d173E150Pending[key] = item;
                    }
                }
                _d173E150Loaded = true;
            }
            catch (Exception ex)
            {
                // Fail closed: never overwrite a malformed pre-existing outbox.
                _d173E150StorageHealthy = false;
                Log("D173_E150_OUTBOX storage=FAIL_CLOSED type=" + ex.GetType().Name);
            }
        }

        private bool D173E150PersistLocked()
        {
            if (!_d173E150StorageHealthy) return false;
            var path = D173E150OutboxPath();
            var temp = path + ".tmp";
            try
            {
                Directory.CreateDirectory(RelayDataDir);
                var payload = FirestoreAgentSyncClient.SerializeActivity(
                    _d173E150Pending.Values.OrderByDescending(e => e.AtMs).Take(220));
                File.WriteAllText(temp, payload, new UTF8Encoding(false));
                if (File.Exists(path))
                    File.Replace(temp, path, null, true);
                else
                    File.Move(temp, path);
                return true;
            }
            catch (Exception ex)
            {
                _d173E150StorageHealthy = false;
                Log("D173_E150_OUTBOX storage=FAIL_CLOSED type=" + ex.GetType().Name);
                return false;
            }
        }

        private void QueueD173E150Activity(D173SyncedActivity activity)
        {
            if (activity == null || string.IsNullOrWhiteSpace(activity.Key)) return;
            lock (_d173E150OutboxGate)
            {
                D173E150LoadLocked();
                if (!_d173E150StorageHealthy) return;
                var key = D173E150Key(activity);
                D173SyncedActivity old;
                _d173E150Pending.TryGetValue(key, out old);
                if (!FirestoreAgentSyncClient.ActivityNewer(old, activity)) return;
                _d173E150Pending[key] = activity;
                if (_d173E150Pending.Count > 220)
                {
                    // Operational roster has <=500 Pickers and <=10 Agents.
                    // Keep the newest per actor; older events are superseded.
                    foreach (var stale in _d173E150Pending.OrderBy(kv => kv.Value.AtMs)
                        .Take(_d173E150Pending.Count - 220).Select(kv => kv.Key).ToList())
                        _d173E150Pending.Remove(stale);
                }
                if (!D173E150PersistLocked()) return;
            }
            StartD173E150ActivityDelivery();
        }

        private void StartD173E150ActivityDelivery()
        {
            if (!HasAgentSession() || _agentSyncClient == null) return;
            lock (_d173E150OutboxGate)
            {
                D173E150LoadLocked();
                if (!_d173E150StorageHealthy || _d173E150Pending.Count == 0) return;
            }
            if (Interlocked.CompareExchange(ref _d173E150DeliveryRunning, 1, 0) != 0) return;
            Task.Run(async () =>
            {
                try { await D173E150DeliveryLoopAsync().ConfigureAwait(false); }
                finally
                {
                    Interlocked.Exchange(ref _d173E150DeliveryRunning, 0);
                    // A new enqueue might race the previous worker's final check.
                    bool hasPending;
                    lock (_d173E150OutboxGate) hasPending = _d173E150Pending.Count > 0;
                    if (hasPending && HasAgentSession() && _d173E150StorageHealthy)
                        StartD173E150ActivityDelivery();
                }
            });
        }

        private async Task D173E150DeliveryLoopAsync()
        {
            var backoffSeconds = 2;
            // A short initial coalescing window converts request + terminal
            // into one document patch when they arrive together.
            await Task.Delay(1500).ConfigureAwait(false);
            while (HasAgentSession() && !IsDisposed)
            {
                List<D173SyncedActivity> batch;
                lock (_d173E150OutboxGate)
                {
                    if (!_d173E150StorageHealthy) return;
                    batch = _d173E150Pending.Values.OrderByDescending(a => a.AtMs)
                        .Take(220).ToList();
                }
                if (batch.Count == 0) return;
                var wait = 10000 - (int)(DateTime.UtcNow - _d173E150LastPatchUtc).TotalMilliseconds;
                if (wait > 0) await Task.Delay(wait).ConfigureAwait(false);
                if (!HasAgentSession() || IsDisposed) return;

                try
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    var published = _agentSyncClient.PublishActivityBatch(session, batch);
                    _d173E150LastPatchUtc = DateTime.UtcNow;
                    var delivered = 0;
                    lock (_d173E150OutboxGate)
                    {
                        foreach (var eventItem in batch)
                        {
                            if (!FirestoreAgentSyncClient.ActivityAlreadySynced(published, eventItem))
                                continue;
                            var key = D173E150Key(eventItem);
                            D173SyncedActivity latest;
                            if (_d173E150Pending.TryGetValue(key, out latest) &&
                                !FirestoreAgentSyncClient.ActivityNewer(eventItem, latest))
                            {
                                _d173E150Pending.Remove(key);
                                delivered++;
                            }
                        }
                        if (delivered > 0) D173E150PersistLocked();
                    }
                    if (delivered > 0)
                    {
                        Log("D173_E150_ACTIVITY_SYNC batch=PASS acked=" +
                            delivered.ToString(CultureInfo.InvariantCulture));
                        backoffSeconds = 2;
                        continue;
                    }
                    // A full shared daily budget must NOT trigger provider polling.
                    // Keep the last actor states on local disk and retry after
                    // quota-day rollover (or on future authenticated restart).
                    var day = FirestoreAgentSyncClient.ActivityQuotaDayNow();
                    if (published != null && published.ActivityQuotaDay == day &&
                        published.ActivityDailyPatches >= FirestoreAgentSyncClient.ActivityPatchDailyHardLimit)
                    {
                        Log("D173_E150_ACTIVITY_SYNC budget=DEFER outbox=RETAINED");
                        await Task.Delay(600000).ConfigureAwait(false);
                    }
                    else
                        await Task.Delay(30000).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    Log("D173_E150_ACTIVITY_SYNC result=RETRY outbox=RETAINED type=" +
                        ex.GetType().Name);
                    await Task.Delay(TimeSpan.FromSeconds(backoffSeconds)).ConfigureAwait(false);
                    backoffSeconds = Math.Min(60, backoffSeconds * 2);
                }
            }
        }
    }
}
