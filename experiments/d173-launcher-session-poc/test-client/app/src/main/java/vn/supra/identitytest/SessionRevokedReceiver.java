package vn.supra.identitytest;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Mirrors logout into the test app; never touches Báo hàng. */
public final class SessionRevokedReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null
                || !"vn.supra.identitytest.SESSION_CHANGED".equals(intent.getAction())) return;
        context.getSharedPreferences("sso_client_local", Context.MODE_PRIVATE)
                .edit().clear().commit();
    }
}
