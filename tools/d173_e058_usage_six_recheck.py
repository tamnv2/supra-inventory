#!/usr/bin/env python3
"""D173-E058: bounded, read-only second-pass on SIX unresolved usage metrics.

Existing beta identities only. Writes sanitized categories, never raw data,
request URLs, provider errors, credentials, message contents or service lists.
No Agent/Worker/WMS business operation, no provider mutation.
"""
import datetime as dt
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT = "supra-inventory-beta"
ALLOWED_RUN_SERVICES = ("inventory-beta-picker-alerts", "agentloguploadwritten")
API_CF = "https://api.cloudflare.com/client/v4"
LOOKBACK_DAYS = 30
MISSING = ("cf_do_sql_storage", "cf_emails_sent", "cloud_run_requests",
           "cloud_run_instances", "cloud_run_billable_time",
           "cloud_run_agent_log_requests")

def fetch_json(url, token, *, body=None, gcp=False):
    if not token:
        return (0, None)
    headers = {"Authorization":"Bearer " + token, "Accept":"application/json"}
    if gcp:
        headers["X-Goog-User-Project"] = PROJECT
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        url, headers=headers, method="POST" if body is not None else "GET",
        data=json.dumps(body).encode("utf8") if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return (r.status, json.load(r))
    except urllib.error.HTTPError as e:
        # Only error category is kept; untrusted provider response not logged.
        try:
            obj = json.load(e)
        except Exception:
            obj = None
        return (e.code, obj)
    except (TimeoutError, urllib.error.URLError, OSError, ValueError):
        return (0, None)

def classify_http(status):
    return {0:"NETWORK_OR_MISSING_CREDENTIALS", 401:"DENIED",403:"DENIED",
            404:"UNAVAILABLE",429:"RATE_LIMIT"}.get(status, "HTTP_FAIL")

def cf_query(token, query):
    status, obj = fetch_json(API_CF + "/graphql", token, body={"query":query})
    if status != 200:
        return classify_http(status), {}
    if not isinstance(obj, dict):
        return "MALFORMED", {}
    errors = obj.get("errors") or []
    if errors:
        # Report only safe classifications, not raw error messages.
        message = " ".join(str(err.get("message","")) for err in errors if isinstance(err, dict)).lower()
        if any(w in message for w in ("permission","not authorized","access denied","not permitted")):
            return "PERMISSION", {}
        if any(w in message for w in ("unknown argument","cannot query field","unknown field","does not exist","invalid field")):
            return "SCHEMA", {}
        return "GRAPHQL_ERROR", {}
    return "OK", obj.get("data") or {}

def numeric(value):
    try:
        v = float(value)
        return v if (v >= 0 and v != float("inf")) else None
    except (TypeError, ValueError, OverflowError):
        return None

def cf_storage(account, token, start):
    if not re.fullmatch(r"[A-Fa-f0-9]{32}", account or ""):
        return {"status":"NO_SCOPE_ID"}
    q = ('{viewer{accounts(filter:{accountTag:"' + account + '"})'
         '{x:durableObjectsStorageGroups(filter:{date_gt:"' + start +
         '"},limit:20){max{storedBytes}}}}}')
    status, data = cf_query(token, q)
    if status != "OK":
        return {"status":status}
    accounts = (data.get("viewer") or {}).get("accounts") or []
    rows = accounts[0].get("x") if len(accounts)==1 else None
    if not isinstance(rows, list):
        return {"status":"INVALID_ACCOUNT_SCOPE"}
    values = [numeric((row.get("max") or {}).get("storedBytes")) for row in rows if isinstance(row,dict)]
    valid = [v for v in values if v is not None]
    return {"status": "PASS_DATA" if any(v>0 for v in valid) else
            ("PASS_ZERO" if valid else "NO_DATA"),
            "dataset":"DURABLE_OBJECTS_STORAGE_GROUPS",
            "rows":len(rows),"numeric_points":len(valid),"scope":"ACCOUNT_ONLY"}

def cf_email(zone, analytics_token, send_token, start, end, account):
    if not re.fullmatch(r"[A-Fa-f0-9]{32}",zone or ""):
        return {"status":"NO_SCOPE_ID"}
    # Directly from official documentation, zoneTag, date filter and count.
    q = ('{viewer{zones(filter:{zoneTag:"'+zone+'"}){x:emailSendingAdaptiveGroups'
         '(filter:{date_geq:"'+start+'",date_leq:"'+end+
         '"},limit:20){count dimensions{date status}}}}}')
    analytics_status, data = cf_query(analytics_token, q)
    entries = ((data.get("viewer") or {}).get("zones") or []) if analytics_status=="OK" else []
    rows = entries[0].get("x") if len(entries)==1 else None
    valid = [numeric(row.get("count")) for row in (rows or []) if isinstance(row,dict)] if isinstance(rows,list) else []
    points = [v for v in valid if v is not None]
    # The send-token has a registered read-only quota GET, but *never*
    # send, create or modify email; quota is not time-series analytics.
    quota_status, quota_obj = (0,None)
    if send_token and re.fullmatch(r"[A-Fa-f0-9]{32}",account or ""):
        quota_status, quota_obj = fetch_json(
            API_CF + "/accounts/" + account + "/email/sending/limits",send_token)
    quota_ok = quota_status==200 and isinstance(quota_obj,dict) and quota_obj.get("success") is True
    return {"status":("PASS_DATA" if any(v>0 for v in points) else
                     "PASS_ZERO" if points else
                     "NO_DATA" if analytics_status=="OK" else analytics_status),
            "graphQL_status":analytics_status,
            "graphQL_rows":len(rows) if isinstance(rows,list) else 0,
            "quota_read_status":("PASS_QUOTA_ONLY" if quota_ok else classify_http(quota_status)),
            "scope":"ZONE_ONLY"}

def google_query(token, metric, service, start, end, aligner="ALIGN_SUM"):
    # Same approved Cloud Monitoring project, authenticated read only.
    clause = 'metric.type="' + metric + '" AND resource.type="cloud_run_revision"'
    if service:
        clause += ' AND resource.labels.service_name="' + service + '"'
    params = urllib.parse.urlencode({
        "filter": clause, "interval.startTime":start,"interval.endTime":end,
        "view":"FULL", "pageSize":"100",
        "aggregation.alignmentPeriod":"3600s",
        "aggregation.perSeriesAligner": aligner})
    status,obj=fetch_json("https://monitoring.googleapis.com/v3/projects/"+PROJECT+
        "/timeSeries?"+params,token,gcp=True)
    if status != 200:
        return {"status":classify_http(status)}
    if not isinstance(obj,dict):
        return {"status":"MALFORMED"}
    series=obj.get("timeSeries") or []
    valid=0
    nonzero=0
    # Do not return resource identities (might be non-Inventory services).
    for item in series:
        for point in item.get("points",[]):
            val=point.get("value") or {}
            n=numeric(val.get("int64Value",val.get("doubleValue")))
            if n is not None:
                valid+=1
                nonzero+=int(n>0)
    return {"status":"PASS_DATA" if nonzero else "PASS_ZERO" if valid else "NO_DATA",
            "points":valid,"series":len(series),"truncated":bool(obj.get("nextPageToken"))}

def run_service_presence(token):
    if not token: return {"status":"NO_CREDENTIALS"}
    base = "https://run.googleapis.com/v2/projects/"+PROJECT+"/locations/asia-southeast1/services"
    status, obj=fetch_json(base+"?pageSize=100",token,gcp=True)
    if status != 200: return {"status":classify_http(status)}
    if not isinstance(obj,dict): return {"status":"MALFORMED"}
    names=[str(s.get("name","")).lower().split("/")[-1] for s in obj.get("services",[])
           if isinstance(s,dict)]
    return {"status":"READ_OK","inventory_picker_alert_service":
            ALLOWED_RUN_SERVICES[0] in names,
            "agent_log_service":ALLOWED_RUN_SERVICES[1] in names,
            "has_next_page":bool(obj.get("nextPageToken"))}

def main():
    now=dt.datetime.now(dt.timezone.utc)
    start=(now-dt.timedelta(days=LOOKBACK_DAYS)).isoformat().replace("+00:00","Z")
    end=now.isoformat().replace("+00:00","Z")
    today=now.strftime("%Y-%m-%d")
    start_date=(now-dt.timedelta(days=LOOKBACK_DAYS-1)).strftime("%Y-%m-%d")
    gtoken=os.getenv("GCP_ACCESS_TOKEN","")
    cftoken=os.getenv("D166_CF_READ_TOKEN","")
    sentoken=os.getenv("CF_API_TOKEN_D173_EMAIL_SEND","")
    account=os.getenv("CF_ACCOUNT_ID","")
    zone=os.getenv("CF_ZONE_ID","")
    services=run_service_presence(gtoken)
    results={
        "cf_do_sql_storage":cf_storage(account,cftoken,start_date),
        "cf_emails_sent":cf_email(zone,cftoken,sentoken,start_date,today,account)
    }
    options={
        "cloud_run_requests":("run.googleapis.com/request_count",ALLOWED_RUN_SERVICES[0],"ALIGN_SUM"),
        "cloud_run_instances":("run.googleapis.com/container/instance_count",ALLOWED_RUN_SERVICES[0],"ALIGN_MAX"),
        "cloud_run_billable_time":("run.googleapis.com/container/billable_instance_time",ALLOWED_RUN_SERVICES[0],"ALIGN_SUM"),
        "cloud_run_agent_log_requests":("run.googleapis.com/request_count",ALLOWED_RUN_SERVICES[1],"ALIGN_SUM")
    }
    allrun={}
    for key,(metric,service,aligner) in options.items():
        allrun[key]=google_query(gtoken,metric,service,start,end,aligner)
        results[key]=allrun[key]
    # Diagnostic probes with no service filter, but no other service identities
    # or values ever leave the runner. Used only to distinguish no project
    # activity from incorrect filter. Do not treat other projects as Inventory.
    broad={}
    for metric,aligner in (("run.googleapis.com/request_count","ALIGN_SUM"),
                           ("run.googleapis.com/container/instance_count","ALIGN_MAX"),
                           ("run.googleapis.com/container/billable_instance_time","ALIGN_SUM")):
        broad[metric.split("/")[-1]]=google_query(gtoken,metric,None,start,end,aligner)
    report={"schema":"D173_E058_SIX_FOCUSED_READONLY_V1","window_days":LOOKBACK_DAYS,
        "timestamp_utc":now.isoformat(),"results":results,
        "cloud_run_registered_service_presence":services,
        "cloud_run_project_scope_diagnostic":broad,
        "warning":"Cloudflare DO account/Email quota and GCP broad metrics are NOT exact Inventory billed usage. No Agent release authorized."}
    if set(results)!=set(MISSING):raise SystemExit("SIX_KEYS_NOT_MATCHED")
    Path("d173-e058-six-metrics-status.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    for key in MISSING:
        print(key+"="+results[key]["status"])
    print("D173_E058_SIX_METRIC_READONLY_COMPLETE=6")
    print("D173_E058_CLOUD_RUN_SERVICE_PRESENCE="+services["status"])
if __name__=="__main__":
    main()
