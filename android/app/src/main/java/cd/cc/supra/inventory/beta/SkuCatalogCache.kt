package cd.cc.supra.inventory.beta

import android.content.Context
import java.io.File

data class CatalogSyncResult(
    val updated: Boolean,
    val count: Int,
    val version: String,
)

class SkuCatalogCache(private val context: Context) {
    private val cacheFile = File(context.filesDir, "sku_catalog.tsv")
    private val versionFile = File(context.filesDir, "sku_catalog.version")

    @Volatile
    private var items: List<SkuItem> = emptyList()

    val count: Int
        get() = items.size

    val version: String
        get() = if (versionFile.exists()) versionFile.readText(Charsets.UTF_8).trim() else ""

    @Synchronized
    fun loadLocal(): Int {
        if (!cacheFile.exists()) {
            items = emptyList()
            return 0
        }
        val loaded = ArrayList<SkuItem>()
        cacheFile.forEachLine(Charsets.UTF_8) { line ->
            val separator = line.indexOf('\t')
            if (separator <= 0 || separator >= line.length - 1) return@forEachLine
            val sku = line.substring(0, separator).trim()
            val name = line.substring(separator + 1).trim()
            if (sku.isNotBlank() && name.isNotBlank()) loaded += SkuItem(sku, name)
        }
        items = loaded
        return loaded.size
    }

    fun search(query: String, limit: Int = 20): List<SkuItem> {
        val needle = query.trim().lowercase()
        if (needle.length < 3) return emptyList()
        val snapshot = items
        val results = ArrayList<SkuItem>(limit)
        for (item in snapshot) {
            if (
                item.sku.lowercase().contains(needle) ||
                item.productName.lowercase().contains(needle)
            ) {
                results += item
                if (results.size >= limit) break
            }
        }
        return results
    }

    fun exactSku(value: String): SkuItem? {
        val target = value.trim()
        if (target.isBlank()) return null
        return items.firstOrNull { it.sku.equals(target, ignoreCase = true) }
    }

    fun sync(
        api: InventoryApi,
        progress: (loaded: Int, total: Int) -> Unit = { _, _ -> },
    ): CatalogSyncResult {
        if (items.isEmpty() && cacheFile.exists()) loadLocal()
        val info = api.getCatalogInfo()
        val currentVersion = version
        if (cacheFile.exists() && currentVersion == info.version && items.size == info.count) {
            return CatalogSyncResult(updated = false, count = items.size, version = currentVersion)
        }

        val downloaded = ArrayList<SkuItem>(info.count.coerceAtLeast(16))
        var after = ""
        while (true) {
            val page = api.getCatalogPage(after = after, limit = 2000)
            if (page.items.isEmpty()) {
                if (page.nextAfter != null) throw IllegalStateException("Catalog pagination không hợp lệ.")
                break
            }
            downloaded.addAll(page.items)
            progress(downloaded.size, info.count)
            val next = page.nextAfter ?: break
            if (next <= after) throw IllegalStateException("Catalog cursor không tiến lên.")
            after = next
        }

        if (downloaded.size != info.count) {
            throw IllegalStateException("Catalog tải thiếu: ${downloaded.size}/${info.count} SKU. Cache cũ được giữ nguyên.")
        }

        saveAtomic(downloaded, info.version)
        items = downloaded
        return CatalogSyncResult(updated = true, count = downloaded.size, version = info.version)
    }

    private fun saveAtomic(next: List<SkuItem>, version: String) {
        val tempCatalog = File(context.filesDir, "sku_catalog.tsv.tmp")
        val tempVersion = File(context.filesDir, "sku_catalog.version.tmp")
        tempCatalog.bufferedWriter(Charsets.UTF_8).use { writer ->
            for (item in next) {
                val sku = clean(item.sku)
                val name = clean(item.productName)
                writer.append(sku).append('\t').append(name).append('\n')
            }
        }
        tempVersion.writeText(version, Charsets.UTF_8)

        if (cacheFile.exists() && !cacheFile.delete()) {
            tempCatalog.delete()
            tempVersion.delete()
            throw IllegalStateException("Không thể thay catalog cũ.")
        }
        if (!tempCatalog.renameTo(cacheFile)) {
            tempCatalog.delete()
            tempVersion.delete()
            throw IllegalStateException("Không thể lưu catalog mới.")
        }
        if (versionFile.exists()) versionFile.delete()
        if (!tempVersion.renameTo(versionFile)) {
            cacheFile.delete()
            throw IllegalStateException("Không thể lưu phiên bản catalog.")
        }
    }

    private fun clean(value: String): String =
        value.replace('\t', ' ').replace('\r', ' ').replace('\n', ' ').trim()
}
