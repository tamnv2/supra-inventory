import importlib.util
import pathlib
import unittest
from unittest.mock import patch
import datetime as dt

SRC = pathlib.Path("tools/d173_daily_usage_2200.py")
spec = importlib.util.spec_from_file_location("d173_daily_usage_2200", SRC)
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
UTC = dt.timezone.utc


class D173DailyUsageTests(unittest.TestCase):
    def test_exact_source_inventory(self):
        google, cf = collector.metric_inventory()
        self.assertEqual((len(google), len(cf)), (26, 8))
        self.assertIn("firestore_reads", [m[0] for m in google])
        self.assertIn("cf_do_requests", [m[0] for m in cf])

    def test_vietnam_day_boundary(self):
        tz = dt.timezone(dt.timedelta(hours=7))
        day, start, end = collector.report_window(dt.datetime(2026, 11, 8, 22, 30, tzinfo=UTC))
        self.assertEqual(day, dt.date(2026, 11, 8))
        self.assertEqual(start.astimezone(tz).strftime("%d/%m/%Y %H:%M"), "08/11/2026 05:00")
        self.assertEqual(end.astimezone(tz).strftime("%d/%m/%Y %H:%M"), "09/11/2026 05:00")
        self.assertEqual((end - start), dt.timedelta(days=1))
        before = collector.report_window(dt.datetime(2026, 11, 8, 21, 59, tzinfo=UTC))
        self.assertEqual(before[0], dt.date(2026, 11, 7))
        manual = collector.report_window(dt.datetime(2026, 11, 10, tzinfo=UTC), "2026-11-08")
        self.assertEqual(manual, (day, start, end))
        with self.assertRaises(ValueError):
            collector.report_window(dt.datetime(2026, 11, 8, tzinfo=UTC), "invalid-day")

    def test_provider_outside_window_excluded(self):
        start = dt.datetime(2026, 11, 6, 15, tzinfo=UTC)
        end = start + dt.timedelta(days=1)
        row = collector.row("cf_do_requests", "DO", "CLOUDFLARE", "CF_ACCOUNT_SHARED",
                            "requests", "graphql")
        result = collector.finalize(row, [("2026-11-06T15:00:00Z", 999),
                                          ("2026-11-06T15:05:00Z", 7),
                                          ("2026-11-07T15:00:00Z", 2),
                                          ("2026-11-07T15:05:00Z", 888)], start, end)
        self.assertEqual(result["total"], 9)
        self.assertEqual(result["sample_count"], 2)
        self.assertEqual(result["status"], "OK")

    def test_missing_is_not_zero(self):
        start = dt.datetime(2026, 11, 6, 15, tzinfo=UTC)
        end = start + dt.timedelta(days=1)
        row = collector.row("firestore_reads", "Firestore reads", "GOOGLE", "GCP_PROJECT",
                            "operations", "Monitoring")
        result = collector.finalize(row, [], start, end)
        self.assertEqual(result["status"], "NO_DATA")
        self.assertIsNone(result["total"])
        self.assertEqual(collector.request("https://example.invalid", "")[1],
                         "AUTH_UNAVAILABLE")

    def test_gauge_uses_max_not_sum(self):
        start = dt.datetime(2026, 11, 6, 15, tzinfo=UTC)
        end = start + dt.timedelta(days=1)
        row = collector.row("firestore_connections", "Connections", "GOOGLE",
                            "GCP_PROJECT", "connections", "Monitoring")
        result = collector.finalize(row, [("2026-11-06T15:05:00Z", 13),
                                          ("2026-11-06T15:10:00Z", 20)], start, end)
        self.assertEqual(result["total"], 20)

    def test_int64_precision_and_unbounded_rtdb_limit(self):
        self.assertEqual(collector.num("9223372036854775807"), 9223372036854775807)
        start = dt.datetime(2026, 11, 6, 15, tzinfo=UTC)
        end = start + dt.timedelta(days=1)
        fake = {"timeSeries": [{"points": [{
            "interval": {"endTime": "2026-11-06T15:05:00Z"},
            "value": {"int64Value": "9223372036854775807"}}]}]}
        with patch.object(collector, "request", return_value=(fake, None)):
            result = collector.gcp(
                ["rtdb_monthly_sent_limit", "RTDB limit",
                 "firebasedatabase.googleapis.com/network/monthly_sent_limit",
                 "rtdb", "bytes"], "read-only-test", start, end)
        self.assertEqual(result["status"], "UNBOUNDED_PROVIDER_SENTINEL")
        self.assertIsNone(result["total"])
        self.assertEqual(result["sample_count"], 1)

    def test_no_provider_calls_without_credentials(self):
        start = dt.datetime(2026, 11, 6, 15, tzinfo=UTC)
        end = start + dt.timedelta(days=1)
        r = collector.cloudflare(
            ["cf_do_requests", "DO", "durableObjectsInvocationsAdaptiveGroups",
             "sum", "requests", "requests"], "", "", start, end)
        self.assertEqual(r["status"], "AUTH_UNAVAILABLE")
        self.assertIsNone(r["total"])


if __name__ == "__main__":
    unittest.main()
