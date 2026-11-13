package vn.supra.identitytest;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.auth.FirebaseAuth;
import org.json.JSONObject;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** Authentic Firebase SSO client, completely separate from the Báo hàng APK. */
public final class MainActivity extends Activity {
    private static final String LAUNCHER_PKG = "vn.supra.pdalauncher.identitytest";
    private static final int HANDOFF_REQUEST = 7;
    private SharedPreferences local;
    private TextView status;
    private TextView account;
    private boolean pending;
    private long lastCheckedElapsed;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        local = getSharedPreferences("sso_client_firebase_test", MODE_PRIVATE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(26), dp(20), dp(20));
        root.setBackgroundColor(0xFFF5F7FA);
        TextView title = new TextView(this);
        title.setText("Firebase SSO — Test");
        title.setTextSize(25f);
        title.setTextColor(0xFF12253B);
        root.addView(title);
        TextView note = new TextView(this);
        note.setText("Firebase Báo hàng hiện hữu • tự nhận phiên Launcher, không thay APK thật.");
        note.setTextSize(13f);
        note.setTextColor(0xFF97500D);
        note.setPadding(0, dp(12), 0, dp(18));
        root.addView(note);
        status = label(root);
        account = label(root);
        Button refresh = new Button(this);
        refresh.setText("Tự nhận Firebase login từ Launcher");
        refresh.setAllCaps(false);
        refresh.setOnClickListener(v -> requestSession());
        root.addView(refresh);
        Button logout = new Button(this);
        logout.setText("Đăng xuất hai ứng dụng kiểm thử");
        logout.setAllCaps(false);
        logout.setOnClickListener(v -> logout());
        root.addView(logout);
        setContentView(root);
        render();
    }
    private TextView label(LinearLayout root) {
        TextView text = new TextView(this);
        text.setTextSize(17f);
        text.setTextColor(Color.DKGRAY);
        text.setGravity(Gravity.START);
        text.setPadding(0, dp(9), 0, dp(9));
        root.addView(text);
        return text;
    }

    @Override protected void onResume() {
        super.onResume();
        render();
        if (pending || SystemClock.elapsedRealtime() - lastCheckedElapsed < 1500L) return;
        if (!local.getString("firebase_uid", "").isEmpty()) verifyExistingSession();
        else requestSession();
    }

    private void requestSession() {
        if (pending) return;
        if (!PocFirebase.configured()) {
            clearLocal();
            status.setText("Chưa có cấu hình Firebase hiện hữu.");
            return;
        }
        if (getPackageManager().checkSignatures(LAUNCHER_PKG, getPackageName())
                != PackageManager.SIGNATURE_MATCH) {
            clearAndSignOut();
            status.setText("Hai APK thử phải có cùng chữ ký.");
            return;
        }
        pending = true;
        lastCheckedElapsed = SystemClock.elapsedRealtime();
        Intent intent = new Intent();
        intent.setClassName(LAUNCHER_PKG, "vn.supra.pdalauncher.HandoffActivity");
        try { startActivityForResult(intent, HANDOFF_REQUEST); }
        catch (Exception failure) {
            pending = false;
            status.setText("Launcher QA chưa sẵn sàng; hãy đăng nhập Launcher trước.");
        }
    }

    @Override protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (req != HANDOFF_REQUEST) return;
        if (result != RESULT_OK || data == null) {
            pending = false;
            clearAndSignOut();
            render();
            return;
        }
        String custom = data.getStringExtra("firebase_custom_token");
        String code = data.getStringExtra("employee_code");
        long expectedGeneration = data.getLongExtra("session_generation", 0L);
        if (custom == null || custom.isEmpty()
            || code == null || !code.matches("[a-z0-9._-]{1,64}") || expectedGeneration <= 0L) {
            pending = false;
            clearAndSignOut();
            render();
            return;
        }
        status.setText("Đang tự nhận phiên Firebase từ Launcher...");
        new Thread(() -> {
            boolean success = false;
            try {
                FirebaseAuth auth = PocFirebase.auth(this);
                auth.signOut();
                String uid = Tasks.await(auth.signInWithCustomToken(custom),
                    20, TimeUnit.SECONDS).getUser().getUid();
                var token = Tasks.await(auth.getCurrentUser().getIdToken(true),
                    12, TimeUnit.SECONDS);
                if (!validClaims(token.getClaims(), expectedGeneration))
                    throw new IllegalStateException("FIREBASE_CLAIMS_MISMATCH");
                JSONObject user = PocFirebase.me(token.getToken()).getJSONObject("user");
                if (!sameWorkerAccount(user, token.getClaims(), code))
                    throw new IllegalStateException("IDENTITY_MISMATCH");
                local.edit().putString("employee_code", code)
                    .putString("firebase_uid", uid)
                    .putLong("generation", expectedGeneration).commit();
                success = true;
            } catch (Exception failure) {
                clearAndSignOut();
            }
            final boolean ok = success;
            runOnUiThread(() -> {
                pending = false;
                lastCheckedElapsed = SystemClock.elapsedRealtime();
                render();
                if (!ok) status.setText("Phiên Firebase bị từ chối hoặc đã hết hạn.");
            });
        }, "poc-real-firebase-login").start();
    }

    private static boolean validClaims(Map<String, Object> claims, long generation) {
        Object val = claims.get("app_session_generation");
        String role = String.valueOf(claims.get("app_base_role"));
        return "ANDROID".equals(claims.get("app_session_channel"))
            && ("PICKER".equals(role) || "REPORTER".equals(role) || "ADMIN".equals(role))
            && val instanceof Number && ((Number) val).longValue() == generation;
    }
    private static boolean sameWorkerAccount(JSONObject user, Map<String, Object> claims, String username) {
        return username.equalsIgnoreCase(user.optString("username"))
            && user.optString("user_id").equals(String.valueOf(claims.get("app_user_id")))
            && user.optString("base_role").equals(String.valueOf(claims.get("app_base_role")));
    }

    private void verifyExistingSession() {
        if (pending || !PocFirebase.configured()) return;
        pending = true;
        lastCheckedElapsed = SystemClock.elapsedRealtime();
        new Thread(() -> {
            boolean valid = false;
            try {
                FirebaseAuth auth = PocFirebase.auth(this);
                if (auth.getCurrentUser() == null ||
                    !auth.getCurrentUser().getUid().equals(local.getString("firebase_uid", "")))
                    throw new IllegalStateException("UID_MISMATCH");
                var token = Tasks.await(auth.getCurrentUser().getIdToken(true),
                    12, TimeUnit.SECONDS);
                if (!validClaims(token.getClaims(), local.getLong("generation", 0L)))
                    throw new IllegalStateException("CLAIMS_MISMATCH");
                JSONObject user = PocFirebase.me(token.getToken()).getJSONObject("user");
                if (!sameWorkerAccount(user, token.getClaims(), local.getString("employee_code", "")))
                    throw new IllegalStateException("IDENTITY_MISMATCH");
                valid = true;
            } catch (Exception ignored) {
                clearAndSignOut(); // fail closed on reconnect, no silent mock fallback
            }
            final boolean ok = valid;
            runOnUiThread(() -> {
                pending = false;
                render();
                if (!ok) status.setText("Phiên không còn hợp lệ; hãy đăng nhập Launcher QA.");
            });
        }, "poc-real-firebase-recheck").start();
    }

    private void logout() {
        long generation = local.getLong("generation", 0L);
        clearAndSignOut();
        render();
        if (generation > 0L && getPackageManager().checkSignatures(LAUNCHER_PKG,
                getPackageName()) == PackageManager.SIGNATURE_MATCH) {
            Intent request = new Intent("vn.supra.identitytest.REQUEST_LOGOUT");
            request.setClassName(LAUNCHER_PKG, "vn.supra.pdalauncher.SessionCommandReceiver");
            request.putExtra("session_id", "qa:" + generation);
            sendBroadcast(request);
        }
    }

    private void clearLocal() { local.edit().clear().commit(); }
    private void clearAndSignOut() {
        clearLocal();
        try { if (PocFirebase.configured()) PocFirebase.auth(this).signOut(); }
        catch (Exception ignored) {}
    }
    private void render() {
        if (status == null || account == null) return;
        boolean active = !local.getString("firebase_uid", "").isEmpty();
        status.setText(active ? "Firebase Auth đã đăng nhập, kiểm tra Worker khi mở"
            : "Chưa có phiên Firebase hợp lệ");
        account.setVisibility(active ? View.VISIBLE : View.GONE);
        if (active) account.setText("Tài khoản Báo hàng: " + local.getString("employee_code", "")
            + "\nFirebase UID: " + local.getString("firebase_uid", "")
            + "\nSession generation: " + local.getLong("generation", 0L));
    }
    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
