package vn.supra.pdalauncher;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;

/** Explicit same-signature IPC; never returns credentials or real auth tokens. */
public final class HandoffActivity extends Activity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String caller = getCallingPackage();
        if (!"vn.supra.identitytest".equals(caller)
                || getPackageManager().checkSignatures(caller, getPackageName())
                   != PackageManager.SIGNATURE_MATCH
                || !TestSessionStore.isUnlocked(this)) {
            setResult(RESULT_CANCELED);
            finish();
            return;
        }
        Intent response = new Intent();
        response.putExtra("employee_code", TestSessionStore.employeeCode(this));
        response.putExtra("session_id", TestSessionStore.sessionId(this));
        response.putExtra("generation", TestSessionStore.generation(this));
        response.putExtra("demo_only", true);
        setResult(RESULT_OK, response);
        finish();
    }
}
