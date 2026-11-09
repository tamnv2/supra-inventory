package cd.cc.supra.obpp1291

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/** Local-first read model. Cloud/InventoryCore remains the only business write authority. */
object ObppHistoryStore {
    data class CursorState(
        val complete: Boolean = false, val snapshot: String = "", val cursor: String = "",
        val baselineSeq: Long = 0L, val appliedSeq: Long = 0L, val expected: Int = 0
    )

    private class Database(context: Context) :
        SQLiteOpenHelper(context, "obpp1291_history_v1.db", null, 1) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("CREATE TABLE records(owner TEXT NOT NULL,id TEXT NOT NULL,created_at TEXT NOT NULL,store_code TEXT NOT NULL,do_code TEXT NOT NULL,location TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(owner,id))")
            db.execSQL("CREATE INDEX records_by_time ON records(owner,created_at DESC,id DESC)")
            db.execSQL("CREATE INDEX records_by_do ON records(owner,do_code)")
            db.execSQL("CREATE INDEX records_by_store ON records(owner,store_code)")
            db.execSQL("CREATE INDEX records_by_location ON records(owner,location)")
            db.execSQL("CREATE TABLE sync_state(owner TEXT PRIMARY KEY,complete INTEGER NOT NULL DEFAULT 0,snapshot TEXT NOT NULL DEFAULT '',cursor TEXT NOT NULL DEFAULT '',baseline_seq INTEGER NOT NULL DEFAULT 0,applied_seq INTEGER NOT NULL DEFAULT 0,expected INTEGER NOT NULL DEFAULT 0)")
        }
        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            throw IllegalStateException("History migration requires an explicit lossless upgrade")
        }
    }
    @Volatile private var helper: Database? = null
    private fun db(context: Context): SQLiteDatabase {
        val h = helper ?: synchronized(this) {
            helper ?: Database(context.applicationContext).also { helper = it }
        }
        return h.writableDatabase
    }

    fun state(context: Context, owner: String): CursorState {
        if (owner.isBlank()) return CursorState()
        db(context).rawQuery(
            "SELECT complete,snapshot,cursor,baseline_seq,applied_seq,expected FROM sync_state WHERE owner=?",
            arrayOf(owner)
        ).use { c ->
            return if (c.moveToFirst()) CursorState(
                c.getInt(0) == 1,c.getString(1),c.getString(2),
                c.getLong(3),c.getLong(4),c.getInt(5)
            ) else CursorState()
        }
    }

    private fun putRecord(sql: SQLiteDatabase, owner: String, row: JSONObject) {
        val id = row.optString("id")
        if (id.isBlank()) return
        sql.execSQL(
            "INSERT OR REPLACE INTO records(owner,id,created_at,store_code,do_code,location,payload) VALUES(?,?,?,?,?,?,?)",
            arrayOf(owner,id,row.optString("created_at"),row.optString("store_code"),
                row.optString("do_code"),row.optString("location"),row.toString())
        )
    }

    /** A page and its cursor checkpoint commit together. Safe to resume after process death. */
    fun acceptPage(
        context: Context, owner: String, items: JSONArray, snapshot: String, next: String,
        baseline: Long, expected: Int, hasMore: Boolean
    ) {
        if (owner.isBlank() || snapshot.isBlank()) return
        val sql = db(context)
        sql.beginTransaction()
        try {
            val prior = state(context, owner)
            if (prior.snapshot.isNotBlank() && prior.snapshot != snapshot && !prior.complete)
                throw IllegalStateException("OBPP snapshot changed mid-hydration")
            for (i in 0 until items.length()) items.optJSONObject(i)?.let { putRecord(sql,owner,it) }
            val effectiveBaseline = if (prior.snapshot.isBlank()) baseline else prior.baselineSeq
            sql.execSQL(
                "INSERT OR REPLACE INTO sync_state(owner,complete,snapshot,cursor,baseline_seq,applied_seq,expected) VALUES(?,?,?,?,?,?,?)",
                arrayOf(owner,if (hasMore) 0 else 1,snapshot,
                    if (hasMore) next else "", effectiveBaseline,
                    if (hasMore) prior.appliedSeq else effectiveBaseline,
                    if (prior.snapshot.isBlank()) expected else prior.expected)
            )
            sql.setTransactionSuccessful()
        } finally { sql.endTransaction() }
    }

    /** Apply deletion tombstones and upsert snapshots in server sequence order. */
    fun acceptChanges(context: Context, owner: String, after: Long, changes: JSONArray, next: Long): Boolean {
        val sql = db(context)
        sql.beginTransaction()
        try {
            val prior = state(context, owner)
            if (!prior.complete || prior.appliedSeq != after) return false
            var last = after
            for (i in 0 until changes.length()) {
                val change = changes.optJSONObject(i) ?: throw IllegalStateException("Invalid change")
                val seq = change.optLong("seq", -1L)
                val id = change.optString("id")
                if (seq <= last || id.isBlank()) throw IllegalStateException("Invalid change sequence")
                if (change.optString("action") == "DELETE") {
                    sql.execSQL("DELETE FROM records WHERE owner=? AND id=?",arrayOf(owner,id))
                } else if (change.optString("action") == "UPSERT") {
                    val record = change.optJSONObject("record")
                        ?: throw IllegalStateException("Missing record snapshot")
                    if (record.optString("id") != id) throw IllegalStateException("Mismatched record")
                    putRecord(sql, owner, record)
                } else throw IllegalStateException("Unknown change action")
                last = seq
            }
            if (last != next) throw IllegalStateException("Invalid delta checkpoint")
            sql.execSQL("UPDATE sync_state SET applied_seq=? WHERE owner=?",arrayOf(next,owner))
            sql.setTransactionSuccessful()
            return true
        } finally { sql.endTransaction() }
    }

    /** Remove only records positively acknowledged by the authoritative Core delete. */
    fun removeAcknowledged(context: Context,owner: String,ids: Set<String>) {
        if (owner.isBlank() || ids.isEmpty()) return
        val sql = db(context)
        sql.beginTransaction()
        try {
            ids.forEach { id ->
                sql.execSQL("DELETE FROM records WHERE owner=? AND id=?",arrayOf(owner,id))
            }
            sql.setTransactionSuccessful()
        } finally { sql.endTransaction() }
    }

    fun count(context: Context, owner: String, query: String = ""): Int {
        if (owner.isBlank()) return 0
        val q = query.trim().uppercase()
        val where = if (q.isBlank()) "owner=?" else
            "owner=? AND (instr(store_code,?)>0 OR instr(do_code,?)>0 OR instr(location,?)>0)"
        val args = if (q.isBlank()) arrayOf(owner) else arrayOf(owner,q,q,q)
        db(context).rawQuery("SELECT COUNT(*) FROM records WHERE $where",args).use { c ->
            return if (c.moveToFirst()) c.getInt(0) else 0
        }
    }

    fun page(context: Context, owner: String, query: String, page: Int, size: Int = 100): JSONArray {
        val result = JSONArray()
        if (owner.isBlank()) return result
        val q = query.trim().uppercase()
        val where = if (q.isBlank()) "owner=?" else
            "owner=? AND (instr(store_code,?)>0 OR instr(do_code,?)>0 OR instr(location,?)>0)"
        val offset = page.coerceAtLeast(0).coerceAtMost(100000) * size
        val args = if(q.isBlank()) arrayOf(owner,size.toString(),offset.toString())
            else arrayOf(owner,q,q,q,size.toString(),offset.toString())
        db(context).rawQuery(
            "SELECT payload FROM records WHERE $where ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",args
        ).use { c ->
            while (c.moveToNext()) result.put(JSONObject(c.getString(0)))
        }
        return result
    }
}
