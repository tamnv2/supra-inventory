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
INSERT INTO page_ids VALUES ('b1','45284','2026-11-12T09:45:00Z');
INSERT INTO users VALUES
('u_old','EXPIRED-45284','Người báo phiếu cũ'),
('u_new','REPLACED-45284','Tên Picker lần thu hồi mới nhất'),
('u_fallback','45284','Tên từ mã hiện tại');
INSERT INTO report_tickets VALUES
('t_old','b1','u_old','45284','WITHDRAWN','2026-11-12T09:00:00Z'),
('t_new','b1','u_new','45284','WITHDRAWN','2026-11-12T09:45:00Z'),
('t_pending','b1','u_old','45284','RESOLVED','2026-11-12T09:59:00Z');
""")
sql = """SELECT page.picker_employee_code,
 COALESCE(NULLIF(withdrawn_user.display_name, ''), code_user.display_name, ''),
 page.withdrawn_at
 FROM page_ids page """ + joins
rows = db.execute(sql).fetchall()
assert rows == [('45284','Tên Picker lần thu hồi mới nhất','2026-11-12T09:45:00Z')], rows
print("D173_E210_WITHDRAWN_ACTOR_LATEST_TICKET_SQL_PASS")
