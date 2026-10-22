package cd.cc.supra.obpp1291

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64

/** E026: private encrypted durable OBPP-only session, never reused by Inventory channels. */
object ObppSessionStore {
    private const val ALIAS = "obpp1291_device_session_aes_v1"
    private const val PREFS = "obpp1291_private_session_v1"

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build())
        }.generateKey()
    }
    fun save(ctx: Context, token: String, displayName: String) {
        require(token.matches(Regex("obpp1_[0-9a-f]{64}")))
        val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.ENCRYPT_MODE, key())
        }
        val ciphertext=cipher.doFinal(token.toByteArray(Charsets.UTF_8))
        val value=Base64.encodeToString(cipher.iv + ciphertext, Base64.NO_WRAP)
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("session", value).putString("name", displayName.take(120)).apply()
    }
    fun restore(ctx: Context): Pair<String,String>? {
        return try {
        val prefs=ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val encoded=prefs.getString("session", null) ?: return null
        val bytes=Base64.decode(encoded, Base64.NO_WRAP)
        if(bytes.size<=12) return null
        val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,bytes.copyOfRange(0,12)))
        }
        val token=String(cipher.doFinal(bytes.copyOfRange(12,bytes.size)),Charsets.UTF_8)
        if(!token.matches(Regex("obpp1_[0-9a-f]{64}")))null else token to (prefs.getString("name","") ?: "")
        } catch (_: Exception) { null }
    }
    fun clear(ctx: Context) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
