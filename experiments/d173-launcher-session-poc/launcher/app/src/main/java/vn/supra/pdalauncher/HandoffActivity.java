package vn.supra.pdalauncher;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import org.json.JSONObject;

/** One-time server grant passed only through same-signature explicit IPC. */
public final class HandoffActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        String caller = getCallingPackage();
        if (!"vn.supra.identitytest".equals(caller)
                || getPackageManager().checkSignatures(caller, getPackageName())
                   != PackageManager.SIGNATURE_MATCH
                || !TestSessionStore.isUnlocked(this)) {
            setResult(RESULT_CANCELED);
            finish();
            return;
        }
        String current = TestSessionStore.sessionId(this);
        new Thread(() -> {
            Intent result = new Intent();
            boolean success = false;
            try {
                JSONObject reply = PocFirebase.post(this, "grant",
                    new JSONObject().put("session_id", current), true);
                if (current.equals(TestSessionStore.sessionId(this))) {
                    result.putExtra("grant", reply.getString("grant"));
                    result.putExtra("employee_code", TestSessionStore.employeeCode(this));
                    success = true;
                }
            } catch (Exception ignored) {}
            final boolean ok = success;
            runOnUiThread(() -> {
                setResult(ok ? RESULT_OK : RESULT_CANCELED, ok ? result : null);
                finish();
            });
        }, "poc-fire-grant").start();
    }
}
