#!/usr/bin/env python3
"""D173-E108 M2 isolated contract POC; synthetic SQLite, no provider credentials or live traffic.

This is NOT an implementation of the published InventoryCore or an end-to-end WS benchmark.
It exercises the proposed shared dispatcher, durable idempotency, filtered recovery and meter math.
"""
from __future__ import annotations

import hashlib
import json
import math
import sqlite3
from dataclasses import dataclass


@dataclass(frozen=True)
class Principal:
    uid: str
    generation: int


class ContractError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class SyntheticCore:
    def __init__(self, connection: sqlite3.Connection | None = None):
        self.db = connection or sqlite3.connect(":memory:", isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS users(
                uid TEXT PRIMARY KEY, role TEXT NOT NULL, generation INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'ACTIVE');
            CREATE TABLE IF NOT EXISTS batches(
                id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'OPEN', version INTEGER NOT NULL DEFAULT 0,
                resolved_at INTEGER, result_event INTEGER);
            CREATE TABLE IF NOT EXISTS tickets(
                id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL,
                uid TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN',
                created_at INTEGER NOT NULL, UNIQUE(batch_id,uid));
            CREATE TABLE IF NOT EXISTS events(
                seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL,
                payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS audience(
                seq INTEGER NOT NULL, recipient TEXT NOT NULL, PRIMARY KEY(seq,recipient));
            CREATE INDEX IF NOT EXISTS idx_m2_audience_recipient_seq
                ON audience(recipient,seq);
            CREATE TABLE IF NOT EXISTS receipts(
                uid TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
                response TEXT NOT NULL, PRIMARY KEY(uid,request_id));
            CREATE TABLE IF NOT EXISTS acknowledgements(
                uid TEXT NOT NULL, result_event INTEGER NOT NULL, PRIMARY KEY(uid,result_event));
        """)
        self.epoch = "poc-epoch-1"
        self.meters = {"http": 0, "ws_in": 0, "ws_handshake": 0, "read_attempts": 0}

    def add_user(self, uid: str, role: str, generation: int = 1) -> None:
        self.db.execute("INSERT INTO users(uid,role,generation) VALUES(?,?,?)",
                        (uid, role, generation))

    def set_user(self, uid: str, *, generation: int | None = None,
                 status: str | None = None, role: str | None = None) -> None:
        values = []
        updates = []
        for k, value in (("generation", generation), ("status", status), ("role", role)):
            if value is not None:
                updates.append(k + "=?")
                values.append(value)
        self.db.execute("UPDATE users SET " + ",".join(updates) + " WHERE uid=?",
                        (*values, uid))

    def auth(self, principal: Principal) -> str:
        row = self.db.execute("SELECT role,status,generation FROM users WHERE uid=?",
                              (principal.uid,)).fetchone()
        if not row or row["status"] != "ACTIVE" or row["generation"] != principal.generation:
            raise ContractError("SESSION_REVOKED")
        return str(row["role"])

    def _event(self, kind: str, payload: dict, recipients: set[str]) -> int:
        cur = self.db.execute("INSERT INTO events(kind,payload) VALUES(?,?)",
                              (kind, json.dumps(payload, sort_keys=True)))
        seq = int(cur.lastrowid)
        self.db.executemany("INSERT INTO audience(seq,recipient) VALUES(?,?)",
                            [(seq, r) for r in sorted(recipients)])
        return seq

    def dispatch(self, principal: Principal, frame: dict) -> dict:
        """Called identically by HTTP and WS adapters; authorization occurs per command."""
        role = self.auth(principal)
        rid = str(frame.get("request_id", ""))
        operation = str(frame.get("operation", ""))
        args = frame.get("args", {})
        if not rid or len(rid) > 128 or not isinstance(args, dict):
            raise ContractError("INVALID_FRAME")
        fingerprint = hashlib.sha256(json.dumps(
            [operation, args], sort_keys=True, separators=(",", ":")
        ).encode()).hexdigest()
        # A transaction records business change, audience coverage and response together.
        self.db.execute("BEGIN IMMEDIATE")
        try:
            saved = self.db.execute(
                "SELECT fingerprint,response FROM receipts WHERE uid=? AND request_id=?",
                (principal.uid, rid)).fetchone()
            if saved:
                if saved["fingerprint"] != fingerprint:
                    raise ContractError("REQUEST_ID_REUSED")
                result = json.loads(saved["response"])
            else:
                result = self._execute(principal.uid, role, operation, args)
                self.db.execute(
                    "INSERT INTO receipts(uid,request_id,fingerprint,response) VALUES(?,?,?,?)",
                    (principal.uid, rid, fingerprint, json.dumps(result, sort_keys=True)))
            self.db.execute("COMMIT")
            return result
        except Exception:
            self.db.execute("ROLLBACK")
            raise

    def _execute(self, uid: str, role: str, operation: str, args: dict) -> dict:
        now = int(args.get("now", 0))
        if operation == "REPORT":
            if role != "PICKER":
                raise ContractError("FORBIDDEN")
            sku = str(args.get("sku", "")).strip()
            if not sku:
                raise ContractError("SKU_REQUIRED")
            batch = self.db.execute(
                "SELECT id,version FROM batches WHERE sku=? AND status='OPEN' LIMIT 1",
                (sku,)).fetchone()
            if batch is None:
                cur = self.db.execute("INSERT INTO batches(sku) VALUES(?)", (sku,))
                batch_id, version = int(cur.lastrowid), 0
            else:
                batch_id, version = int(batch["id"]), int(batch["version"])
            current = self.db.execute(
                "SELECT id FROM tickets WHERE batch_id=? AND uid=?",
                (batch_id, uid)).fetchone()
            if current:
                raise ContractError("ACTIVE_REPORT_EXISTS")
            cur = self.db.execute(
                "INSERT INTO tickets(batch_id,uid,created_at) VALUES(?,?,?)",
                (batch_id, uid, now))
            version += 1
            self.db.execute("UPDATE batches SET version=? WHERE id=?", (version, batch_id))
            seq = self._event("REPORT", {"batch_id": batch_id, "version": version},
                              {"role:REPORTER", "user:" + uid})
            return {"batch_id": batch_id, "ticket_id": cur.lastrowid,
                    "version": version, "event_id": seq, "status": "OPEN"}

        batch_id = int(args.get("batch_id", 0))
        batch = self.db.execute("SELECT * FROM batches WHERE id=?",
                                (batch_id,)).fetchone()
        if not batch:
            raise ContractError("BATCH_NOT_FOUND")
        if operation == "WITHDRAW":
            if role != "PICKER" or batch["status"] != "OPEN":
                raise ContractError("FORBIDDEN")
            ticket = self.db.execute(
                "SELECT * FROM tickets WHERE batch_id=? AND uid=? AND status='OPEN'",
                (batch_id, uid)).fetchone()
            if not ticket or now < int(ticket["created_at"]) or now - int(ticket["created_at"]) > 60:
                raise ContractError("WITHDRAW_WINDOW_CLOSED")
            self.db.execute("UPDATE tickets SET status='WITHDRAWN' WHERE id=?",
                            (ticket["id"],))
            version = batch["version"] + 1
            self.db.execute("UPDATE batches SET version=? WHERE id=?", (version, batch_id))
            seq = self._event("WITHDRAW", {"batch_id": batch_id, "version": version},
                              {"role:REPORTER", "user:" + uid})
            return {"batch_id": batch_id, "version": version, "event_id": seq, "status": "WITHDRAWN"}
        if operation in ("RESOLVE", "CORRECT"):
            if role not in ("REPORTER", "ADMIN", "ROOT"):
                raise ContractError("FORBIDDEN")
            if int(args.get("expected_version", -1)) != batch["version"]:
                raise ContractError("VERSION_CONFLICT")
            resolution = str(args.get("resolution", ""))
            if operation == "RESOLVE":
                if batch["status"] != "OPEN" or resolution not in ("HAS_STOCK", "SKIP_ALLOWED"):
                    raise ContractError("INVALID_RESOLUTION")
            elif (batch["status"] != "SKIP_ALLOWED" or resolution != "HAS_STOCK"
                  or now < batch["resolved_at"] or now - batch["resolved_at"] > 300):
                raise ContractError("CORRECTION_WINDOW_CLOSED")
            version = int(batch["version"]) + 1
            recipients = {"role:REPORTER"}
            recipients |= {"user:" + row["uid"] for row in self.db.execute(
                "SELECT uid FROM tickets WHERE batch_id=? AND status='OPEN'", (batch_id,))}
            seq = self._event(operation, {
                "batch_id": batch_id, "version": version, "status": resolution
            }, recipients)
            self.db.execute(
                "UPDATE batches SET status=?,version=?,resolved_at=?,result_event=? WHERE id=?",
                (resolution, version, now, seq, batch_id))
            return {"batch_id": batch_id, "version": version, "event_id": seq,
                    "status": resolution}
        if operation == "ACK":
            event_id = int(args.get("event_id", 0))
            if role != "PICKER" or event_id != batch["result_event"]:
                raise ContractError("ACK_NOT_ALLOWED")
            owns = self.db.execute(
                "SELECT 1 FROM tickets WHERE uid=? AND batch_id=? AND status='OPEN'",
                (uid, batch_id)).fetchone()
            if not owns:
                raise ContractError("ACK_NOT_ALLOWED")
            self.db.execute("INSERT OR IGNORE INTO acknowledgements(uid,result_event) VALUES(?,?)",
                            (uid, event_id))
            return {"batch_id": batch_id, "event_id": event_id, "acknowledged": True}
        raise ContractError("OPERATION_UNSUPPORTED")

    def recover(self, principal: Principal, after_seq: int, epoch: str,
                limit: int = 100) -> dict:
        role = self.auth(principal)
        if limit < 1 or limit > 200:
            raise ContractError("INVALID_LIMIT")
        latest = int(self.db.execute("SELECT COALESCE(MAX(seq),0) FROM events").fetchone()[0])
        oldest = int(self.db.execute("SELECT COALESCE(MIN(seq),0) FROM events").fetchone()[0])
        if epoch != self.epoch or after_seq > latest or (oldest and after_seq < oldest - 1):
            return {"resync_required": True, "covered_through": latest, "events": []}
        recipients = ("user:" + principal.uid, "role:" + role)
        rows = self.db.execute("""
            SELECT DISTINCT e.seq,e.kind,e.payload FROM events e
            JOIN audience a ON a.seq=e.seq
            WHERE e.seq>? AND a.recipient IN (?,?)
            ORDER BY e.seq LIMIT ?
        """, (after_seq, *recipients, limit)).fetchall()
        events = [{"seq": r["seq"], "kind": r["kind"], **json.loads(r["payload"])}
                  for r in rows]
        # Covered cursor may skip unauthorized events, but never undelivered authorized pages.
        covered = int(rows[-1]["seq"]) if len(rows) == limit else latest
        return {"resync_required": False, "covered_through": covered,
                "has_more": len(rows) == limit and covered < latest, "events": events}

    def snapshot(self) -> list[tuple]:
        return [tuple(r) for r in self.db.execute(
            "SELECT id,sku,status,version FROM batches ORDER BY id")]


class Transport:
    def __init__(self, core: SyntheticCore, mode: str):
        self.core, self.mode = core, mode
        if mode == "WS":
            core.meters["ws_handshake"] += 1

    def command(self, actor: Principal, frame: dict) -> dict:
        self.core.meters["ws_in" if self.mode == "WS" else "http"] += 1
        response = self.core.dispatch(actor, frame)
        if self.mode == "HTTP":
            # Synthetic representation of old UI queue/recent/counters follow-up reads.
            self.core.meters["http"] += 3
            self.core.meters["read_attempts"] += 3
        return response


def billed_request_planning(http: int, ws_in: int, handshake: int, days: int = 31) -> int:
    if min(http, ws_in, handshake, days) < 0:
        raise ValueError("negative meter")
    # Illustration: conservative daily ceil; provider billing must be checked independently.
    return days * (http + handshake + math.ceil(ws_in / 20))
