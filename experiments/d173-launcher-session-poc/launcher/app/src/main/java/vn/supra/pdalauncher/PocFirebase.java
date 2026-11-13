package vn.supra.pdalauncher;

import android.content.Context;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/** Real Firebase SDK bound EXCLUSIVELY to an independently provisioned D173 test project. */
final class PocFirebase {
    private static volatile FirebaseApp testApp;

    static boolean configured() {
        return BuildConfig.TEST_FIREBASE_PROJECT_ID.matches("supra-d173-poc-[a-z0-9-]{3,45}")
            && !BuildConfig.TEST_FIREBASE_API_KEY.isEmpty()
            && !BuildConfig.TEST_FIREBASE_APP_ID.isEmpty();
    }

    static FirebaseApp app(Context context) {
        if (!configured()) throw new IllegalStateException("Chưa cấu hình Firebase kiểm thử riêng.");
        if (testApp == null) {
            synchronized (PocFirebase.class) {
                if (testApp == null) {
                    FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApplicationId(BuildConfig.TEST_FIREBASE_APP_ID)
                        .setApiKey(BuildConfig.TEST_FIREBASE_API_KEY)
                        .setProjectId(BuildConfig.TEST_FIREBASE_PROJECT_ID)
                        .build();
                    testApp = FirebaseApp.initializeApp(context.getApplicationContext(), options, "d173_poc");
                }
            }
        }
        return testApp;
    }

    static FirebaseAuth auth(Context context) {
        return FirebaseAuth.getInstance(app(context));
    }

    static FirebaseFirestore firestore(Context context) {
        return FirebaseFirestore.getInstance(app(context));
    }

    static JSONObject post(Context context, String action, JSONObject data, boolean authorized) throws Exception {
        String project = BuildConfig.TEST_FIREBASE_PROJECT_ID;
        if (!configured()) throw new IllegalStateException("Firebase test chưa được cấu hình.");
        if (!("open".equals(action) || "grant".equals(action) || "redeem".equals(action)
                || "logout".equals(action))) {
            throw new IllegalArgumentException("Unknown test operation");
        }
        // This URL is constructed from a strict D173-only test project ID, never Production.
        URL endpoint = new URL("https://asia-southeast1-" + project
                + ".cloudfunctions.net/d173LauncherPoc/" + action);
        HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(10000);
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        if (authorized) {
            if (auth(context).getCurrentUser() == null)
                throw new IllegalStateException("Chưa đăng nhập tài khoản test.");
            String token = Tasks.await(auth(context).getCurrentUser().getIdToken(true),
                    12, TimeUnit.SECONDS).getToken();
            if (token == null || token.isEmpty()) throw new IllegalStateException("Thiếu token Firebase.");
            conn.setRequestProperty("Authorization", "Bearer " + token);
        }
        try {
            byte[] bytes = data.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = conn.getOutputStream()) { output.write(bytes); }
            int status = conn.getResponseCode();
            InputStream input = status >= 200 && status < 300
                    ? conn.getInputStream() : conn.getErrorStream();
            String body = "";
            if (input != null) try (InputStream stream = input) {
                java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
                byte[] chunk = new byte[2048];
                int count;
                while ((count = stream.read(chunk)) != -1) {
                    if (buffer.size() + count > 32768)
                        throw new IllegalStateException("Phản hồi quá lớn.");
                    buffer.write(chunk, 0, count);
                }
                body = buffer.toString(StandardCharsets.UTF_8.name());
            }
            if (status < 200 || status >= 300)
                throw new IllegalStateException("Firebase PoC HTTP " + status);
            return new JSONObject(body);
        } finally {
            conn.disconnect();
        }
    }

    private PocFirebase() {}
}
