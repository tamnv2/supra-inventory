#!/usr/bin/env python3
"""D173-E057: one-shot provider usage READ-ONLY feasibility check.

Runs in an isolated CI job; uses existing beta GitHub secrets transiently.
Never prints tokens, raw API responses, request URLs, SQL, or user data.
A returned numeric timeseries => PASS_DATA/PASS_ZERO; HTTP 200 with
no timeseries => NO_DATA (not a false PASS).
"""
import argparse
import datetime as dt
import json
import os
import re
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

PROJECT = "supra-inventory-beta"
WORKER = "supra-inventory-beta"
GOOGLE_METRICS = {
    "firestore_reads": ("firestore.googleapis.com/document/read_ops_count", "firestore"),
    "firestore_writes": ("firestore.googleapis.com/document/write_ops_count", "firestore"),
    "firestore_deletes": ("firestore.googleapis.com/document/delete_ops_count", "firestore"),
    "firestore_connections": ("firestore.googleapis.com/network/active_connections", "firestore"),
    "firestore_listeners": ("firestore.googleapis.com/network/snapshot_listeners", "firestore"),
    "firestore_rules": ("firestore.googleapis.com/rules/evaluation_count", "firestore"),
    "firestore_storage": ("firestore.googleapis.com/storage/data_and_index_storage_bytes", "firestore"),
    "fcm_requests": ("serviceruntime.googleapis.com/api/request_count", "api:fcm.googleapis.com"),
    "auth_identity_requests": ("serviceruntime.googleapis.com/api/request_count", "api:identitytoolkit.googleapis.com"),
    "auth_secure_requests": ("serviceruntime.googleapis.com/api/request_count", "api:securetoken.googleapis.com"),
    "sheets_requests": ("serviceruntime.googleapis.com/api/request_count", "api:sheets.googleapis.com"),
    "drive_requests": ("serviceruntime.googleapis.com/api/request_count", "api:drive.googleapis.com"),
    "cloud_run_requests": ("run.googleapis.com/request_count", "run:inventory-beta-picker-alerts"),
    "cloud_run_instances": ("run.googleapis.com/container/instance_count", "run:inventory-beta-picker-alerts"),
    "cloud_run_billable_time": ("run.googleapis.com/container/billable_instance_time", "run:inventory-beta-picker-alerts"),
    "cloud_run_agent_log_requests": ("run.googleapis.com/request_count", "run:agentloguploadwritten"),
    "rtdb_api_hits": ("firebasedatabase.googleapis.com/network/api_hits_count", "rtdb"),
    "rtdb_https_requests": ("firebasedatabase.googleapis.com/network/https_requests_count", "rtdb"),
    "rtdb_connections": ("firebasedatabase.googleapis.com/network/active_connections", "rtdb"),
    "rtdb_monthly_sent": ("firebasedatabase.googleapis.com/network/monthly_sent", "rtdb"),
    "rtdb_monthly_sent_limit": ("firebasedatabase.googleapis.com/network/monthly_sent_limit", "rtdb"),
    "rtdb_sent_bytes": ("firebasedatabase.googleapis.com/network/sent_bytes_count", "rtdb"),
    "rtdb_payload_bytes": ("firebasedatabase.googleapis.com/network/sent_payload_bytes_count", "rtdb"),
    "rtdb_protocol_bytes": ("firebasedatabase.googleapis.com/network/sent_payload_and_protocol_bytes_count", "rtdb"),
    "rtdb_storage_bytes": ("firebasedatabase.googleapis.com/storage/total_bytes", "rtdb"),
    "rtdb_rules": ("firebasedatabase.googleapis.com/rules/evaluation_count", "rtdb"),
}
# Scope is account-wide except the inventory Worker filter. The existing
# InventoryCore DO namespace id is NOT registered: do not claim DO account
# counters are proven to belong solely to Inventory.
CF_METRICS = {
    "cf_do_requests": ("account", "durableObjectsInvocationsAdaptiveGroups", "sum{requests}"),
    "cf_do_compute_duration": ("account", "durableObjectsPeriodicGroups", "sum{cpuTime}"),
    "cf_do_rows_read": ("account", "durableObjectsStorageGroups", "sum{rowsRead}"),
    "cf_do_rows_written": ("account", "durableObjectsStorageGroups", "sum{rowsWritten}"),
    "cf_do_sql_storage": ("account", "durableObjectsStorageGroups", "max{storedBytes}"),
    "cf_worker_requests": ("worker", "workersInvocationsAdaptive", "sum{requests}"),
    "cf_worker_cpu": ("worker", "workersInvocationsAdaptive", "sum{cpuTimeUs}"),
    "cf_d1_rows_read": ("account", "d1AnalyticsAdaptiveGroups", "sum{rowsRead}"),
    "cf_d1_storage": ("account", "d1StorageAdaptiveGroups", "max{databaseSizeBytes}"),
    "cf_emails_sent": ("zone", "emailSendingAdaptiveGroups", "count"),
}

def request_json(url, headers, method="GET", body=None):
    data = json.dumps(body).encode("utf8") if body is not None else None
    req = urllib.request.Request(url, headers=headers, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=18) as res:
            return res.status, json.load(res)
    except urllib.error.HTTPError as exc:
        return exc.code, None
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return 0, None

def numeric(obj):
    if not isinstance(obj, dict):
        return None
    for key in ("doubleValue", "int64Value", "boolValue"):
        if key in obj:
            try:
                return float(obj[key])
            except (ValueError, TypeError):
                return None
    return None

def code_status(code):
    if code in (401,403): return "PERMISSION"
    if code == 404: return "UNSUPPORTED_OR_NOT_FOUND"
    if code == 429: return "RATE_LIMIT"
    if code == 0: return "NETWORK_ERROR"
    return "HTTP_ERROR"

def google_probe(token):
    out = {}
    now = dt.datetime.now(dt.timezone.utc)
    end = now.isoformat().replace("+00:00", "Z")
    start = (now-dt.timedelta(hours=24)).isoformat().replace("+00:00", "Z")
    for key, (metric, scope) in GOOGLE_METRICS.items():
        if not token:
            out[key] = {"status":"NO_CREDENTIALS","provider":"GCP"}
            continue
        selectors = {
            "firestore": 'resource.type="firestore.googleapis.com/Database" AND resource.labels.database_id="(default)"',
            "rtdb": 'resource.type="firebase_namespace"',
        }
        if scope.startswith("api:"):
            resource = 'resource.type="consumed_api" AND resource.labels.service="' + scope[4:] + '"'
        elif scope.startswith("run:"):
            resource = 'resource.type="cloud_run_revision" AND resource.labels.service_name="' + scope[4:] + '"'
        else:
            resource = selectors[scope]
        params = urllib.parse.urlencode({
            "filter": 'metric.type="' + metric + '" AND ' + resource,
            "interval.startTime":start, "interval.endTime":end,
            "view":"FULL", "pageSize":"10",
            "aggregation.alignmentPeriod":"3600s",
            "aggregation.perSeriesAligner":"ALIGN_SUM",
        })
        status, obj = request_json(
            "https://monitoring.googleapis.com/v3/projects/" + PROJECT + "/timeSeries?" + params,
            {"Authorization":"Bearer "+token, "X-Goog-User-Project":PROJECT,"Accept":"application/json"})
        if status != 200:
            out[key]={"status":code_status(status),"provider":"GCP","http":status}
            continue
        series = obj.get("timeSeries",[]) if isinstance(obj,dict) else []
        values = [v for s in series for p in s.get("points",[]) for v in [numeric(p.get("value",{}))] if v is not None]
        st = "PASS_DATA" if any(v!=0 for v in values) else ("PASS_ZERO" if values else "NO_DATA")
        out[key]={"status":st,"provider":"GCP","series":len(series),"points":len(values),
                  "truncated":bool(obj.get("nextPageToken"))}
    return out

def cloudflare_probe(token, account, zone):
    out = {}
    yesterday = (dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=24)).strftime("%Y-%m-%d")
    for key, (scope, dataset, selection) in CF_METRICS.items():
        if not token:
            out[key]={"status":"NO_CREDENTIALS","provider":"CF"}
            continue
        tag = zone if scope=="zone" else account
        if not tag or not re.fullmatch("[0-9a-fA-F]{32}", tag):
            out[key]={"status":"NO_TARGET","provider":"CF"}
            continue
        group = 'zones' if scope=="zone" else 'accounts'
        ident = "zoneTag" if scope=="zone" else "accountTag"
        extra = 'scriptName:"'+WORKER+'",' if scope=="worker" else ""
        f = 'filter:{'+extra+'date_geq:"'+yesterday+'"}'
        # workersInvocationsAdaptive is an exception: it uses datetime filters.
        if scope=="worker":
            f = 'filter:{scriptName:"'+WORKER+'",datetime_geq:"'+yesterday+'T00:00:00Z"}'
        q = '{viewer{'+group+'(filter:{'+ident+':"'+tag+'"}){v:'+dataset+'(limit:1,'+f+'){'+selection+'}}}}'
        code, obj = request_json(
            "https://api.cloudflare.com/client/v4/graphql",
            {"Authorization":"Bearer "+token,"Content-Type":"application/json","Accept":"application/json"},
            "POST",{"query":q})
        if code != 200:
            out[key]={"status":code_status(code),"provider":"CF","http":code,"scope":scope}
            continue
        if not isinstance(obj,dict) or obj.get("errors"):
            out[key]={"status":"QUERY_SCHEMA_OR_PERMISSION","provider":"CF","scope":scope}
            continue
        viewer = (obj.get("data") or {}).get("viewer") or {}
        entries = viewer.get(group) or []
        rows = entries[0].get("v") if len(entries)==1 else None
        if not isinstance(rows,list):
            out[key]={"status":"NO_DATA_OR_SCOPE","provider":"CF","scope":scope}
            continue
        v = rows[0].get("count") if rows and selection=="count" else ((rows[0].get("sum") if selection.startswith("sum") else rows[0].get("max")) if rows else None)
        if isinstance(v,dict): v = next(iter(v.values()),None)
        try: v=float(v)
        except (ValueError,TypeError): v=None
        state="PASS_DATA" if v is not None and v!=0 else ("PASS_ZERO" if v is not None else "NO_DATA")
        out[key]={"status":state,"provider":"CF","scope":scope,"samples":len(rows)}
    return out

def run():
    parser=argparse.ArgumentParser()
    parser.add_argument("--selftest",action="store_true")
    parser.add_argument("--output",default="usage-probe-results.json")
    args=parser.parse_args()
    if len(GOOGLE_METRICS)!=26 or len(CF_METRICS)!=10:
        raise SystemExit("EXPECTED_EXACT_26_GOOGLE_10_CF")
    if args.selftest:
        print("D173_E057_STATIC_MATRIX_PASS_36")
        return
    goog=google_probe(os.getenv("GCP_ACCESS_TOKEN",""))
    cf=cloudflare_probe(os.getenv("D166_CF_READ_TOKEN",""),
                        os.getenv("CF_ACCOUNT_ID",""),os.getenv("CF_ZONE_ID",""))
    results={**goog,**cf}
    counts={}
    for v in results.values(): counts[v["status"]]=counts.get(v["status"],0)+1
    report={"schema":"D173_E057_READONLY_PROBE_V1","count":len(results),
            "generated_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
            "counts":counts, "metrics":results,
            "warning":"PASS is provider returned data, NOT billing exactness or InventoryCore namespace attribution."}
    Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    for key in sorted(results):
        print(key+"="+results[key]["status"])
    print("D173_E057_TOTAL="+str(len(results))+" STATUS="+json.dumps(counts,sort_keys=True))

if __name__=="__main__":
    run()
