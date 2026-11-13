package vn.supra.identitytest;

import android.content.Context;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Existing Inventory Firebase/Worker only; test account is pinned before any login. */
final class PocFirebase {
    static final String WORKER = "https://inventory.supra.cc.cd";
    private static volatile FirebaseApp instance;

    static boolean configured() {
        return "supra-inventory-beta".equals(BuildConfig.TEST_FIREBASE_PROJECT_ID)
            && "1:572322098890:android:3e483937876cbcc0400e33".equals(BuildConfig.TEST_FIREBASE_APP_ID)
            && !BuildConfig.TEST_FIREBASE_API_KEY.isEmpty()
            && BuildConfig.TEST_QA_USERNAME.matches("[a-z0-9._-]{1,64}");
    }

    static FirebaseAuth auth(Context context) {
        if (!configured()) throw new IllegalStateException("Thiếu cấu hình Firebase/tài khoản QA.");
        if (instance == null) {
            synchronized (PocFirebase.class) {
                if (instance == null) {
                    FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApplicationId(BuildConfig.TEST_FIREBASE_APP_ID)
                        .setApiKey(BuildConfig.TEST_FIREBASE_API_KEY)
                        .setProjectId(BuildConfig.TEST_FIREBASE_PROJECT_ID).build();
                    instance = FirebaseApp.initializeApp(context.getApplicationContext(), options, "d173_sso_existing_project");
                    if (instance == null) instance = FirebaseApp.getInstance("d173_sso_existing_project");
                }
            }
        }
        return FirebaseAuth.getInstance(instance);
    }

    static JSONObject post(String path, JSONObject body, String bearer) throws Exception {
        if (!configured() || !("/api/auth/login".equals(path)
                || "/api/auth/logout".equals(path))) throw new IllegalArgumentException("INVALID_POC_PATH");
        return request("POST", path, body, bearer);
    }

    static JSONObject me(String bearer) throws Exception {
        return request("GET", "/api/auth/me", null, bearer);
    }

    private static JSONObject request(String method, String path, JSONObject body, String bearer) throws Exception {
        if (!configured()) throw new IllegalStateException("D173 QA chưa sẵn sàng.");
        HttpURLConnection conn = (HttpURLConnection) new URL(WORKER + path).openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(10000);
        conn.setRequestMethod(method);
        conn.setRequestProperty("Accept", "application/json");
        if (bearer != null && !bearer.isEmpty())
            conn.setRequestProperty("Authorization", "Bearer " + bearer);
        if (body != null) {
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);
        }
        try {
            if (body != null) {
                byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = conn.getOutputStream()) { output.write(data); }
            }
            int status = conn.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                ? conn.getInputStream() : conn.getErrorStream();
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            if (stream != null) try (InputStream input = stream) {
                byte[] chunk = new byte[2048];
                int n;
                while ((n = input.read(chunk)) > 0) {
                    if (buffer.size() + n > 16384) throw new IllegalStateException("RESPONSE_TOO_LARGE");
                    buffer.write(chunk, 0, n);
                }
            }
            JSONObject result = buffer.size() > 0
                ? new JSONObject(buffer.toString(StandardCharsets.UTF_8.name()))
                : new JSONObject();
            if (status == 409 && "SESSION_ACTIVE_OTHER_DEVICE".equals(result.optString("error")))
                throw new IllegalStateException("Tài khoản QA đang có phiên PDA khác. Không thay thế phiên.");
            if (status < 200 || status >= 300)
                throw new IllegalStateException("Xác thực QA thất bại (HTTP " + status + ").");
            return result;
        } finally { conn.disconnect(); }
    }

    private PocFirebase() {}
}
