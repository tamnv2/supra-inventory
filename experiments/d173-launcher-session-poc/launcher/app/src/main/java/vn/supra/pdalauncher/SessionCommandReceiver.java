package vn.supra.pdalauncher;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;

/** Receiver is additionally protected by a signature-level manifest permission. */
public final class SessionCommandReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null || !"vn.supra.identitytest.REQUEST_LOGOUT".equals(intent.getAction()))
            return;
        if (context.getPackageManager().checkSignatures(
                "vn.supra.identitytest", context.getPackageName())
                != PackageManager.SIGNATURE_MATCH) return;
        String requestedSession = intent.getStringExtra("session_id");
        if (requestedSession == null || requestedSession.isEmpty()
                || !requestedSession.equals(TestSessionStore.sessionId(context))) return;
        TestSessionStore.logout(context);
    }
}
