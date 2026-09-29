package cd.cc.supra.inventory.dnddiag;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class OverlayProbeService extends Service {
    private static final String CHANNEL_ID = "d151_overlay_probe";
    private static final int NOTIFICATION_ID = 15102;
    private static final long DISPLAY_MS = 15_000L;
    private static final String PREFS = "d151_probe_v2";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private View overlay;
    private final Runnable timeout = this::stopSelf;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = getSystemService(WindowManager.class);
        ensureChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putBoolean("overlay_probe_attempted", true)
            .apply();

        if (!Settings.canDrawOverlays(this)) {
            fail("OVERLAY_PERMISSION_NOT_GRANTED");
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            showOverlay();
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putBoolean("overlay_probe_success", true)
                .putString("overlay_probe_error", "")
                .apply();
            handler.removeCallbacks(timeout);
            handler.postDelayed(timeout, DISPLAY_MS);
        } catch (Exception error) {
            fail(error.getClass().getSimpleName() + ":" + String.valueOf(error.getMessage()));
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void fail(String message) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putBoolean("overlay_probe_success", false)
            .putString("overlay_probe_error", message == null ? "UNKNOWN" : message)
            .apply();
    }

    private void ensureChannel() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "D151 Overlay Probe",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Kênh nền tạm thời cho phép thử Overlay 15 giây");
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            15102,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("MT90 DND Diagnostic")
            .setContentText("Đang chạy Overlay probe 15 giây")
            .setContentIntent(pending)
            .setOngoing(true)
            .build();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void showOverlay() {
        removeOverlay();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(24), dp(24), dp(24), dp(24));
        root.setBackgroundColor(Color.argb(225, 8, 18, 35));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(28), dp(26), dp(28), dp(26));
        card.setBackgroundColor(Color.WHITE);

        TextView title = new TextView(this);
        title.setText("OVERLAY TEST ĐANG HOẠT ĐỘNG");
        title.setTextSize(22f);
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setTypeface(title.getTypeface(), Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        card.addView(title, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        TextView body = new TextView(this);
        body.setText("Nếu anh đang thấy khung này trên màn hình chính hoặc trên ứng dụng khác, TYPE_APPLICATION_OVERLAY hoạt động độc lập với quyền DND. Khung tự đóng sau 15 giây.");
        body.setTextSize(16f);
        body.setTextColor(Color.rgb(51, 65, 85));
        body.setGravity(Gravity.CENTER);
        body.setPadding(0, dp(16), 0, dp(18));
        card.addView(body, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        Button close = new Button(this);
        close.setText("ĐÓNG TEST");
        close.setOnClickListener(v -> stopSelf());
        card.addView(close, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(52)
        ));

        root.addView(card, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.CENTER;
        windowManager.addView(root, params);
        overlay = root;
    }

    private void removeOverlay() {
        if (overlay == null) return;
        try {
            windowManager.removeView(overlay);
        } catch (Exception ignored) {
        }
        overlay = null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(timeout);
        removeOverlay();
        try {
            stopForeground(true);
        } catch (Exception ignored) {
        }
        super.onDestroy();
    }
}
