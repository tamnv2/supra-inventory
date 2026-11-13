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
        return code != null && code.matches("[a-z0-9._-]{1,64}");
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
        if (!PocFirebase.configured() || !isValidFormat(employeeCode(context))
                || sessionId(context).isEmpty() || workerIdToken == null) return false;
        try {
            return PocFirebase.auth(context).getCurrentUser() != null
                && PocFirebase.auth(context).getCurrentUser().getUid()
                    .equals(prefs(context).getString(UID, ""));
        } catch (Exception ignored) { return false; }
    }

    static void login(Context context, String username, String password, Callback callback) {
        String account = username == null ? "" : username.trim().toLowerCase(java.util.Locale.ROOT);
        if (!PocFirebase.configured() || !isValidFormat(account)) {
            complete(callback, false, "Tên đăng nhập Báo hàng không hợp lệ hoặc Firebase chưa cấu hình.");
            return;
        }
        if (TextUtils.isEmpty(password)) {
            complete(callback, false, "Nhập mật khẩu vào Launcher một lần; app kiểm thử không cần nhập lại.");
            return;
        }
        new Thread(() -> {
            String issuedToken = null;
            String stage = "WORKER_LOGIN";
            try {
                JSONObject reply = PocFirebase.post("/api/auth/login", new JSONObject()
                    .put("username", account).put("password", password)
                    .put("client_type", "ANDROID").put("device_id", deviceId(context))
                    .put("force", false), null);
                stage = "WORKER_USER";
                issuedToken = reply.getString("id_token");
                JSONObject user = reply.getJSONObject("user");
                String role = user.optString("base_role");
                if (!("PICKER".equals(role) || "REPORTER".equals(role) || "ADMIN".equals(role))
                    || user.optString("user_id").isEmpty()) {
                    throw new IllegalStateException("INVALID_INVENTORY_ANDROID_ROLE_OR_ACCOUNT");
                }
                long gen = reply.optLong("session_generation", 0L);
                String relay = reply.getString("firebase_custom_token");
                if (gen <= 0 || relay.isEmpty()) throw new IllegalStateException("MISSING_RELAY_TOKEN");
                stage = "FIREBASE_SIGN_IN";
                FirebaseAuth auth = PocFirebase.auth(context);
                auth.signOut();
                String uid = Tasks.await(auth.signInWithCustomToken(relay),
                    20, TimeUnit.SECONDS).getUser().getUid();
                stage = "FIREBASE_CLAIMS";
                var claims = Tasks.await(auth.getCurrentUser().getIdToken(true),
                    12, TimeUnit.SECONDS).getClaims();
                if (!"ANDROID".equals(claims.get("app_session_channel"))
                    || !user.getString("user_id").equals(claims.get("app_user_id"))
                    || !(claims.get("app_session_generation") instanceof Number)
                    || ((Number) claims.get("app_session_generation")).longValue() != gen) {
                    throw new IllegalStateException("FIREBASE_CLAIM_MISMATCH");
                }
                stage = "WORKER_SESSION";
                JSONObject current = PocFirebase.me(issuedToken).getJSONObject("user");
                if (!user.getString("user_id").equals(current.optString("user_id"))
                    || !user.getString("base_role").equals(current.optString("base_role")))
                    throw new IllegalStateException("WORKER_ACCOUNT_MISMATCH");
                workerIdToken = issuedToken;
                relayCustomToken = relay;
                handoffConsumed = false;
                prefs(context).edit().putString(CODE, account)
                    .putString(UID, uid).putString(SESSION, "qa:" + gen)
                    .putLong(GENERATION, gen).commit();
                complete(callback, true, "Launcher đã đăng nhập. Mở app test để tự nhận phiên Firebase.");
            } catch (Exception problem) {
                if (issuedToken != null) {
                    try { PocFirebase.post("/api/auth/logout",
                        new JSONObject().put("device_id", deviceId(context)), issuedToken); }
                    catch (Exception ignored) {}
                }
                clear(context);
                String detail = problem.getMessage();
                if (detail != null && detail.startsWith("WORKER_HTTP_")) {
                    complete(callback, false, "Worker từ chối đăng nhập (" + detail + ").");
                } else if ("SESSION_ACTIVE_OTHER_DEVICE".equals(detail)) {
                    complete(callback, false, "Worker báo phiên PDA khác đang hoạt động (409); không thay thế phiên.");
                } else {
                    complete(callback, false, "Lỗi kiểm thử tại bước " + stage + ". Không kết luận sai mật khẩu.");
                }
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
