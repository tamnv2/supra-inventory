#!/usr/bin/env python3
"""D173-E083: one-shot read-only 5-minute freshness / batch feasibility.
No provider amounts, identifiers, URLs, credentials or raw errors printed.
Do not execute on an Agent/Worker runtime; only approved GitHub beta CI.
"""
import datetime as dt
import json
import os
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

UTC = dt.timezone.utc
NOW = dt.datetime.now(UTC)
START = NOW - dt.timedelta(minutes=75)
RESULT = {"schema": "D173_E083_READONLY", "generated_utc": NOW.isoformat(), "calls": 0}
ALLOW = ("fcm.googleapis.com", "identitytoolkit.googleapis.com",
         "securetoken.googleapis.com", "drive.googleapis.com", "sheets.googleapis.com")

def call(url, token, payload=None, gcp=False):
    if not token: return ("NO_CREDENTIALS", None)
    hdr = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    if gcp: hdr["X-Goog-User-Project"] = "supra-inventory-beta"
    if payload is not None: hdr["Content-Type"] = "application/json"
    req = urllib.request.Request(url, headers=hdr,
            data=json.dumps(payload).encode("utf8") if payload is not None else None,
            method="POST" if payload is not None else "GET")
    RESULT["calls"] += 1
    try:
        with urllib.request.urlopen(req, timeout=18) as resp:
            return ("HTTP_200", json.load(resp))
    except urllib.error.HTTPError as exc:
        return ("HTTP_" + str(exc.code), None)
    except Exception:
        return ("NETWORK_OR_TIMEOUT", None)

def age_minutes(stamp):
    if not stamp: return None
    try:
        t = dt.datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
        return round((NOW-t).total_seconds()/60, 1)
    except (ValueError, TypeError):
        return None

def cf_probe():
    acct = os.getenv("CF_ACCOUNT_ID", "")
    token = os.getenv("D166_CF_READ_TOKEN", "")
    if len(acct) != 32 or not token:
        return {"status": "NOT_CONFIGURED"}
    day = NOW.strftime("%Y-%m-%d")
    iso = START.strftime("%Y-%m-%dT%H:%M:%SZ")
    # Same scope (one registered account), grouped by three dataset nodes.
    query = ('{viewer{accounts(filter:{accountTag:"' + acct + '"}){' +
        'd:durableObjectsPeriodicGroups(filter:{date_geq:"'+day+'"},limit:288)' +
        '{dimensions{datetimeFiveMinutes} sum{rowsRead rowsWritten duration}} ' +
        'r:durableObjectsInvocationsAdaptiveGroups(filter:{date_geq:"'+day+'"},limit:288)' +
        '{dimensions{datetimeFiveMinutes} sum{requests}} ' +
        'w:workersInvocationsAdaptive(filter:{scriptName:"supra-inventory-beta",datetime_geq:"'+iso+'"},limit:288)' +
        '{dimensions{datetimeFiveMinutes} sum{requests cpuTimeUs}}}}}')
    status, body = call("https://api.cloudflare.com/client/v4/graphql", token, {"query": query})
    if status != "HTTP_200": return {"status": status}
    if not isinstance(body,dict) or body.get("errors"):
        return {"status": "SCHEMA_OR_PERMISSION"}
    acc = ((body.get("data") or {}).get("viewer") or {}).get("accounts") or []
    if len(acc) != 1: return {"status": "SCOPE_UNVERIFIED"}
    summary = {}
    for name in ("d", "r", "w"):
        rows = acc[0].get(name)
        if not isinstance(rows, list):
            summary[name]={"status":"NO_DATASET"}
            continue
        ages = [age_minutes((v.get("dimensions") or {}).get("datetimeFiveMinutes"))
                for v in rows if isinstance(v,dict)]
        ages = [a for a in ages if a is not None and a >= -2]
        latest = min(ages) if ages else None
        summary[name] = {"status": "RECENT_75M" if latest is not None and latest <= 75
                         else "NO_RECENT_BUCKET",
                         "buckets": len(rows), "latest_age_minutes":latest,
                         "possible_truncation":len(rows)>=288}
    return {"status":"PASS_GROUPED_1_HTTP_CALL","nodes":summary}

def google_probe():
    token = os.getenv("GCP_ACCESS_TOKEN","")
    if not token: return {"status":"NO_CREDENTIALS"}
    filt = 'metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.type="consumed_api"'
    params = urllib.parse.urlencode({
        "filter": filt, "interval.startTime":START.isoformat(),
        "interval.endTime":NOW.isoformat(), "view":"FULL",
        "pageSize":"1000", "aggregation.alignmentPeriod":"300s",
        "aggregation.perSeriesAligner":"ALIGN_SUM"})
    url = "https://monitoring.googleapis.com/v3/projects/supra-inventory-beta/timeSeries?" + params
    status, body = call(url, token, gcp=True)
    if status != "HTTP_200": return {"status":status}
    if not isinstance(body,dict): return {"status":"MALFORMED"}
    series = body.get("timeSeries") or []
    if not isinstance(series,list): return {"status":"MALFORMED"}
    info = {key:{"series":0,"latest_age_minutes":None} for key in ALLOW}
    for item in series:
        if not isinstance(item,dict): continue
        svc = str(((item.get("resource") or {}).get("labels") or {}).get("service",""))
        if svc not in info: continue
        info[svc]["series"] += 1
        for point in item.get("points") or []:
            age = age_minutes(((point.get("interval") or {}).get("endTime")))
            if age is not None and age >= -2:
                prev=info[svc]["latest_age_minutes"]
                if prev is None or age<prev: info[svc]["latest_age_minutes"]=age
    for info_item in info.values():
        age=info_item["latest_age_minutes"]
        info_item["status"]="RECENT_75M" if age is not None and age<=75 else "NO_RECENT_BUCKET"
    return {"status":"PASS_ONE_METRIC_MULTI_SERVICE",
            "has_more_pages":bool(body.get("nextPageToken")),
            "series_count":len(series), "sources":info}

def main():
    if os.getenv("E083_SELFTEST")=="1":
        assert len(ALLOW)==5 and age_minutes(NOW.isoformat()) is not None
        print("E083_OFFLINE_SELFTEST_PASS")
        return
    RESULT["cloudflare"]=cf_probe()
    RESULT["google_consumed_api"]=google_probe()
    Path("d173-e083-usage-efficiency-status.json").write_text(
        json.dumps(RESULT,indent=2)+"\n",encoding="utf8")
    print("E083_CF="+RESULT["cloudflare"]["status"])
    print("E083_GOOGLE="+RESULT["google_consumed_api"]["status"])
    print("E083_OUTBOUND_CALLS="+str(RESULT["calls"]))
    for group in ("cloudflare","google_consumed_api"):
        data=RESULT[group]
        if group=="cloudflare":
            for key,v in data.get("nodes",{}).items():
                print("E083_CF_NODE_"+key+"="+v["status"]+" AGE_MIN="+str(v["latest_age_minutes"]))
        else:
            for key,v in data.get("sources",{}).items():
                print("E083_GCP_"+key+"="+v["status"]+" AGE_MIN="+str(v["latest_age_minutes"]))

if __name__=="__main__": main()
