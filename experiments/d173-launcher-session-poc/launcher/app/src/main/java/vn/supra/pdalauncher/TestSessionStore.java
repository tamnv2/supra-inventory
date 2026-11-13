package vn.supra.pdalauncher;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.auth.FirebaseAuth;
import org.json.JSONObject;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/** Real Inventory Firebase SSO with an explicitly pinned, idle QA Picker account only. */
final class TestSessionStore {
    private static final String NAME = "d173_live_auth_qa";
    private static final String CODE = "employee_code";
    private static final String SESSION = "session_id";
    private static final String GENERATION = "generation";
    private static final String UID = "firebase_uid";
    private static final String DEVICE = "device_id";

    private static volatile String workerIdToken;
    private static volatile String relayCustomToken;
    private static volatile boolean handoffConsumed;

    interface Callback { void completed(boolean success, String reason); }
    static boolean isValidFormat(String code) {
        return code != null && code.matches("[0-9]{5,12}");
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    static String employeeCode(Context context) { return prefs(context).getString(CODE, ""); }
    static String sessionId(Context context) { return prefs(context).getString(SESSION, ""); }
    static long generation(Context context) { return prefs(context).getLong(GENERATION, 0L); }

    static String deviceId(Context context) {
        String id = prefs(context).getString(DEVICE, "");
        if (!id.isEmpty()) return id;
        id = "android:d173-qa-poc:" + UUID.randomUUID();
        prefs(context).edit().putString(DEVICE, id).commit();
        return id;
    }

    static boolean isUnlocked(Context context) {
        if (!PocFirebase.configured() || !BuildConfig.TEST_QA_USERNAME.equals(employeeCode(context))
                || sessionId(context).isEmpty() || workerIdToken == null) return false;
        try {
            return PocFirebase.auth(context).getCurrentUser() != null
                && PocFirebase.auth(context).getCurrentUser().getUid()
                    .equals(prefs(context).getString(UID, ""));
        } catch (Exception ignored) { return false; }
    }

    static void login(Context context, String username, String password, Callback callback) {
        if (!PocFirebase.configured() || !BuildConfig.TEST_QA_USERNAME.equals(username)) {
            complete(callback, false, "Chỉ cho phép tài khoản QA đã đăng ký; không xác thực user Production.");
            return;
        }
        if (TextUtils.isEmpty(password)) {
            complete(callback, false, "Cần nhập mật khẩu QA, không nhúng mật khẩu cố định.");
            return;
        }
        new Thread(() -> {
            String issuedToken = null;
            try {
                JSONObject reply = PocFirebase.post("/api/auth/login", new JSONObject()
                    .put("username", username).put("password", password)
                    .put("client_type", "ANDROID").put("device_id", deviceId(context))
                    .put("force", false), null);
                issuedToken = reply.getString("id_token");
                JSONObject user = reply.getJSONObject("user");
                if (!"PICKER".equals(user.optString("base_role"))
                    || !username.equalsIgnoreCase(user.optString("username"))
                    || !username.equals(user.optString("employee_code"))) {
                    throw new IllegalStateException("TEST_ACCOUNT_NOT_PICKER_OR_NOT_PINNED");
                }
                long gen = reply.optLong("session_generation", 0L);
                String relay = reply.getString("firebase_custom_token");
                if (gen <= 0 || relay.isEmpty()) throw new IllegalStateException("MISSING_RELAY_TOKEN");
                FirebaseAuth auth = PocFirebase.auth(context);
                auth.signOut();
                String uid = Tasks.await(auth.signInWithCustomToken(relay),
                    20, TimeUnit.SECONDS).getUser().getUid();
                var claims = Tasks.await(auth.getCurrentUser().getIdToken(true),
                    12, TimeUnit.SECONDS).getClaims();
                if (!"ANDROID".equals(claims.get("app_session_channel"))
                    || !user.getString("user_id").equals(claims.get("app_user_id"))
                    || !(claims.get("app_session_generation") instanceof Number)
                    || ((Number) claims.get("app_session_generation")).longValue() != gen) {
                    throw new IllegalStateException("FIREBASE_CLAIM_MISMATCH");
                }
                PocFirebase.me(issuedToken); // server validates active session generation
                workerIdToken = issuedToken;
                relayCustomToken = relay;
                handoffConsumed = false;
                prefs(context).edit().putString(CODE, username)
                    .putString(UID, uid).putString(SESSION, "qa:" + gen)
                    .putLong(GENERATION, gen).commit();
                complete(callback, true, "Đã xác minh Firebase thật. UID và thế hệ phiên hợp lệ.");
            } catch (Exception problem) {
                if (issuedToken != null) {
                    try { PocFirebase.post("/api/auth/logout",
                        new JSONObject().put("device_id", deviceId(context)), issuedToken); }
                    catch (Exception ignored) {}
                }
                clear(context);
                complete(callback, false, "Đăng nhập QA thất bại hoặc tài khoản đang hoạt động trên PDA khác.");
            }
        }, "d173-live-qa-login").start();
    }

    /** A short-lived custom token remains in RAM and can be issued to the test client only once. */
    static synchronized String takeHandoffToken(Context context) {
        if (!isUnlocked(context) || handoffConsumed || relayCustomToken == null) return null;
        handoffConsumed = true;
        return relayCustomToken;
    }

    static void logout(Context context) {
        String token = workerIdToken;
        String device = deviceId(context);
        clear(context);
        signalClient(context);
        if (token != null) new Thread(() -> {
            try { PocFirebase.post("/api/auth/logout",
                    new JSONObject().put("device_id", device), token); }
            catch (Exception ignored) { /* Client stays locked; field must check server receipt. */ }
        }, "d173-live-qa-logout").start();
    }

    static void invalidate(Context context) {
        clear(context);
        signalClient(context);
    }

    private static void clear(Context context) {
        workerIdToken = null;
        relayCustomToken = null;
        handoffConsumed = true;
        prefs(context).edit().remove(CODE).remove(SESSION).remove(GENERATION)
            .remove(UID).commit(); // device ID survives, tokens never persisted
        try { if (PocFirebase.configured()) PocFirebase.auth(context).signOut(); }
        catch (Exception ignored) {}
    }

    private static void complete(Callback callback, boolean ok, String message) {
        new Handler(Looper.getMainLooper()).post(() -> callback.completed(ok, message));
    }

    private static void signalClient(Context context) {
        Intent signal = new Intent("vn.supra.identitytest.SESSION_CHANGED");
        signal.setClassName("vn.supra.identitytest", "vn.supra.identitytest.SessionRevokedReceiver");
        context.sendBroadcast(signal);
    }
    private TestSessionStore() {}
}
