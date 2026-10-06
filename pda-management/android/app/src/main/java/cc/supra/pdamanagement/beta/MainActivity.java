package cc.supra.pdamanagement.beta;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public final class MainActivity extends Activity {
    private enum UpdateGate { IDLE, CHECKING, CURRENT, AVAILABLE, DEFERRED, FAILED }
    private enum UpdateResource { MANIFEST, ASSET }

    private static final long SILENT_CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L;

    private static final class UpdateInfo {
        final int versionCode;
        final String versionName;
        final String tag;
        final String apkUrl;
        final String checksumUrl;

        UpdateInfo(int versionCode, String versionName, String tag, String apkUrl, String checksumUrl) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.tag = tag;
            this.apkUrl = apkUrl;
            this.checksumUrl = checksumUrl;
        }
    }

    private TextView status;
    private TextView version;
    private Button updateButton;
    private Button loginButton;
    private ProgressBar progress;
    private volatile boolean updateCheckRunning = false;
    private volatile UpdateGate updateGate = UpdateGate.IDLE;
    private UpdateInfo pendingUpdateInfo;
    private File pendingInstallFile;

    private String sessionToken = "";
    private String sessionRole = "";
    private String sessionDisplayName = "";
    private JSONArray cachedDevices = new JSONArray();
    private LinearLayout deviceListContainer;
    private EditText deviceSearch;
    private TextView homeStatus;
    private volatile boolean deviceRefreshRunning = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        cleanupUpdateArtifacts();
        renderLogin();
        maybeSilentUpdateCheck();
    }

    @Override
    protected void onResume() {
        super.onResume();
        File pending = pendingInstallFile;
        if (pending != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && getPackageManager().canRequestPackageInstalls()) {
            pendingInstallFile = null;
            launchInstaller(pending);
        }
    }

    private void renderLogin() {
        setContentView(R.layout.activity_login);

        version = findViewById(R.id.tvLoginVersion);
        version.setText("Beta vc" + BuildConfig.VERSION_CODE + " · " + BuildConfig.VERSION_NAME);

        EditText username = findViewById(R.id.etUsername);
        EditText password = findViewById(R.id.etPassword);
        loginButton = findViewById(R.id.btnLogin);
        updateButton = findViewById(R.id.btnLoginUpdate);
        progress = findViewById(R.id.progressLogin);
        status = findViewById(R.id.tvLoginStatus);

        status.setVisibility(View.GONE);
        progress.setVisibility(View.GONE);

        updateButton.setOnClickListener(v -> {
            if (pendingUpdateInfo != null && updateGate == UpdateGate.AVAILABLE) {
                showUpdateAvailable(pendingUpdateInfo);
            } else {
                checkForUpdate(false);
            }
        });

        loginButton.setOnClickListener(v -> {
            String user = username.getText().toString().trim().toLowerCase();
            String pass = password.getText().toString();
            if (!user.matches("[a-z0-9._-]{1,64}") || pass.length() < 8) {
                setStatus("Tên đăng nhập hoặc mật khẩu không hợp lệ.", true);
                return;
            }
            performLogin(user, pass, password);
        });
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private String deviceId() {
        String androidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId != null && !androidId.trim().isEmpty()) return androidId.trim();
        android.content.SharedPreferences prefs = getSharedPreferences("pda_mgmt_device", MODE_PRIVATE);
        String current = prefs.getString("device_id", "");
        if (current != null && !current.isEmpty()) return current;
        String next = UUID.randomUUID().toString();
        prefs.edit().putString("device_id", next).apply();
        return next;
    }

    private JSONObject apiRequest(String method, String path, JSONObject body, boolean authenticated) throws Exception {
        URL url = new URL(BuildConfig.API_BASE_URL.replaceAll("/+$", "") + path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(30_000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "SUPRA-PDA-Management-Beta/" + BuildConfig.VERSION_NAME);
        connection.setRequestProperty("X-Supra-Device-Id", deviceId());
        if (authenticated) {
            if (sessionToken.isEmpty()) throw new IllegalStateException("Phiên đăng nhập không còn hiệu lực.");
            connection.setRequestProperty("Authorization", "Bearer " + sessionToken);
        }
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            byte[] payload = body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            connection.getOutputStream().write(payload);
        }

        int code = connection.getResponseCode();
        java.io.InputStream stream = code >= 200 && code <= 299 ? connection.getInputStream() : connection.getErrorStream();
        String text = "";
        if (stream != null) {
            try (java.io.InputStream input = stream;
                 java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream()) {
                byte[] chunk = new byte[8192];
                int read;
                while ((read = input.read(chunk)) > 0) buffer.write(chunk, 0, read);
                text = buffer.toString("UTF-8");
            }
        }
        JSONObject result = text.trim().isEmpty() ? new JSONObject() : new JSONObject(text);
        if (code < 200 || code > 299) {
            String message = result.optString("message", result.optString("error", "HTTP " + code));
            throw new IllegalStateException(message);
        }
        return result;
    }

    private void performLogin(String username, String password, EditText passwordField) {
        loginButton.setEnabled(false);
        progress.setVisibility(View.VISIBLE);
        setStatus("Đang đăng nhập...", false);

        new Thread(() -> {
            try {
                JSONObject result = apiRequest("POST", "/api/auth/login",
                    new JSONObject().put("username", username).put("password", password), false);
                String token = result.optString("token", "");
                JSONObject user = result.optJSONObject("user");
                if (token.isEmpty() || user == null) throw new IllegalStateException("Phản hồi đăng nhập không hợp lệ.");

                sessionToken = token;
                sessionRole = user.optString("role", "");
                sessionDisplayName = user.optString("display_name", username);
                runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    loginButton.setEnabled(true);
                    passwordField.setText("");
                    renderHome(user);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    loginButton.setEnabled(true);
                    setStatus(error.getMessage() == null ? "Không thể đăng nhập." : error.getMessage(), true);
                });
            }
        }, "pda-mgmt-login").start();
    }

    private void renderHome(JSONObject user) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(getColor(R.color.surface));
        root.setPadding(dp(16), dp(18), dp(16), dp(14));

        TextView title = new TextView(this);
        title.setText("QUẢN LÝ PDA");
        title.setTextColor(getColor(R.color.navy_900));
        title.setTextSize(24);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        root.addView(title);

        TextView identity = new TextView(this);
        identity.setText(sessionDisplayName + " · " + ("ROOT".equals(sessionRole) ? "Root" : "Điều phối"));
        identity.setTextColor(getColor(R.color.text_secondary));
        identity.setTextSize(13);
        identity.setPadding(0, dp(3), 0, dp(12));
        root.addView(identity);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER_VERTICAL);

        Button refresh = new Button(this);
        refresh.setText("Làm mới");
        refresh.setOnClickListener(v -> loadDevices(true));
        actions.addView(refresh, new LinearLayout.LayoutParams(0, dp(46), 1f));

        if ("ROOT".equals(sessionRole)) {
            Button users = new Button(this);
            users.setText("Thêm Điều phối");
            users.setOnClickListener(v -> showCreateCoordinator());
            LinearLayout.LayoutParams up = new LinearLayout.LayoutParams(0, dp(46), 1f);
            up.setMarginStart(dp(8));
            actions.addView(users, up);
        }

        Button logout = new Button(this);
        logout.setText("Đăng xuất");
        logout.setOnClickListener(v -> performLogout());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(46), 1f);
        lp.setMarginStart(dp(8));
        actions.addView(logout, lp);
        root.addView(actions);

        homeStatus = new TextView(this);
        homeStatus.setText("Đang tải danh sách PDA...");
        homeStatus.setTextColor(getColor(R.color.text_secondary));
        homeStatus.setTextSize(12);
        homeStatus.setPadding(0, dp(10), 0, dp(8));
        root.addView(homeStatus);

        deviceSearch = new EditText(this);
        deviceSearch.setHint("Tìm Serial / Model / Trạng thái");
        deviceSearch.setSingleLine(true);
        root.addView(deviceSearch, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(50)));

        TextView section = new TextView(this);
        section.setText("DANH SÁCH PDA");
        section.setTextColor(getColor(R.color.navy_900));
        section.setTextSize(13);
        section.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        section.setPadding(0, dp(14), 0, dp(8));
        root.addView(section);

        ScrollView scroll = new ScrollView(this);
        deviceListContainer = new LinearLayout(this);
        deviceListContainer.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(deviceListContainer);
        root.addView(scroll, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        TextView footer = new TextView(this);
        footer.setText("Beta vc" + BuildConfig.VERSION_CODE + " · " + BuildConfig.VERSION_NAME);
        footer.setTextColor(getColor(R.color.text_secondary));
        footer.setTextSize(9);
        footer.setGravity(Gravity.CENTER);
        footer.setPadding(0, dp(8), 0, 0);
        root.addView(footer);

        deviceSearch.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                renderDeviceRows(s == null ? "" : s.toString());
            }
            @Override public void afterTextChanged(Editable s) {}
        });

        setContentView(root);
        loadDevices(false);
    }

    private void setHomeStatus(String message, boolean error) {
        if (homeStatus == null) return;
        homeStatus.setText(message);
        homeStatus.setTextColor(getColor(error ? R.color.red_600 : R.color.text_secondary));
    }

    private void loadDevicesLocal() {
        loadDevicesPath("/api/devices?local=1", false);
    }

    private void loadDevices(boolean force) {
        loadDevicesPath("/api/devices" + (force ? "?refresh=1" : ""), force);
    }

    private void loadDevicesPath(String path, boolean force) {
        if (deviceRefreshRunning || sessionToken.isEmpty()) return;
        deviceRefreshRunning = true;
        setHomeStatus(force ? "Đang đồng bộ Registry..." : "Đang tải danh sách PDA...", false);

        new Thread(() -> {
            try {
                JSONObject result = apiRequest("GET", path, null, true);
                JSONArray devices = result.optJSONArray("devices");
                if (devices == null) devices = new JSONArray();
                final JSONArray finalDevices = devices;
                long syncMs = result.optLong("registry_last_sync_ms", 0L);
                String syncError = result.optString("registry_sync_error", "");
                runOnUiThread(() -> {
                    deviceRefreshRunning = false;
                    cachedDevices = finalDevices;
                    String query = deviceSearch == null ? "" : deviceSearch.getText().toString();
                    renderDeviceRows(query);
                    String suffix = syncMs > 0 ? " · Registry đã đồng bộ" : "";
                    setHomeStatus(finalDevices.length() + " PDA" + suffix +
                        (syncError.isEmpty() ? "" : " · Đồng bộ Registry tạm lỗi"), !syncError.isEmpty());
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    deviceRefreshRunning = false;
                    String message = error.getMessage() == null ? "Không tải được danh sách PDA." : error.getMessage();
                    setHomeStatus(message, true);
                    if (message.toLowerCase().contains("phiên") || message.toLowerCase().contains("unauthorized")) {
                        sessionToken = "";
                        renderLogin();
                    }
                });
            }
        }, "pda-mgmt-device-list").start();
    }

    private void renderDeviceRows(String rawQuery) {
        if (deviceListContainer == null) return;
        deviceListContainer.removeAllViews();
        String query = rawQuery == null ? "" : rawQuery.trim().toLowerCase();
        int visible = 0;

        for (int index = 0; index < cachedDevices.length(); index++) {
            JSONObject device = cachedDevices.optJSONObject(index);
            if (device == null) continue;
            String serial = device.optString("serial", "");
            String model = device.optString("model", "");
            String manufacturer = device.optString("manufacturer", "");
            String usage = device.optString("usage_status", "AVAILABLE");
            String condition = device.optString("physical_condition", "UNKNOWN");
            String haystack = (serial + " " + model + " " + manufacturer + " " + usage + " " + condition).toLowerCase();
            if (!query.isEmpty() && !haystack.contains(query)) continue;
            visible++;

            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setBackgroundResource(R.drawable.bg_card);
            card.setPadding(dp(14), dp(12), dp(14), dp(12));

            TextView serialView = new TextView(this);
            serialView.setText(serial);
            serialView.setTextColor(getColor(R.color.navy_900));
            serialView.setTextSize(16);
            serialView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            card.addView(serialView);

            TextView detail = new TextView(this);
            String modelText = (manufacturer + " " + model).trim();
            detail.setText((modelText.isEmpty() ? "Chưa có Model" : modelText) +
                "\nTrạng thái: " + usageLabel(usage) + " · Tình trạng: " + conditionLabel(condition));
            detail.setTextColor(getColor(R.color.text_secondary));
            detail.setTextSize(12);
            detail.setPadding(0, dp(4), 0, 0);
            card.addView(detail);

            LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            cp.bottomMargin = dp(8);
            card.setOnClickListener(v -> showDeviceDialog(device));
            deviceListContainer.addView(card, cp);
        }

        if (visible == 0) {
            TextView empty = new TextView(this);
            empty.setText(query.isEmpty() ? "Chưa có PDA trong danh sách." : "Không tìm thấy PDA phù hợp.");
            empty.setTextColor(getColor(R.color.text_secondary));
            empty.setTextSize(13);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(dp(12), dp(30), dp(12), dp(30));
            deviceListContainer.addView(empty);
        }
    }

    private void showDeviceDialog(JSONObject device) {
        String serial = device.optString("serial", "");
        String usage = device.optString("usage_status", "AVAILABLE");
        String condition = device.optString("physical_condition", "UNKNOWN");
        String borrower = device.optString("borrower_name", "");
        String employeeCode = device.optString("borrower_employee_code", "");
        String contractor = device.optString("borrower_contractor", "");

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(8), dp(20), dp(4));

        TextView info = new TextView(this);
        StringBuilder text = new StringBuilder();
        text.append("Serial: ").append(serial)
            .append("\nTrạng thái: ").append(usageLabel(usage))
            .append("\nTình trạng: ").append(conditionLabel(condition));
        if ("BORROWED".equals(usage)) {
            text.append("\n\nĐang mượn: ").append(employeeCode).append(" · ").append(borrower);
            if (!contractor.isEmpty()) text.append(" · ").append(contractor);
        }
        info.setText(text.toString());
        info.setTextColor(getColor(R.color.text_primary));
        info.setTextSize(13);
        box.addView(info);

        Button primary = new Button(this);
        if ("AVAILABLE".equals(usage)) {
            primary.setText("Ghi nhận mượn");
            primary.setOnClickListener(v -> showBorrowDialog(device));
        } else if ("BORROWED".equals(usage)) {
            primary.setText("Trả PDA");
            primary.setOnClickListener(v -> showReturnDialog(device));
        } else {
            primary.setText("Cập nhật trạng thái");
            primary.setOnClickListener(v -> showStatusDialog(device));
        }
        LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        pp.topMargin = dp(14);
        box.addView(primary, pp);

        if (!"BORROWED".equals(usage)) {
            Button statusButton = new Button(this);
            statusButton.setText("Cập nhật trạng thái / tình trạng");
            statusButton.setOnClickListener(v -> showStatusDialog(device));
            LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(46));
            sp.topMargin = dp(6);
            box.addView(statusButton, sp);
        }

        Button history = new Button(this);
        history.setText("Xem lịch sử");
        history.setOnClickListener(v -> showDeviceHistory(serial));
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(46));
        hp.topMargin = dp(6);
        box.addView(history, hp);

        new AlertDialog.Builder(this)
            .setTitle("Chi tiết PDA")
            .setView(box)
            .setNegativeButton("Đóng", null)
            .show();
    }

    private void showBorrowDialog(JSONObject device) {
        String serial = device.optString("serial", "");
        EditText employeeCode = new EditText(this);
        employeeCode.setHint("Bắn / nhập Mã nhân viên");
        employeeCode.setSingleLine(true);
        employeeCode.setInputType(android.text.InputType.TYPE_CLASS_TEXT);

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(4), dp(20), 0);

        TextView hint = new TextView(this);
        hint.setText("PDA " + serial + "\nQuét thẻ nhân sự hoặc nhập Mã nhân viên.");
        hint.setTextColor(getColor(R.color.text_secondary));
        hint.setTextSize(12);
        box.addView(hint);
        box.addView(employeeCode, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Ghi nhận mượn PDA")
            .setView(box)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Kiểm tra", null)
            .create();

        dialog.setOnShowListener(ignored -> {
            employeeCode.requestFocus();
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String code = employeeCode.getText().toString().trim();
                if (code.isEmpty()) {
                    Toast.makeText(this, "Nhập Mã nhân viên.", Toast.LENGTH_SHORT).show();
                    return;
                }
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
                new Thread(() -> {
                    try {
                        JSONObject result = apiRequest("GET", "/api/employees/" +
                            java.net.URLEncoder.encode(code, "UTF-8"), null, true);
                        JSONObject employee = result.optJSONObject("employee");
                        if (employee == null) throw new IllegalStateException("Không tìm thấy nhân sự.");
                        runOnUiThread(() -> {
                            dialog.dismiss();
                            confirmBorrow(device, employee);
                        });
                    } catch (Exception error) {
                        runOnUiThread(() -> {
                            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                            Toast.makeText(this,
                                error.getMessage() == null ? "Không kiểm tra được nhân sự." : error.getMessage(),
                                Toast.LENGTH_LONG).show();
                        });
                    }
                }, "pda-mgmt-employee-lookup").start();
            });
        });
        dialog.show();
    }

    private void confirmBorrow(JSONObject device, JSONObject employee) {
        String serial = device.optString("serial", "");
        String code = employee.optString("employee_code", "");
        String name = employee.optString("full_name", "");
        String contractor = employee.optString("contractor", "");

        new AlertDialog.Builder(this)
            .setTitle("Xác nhận cho mượn")
            .setMessage("PDA: " + serial +
                "\nNgười mượn: " + code + " · " + name +
                (contractor.isEmpty() ? "" : "\nNhà thầu: " + contractor))
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận", (d, w) -> mutateDevice(
                serial,
                "borrow",
                new JSONObject()
                    .put("employee_code", code)
                    .put("idempotency_key", UUID.randomUUID().toString()),
                "Đã ghi nhận mượn PDA."
            ))
            .show();
    }

    private void showReturnDialog(JSONObject device) {
        String serial = device.optString("serial", "");
        String borrower = device.optString("borrower_name", "");
        String employeeCode = device.optString("borrower_employee_code", "");
        String[] labels = {"Tốt", "Lỗi nhẹ", "Hỏng / cần sửa"};
        String[] values = {"GOOD", "MINOR_DAMAGE", "DAMAGED"};
        final int[] selected = {0};

        new AlertDialog.Builder(this)
            .setTitle("Trả PDA " + serial)
            .setMessage("Người đang mượn: " + employeeCode + " · " + borrower +
                "\n\nChọn tình trạng máy khi nhận lại:")
            .setSingleChoiceItems(labels, 0, (dialog, which) -> selected[0] = which)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận trả", (dialog, which) -> mutateDevice(
                serial,
                "return",
                new JSONObject()
                    .put("physical_condition", values[selected[0]])
                    .put("idempotency_key", UUID.randomUUID().toString()),
                values[selected[0]].equals("DAMAGED")
                    ? "Đã trả PDA và chuyển sang trạng thái Đang sửa."
                    : "Đã ghi nhận trả PDA."
            ))
            .show();
    }

    private void showStatusDialog(JSONObject device) {
        String serial = device.optString("serial", "");
        String[] labels = {"Sẵn sàng", "Đang sửa", "Ngừng dùng", "Thất lạc"};
        String[] statuses = {"AVAILABLE", "REPAIR", "DISABLED", "LOST"};
        String[] conditions = {"GOOD", "DAMAGED", "UNKNOWN", "UNKNOWN"};
        final int[] selected = {0};

        new AlertDialog.Builder(this)
            .setTitle("Cập nhật trạng thái " + serial)
            .setSingleChoiceItems(labels, 0, (dialog, which) -> selected[0] = which)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Cập nhật", (dialog, which) -> mutateDevice(
                serial,
                "status",
                new JSONObject()
                    .put("usage_status", statuses[selected[0]])
                    .put("physical_condition", conditions[selected[0]])
                    .put("idempotency_key", UUID.randomUUID().toString()),
                "Đã cập nhật trạng thái PDA."
            ))
            .show();
    }

    private void mutateDevice(String serial, String action, JSONObject payload, String successMessage) {
        setHomeStatus("Đang xử lý " + serial + "...", false);
        new Thread(() -> {
            try {
                apiRequest("POST", "/api/devices/" + java.net.URLEncoder.encode(serial, "UTF-8") + "/" + action,
                    payload, true);
                runOnUiThread(() -> {
                    Toast.makeText(this, successMessage, Toast.LENGTH_SHORT).show();
                    setHomeStatus(successMessage, false);
                    loadDevicesLocal();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    String message = error.getMessage() == null ? "Không thể xử lý PDA." : error.getMessage();
                    setHomeStatus(message, true);
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show();
                    loadDevicesLocal();
                });
            }
        }, "pda-mgmt-device-mutation").start();
    }

    private void showDeviceHistory(String serial) {
        new Thread(() -> {
            try {
                JSONObject result = apiRequest("GET",
                    "/api/devices/" + java.net.URLEncoder.encode(serial, "UTF-8") + "/history",
                    null, true);
                JSONArray items = result.optJSONArray("transactions");
                StringBuilder lines = new StringBuilder();
                if (items == null || items.length() == 0) {
                    lines.append("Chưa có lịch sử giao dịch.");
                } else {
                    int limit = Math.min(items.length(), 30);
                    for (int index = 0; index < limit; index++) {
                        JSONObject item = items.optJSONObject(index);
                        if (item == null) continue;
                        String action = item.optString("action", "");
                        String at = item.optString("occurred_at", "").replace("T", " ");
                        if (at.length() > 16) at = at.substring(0, 16);
                        lines.append(historyActionLabel(action))
                            .append(" · ").append(at);
                        String employee = item.optString("employee_name", "");
                        String code = item.optString("employee_code", "");
                        if (!employee.isEmpty() || !code.isEmpty()) {
                            lines.append("\n").append(code).append(" · ").append(employee);
                        }
                        lines.append("\nThực hiện: ").append(item.optString("operator_name", ""))
                            .append("\n\n");
                    }
                }
                String message = lines.toString().trim();
                runOnUiThread(() -> new AlertDialog.Builder(this)
                    .setTitle("Lịch sử " + serial)
                    .setMessage(message)
                    .setPositiveButton("Đóng", null)
                    .show());
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(this,
                    error.getMessage() == null ? "Không đọc được lịch sử." : error.getMessage(),
                    Toast.LENGTH_LONG).show());
            }
        }, "pda-mgmt-history").start();
    }

    private String historyActionLabel(String action) {
        switch (action) {
            case "BORROW": return "Mượn";
            case "RETURN": return "Trả";
            case "STATUS_UPDATE": return "Cập nhật trạng thái";
            default: return action;
        }
    }

    private String usageLabel(String value) {
        switch (value) {
            case "BORROWED": return "Đang mượn";
            case "REPAIR": return "Đang sửa";
            case "DISABLED": return "Ngừng dùng";
            case "LOST": return "Thất lạc";
            default: return "Sẵn sàng";
        }
    }

    private String conditionLabel(String value) {
        switch (value) {
            case "GOOD": return "Tốt";
            case "MINOR_DAMAGE": return "Lỗi nhẹ";
            case "DAMAGED": return "Hỏng";
            default: return "Chưa đánh giá";
        }
    }

    private void showCreateCoordinator() {
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(20), dp(6), dp(20), 0);

        EditText username = new EditText(this);
        username.setHint("Tài khoản Điều phối");
        username.setSingleLine(true);
        form.addView(username);

        EditText name = new EditText(this);
        name.setHint("Họ tên / Tên hiển thị");
        name.setSingleLine(true);
        form.addView(name);

        EditText password = new EditText(this);
        password.setHint("Mật khẩu tối thiểu 8 ký tự");
        password.setSingleLine(true);
        password.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        form.addView(password);

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Tạo tài khoản Điều phối")
            .setView(form)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Tạo", null)
            .create();

        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String user = username.getText().toString().trim().toLowerCase();
            String display = name.getText().toString().trim();
            String pass = password.getText().toString();
            if (!user.matches("[a-z0-9._-]{1,64}") || display.isEmpty() || pass.length() < 8) {
                Toast.makeText(this, "Kiểm tra lại tài khoản, tên và mật khẩu.", Toast.LENGTH_SHORT).show();
                return;
            }
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
            new Thread(() -> {
                try {
                    apiRequest("POST", "/api/users",
                        new JSONObject().put("username", user).put("display_name", display).put("password", pass), true);
                    runOnUiThread(() -> {
                        dialog.dismiss();
                        Toast.makeText(this, "Đã tạo tài khoản Điều phối.", Toast.LENGTH_SHORT).show();
                    });
                } catch (Exception error) {
                    runOnUiThread(() -> {
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                        Toast.makeText(this,
                            error.getMessage() == null ? "Không tạo được tài khoản." : error.getMessage(),
                            Toast.LENGTH_LONG).show();
                    });
                }
            }, "pda-mgmt-create-user").start();
        }));
        dialog.show();
    }

    private void revokeToken(String token) {
        if (token == null || token.isEmpty()) return;
        try {
            URL url = new URL(BuildConfig.API_BASE_URL.replaceAll("/+$", "") + "/api/auth/logout");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(5_000);
            connection.setReadTimeout(10_000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.getOutputStream().write("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            try {
                java.io.InputStream stream = connection.getResponseCode() >= 400
                    ? connection.getErrorStream() : connection.getInputStream();
                if (stream != null) stream.close();
            } catch (Exception ignored) {
            }
        } catch (Exception ignored) {
        }
    }

    private void performLogout() {
        String token = sessionToken;
        sessionToken = "";
        sessionRole = "";
        sessionDisplayName = "";
        cachedDevices = new JSONArray();
        renderLogin();
        if (!token.isEmpty()) {
            new Thread(() -> revokeToken(token), "pda-mgmt-logout").start();
        }
    }

    private void maybeSilentUpdateCheck() {
        long now = System.currentTimeMillis();
        long last = getSharedPreferences("pda_mgmt_update", MODE_PRIVATE).getLong("last_check_ms", 0L);
        if (now - last >= SILENT_CHECK_INTERVAL_MS) checkForUpdate(true);
    }

    private void checkForUpdate(boolean silent) {
        if (updateCheckRunning) return;
        updateCheckRunning = true;
        updateGate = UpdateGate.CHECKING;
        pendingUpdateInfo = null;
        applyUpdateUi(silent ? null : "Đang kiểm tra bản cập nhật Beta...");

        new Thread(() -> {
            try {
                verifyInstalledSignerTrusted();
                UpdateInfo info = fetchLatestUpdate();
                getSharedPreferences("pda_mgmt_update", MODE_PRIVATE)
                    .edit().putLong("last_check_ms", System.currentTimeMillis()).apply();

                if (info.versionCode <= BuildConfig.VERSION_CODE) {
                    updateGate = UpdateGate.CURRENT;
                    runOnUiThread(() -> {
                        updateCheckRunning = false;
                        applyUpdateUi(silent ? null : "Đang dùng bản Quản lý PDA Beta mới nhất.");
                    });
                    return;
                }

                pendingUpdateInfo = info;
                updateGate = UpdateGate.AVAILABLE;
                runOnUiThread(() -> {
                    updateCheckRunning = false;
                    applyUpdateUi("Có bản cập nhật " + info.tag + ".");
                    showUpdateAvailable(info);
                });
            } catch (Exception error) {
                updateGate = UpdateGate.DEFERRED;
                runOnUiThread(() -> {
                    updateCheckRunning = false;
                    applyUpdateUi(silent ? null : "Chưa kiểm tra được cập nhật. Có thể tiếp tục đăng nhập.");
                });
            }
        }, "pda-mgmt-update-check").start();
    }

    private void applyUpdateUi(String message) {
        if (updateButton == null) return;
        updateButton.setEnabled(!updateCheckRunning);
        switch (updateGate) {
            case CHECKING:
                updateButton.setText("Đang kiểm tra…");
                break;
            case AVAILABLE:
                updateButton.setText("Cập nhật");
                break;
            case FAILED:
                updateButton.setText("Kiểm tra an toàn");
                break;
            default:
                updateButton.setText("Kiểm tra cập nhật");
                break;
        }
        if (message != null && !message.trim().isEmpty()) {
            setStatus(message, updateGate == UpdateGate.FAILED);
        } else if (updateGate == UpdateGate.CURRENT || updateGate == UpdateGate.IDLE) {
            status.setVisibility(View.GONE);
        }
    }

    private void showUpdateAvailable(UpdateInfo info) {
        new AlertDialog.Builder(this)
            .setTitle("Có bản cập nhật " + info.tag)
            .setMessage("Có thể cập nhật ngay từ màn hình đăng nhập. Cập nhật không yêu cầu đăng nhập tài khoản.")
            .setNegativeButton("Để sau", null)
            .setPositiveButton("Cập nhật", (dialog, which) -> downloadAndInstallUpdate(info))
            .show();
    }

    private void downloadAndInstallUpdate(UpdateInfo info) {
        if (updateCheckRunning) return;
        updateCheckRunning = true;
        updateGate = UpdateGate.CHECKING;
        applyUpdateUi("Đang tải và xác minh " + info.tag + "...");

        new Thread(() -> {
            try {
                File apk = downloadAndVerify(info);
                runOnUiThread(() -> {
                    updateCheckRunning = false;
                    pendingUpdateInfo = null;
                    updateGate = UpdateGate.CURRENT;
                    applyUpdateUi("Đã xác minh " + info.tag + ". Đang mở trình cài đặt.");
                    requestInstall(apk);
                });
            } catch (Exception error) {
                updateGate = UpdateGate.DEFERRED;
                runOnUiThread(() -> {
                    updateCheckRunning = false;
                    applyUpdateUi("Không thể hoàn tất cập nhật. Có thể tiếp tục dùng bản hiện tại.");
                });
            }
        }, "pda-mgmt-update-download").start();
    }

    private UpdateInfo fetchLatestUpdate() throws Exception {
        HttpURLConnection connection = openTrustedConnection(BuildConfig.UPDATE_RELEASE_API, UpdateResource.MANIFEST);
        int code = connection.getResponseCode();
        String text;
        try (java.io.InputStream stream = code >= 200 && code <= 299 ? connection.getInputStream() : connection.getErrorStream()) {
            if (stream == null) {
                text = "";
            } else {
                java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
                byte[] chunk = new byte[8192];
                int read;
                while ((read = stream.read(chunk)) > 0) buffer.write(chunk, 0, read);
                text = buffer.toString("UTF-8");
            }
        }
        if (code < 200 || code > 299) throw new IllegalStateException("Update manifest HTTP " + code);

        JSONObject manifest = new JSONObject(text);
        int versionCode = manifest.optInt("version_code", -1);
        String tag = manifest.optString("tag", "");
        String versionName = manifest.optString("version_name", "");
        if (versionCode <= 0 || !tag.equals("pda-mgmt-beta-vc" + versionCode) ||
            !versionName.equals("0.1.0-beta." + versionCode)) {
            throw new IllegalStateException("Kênh cập nhật không hợp lệ.");
        }

        String apkPath = manifest.optString("apk_path", "");
        String checksumPath = manifest.optString("checksum_path", "");
        if (!apkPath.startsWith("/") || !checksumPath.startsWith("/")) {
            throw new IllegalStateException("Kênh cập nhật thiếu đường dẫn.");
        }
        String base = BuildConfig.API_BASE_URL.replaceAll("/+$", "");
        return new UpdateInfo(versionCode, versionName, tag, base + apkPath, base + checksumPath);
    }

    private File downloadAndVerify(UpdateInfo info) throws Exception {
        String checksumText = downloadText(info.checksumUrl, info.tag).trim();
        String expected = checksumText.split("\\s+")[0].toLowerCase();
        if (!expected.matches("[0-9a-f]{64}")) throw new IllegalStateException("Checksum không hợp lệ.");

        File dir = new File(getExternalFilesDir(null), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Không tạo được thư mục cập nhật.");
        File temp = new File(dir, "supra-pda-management-beta.apk.download");
        File target = new File(dir, "supra-pda-management-beta.apk");

        downloadFile(info.apkUrl, temp, info.tag);
        if (!sha256(temp).equals(expected)) {
            temp.delete();
            throw new IllegalStateException("SHA-256 APK không khớp.");
        }

        verifyDownloadedApk(temp, info);
        if (target.exists() && !target.delete()) {
            temp.delete();
            throw new IllegalStateException("Không thay được file cập nhật cũ.");
        }
        if (!temp.renameTo(target)) {
            try (java.io.FileInputStream input = new java.io.FileInputStream(temp);
                 java.io.FileOutputStream output = new java.io.FileOutputStream(target)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = input.read(buffer)) > 0) output.write(buffer, 0, read);
            }
            temp.delete();
        }
        return target;
    }

    private void requestInstall(File apk) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
            pendingInstallFile = apk;
            setStatus("Cần cấp quyền cài ứng dụng không rõ nguồn gốc một lần cho Quản lý PDA Beta.", false);
            startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            return;
        }
        launchInstaller(apk);
    }

    private void launchInstaller(File apk) {
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        setStatus("Đã tải xong. Đang mở trình cài bản cập nhật...", false);
        startActivity(intent);
    }

    private HttpURLConnection openTrustedConnection(String rawUrl, UpdateResource resource) throws Exception {
        URL current = new URL(rawUrl);
        for (int redirectIndex = 0; redirectIndex < 6; redirectIndex++) {
            validateUpdateUrl(current, resource, redirectIndex > 0);
            HttpURLConnection connection = (HttpURLConnection) current.openConnection();
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(60_000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", "SUPRA-PDA-Management-Beta/" + BuildConfig.VERSION_NAME);
            connection.setRequestProperty("Accept", resource == UpdateResource.MANIFEST ? "application/json" : "*/*");

            int code = connection.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.trim().isEmpty()) throw new IllegalStateException("Redirect thiếu Location.");
                current = new URL(current, location);
                continue;
            }
            return connection;
        }
        throw new IllegalStateException("Update redirect vượt giới hạn.");
    }

    private void validateUpdateUrl(URL url, UpdateResource resource, boolean redirected) throws Exception {
        if (!"https".equals(url.getProtocol())) throw new IllegalStateException("Update chỉ cho phép HTTPS.");
        String serviceHost = new URL(BuildConfig.API_BASE_URL).getHost();

        if (resource == UpdateResource.MANIFEST) {
            if (redirected || !url.getHost().equals(serviceHost) || !url.getPath().equals("/downloads/app/manifest")) {
                throw new IllegalStateException("Manifest không thuộc dịch vụ tin cậy.");
            }
            return;
        }

        if (!redirected) {
            boolean trustedPath = url.getPath().equals("/downloads/app/latest") ||
                url.getPath().equals("/downloads/app/latest.sha256");
            if (!url.getHost().equals(serviceHost) || !trustedPath) {
                throw new IllegalStateException("Tệp cập nhật không thuộc dịch vụ tin cậy.");
            }
            return;
        }

        if (url.getHost().equals("github.com")) {
            String prefix = "/tamnv2/supra-inventory/releases/download/pda-mgmt-channel/";
            if (!url.getPath().startsWith(prefix)) {
                throw new IllegalStateException("Release asset sai kênh.");
            }
            return;
        }

        boolean trustedCdn = url.getHost().equals("release-assets.githubusercontent.com") ||
            url.getHost().equals("objects.githubusercontent.com") ||
            url.getHost().endsWith(".githubusercontent.com");
        if (!trustedCdn) throw new IllegalStateException("Redirect cập nhật không thuộc CDN tin cậy.");
    }

    private String downloadText(String url, String tag) throws Exception {
        validateTag(tag);
        HttpURLConnection connection = openTrustedConnection(url, UpdateResource.ASSET);
        int code = connection.getResponseCode();
        if (code < 200 || code > 299) throw new IllegalStateException("Checksum HTTP " + code);
        try (java.io.InputStream stream = connection.getInputStream();
             java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int read;
            while ((read = stream.read(chunk)) > 0) buffer.write(chunk, 0, read);
            return buffer.toString("UTF-8");
        }
    }

    private void downloadFile(String url, File file, String tag) throws Exception {
        validateTag(tag);
        HttpURLConnection connection = openTrustedConnection(url, UpdateResource.ASSET);
        int code = connection.getResponseCode();
        if (code < 200 || code > 299) throw new IllegalStateException("APK HTTP " + code);
        try (java.io.InputStream input = connection.getInputStream();
             java.io.FileOutputStream output = new java.io.FileOutputStream(file)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) > 0) output.write(buffer, 0, read);
        }
    }

    private void validateTag(String tag) {
        if (tag == null || !tag.matches("^pda-mgmt-beta-vc\\d+$")) {
            throw new IllegalStateException("Beta tag không hợp lệ.");
        }
    }

    private void verifyInstalledSignerTrusted() throws Exception {
        String expected = BuildConfig.TRUSTED_SIGNER_SHA256.trim().toLowerCase();
        if (expected.trim().isEmpty()) {
            if (BuildConfig.DEBUG) return;
            throw new IllegalStateException("Release thiếu trusted signer.");
        }
        PackageInfo installed = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
        if (!signerDigests(installed).contains(expected)) {
            updateGate = UpdateGate.FAILED;
            throw new IllegalStateException("Chữ ký ứng dụng hiện tại không hợp lệ.");
        }
    }

    private void verifyDownloadedApk(File file, UpdateInfo info) throws Exception {
        PackageInfo archive = getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
        if (archive == null) throw new IllegalStateException("Không đọc được APK cập nhật.");
        if (!BuildConfig.APPLICATION_ID.equals(archive.packageName)) throw new IllegalStateException("APK cập nhật sai package.");
        if (archive.getLongVersionCode() != info.versionCode) throw new IllegalStateException("APK cập nhật sai versionCode.");
        if (!info.versionName.equals(archive.versionName)) throw new IllegalStateException("APK cập nhật sai versionName.");

        String expectedSigner = BuildConfig.TRUSTED_SIGNER_SHA256.trim().toLowerCase();
        if (expectedSigner.trim().isEmpty() || !signerDigests(archive).contains(expectedSigner)) {
            throw new IllegalStateException("APK cập nhật sai chữ ký.");
        }
    }

    private Set<String> signerDigests(PackageInfo info) throws Exception {
        Set<String> result = new HashSet<>();
        if (info.signingInfo == null) return result;
        android.content.pm.Signature[] certificates = info.signingInfo.hasMultipleSigners()
            ? info.signingInfo.getApkContentsSigners()
            : info.signingInfo.getSigningCertificateHistory();

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (android.content.pm.Signature certificate : certificates) {
            byte[] hashed = digest.digest(certificate.toByteArray());
            StringBuilder hex = new StringBuilder();
            for (byte b : hashed) hex.append(String.format("%02x", b & 0xff));
            result.add(hex.toString());
        }
        return result;
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (java.io.FileInputStream input = new java.io.FileInputStream(file)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) > 0) digest.update(buffer, 0, read);
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : digest.digest()) hex.append(String.format("%02x", b & 0xff));
        return hex.toString();
    }

    private void cleanupUpdateArtifacts() {
        try {
            File dir = new File(getExternalFilesDir(null), "updates");
            if (!dir.exists()) return;
            File[] files = dir.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.isFile() && (file.getName().endsWith(".apk") || file.getName().endsWith(".download"))) {
                        file.delete();
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void setStatus(String message, boolean error) {
        status.setText(message);
        status.setTextColor(getColor(error ? R.color.red_600 : R.color.text_secondary));
        status.setVisibility(View.VISIBLE);
    }
}
