#!/usr/bin/env python3
"""E209 field repair: exercise the actual latest-withdrawal SQL join, not a copy."""
import re
import sqlite3
from pathlib import Path

src = (Path(__file__).resolve().parents[1] / "service/src/operational-v2-core.ts").read_text()
match = re.search(r'\$\{pickerRows \? `(LEFT JOIN report_tickets latest_withdrawal[\s\S]+?)` : ""\}', src)
assert match, "picker-row identity join is missing from runtime source"
joins = match.group(1)
assert "withdrawn_user.user_id = latest_withdrawal.picker_user_id" in joins

db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE page_ids(batch_id TEXT, picker_employee_code TEXT, withdrawn_at TEXT);
CREATE TABLE report_tickets(ticket_id TEXT PRIMARY KEY,batch_id TEXT,picker_user_id TEXT,picker_employee_code TEXT,status TEXT,withdrawn_at TEXT);
CREATE TABLE users(user_id TEXT PRIMARY KEY,employee_code TEXT,display_name TEXT);
INSERT INTO page_ids VALUES ('b1','999999','2026-11-12T09:45:00Z');
INSERT INTO users VALUES
('u_old','EXPIRED-999999','Người báo phiếu cũ'),
('u_new','REPLACED-999999','Tên Picker lần thu hồi mới nhất'),
('u_fallback','999999','Tên từ mã hiện tại');
INSERT INTO report_tickets VALUES
('t_old','b1','u_old','999999','WITHDRAWN','2026-11-12T09:00:00Z'),
('t_new','b1','u_new','999999','WITHDRAWN','2026-11-12T09:45:00Z'),
('t_pending','b1','u_old','999999','RESOLVED','2026-11-12T09:59:00Z');
""")
sql = """SELECT page.picker_employee_code,
 COALESCE(NULLIF(withdrawn_user.display_name, ''), code_user.display_name, ''),
 page.withdrawn_at
 FROM page_ids page """ + joins
rows = db.execute(sql).fetchall()
assert rows == [('999999','Tên Picker lần thu hồi mới nhất','2026-11-12T09:45:00Z')], rows

# E213: a historical ticket can have no stored employee code. The read
# projection must fall back to the authenticated withdrawer's employee code.
assert "COALESCE(NULLIF(page.picker_employee_code, ''), NULLIF(withdrawn_user.employee_code, ''), '') AS withdrawn_picker_employee_code" in src
db.executescript("""
INSERT INTO page_ids VALUES ('b2','','2026-11-12T10:00:00Z');
INSERT INTO users VALUES ('u_missing','SYNTH-088','Người thu hồi có danh tính');
INSERT INTO report_tickets VALUES ('t_missing','b2','u_missing','','WITHDRAWN','2026-11-12T10:00:00Z');
""")
fallback_sql = """SELECT COALESCE(NULLIF(page.picker_employee_code, ''), NULLIF(withdrawn_user.employee_code, ''), ''),
 COALESCE(NULLIF(withdrawn_user.display_name, ''), NULLIF(code_user.display_name, ''), '')
 FROM page_ids page """ + joins + " WHERE page.batch_id = 'b2'"
assert db.execute(fallback_sql).fetchall() == [('SYNTH-088','Người thu hồi có danh tính')]

print("D173_E210_WITHDRAWN_ACTOR_LATEST_TICKET_SQL_PASS")
print("D173_E213_WITHDRAWN_ACTOR_MISSING_EMPLOYEE_CODE_SQL_PASS")
