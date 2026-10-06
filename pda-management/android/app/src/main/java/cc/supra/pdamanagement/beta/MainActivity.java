package cc.supra.pdamanagement.beta;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;

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
            if (!user.matches("[a-z0-9._-]{1,64}") || pass.isBlank()) {
                setStatus("Tên đăng nhập hoặc mật khẩu không hợp lệ.", true);
                return;
            }
            setStatus("Nền D164 đã sẵn sàng. Xác thực Root/Điều phối đang được nối ở bước tiếp theo.", false);
        });
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
        if (message != null && !message.isBlank()) {
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
            text = stream == null ? "" : new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
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
            java.nio.file.Files.copy(temp.toPath(), target.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
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
                if (location == null || location.isBlank()) throw new IllegalStateException("Redirect thiếu Location.");
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
        try (java.io.InputStream stream = connection.getInputStream()) {
            return new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
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
        if (expected.isBlank()) {
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
        if (expectedSigner.isBlank() || !signerDigests(archive).contains(expectedSigner)) {
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
            for (byte b : hashed) hex.append(String.format("%02x", b));
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
        for (byte b : digest.digest()) hex.append(String.format("%02x", b));
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
