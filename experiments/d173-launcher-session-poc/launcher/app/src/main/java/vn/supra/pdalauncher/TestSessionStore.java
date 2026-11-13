package vn.supra.pdalauncher;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.util.UUID;

/** Local-only feasibility demo. NOT a Firebase login or user-identity proof. */
final class TestSessionStore {
    private static final String NAME = "d173_local_ssotest";
    private static final String CODE = "employee_code";
    private static final String SESSION = "session_id";
    private static final String GENERATION = "generation";

    static boolean isValidFormat(String code) {
        return code != null && code.matches("[0-9]{5,12}");
    }

    static String employeeCode(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE).getString(CODE, "");
    }

    static String sessionId(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE).getString(SESSION, "");
    }

    static long generation(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE).getLong(GENERATION, 0L);
    }

    static boolean isUnlocked(Context context) {
        return isValidFormat(employeeCode(context)) && !sessionId(context).isEmpty();
    }

    static void login(Context context, String code) {
        if (!isValidFormat(code)) throw new IllegalArgumentException("Invalid demo code");
        SharedPreferences prefs = context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(CODE, code)
                .putString(SESSION, UUID.randomUUID().toString())
                .putLong(GENERATION, prefs.getLong(GENERATION, 0L) + 1L)
                .commit();
        signalClient(context);
    }

    static void logout(Context context) {
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE).edit()
                .remove(CODE).remove(SESSION).commit();
        signalClient(context);
    }

    private static void signalClient(Context context) {
        Intent signal = new Intent("vn.supra.identitytest.SESSION_CHANGED");
        signal.setClassName("vn.supra.identitytest",
                "vn.supra.identitytest.SessionRevokedReceiver");
        context.sendBroadcast(signal);
    }

    private TestSessionStore() {}
}
