package vn.supra.identitytest;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Signature-protected signal sent by the isolated Launcher after local logout. */
public final class SessionRevokedReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null ||
                !"vn.supra.identitytest.SESSION_CHANGED".equals(intent.getAction())) return;
        context.getSharedPreferences("sso_client_firebase_test", Context.MODE_PRIVATE)
                .edit().clear().commit();
        try { if (PocFirebase.configured()) PocFirebase.auth(context).signOut(); }
        catch (Exception ignored) {}
    }
}
