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

# D167 5k synthetic active-roster FULL/DELTA regression: counts and SQL shape only, no physical-provider benchmark.
bulk = sqlite3.connect(":memory:")
bulk.executescript("""
CREATE TABLE sku_master(sku TEXT PRIMARY KEY, product_name TEXT);
CREATE TABLE d167_sku_active(sku TEXT PRIMARY KEY, active INTEGER NOT NULL, area TEXT NOT NULL, area_verified INTEGER NOT NULL);
CREATE TABLE d167_sku_stage(day_vn TEXT, slot TEXT, sku TEXT, PRIMARY KEY(day_vn,slot,sku));
""")
bulk.executemany("INSERT INTO sku_master VALUES (?,?)",
 ((str(10000000+i), "synthetic") for i in range(5000)))
bulk.executemany("INSERT INTO d167_sku_active VALUES (?,1,'LTA',1)",
 ((str(10000000+i),) for i in range(5000)))
bulk.executemany("INSERT INTO d167_sku_stage VALUES('2026-10-11','INITIAL_05',?)",
 ((str(10000000+i),) for i in range(3500)))
bulk.execute("""UPDATE d167_sku_active SET active=0
 WHERE active=1 AND NOT EXISTS(SELECT 1 FROM d167_sku_stage st
 WHERE st.day_vn='2026-10-11' AND st.slot='INITIAL_05' AND st.sku=d167_sku_active.sku)""")
assert bulk.execute("SELECT COUNT(*) FROM d167_sku_active WHERE active=1").fetchone()[0] == 3500
assert bulk.execute("SELECT COUNT(*) FROM sku_master").fetchone()[0] == 5000
baseline = bulk.total_changes
# A DELTA omitting 3499 active SKUs must never perform the FULL hiding clause.
bulk.execute("INSERT INTO d167_sku_stage VALUES('2026-10-11','DELTA_19','10000000')")
assert bulk.execute("SELECT COUNT(*) FROM d167_sku_active WHERE active=1").fetchone()[0] == 3500
# A no-op repeat FULL cannot generate active-roster writes.
bulk.execute("""UPDATE d167_sku_active SET active=0
 WHERE active=1 AND NOT EXISTS(SELECT 1 FROM d167_sku_stage st
 WHERE st.day_vn='2026-10-11' AND st.slot='INITIAL_05' AND st.sku=d167_sku_active.sku)""")
assert bulk.total_changes == baseline + 1
print("D167 5k synthetic roster FULL/DELTA and no-delete/no-op SQL fixture PASS")
