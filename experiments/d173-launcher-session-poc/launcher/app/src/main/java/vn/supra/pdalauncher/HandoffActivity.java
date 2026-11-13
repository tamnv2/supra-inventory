package vn.supra.pdalauncher;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;

/** One-time in-memory custom token handoff to a known same-signature test APK. */
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
        String customToken = TestSessionStore.takeHandoffToken(this);
        if (customToken == null || customToken.isEmpty()) {
            setResult(RESULT_CANCELED);
            finish();
            return;
        }
        Intent result = new Intent();
        result.putExtra("firebase_custom_token", customToken);
        result.putExtra("employee_code", TestSessionStore.employeeCode(this));
        result.putExtra("session_generation", TestSessionStore.generation(this));
        setResult(RESULT_OK, result);
        finish();
    }
}
