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
        private static long _d158ResilienceReads;
        private const long D158ResilienceReadBudgetPerDay = 2000L;
        private static int _readBand;
        private static int _writeBand;
        private static int _deleteBand;
        private static readonly Dictionary<string, long> ByComponent =
            new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        // D166: RAM-only, capped per-hour operation counts; not a billed-read claim.
        private static readonly Dictionary<string, long> D166Hourly = new Dictionary<string, long>(StringComparer.Ordinal);
        private static readonly Dictionary<string, long> D166Outcomes = new Dictionary<string, long>(StringComparer.Ordinal);
        private static readonly Dictionary<string, long> D166ElapsedMs = new Dictionary<string, long>(StringComparer.Ordinal);
        private const int D166MaxKeys = 320;

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
                D166CountNoLock(D166Hourly, D166Hour() + "|" + (isRead ? "READ" : (isWrite ? "WRITE" : "DELETE")) + "|" + key, 1);

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
                D166CountNoLock(D166Hourly, D166Hour() + "|READ_EXTRA_DOCS|" + key, additional);

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

        // D166: called only by an existing Firestore REST request, adds no network request,
        // timer, log-file write or change to success/retry/control flow.
        internal static void RecordOutcome(string component, string method, bool success, long elapsedMs, string failureClass)
        {
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                var label = D166Hour() + "|" + Safe(component) + "|" + Safe(method) + "|" +
                    (success ? "SUCCESS" : (failureClass == "HTTP_401" || failureClass == "HTTP_403" ||
                    failureClass == "HTTP_429" || failureClass == "HTTP_5XX" || failureClass == "NETWORK" ? failureClass : "OTHER_FAILURE"));
                D166CountNoLock(D166Outcomes, label, 1);
                D166CountNoLock(D166ElapsedMs, label, Math.Max(0L, Math.Min(120000L, elapsedMs)));
            }
        }

        internal static string SnapshotUsageAudit()
        {
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                return "D166_USAGE_AUDIT schema=1 source=AGENT_ESTIMATE_NOT_BILLING quota_day=" + _dayKey +
                    " reads=" + _reads.ToString(CultureInfo.InvariantCulture) +
                    " writes=" + _writes.ToString(CultureInfo.InvariantCulture) +
                    " deletes=" + _deletes.ToString(CultureInfo.InvariantCulture) +
                    " hourly=" + D166Format(D166Hourly) +
                    " outcomes=" + D166Format(D166Outcomes) +
                    " elapsed_ms_sum=" + D166Format(D166ElapsedMs) +
                    " incomplete=PROCESS_LOCAL_RESTART_RESETS_COUNTS";
            }
        }

        private static string D166Hour()
        {
            return DateTime.UtcNow.AddHours(7).ToString("yyyyMMddTHH", CultureInfo.InvariantCulture);
        }

        private static void D166CountNoLock(Dictionary<string, long> target, string key, long delta)
        {
            long old;
            if (target.TryGetValue(key, out old)) target[key] = old + delta;
            else if (target.Count < D166MaxKeys) target[key] = delta;
            else { target.TryGetValue("OVERFLOW", out old); target["OVERFLOW"] = old + delta; }
        }

        private static string D166Format(Dictionary<string, long> source)
        {
            var entries = new List<string>(source.Count);
            foreach (var pair in source)
                entries.Add(pair.Key + ":" + pair.Value.ToString(CultureInfo.InvariantCulture));
            entries.Sort(StringComparer.Ordinal);
            return entries.Count == 0 ? "NONE" : string.Join(",", entries.ToArray());
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

        internal static bool TryReserveD158ResilienceRead()
        {
            lock (Gate)
            {
                ResetIfDayChangedNoLock();
                if (_d158ResilienceReads >= D158ResilienceReadBudgetPerDay) return false;
                _d158ResilienceReads++;
                return true;
            }
        }

        internal static long D158ResilienceReads
        {
            get
            {
                lock (Gate)
                {
                    ResetIfDayChangedNoLock();
                    return _d158ResilienceReads;
                }
            }
        }

        internal static bool CanUseD158ResilienceRead
        {
            get
            {
                lock (Gate)
                {
                    ResetIfDayChangedNoLock();
                    return _d158ResilienceReads < D158ResilienceReadBudgetPerDay;
                }
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
                    " · D158 dự phòng " + _d158ResilienceReads.ToString("N0", CultureInfo.InvariantCulture) +
                    "/2,000 · soft " +
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
                (
                    (url ?? "").IndexOf(":runQuery", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    (url ?? "").IndexOf(":runAggregationQuery", StringComparison.OrdinalIgnoreCase) >= 0
                );
        }

        private static bool IsWrite(string method, string url)
        {
            if (string.Equals(method, "PATCH", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(method, "PUT", StringComparison.OrdinalIgnoreCase))
                return true;
            return string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) &&
                (url ?? "").IndexOf(":runQuery", StringComparison.OrdinalIgnoreCase) < 0 &&
                (url ?? "").IndexOf(":runAggregationQuery", StringComparison.OrdinalIgnoreCase) < 0;
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
            Interlocked.Exchange(ref _d158ResilienceReads, 0L);
            _readBand = 0;
            _writeBand = 0;
            _deleteBand = 0;
            ByComponent.Clear();
            D166Hourly.Clear();
            D166Outcomes.Clear();
            D166ElapsedMs.Clear();
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
