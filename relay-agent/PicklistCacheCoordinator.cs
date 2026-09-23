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

    internal sealed class ManualPicklistSearchResult
    {
        internal string Result = "LOOKUP_ERROR";
        internal string CacheMode = "NONE";
        internal string Route = "NONE";
        internal int StatusCode;
        internal long ElapsedMs;
        internal int CacheCount;
        internal int QueryCount;
        internal readonly List<string> Matches = new List<string>();
        internal readonly List<string> MissingFragments = new List<string>();
        internal readonly List<string> AmbiguousFragments = new List<string>();
    }

    internal sealed class PicklistCacheCoordinator
    {
        private readonly object _gate = new object();
        private HashSet<string> _suffixes = new HashSet<string>(StringComparer.Ordinal);
        private HashSet<string> _codes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private DateTime _refreshedUtc = DateTime.MinValue;
        private Task<WmsPicklistSnapshotResult> _refreshTask;

        internal int CacheCount
        {
            get { lock (_gate) return _codes.Count; }
        }

        internal DateTime RefreshedUtc
        {
            get { lock (_gate) return _refreshedUtc; }
        }

        internal void Clear()
        {
            lock (_gate)
            {
                _suffixes = new HashSet<string>(StringComparer.Ordinal);
                _codes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
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

            if (!ValidLookupSuffix(suffix))
                throw new ArgumentException("Picklist suffix must contain four digits (five-digit legacy jobs remain compatible during rollout).", "suffix");

            lock (_gate)
            {
                if (_refreshedUtc != DateTime.MinValue && _suffixes.Contains(suffix))
                {
                    return new CachedPicklistResult
                    {
                        Result = "FOUND",
                        CacheMode = "CACHE_HIT",
                        MatchCount = 1,
                        CacheCount = _codes.Count
                    };
                }

            }

            // D101: a cache miss is never final. PickList can be created after the last
            // preload, so refresh the WMS snapshot once and only then return NOT_FOUND.
            // RefreshAndResolve is single-flight, so concurrent PDA misses share one WMS read.
            return RefreshAndResolve(session, suffix, "CACHE_MISS_REFRESH");
        }

        internal Dictionary<string, CachedPicklistResult> LookupMany(
            WmsSessionSnapshot session,
            IEnumerable<string> suffixes)
        {
            if (session == null || !session.IsValidHy1())
                throw new InvalidOperationException("WMS session is required.");

            var unique = new List<string>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var raw in suffixes ?? new string[0])
            {
                var suffix = (raw ?? "").Trim();
                if (!ValidLookupSuffix(suffix))
                    throw new ArgumentException("Picklist suffix must contain four digits (five-digit legacy jobs remain compatible during rollout).", "suffixes");
                if (seen.Add(suffix)) unique.Add(suffix);
            }
            if (unique.Count == 0)
                throw new ArgumentException("At least one Picklist suffix is required.", "suffixes");
            if (unique.Count > 12)
                throw new ArgumentException("At most 12 Picklist suffixes can be resolved per batch.", "suffixes");

            var results = new Dictionary<string, CachedPicklistResult>(StringComparer.Ordinal);
            var missing = new List<string>();
            lock (_gate)
            {
                foreach (var suffix in unique)
                {
                    if (_refreshedUtc != DateTime.MinValue && _suffixes.Contains(suffix))
                    {
                        results[suffix] = new CachedPicklistResult
                        {
                            Result = "FOUND",
                            CacheMode = "CACHE_HIT_BATCH",
                            MatchCount = 1,
                            CacheCount = _codes.Count
                        };
                    }
                    else
                    {
                        missing.Add(suffix);
                    }
                }
            }

            if (missing.Count == 0) return results;

            var refresh = RefreshAndResolve(session, null, "BATCH_CACHE_MISS_REFRESH");
            if (!string.Equals(refresh.Result, "PASS", StringComparison.Ordinal))
            {
                foreach (var suffix in missing)
                {
                    results[suffix] = new CachedPicklistResult
                    {
                        Result = refresh.Result ?? "LOOKUP_ERROR",
                        CacheMode = refresh.CacheMode,
                        Route = refresh.Route,
                        StatusCode = refresh.StatusCode,
                        ElapsedMs = refresh.ElapsedMs,
                        MatchCount = 0,
                        CacheCount = refresh.CacheCount
                    };
                }
                return results;
            }

            lock (_gate)
            {
                foreach (var suffix in missing)
                {
                    var found = _suffixes.Contains(suffix);
                    results[suffix] = new CachedPicklistResult
                    {
                        Result = found ? "FOUND" : "NOT_FOUND",
                        CacheMode = "CACHE_SEARCH_AFTER_BATCH_REFRESH",
                        Route = refresh.Route,
                        StatusCode = refresh.StatusCode,
                        ElapsedMs = refresh.ElapsedMs,
                        MatchCount = found ? 1 : 0,
                        CacheCount = _codes.Count
                    };
                }
            }
            return results;
        }

        internal ManualPicklistSearchResult SearchContainsMany(
            WmsSessionSnapshot session,
            IEnumerable<string> fragments,
            int maxResults)
        {
            if (session == null || !session.IsValidHy1())
                return new ManualPicklistSearchResult { Result = "WMS_SESSION_REQUIRED", CacheMode = "NO_SESSION" };

            var queries = NormalizeFragments(fragments, 10);
            maxResults = Math.Max(1, Math.Min(100, maxResults));

            ManualPicklistSearchResult cached = null;
            lock (_gate)
            {
                if (_refreshedUtc != DateTime.MinValue && _codes.Count > 0)
                    cached = SearchSnapshotMany(queries, maxResults, "CACHE_MULTI_SEARCH", "NONE", 0, 0L);
            }

            if (cached != null && cached.MissingFragments.Count == 0)
                return cached;

            var preload = RefreshAndResolve(
                session,
                null,
                cached == null ? "MANUAL_MULTI_PRELOAD" : "MANUAL_MULTI_MISS_REFRESH");
            if (!string.Equals(preload.Result, "PASS", StringComparison.Ordinal))
            {
                return new ManualPicklistSearchResult
                {
                    Result = preload.Result,
                    CacheMode = preload.CacheMode,
                    Route = preload.Route,
                    StatusCode = preload.StatusCode,
                    ElapsedMs = preload.ElapsedMs,
                    CacheCount = preload.CacheCount,
                    QueryCount = queries.Count
                };
            }

            lock (_gate)
                return SearchSnapshotMany(
                    queries,
                    maxResults,
                    "CACHE_MULTI_SEARCH_AFTER_REFRESH",
                    preload.Route,
                    preload.StatusCode,
                    preload.ElapsedMs);
        }

        internal ManualPicklistSearchResult SearchContains(WmsSessionSnapshot session, string fragment, int maxResults)
        {
            if (session == null || !session.IsValidHy1())
                return new ManualPicklistSearchResult { Result = "WMS_SESSION_REQUIRED", CacheMode = "NO_SESSION" };

            var query = (fragment ?? "").Trim();
            if (query.Length < 3 || query.Length > 20)
                throw new ArgumentException("Manual Picklist search requires 3 to 20 digits.", "fragment");
            foreach (var ch in query)
                if (ch < '0' || ch > '9')
                    throw new ArgumentException("Manual Picklist search requires digits only.", "fragment");
            maxResults = Math.Max(1, Math.Min(100, maxResults));

            ManualPicklistSearchResult cached = null;
            lock (_gate)
            {
                if (_refreshedUtc != DateTime.MinValue && _codes.Count > 0)
                    cached = SearchSnapshot(query, maxResults, "CACHE_SEARCH", "NONE", 0, 0L);
            }
            if (cached != null && string.Equals(cached.Result, "FOUND", StringComparison.Ordinal))
                return cached;

            // D101: manual specialist search also treats cache NOT_FOUND as provisional.
            // Refresh WMS once, then search the new snapshot before reporting NOT_FOUND.
            var preload = RefreshAndResolve(session, null, cached == null ? "MANUAL_PRELOAD" : "MANUAL_MISS_REFRESH");
            if (!string.Equals(preload.Result, "PASS", StringComparison.Ordinal))
            {
                return new ManualPicklistSearchResult
                {
                    Result = preload.Result,
                    CacheMode = preload.CacheMode,
                    Route = preload.Route,
                    StatusCode = preload.StatusCode,
                    ElapsedMs = preload.ElapsedMs,
                    CacheCount = preload.CacheCount
                };
            }

            lock (_gate)
                return SearchSnapshot(query, maxResults, "CACHE_SEARCH_AFTER_REFRESH", preload.Route, preload.StatusCode, preload.ElapsedMs);
        }

        private static List<string> NormalizeFragments(IEnumerable<string> fragments, int maxQueries)
        {
            var queries = new List<string>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var raw in fragments ?? new string[0])
            {
                var query = (raw ?? "").Trim();
                if (query.Length < 3 || query.Length > 20)
                    throw new ArgumentException("Manual Picklist search requires each value to contain 3 to 20 digits.", "fragments");
                foreach (var ch in query)
                    if (ch < '0' || ch > '9')
                        throw new ArgumentException("Manual Picklist search requires digits only.", "fragments");
                if (seen.Add(query)) queries.Add(query);
            }
            if (queries.Count == 0)
                throw new ArgumentException("At least one manual Picklist search value is required.", "fragments");
            if (queries.Count > Math.Max(1, maxQueries))
                throw new ArgumentException("Too many manual Picklist search values.", "fragments");
            return queries;
        }

        private ManualPicklistSearchResult SearchSnapshotMany(
            List<string> queries,
            int maxResults,
            string cacheMode,
            string route,
            int statusCode,
            long elapsedMs)
        {
            var matches = new List<string>();
            var matchSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var result = new ManualPicklistSearchResult
            {
                CacheMode = cacheMode,
                Route = route ?? "NONE",
                StatusCode = statusCode,
                ElapsedMs = Math.Max(0L, elapsedMs),
                CacheCount = _codes.Count,
                QueryCount = queries.Count
            };

            foreach (var query in queries)
            {
                var queryMatches = new List<string>();
                foreach (var code in _codes)
                {
                    if (!code.EndsWith(query, StringComparison.OrdinalIgnoreCase)) continue;
                    queryMatches.Add(code);
                }
                queryMatches.Sort(StringComparer.OrdinalIgnoreCase);
                if (queryMatches.Count == 0)
                {
                    result.MissingFragments.Add(query);
                    continue;
                }
                if (queryMatches.Count > 1)
                {
                    result.AmbiguousFragments.Add(query);
                    continue;
                }
                if (matchSet.Add(queryMatches[0])) matches.Add(queryMatches[0]);
            }

            matches.Sort(StringComparer.OrdinalIgnoreCase);
            if (matches.Count > maxResults)
                matches.RemoveRange(maxResults, matches.Count - maxResults);
            result.Matches.AddRange(matches);
            result.Result = result.AmbiguousFragments.Count > 0
                ? "AMBIGUOUS"
                : (matches.Count > 0 ? "FOUND" : "NOT_FOUND");
            return result;
        }
        private ManualPicklistSearchResult SearchSnapshot(
            string query,
            int maxResults,
            string cacheMode,
            string route,
            int statusCode,
            long elapsedMs)
        {
            var matches = new List<string>();
            foreach (var code in _codes)
            {
                if (!code.EndsWith(query, StringComparison.OrdinalIgnoreCase)) continue;
                matches.Add(code);
            }
            matches.Sort(StringComparer.OrdinalIgnoreCase);
            if (matches.Count > maxResults)
                matches.RemoveRange(maxResults, matches.Count - maxResults);

            var result = new ManualPicklistSearchResult
            {
                Result = matches.Count > 0 ? "FOUND" : "NOT_FOUND",
                CacheMode = cacheMode,
                Route = route ?? "NONE",
                StatusCode = statusCode,
                ElapsedMs = Math.Max(0L, elapsedMs),
                CacheCount = _codes.Count,
                QueryCount = 1
            };
            result.Matches.AddRange(matches);
            return result;
        }

        private static bool ValidLookupSuffix(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || (value.Length != 4 && value.Length != 5))
                return false;
            foreach (var ch in value)
                if (ch < '0' || ch > '9')
                    return false;
            return true;
        }

        private static HashSet<string> BuildLookupSuffixes(IEnumerable<string> codes)
        {
            var suffixes = new HashSet<string>(StringComparer.Ordinal);
            foreach (var raw in codes ?? new string[0])
            {
                var code = (raw ?? "").Trim();
                if (code.Length >= 4) suffixes.Add(code.Substring(code.Length - 4, 4));
                if (code.Length >= 5) suffixes.Add(code.Substring(code.Length - 5, 5));
            }
            return suffixes;
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
            var codeCount = 0;
            lock (_gate)
            {
                _codes = new HashSet<string>(snapshot.PickListCodes ?? new HashSet<string>(), StringComparer.OrdinalIgnoreCase);
                _suffixes = BuildLookupSuffixes(_codes);
                _refreshedUtc = DateTime.UtcNow;
                next = new HashSet<string>(_suffixes, StringComparer.Ordinal);
                codeCount = _codes.Count;
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
                CacheCount = codeCount
            };
        }
    }
}
