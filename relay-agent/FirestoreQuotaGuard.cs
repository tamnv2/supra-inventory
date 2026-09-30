using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading;

namespace SupraInventoryRelayAgent
{
    /// <summary>
    /// Process-local diagnostic only. Provider-authoritative values are shown in the
    /// D131 Usage tab. Keeping this guard local means observing it never creates
    /// Firestore traffic.
    /// </summary>
    internal static class FirestoreQuotaGuard
    {
        internal const long ReferenceReadsPerDay = 50000L;
        internal const long ReferenceWritesPerDay = 20000L;
        internal const long ReferenceDeletesPerDay = 20000L;
        internal const long SoftReadsPerDay = 45000L;
        internal const long SoftWritesPerDay = 15000L;
        internal const long SoftDeletesPerDay = 3000L;

        private static readonly object Gate = new object();
        private static string _dayKey = "";
        private static long _reads;
        private static long _writes;
        private static long _deletes;
        private static int _readBand;
        private static int _writeBand;
        private static int _deleteBand;
        private static readonly Dictionary<string, long> ByComponent =
            new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);

        internal static void Record(string method, string url, string component, Action<string> log)
        {
            var isDelete = string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase);
            var isRead = !isDelete && IsRead(method, url);
            var isWrite = !isDelete && IsWrite(method, url);
            if (!isRead && !isWrite && !isDelete) return;

            string warning = null;
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                if (isRead) _reads++;
                if (isWrite) _writes++;
                if (isDelete) _deletes++;

                var key = Safe(component);
                long current;
                ByComponent.TryGetValue(key, out current);
                ByComponent[key] = current + 1L;

                var readBand = Band(_reads, SoftReadsPerDay);
                var writeBand = Band(_writes, SoftWritesPerDay);
                var deleteBand = Band(_deletes, SoftDeletesPerDay);
                if (readBand > _readBand || writeBand > _writeBand || deleteBand > _deleteBand)
                {
                    _readBand = Math.Max(_readBand, readBand);
                    _writeBand = Math.Max(_writeBand, writeBand);
                    _deleteBand = Math.Max(_deleteBand, deleteBand);
                    warning =
                        "FIRESTORE QUOTA local_guard reads=" + _reads.ToString(CultureInfo.InvariantCulture) +
                        "/" + SoftReadsPerDay.ToString(CultureInfo.InvariantCulture) +
                        " writes=" + _writes.ToString(CultureInfo.InvariantCulture) +
                        "/" + SoftWritesPerDay.ToString(CultureInfo.InvariantCulture) +
                        " deletes=" + _deletes.ToString(CultureInfo.InvariantCulture) +
                        "/" + SoftDeletesPerDay.ToString(CultureInfo.InvariantCulture) +
                        " level=" + Math.Max(_readBand, Math.Max(_writeBand, _deleteBand)).ToString(CultureInfo.InvariantCulture) +
                        " quota_day=America/Los_Angeles reference_only=true provider_poll=false";
                }
            }

            if (warning != null && log != null) log(warning);
        }

        internal static void RecordReadDocuments(int returnedDocumentCount, string component, Action<string> log)
        {
            // Firestore bills collection/query reads by document returned, not by HTTP request.
            // FirestoreHttpTransport already records the request as one read (also matching the
            // provider minimum for an empty query), so add only documents beyond that first unit.
            var additional = Math.Max(0, returnedDocumentCount - 1);
            if (additional <= 0) return;

            string warning = null;
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                _reads += additional;

                var key = Safe(component);
                long current;
                ByComponent.TryGetValue(key, out current);
                ByComponent[key] = current + additional;

                var readBand = Band(_reads, SoftReadsPerDay);
                if (readBand > _readBand)
                {
                    _readBand = readBand;
                    warning =
                        "FIRESTORE QUOTA local_guard reads=" + _reads.ToString(CultureInfo.InvariantCulture) +
                        "/" + SoftReadsPerDay.ToString(CultureInfo.InvariantCulture) +
                        " writes=" + _writes.ToString(CultureInfo.InvariantCulture) +
                        "/" + SoftWritesPerDay.ToString(CultureInfo.InvariantCulture) +
                        " deletes=" + _deletes.ToString(CultureInfo.InvariantCulture) +
                        "/" + SoftDeletesPerDay.ToString(CultureInfo.InvariantCulture) +
                        " level=" + Math.Max(_readBand, Math.Max(_writeBand, _deleteBand)).ToString(CultureInfo.InvariantCulture) +
                        " quota_day=America/Los_Angeles reference_only=true provider_poll=false document_aware=true";
                }
            }

            if (warning != null && log != null) log(warning);
        }

        internal static bool AllowOptionalFastPath()
        {
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                // D157: optional realtime acceleration must never consume the safety
                // margin reserved for the accepted REST fallback and HA reads.
                return _reads < 40000L;
            }
        }

        internal static string SnapshotText()
        {
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                return "Firestore cục bộ · đọc " + _reads.ToString("N0", CultureInfo.InvariantCulture) +
                    " · ghi " + _writes.ToString("N0", CultureInfo.InvariantCulture) +
                    " · xóa " + _deletes.ToString("N0", CultureInfo.InvariantCulture) +
                    " · soft " +
                    SoftReadsPerDay.ToString("N0", CultureInfo.InvariantCulture) + "/" +
                    SoftWritesPerDay.ToString("N0", CultureInfo.InvariantCulture) + "/" +
                    SoftDeletesPerDay.ToString("N0", CultureInfo.InvariantCulture);
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
            var key = ProviderQuotaDayKey();
            if (string.Equals(_dayKey, key, StringComparison.Ordinal)) return;
            _dayKey = key;
            Interlocked.Exchange(ref _reads, 0L);
            Interlocked.Exchange(ref _writes, 0L);
            Interlocked.Exchange(ref _deletes, 0L);
            _readBand = 0;
            _writeBand = 0;
            _deleteBand = 0;
            ByComponent.Clear();
        }

        private static string ProviderQuotaDayKey()
        {
            try
            {
                var zone = TimeZoneInfo.FindSystemTimeZoneById("Pacific Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone)
                    .ToString("yyyyMMdd", CultureInfo.InvariantCulture);
            }
            catch
            {
                // Windows Agent is the supported runtime. UTC-8 is only a fail-safe
                // diagnostic fallback and never controls provider traffic.
                return DateTime.UtcNow.AddHours(-8).ToString("yyyyMMdd", CultureInfo.InvariantCulture);
            }
        }

        private static string Safe(string value)
        {
            var next = (value ?? "").Trim();
            if (next.Length == 0) return "unknown";
            return next.Length <= 64 ? next : next.Substring(0, 64);
        }
    }
}
