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

public final class MainActivity extends Activity {
    private static final String LAUNCHER_PKG = "vn.supra.pdalauncher.identitytest";
    private static final int HANDOFF_REQUEST = 7;
    private SharedPreferences local;
    private TextView status;
    private TextView account;
    private boolean pending;
    private long lastCheckedElapsed;

    private final SharedPreferences.OnSharedPreferenceChangeListener onLocalChange =
            (p, key) -> runOnUiThread(this::render);

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        local = getSharedPreferences("sso_client_local", MODE_PRIVATE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(26), dp(20), dp(20));
        root.setBackgroundColor(0xFFF5F7FA);

        TextView heading = new TextView(this);
        heading.setText("SSO kiểm thử");
        heading.setTextSize(25f);
        heading.setTextColor(0xFF12253B);
        root.addView(heading);

        TextView warning = new TextView(this);
        warning.setText("KHÔNG liên kết Báo hàng • KHÔNG đăng nhập Firebase • Chỉ kiểm thử truyền phiên giữa hai APK.");
        warning.setTextSize(13f);
        warning.setTextColor(0xFF97500D);
        warning.setPadding(0, dp(12), 0, dp(18));
        root.addView(warning);

        status = label(root);
        account = label(root);

        Button refresh = new Button(this);
        refresh.setAllCaps(false);
        refresh.setText("Nhận phiên từ Launcher");
        refresh.setOnClickListener(v -> requestSession());
        root.addView(refresh);

        Button logout = new Button(this);
        logout.setAllCaps(false);
        logout.setText("Đăng xuất cả hai app thử");
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
        local.registerOnSharedPreferenceChangeListener(onLocalChange);
        render();
        if (!pending && SystemClock.elapsedRealtime() - lastCheckedElapsed > 1500L) {
            requestSession();
        }
    }

    @Override protected void onPause() {
        local.unregisterOnSharedPreferenceChangeListener(onLocalChange);
        super.onPause();
    }

    private void requestSession() {
        if (pending) return;
        if (getPackageManager().checkSignatures(LAUNCHER_PKG, getPackageName())
                != PackageManager.SIGNATURE_MATCH) {
            local.edit().clear().commit();
            status.setText("Không có Launcher test cùng chữ ký. Hãy cài hai APK từ cùng bản build.");
            return;
        }
        pending = true;
        lastCheckedElapsed = SystemClock.elapsedRealtime();
        Intent intent = new Intent();
        intent.setClassName(LAUNCHER_PKG, "vn.supra.pdalauncher.HandoffActivity");
        try {
            startActivityForResult(intent, HANDOFF_REQUEST);
        } catch (Exception error) {
            pending = false;
            status.setText("Launcher test chưa sẵn sàng.");
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != HANDOFF_REQUEST) return;
        pending = false;
        lastCheckedElapsed = SystemClock.elapsedRealtime();
        if (resultCode != RESULT_OK || data == null ||
                !data.getBooleanExtra("demo_only", false)) {
            local.edit().clear().commit();
            render();
            return;
        }
        String code = data.getStringExtra("employee_code");
        String session = data.getStringExtra("session_id");
        long generation = data.getLongExtra("generation", 0L);
        if (code == null || !code.matches("[0-9]{5,12}")
                || session == null || session.isEmpty() || generation <= 0L) {
            local.edit().clear().commit();
            render();
            return;
        }
        local.edit().putString("employee_code", code).putString("session_id", session)
                .putLong("generation", generation).commit();
        render();
    }

    private void logout() {
        String session = local.getString("session_id", "");
        if (!session.isEmpty() && getPackageManager().checkSignatures(LAUNCHER_PKG,
                getPackageName()) == PackageManager.SIGNATURE_MATCH) {
            Intent request = new Intent("vn.supra.identitytest.REQUEST_LOGOUT");
            request.setClassName(LAUNCHER_PKG, "vn.supra.pdalauncher.SessionCommandReceiver");
            request.putExtra("session_id", session);
            sendBroadcast(request);
        }
        local.edit().clear().commit();
        render();
    }

    private void render() {
        if (status == null || account == null) return;
        String session = local.getString("session_id", "");
        boolean active = !session.isEmpty();
        status.setText(active ? "Phiên mô phỏng đang hoạt động" : "Chưa nhận phiên hoặc đã đăng xuất");
        account.setVisibility(active ? View.VISIBLE : View.GONE);
        if (active) {
            account.setText("Mã nhân viên thử: " + local.getString("employee_code", "")
                    + "\nGeneration: " + local.getLong("generation", 0L));
        }
    }

    private int dp(int x) {
        return Math.round(x * getResources().getDisplayMetrics().density);
    }
}
