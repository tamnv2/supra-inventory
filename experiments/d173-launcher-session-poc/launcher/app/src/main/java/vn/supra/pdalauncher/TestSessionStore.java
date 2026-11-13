package vn.supra.pdalauncher;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.ListenerRegistration;
import org.json.JSONObject;
import java.util.concurrent.TimeUnit;

/** D173 PoC: Auth and session use a dedicated Firebase project, never Production. */
final class TestSessionStore {
    private static final String NAME = "d173_firebase_ssotest";
    private static final String CODE = "employee_code";
    private static final String SESSION = "session_id";
    private static final String GENERATION = "generation";
    private static final String UID = "firebase_uid";
    interface Callback { void completed(boolean ok, String message); }
    static boolean isValidFormat(String code) {
        return code != null && code.matches("[0-9]{5,12}");
    }
    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }
    static String employeeCode(Context context) { return prefs(context).getString(CODE, ""); }
    static String sessionId(Context context) { return prefs(context).getString(SESSION, ""); }
    static long generation(Context context) { return prefs(context).getLong(GENERATION, 0L); }
    static boolean isUnlocked(Context context) {
        if (!PocFirebase.configured() || !isValidFormat(employeeCode(context))
                || sessionId(context).isEmpty()) return false;
        try {
            return PocFirebase.auth(context).getCurrentUser() != null
                && PocFirebase.auth(context).getCurrentUser().getUid()
                    .equals(prefs(context).getString(UID, ""));
        } catch (Exception ignored) { return false; }
    }
    static void login(Context context, String code, String email, String password, Callback callback) {
        new Thread(() -> {
            try {
                if (!PocFirebase.configured()) throw new IllegalStateException("Firebase test chưa được cấu hình.");
                if (!isValidFormat(code)) throw new IllegalArgumentException("Mã nhân viên không hợp lệ.");
                FirebaseAuth auth = PocFirebase.auth(context);
                if (!email.isEmpty()) {
                    if (password.isEmpty()) throw new IllegalArgumentException("Thiếu mật khẩu QA.");
                    Tasks.await(auth.signInWithEmailAndPassword(email, password), 20, TimeUnit.SECONDS);
                } else if (auth.getCurrentUser() == null) {
                    throw new IllegalStateException("Cần đăng nhập tài khoản QA một lần.");
                }
                JSONObject answer = PocFirebase.post(context, "open",
                        new JSONObject().put("employee_code", code), true);
                if (!answer.getString("uid").equals(auth.getCurrentUser().getUid()))
                    throw new IllegalStateException("Firebase UID không khớp.");
                prefs(context).edit().putString(CODE, code)
                    .putString(SESSION, answer.getString("session_id"))
                    .putLong(GENERATION, answer.getLong("generation"))
                    .putString(UID, answer.getString("uid")).commit();
                main(callback, true, "Firebase xác minh: phiên test đã mở.");
            } catch (Exception failure) {
                clearLocal(context);
                main(callback, false, "Không xác thực được tài khoản Firebase test.");
            }
        }, "poc-fire-login").start();
    }
    static void logout(Context context) {
        String id = sessionId(context);
        clearLocal(context);
        signalClient(context);
        new Thread(() -> {
            if (!id.isEmpty()) {
                try { PocFirebase.post(context, "logout",
                        new JSONObject().put("session_id", id), true); }
                catch (Exception ignored) { /* Local already locked; server timeout remains. */ }
            }
            try { PocFirebase.auth(context).signOut(); } catch (Exception ignored) {}
        }, "poc-fire-logout").start();
    }
    static void invalidate(Context context) {
        clearLocal(context);
        signalClient(context);
        try { if (PocFirebase.configured()) PocFirebase.auth(context).signOut(); }
        catch (Exception ignored) {}
    }
    static ListenerRegistration observe(Context context, Runnable onInvalidated) {
        if (!isUnlocked(context)) return null;
        String session = sessionId(context);
        String uid = prefs(context).getString(UID, "");
        return PocFirebase.firestore(context).collection("poc_sessions").document(session)
            .addSnapshotListener((snapshot, error) -> {
                if (error != null || snapshot == null || snapshot.getMetadata().isFromCache()) return;
                Long gen = snapshot.getLong("generation");
                Long deadline = snapshot.getLong("expires_at_ms");
                boolean valid = snapshot.exists()
                    && Boolean.TRUE.equals(snapshot.getBoolean("active"))
                    && uid.equals(snapshot.getString("uid"))
                    && gen != null && gen == generation(context)
                    && deadline != null && System.currentTimeMillis() < deadline;
                if (!valid && session.equals(sessionId(context))) {
                    invalidate(context);
                    new Handler(Looper.getMainLooper()).post(onInvalidated);
                }
            });
    }
    private static void clearLocal(Context context) { prefs(context).edit().clear().commit(); }
    private static void main(Callback cb, boolean ok, String message) {
        new Handler(Looper.getMainLooper()).post(() -> cb.completed(ok, message));
    }
    private static void signalClient(Context context) {
        Intent signal = new Intent("vn.supra.identitytest.SESSION_CHANGED");
        signal.setClassName("vn.supra.identitytest", "vn.supra.identitytest.SessionRevokedReceiver");
        context.sendBroadcast(signal);
    }
    private TestSessionStore() {}
}
