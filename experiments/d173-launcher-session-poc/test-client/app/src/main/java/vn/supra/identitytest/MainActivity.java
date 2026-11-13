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
import com.google.firebase.firestore.ListenerRegistration;
import org.json.JSONObject;
import java.util.concurrent.TimeUnit;

/** Real Firebase Auth transfer from the isolated test Launcher, not Báo hàng. */
public final class MainActivity extends Activity {
    private static final String LAUNCHER_PKG = "vn.supra.pdalauncher.identitytest";
    private static final int HANDOFF_REQUEST = 7;
    private SharedPreferences local;
    private TextView status;
    private TextView account;
    private boolean pending;
    private long lastCheckedElapsed;
    private ListenerRegistration observer;
    private FirebaseAuth.AuthStateListener authListener;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        local = getSharedPreferences("sso_client_firebase_test", MODE_PRIVATE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(26), dp(20), dp(20));
        root.setBackgroundColor(0xFFF5F7FA);
        TextView heading = new TextView(this);
        heading.setText("Firebase SSO kiểm thử");
        heading.setTextSize(25f);
        heading.setTextColor(0xFF12253B);
        root.addView(heading);
        TextView warning = new TextView(this);
        warning.setText("Chỉ kết nối Firebase QA độc lập; không đọc hoặc thay đổi Báo hàng.");
        warning.setTextSize(13f);
        warning.setTextColor(0xFF97500D);
        warning.setPadding(0, dp(12), 0, dp(18));
        root.addView(warning);
        status = label(root);
        account = label(root);
        Button refresh = new Button(this);
        refresh.setAllCaps(false);
        refresh.setText("Tự nhận Firebase session từ Launcher");
        refresh.setOnClickListener(v -> requestSession());
        root.addView(refresh);
        Button logout = new Button(this);
        logout.setAllCaps(false);
        logout.setText("Đăng xuất cả hai APK thử");
        logout.setOnClickListener(v -> logout());
        root.addView(logout);
        setContentView(root);
        render();
    }

    private TextView label(LinearLayout root) {
        TextView text = new TextView(this);
        text.setTextColor(Color.DKGRAY);
        text.setTextSize(17f);
        text.setGravity(Gravity.START);
        text.setPadding(0, dp(9), 0, dp(9));
        root.addView(text);
        return text;
    }

    @Override protected void onResume() {
        super.onResume();
        render();
        if (PocFirebase.configured()) {
            authListener = auth -> {
                if (auth.getCurrentUser() == null && !local.getString("session_id", "").isEmpty()) {
                    clearLocal();
                    runOnUiThread(this::render);
                }
            };
            PocFirebase.auth(this).addAuthStateListener(authListener);
        }
        observeSession();
        if (!pending && SystemClock.elapsedRealtime() - lastCheckedElapsed > 1500L) {
            requestSession();
        }
    }

    @Override protected void onPause() {
        if (observer != null) { observer.remove(); observer = null; }
        if (authListener != null) {
            PocFirebase.auth(this).removeAuthStateListener(authListener);
            authListener = null;
        }
        super.onPause();
    }

    private void requestSession() {
        if (pending) return;
        if (!PocFirebase.configured()) {
            status.setText("Chưa có Firebase QA độc lập. Không kết nối Production.");
            return;
        }
        if (getPackageManager().checkSignatures(LAUNCHER_PKG, getPackageName())
                != PackageManager.SIGNATURE_MATCH) {
            clearLocal();
            status.setText("Hai APK thử phải dùng cùng chữ ký.");
            return;
        }
        pending = true;
        lastCheckedElapsed = SystemClock.elapsedRealtime();
        Intent intent = new Intent();
        intent.setClassName(LAUNCHER_PKG, "vn.supra.pdalauncher.HandoffActivity");
        try {
            startActivityForResult(intent, HANDOFF_REQUEST);
        } catch (Exception ignored) {
            pending = false;
            status.setText("Launcher test chưa xác thực định danh QA.");
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != HANDOFF_REQUEST) return;
        if (resultCode != RESULT_OK || data == null) {
            pending = false;
            clearAndSignOut();
            render();
            return;
        }
        String grant = data.getStringExtra("grant");
        String code = data.getStringExtra("employee_code");
        if (grant == null || code == null || !code.matches("[0-9]{5,12}")) {
            pending = false;
            clearAndSignOut();
            render();
            return;
        }
        status.setText("Đang xác nhận token một lần với Firebase...");
        new Thread(() -> {
            boolean ok = false;
            try {
                JSONObject answer = PocFirebase.post(this, "redeem",
                        new JSONObject().put("grant", grant), false);
                String token = answer.getString("custom_token");
                String expectedUid = answer.getString("uid");
                FirebaseAuth auth = PocFirebase.auth(this);
                Tasks.await(auth.signInWithCustomToken(token), 20, TimeUnit.SECONDS);
                if (auth.getCurrentUser() == null ||
                        !expectedUid.equals(auth.getCurrentUser().getUid()))
                    throw new IllegalStateException("Firebase UID mismatch");
                Object rawGeneration = Tasks.await(auth.getCurrentUser().getIdToken(true),
                        12, TimeUnit.SECONDS).getClaims().get("poc_session_generation");
                long generation = answer.getLong("generation");
                if (!(rawGeneration instanceof Number) ||
                        ((Number) rawGeneration).longValue() != generation)
                    throw new IllegalStateException("Generation mismatch");
                local.edit().putString("employee_code", code)
                    .putString("session_id", answer.getString("session_id"))
                    .putString("firebase_uid", expectedUid)
                    .putLong("generation", generation).commit();
                ok = true;
            } catch (Exception ignored) {
                clearAndSignOut();
            }
            final boolean success = ok;
            runOnUiThread(() -> {
                pending = false;
                render();
                if (success) observeSession();
                else status.setText("Firebase SSO thất bại; không nhận phiên.");
            });
        }, "poc-fire-client-redeem").start();
    }

    private void observeSession() {
        if (observer != null) { observer.remove(); observer = null; }
        String id = local.getString("session_id", "");
        if (id.isEmpty() || !PocFirebase.configured()) return;
        String uid = local.getString("firebase_uid", "");
        try {
            if (PocFirebase.auth(this).getCurrentUser() == null ||
                    !uid.equals(PocFirebase.auth(this).getCurrentUser().getUid())) {
                clearAndSignOut(); render(); return;
            }
            observer = PocFirebase.firestore(this).collection("poc_sessions").document(id)
                .addSnapshotListener((doc, error) -> {
                    if (error != null || doc == null || doc.getMetadata().isFromCache()) return;
                    Long generation = doc.getLong("generation");
                    Long expires = doc.getLong("expires_at_ms");
                    boolean valid = doc.exists() && Boolean.TRUE.equals(doc.getBoolean("active"))
                        && uid.equals(doc.getString("uid"))
                        && generation != null && generation == local.getLong("generation", 0L)
                        && expires != null && System.currentTimeMillis() < expires;
                    if (!valid && id.equals(local.getString("session_id", ""))) {
                        clearAndSignOut();
                        runOnUiThread(this::render);
                    }
                });
        } catch (Exception ignored) { clearAndSignOut(); render(); }
    }

    private void logout() {
        String id = local.getString("session_id", "");
        clearLocal();
        render();
        new Thread(() -> {
            if (!id.isEmpty()) {
                try {
                    PocFirebase.post(this, "logout",
                        new JSONObject().put("session_id", id), true);
                } catch (Exception ignored) {}
            }
            try { PocFirebase.auth(this).signOut(); } catch (Exception ignored) {}
            // Keep local UI locked, notify Launcher even if offline.
            if (!id.isEmpty() && getPackageManager().checkSignatures(
                    LAUNCHER_PKG, getPackageName()) == PackageManager.SIGNATURE_MATCH) {
                Intent request = new Intent("vn.supra.identitytest.REQUEST_LOGOUT");
                request.setClassName(LAUNCHER_PKG, "vn.supra.pdalauncher.SessionCommandReceiver");
                request.putExtra("session_id", id);
                sendBroadcast(request);
            }
        }, "poc-fire-client-logout").start();
    }

    private void clearLocal() { local.edit().clear().commit(); }
    private void clearAndSignOut() {
        clearLocal();
        try { if (PocFirebase.configured()) PocFirebase.auth(this).signOut(); }
        catch (Exception ignored) {}
    }
    private void render() {
        if (status == null || account == null) return;
        String id = local.getString("session_id", "");
        boolean active = !id.isEmpty();
        status.setText(active ? "Đã đăng nhập Firebase QA" : "Chưa có phiên Firebase hợp lệ");
        account.setVisibility(active ? View.VISIBLE : View.GONE);
        if (active) {
            account.setText("Mã nhân viên QA: " + local.getString("employee_code", "")
                + "\nUID: " + local.getString("firebase_uid", "")
                + "\nGeneration: " + local.getLong("generation", 0L));
        }
    }
    private int dp(int x) { return Math.round(x * getResources().getDisplayMetrics().density); }
}
