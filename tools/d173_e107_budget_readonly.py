#!/usr/bin/env python3
"""One-shot budget research: existing Cloudflare analytics/billing GETs only.

No production Worker/Core/Firestore calls, writes, deployments, raw provider
payloads, identifiers or credentials in output. At most three provider requests.
"""
import datetime as dt
import json
import math
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

VN = dt.timezone(dt.timedelta(hours=7))
UTC = dt.timezone.utc
OUT = Path("d173-e107-budget-readonly.json")


def num(x):
    if isinstance(x, bool):
        return None
    try:
        n = float(x)
        return n if math.isfinite(n) and 0 <= n < 1e20 else None
    except (ValueError, TypeError):
        return None


def iso(x):
    try:
        return dt.datetime.fromisoformat(str(x).replace("Z", "+00:00")).astimezone(UTC)
    except (ValueError, TypeError):
        return None


def category(row):
    s = " ".join(str(row.get(k, "")) for k in
                 ("ServiceName", "ServiceFamilyName", "ChargeDescription", "x_BillableMetricId")).lower()
    if "durable" in s:
        family = "DO"
    elif re.search(r"\bd1\b", s):
        family = "D1"
    elif "log" in s or "observability" in s:
        return "LOGS"
    elif "worker" in s:
        family = "WORKER"
    else:
        return "OTHER"
    if "storage" in s or "stored" in s:
        return family + "_STORAGE"
    if "row" in s and "read" in s:
        return family + "_ROWS_READ"
    if "row" in s and ("writ" in s or "written" in s):
        return family + "_ROWS_WRITTEN"
    if "duration" in s or "compute time" in s:
        return family + "_DURATION"
    if "cpu" in s:
        return family + "_CPU"
    return family + "_REQUESTS" if "request" in s else family + "_OTHER"


def summarize_billing(rows):
    out = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = category(row)
        unit = str(row.get("ConsumedUnit", ""))
        # Units are provider-defined, not a billable normalization guess.
        safe_unit = unit if re.fullmatch(r"[A-Za-z0-9 /_.-]{0,48}", unit) else "UNVERIFIED_UNIT"
        period = iso(row.get("BillingPeriodStart"))
        p = period.isoformat() if period else "UNVERIFIED_PERIOD"
        target = out.setdefault((key, safe_unit, p), {
            "metric": key, "unit": safe_unit, "period_start": p,
            "consumed": 0.0, "consumed_samples": 0,
            "contracted_cost": 0.0, "cost_samples": 0,
        })
        n = num(row.get("ConsumedQuantity"))
        if n is not None:
            target["consumed"] += n
            target["consumed_samples"] += 1
        c = num(row.get("ContractedCost"))
        if c is not None:
            target["contracted_cost"] += c
            target["cost_samples"] += 1
    # Empty/missing rows are not zero cost; categories never expose resource IDs.
    return list(out.values())


def rollup(rows, start, end, fields):
    if not isinstance(rows, list):
        return {"status": "NO_DATA"}
    if len(rows) >= 1000:
        return {"status": "TRUNCATED", "groups": len(rows)}
    total = {k: 0.0 for k in fields}
    hours = set()
    types = {}
    selected = 0
    for row in rows:
        dims = row.get("dimensions") or {}
        stamp = iso(dims.get("datetimeHour"))
        if stamp is None or not start <= stamp < end:
            continue
        selected += 1
        hours.add(stamp.isoformat())
        values = row.get("sum") or {}
        for k in fields:
            value = num(values.get(k))
            if value is not None:
                total[k] += value
        typ = str(dims.get("type", ""))
        if typ in ("http", "alarm", "hibernation", "websocket"):
            types[typ] = types.get(typ, 0) + (num(values.get("requests")) or 0)
    return {"status": "OBSERVED" if selected else "NO_DATA", "groups": selected,
            "hour_coverage": len(hours), "totals": total, "types": types,
            "sampled_analytics_not_invoice": True}


def read_json(url, token, data=None):
    req = urllib.request.Request(url, data=None if data is None else json.dumps(data).encode(),
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method="GET" if data is None else "POST")
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read(4 * 1024 * 1024 + 1)
        if len(raw) > 4 * 1024 * 1024:
            return "RESPONSE_TOO_LARGE", None
        return "HTTP_200", json.loads(raw)
    except urllib.error.HTTPError as exc:
        return "HTTP_" + str(exc.code), None
    except Exception:
        return "NETWORK_OR_JSON_UNAVAILABLE", None


def main():
    if os.environ.get("E107_SELFTEST") == "1":
        assert num("no") is None and num(float("nan")) is None and num(-1) is None
        assert category({"ServiceName": "Durable Objects", "ChargeDescription": "Rows Written"}) == "DO_ROWS_WRITTEN"
        assert summarize_billing([]) == []
        t = dt.datetime(2026, 10, 29, 17, tzinfo=UTC)
        assert rollup([], t, t + dt.timedelta(days=1), ["requests"])["status"] == "NO_DATA"
        print("E107_READONLY_SELFTEST_PASS")
        return
    account = os.environ.get("CF_ACCOUNT_ID", "")
    token = os.environ.get("D166_CF_READ_TOKEN", "")
    result = {"schema": "D173_E107_BUDGET_RESEARCH_V1", "provider_requests_max": 3,
              "production_mutations": False, "financial_pass": False,
              "scope": "EXISTING_CF_ACCOUNT_AGGREGATE_AND_REGISTERED_INVENTORY_SCRIPT"}
    if not re.fullmatch(r"[0-9a-fA-F]{32}", account) or not token:
        result["status"] = "READ_CREDENTIALS_UNAVAILABLE"
    else:
        base = "https://api.cloudflare.com/client/v4"
        status, data = read_json(base + "/accounts/" + account + "/billable-usage", token)
        rows = data.get("result") if isinstance(data, dict) else None
        result["billing_status"] = status
        result["billing_rows"] = summarize_billing(rows) if isinstance(rows, list) else []
        status, data = read_json(base + "/accounts/" + account + "/subscriptions", token)
        result["cycle_status"] = status
        plans = data.get("result") if isinstance(data, dict) else []
        result["worker_cycles"] = []
        for plan in plans if isinstance(plans, list) else []:
            text = json.dumps(plan.get("rate_plan", "")) + str(plan.get("name", ""))
            a, b = iso(plan.get("current_period_start")), iso(plan.get("current_period_end"))
            if "worker" in text.lower() and a and b and a < b:
                result["worker_cycles"].append({"start": a.isoformat(), "end": b.isoformat()})
        # Last complete VN calendar day; exactly bounded and independent of billing cycle.
        day = dt.datetime.now(VN).date() - dt.timedelta(days=1)
        start = dt.datetime.combine(day, dt.time(), VN).astimezone(UTC)
        end = start + dt.timedelta(days=1)
        date_filter = 'date_geq:"' + start.date().isoformat() + '",date_leq:"' + end.date().isoformat() + '"'
        worker_filter = 'datetime_geq:"' + start.isoformat() + '",datetime_leq:"' + end.isoformat() + '"'
        script_filter = 'scriptName:"supra-inventory-beta",' + date_filter
        query = '{viewer{accounts(filter:{accountTag:"' + account + '"}){' + \
            'p:durableObjectsPeriodicGroups(filter:{' + date_filter + '},limit:1000){dimensions{datetimeHour}sum{rowsRead rowsWritten duration inboundWebsocketMsgCount outboundWebsocketMsgCount}}' + \
            'a:durableObjectsInvocationsAdaptiveGroups(filter:{' + date_filter + '},limit:1000){dimensions{datetimeHour type}sum{requests}}' + \
            'i:durableObjectsInvocationsAdaptiveGroups(filter:{' + script_filter + '},limit:1000){dimensions{datetimeHour type}sum{requests}}' + \
            'w:workersInvocationsAdaptive(filter:{scriptName:"supra-inventory-beta",' + worker_filter + '},limit:1000){dimensions{datetimeHour}sum{requests cpuTimeUs}}' + \
            'wa:workersInvocationsAdaptive(filter:{' + worker_filter + '},limit:1000){dimensions{datetimeHour}sum{requests cpuTimeUs}}' + \
            '}}}'
        status, data = read_json(base + "/graphql", token, {"query": query})
        accounts = ((data.get("data") or {}).get("viewer") or {}).get("accounts") if isinstance(data, dict) else None
        result["analytics_status"] = "SCHEMA_OR_PERMISSION" if isinstance(data, dict) and data.get("errors") else status
        result["day_vn"] = day.isoformat()
        if isinstance(accounts, list) and len(accounts) == 1 and not data.get("errors"):
            source = accounts[0]
            definitions = {"p": ["rowsRead", "rowsWritten", "duration", "inboundWebsocketMsgCount", "outboundWebsocketMsgCount"],
                           "a": ["requests"], "i": ["requests"],
                           "w": ["requests", "cpuTimeUs"], "wa": ["requests", "cpuTimeUs"]}
            result["day"] = {k: rollup(source.get(k), start, end, fs) for k, fs in definitions.items()}
        result["status"] = "RESEARCH_COMPLETE_NOT_FINANCIAL_ACCEPTANCE"
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=True) + "\n")
    print("E107_STATUS=" + result["status"])
    print("E107_NO_PRODUCTION_CALLS_OR_WRITES__NO_RAW_PROVIDER_PAYLOAD")


if __name__ == "__main__":
    main()
