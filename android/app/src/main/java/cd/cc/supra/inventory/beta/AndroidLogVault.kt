package cd.cc.supra.inventory.beta

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * E175: same-device, cross-session log evidence encryption only.
 *
 * A new authenticated user can forward a previous session's sealed bundle,
 * but no previous user's secret/password/auth session is used or stored.
 * An invalid or undecryptable bundle is retained for recovery, never deleted.
 */
internal object AndroidLogVault {
    private const val ALIAS = "supra_inventory_log_outbox_v1"
    private const val PREFIX = "keystore-v1:"
    private const val IV_LENGTH = 12
    private const val MAX_PAYLOAD_CHARS = 400_000

    @Synchronized
    private fun deviceKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = store.getKey(ALIAS, null) as? SecretKey
        if (existing != null) return existing
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(
                KeyGenParameterSpec.Builder(
                    ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build()
            )
        }.generateKey()
    }

    fun seal(raw: String): String? {
        if (raw.isEmpty() || raw.length > MAX_PAYLOAD_CHARS) return null
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, deviceKey())
            val iv = cipher.iv
            if (iv.size != IV_LENGTH) return null
            val ciphertext = cipher.doFinal(raw.toByteArray(StandardCharsets.UTF_8))
            PREFIX + Base64.encodeToString(iv + ciphertext, Base64.NO_WRAP)
        } catch (_: Exception) { null }
    }

    fun open(sealed: String): String? {
        if (!sealed.startsWith(PREFIX)) return sealed // migration from legacy plaintext only
        return try {
            val bytes = Base64.decode(sealed.removePrefix(PREFIX), Base64.DEFAULT)
            if (bytes.size < IV_LENGTH + 16) return null
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, deviceKey(),
                GCMParameterSpec(128, bytes.copyOfRange(0, IV_LENGTH)))
            val raw = cipher.doFinal(bytes.copyOfRange(IV_LENGTH, bytes.size))
            String(raw, StandardCharsets.UTF_8).takeIf { it.length <= MAX_PAYLOAD_CHARS }
        } catch (_: Exception) { null }
    }
}
