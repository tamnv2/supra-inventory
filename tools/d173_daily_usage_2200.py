#!/usr/bin/env python3
"""D173 E165: read-only usage by 05:00-to-05:00 Vietnam business day."""
import concurrent.futures as futures
import hashlib
import hmac
import time
import datetime as dt
import json
import os
import pathlib
import re
import statistics
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

UTC = dt.timezone.utc
PROJECT = "supra-inventory-beta"
GCP_API = "https://monitoring.googleapis.com/v3/projects/" + PROJECT + "/timeSeries"
CF_API = "https://api.cloudflare.com/client/v4"
GAUGES = set("firestore_connections firestore_listeners firestore_storage cloud_run_instances rtdb_connections rtdb_monthly_sent rtdb_monthly_sent_limit rtdb_storage_bytes cf_d1_storage".split())


def stamp(d):
    return d.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def num(v):
    if isinstance(v, bool) or not isinstance(v, (str, int, float)):
        return None
    try:
        # Monitoring int64 arrives as a decimal string; never round it via float.
        if isinstance(v, int) or (isinstance(v, str) and re.fullmatch(r"[0-9]+", v)):
            n = int(v)
            return n if n >= 0 else None
        x = float(v)
        if not (0 <= x < float("inf")):
            return None
        return int(x) if x.is_integer() else x
    except (ValueError, OverflowError):
        return None


def metric_inventory():
    source = pathlib.Path("service/src/d173-vps-usage.ts").read_text(encoding="utf-8")
    a = re.search(r"const GOOGLE = \[(.*?)\] as const;", source, re.S)
    b = re.search(r"const CLOUDFLARE: readonly CfSpec\[\] = \[(.*?)\];", source, re.S)
    if not a or not b:
        raise ValueError("SOURCE_METRIC_MATRIX_NOT_FOUND")
    def parse(s, n):
        return [v for line in s.splitlines() if line.lstrip().startswith("[")
                if len(v := re.findall(r'"([^"]+)"', line)) == n]
    google, cf = parse(a.group(1), 5), parse(b.group(1), 6)
    if len(google) != 26 or len(cf) != 8:
        raise ValueError("SOURCE_METRIC_MATRIX_CHANGED_REVIEW_REQUIRED")
    return google, cf


def request(url, token, payload=None, headers=None):
    if not token:
        return None, "AUTH_UNAVAILABLE"
    body = json.dumps(payload).encode() if payload is not None else None
    h = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    if body is not None:
        h["Content-Type"] = "application/json"
    h.update(headers or {})
    try:
        r = urllib.request.Request(url, data=body, headers=h, method="POST" if body is not None else "GET")
        with urllib.request.urlopen(r, timeout=25) as response:
            data = response.read(5000001)
        if len(data) > 5000000:
            return None, "RESPONSE_TOO_LARGE"
        return json.loads(data), None
    except urllib.error.HTTPError as e:
        return None, "HTTP_" + str(e.code)
    except (urllib.error.URLError, OSError, ValueError):
        return None, "PROVIDER_UNAVAILABLE"


def row(id, label, provider, scope, unit, source):
    return dict(id=id, label=label, provider=provider, scope=scope, unit=unit,
                source=source, aggregation="MAX" if id in GAUGES else "SUM",
                status="UNAVAILABLE", total=None, sample_count=0, latest_at=None,
                points=[], hourly={})


def finalize(r, points, start, end):
    acc = {}
    for t, val in points:
        try:
            d = dt.datetime.fromisoformat(str(t).replace("Z", "+00:00"))
        except ValueError:
            continue
        if d.tzinfo is None or not start < d <= end:
            continue
        n = num(val)
        if n is None:
            continue
        key = stamp(d)
        acc[key] = (max(acc.get(key, n), n) if r["aggregation"] == "MAX"
                    else acc.get(key, 0) + n)
    r["points"] = [{"at": t, "value": v} for t, v in sorted(acc.items())]
    hours = {}
    for p in r["points"]:
        k = p["at"][:13] + ":00:00Z"
        v = p["value"]
        hours[k] = max(hours.get(k, v), v) if r["aggregation"] == "MAX" else hours.get(k, 0) + v
    r["hourly"] = dict(sorted(hours.items()))
    r["sample_count"] = len(r["points"])
    r["latest_at"] = r["points"][-1]["at"] if r["points"] else None
    r["total"] = (max(acc.values()) if r["aggregation"] == "MAX" else sum(acc.values())) if acc else None
    r["status"] = "OK" if acc else "NO_DATA"
    return r


def gcp(spec, token, start, end):
    id, label, metric, group, unit = spec
    scope = "GCP_PROJECT_SHARED" if group == "run" else "GCP_PROJECT"
    r = row(id, label, "GOOGLE", scope, unit, metric)
    if not token:
        r["status"] = "AUTH_UNAVAILABLE"
        return r
    if group == "firestore":
        res = 'resource.type="firestore.googleapis.com/Database" AND resource.labels.database_id="(default)"'
    elif group == "rtdb":
        res = 'resource.type="firebase_namespace"'
    elif group.startswith("api:"):
        res = 'resource.type="consumed_api" AND resource.labels.service="' + group[4:] + '"'
    elif group.startswith("run:"):
        res = 'resource.type="cloud_run_revision" AND resource.labels.service_name="' + group[4:] + '"'
    else:
        res = 'resource.type="cloud_run_revision"'
    params = {"filter": 'metric.type="' + metric + '" AND ' + res,
              "interval.startTime": stamp(start), "interval.endTime": stamp(end),
              "view": "FULL", "pageSize": "1000", "aggregation.alignmentPeriod": "300s",
              "aggregation.perSeriesAligner": "ALIGN_MAX" if id in GAUGES else "ALIGN_SUM",
              "aggregation.crossSeriesReducer": "REDUCE_MAX" if id in GAUGES else "REDUCE_SUM"}
    vals = []
    for page in range(6):
        obj, err = request(GCP_API + "?" + urllib.parse.urlencode(params), token,
                           headers={"X-Goog-User-Project": PROJECT})
        if err:
            r["status"] = err
            return r
        series = obj.get("timeSeries", []) if isinstance(obj, dict) else None
        if not isinstance(series, list):
            r["status"] = "MALFORMED"
            return r
        for s in series:
            for p in s.get("points", []):
                val = p.get("value", {})
                vals.append((p.get("interval", {}).get("endTime"),
                             val.get("int64Value", val.get("doubleValue"))))
        next_page = obj.get("nextPageToken")
        if not next_page:
            result = finalize(r, vals, start, end)
            # 2^63-1 is a provider sentinel, not a real RTDB free quota.
            if id == "rtdb_monthly_sent_limit" and result["total"] is not None and result["total"] >= 9223372036854775807:
                result["status"] = "UNBOUNDED_PROVIDER_SENTINEL"
                result["quota_interpretation"] = "Provider sentinel/unbounded; never present as real quota"
                result["total"] = None
            return result
        params["pageToken"] = next_page
    r["status"] = "TRUNCATED"
    return r


def cloudflare(spec, token, account, start, end):
    id, label, dataset, field, metric, unit = spec
    worker = dataset == "workersInvocationsAdaptive"
    r = row(id, label, "CLOUDFLARE", "CF_WORKER_SCRIPT" if worker else "CF_ACCOUNT_SHARED",
            unit, dataset + "." + field + "." + metric)
    if not token or not re.fullmatch("[0-9a-fA-F]{32}", account):
        r["status"] = "AUTH_UNAVAILABLE"
        return r
    filt = ('scriptName:"supra-inventory-beta",datetime_geq:"' + stamp(start) +
            '",datetime_leq:"' + stamp(end) + '"') if worker else (
                'date_geq:"' + start.strftime("%Y-%m-%d") +
                '",date_leq:"' + end.strftime("%Y-%m-%d") + '"')
    query = ('{viewer{accounts(filter:{accountTag:"' + account + '"}){x:' + dataset +
             '(filter:{' + filt + '},limit:1000){dimensions{datetimeFiveMinutes} ' +
             field + '{' + metric + '}}}}}')
    obj, err = request(CF_API + "/graphql", token, {"query": query})
    if err:
        r["status"] = err
        return r
    if not isinstance(obj, dict) or obj.get("errors"):
        r["status"] = "GRAPHQL_SCHEMA_OR_SCOPE"
        return r
    accounts = ((obj.get("data") or {}).get("viewer") or {}).get("accounts") or []
    if len(accounts) != 1 or not isinstance(accounts[0].get("x"), list):
        r["status"] = "GRAPHQL_SCHEMA_OR_SCOPE"
        return r
    items = accounts[0]["x"]
    if len(items) >= 1000:
        r["status"] = "TRUNCATED"
        return r
    return finalize(r, [((p.get("dimensions") or {}).get("datetimeFiveMinutes"),
                         (p.get(field) or {}).get(metric)) for p in items], start, end)


def email(token, zone, start, end):
    r = row("cf_emails_sent", "Email Sending", "CLOUDFLARE", "CF_ZONE_SHARED",
            "emails", "emailSendingAdaptiveGroups.count")
    if not token or not re.fullmatch("[0-9a-fA-F]{32}", zone):
        r["status"] = "AUTH_UNAVAILABLE"
        return r
    query = ('{viewer{zones(filter:{zoneTag:"' + zone +
             '"}){x:emailSendingAdaptiveGroups(filter:{datetimeFiveMinutes_geq:"' +
             stamp(start) + '"},limit:1000){count dimensions{datetimeFiveMinutes}}}}}')
    obj, err = request(CF_API + "/graphql", token, {"query": query})
    if err:
        r["status"] = err
        return r
    if not isinstance(obj, dict) or obj.get("errors"):
        r["status"] = "GRAPHQL_SCHEMA_OR_SCOPE"
        return r
    zones = ((obj.get("data") or {}).get("viewer") or {}).get("zones") or []
    if len(zones) != 1 or not isinstance(zones[0].get("x"), list):
        r["status"] = "GRAPHQL_SCHEMA_OR_SCOPE"
        return r
    items = zones[0]["x"]
    if len(items) >= 1000:
        r["status"] = "TRUNCATED"
        return r
    return finalize(r, [((v.get("dimensions") or {}).get("datetimeFiveMinutes"), v.get("count"))
                        for v in items], start, end)


def billing(token, account):
    r = row("cf_do_sql_storage", "Workers/DO/D1 Billing Cycle", "CLOUDFLARE",
            "CF_ACCOUNT_SHARED", "provider_units", "billable-usage")
    r["aggregation"] = "BILLING_PERIOD_NOT_24H"
    if not token or not re.fullmatch("[0-9a-fA-F]{32}", account):
        r["status"] = "AUTH_UNAVAILABLE"
        return r
    obj, err = request(CF_API + "/accounts/" + account + "/billable-usage", token)
    if err:
        r["status"] = err
        return r
    items = obj.get("result") if isinstance(obj, dict) else None
    if not isinstance(items, list):
        r["status"] = "MALFORMED"
        return r
    clean = []
    for item in items:
        if not isinstance(item, dict):
            continue
        label = " ".join(str(item.get(k, "")) for k in
                         ("ServiceFamilyName", "ServiceName", "ChargeDescription"))
        if not re.search("worker|durable object|d1", label, re.I):
            continue
        entry = {}
        for k in ("ServiceFamilyName", "ServiceName", "ChargeDescription", "x_BillableMetricId",
                  "ConsumedUnit", "ChargePeriodStart", "ChargePeriodEnd"):
            if isinstance(item.get(k), str):
                entry[k] = re.sub("[^a-zA-Z0-9 /_.:T+Z-]", "", item[k])[:100]
        for k in ("ConsumedQuantity", "Usage", "UsageAmount", "ChargeAmount", "Amount", "BilledQuantity"):
            if num(item.get(k)) is not None:
                entry[k] = num(item[k])
        clean.append(entry)
    r["billing_items"] = clean[:100]
    r["status"] = "BILLING_PERIOD" if clean else "NO_DATA"
    r["sample_count"] = len(clean)
    return r



def d173_e170_daily_evidence(secret, day, start, end):
    """One HMAC-authenticated, read-only request to the deployed Worker.

    Output is fixed-category metrics only, never a raw Drive log, URL,
    filename, user identifier, credential or Firebase token.
    """
    if not secret or len(secret) < 20:
        return {"status": "AUTH_UNAVAILABLE"}
    domain, path = "D173_SQL_QUERY_ID_AUDIT_V1", "/api/internal/d173/sql-evidence"
    timestamp = str(int(time.time()))
    payload = "\n".join([domain, "GET", path, timestamp]).encode()
    signature = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    url = "https://inventory.supra.cc.cd" + path + "?mode=DAILY_EVIDENCE&day=" + str(day)
    req = urllib.request.Request(url, headers={
        "x-d173-audit-ts": timestamp, "x-d173-audit-hmac": signature,
        "accept": "application/json",
    }, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=50) as response:
            content = response.read(1800001)
        if len(content) > 1800000:
            return {"status": "RESPONSE_TOO_LARGE"}
        evidence = json.loads(content)
        if not isinstance(evidence, dict) or evidence.get("schema") != "D173_DAILY_DIAGNOSTIC_V1":
            return {"status": "DEPLOYED_SERVICE_SCHEMA_MISMATCH"}
        if evidence.get("day_vn") != str(day) or evidence.get("start_utc") != stamp(start) or evidence.get("end_utc") != stamp(end):
            return {"status": "WINDOW_MISMATCH"}
        if evidence.get("complete_fleet") is True:
            # Unattested fleet completeness must never be auto-inferred.
            evidence["complete_fleet"] = False
        return evidence
    except urllib.error.HTTPError as exc:
        return {"status": "WORKER_HTTP_" + str(exc.code)}
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError):
        return {"status": "WORKER_READ_UNAVAILABLE"}


def d173_e170_evidence_summary(evidence, metrics):
    if evidence.get("schema") != "D173_DAILY_DIAGNOSTIC_V1":
        return {"status": evidence.get("status", "UNAVAILABLE"), "provider_join": "UNAVAILABLE"}
    core = evidence.get("do_sql") if isinstance(evidence.get("do_sql"), dict) else {}
    rows = core.get("hourly") if isinstance(core.get("hourly"), list) else []
    aggregates = {}
    for row in rows:
        if not isinstance(row, dict): continue
        kind, key = row.get("metric_kind"), row.get("metric_id")
        if kind not in ("ROUTE", "SQL") or not isinstance(key, str) or not re.fullmatch(r"[A-Z0-9_]{1,48}", key):
            continue
        k = kind + ":" + key
        if k not in aggregates:
            aggregates[k] = {"category": k, "executions": 0, "rows_read": 0, "rows_written": 0}
        for fld in ("executions", "rows_read", "rows_written"):
            n = row.get(fld)
            if isinstance(n, int) and not isinstance(n, bool) and n >= 0:
                aggregates[k][fld] += n
    top = sorted(aggregates.values(), key=lambda x: (-x["rows_read"], -x["executions"]))[:15]
    provider = {m["id"]: m for m in metrics}
    valid = all(provider.get(k, {}).get("status") == "OK" for k in ("cf_do_requests", "cf_do_rows_read"))
    receipts = evidence.get("web_android_receipts") if isinstance(evidence.get("web_android_receipts"), dict) else {}
    agent = evidence.get("agent_drive") if isinstance(evidence.get("agent_drive"), dict) else {}
    return {
        "status": "PARTIAL_SCOPED_DIAGNOSTICS" if rows or receipts.get("by_hour") else "NO_SCOPED_RECORDS",
        "provider_join": "SAME_WINDOW_ACCOUNT_SHARED_NOT_EXACT_ATTRIBUTION" if valid else "PROVIDER_INCOMPLETE",
        "diagnostic_rows": len(rows),
        "top_categories": top,
        "web_android": receipts.get("by_hour") if isinstance(receipts.get("by_hour"), list) else [],
        "web_android_source_status": receipts.get("status", "UNAVAILABLE"),
        "agent_drive_status": agent.get("status", "UNAVAILABLE"),
        "agent_drive_files_observed": agent.get("files_observed"),
        "agent_drive_files_parsed": agent.get("files_parsed"),
        "agent_diagnostic_codes": agent.get("diagnostics") if isinstance(agent.get("diagnostics"), dict) else {},
        "fleet_coverage": "UNVERIFIED",
        "source_commit": evidence.get("production_source_commit", "UNVERIFIED"),
        "scope": "INVENTORY_CORE_ESTIMATED_VS_CLOUDFLARE_ACCOUNT_SHARED",
        "root_cause": "UNVERIFIED",
    }


def analyze(report):
    meta, metrics = report["metadata"], report["metrics"]
    statuses = Counter(m["status"] for m in metrics)
    lines = ["# Usage 24h " + meta["day_vn"], "",
             "Khung đo: " + meta["start_vn"] + " tới " + meta["end_vn"] + " (Việt Nam).",
             "Nguồn: Cloudflare GraphQL/Billing, Google Cloud Monitoring. Không dùng số ước tính Agent.",
             "Thời điểm tổng hợp 05:30 ngày kế tiếp; ngày báo cáo = ngày bắt đầu 05:00.",
             "Đối chiếu log Agent/Web/Android/Service: CHỜ CHỐT CƠ CHẾ THU LOG, không kết luận từ log chưa có.",
             "DO/D1 và Email có phạm vi account/zone dùng chung, không gán riêng cho Báo hàng.",
             "NO_DATA, lỗi provider hoặc thiếu quyền KHÔNG được coi là 0.",
             "Billing cycle KHÔNG phải số usage 24h. Nguồn có thể ghi nhận trễ.",
             "", "## Độ đầy đủ", "",
             "36 metrics: " + ", ".join(k + "=" + str(v) for k, v in sorted(statuses.items())),
             "", "## Chi tiết", "",
             "| Nhóm | Chỉ số | Phạm vi | Trạng thái | Tổng/đỉnh 24h | Mẫu | Mốc mẫu mới nhất UTC |",
             "|---|---|---|---|---:|---:|---|"]
    warnings = []
    for m in metrics:
        v = "N/A" if m["total"] is None else format(m["total"], ",")
        lines.append("| " + " | ".join([m["provider"], m["label"].replace("|", "/"),
                                         m["scope"], m["status"], v, str(m["sample_count"]),
                                         m["latest_at"] or "N/A"]) + " |")
        if m["status"] not in ("OK", "BILLING_PERIOD"):
            warnings.append("- Dữ liệu thiếu/lỗi: " + m["id"] + " = " + m["status"])
        if m["status"] == "OK" and m["aggregation"] == "SUM":
            hourly = list(m["hourly"].values())
            if len(hourly) >= 6 and max(hourly) >= 100 and statistics.median(hourly) > 0:
                if max(hourly) >= 3 * statistics.median(hourly):
                    warnings.append("- Cần đối chiếu log: " + m["id"] +
                                    ", đỉnh giờ " + format(max(hourly), ",") +
                                    ", >=3 lần trung vị giờ. Không tự kết luận lỗi.")
    correlation = report.get("diagnostic_correlation", {})
    lines += ["", "## Đối soát Service / Agent / Drive", "",
              "- Trạng thái: " + str(correlation.get("status", "UNAVAILABLE")),
              "- Provider ↔ Core: " + str(correlation.get("provider_join", "UNAVAILABLE")),
              "- Web/Android staged receipts: " + str(correlation.get("web_android_source_status", "UNAVAILABLE")),
              "- Agent Drive: " + str(correlation.get("agent_drive_status", "UNAVAILABLE")) +
                " (observed=" + str(correlation.get("agent_drive_files_observed")) +
                ", parsed=" + str(correlation.get("agent_drive_files_parsed")) + ")",
              "- Fleet coverage: UNVERIFIED; không đánh đồng log đã đọc với số máy cần hoạt động.",
              "", "### Top SQL/DO nguồn nội bộ (KHÔNG PHẢI billing provider)", "",
              "| Nguồn | Lượt | Rows Read | Rows Written |",
              "|---|---:|---:|---:|"]
    for item in correlation.get("top_categories", [])[:15]:
        lines.append("| " + item["category"] + " | " + str(item["executions"]) +
                     " | " + str(item["rows_read"]) + " | " + str(item["rows_written"]) + " |")
    if correlation.get("agent_diagnostic_codes"):
        lines += ["", "### Agent Firebase/HA — mã lỗi đã ẩn thông tin nhạy cảm", ""]
        for code, hits in sorted(correlation["agent_diagnostic_codes"].items()):
            lines.append("- " + code + ": " + str(hits))
    lines += ["", "Thiếu/đến muộn/không truy cập được log phải ghi PARTIAL hoặc UNATTRIBUTED; "
              "không tự xác nhận đã tìm ra nguyên nhân khi thiếu bằng chứng.", ""]

    lines += ["", "## Điểm bất thường cần kiểm tra", ""]
    lines += warnings or ["- Chưa có dấu hiệu bất thường theo quy tắc thống kê đơn giản."]
    lines += ["", "JSON lưu mẫu nguồn và phân bố theo giờ để so sánh ngày sau.",
              "Không lấy báo cáo này làm hóa đơn hoặc kết luận số tiền thực tế.", ""]
    return "\n".join(lines)


def report_window(now, override=""):
    """Return Vietnam report date N-1 and [05:00 N-1, 05:00 N] as UTC.
    A scheduled run is at 22:30 UTC (05:30 VN); window closes 22:00 UTC.
    An explicitly specified report_date is the START day in Vietnam.
    """
    try:
        day = dt.date.fromisoformat(override) if override else (now - dt.timedelta(hours=22)).date()
    except ValueError:
        raise ValueError("INVALID_REPORT_DATE")
    end = dt.datetime.combine(day, dt.time(22, 0), UTC)
    start = end - dt.timedelta(days=1)
    return day, start, end


def main():
    now = dt.datetime.now(UTC)
    override = os.environ.get("REPORT_DATE", "").strip()
    try:
        day, start, end = report_window(now, override)
    except ValueError:
        sys.exit("INVALID_REPORT_DATE")
    if now < end:
        sys.exit("WINDOW_NOT_COMPLETE")
    if now - end > dt.timedelta(days=35):
        sys.exit("DATE_OUTSIDE_PROVIDER_RETENTION_WINDOW")
    g, c = metric_inventory()
    gt = os.environ.get("GCP_ACCESS_TOKEN", "")
    if not gt and os.environ.get("GCP_USAGE_SA_JSON"):
        try:
            # Read authenticated OAuth token through the D159-tested gcloud path.
            # Capture stdout in memory; never print or persist access tokens.
            gt = subprocess.run(["gcloud", "auth", "print-access-token"],
                                capture_output=True, text=True, timeout=20,
                                check=True).stdout.strip()
        except (OSError, subprocess.SubprocessError):
            gt = ""
    ct = os.environ.get("D166_CF_READ_TOKEN", "")
    ca = os.environ.get("CF_ACCOUNT_ID", "")
    et = os.environ.get("D173_CF_EMAIL_ANALYTICS_READ", "")
    zone = os.environ.get("CF_ZONE_ID", "")
    functions = ([lambda s=s: gcp(s, gt, start, end) for s in g] +
                 [lambda s=s: cloudflare(s, ct, ca, start, end) for s in c] +
                 [lambda: email(et, zone, start, end), lambda: billing(ct, ca)])
    with futures.ThreadPoolExecutor(max_workers=4) as pool:
        metrics = list(pool.map(lambda f: f(), functions))
    diagnostic = d173_e170_daily_evidence(ct, day, start, end)
    vn = dt.timezone(dt.timedelta(hours=7))
    report = {"schema": "D173_USAGE_DAILY_V1",
              "metadata": {"day_vn": str(day), "start_utc": stamp(start), "end_utc": stamp(end),
                           "report_schedule_vn": "05:30", "business_cutoff_vn": "05:00",
                           "log_correlation": "PENDING_VERIFIED_DRIVE_LOG_COVERAGE",
                           "log_protocol": "OWNER_APPROVED_2H_WEB_SERVICE_BUFFERED",
                           "repository_source_sha": os.environ.get("GITHUB_SHA", "UNVERIFIED")[:40],
                           "production_deployment_sha": "UNVERIFIED_NOT_AUTO_INFERRED_FROM_MAIN",
                           "root_cause_status": "UNVERIFIED_NO_JOINED_DRIVE_LOGS",
                           "start_vn": start.astimezone(vn).strftime("%d/%m/%Y %H:%M"),
                           "end_vn": end.astimezone(vn).strftime("%d/%m/%Y %H:%M"),
                           "collected_at_utc": stamp(now),
                           "source": "service/src/d173-vps-usage.ts",
                           "secret_material_excluded": True},
              "metrics": metrics}
    report["diagnostic_correlation"] = d173_e170_evidence_summary(diagnostic, metrics)
    if diagnostic.get("schema") == "D173_DAILY_DIAGNOSTIC_V1":
        report["metadata"]["log_correlation"] = "PARTIAL_SCOPED_EVIDENCE_JOINED"
        report["metadata"]["root_cause_status"] = "ANALYSIS_PENDING_WITH_SCOPED_EVIDENCE"
        report["diagnostic_evidence"] = diagnostic
    else:
        report["metadata"]["log_correlation"] = diagnostic.get("status", "UNAVAILABLE")
    out = pathlib.Path("evidence")
    out.mkdir(exist_ok=True)
    (out / ("usage-" + str(day) + ".json")).write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / ("analysis-" + str(day) + ".md")).write_text(analyze(report), encoding="utf-8")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write("report_day=" + str(day) + "\n")
    s = Counter(m["status"] for m in metrics)
    print("D173_USAGE_DAY=" + str(day))
    print("D173_USAGE_METRICS=" + str(len(metrics)))
    print("D173_USAGE_STATUSES=" + json.dumps(s, sort_keys=True))
    if not any(m["status"] == "OK" for m in metrics if m["id"] in
               ("firestore_reads", "cf_do_requests", "cf_worker_requests")):
        print("D173_USAGE_CORE_PROVIDER_NOT_VERIFIED")
        sys.exit(1)


if __name__ == "__main__":
    main()
