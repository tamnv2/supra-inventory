package cd.cc.supra.obpp1291

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Device-only encrypted unsent form draft. It never creates an offline server queue. */
object ObppDraftStore {
    private const val PREFS = "obpp1291_private_unsent_draft_v1"
    private const val KEY = "obpp1291_unsent_form_aes_v1"
    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun secret(): SecretKey {
        val keys = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keys.getKey(KEY, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(KEY,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build())
        }.generateKey()
    }

    /** Changing signed-in account must never disclose the previous account's draft. */
    fun bindUser(ctx: Context, username: String) {
        val identity=username.trim().lowercase()
        val p=prefs(ctx)
        if(p.getString("owner","") != identity) {
            p.edit().remove("draft").putString("owner",identity).apply()
        }
    }
    fun save(ctx: Context, value: JSONObject) {
        try {
            val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(Cipher.ENCRYPT_MODE,secret())
            }
            val blob=cipher.iv + cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8))
            prefs(ctx).edit().putString("draft",Base64.encodeToString(blob,Base64.NO_WRAP)).apply()
        } catch (_: Exception) { /* Never break PDA scanning on Keystore failures. */ }
    }
    fun restore(ctx: Context): JSONObject {
        return try {
            val saved=prefs(ctx).getString("draft",null) ?: return JSONObject()
            val blob=Base64.decode(saved,Base64.NO_WRAP)
            if(blob.size<=12)return JSONObject()
            val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(Cipher.DECRYPT_MODE,secret(),GCMParameterSpec(128,blob.copyOfRange(0,12)))
            }
            JSONObject(String(cipher.doFinal(blob.copyOfRange(12,blob.size)),Charsets.UTF_8))
        } catch (_: Exception) { JSONObject() }
    }
    fun clear(ctx: Context) { prefs(ctx).edit().remove("draft").apply() }
}
