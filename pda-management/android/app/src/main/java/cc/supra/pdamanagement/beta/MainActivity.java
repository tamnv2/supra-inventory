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
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public final class MainActivity extends Activity {
    private enum UpdateGate { IDLE, CHECKING, CURRENT, AVAILABLE, DEFERRED, FAILED }
    private enum UpdateResource { MANIFEST, ASSET }

    private static final long SILENT_CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L;

    private static final class ApiException extends Exception {
        final int statusCode;
        final String errorId;
        final String errorCode;

        ApiException(int statusCode, String message, String errorId, String errorCode) {
            super(message);
            this.statusCode = statusCode;
            this.errorId = errorId == null ? "" : errorId;
            this.errorCode = errorCode == null ? "" : errorCode;
        }
    }

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
    private JSONArray cachedConditions = new JSONArray();
    private JSONArray cachedSites = new JSONArray();
    private LinearLayout deviceListContainer;
    private EditText deviceSearch;
    private TextView homeStatus;
    private FrameLayout contentContainer;
    private TextView tabOperations;
    private TextView tabDevices;
    private TextView tabSettings;
    private AutoCompleteTextView operationSerialInput;
    private LinearLayout operationResultContainer;
    private String activeMainTab = "OPERATIONS";
    private String deviceListFilter = "ALL";
    private String selectedOperationSerial = "";
    private volatile boolean deviceRefreshRunning = false;
    private volatile boolean catalogRefreshRunning = false;
    private long employeeSuggestionTicket = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        DiagnosticLog.init(this);
        DiagnosticLog.event("ACTIVITY_CREATE", DiagnosticLog.object("screen", "login"));
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
        Button logButton = findViewById(R.id.btnLoginLog);
        progress = findViewById(R.id.progressLogin);
        status = findViewById(R.id.tvLoginStatus);

        status.setVisibility(View.GONE);
        progress.setVisibility(View.GONE);

        logButton.setOnClickListener(v -> {
            logButton.setEnabled(false);
            setStatus("Đang đóng gói và gửi log chẩn đoán...", false);
            DiagnosticLog.event("MANUAL_LOG_REQUEST", DiagnosticLog.object("screen", "login"));
            DiagnosticLog.manualUpload((success, message) -> runOnUiThread(() -> {
                logButton.setEnabled(true);
                setStatus(message, !success);
            }));
        });

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
            DiagnosticLog.event("LOGIN_ATTEMPT", DiagnosticLog.object(
                "username_present", !user.isEmpty(),
                "password_length_valid", pass.length() >= 8
            ));
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
        long started = System.currentTimeMillis();
        int code = 0;
        try {
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

            code = connection.getResponseCode();
            java.io.InputStream stream = code >= 200 && code <= 299 ? connection.getInputStream() : connection.getErrorStream();
            String text = "";
            if (stream != null) {
                try (java.io.InputStream input = stream;
                     java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream()) {
                    byte[] chunk = new byte[8192];
                    int read;
                    while ((read = input.read(chunk)) > 0 && buffer.size() < 256_000) buffer.write(chunk, 0, read);
                    text = buffer.toString("UTF-8");
                }
            }

            JSONObject result;
            try {
                result = text.trim().isEmpty() ? new JSONObject() : new JSONObject(text);
            } catch (Exception invalidJson) {
                DiagnosticLog.network(method, path, code, System.currentTimeMillis() - started, "", "INVALID_JSON_RESPONSE");
                throw new ApiException(code, "Phản hồi hệ thống không hợp lệ (HTTP " + code + ").", "", "INVALID_JSON_RESPONSE");
            }

            String errorId = result.optString("error_id", "");
            String errorCode = result.optString("error_code", result.optString("error", ""));
            DiagnosticLog.network(method, path, code, System.currentTimeMillis() - started, errorId, errorCode);

            if (code < 200 || code > 299) {
                String message = result.optString("message", result.optString("error", "HTTP " + code));
                if (!errorId.isEmpty()) message += " · Mã lỗi: " + errorId;
                throw new ApiException(code, message, errorId, errorCode);
            }
            return result;
        } catch (ApiException error) {
            throw error;
        } catch (Exception error) {
            DiagnosticLog.networkException(method, path, System.currentTimeMillis() - started, error);
            throw error;
        }
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
                DiagnosticLog.event("LOGIN_SUCCESS", DiagnosticLog.object(
                    "role", sessionRole,
                    "display_name_present", !sessionDisplayName.isEmpty()
                ));
                runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    loginButton.setEnabled(true);
                    passwordField.setText("");
                    renderHome(user);
                });
            } catch (Exception error) {
                DiagnosticLog.event("LOGIN_FAILED", DiagnosticLog.object(
                    "exception", error.getClass().getSimpleName(),
                    "message", error.getMessage() == null ? "" : error.getMessage(),
                    "http_status", error instanceof ApiException ? ((ApiException) error).statusCode : 0,
                    "error_id", error instanceof ApiException ? ((ApiException) error).errorId : "",
                    "error_code", error instanceof ApiException ? ((ApiException) error).errorCode : ""
                ));
                runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    loginButton.setEnabled(true);
                    setStatus(error.getMessage() == null ? "Không thể đăng nhập." : error.getMessage(), true);
                });
            }
        }, "pda-mgmt-login").start();
    }

    private void renderHome(JSONObject user) {
        setContentView(R.layout.activity_main);
        status = null;
        updateButton = null;
        loginButton = null;
        progress = null;

        contentContainer = findViewById(R.id.contentContainer);
        tabOperations = findViewById(R.id.tabOperations);
        tabDevices = findViewById(R.id.tabDevices);
        tabSettings = findViewById(R.id.tabSettings);

        TextView headerUser = findViewById(R.id.tvHeaderUser);
        TextView headerVersion = findViewById(R.id.tvHeaderVersion);
        headerUser.setText(sessionDisplayName + " · " + ("ROOT".equals(sessionRole) ? "Root" : "Điều phối"));
        headerVersion.setText("vc" + BuildConfig.VERSION_CODE);

        tabOperations.setOnClickListener(v -> showMainTab("OPERATIONS"));
        tabDevices.setOnClickListener(v -> showMainTab("DEVICES"));
        tabSettings.setOnClickListener(v -> showMainTab("SETTINGS"));

        activeMainTab = "OPERATIONS";
        showMainTab(activeMainTab);
        loadCatalogs(false);
        loadDevices(false);
    }

    private TextView sectionTitle(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(getColor(R.color.navy_900));
        view.setTextSize(18);
        view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private TextView helperText(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(getColor(R.color.text_secondary));
        view.setTextSize(12);
        return view;
    }

    private LinearLayout card() {
        LinearLayout view = new LinearLayout(this);
        view.setOrientation(LinearLayout.VERTICAL);
        view.setBackgroundResource(R.drawable.bg_card);
        view.setPadding(dp(14), dp(13), dp(14), dp(13));
        return view;
    }

    private Button actionButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        return button;
    }

    private void addWithTopMargin(LinearLayout parent, View child, int topDp) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(topDp);
        parent.addView(child, params);
    }

    private void showMainTab(String tab) {
        activeMainTab = tab;
        applyMainTabStyle();
        if (contentContainer == null) return;
        contentContainer.removeAllViews();
        if ("DEVICES".equals(tab)) renderDeviceListTab();
        else if ("SETTINGS".equals(tab)) renderSettingsTab();
        else renderOperationsTab();
    }

    private void applyMainTabStyle() {
        styleMainTab(tabOperations, "OPERATIONS".equals(activeMainTab));
        styleMainTab(tabDevices, "DEVICES".equals(activeMainTab));
        styleMainTab(tabSettings, "SETTINGS".equals(activeMainTab));
    }

    private void styleMainTab(TextView view, boolean selected) {
        if (view == null) return;
        view.setBackgroundResource(selected ? R.drawable.bg_tab_selected : R.drawable.bg_tab_unselected);
        view.setTextColor(getColor(selected ? R.color.navy_900 : R.color.text_secondary));
    }

    private void renderOperationsTab() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(18), dp(16), dp(24));
        scroll.addView(root);

        root.addView(sectionTitle("Nghiệp vụ"));
        TextView intro = helperText("Quét mã hoặc nhập Serial PDA. Hệ thống tự nhận diện trạng thái để hiển thị đúng nghiệp vụ mượn / trả.");
        addWithTopMargin(root, intro, 4);

        LinearLayout scanCard = card();
        TextView label = helperText("SERIAL PDA");
        label.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        label.setTextColor(getColor(R.color.text_primary));
        scanCard.addView(label);

        operationSerialInput = new AutoCompleteTextView(this);
        operationSerialInput.setHint("Quét / nhập Serial PDA");
        operationSerialInput.setSingleLine(true);
        operationSerialInput.setThreshold(1);
        operationSerialInput.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_DONE);
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(54));
        inputParams.topMargin = dp(7);
        scanCard.addView(operationSerialInput, inputParams);

        TextView scanHint = helperText("Gợi ý lấy trực tiếp từ danh sách PDA đã đồng bộ; không phát sinh đọc dịch vụ theo từng ký tự.");
        scanHint.setPadding(0, dp(7), 0, 0);
        scanCard.addView(scanHint);
        addWithTopMargin(root, scanCard, 14);

        operationResultContainer = new LinearLayout(this);
        operationResultContainer.setOrientation(LinearLayout.VERTICAL);
        addWithTopMargin(root, operationResultContainer, 12);

        applySerialSuggestions();
        operationSerialInput.setOnItemClickListener((parent, view, position, id) -> {
            String serial = String.valueOf(parent.getItemAtPosition(position)).trim();
            operationSerialInput.setText(serial);
            operationSerialInput.setSelection(serial.length());
            selectOperationSerial(serial);
        });
        operationSerialInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == android.view.inputmethod.EditorInfo.IME_ACTION_DONE ||
                (event != null && event.getKeyCode() == android.view.KeyEvent.KEYCODE_ENTER)) {
                selectOperationSerial(operationSerialInput.getText().toString());
                return true;
            }
            return false;
        });
        operationSerialInput.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence value, int start, int before, int count) {
                String serial = value == null ? "" : value.toString().trim();
                JSONObject match = findDevice(serial);
                if (match != null && serial.equalsIgnoreCase(match.optString("serial", ""))) {
                    selectedOperationSerial = match.optString("serial", "");
                    renderOperationDevice(match);
                } else if (!serial.equalsIgnoreCase(selectedOperationSerial)) {
                    selectedOperationSerial = "";
                    operationResultContainer.removeAllViews();
                }
            }
            @Override public void afterTextChanged(Editable s) {}
        });

        if (!selectedOperationSerial.isEmpty()) {
            JSONObject device = findDevice(selectedOperationSerial);
            if (device != null) {
                operationSerialInput.setText(selectedOperationSerial);
                operationSerialInput.setSelection(selectedOperationSerial.length());
                renderOperationDevice(device);
            }
        }

        contentContainer.addView(scroll, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void applySerialSuggestions() {
        if (operationSerialInput == null) return;
        ArrayList<String> serials = new ArrayList<>();
        for (int index = 0; index < cachedDevices.length(); index++) {
            JSONObject device = cachedDevices.optJSONObject(index);
            if (device == null) continue;
            String serial = device.optString("serial", "").trim();
            if (!serial.isEmpty()) serials.add(serial);
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
            this, android.R.layout.simple_dropdown_item_1line, serials);
        operationSerialInput.setAdapter(adapter);
    }

    private JSONObject findDevice(String rawSerial) {
        String serial = rawSerial == null ? "" : rawSerial.trim();
        if (serial.isEmpty()) return null;
        for (int index = 0; index < cachedDevices.length(); index++) {
            JSONObject device = cachedDevices.optJSONObject(index);
            if (device != null && serial.equalsIgnoreCase(device.optString("serial", ""))) return device;
        }
        return null;
    }

    private void selectOperationSerial(String rawSerial) {
        String serial = rawSerial == null ? "" : rawSerial.trim();
        JSONObject device = findDevice(serial);
        if (device == null) {
            selectedOperationSerial = "";
            if (operationResultContainer != null) {
                operationResultContainer.removeAllViews();
                TextView missing = helperText(serial.isEmpty()
                    ? "Nhập Serial PDA."
                    : "Không tìm thấy Serial này trong danh sách PDA.");
                missing.setTextColor(getColor(R.color.red_600));
                operationResultContainer.addView(missing);
            }
            return;
        }
        selectedOperationSerial = device.optString("serial", "");
        renderOperationDevice(device);
    }

    private String deviceCondition(JSONObject device) {
        String catalogName = device.optString("condition_name", "").trim();
        return catalogName.isEmpty()
            ? conditionLabel(device.optString("physical_condition", "UNKNOWN"))
            : catalogName;
    }

    private String deviceSite(JSONObject device) {
        String site = device.optString("site_name", "").trim();
        return site.isEmpty() ? "Chưa gán" : site;
    }

    private void renderOperationDevice(JSONObject device) {
        if (operationResultContainer == null) return;
        operationResultContainer.removeAllViews();

        String serial = device.optString("serial", "");
        String usage = device.optString("usage_status", "AVAILABLE");
        LinearLayout resultCard = card();

        TextView title = new TextView(this);
        title.setText(serial);
        title.setTextColor(getColor(R.color.navy_900));
        title.setTextSize(18);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        resultCard.addView(title);

        String model = (device.optString("manufacturer", "") + " " + device.optString("model", "")).trim();
        StringBuilder info = new StringBuilder();
        if (!model.isEmpty()) info.append(model).append("\n");
        info.append("Site: ").append(deviceSite(device))
            .append("\nTrạng thái: ").append(usageLabel(usage))
            .append("\nNgoại quan: ").append(deviceCondition(device));
        if ("BORROWED".equals(usage)) {
            info.append("\nNgười mượn: ")
                .append(device.optString("borrower_employee_code", ""))
                .append(" · ")
                .append(device.optString("borrower_name", ""));
        }
        TextView detail = helperText(info.toString());
        detail.setTextSize(13);
        detail.setPadding(0, dp(6), 0, 0);
        resultCard.addView(detail);

        if ("AVAILABLE".equals(usage)) {
            Button borrow = actionButton("Cho mượn PDA");
            borrow.setOnClickListener(v -> showBorrowDialog(device));
            addWithTopMargin(resultCard, borrow, 12);
        } else if ("BORROWED".equals(usage)) {
            Button giveBack = actionButton("Trả PDA");
            giveBack.setOnClickListener(v -> showReturnDialog(device));
            addWithTopMargin(resultCard, giveBack, 12);
        } else {
            TextView unavailable = helperText("PDA đang ở trạng thái " + usageLabel(usage) + ", không thể cho mượn.");
            unavailable.setTextColor(getColor(R.color.red_600));
            addWithTopMargin(resultCard, unavailable, 12);
        }

        operationResultContainer.addView(resultCard);
    }

    private void renderDeviceListTab() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(14), dp(14), dp(14), dp(12));

        LinearLayout filterRow = new LinearLayout(this);
        filterRow.setOrientation(LinearLayout.HORIZONTAL);
        filterRow.setGravity(Gravity.CENTER);
        TextView all = filterChip("Tất cả", "ALL");
        TextView available = filterChip("Khả dụng", "AVAILABLE");
        TextView borrowed = filterChip("Đang mượn", "BORROWED");
        filterRow.addView(all, new LinearLayout.LayoutParams(0, dp(44), 1f));
        LinearLayout.LayoutParams fp = new LinearLayout.LayoutParams(0, dp(44), 1f);
        fp.setMarginStart(dp(6));
        filterRow.addView(available, fp);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(0, dp(44), 1f);
        bp.setMarginStart(dp(6));
        filterRow.addView(borrowed, bp);
        root.addView(filterRow);

        homeStatus = helperText(deviceListStatusText());
        homeStatus.setPadding(0, dp(10), 0, dp(7));
        root.addView(homeStatus);

        deviceSearch = new EditText(this);
        deviceSearch.setHint("Tìm Serial / Model / Site / người mượn");
        deviceSearch.setSingleLine(true);
        root.addView(deviceSearch, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(50)));

        ScrollView scroll = new ScrollView(this);
        deviceListContainer = new LinearLayout(this);
        deviceListContainer.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(deviceListContainer);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        sp.topMargin = dp(10);
        root.addView(scroll, sp);

        deviceSearch.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                renderDeviceRows(s == null ? "" : s.toString());
            }
            @Override public void afterTextChanged(Editable s) {}
        });
        renderDeviceRows("");
        contentContainer.addView(root, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private TextView filterChip(String label, String value) {
        TextView view = new TextView(this);
        view.setText(label);
        view.setGravity(Gravity.CENTER);
        view.setTextSize(11);
        view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        boolean selected = value.equals(deviceListFilter);
        view.setBackgroundResource(selected ? R.drawable.bg_tab_selected : R.drawable.bg_tab_unselected);
        view.setTextColor(getColor(selected ? R.color.navy_900 : R.color.text_secondary));
        view.setOnClickListener(v -> {
            deviceListFilter = value;
            showMainTab("DEVICES");
        });
        return view;
    }

    private String deviceListStatusText() {
        int all = cachedDevices.length();
        int available = 0;
        int borrowed = 0;
        for (int index = 0; index < cachedDevices.length(); index++) {
            JSONObject device = cachedDevices.optJSONObject(index);
            if (device == null) continue;
            String usage = device.optString("usage_status", "");
            if ("AVAILABLE".equals(usage)) available++;
            if ("BORROWED".equals(usage)) borrowed++;
        }
        return "Tổng " + all + " PDA · Khả dụng " + available + " · Đang mượn " + borrowed;
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

    private void loadDevicesPath(String requestPath, boolean force) {
        if (deviceRefreshRunning || sessionToken.isEmpty()) return;
        deviceRefreshRunning = true;
        if ("DEVICES".equals(activeMainTab)) {
            setHomeStatus(force ? "Đang đồng bộ Registry..." : "Đang tải danh sách PDA...", false);
        }

        new Thread(() -> {
            try {
                JSONObject result = apiRequest("GET", requestPath, null, true);
                JSONArray devices = result.optJSONArray("devices");
                if (devices == null) devices = new JSONArray();
                final JSONArray finalDevices = devices;
                String syncError = result.optString("registry_sync_error", "");
                runOnUiThread(() -> {
                    deviceRefreshRunning = false;
                    cachedDevices = finalDevices;
                    DiagnosticLog.event("DEVICE_LIST_LOADED", DiagnosticLog.object(
                        "count", finalDevices.length(),
                        "forced_refresh", force,
                        "registry_sync_error", syncError
                    ));
                    applySerialSuggestions();
                    if ("DEVICES".equals(activeMainTab)) {
                        String query = deviceSearch == null ? "" : deviceSearch.getText().toString();
                        renderDeviceRows(query);
                        setHomeStatus(deviceListStatusText() +
                            (syncError.isEmpty() ? "" : " · Đồng bộ Registry tạm lỗi"), !syncError.isEmpty());
                    } else if ("OPERATIONS".equals(activeMainTab) && !selectedOperationSerial.isEmpty()) {
                        JSONObject current = findDevice(selectedOperationSerial);
                        if (current != null) renderOperationDevice(current);
                    }
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    deviceRefreshRunning = false;
                    String message = error.getMessage() == null ? "Không tải được danh sách PDA." : error.getMessage();
                    if ("DEVICES".equals(activeMainTab)) setHomeStatus(message, true);
                    else Toast.makeText(this, message, Toast.LENGTH_LONG).show();
                    if (message.toLowerCase().contains("phiên") || message.toLowerCase().contains("unauthorized")) {
                        sessionToken = "";
                        renderLogin();
                    }
                });
            }
        }, "pda-mgmt-device-list").start();
    }

    private void loadCatalogs(boolean refreshCurrentTab) {
        if (catalogRefreshRunning || sessionToken.isEmpty()) return;
        catalogRefreshRunning = true;
        new Thread(() -> {
            try {
                JSONObject result = apiRequest("GET", "/api/catalogs", null, true);
                JSONArray conditions = result.optJSONArray("conditions");
                JSONArray sites = result.optJSONArray("sites");
                if (conditions == null) conditions = new JSONArray();
                if (sites == null) sites = new JSONArray();
                final JSONArray finalConditions = conditions;
                final JSONArray finalSites = sites;
                runOnUiThread(() -> {
                    catalogRefreshRunning = false;
                    cachedConditions = finalConditions;
                    cachedSites = finalSites;
                    if (refreshCurrentTab) showMainTab(activeMainTab);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    catalogRefreshRunning = false;
                    Toast.makeText(this, "Không tải được danh mục PDA.", Toast.LENGTH_LONG).show();
                });
            }
        }, "pda-mgmt-catalogs").start();
    }

    private boolean matchesListFilter(JSONObject device) {
        if ("AVAILABLE".equals(deviceListFilter)) return "AVAILABLE".equals(device.optString("usage_status", ""));
        if ("BORROWED".equals(deviceListFilter)) return "BORROWED".equals(device.optString("usage_status", ""));
        return true;
    }

    private void renderDeviceRows(String rawQuery) {
        if (deviceListContainer == null) return;
        deviceListContainer.removeAllViews();
        String query = rawQuery == null ? "" : rawQuery.trim().toLowerCase();
        int visible = 0;

        for (int index = 0; index < cachedDevices.length(); index++) {
            JSONObject device = cachedDevices.optJSONObject(index);
            if (device == null || !matchesListFilter(device)) continue;
            String serial = device.optString("serial", "");
            String model = device.optString("model", "");
            String manufacturer = device.optString("manufacturer", "");
            String usage = device.optString("usage_status", "AVAILABLE");
            String condition = deviceCondition(device);
            String site = deviceSite(device);
            String borrowerCode = device.optString("borrower_employee_code", "");
            String borrowerName = device.optString("borrower_name", "");
            String haystack = (serial + " " + model + " " + manufacturer + " " + usage + " " +
                condition + " " + site + " " + borrowerCode + " " + borrowerName).toLowerCase();
            if (!query.isEmpty() && !haystack.contains(query)) continue;
            visible++;

            LinearLayout row = card();
            TextView serialView = new TextView(this);
            serialView.setText(serial);
            serialView.setTextColor(getColor(R.color.navy_900));
            serialView.setTextSize(16);
            serialView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            row.addView(serialView);

            String modelText = (manufacturer + " " + model).trim();
            StringBuilder detailText = new StringBuilder();
            if (!modelText.isEmpty()) detailText.append(modelText).append("\n");
            detailText.append(usageLabel(usage))
                .append(" · ").append(condition)
                .append("\nSite: ").append(site);
            if ("BORROWED".equals(usage)) {
                detailText.append("\nNgười mượn: ").append(borrowerCode).append(" · ").append(borrowerName);
            }
            TextView detail = helperText(detailText.toString());
            detail.setPadding(0, dp(4), 0, 0);
            row.addView(detail);

            row.setOnClickListener(v -> showDeviceDialog(device));
            LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            rp.bottomMargin = dp(8);
            deviceListContainer.addView(row, rp);
        }

        if (visible == 0) {
            TextView empty = helperText(query.isEmpty()
                ? "Không có PDA trong nhóm này."
                : "Không tìm thấy PDA phù hợp.");
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(dp(12), dp(30), dp(12), dp(30));
            deviceListContainer.addView(empty);
        }
    }

    private void showDeviceDialog(JSONObject device) {
        String serial = device.optString("serial", "");
        String usage = device.optString("usage_status", "AVAILABLE");

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(8), dp(20), dp(4));

        TextView info = helperText(
            "Serial: " + serial +
            "\nTrạng thái: " + usageLabel(usage) +
            "\nNgoại quan: " + deviceCondition(device) +
            "\nSite: " + deviceSite(device) +
            ("BORROWED".equals(usage)
                ? "\n\nĐang mượn: " + device.optString("borrower_employee_code", "") +
                  " · " + device.optString("borrower_name", "")
                : "")
        );
        info.setTextColor(getColor(R.color.text_primary));
        info.setTextSize(13);
        box.addView(info);

        if ("AVAILABLE".equals(usage)) {
            Button borrow = actionButton("Cho mượn");
            borrow.setOnClickListener(v -> showBorrowDialog(device));
            addWithTopMargin(box, borrow, 12);
        } else if ("BORROWED".equals(usage)) {
            Button giveBack = actionButton("Trả PDA");
            giveBack.setOnClickListener(v -> showReturnDialog(device));
            addWithTopMargin(box, giveBack, 12);
        }

        if ("ROOT".equals(sessionRole)) {
            Button site = actionButton("Cập nhật Site PDA");
            site.setOnClickListener(v -> showSiteDialog(device));
            addWithTopMargin(box, site, 6);

            Button statusButton = actionButton("Cập nhật trạng thái sử dụng");
            statusButton.setOnClickListener(v -> showStatusDialog(device));
            addWithTopMargin(box, statusButton, 6);
        }

        Button history = actionButton("Xem lịch sử");
        history.setOnClickListener(v -> showDeviceHistory(serial));
        addWithTopMargin(box, history, 6);

        new AlertDialog.Builder(this)
            .setTitle("Chi tiết PDA")
            .setView(box)
            .setNegativeButton("Đóng", null)
            .show();
    }

    private ArrayAdapter<String> catalogAdapter(JSONArray items) {
        ArrayList<String> labels = new ArrayList<>();
        for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item != null) labels.add(item.optString("name", ""));
        }
        return new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, labels);
    }

    private JSONObject catalogAt(JSONArray items, int position) {
        if (position < 0 || position >= items.length()) return null;
        return items.optJSONObject(position);
    }

    private void showBorrowDialog(JSONObject device) {
        if (cachedConditions.length() == 0) {
            Toast.makeText(this, "Danh mục tình trạng PDA chưa sẵn sàng.", Toast.LENGTH_LONG).show();
            loadCatalogs(false);
            return;
        }

        String serial = device.optString("serial", "");
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(20), dp(6), dp(20), 0);

        TextView lead = helperText("PDA " + serial + "\nQuét thẻ nhân sự hoặc nhập mã / tên để tìm.");
        form.addView(lead);

        AutoCompleteTextView employeeInput = new AutoCompleteTextView(this);
        employeeInput.setHint("Mã nhân viên / Họ tên");
        employeeInput.setSingleLine(true);
        employeeInput.setThreshold(2);
        addWithTopMargin(form, employeeInput, 8);

        TextView employeePreview = helperText("Nhập tối thiểu 2 ký tự để hiển thị gợi ý.");
        addWithTopMargin(form, employeePreview, 5);
        attachEmployeeSuggestions(employeeInput, employeePreview);

        TextView conditionLabel = helperText("Tình trạng ngoại quan khi giao PDA");
        conditionLabel.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        conditionLabel.setTextColor(getColor(R.color.text_primary));
        addWithTopMargin(form, conditionLabel, 14);

        Spinner conditionSpinner = new Spinner(this);
        conditionSpinner.setAdapter(catalogAdapter(cachedConditions));
        addWithTopMargin(form, conditionSpinner, 4);

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Cho mượn PDA")
            .setView(form)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Tiếp tục", null)
            .create();

        dialog.setOnShowListener(ignored ->
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String raw = employeeInput.getText().toString().trim();
                String employeeCode = employeeCodeFromSuggestion(raw);
                JSONObject condition = catalogAt(cachedConditions, conditionSpinner.getSelectedItemPosition());
                if (employeeCode.isEmpty() || condition == null) {
                    Toast.makeText(this, "Chọn nhân viên và tình trạng ngoại quan.", Toast.LENGTH_SHORT).show();
                    return;
                }
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
                resolveEmployee(employeeCode, employee -> runOnUiThread(() -> {
                    dialog.dismiss();
                    confirmBorrow(device, employee, condition);
                }), error -> runOnUiThread(() -> {
                    dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                    Toast.makeText(this, error, Toast.LENGTH_LONG).show();
                }));
            })
        );
        dialog.show();
    }

    private String employeeCodeFromSuggestion(String raw) {
        String value = raw == null ? "" : raw.trim();
        int separator = value.indexOf(" · ");
        return separator > 0 ? value.substring(0, separator).trim() : value;
    }

    private void attachEmployeeSuggestions(AutoCompleteTextView input, TextView preview) {
        input.setOnItemClickListener((parent, view, position, id) -> {
            String selected = String.valueOf(parent.getItemAtPosition(position));
            input.setText(selected);
            input.setSelection(selected.length());
            preview.setText(selected);
        });
        input.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence text, int start, int before, int count) {
                String query = employeeCodeFromSuggestion(text == null ? "" : text.toString());
                if (query.length() < 2) return;
                final long ticket = ++employeeSuggestionTicket;
                input.postDelayed(() -> {
                    if (ticket != employeeSuggestionTicket || sessionToken.isEmpty()) return;
                    new Thread(() -> {
                        try {
                            JSONObject result = apiRequest(
                                "GET",
                                "/api/employees?q=" + java.net.URLEncoder.encode(query, "UTF-8"),
                                null,
                                true
                            );
                            JSONArray employees = result.optJSONArray("employees");
                            ArrayList<String> labels = new ArrayList<>();
                            if (employees != null) {
                                for (int index = 0; index < employees.length(); index++) {
                                    JSONObject employee = employees.optJSONObject(index);
                                    if (employee == null) continue;
                                    String contractor = employee.optString("contractor", "");
                                    labels.add(employee.optString("employee_code", "") + " · " +
                                        employee.optString("full_name", "") +
                                        (contractor.isEmpty() ? "" : " · " + contractor));
                                }
                            }
                            runOnUiThread(() -> {
                                if (ticket != employeeSuggestionTicket) return;
                                ArrayAdapter<String> adapter = new ArrayAdapter<String>(
                                    MainActivity.this,
                                    android.R.layout.simple_dropdown_item_1line,
                                    labels
                                );
                                input.setAdapter(adapter);
                                if (!labels.isEmpty() && input.hasFocus()) input.showDropDown();
                            });
                        } catch (Exception ignored) {
                        }
                    }, "pda-mgmt-employee-suggest").start();
                }, 350);
            }
            @Override public void afterTextChanged(Editable s) {}
        });
    }

    private interface EmployeeSuccess {
        void accept(JSONObject employee);
    }

    private interface EmployeeFailure {
        void accept(String message);
    }

    private void resolveEmployee(String employeeCode, EmployeeSuccess success, EmployeeFailure failure) {
        new Thread(() -> {
            try {
                JSONObject result = apiRequest(
                    "GET",
                    "/api/employees/" + java.net.URLEncoder.encode(employeeCode, "UTF-8"),
                    null,
                    true
                );
                JSONObject employee = result.optJSONObject("employee");
                if (employee == null) throw new IllegalStateException("Không tìm thấy nhân sự.");
                success.accept(employee);
            } catch (Exception error) {
                failure.accept(error.getMessage() == null ? "Không kiểm tra được nhân sự." : error.getMessage());
            }
        }, "pda-mgmt-employee-resolve").start();
    }

    private JSONObject payload(Object... pairs) {
        JSONObject result = new JSONObject();
        try {
            for (int index = 0; index + 1 < pairs.length; index += 2) {
                result.put(String.valueOf(pairs[index]), pairs[index + 1]);
            }
        } catch (Exception ignored) {
        }
        return result;
    }

    private void confirmBorrow(JSONObject device, JSONObject employee, JSONObject condition) {
        String serial = device.optString("serial", "");
        String code = employee.optString("employee_code", "");
        String name = employee.optString("full_name", "");
        String contractor = employee.optString("contractor", "");
        String conditionName = condition.optString("name", "");

        new AlertDialog.Builder(this)
            .setTitle("Xác nhận cho mượn")
            .setMessage(
                "PDA: " + serial +
                "\nNgười mượn: " + code + " · " + name +
                (contractor.isEmpty() ? "" : "\nNhà thầu: " + contractor) +
                "\nNgoại quan: " + conditionName
            )
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận", (d, w) -> mutateDevice(
                serial,
                "borrow",
                payload(
                    "employee_code", code,
                    "condition_id", condition.optString("item_id", ""),
                    "idempotency_key", UUID.randomUUID().toString()
                ),
                "Đã ghi nhận cho mượn PDA."
            ))
            .show();
    }

    private void showReturnDialog(JSONObject device) {
        if (cachedConditions.length() == 0) {
            Toast.makeText(this, "Danh mục tình trạng PDA chưa sẵn sàng.", Toast.LENGTH_LONG).show();
            loadCatalogs(false);
            return;
        }

        String serial = device.optString("serial", "");
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(20), dp(6), dp(20), 0);

        TextView borrower = helperText(
            "Người đang mượn: " + device.optString("borrower_employee_code", "") +
            " · " + device.optString("borrower_name", "")
        );
        form.addView(borrower);

        TextView conditionTitle = helperText("Tình trạng ngoại quan khi nhận lại");
        conditionTitle.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        conditionTitle.setTextColor(getColor(R.color.text_primary));
        addWithTopMargin(form, conditionTitle, 14);

        Spinner conditionSpinner = new Spinner(this);
        conditionSpinner.setAdapter(catalogAdapter(cachedConditions));
        addWithTopMargin(form, conditionSpinner, 4);

        EditText note = new EditText(this);
        note.setHint("Ghi chú (không bắt buộc)");
        note.setSingleLine(false);
        note.setMaxLines(3);
        addWithTopMargin(form, note, 12);

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Trả PDA " + serial)
            .setView(form)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xác nhận trả", null)
            .create();
        dialog.setOnShowListener(ignored ->
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                JSONObject condition = catalogAt(cachedConditions, conditionSpinner.getSelectedItemPosition());
                if (condition == null) {
                    Toast.makeText(this, "Chọn tình trạng ngoại quan.", Toast.LENGTH_SHORT).show();
                    return;
                }
                dialog.dismiss();
                mutateDevice(
                    serial,
                    "return",
                    payload(
                        "condition_id", condition.optString("item_id", ""),
                        "note", note.getText().toString().trim(),
                        "idempotency_key", UUID.randomUUID().toString()
                    ),
                    "Đã ghi nhận trả PDA."
                );
            })
        );
        dialog.show();
    }

    private void showStatusDialog(JSONObject device) {
        if (!"ROOT".equals(sessionRole)) return;
        String serial = device.optString("serial", "");
        if ("BORROWED".equals(device.optString("usage_status", ""))) {
            Toast.makeText(this, "PDA đang mượn phải thực hiện Trả PDA trước.", Toast.LENGTH_LONG).show();
            return;
        }
        String[] labels = {"Khả dụng", "Đang sửa", "Ngừng dùng", "Thất lạc"};
        String[] statuses = {"AVAILABLE", "REPAIR", "DISABLED", "LOST"};
        String[] conditions = {"GOOD", "DAMAGED", "UNKNOWN", "UNKNOWN"};
        final int[] selected = {0};

        new AlertDialog.Builder(this)
            .setTitle("Trạng thái sử dụng · " + serial)
            .setSingleChoiceItems(labels, 0, (dialog, which) -> selected[0] = which)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Cập nhật", (dialog, which) -> mutateDevice(
                serial,
                "status",
                payload(
                    "usage_status", statuses[selected[0]],
                    "physical_condition", conditions[selected[0]],
                    "idempotency_key", UUID.randomUUID().toString()
                ),
                "Đã cập nhật trạng thái PDA."
            ))
            .show();
    }

    private void showSiteDialog(JSONObject device) {
        if (!"ROOT".equals(sessionRole)) return;
        if (cachedSites.length() == 0) {
            Toast.makeText(this, "Chưa có danh mục Site PDA.", Toast.LENGTH_LONG).show();
            loadCatalogs(false);
            return;
        }
        Spinner siteSpinner = new Spinner(this);
        siteSpinner.setAdapter(catalogAdapter(cachedSites));
        new AlertDialog.Builder(this)
            .setTitle("Site PDA · " + device.optString("serial", ""))
            .setMessage("Site hiện tại: " + deviceSite(device))
            .setView(siteSpinner)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Cập nhật", (dialog, which) -> {
                JSONObject site = catalogAt(cachedSites, siteSpinner.getSelectedItemPosition());
                if (site == null) return;
                mutateDevice(
                    device.optString("serial", ""),
                    "site",
                    payload(
                        "site_id", site.optString("item_id", ""),
                        "idempotency_key", UUID.randomUUID().toString()
                    ),
                    "Đã cập nhật Site PDA."
                );
            })
            .show();
    }

    private void mutateDevice(String serial, String action, JSONObject body, String successMessage) {
        DiagnosticLog.action(action, serial, "START");
        if ("DEVICES".equals(activeMainTab)) setHomeStatus("Đang xử lý " + serial + "...", false);
        new Thread(() -> {
            try {
                apiRequest(
                    "POST",
                    "/api/devices/" + java.net.URLEncoder.encode(serial, "UTF-8") + "/" + action,
                    body,
                    true
                );
                DiagnosticLog.action(action, serial, "SUCCESS");
                runOnUiThread(() -> {
                    Toast.makeText(this, successMessage, Toast.LENGTH_SHORT).show();
                    loadDevicesLocal();
                });
            } catch (Exception error) {
                DiagnosticLog.action(action, serial, "FAILED");
                DiagnosticLog.event("BUSINESS_ACTION_ERROR", DiagnosticLog.object(
                    "action", action,
                    "serial", serial,
                    "exception", error.getClass().getSimpleName(),
                    "message", error.getMessage() == null ? "" : error.getMessage()
                ));
                runOnUiThread(() -> {
                    String message = error.getMessage() == null ? "Không thể xử lý PDA." : error.getMessage();
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show();
                    loadDevicesLocal();
                });
            }
        }, "pda-mgmt-device-mutation").start();
    }

    private void showDeviceHistory(String serial) {
        new Thread(() -> {
            try {
                JSONObject result = apiRequest(
                    "GET",
                    "/api/devices/" + java.net.URLEncoder.encode(serial, "UTF-8") + "/history",
                    null,
                    true
                );
                JSONArray items = result.optJSONArray("transactions");
                StringBuilder lines = new StringBuilder();
                if (items == null || items.length() == 0) {
                    lines.append("Chưa có lịch sử giao dịch.");
                } else {
                    int limit = Math.min(items.length(), 40);
                    for (int index = 0; index < limit; index++) {
                        JSONObject item = items.optJSONObject(index);
                        if (item == null) continue;
                        String at = item.optString("occurred_at", "").replace("T", " ");
                        if (at.length() > 16) at = at.substring(0, 16);
                        lines.append(historyActionLabel(item.optString("action", "")))
                            .append(" · ").append(at);
                        String employee = item.optString("employee_name", "");
                        String code = item.optString("employee_code", "");
                        if (!employee.isEmpty() || !code.isEmpty()) {
                            lines.append("\n").append(code).append(" · ").append(employee);
                        }
                        String condition = item.optString("condition_name", "");
                        if (!condition.isEmpty()) lines.append("\nNgoại quan: ").append(condition);
                        String site = item.optString("site_name", "");
                        if (!site.isEmpty()) lines.append("\nSite: ").append(site);
                        lines.append("\nThực hiện: ").append(item.optString("operator_name", "")).append("\n\n");
                    }
                }
                String message = lines.toString().trim();
                runOnUiThread(() -> new AlertDialog.Builder(this)
                    .setTitle("Lịch sử " + serial)
                    .setMessage(message)
                    .setPositiveButton("Đóng", null)
                    .show());
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(
                    this,
                    error.getMessage() == null ? "Không đọc được lịch sử." : error.getMessage(),
                    Toast.LENGTH_LONG
                ).show());
            }
        }, "pda-mgmt-history").start();
    }

    private String historyActionLabel(String action) {
        switch (action) {
            case "BORROW": return "Mượn";
            case "RETURN": return "Trả";
            case "STATUS_UPDATE": return "Cập nhật trạng thái";
            case "SITE_UPDATE": return "Cập nhật Site";
            default: return action;
        }
    }

    private String usageLabel(String value) {
        switch (value) {
            case "BORROWED": return "Đang mượn";
            case "REPAIR": return "Đang sửa";
            case "DISABLED": return "Ngừng dùng";
            case "LOST": return "Thất lạc";
            default: return "Khả dụng";
        }
    }

    private String conditionLabel(String value) {
        switch (value) {
            case "GOOD": return "Tốt";
            case "MINOR_DAMAGE": return "Trầy xước / lỗi nhẹ";
            case "DAMAGED": return "Hỏng / cần sửa";
            default: return "Chưa đánh giá";
        }
    }

    private void renderSettingsTab() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(18), dp(16), dp(24));
        scroll.addView(root);

        root.addView(sectionTitle("Cài đặt"));

        LinearLayout account = card();
        TextView accountTitle = new TextView(this);
        accountTitle.setText("Tài khoản");
        accountTitle.setTextColor(getColor(R.color.navy_900));
        accountTitle.setTextSize(15);
        accountTitle.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        account.addView(accountTitle);

        TextView info = helperText(
            sessionDisplayName + "\nQuyền: " + ("ROOT".equals(sessionRole) ? "Root" : "Điều phối") +
            "\nPhiên bản: Beta vc" + BuildConfig.VERSION_CODE + " · " + BuildConfig.VERSION_NAME
        );
        info.setPadding(0, dp(6), 0, 0);
        account.addView(info);
        addWithTopMargin(root, account, 12);

        Button log = actionButton("Gửi log chẩn đoán");
        log.setOnClickListener(v -> {
            log.setEnabled(false);
            DiagnosticLog.manualUpload((success, message) -> runOnUiThread(() -> {
                log.setEnabled(true);
                Toast.makeText(this, message, Toast.LENGTH_LONG).show();
            }));
        });
        addWithTopMargin(root, log, 10);

        Button update = actionButton("Kiểm tra cập nhật");
        update.setOnClickListener(v -> checkForUpdate(false));
        addWithTopMargin(root, update, 6);

        if ("ROOT".equals(sessionRole)) {
            TextView rootTitle = sectionTitle("Quản trị Root");
            rootTitle.setTextSize(15);
            addWithTopMargin(root, rootTitle, 22);

            Button accounts = actionButton("Tài khoản Điều phối");
            accounts.setOnClickListener(v -> showCoordinatorManager());
            addWithTopMargin(root, accounts, 8);

            Button conditions = actionButton("Danh mục Tình trạng PDA");
            conditions.setOnClickListener(v -> showCatalogManager("CONDITION"));
            addWithTopMargin(root, conditions, 6);

            Button sites = actionButton("Danh mục Site PDA");
            sites.setOnClickListener(v -> showCatalogManager("SITE"));
            addWithTopMargin(root, sites, 6);

            TextView launcherNote = helperText(
                "Danh mục Site đã sẵn sàng cho dữ liệu quản lý. Tích hợp chọn Site trên Launcher được giữ cho bản Launcher tiếp theo."
            );
            addWithTopMargin(root, launcherNote, 8);
        }

        Button logout = actionButton("Đăng xuất");
        logout.setOnClickListener(v -> performLogout());
        addWithTopMargin(root, logout, 20);

        contentContainer.addView(scroll, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void showCoordinatorManager() {
        if (!"ROOT".equals(sessionRole)) return;
        new Thread(() -> {
            try {
                JSONObject result = apiRequest("GET", "/api/users", null, true);
                JSONArray users = result.optJSONArray("users");
                if (users == null) users = new JSONArray();
                final JSONArray finalUsers = users;
                runOnUiThread(() -> renderCoordinatorManager(finalUsers));
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(
                    this,
                    error.getMessage() == null ? "Không tải được tài khoản Điều phối." : error.getMessage(),
                    Toast.LENGTH_LONG
                ).show());
            }
        }, "pda-mgmt-users").start();
    }

    private void renderCoordinatorManager(JSONArray users) {
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(dp(16), dp(6), dp(16), dp(12));

        Button add = actionButton("Thêm tài khoản Điều phối");
        add.setOnClickListener(v -> showCoordinatorForm(null));
        list.addView(add);

        int count = 0;
        for (int index = 0; index < users.length(); index++) {
            JSONObject user = users.optJSONObject(index);
            if (user == null || !"COORDINATOR".equals(user.optString("role", ""))) continue;
            count++;
            LinearLayout row = card();
            TextView name = new TextView(this);
            name.setText(user.optString("display_name", "") + " · " + user.optString("username", ""));
            name.setTextColor(getColor(R.color.navy_900));
            name.setTextSize(14);
            name.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            row.addView(name);

            TextView state = helperText("ACTIVE".equals(user.optString("status", ""))
                ? "Đang hoạt động"
                : "Đã khóa");
            addWithTopMargin(row, state, 3);

            LinearLayout actions = new LinearLayout(this);
            actions.setOrientation(LinearLayout.HORIZONTAL);
            Button edit = actionButton("Sửa");
            edit.setOnClickListener(v -> showCoordinatorForm(user));
            actions.addView(edit, new LinearLayout.LayoutParams(0, dp(44), 1f));
            Button password = actionButton("Mật khẩu");
            password.setOnClickListener(v -> showCoordinatorPassword(user));
            LinearLayout.LayoutParams pp = new LinearLayout.LayoutParams(0, dp(44), 1f);
            pp.setMarginStart(dp(5));
            actions.addView(password, pp);
            Button delete = actionButton("Xoá");
            delete.setOnClickListener(v -> confirmDeleteCoordinator(user));
            LinearLayout.LayoutParams dpv = new LinearLayout.LayoutParams(0, dp(44), 1f);
            dpv.setMarginStart(dp(5));
            actions.addView(delete, dpv);
            addWithTopMargin(row, actions, 8);
            addWithTopMargin(list, row, 8);
        }
        if (count == 0) {
            TextView empty = helperText("Chưa có tài khoản Điều phối.");
            addWithTopMargin(list, empty, 12);
        }

        ScrollView scroll = new ScrollView(this);
        scroll.addView(list);
        new AlertDialog.Builder(this)
            .setTitle("Tài khoản Điều phối")
            .setView(scroll)
            .setNegativeButton("Đóng", null)
            .show();
    }

    private void showCoordinatorForm(JSONObject existing) {
        boolean editing = existing != null;
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(20), dp(6), dp(20), 0);

        EditText username = new EditText(this);
        username.setHint("Tài khoản");
        username.setSingleLine(true);
        if (editing) username.setText(existing.optString("username", ""));
        form.addView(username);

        EditText displayName = new EditText(this);
        displayName.setHint("Họ tên / Tên hiển thị");
        displayName.setSingleLine(true);
        if (editing) displayName.setText(existing.optString("display_name", ""));
        addWithTopMargin(form, displayName, 7);

        Spinner statusSpinner = null;
        if (editing) {
            statusSpinner = new Spinner(this);
            statusSpinner.setAdapter(new ArrayAdapter<String>(
                this,
                android.R.layout.simple_spinner_dropdown_item,
                new String[] {"Đang hoạt động", "Tạm khóa"}
            ));
            statusSpinner.setSelection("DISABLED".equals(existing.optString("status", "")) ? 1 : 0);
            addWithTopMargin(form, statusSpinner, 7);
        }

        EditText password = null;
        if (!editing) {
            password = new EditText(this);
            password.setHint("Mật khẩu tối thiểu 8 ký tự");
            password.setSingleLine(true);
            password.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
            addWithTopMargin(form, password, 7);
        }

        final EditText newPassword = password;
        final Spinner accountStatus = statusSpinner;
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle(editing ? "Sửa tài khoản Điều phối" : "Thêm tài khoản Điều phối")
            .setView(form)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Lưu", null)
            .create();

        dialog.setOnShowListener(ignored ->
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String user = username.getText().toString().trim().toLowerCase();
                String display = displayName.getText().toString().trim();
                String pass = newPassword == null ? "" : newPassword.getText().toString();
                if (!user.matches("[a-z0-9._-]{1,64}") || display.isEmpty() || (!editing && pass.length() < 8)) {
                    Toast.makeText(this, "Kiểm tra lại thông tin tài khoản.", Toast.LENGTH_SHORT).show();
                    return;
                }
                JSONObject body = payload(
                    "action", editing ? "UPDATE" : "CREATE",
                    "username", user,
                    "display_name", display
                );
                if (editing) {
                    try {
                        body.put("user_id", existing.optString("user_id", ""));
                        body.put("status", accountStatus != null && accountStatus.getSelectedItemPosition() == 1
                            ? "DISABLED" : "ACTIVE");
                    } catch (Exception ignoredJson) {}
                } else {
                    try { body.put("password", pass); } catch (Exception ignoredJson) {}
                }
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
                postUserAction(body,
                    editing ? "Đã cập nhật tài khoản Điều phối." : "Đã tạo tài khoản Điều phối.",
                    () -> {
                        dialog.dismiss();
                        showCoordinatorManager();
                    },
                    () -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true)
                );
            })
        );
        dialog.show();
    }

    private void showCoordinatorPassword(JSONObject user) {
        EditText password = new EditText(this);
        password.setHint("Mật khẩu mới tối thiểu 8 ký tự");
        password.setSingleLine(true);
        password.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Đổi mật khẩu · " + user.optString("username", ""))
            .setView(password)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Đổi mật khẩu", null)
            .create();

        dialog.setOnShowListener(ignored ->
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String pass = password.getText().toString();
                if (pass.length() < 8) {
                    Toast.makeText(this, "Mật khẩu phải có tối thiểu 8 ký tự.", Toast.LENGTH_SHORT).show();
                    return;
                }
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
                postUserAction(
                    payload(
                        "action", "PASSWORD",
                        "user_id", user.optString("user_id", ""),
                        "password", pass
                    ),
                    "Đã đổi mật khẩu và thu hồi phiên đăng nhập cũ.",
                    dialog::dismiss,
                    () -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true)
                );
            })
        );
        dialog.show();
    }

    private void confirmDeleteCoordinator(JSONObject user) {
        new AlertDialog.Builder(this)
            .setTitle("Xoá tài khoản Điều phối")
            .setMessage("Xoá " + user.optString("display_name", "") + " (" + user.optString("username", "") + ")?")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xoá", (dialog, which) -> postUserAction(
                payload("action", "DELETE", "user_id", user.optString("user_id", "")),
                "Đã xoá tài khoản Điều phối.",
                this::showCoordinatorManager,
                () -> {}
            ))
            .show();
    }

    private void postUserAction(JSONObject body, String successMessage, Runnable success, Runnable failure) {
        new Thread(() -> {
            try {
                apiRequest("POST", "/api/users", body, true);
                runOnUiThread(() -> {
                    Toast.makeText(this, successMessage, Toast.LENGTH_SHORT).show();
                    success.run();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    Toast.makeText(
                        this,
                        error.getMessage() == null ? "Không thể cập nhật tài khoản." : error.getMessage(),
                        Toast.LENGTH_LONG
                    ).show();
                    failure.run();
                });
            }
        }, "pda-mgmt-user-mutation").start();
    }

    private void showCatalogManager(String type) {
        if (!"ROOT".equals(sessionRole)) return;
        new Thread(() -> {
            try {
                JSONObject result = apiRequest("GET", "/api/catalogs?type=" + type, null, true);
                JSONArray items = result.optJSONArray("items");
                if (items == null) items = new JSONArray();
                final JSONArray finalItems = items;
                runOnUiThread(() -> renderCatalogManager(type, finalItems));
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(
                    this,
                    error.getMessage() == null ? "Không tải được danh mục." : error.getMessage(),
                    Toast.LENGTH_LONG
                ).show());
            }
        }, "pda-mgmt-catalog-list").start();
    }

    private void renderCatalogManager(String type, JSONArray items) {
        String title = "SITE".equals(type) ? "Danh mục Site PDA" : "Tình trạng ngoại quan PDA";
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(dp(16), dp(6), dp(16), dp(12));

        Button add = actionButton("Thêm mới");
        add.setOnClickListener(v -> showCatalogForm(type, null));
        list.addView(add);

        for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) continue;
            LinearLayout row = card();
            TextView name = new TextView(this);
            name.setText(item.optString("name", ""));
            name.setTextColor(getColor(R.color.navy_900));
            name.setTextSize(14);
            name.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            row.addView(name);
            if ("CONDITION".equals(type)) {
                TextView severity = helperText("Nhóm xử lý: " + conditionLabel(item.optString("legacy_condition", "UNKNOWN")));
                addWithTopMargin(row, severity, 3);
            }
            LinearLayout actions = new LinearLayout(this);
            actions.setOrientation(LinearLayout.HORIZONTAL);
            Button edit = actionButton("Sửa");
            edit.setOnClickListener(v -> showCatalogForm(type, item));
            actions.addView(edit, new LinearLayout.LayoutParams(0, dp(44), 1f));
            Button delete = actionButton("Xoá");
            delete.setOnClickListener(v -> confirmDeleteCatalog(type, item));
            LinearLayout.LayoutParams del = new LinearLayout.LayoutParams(0, dp(44), 1f);
            del.setMarginStart(dp(6));
            actions.addView(delete, del);
            addWithTopMargin(row, actions, 8);
            addWithTopMargin(list, row, 8);
        }

        ScrollView scroll = new ScrollView(this);
        scroll.addView(list);
        new AlertDialog.Builder(this)
            .setTitle(title)
            .setView(scroll)
            .setNegativeButton("Đóng", null)
            .show();
    }

    private int conditionSeverityIndex(String value) {
        if ("MINOR_DAMAGE".equals(value)) return 1;
        if ("DAMAGED".equals(value)) return 2;
        return 0;
    }

    private void showCatalogForm(String type, JSONObject existing) {
        boolean editing = existing != null;
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(dp(20), dp(6), dp(20), 0);

        EditText name = new EditText(this);
        name.setHint("Tên hiển thị");
        name.setSingleLine(true);
        if (editing) name.setText(existing.optString("name", ""));
        form.addView(name);

        Spinner severity = null;
        if ("CONDITION".equals(type)) {
            severity = new Spinner(this);
            String[] labels = {"Tốt / sử dụng bình thường", "Lỗi nhẹ / vẫn khả dụng", "Hỏng / cần sửa"};
            severity.setAdapter(new ArrayAdapter<>(
                this, android.R.layout.simple_spinner_dropdown_item, labels));
            if (editing) severity.setSelection(conditionSeverityIndex(existing.optString("legacy_condition", "GOOD")));
            addWithTopMargin(form, severity, 8);

            TextView help = helperText("Nhóm xử lý quyết định quy tắc hệ thống; Hỏng / cần sửa sẽ chuyển PDA sang trạng thái Đang sửa khi trả.");
            addWithTopMargin(form, help, 6);
        }

        final Spinner finalSeverity = severity;
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle((editing ? "Sửa " : "Thêm ") + ("SITE".equals(type) ? "Site PDA" : "tình trạng PDA"))
            .setView(form)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Lưu", null)
            .create();

        dialog.setOnShowListener(ignored ->
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String itemName = name.getText().toString().trim();
                if (itemName.isEmpty()) {
                    Toast.makeText(this, "Nhập tên danh mục.", Toast.LENGTH_SHORT).show();
                    return;
                }
                String legacy = "";
                if ("CONDITION".equals(type)) {
                    int pos = finalSeverity == null ? 0 : finalSeverity.getSelectedItemPosition();
                    legacy = pos == 1 ? "MINOR_DAMAGE" : (pos == 2 ? "DAMAGED" : "GOOD");
                }
                JSONObject body = payload(
                    "action", editing ? "UPDATE" : "CREATE",
                    "catalog_type", type,
                    "name", itemName,
                    "legacy_condition", legacy,
                    "sort_order", editing ? existing.optInt("sort_order", 100) : 100
                );
                if (editing) {
                    try {
                        body.put("item_id", existing.optString("item_id", ""));
                        body.put("status", "ACTIVE");
                    } catch (Exception ignoredJson) {}
                }
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
                postCatalogAction(type, body,
                    editing ? "Đã cập nhật danh mục." : "Đã thêm danh mục.",
                    () -> {
                        dialog.dismiss();
                        loadCatalogs(false);
                        showCatalogManager(type);
                    },
                    () -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true)
                );
            })
        );
        dialog.show();
    }

    private void confirmDeleteCatalog(String type, JSONObject item) {
        new AlertDialog.Builder(this)
            .setTitle("Xoá danh mục")
            .setMessage("Ngừng sử dụng \"" + item.optString("name", "") + "\"? Dữ liệu lịch sử vẫn được giữ nguyên.")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Xoá", (dialog, which) -> postCatalogAction(
                type,
                payload(
                    "action", "DELETE",
                    "catalog_type", type,
                    "item_id", item.optString("item_id", "")
                ),
                "Đã ngừng sử dụng danh mục.",
                () -> {
                    loadCatalogs(false);
                    showCatalogManager(type);
                },
                () -> {}
            ))
            .show();
    }

    private void postCatalogAction(String type, JSONObject body, String successMessage, Runnable success, Runnable failure) {
        new Thread(() -> {
            try {
                apiRequest("POST", "/api/catalogs", body, true);
                runOnUiThread(() -> {
                    Toast.makeText(this, successMessage, Toast.LENGTH_SHORT).show();
                    success.run();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    Toast.makeText(
                        this,
                        error.getMessage() == null ? "Không thể cập nhật danh mục." : error.getMessage(),
                        Toast.LENGTH_LONG
                    ).show();
                    failure.run();
                });
            }
        }, "pda-mgmt-catalog-mutation").start();
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
        DiagnosticLog.event("LOGOUT", DiagnosticLog.object("role", sessionRole));
        String token = sessionToken;
        sessionToken = "";
        sessionRole = "";
        sessionDisplayName = "";
        cachedDevices = new JSONArray();
        cachedConditions = new JSONArray();
        cachedSites = new JSONArray();
        selectedOperationSerial = "";
        contentContainer = null;
        operationSerialInput = null;
        operationResultContainer = null;
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
        DiagnosticLog.event("UPDATE_CHECK_START", DiagnosticLog.object("silent", silent));
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
                    DiagnosticLog.event("UPDATE_CURRENT", DiagnosticLog.object(
                        "current_version_code", BuildConfig.VERSION_CODE,
                        "remote_version_code", info.versionCode
                    ));
                    updateGate = UpdateGate.CURRENT;
                    runOnUiThread(() -> {
                        updateCheckRunning = false;
                        applyUpdateUi(silent ? null : "Đang dùng bản Quản lý PDA Beta mới nhất.");
                    });
                    return;
                }

                DiagnosticLog.event("UPDATE_AVAILABLE", DiagnosticLog.object(
                    "current_version_code", BuildConfig.VERSION_CODE,
                    "remote_version_code", info.versionCode,
                    "tag", info.tag
                ));
                pendingUpdateInfo = info;
                updateGate = UpdateGate.AVAILABLE;
                runOnUiThread(() -> {
                    updateCheckRunning = false;
                    applyUpdateUi("Có bản cập nhật " + info.tag + ".");
                    showUpdateAvailable(info);
                });
            } catch (Exception error) {
                DiagnosticLog.event("UPDATE_CHECK_FAILED", DiagnosticLog.object(
                    "exception", error.getClass().getSimpleName(),
                    "message", error.getMessage() == null ? "" : error.getMessage()
                ));
                updateGate = UpdateGate.DEFERRED;
                runOnUiThread(() -> {
                    updateCheckRunning = false;
                    applyUpdateUi(silent ? null : "Chưa kiểm tra được cập nhật. Có thể tiếp tục đăng nhập.");
                });
            }
        }, "pda-mgmt-update-check").start();
    }

    private void applyUpdateUi(String message) {
        if (updateButton != null) {
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
        }
        if (message != null && !message.trim().isEmpty()) {
            setStatus(message, updateGate == UpdateGate.FAILED);
        } else if ((updateGate == UpdateGate.CURRENT || updateGate == UpdateGate.IDLE) && status != null) {
            status.setVisibility(View.GONE);
        }
    }

    private void showUpdateAvailable(UpdateInfo info) {
        new AlertDialog.Builder(this)
            .setTitle("Có bản cập nhật " + info.tag)
            .setMessage("Có thể cập nhật ngay. Bản cập nhật được xác minh checksum và chữ ký trước khi cài đặt.")
            .setNegativeButton("Để sau", null)
            .setPositiveButton("Cập nhật", (dialog, which) -> downloadAndInstallUpdate(info))
            .show();
    }

    private void downloadAndInstallUpdate(UpdateInfo info) {
        if (updateCheckRunning) return;
        DiagnosticLog.event("UPDATE_DOWNLOAD_START", DiagnosticLog.object(
            "tag", info.tag,
            "version_code", info.versionCode
        ));
        updateCheckRunning = true;
        updateGate = UpdateGate.CHECKING;
        applyUpdateUi("Đang tải và xác minh " + info.tag + "...");

        new Thread(() -> {
            try {
                File apk = downloadAndVerify(info);
                DiagnosticLog.event("UPDATE_DOWNLOAD_VERIFIED", DiagnosticLog.object(
                    "tag", info.tag,
                    "version_code", info.versionCode,
                    "apk_bytes", apk.length()
                ));
                runOnUiThread(() -> {
                    updateCheckRunning = false;
                    pendingUpdateInfo = null;
                    updateGate = UpdateGate.CURRENT;
                    applyUpdateUi("Đã xác minh " + info.tag + ". Đang mở trình cài đặt.");
                    requestInstall(apk);
                });
            } catch (Exception error) {
                DiagnosticLog.event("UPDATE_DOWNLOAD_FAILED", DiagnosticLog.object(
                    "tag", info.tag,
                    "exception", error.getClass().getSimpleName(),
                    "message", error.getMessage() == null ? "" : error.getMessage()
                ));
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
        if (status == null) {
            if (message != null && !message.trim().isEmpty()) {
                Toast.makeText(this, message, error ? Toast.LENGTH_LONG : Toast.LENGTH_SHORT).show();
            }
            return;
        }
        status.setText(message);
        status.setTextColor(getColor(error ? R.color.red_600 : R.color.text_secondary));
        status.setVisibility(View.VISIBLE);
    }
}
