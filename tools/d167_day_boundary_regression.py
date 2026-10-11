#!/usr/bin/env python3
"""D167 contract guard: VN-day SQL uniqueness, stale legacy global indexes, and 03:00 owner rules.

This is an in-memory relational migration fixture, not a deployed Durable Object test.
"""
from pathlib import Path
import sqlite3
from datetime import datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parents[1]
service = (ROOT / "service/src/business-core.ts").read_text(encoding="utf-8")
core = (ROOT / "service/src/core.ts").read_text(encoding="utf-8")
over = (ROOT / "service/src/d167-overdue-core.ts").read_text(encoding="utf-8")
meal = (ROOT / "service/src/meal-break-core.ts").read_text(encoding="utf-8")
hr = (ROOT / "service/src/user-management-core.ts").read_text(encoding="utf-8")
api = (ROOT / "service/src/user-management-api.ts").read_text(encoding="utf-8")
web = (ROOT / "web/src/hr-web-panel.ts").read_text(encoding="utf-8")
sla = (ROOT / "service/src/sla-automation.ts").read_text(encoding="utf-8")


def need(cond, explanation):
    if not cond:
        raise AssertionError(explanation)

need("AND business_day_vn = ?" in service, "daily Picker/sku lookup missing")
need("idx_d167_pending_sku_day" in core and "idx_d167_open_picker_sku_day" in core, "per-day unique indexes missing")
need("DROP INDEX IF EXISTS idx_pending_batch_sku" in core, "old global pending-SKU uniqueness not removed")
need("DROP INDEX IF EXISTS idx_open_ticket_picker_sku" in core, "old global Picker-SKU index not removed")
need("d167_first_overdue_at IS NOT NULL" not in over.split("export function processD167DayClose(")[1].split("export function nextD167OverdueAlarmMs")[0], "03:00 restricted to overdue batch")
need("overdue<=0)return" not in over, "03:00 restricted to overdue Picker")
need('resolution_source=\'SYSTEM_DAY_END\'' in over, "missing distinct system origin")
need("DEFAULT_LATE_30_MINUTES" in meal and "SYSTEM_MEAL_DEFAULT" in meal, "late meal fallback not explicit")
need("HR_CHANGE_REVIEW_REQUIRED" in hr and "!contractor" in hr, "contractor/rename approval missing")
need("hr-web/preview" in api and "hr-web/apply" in api, "direct Web API missing")
need('id="hr-excel-file"' in web and 'id="hr-manual-form"' in web, "Web/Excel HR inputs missing")
# A mixed waiting/overdue day-N batch must notify EVERY OPEN Picker once,
# and may decrement the overdue counter only if it was actually nonzero.
need("AND status='OPEN' AND picker_user_id IS NOT NULL" in over,
     "03:00 Picker result fanout excludes overdue tickets")
need("picker_user_ids:affectedUsers,result_event:true" in over,
     "03:00 result must include all open Picker ACK targets")
need("overdue_delta:overdue>0?-1:0" in over,
     "03:00 falsely decrements the overdue badge for never-overdue SKU")
need("Number.isFinite(closeAt)" in over,
     "03:00 invalid timestamp can crash entire alarm")
need(sla.index("effects.push(...processD167DayClose(state, nowMs))") <
     sla.index("effects.push(...processD167OverdueReminders(state, nowMs))"),
     "03:00 day-close must supersede delayed overdue reminders")
need(sla.index("effects.push(...processD167DayClose(state, nowMs))") <
     sla.index("processBatchAutoSkip(state, config, nowMs, effects)"),
     "03:00 day-close must supersede ordinary timeout within the same alarm")
need("if (promptAt > nowMs) {" in meal and
     "if (cutoffAt > nowMs) {" in meal,
     "11:00/18:00 default must remain armed after 10:55/17:55 alert")

con = sqlite3.connect(":memory:")
con.executescript('''
CREATE TABLE report_batches(batch_id TEXT PRIMARY KEY, sku TEXT, status TEXT, first_report_at TEXT, business_day_vn TEXT);
CREATE TABLE report_tickets(ticket_id TEXT PRIMARY KEY, picker_employee_code TEXT, sku TEXT, status TEXT, reported_at TEXT, business_day_vn TEXT);
CREATE UNIQUE INDEX idx_pending_batch_sku ON report_batches(sku) WHERE status='PENDING';
CREATE UNIQUE INDEX idx_open_ticket_picker_sku ON report_tickets(picker_employee_code,sku) WHERE status='OPEN';
INSERT INTO report_batches VALUES('old','000123','PENDING','2026-10-10T16:59:59.000Z',NULL);
INSERT INTO report_tickets VALUES('old','picker-a','000123','OPEN','2026-10-10T16:59:59.000Z',NULL);
''')
con.execute("UPDATE report_batches SET business_day_vn=date(first_report_at,'+7 hours') WHERE business_day_vn IS NULL")
con.execute("UPDATE report_tickets SET business_day_vn=date(reported_at,'+7 hours') WHERE business_day_vn IS NULL")
con.executescript('''
DROP INDEX idx_pending_batch_sku;
DROP INDEX idx_open_ticket_picker_sku;
CREATE UNIQUE INDEX idx_d167_pending_sku_day ON report_batches(sku,business_day_vn) WHERE status='PENDING';
CREATE UNIQUE INDEX idx_d167_open_picker_sku_day ON report_tickets(picker_employee_code,sku,business_day_vn) WHERE status='OPEN';
INSERT INTO report_batches VALUES('new','000123','PENDING','2026-10-10T17:00:00.000Z','2026-10-11');
INSERT INTO report_tickets VALUES('new','picker-a','000123','OPEN','2026-10-10T17:00:00.000Z','2026-10-11');
''')
assert con.execute("SELECT business_day_vn FROM report_batches WHERE batch_id='old'").fetchone()[0] == '2026-10-10'
for table, args in (("report_batches", ("dup","000123","PENDING","2026-10-10T17:00:01Z","2026-10-11")),
                    ("report_tickets", ("dup","picker-a","000123","OPEN","2026-10-10T17:00:01Z","2026-10-11"))):
    try:
        con.execute("INSERT INTO " + table + (" VALUES(?,?,?,?,?,?)" if table == "report_tickets" else " VALUES(?,?,?,?,?)"), args)
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError(table + " accepted same-day duplicate")
# 03:00 local VN = previous day 20:00 UTC, including not-yet-overdue rows.
cutoff = datetime(2026,10,11,3,0,0,tzinfo=timezone(timedelta(hours=7)))
assert cutoff.astimezone(timezone.utc).isoformat().startswith('2026-10-10T20:00:00')
print('D167_OWNER_DAY_BOUNDARY_REGRESSION_PASS')
