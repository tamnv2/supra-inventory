using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SupraInventoryRelayAgent
{
    internal sealed class CachedPicklistResult
    {
        internal string Result = "LOOKUP_ERROR";
        internal string CacheMode = "NONE";
        internal string Route = "NONE";
        internal int StatusCode;
        internal long ElapsedMs;
        internal int MatchCount;
        internal int CacheCount;
    }

    internal sealed class PicklistCacheCoordinator
    {
        internal const int FreshMissGuardSeconds = 10;

        private readonly object _gate = new object();
        private HashSet<string> _suffixes = new HashSet<string>(StringComparer.Ordinal);
        private DateTime _refreshedUtc = DateTime.MinValue;
        private Task<WmsPicklistSnapshotResult> _refreshTask;

        internal void Clear()
        {
            lock (_gate)
            {
                _suffixes = new HashSet<string>(StringComparer.Ordinal);
                _refreshedUtc = DateTime.MinValue;
                _refreshTask = null;
            }
        }

        internal CachedPicklistResult Preload(WmsSessionSnapshot session)
        {
            return RefreshAndResolve(session, null, "PRELOAD");
        }

        internal CachedPicklistResult Lookup(WmsSessionSnapshot session, string suffix)
        {
            if (session == null || !session.IsValidHy1())
                return new CachedPicklistResult { Result = "WMS_SESSION_REQUIRED", CacheMode = "NO_SESSION" };

            if (string.IsNullOrWhiteSpace(suffix) || suffix.Length != 5)
                throw new ArgumentException("Picklist suffix must contain exactly five digits.", "suffix");

            lock (_gate)
            {
                if (_refreshedUtc != DateTime.MinValue && _suffixes.Contains(suffix))
                {
                    return new CachedPicklistResult
                    {
                        Result = "FOUND",
                        CacheMode = "CACHE_HIT",
                        MatchCount = 1,
                        CacheCount = _suffixes.Count
                    };
                }

                if (_refreshedUtc != DateTime.MinValue &&
                    DateTime.UtcNow - _refreshedUtc <= TimeSpan.FromSeconds(FreshMissGuardSeconds))
                {
                    return new CachedPicklistResult
                    {
                        Result = "NOT_FOUND",
                        CacheMode = "CACHE_FRESH_MISS",
                        MatchCount = 0,
                        CacheCount = _suffixes.Count
                    };
                }
            }

            return RefreshAndResolve(session, suffix, "CACHE_REFRESH");
        }

        private CachedPicklistResult RefreshAndResolve(WmsSessionSnapshot session, string suffix, string mode)
        {
            Task<WmsPicklistSnapshotResult> task;
            var joined = false;

            lock (_gate)
            {
                if (_refreshTask == null || _refreshTask.IsCompleted)
                {
                    _refreshTask = Task.Run(() => WmsPicklistLookupClient.LoadSnapshot(session));
                }
                else
                {
                    joined = true;
                }
                task = _refreshTask;
            }

            WmsPicklistSnapshotResult snapshot;
            try
            {
                snapshot = task.GetAwaiter().GetResult();
            }
            finally
            {
                lock (_gate)
                {
                    if (ReferenceEquals(_refreshTask, task) && task.IsCompleted)
                        _refreshTask = null;
                }
            }

            if (snapshot == null)
                return new CachedPicklistResult { Result = "LOOKUP_ERROR", CacheMode = joined ? "JOIN_INFLIGHT" : mode };

            if (!string.Equals(snapshot.Result, "PASS", StringComparison.Ordinal))
            {
                return new CachedPicklistResult
                {
                    Result = snapshot.Result ?? "LOOKUP_ERROR",
                    CacheMode = joined ? "JOIN_INFLIGHT" : mode,
                    Route = snapshot.Route ?? "NONE",
                    StatusCode = snapshot.StatusCode,
                    ElapsedMs = Math.Max(0L, snapshot.ElapsedMs),
                    CacheCount = 0
                };
            }

            HashSet<string> next;
            lock (_gate)
            {
                _suffixes = new HashSet<string>(snapshot.TrailingFiveSuffixes ?? new HashSet<string>(), StringComparer.Ordinal);
                _refreshedUtc = DateTime.UtcNow;
                next = new HashSet<string>(_suffixes, StringComparer.Ordinal);
            }

            var found = !string.IsNullOrWhiteSpace(suffix) && next.Contains(suffix);
            return new CachedPicklistResult
            {
                Result = string.IsNullOrWhiteSpace(suffix) ? "PASS" : (found ? "FOUND" : "NOT_FOUND"),
                CacheMode = joined ? "JOIN_INFLIGHT" : mode,
                Route = snapshot.Route ?? "NONE",
                StatusCode = snapshot.StatusCode,
                ElapsedMs = Math.Max(0L, snapshot.ElapsedMs),
                MatchCount = found ? 1 : 0,
                CacheCount = next.Count
            };
        }
    }
}
