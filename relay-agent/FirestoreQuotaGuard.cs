using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading;

namespace SupraInventoryRelayAgent
{
    /// <summary>
    /// Local-only Firestore usage guard. Counters are process-local diagnostics and
    /// never generate provider traffic. Reference limits are conservative public
    /// no-cost quota reference points, not an entitlement/billing-plan assertion.
    /// </summary>
    internal static class FirestoreQuotaGuard
    {
        internal const long ReferenceReadsPerDay = 50000L;
        internal const long ReferenceWritesPerDay = 20000L;

        private static readonly object Gate = new object();
        private static string _dayKey = "";
        private static long _reads;
        private static long _writes;
        private static int _readBand;
        private static int _writeBand;
        private static readonly Dictionary<string, long> ByComponent =
            new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);

        internal static void Record(string method, string url, string component, Action<string> log)
        {
            var isRead = IsRead(method, url);
            var isWrite = IsWrite(method, url);
            if (!isRead && !isWrite) return;

            string warning = null;
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                if (isRead) _reads++;
                if (isWrite) _writes++;

                var key = Safe(component);
                long current;
                ByComponent.TryGetValue(key, out current);
                ByComponent[key] = current + 1L;

                var readBand = Band(_reads, ReferenceReadsPerDay);
                var writeBand = Band(_writes, ReferenceWritesPerDay);
                if (readBand > _readBand || writeBand > _writeBand)
                {
                    _readBand = Math.Max(_readBand, readBand);
                    _writeBand = Math.Max(_writeBand, writeBand);
                    warning =
                        "FIRESTORE QUOTA local_guard reads=" + _reads.ToString(CultureInfo.InvariantCulture) +
                        "/" + ReferenceReadsPerDay.ToString(CultureInfo.InvariantCulture) +
                        " writes=" + _writes.ToString(CultureInfo.InvariantCulture) +
                        "/" + ReferenceWritesPerDay.ToString(CultureInfo.InvariantCulture) +
                        " level=" + Math.Max(_readBand, _writeBand).ToString(CultureInfo.InvariantCulture) +
                        " reference_only=true provider_poll=false";
                }
            }

            if (warning != null && log != null) log(warning);
        }

        internal static string SnapshotText()
        {
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                return "Firestore cục bộ · đọc " + _reads.ToString("N0", CultureInfo.InvariantCulture) +
                    " · ghi " + _writes.ToString("N0", CultureInfo.InvariantCulture) +
                    " · mốc tham chiếu " +
                    ReferenceReadsPerDay.ToString("N0", CultureInfo.InvariantCulture) + "/" +
                    ReferenceWritesPerDay.ToString("N0", CultureInfo.InvariantCulture);
            }
        }

        internal static string SnapshotDetail()
        {
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                var parts = new List<string>();
                foreach (var pair in ByComponent)
                    parts.Add(Safe(pair.Key) + "=" + pair.Value.ToString(CultureInfo.InvariantCulture));
                parts.Sort(StringComparer.OrdinalIgnoreCase);
                return SnapshotText() + (parts.Count == 0 ? "" : " · " + string.Join(",", parts.ToArray()));
            }
        }

        private static bool IsRead(string method, string url)
        {
            if (string.Equals(method, "GET", StringComparison.OrdinalIgnoreCase)) return true;
            return string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) &&
                (url ?? "").IndexOf(":runQuery", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool IsWrite(string method, string url)
        {
            if (string.Equals(method, "PATCH", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(method, "PUT", StringComparison.OrdinalIgnoreCase))
                return true;
            return string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) &&
                (url ?? "").IndexOf(":runQuery", StringComparison.OrdinalIgnoreCase) < 0;
        }

        private static int Band(long value, long reference)
        {
            if (reference <= 0L) return 0;
            var ratio = value * 100.0 / reference;
            if (ratio >= 95.0) return 95;
            if (ratio >= 85.0) return 85;
            if (ratio >= 70.0) return 70;
            return 0;
        }

        private static void ResetIfDayChangedNoLock()
        {
            var key = DateTime.UtcNow.AddHours(7).ToString("yyyyMMdd", CultureInfo.InvariantCulture);
            if (string.Equals(_dayKey, key, StringComparison.Ordinal)) return;
            _dayKey = key;
            Interlocked.Exchange(ref _reads, 0L);
            Interlocked.Exchange(ref _writes, 0L);
            _readBand = 0;
            _writeBand = 0;
            ByComponent.Clear();
        }

        private static string Safe(string value)
        {
            var next = (value ?? "").Trim();
            if (next.Length == 0) return "unknown";
            return next.Length <= 64 ? next : next.Substring(0, 64);
        }
    }
}
