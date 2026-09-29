package cd.cc.supra.inventory.dnddiag;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.admin.DevicePolicyManager;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import android.os.UserManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final String CHANNEL_ID = "supra_dnd_diag_v1";
    private static final String ENDPOINT = "https://inventory-beta.supra.cc.cd/api/diagnostics/dnd/upload";
    private static final String ACTION_DND_DETAIL = "android.settings.NOTIFICATION_POLICY_ACCESS_DETAIL_SETTINGS";
    private static final String PROBE_PREFS = "d151_probe_v2";

    private TextView status;
    private Button sendButton;
    private JSONObject latestSnapshot = new JSONObject();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        render();
        refreshSnapshot();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (status != null) refreshSnapshot();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private TextView text(String value, float size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(Color.rgb(30, 41, 59));
        if (bold) view.setTypeface(view.getTypeface(), Typeface.BOLD);
        return view;
    }

    private void render() {
        ScrollView root = new ScrollView(this);
        root.setFillViewport(true);
        root.setBackgroundColor(Color.rgb(245, 247, 250));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(18), dp(22), dp(18), dp(28));
        root.addView(content, new ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        TextView title = text("MT90 · DND Diagnostic", 22f, true);
        content.addView(title);

        TextView note = text(
            "Probe v2: thử trang DND chi tiết theo app và overlay độc lập với DND. Không đăng nhập, không Firebase, không nghiệp vụ.",
            13f,
            false
        );
        note.setPadding(0, dp(8), 0, dp(14));
        content.addView(note);

        Button detailButton = new Button(this);
        detailButton.setText("1. MỞ DND CHI TIẾT APP");
        detailButton.setOnClickListener(v -> openDndDetailSettings());
        content.addView(detailButton, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(50)
        ));

        Button settingsButton = new Button(this);
        settingsButton.setText("2. MỞ DND DANH SÁCH CHUNG");
        settingsButton.setOnClickListener(v -> openDndSettings());
        LinearLayout.LayoutParams settingsParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(50)
        );
        settingsParams.topMargin = dp(8);
        content.addView(settingsButton, settingsParams);

        Button overlayPermissionButton = new Button(this);
        overlayPermissionButton.setText("3. MỞ QUYỀN HIỂN THỊ TRÊN ỨNG DỤNG KHÁC");
        overlayPermissionButton.setOnClickListener(v -> openOverlaySettings());
        LinearLayout.LayoutParams overlayPermissionParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(54)
        );
        overlayPermissionParams.topMargin = dp(8);
        content.addView(overlayPermissionButton, overlayPermissionParams);

        Button overlayProbeButton = new Button(this);
        overlayProbeButton.setText("4. TEST OVERLAY 15 GIÂY");
        overlayProbeButton.setOnClickListener(v -> startOverlayProbe());
        LinearLayout.LayoutParams overlayProbeParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(52)
        );
        overlayProbeParams.topMargin = dp(8);
        content.addView(overlayProbeButton, overlayProbeParams);

        Button refreshButton = new Button(this);
        refreshButton.setText("LÀM MỚI TRẠNG THÁI");
        refreshButton.setOnClickListener(v -> refreshSnapshot());
        LinearLayout.LayoutParams refreshParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(50)
        );
        refreshParams.topMargin = dp(8);
        content.addView(refreshButton, refreshParams);

        sendButton = new Button(this);
        sendButton.setText("GỬI LOG VỀ BETA");
        sendButton.setOnClickListener(v -> sendLog());
        LinearLayout.LayoutParams sendParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(54)
        );
        sendParams.topMargin = dp(8);
        content.addView(sendButton, sendParams);

        TextView label = text("TRẠNG THÁI ĐỌC TRỰC TIẾP TỪ ANDROID", 12f, true);
        label.setPadding(0, dp(18), 0, dp(8));
        content.addView(label);

        status = text("", 11.5f, false);
        status.setTypeface(Typeface.MONOSPACE);
        status.setTextIsSelectable(true);
        status.setPadding(dp(12), dp(12), dp(12), dp(12));
        status.setBackgroundColor(Color.WHITE);
        content.addView(status, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        setContentView(root);
    }

    private void openDndDetailSettings() {
        Intent detail = new Intent(ACTION_DND_DETAIL);
        detail.setData(Uri.parse("package:" + getPackageName()));
        try {
            if (detail.resolveActivity(getPackageManager()) != null) {
                getSharedPreferences(PROBE_PREFS, MODE_PRIVATE).edit()
                    .putString("last_dnd_settings_route", "DETAIL")
                    .putString("last_dnd_settings_error", "")
                    .apply();
                startActivity(detail);
                return;
            }
            getSharedPreferences(PROBE_PREFS, MODE_PRIVATE).edit()
                .putString("last_dnd_settings_route", "DETAIL_UNRESOLVED_FALLBACK_LIST")
                .apply();
            openDndSettings();
        } catch (Exception error) {
            getSharedPreferences(PROBE_PREFS, MODE_PRIVATE).edit()
                .putString("last_dnd_settings_route", "DETAIL_ERROR_FALLBACK_LIST")
                .putString("last_dnd_settings_error", error.getClass().getSimpleName() + ":" + String.valueOf(error.getMessage()))
                .apply();
            openDndSettings();
        }
    }

    private void openDndSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            startActivity(intent);
        } catch (Exception error) {
            Toast.makeText(this, "Thiết bị không mở được trang quyền DND.", Toast.LENGTH_LONG).show();
        }
    }

    private void openOverlaySettings() {
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getPackageName())
            );
            startActivity(intent);
        } catch (Exception error) {
            Toast.makeText(this, "Thiết bị không mở được trang quyền Overlay.", Toast.LENGTH_LONG).show();
        }
    }

    private void startOverlayProbe() {
        if (!Settings.canDrawOverlays(this)) {
            getSharedPreferences(PROBE_PREFS, MODE_PRIVATE).edit()
                .putBoolean("overlay_probe_attempted", true)
                .putBoolean("overlay_probe_success", false)
                .putString("overlay_probe_error", "OVERLAY_PERMISSION_NOT_GRANTED")
                .apply();
            Toast.makeText(this, "Cần cấp quyền hiển thị trên ứng dụng khác trước.", Toast.LENGTH_LONG).show();
            openOverlaySettings();
            return;
        }

        getSharedPreferences(PROBE_PREFS, MODE_PRIVATE).edit()
            .putBoolean("overlay_probe_attempted", true)
            .putBoolean("overlay_probe_success", false)
            .putString("overlay_probe_error", "STARTING")
            .apply();

        try {
            Intent probe = new Intent(this, OverlayProbeService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(probe);
            else startService(probe);

            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    Intent home = new Intent(Intent.ACTION_MAIN);
                    home.addCategory(Intent.CATEGORY_HOME);
                    home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(home);
                } catch (Exception ignored) {
                }
            }, 350L);
        } catch (Exception error) {
            getSharedPreferences(PROBE_PREFS, MODE_PRIVATE).edit()
                .putBoolean("overlay_probe_success", false)
                .putString("overlay_probe_error", error.getClass().getSimpleName() + ":" + String.valueOf(error.getMessage()))
                .apply();
            Toast.makeText(this, "Không khởi động được Overlay probe.", Toast.LENGTH_LONG).show();
            refreshSnapshot();
        }
    }

    private String hashDeviceId() {
        try {
            String raw = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
            if (raw == null) raw = "unknown";
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest((raw + "|" + getPackageName()).getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : bytes) out.append(String.format(Locale.US, "%02x", b));
            return out.substring(0, 16);
        } catch (Exception ignored) {
            return "0000000000000000";
        }
    }

    private boolean manifestDeclaresPolicyAccess() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_PERMISSIONS);
            if (info.requestedPermissions == null) return false;
            for (String permission : info.requestedPermissions) {
                if (Manifest.permission.ACCESS_NOTIFICATION_POLICY.equals(permission)) return true;
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private JSONObject captureSnapshot() {
        JSONObject root = new JSONObject();
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            UserManager um = getSystemService(UserManager.class);
            DevicePolicyManager dpm = getSystemService(DevicePolicyManager.class);

            boolean policyAccess = nm != null && nm.isNotificationPolicyAccessGranted();
            NotificationChannel before = nm == null ? null : nm.getNotificationChannel(CHANNEL_ID);

            boolean createAttempted = false;
            String createError = "";
            if (nm != null && policyAccess) {
                try {
                    createAttempted = true;
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "SUPRA DND Diagnostic",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Kênh chẩn đoán khả năng bypass Không làm phiền");
                    channel.enableVibration(true);
                    channel.setBypassDnd(true);
                    nm.createNotificationChannel(channel);
                } catch (Exception error) {
                    createError = error.getClass().getSimpleName() + ":" + String.valueOf(error.getMessage());
                }
            }

            NotificationChannel after = nm == null ? null : nm.getNotificationChannel(CHANNEL_ID);
            String securePolicyPackages = safeSecure("enabled_notification_policy_access_packages");
            String enabledConditionProviders = safeSecure("enabled_condition_providers");

            PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);

            JSONObject build = new JSONObject()
                .put("manufacturer", Build.MANUFACTURER)
                .put("brand", Build.BRAND)
                .put("model", Build.MODEL)
                .put("device", Build.DEVICE)
                .put("product", Build.PRODUCT)
                .put("board", Build.BOARD)
                .put("hardware", Build.HARDWARE)
                .put("bootloader", Build.BOOTLOADER)
                .put("id", Build.ID)
                .put("display", Build.DISPLAY)
                .put("fingerprint", Build.FINGERPRINT)
                .put("sdk_int", Build.VERSION.SDK_INT)
                .put("release", Build.VERSION.RELEASE)
                .put("incremental", Build.VERSION.INCREMENTAL)
                .put("security_patch", Build.VERSION.SECURITY_PATCH);

            JSONObject identity = new JSONObject()
                .put("device_id_hash", hashDeviceId())
                .put("package", getPackageName())
                .put("uid", Process.myUid())
                .put("derived_user_id", Process.myUid() / 100000)
                .put("first_install_time", packageInfo.firstInstallTime)
                .put("last_update_time", packageInfo.lastUpdateTime);

            JSONObject profile = new JSONObject()
                .put("managed_profile", um != null && um.isManagedProfile())
                .put("restriction_adjust_volume", um != null && um.getUserRestrictions().getBoolean(UserManager.DISALLOW_ADJUST_VOLUME, false))
                .put("restriction_config_sound", um != null && um.getUserRestrictions().getBoolean("no_config_sound", false))
                .put("restriction_config_settings", um != null && um.getUserRestrictions().getBoolean("no_config_settings", false))
                .put("this_app_device_owner", dpm != null && dpm.isDeviceOwnerApp(getPackageName()))
                .put("this_app_profile_owner", dpm != null && dpm.isProfileOwnerApp(getPackageName()));

            JSONObject dnd = new JSONObject()
                .put("manifest_declares_access_notification_policy", manifestDeclaresPolicyAccess())
                .put("manifest_permission_check", checkSelfPermission(Manifest.permission.ACCESS_NOTIFICATION_POLICY))
                .put("is_notification_policy_access_granted", policyAccess)
                .put("notifications_enabled", nm != null && nm.areNotificationsEnabled())
                .put("current_interruption_filter", nm == null ? -1 : nm.getCurrentInterruptionFilter())
                .put("secure_policy_list_readable", securePolicyPackages != null)
                .put("secure_policy_list_contains_self", containsPackage(securePolicyPackages, getPackageName()))
                .put("secure_policy_list_count", packageCount(securePolicyPackages))
                .put("condition_provider_list_readable", enabledConditionProviders != null)
                .put("condition_provider_list_contains_self", containsPackage(enabledConditionProviders, getPackageName()))
                .put("condition_provider_list_count", packageCount(enabledConditionProviders))
                .put("channel_before_exists", before != null)
                .put("channel_before_importance", before == null ? -1 : before.getImportance())
                .put("channel_before_can_bypass_dnd", before != null && before.canBypassDnd())
                .put("channel_create_attempted", createAttempted)
                .put("channel_create_error", createError)
                .put("channel_after_exists", after != null)
                .put("channel_after_importance", after == null ? -1 : after.getImportance())
                .put("channel_after_can_bypass_dnd", after != null && after.canBypassDnd());

            int zenMode = -999;
            try {
                zenMode = Settings.Global.getInt(getContentResolver(), "zen_mode", -1);
            } catch (Exception ignored) {
            }
            dnd.put("global_zen_mode", zenMode)
                .put("detail_settings_resolvable", new Intent(
                    ACTION_DND_DETAIL,
                    Uri.parse("package:" + getPackageName())
                ).resolveActivity(getPackageManager()) != null)
                .put("last_dnd_settings_route", getSharedPreferences(PROBE_PREFS, MODE_PRIVATE)
                    .getString("last_dnd_settings_route", "NONE"))
                .put("last_dnd_settings_error", getSharedPreferences(PROBE_PREFS, MODE_PRIVATE)
                    .getString("last_dnd_settings_error", ""))
                .put("overlay_permission_granted", Settings.canDrawOverlays(this))
                .put("overlay_probe_attempted", getSharedPreferences(PROBE_PREFS, MODE_PRIVATE)
                    .getBoolean("overlay_probe_attempted", false))
                .put("overlay_probe_success", getSharedPreferences(PROBE_PREFS, MODE_PRIVATE)
                    .getBoolean("overlay_probe_success", false))
                .put("overlay_probe_error", getSharedPreferences(PROBE_PREFS, MODE_PRIVATE)
                    .getString("overlay_probe_error", ""));

            root.put("schema", "dnd-diagnostic-v1")
                .put("generated_at", Instant.now().toString())
                .put("build", build)
                .put("identity", identity)
                .put("profile", profile)
                .put("dnd", dnd);
        } catch (Exception error) {
            try {
                root.put("capture_error", error.getClass().getSimpleName() + ":" + String.valueOf(error.getMessage()));
            } catch (Exception ignored) {
            }
        }
        return root;
    }

    private String safeSecure(String key) {
        try {
            return Settings.Secure.getString(getContentResolver(), key);
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean containsPackage(String list, String packageName) {
        if (list == null || list.isEmpty()) return false;
        for (String item : list.split("[:\\n]")) {
            if (packageName.equals(item.trim())) return true;
        }
        return false;
    }

    private int packageCount(String list) {
        if (list == null || list.trim().isEmpty()) return 0;
        int count = 0;
        for (String item : list.split("[:\\n]")) {
            if (!item.trim().isEmpty()) count++;
        }
        return count;
    }

    private void refreshSnapshot() {
        latestSnapshot = captureSnapshot();
        try {
            status.setText(latestSnapshot.toString(2));
        } catch (Exception ignored) {
            status.setText(latestSnapshot.toString());
        }
    }

    private String readStream(InputStream stream) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int read;
        while ((read = stream.read(buffer)) != -1) {
            out.write(buffer, 0, read);
            if (out.size() > 64_000) break;
        }
        return out.toString(StandardCharsets.UTF_8.name());
    }

    private void sendLog() {
        refreshSnapshot();
        sendButton.setEnabled(false);
        sendButton.setText("ĐANG GỬI...");
        final String body = latestSnapshot.toString();

        new Thread(() -> {
            String message;
            boolean success = false;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(30000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("User-Agent", "SUPRA-DND-Diagnostic/1");
                connection.setRequestProperty("X-DND-Diagnostic-Version", "1");
                connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
                int code = connection.getResponseCode();
                java.io.InputStream stream = code >= 200 && code < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();
                String response = stream == null ? "" : readStream(stream);
                if (code >= 200 && code < 300) {
                    JSONObject parsed = response.isEmpty() ? new JSONObject() : new JSONObject(response);
                    String archive = parsed.optString("archive_status", "");
                    success = true;
                    message = "DRIVE_SYNCED".equals(archive)
                        ? "Đã gửi và lưu vào thư mục logs Beta."
                        : "Đã nhận log; Drive đang được hệ thống đồng bộ.";
                } else {
                    message = "Gửi log thất bại · HTTP " + code + " · " + response;
                }
            } catch (Exception error) {
                message = "Gửi log thất bại · " + error.getClass().getSimpleName() + " · " + String.valueOf(error.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
            }

            final boolean ok = success;
            final String result = message;
            runOnUiThread(() -> {
                sendButton.setEnabled(true);
                sendButton.setText("GỬI LOG VỀ BETA");
                Toast.makeText(this, result, Toast.LENGTH_LONG).show();
                if (!ok) {
                    status.append("\n\nSEND_RESULT: " + result);
                }
            });
        }).start();
    }
}
