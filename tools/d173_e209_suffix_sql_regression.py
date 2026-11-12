#!/usr/bin/env python3
"""D173-E209 isolated SQLite fixture: actual page CTE from current Worker source."""
from __future__ import annotations
import re
import sqlite3
from pathlib import Path

source = (Path(__file__).resolve().parents[1] / "service/src/operational-v2-core.ts").read_text()
match = re.search(r"\? `(WITH withdrawn AS MATERIALIZED \([\s\S]*?)`\s*:\s*`WITH page_ids AS MATERIALIZED", source)
assert match, "CLOSED picker pagination SQL not found in source"
conn = sqlite3.connect(":memory:")
conn.executescript("""
CREATE TABLE report_batches(batch_id TEXT PRIMARY KEY, sku TEXT, status TEXT, first_report_at TEXT, resolved_at TEXT, updated_at TEXT);
CREATE TABLE report_tickets(ticket_id TEXT PRIMARY KEY, batch_id TEXT, picker_employee_code TEXT, status TEXT, withdrawn_at TEXT);
INSERT INTO report_batches VALUES
('b1','10011233','CLOSED','2026-11-12T00:00:00Z',NULL,'2026-11-12T02:00:00Z'),
('b2','10011233','CLOSED','2026-11-10T00:00:00Z',NULL,'2026-11-10T02:00:00Z'),
('b3','10055123','CLOSED','2026-11-12T00:00:00Z',NULL,'2026-11-12T03:00:00Z'),
('b4','10011233','HAS_STOCK','2026-11-12T00:00:00Z','2026-11-12T02:00:00Z','2026-11-12T02:00:00Z');
INSERT INTO report_tickets VALUES
('t1','b1','P001','WITHDRAWN','2026-11-12T01:00:00Z'),
('t2','b1','P001','WITHDRAWN','2026-11-12T01:30:00Z'),
('t3','b1','P002','WITHDRAWN','2026-11-12T01:45:00Z'),
('t4','b2','P003','WITHDRAWN','2026-11-10T01:00:00Z'),
('t5','b3','P004','WITHDRAWN','2026-11-12T02:30:00Z');
""")
cte_template = match.group(1)
def search(term: str, date_from="2026-11-12T00:00:00Z", date_to="2026-11-13T00:00:00Z", limit=50, offset=0):
    where = "b.status = 'CLOSED' AND b.first_report_at >= ? AND b.first_report_at < ? AND b.sku LIKE ?"
    sql = cte_template.replace("${clause}", where)
    sql += " SELECT p.batch_id,p.picker_employee_code,p.withdrawn_at FROM page_ids p ORDER BY p.batch_id,p.picker_employee_code"
    return conn.execute(sql, (date_from,date_to,f"%{term}",limit,offset)).fetchall()

assert search("233") == [
    ("b1","P001","2026-11-12T01:30:00Z"),
    ("b1","P002","2026-11-12T01:45:00Z"),
], search("233")
assert search("1233") == search("233")
assert search("123") == [], search("123")
assert search("233",limit=1,offset=1) == [("b1","P002","2026-11-12T01:45:00Z")]
assert search("233",date_from="2026-11-10T00:00:00Z",date_to="2026-11-13T00:00:00Z") == [
    ("b1","P001","2026-11-12T01:30:00Z"),
    ("b1","P002","2026-11-12T01:45:00Z"),
    ("b2","P003","2026-11-10T01:00:00Z"),
]
print("D173_E209_SQL_SUFFIX_PICKER_BATCH_DATE_PAGINATION_PASS")
