"""D167 INITIAL_05 migration regression: master rows absent from initial source become hidden.
Uses synthetic SKU IDs only. Does not contact Cloudflare/WMS.
"""
import sqlite3

db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE sku_master(sku TEXT PRIMARY KEY, product_name TEXT);
CREATE TABLE d167_sku_active(
 sku TEXT PRIMARY KEY, active INTEGER NOT NULL, area TEXT NOT NULL,
 area_verified INTEGER NOT NULL);
CREATE TABLE d167_sku_stage(day_vn TEXT, slot TEXT, sku TEXT,
 PRIMARY KEY(day_vn,slot,sku));
INSERT INTO sku_master VALUES ('in_today','synthetic'),('legacy_hidden','synthetic'),
 ('existing_inactive','synthetic'),('still_active','synthetic');
INSERT INTO d167_sku_active VALUES('existing_inactive',0,'UNKNOWN',0),
 ('still_active',1,'LTA',1);
INSERT INTO d167_sku_stage VALUES('2026-10-11','INITIAL_05','in_today'),
 ('2026-10-11','INITIAL_05','still_active');
""")
day,slot="2026-10-11","INITIAL_05"
db.execute("""INSERT OR IGNORE INTO d167_sku_active
 (sku,active,area,area_verified)
 SELECT s.sku,0,'UNKNOWN',0 FROM sku_master s
 WHERE NOT EXISTS(SELECT 1 FROM d167_sku_stage st
 WHERE st.day_vn=? AND st.slot=? AND st.sku=s.sku)""", (day,slot))
# Production inserts new active SKU metadata before executing the hiding clause.
db.execute("INSERT INTO d167_sku_active VALUES('in_today',1,'UNKNOWN',0)")
db.execute("""UPDATE d167_sku_active SET active=0
 WHERE active=1 AND NOT EXISTS(SELECT 1 FROM d167_sku_stage st
 WHERE st.day_vn=? AND st.slot=? AND st.sku=d167_sku_active.sku)""",(day,slot))
assert dict(db.execute("SELECT sku,active FROM d167_sku_active")) == {
 "in_today":1, "legacy_hidden":0, "existing_inactive":0, "still_active":1}
assert db.execute("SELECT COUNT(*) FROM sku_master").fetchone()[0] == 4
# Repeat the same full: no changes, no repeated insertion.
before=db.total_changes
db.execute("""INSERT OR IGNORE INTO d167_sku_active
 (sku,active,area,area_verified)
 SELECT s.sku,0,'UNKNOWN',0 FROM sku_master s
 WHERE NOT EXISTS(SELECT 1 FROM d167_sku_stage st
 WHERE st.day_vn=? AND st.slot=? AND st.sku=s.sku)""", (day,slot))
assert db.total_changes == before
print("D167 INITIAL_05 historic catalog hide/no-delete SQL fixture PASS")
