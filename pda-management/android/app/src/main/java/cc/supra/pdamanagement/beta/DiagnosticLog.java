package cc.supra.pdamanagement.beta;

import android.app.ActivityManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

final class DiagnosticLog {
    interface UploadCallback {
        void onComplete(boolean success, String message);
    }

    private static final Object LOCK = new Object();
    private static final long MAX_FILE_BYTES = 320 * 1024L;
    private static final long TRIM_TO_BYTES = 220 * 1024L;
    private static final long AUTO_UPLOAD_GUARD_MS = 30L * 60L * 1000L;
    private static final Pattern SENSITIVE_KEY = Pattern.compile(
        "authorization|bearer|token|password|secret|private|credential|api.?key|refresh|cookie|signing|keystore|session",
        Pattern.CASE_INSENSITIVE
    );

    private static Context app;
    private static File file;
    private static final AtomicBoolean uploadRunning = new AtomicBoolean(false);
    private static boolean initialized = false;

    private DiagnosticLog() {}

    static void init(Context context) {
        synchronized (LOCK) {
            if (initialized) return;
            app = context.getApplicationContext();
            file = new File(app.getFilesDir(), "pda_management_diagnostic.jsonl");
            initialized = true;
            installCrashHandler();
        }
        event("APP_START", object(
            "version_name", BuildConfig.VERSION_NAME,
            "version_code", BuildConfig.VERSION_CODE,
            "sdk_int", Build.VERSION.SDK_INT
        ));
        maybeUploadAfterCrash();
    }

    static JSONObject object(Object... pairs) {
        JSONObject result = new JSONObject();
        try {
            for (int i = 0; i + 1 < pairs.length; i += 2) {
                String key = String.valueOf(pairs[i]);
                Object value = pairs[i + 1];
                result.put(key, SENSITIVE_KEY.matcher(key).find() ? "[REDACTED]" : sanitize(value, 0));
            }
        } catch (Exception ignored) {
        }
        return result;
    }

    static void event(String type, JSONObject details) {
        if (!initialized || file == null) return;
        JSONObject line = new JSONObject();
        try {
            line.put("ts", System.currentTimeMillis());
            line.put("type", safeText(type, 80));
            line.put("details", sanitize(details == null ? new JSONObject() : details, 0));
        } catch (Exception ignored) {
            return;
        }
        appendLine(line.toString());
    }

    static void network(String method, String path, int status, long durationMs, String errorId, String errorCode) {
        event("NETWORK", object(
            "method", safeText(method, 12),
            "path", canonicalPath(path),
            "status", status,
            "duration_ms", Math.max(0L, durationMs),
            "error_id", safeText(errorId, 80),
            "error_code", safeText(errorCode, 80)
        ));
        if (status >= 500) autoUpload("pda_management_http_5xx");
    }

    static void networkException(String method, String path, long durationMs, Throwable error) {
        event("NETWORK_EXCEPTION", object(
            "method", safeText(method, 12),
            "path", canonicalPath(path),
            "duration_ms", Math.max(0L, durationMs),
            "exception", error == null ? "unknown" : error.getClass().getSimpleName(),
            "message", safeText(error == null ? "" : error.getMessage(), 500)
        ));
    }

    static void action(String action, String serial, String outcome) {
        event("BUSINESS_ACTION", object(
            "action", safeText(action, 80),
            "serial", safeText(serial, 140),
            "outcome", safeText(outcome, 120)
        ));
    }

    static void manualUpload(UploadCallback callback) {
        upload("pda_management_manual", callback, false);
    }

    static void autoUpload(String reason) {
        if (!initialized || app == null) return;
        SharedPreferences prefs = app.getSharedPreferences("pda_mgmt_diag", Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long last = prefs.getLong("last_auto_upload_ms", 0L);
        if (now - last < AUTO_UPLOAD_GUARD_MS) return;
        prefs.edit().putLong("last_auto_upload_ms", now).apply();
        upload(reason, null, true);
    }

    private static void maybeUploadAfterCrash() {
        if (!initialized || file == null || !file.exists()) return;
        boolean crash = false;
        synchronized (LOCK) {
            try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
                String line;
                int scanned = 0;
                while ((line = reader.readLine()) != null && scanned < 1200) {
                    if (line.contains("\"type\":\"UNCAUGHT_CRASH\"")) {
                        crash = true;
                        break;
                    }
                    scanned++;
                }
            } catch (Exception ignored) {
            }
        }
        if (crash) autoUpload("pda_management_crash_recovery");
    }

    private static void upload(String reason, UploadCallback callback, boolean automatic) {
        if (!initialized || app == null) {
            if (callback != null) callback.onComplete(false, "Log chưa sẵn sàng.");
            return;
        }
        if (!uploadRunning.compareAndSet(false, true)) {
            if (callback != null) callback.onComplete(false, "Đang gửi log.");
            return;
        }

        new Thread(() -> {
            try {
                JSONObject bundle = buildBundle(reason);
                HttpURLConnection connection = (HttpURLConnection) new URL(BuildConfig.DIAGNOSTIC_UPLOAD_URL).openConnection();
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(45_000);
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("X-Supra-Pda-Management-Log-Version", "1");

                byte[] body = bundle.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                connection.getOutputStream().write(body);
                int status = connection.getResponseCode();
                String responseText = readResponse(connection, status);
                if (status < 200 || status > 299) {
                    throw new IllegalStateException("HTTP " + status + (responseText.isEmpty() ? "" : " · " + safeText(responseText, 240)));
                }
                clearAfterSuccessfulUpload(reason, automatic);
                if (callback != null) callback.onComplete(true, "Đã gửi log chẩn đoán.");
            } catch (Exception error) {
                event("LOG_UPLOAD_FAILED", object(
                    "reason", reason,
                    "exception", error.getClass().getSimpleName(),
                    "message", safeText(error.getMessage(), 400)
                ));
                if (callback != null) callback.onComplete(false,
                    "Không gửi được log: " + safeText(error.getMessage(), 180));
            } finally {
                uploadRunning.set(false);
            }
        }, "pda-mgmt-log-upload").start();
    }

    private static JSONObject buildBundle(String reason) throws Exception {
        JSONArray events = readEvents();
        JSONObject runtime = runtimeSnapshot();
        JSONObject summary = object(
            "event_count", events.length(),
            "local_file_bytes", file != null && file.exists() ? file.length() : 0L,
            "uptime_ms", SystemClock.elapsedRealtime(),
            "automatic_upload", !reason.contains("manual")
        );
        String deviceHash = deviceHash();
        String bundleId = UUID.randomUUID().toString().replace("-", "") +
            UUID.randomUUID().toString().replace("-", "");

        JSONObject result = new JSONObject();
        result.put("schema", "supra-pda-management-log-v1");
        result.put("generated_at", isoNow());
        result.put("severity", reason.contains("crash") || reason.contains("5xx") ? "ERROR" : "INFO");
        result.put("reason", reason);
        result.put("bundle_id", bundleId.substring(0, 64));
        result.put("identity", object(
            "package", BuildConfig.APPLICATION_ID,
            "device_id_hash", deviceHash
        ));
        result.put("build", object(
            "manufacturer", Build.MANUFACTURER,
            "brand", Build.BRAND,
            "model", Build.MODEL,
            "sdk_int", Build.VERSION.SDK_INT,
            "android_version", Build.VERSION.RELEASE,
            "version_name", BuildConfig.VERSION_NAME,
            "version_code", BuildConfig.VERSION_CODE
        ));
        result.put("payload", object(
            "runtime", runtime,
            "summary", summary,
            "events", events,
            "privacy", object(
                "passwords", "NEVER_COLLECTED",
                "auth_tokens", "NEVER_COLLECTED",
                "cookies", "NEVER_COLLECTED",
                "private_keys", "NEVER_COLLECTED",
                "raw_android_id", "NEVER_COLLECTED",
                "request_bodies", "NEVER_COLLECTED"
            )
        ));
        return result;
    }

    private static JSONObject runtimeSnapshot() {
        JSONObject result = new JSONObject();
        try {
            Runtime runtime = Runtime.getRuntime();
            long used = runtime.totalMemory() - runtime.freeMemory();
            result.put("memory_used_bytes", used);
            result.put("memory_max_bytes", runtime.maxMemory());

            File filesDir = app.getFilesDir();
            result.put("storage_free_bytes", filesDir.getFreeSpace());
            result.put("storage_total_bytes", filesDir.getTotalSpace());

            BatteryManager battery = (BatteryManager) app.getSystemService(Context.BATTERY_SERVICE);
            if (battery != null) {
                result.put("battery_percent", battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY));
                result.put("battery_charging", battery.isCharging());
            }

            ConnectivityManager connectivity = (ConnectivityManager) app.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (connectivity != null) {
                Network network = connectivity.getActiveNetwork();
                NetworkCapabilities capabilities = network == null ? null : connectivity.getNetworkCapabilities(network);
                result.put("network_connected", capabilities != null);
                result.put("network_wifi", capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI));
                result.put("network_cellular", capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR));
                result.put("network_ethernet", capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
            }

            ActivityManager manager = (ActivityManager) app.getSystemService(Context.ACTIVITY_SERVICE);
            if (manager != null) {
                ActivityManager.MemoryInfo memoryInfo = new ActivityManager.MemoryInfo();
                manager.getMemoryInfo(memoryInfo);
                result.put("system_avail_memory_bytes", memoryInfo.availMem);
                result.put("system_low_memory", memoryInfo.lowMemory);
            }

            result.put("timezone", TimeZone.getDefault().getID());
            result.put("locale", Locale.getDefault().toLanguageTag());
        } catch (Exception error) {
            try {
                result.put("snapshot_error", safeText(error.getMessage(), 300));
            } catch (Exception ignored) {
            }
        }
        return result;
    }

    private static JSONArray readEvents() {
        JSONArray result = new JSONArray();
        if (file == null || !file.exists()) return result;
        synchronized (LOCK) {
            try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.trim().isEmpty()) continue;
                    try {
                        result.put(new JSONObject(line));
                        if (result.length() > 800) result.remove(0);
                    } catch (Exception ignored) {
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return result;
    }

    private static void appendLine(String line) {
        synchronized (LOCK) {
            try {
                trimIfNeeded();
                try (FileWriter writer = new FileWriter(file, true)) {
                    writer.write(line);
                    writer.write("\n");
                }
            } catch (Exception ignored) {
            }
        }
    }

    private static void trimIfNeeded() {
        if (file == null || !file.exists() || file.length() <= MAX_FILE_BYTES) return;
        try {
            java.io.RandomAccessFile raf = new java.io.RandomAccessFile(file, "r");
            long start = Math.max(0L, raf.length() - TRIM_TO_BYTES);
            raf.seek(start);
            if (start > 0) raf.readLine();
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = raf.read(buffer)) > 0) output.write(buffer, 0, read);
            raf.close();
            try (java.io.FileOutputStream stream = new java.io.FileOutputStream(file, false)) {
                stream.write(output.toByteArray());
            }
        } catch (Exception ignored) {
        }
    }

    private static void clearAfterSuccessfulUpload(String reason, boolean automatic) {
        synchronized (LOCK) {
            try {
                if (file != null) new FileWriter(file, false).close();
            } catch (Exception ignored) {
            }
        }
        event("LOG_UPLOAD_SUCCESS", object("reason", reason, "automatic", automatic));
    }

    private static void installCrashHandler() {
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                StringBuilder stack = new StringBuilder();
                if (error != null) {
                    StackTraceElement[] elements = error.getStackTrace();
                    for (int i = 0; i < Math.min(elements.length, 60); i++) {
                        stack.append(elements[i].toString()).append("\n");
                    }
                }
                event("UNCAUGHT_CRASH", object(
                    "thread", thread == null ? "" : thread.getName(),
                    "exception", error == null ? "unknown" : error.getClass().getName(),
                    "message", safeText(error == null ? "" : error.getMessage(), 800),
                    "stack", safeText(stack.toString(), 8000)
                ));
            } catch (Exception ignored) {
            }
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }

    private static String canonicalPath(String path) {
        String next = path == null ? "" : path;
        next = next.replaceAll("/api/employees/[^/?]+", "/api/employees/:employee");
        next = next.replaceAll("/api/devices/[^/?]+/(borrow|return|status|history)", "/api/devices/:serial/$1");
        int q = next.indexOf('?');
        if (q >= 0) next = next.substring(0, q);
        return safeText(next, 240);
    }

    private static String deviceHash() throws Exception {
        String raw = Settings.Secure.getString(app.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (raw == null || raw.trim().isEmpty()) {
            SharedPreferences prefs = app.getSharedPreferences("pda_mgmt_diag", Context.MODE_PRIVATE);
            raw = prefs.getString("fallback_device_id", "");
            if (raw == null || raw.isEmpty()) {
                raw = UUID.randomUUID().toString();
                prefs.edit().putString("fallback_device_id", raw).apply();
            }
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashed = digest.digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte value : hashed) hex.append(String.format(Locale.US, "%02x", value & 0xff));
        return hex.toString();
    }

    private static String readResponse(HttpURLConnection connection, int status) {
        try {
            java.io.InputStream input = status >= 200 && status <= 299
                ? connection.getInputStream() : connection.getErrorStream();
            if (input == null) return "";
            try (java.io.InputStream stream = input;
                 java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                int read;
                while ((read = stream.read(buffer)) > 0 && output.size() < 8192) {
                    output.write(buffer, 0, read);
                }
                return output.toString("UTF-8");
            }
        } catch (Exception ignored) {
            return "";
        }
    }

    private static Object sanitize(Object value, int depth) {
        if (depth > 8) return "[TRUNCATED_DEPTH]";
        if (value == null || value == JSONObject.NULL || value instanceof Boolean || value instanceof Number) return value;
        if (value instanceof String) return safeText(value, 4000);
        if (value instanceof JSONArray) {
            JSONArray input = (JSONArray) value;
            JSONArray output = new JSONArray();
            for (int i = Math.max(0, input.length() - 800); i < input.length(); i++) {
                output.put(sanitize(input.opt(i), depth + 1));
            }
            return output;
        }
        if (value instanceof JSONObject) {
            JSONObject input = (JSONObject) value;
            JSONObject output = new JSONObject();
            JSONArray names = input.names();
            if (names == null) return output;
            for (int i = 0; i < Math.min(names.length(), 180); i++) {
                String key = names.optString(i, "");
                try {
                    output.put(key, SENSITIVE_KEY.matcher(key).find()
                        ? "[REDACTED]"
                        : sanitize(input.opt(key), depth + 1));
                } catch (Exception ignored) {
                }
            }
            return output;
        }
        return safeText(String.valueOf(value), 4000);
    }

    private static String safeText(Object value, int max) {
        String text = String.valueOf(value == null ? "" : value);
        text = text.replaceAll("-----BEGIN [^-]*PRIVATE KEY-----[\\s\\S]*?-----END [^-]*PRIVATE KEY-----", "[REDACTED_PRIVATE_KEY]");
        text = text.replaceAll("(?i)Bearer\\s+[A-Za-z0-9._~+/=-]{12,}", "Bearer [REDACTED]");
        text = text.replaceAll("eyJ[A-Za-z0-9_-]{12,}\\.[A-Za-z0-9_-]{12,}\\.[A-Za-z0-9_-]{8,}", "[REDACTED_JWT]");
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String isoNow() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }
}
