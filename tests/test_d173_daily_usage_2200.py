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


    def test_d173_e170_missing_secret_never_calls_provider(self):
        day, start, end = collector.report_window(dt.datetime(2026, 11, 8, 22, 30, tzinfo=UTC))
        with patch.object(collector.urllib.request, "urlopen") as net:
            evidence = collector.d173_e170_daily_evidence("", day, start, end)
        self.assertEqual(evidence["status"], "AUTH_UNAVAILABLE")
        net.assert_not_called()

    def test_d173_e170_signed_read_window_and_hmac(self):
        import hashlib
        import hmac
        import json
        day, start, end = collector.report_window(dt.datetime(2026, 11, 8, 22, 30, tzinfo=UTC))
        secret = "not-a-real-token-only-test-fixed-123456"
        body = {"schema":"D173_DAILY_DIAGNOSTIC_V1", "day_vn":str(day),
                "start_utc":collector.stamp(start), "end_utc":collector.stamp(end),
                "complete_fleet":False,
                "do_sql":{"hourly":[{"metric_kind":"SQL","metric_id":"RECENT_ACK_TOTALS",
                    "rows_read":150,"rows_written":0,"executions":2}]},
                "web_android_receipts":{"status":"RECORDED_ONLY","by_hour":[]},
                "agent_drive":{"status":"PARTIAL","files_observed":4,"files_parsed":2,
                    "diagnostics":{"FIRESTORE_LISTEN_DENIED":3}}}
        class FakeResponse:
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def read(self, *_): return json.dumps(body).encode()
        with patch.object(collector.time, "time", return_value=1794177000), \
             patch.object(collector.urllib.request, "urlopen", return_value=FakeResponse()) as net:
            received=collector.d173_e170_daily_evidence(secret,day,start,end)
        req=net.call_args.args[0]
        self.assertIn("mode=DAILY_EVIDENCE",req.full_url)
        sig=hmac.new(secret.encode(), "\n".join(["D173_SQL_QUERY_ID_AUDIT_V1",
            "GET","/api/internal/d173/sql-evidence","1794177000"]).encode(),
            hashlib.sha256).hexdigest()
        self.assertEqual(req.get_header("X-d173-audit-hmac"),sig)
        self.assertEqual(received["schema"],"D173_DAILY_DIAGNOSTIC_V1")
        summary=collector.d173_e170_evidence_summary(received, [
            {"id":"cf_do_requests","status":"OK"},
            {"id":"cf_do_rows_read","status":"OK"}])
        self.assertEqual(summary["provider_join"],"SAME_WINDOW_ACCOUNT_SHARED_NOT_EXACT_ATTRIBUTION")
        self.assertEqual(summary["top_categories"][0]["rows_read"],150)
        self.assertEqual(summary["agent_diagnostic_codes"]["FIRESTORE_LISTEN_DENIED"],3)
        self.assertEqual(summary["fleet_coverage"],"UNVERIFIED")

    def test_d173_e170_rejects_cross_day_and_provider_missing(self):
        day, start, end = collector.report_window(dt.datetime(2026, 11, 8, 22, 30, tzinfo=UTC))
        bad={"schema":"D173_DAILY_DIAGNOSTIC_V1","day_vn":str(day),
             "start_utc":"2026-01-01T00:00:00Z","end_utc":collector.stamp(end)}
        import json
        class FakeResponse:
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def read(self, *_): return json.dumps(bad).encode()
        with patch.object(collector.urllib.request,"urlopen",return_value=FakeResponse()):
            result=collector.d173_e170_daily_evidence("test-only-read-token-long-enough-123",day,start,end)
        self.assertEqual(result["status"],"WINDOW_MISMATCH")
        unavailable=collector.d173_e170_evidence_summary({"status":"AUTH_UNAVAILABLE"}, [])
        self.assertEqual(unavailable["provider_join"],"UNAVAILABLE")



if __name__ == "__main__":
    unittest.main()
