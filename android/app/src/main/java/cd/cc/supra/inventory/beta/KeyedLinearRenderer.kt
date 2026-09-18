package cd.cc.supra.inventory.beta

import android.view.View
import android.widget.LinearLayout

/**
 * Small keyed renderer for operational PDA lists.
 *
 * Stable rows stay attached when their key/signature does not change, avoiding
 * removeAllViews() churn and preserving scroll/touch state across realtime refreshes.
 */
class KeyedLinearRenderer(private val container: LinearLayout) {
    private data class Entry(val signature: String, val view: View)
    private val entries = LinkedHashMap<String, Entry>()

    fun <T> render(
        items: List<T>,
        keyOf: (T) -> String,
        signatureOf: (T) -> String,
        createView: (T) -> View,
    ) {
        val desiredKeys = items.map(keyOf).toSet()
        val stale = entries.keys.filterNot(desiredKeys::contains)
        for (key in stale) {
            entries.remove(key)?.view?.let(container::removeView)
        }

        items.forEachIndexed { index, item ->
            val key = keyOf(item)
            val signature = signatureOf(item)
            val existing = entries[key]
            val view = if (existing == null || existing.signature != signature) {
                existing?.view?.let(container::removeView)
                createView(item).also { entries[key] = Entry(signature, it) }
            } else {
                existing.view
            }

            val currentIndex = container.indexOfChild(view)
            val targetIndex = index.coerceAtMost(container.childCount)
            when {
                currentIndex < 0 -> container.addView(view, targetIndex)
                currentIndex != index -> {
                    container.removeViewAt(currentIndex)
                    container.addView(view, index.coerceAtMost(container.childCount))
                }
            }
        }
    }

    fun clear() {
        entries.clear()
        container.removeAllViews()
    }
}
