package cd.cc.supra.inventory.beta

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.io.File

data class CatalogSyncResult(
    val updated: Boolean,
    val count: Int,
    val version: String,
)

class SkuCatalogCache(context: Context) {
    private val appContext = context.applicationContext
    private val helper = CatalogDb(appContext)

    @Volatile
    private var cachedCount = 0

    val count: Int
        get() = cachedCount

    val version: String
        get() = readMeta().first

    @Synchronized
    fun loadLocal(): Int {
        migrateLegacyIfNeeded()
        cachedCount = countRows("catalog_items")
        return cachedCount
    }

    fun search(query: String, limit: Int = 20): List<SkuItem> {
        val needle = query.trim()
        if (needle.length < 3) return emptyList()
        val bounded = limit.coerceIn(1, 50)
        val rows = ArrayList<SkuItem>(bounded)
        helper.readableDatabase.rawQuery(
            """SELECT sku, product_name
                 FROM catalog_items
                WHERE sku LIKE ? OR product_name LIKE ?
                ORDER BY CASE WHEN sku = ? THEN 0 WHEN sku LIKE ? THEN 1 ELSE 2 END,
                         sku ASC
                LIMIT ?""",
            arrayOf("%$needle%", "%$needle%", needle, "$needle%", bounded.toString()),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                rows += SkuItem(cursor.getString(0), cursor.getString(1))
            }
        }
        return rows
    }

    fun exactSku(value: String): SkuItem? {
        val target = value.trim()
        if (target.isBlank()) return null
        helper.readableDatabase.rawQuery(
            "SELECT sku, product_name FROM catalog_items WHERE lower(sku) = lower(?) LIMIT 1",
            arrayOf(target),
        ).use { cursor ->
            return if (cursor.moveToFirst()) SkuItem(cursor.getString(0), cursor.getString(1)) else null
        }
    }

    fun sync(
        api: InventoryApi,
        progress: (loaded: Int, total: Int) -> Unit = { _, _ -> },
    ): CatalogSyncResult {
        if (cachedCount == 0) loadLocal()
        val info = api.getCatalogInfo()
        val currentMeta = readMeta()
        if (cachedCount == info.count && currentMeta.first == info.version) {
            return CatalogSyncResult(updated = false, count = cachedCount, version = currentMeta.first)
        }

        val oldWatermark = currentMeta.first.substringAfter(':', "").trim()
        if (cachedCount > 0 && currentMeta.first.isNotBlank() && oldWatermark.isNotBlank() && cachedCount <= info.count) {
            try {
                prepareStage(copyCurrent = true)
                var afterUpdatedAt = oldWatermark
                var afterSku = ""
                var deltaLoaded = 0
                while (true) {
                    val page = api.getCatalogDelta(
                        since = oldWatermark,
                        afterUpdatedAt = afterUpdatedAt,
                        afterSku = afterSku,
                        limit = 2000,
                    )
                    applyStage(page.items)
                    deltaLoaded += page.items.size
                    progress((cachedCount + deltaLoaded).coerceAtMost(info.count), info.count)
                    val nextUpdatedAt = page.nextUpdatedAt ?: break
                    val nextSku = page.nextSku ?: throw IllegalStateException("Catalog delta cursor thiếu SKU.")
                    if (nextUpdatedAt < afterUpdatedAt || (nextUpdatedAt == afterUpdatedAt && nextSku <= afterSku)) {
                        throw IllegalStateException("Catalog delta cursor không tiến lên.")
                    }
                    afterUpdatedAt = nextUpdatedAt
                    afterSku = nextSku
                }
                val verified = api.getCatalogInfo()
                if (verified.version == info.version && verified.count == info.count && countRows("catalog_stage") == info.count) {
                    commitStage(info)
                    return CatalogSyncResult(updated = true, count = cachedCount, version = info.version)
                }
            } catch (_: Exception) {
                // The authoritative catalog table is untouched; fall through to a full staged refresh.
            }
        }

        prepareStage(copyCurrent = false)
        var after = ""
        var downloaded = 0
        while (true) {
            val page = api.getCatalogPage(after = after, limit = 2000)
            if (page.items.isEmpty()) {
                if (page.nextAfter != null) throw IllegalStateException("Catalog pagination không hợp lệ.")
                break
            }
            applyStage(page.items)
            downloaded += page.items.size
            progress(downloaded, info.count)
            val next = page.nextAfter ?: break
            if (next <= after) throw IllegalStateException("Catalog cursor không tiến lên.")
            after = next
        }

        val verified = api.getCatalogInfo()
        val stagedCount = countRows("catalog_stage")
        if (verified.version != info.version || verified.count != info.count) {
            throw IllegalStateException("Master SKU thay đổi trong lúc đồng bộ. Cache cũ được giữ nguyên.")
        }
        if (downloaded != info.count || stagedCount != info.count) {
            throw IllegalStateException("Catalog tải thiếu: $stagedCount/${info.count} SKU. Cache cũ được giữ nguyên.")
        }

        commitStage(info)
        return CatalogSyncResult(updated = true, count = cachedCount, version = info.version)
    }

    private fun prepareStage(copyCurrent: Boolean) {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            db.execSQL("DELETE FROM catalog_stage")
            if (copyCurrent) {
                db.execSQL("INSERT INTO catalog_stage (sku, product_name) SELECT sku, product_name FROM catalog_items")
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun applyStage(items: List<SkuItem>) {
        if (items.isEmpty()) return
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            val statement = db.compileStatement(
                "INSERT OR REPLACE INTO catalog_stage (sku, product_name) VALUES (?, ?)",
            )
            for (item in items) {
                statement.clearBindings()
                statement.bindString(1, item.sku.trim())
                statement.bindString(2, item.productName.trim())
                statement.executeInsert()
            }
            statement.close()
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun commitStage(info: CatalogInfo) {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            val staged = db.rawQuery("SELECT COUNT(*) FROM catalog_stage", null).use {
                if (it.moveToFirst()) it.getInt(0) else 0
            }
            if (staged != info.count) throw IllegalStateException("Catalog staging không đầy đủ: $staged/${info.count}.")
            db.execSQL("DELETE FROM catalog_items")
            db.execSQL("INSERT INTO catalog_items (sku, product_name) SELECT sku, product_name FROM catalog_stage")
            db.execSQL(
                """INSERT INTO catalog_meta (id, version, item_count)
                   VALUES (1, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET version = excluded.version, item_count = excluded.item_count""",
                arrayOf(info.version, info.count),
            )
            db.execSQL("DELETE FROM catalog_stage")
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        cachedCount = info.count
        removeLegacyFiles()
    }

    private fun readMeta(): Pair<String, Int> {
        helper.readableDatabase.rawQuery(
            "SELECT version, item_count FROM catalog_meta WHERE id = 1 LIMIT 1",
            null,
        ).use { cursor ->
            return if (cursor.moveToFirst()) {
                cursor.getString(0).orEmpty() to cursor.getInt(1)
            } else {
                "" to 0
            }
        }
    }

    private fun countRows(table: String): Int {
        val allowed = if (table == "catalog_stage") "catalog_stage" else "catalog_items"
        return helper.readableDatabase.rawQuery("SELECT COUNT(*) FROM $allowed", null).use {
            if (it.moveToFirst()) it.getInt(0) else 0
        }
    }

    private fun migrateLegacyIfNeeded() {
        if (countRows("catalog_items") > 0) return
        val legacyCatalog = File(appContext.filesDir, "sku_catalog.tsv")
        if (!legacyCatalog.exists()) return
        val legacyVersion = File(appContext.filesDir, "sku_catalog.version")
        val db = helper.writableDatabase
        var imported = 0
        db.beginTransaction()
        try {
            val statement = db.compileStatement(
                "INSERT OR REPLACE INTO catalog_items (sku, product_name) VALUES (?, ?)",
            )
            legacyCatalog.forEachLine(Charsets.UTF_8) { line ->
                val separator = line.indexOf('\t')
                if (separator <= 0 || separator >= line.length - 1) return@forEachLine
                val sku = line.substring(0, separator).trim()
                val name = line.substring(separator + 1).trim()
                if (sku.isBlank() || name.isBlank()) return@forEachLine
                statement.clearBindings()
                statement.bindString(1, sku)
                statement.bindString(2, name)
                statement.executeInsert()
                imported += 1
            }
            statement.close()
            if (imported > 0) {
                val version = if (legacyVersion.exists()) legacyVersion.readText(Charsets.UTF_8).trim() else ""
                db.execSQL(
                    "INSERT OR REPLACE INTO catalog_meta (id, version, item_count) VALUES (1, ?, ?)",
                    arrayOf(version, imported),
                )
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        cachedCount = imported
        if (imported > 0) removeLegacyFiles()
    }

    private fun removeLegacyFiles() {
        File(appContext.filesDir, "sku_catalog.tsv").delete()
        File(appContext.filesDir, "sku_catalog.version").delete()
        File(appContext.filesDir, "sku_catalog.tsv.tmp").delete()
        File(appContext.filesDir, "sku_catalog.version.tmp").delete()
    }

    private class CatalogDb(context: Context) : SQLiteOpenHelper(context, "sku_catalog.db", null, 1) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL(
                """CREATE TABLE catalog_items (
                     sku TEXT PRIMARY KEY,
                     product_name TEXT NOT NULL
                   )""",
            )
            db.execSQL("CREATE INDEX idx_catalog_product_name ON catalog_items(product_name)")
            db.execSQL(
                """CREATE TABLE catalog_stage (
                     sku TEXT PRIMARY KEY,
                     product_name TEXT NOT NULL
                   )""",
            )
            db.execSQL(
                """CREATE TABLE catalog_meta (
                     id INTEGER PRIMARY KEY CHECK (id = 1),
                     version TEXT NOT NULL,
                     item_count INTEGER NOT NULL
                   )""",
            )
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    }
}
