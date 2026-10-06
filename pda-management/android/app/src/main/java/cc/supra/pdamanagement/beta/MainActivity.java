package cc.supra.pdamanagement.beta;

import android.app.Activity;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private TextView status;

    private static int dp(Activity activity, int value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(this, 20), dp(this, 28), dp(this, 20), dp(this, 20));
        root.setGravity(Gravity.TOP);

        TextView title = new TextView(this);
        title.setText("QUẢN LÝ PDA");
        title.setTextSize(26);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("SUPRA · D164 Beta");
        subtitle.setTextSize(14);
        subtitle.setPadding(0, dp(this, 4), 0, dp(this, 22));
        root.addView(subtitle);

        EditText username = new EditText(this);
        username.setHint("Tài khoản");
        username.setSingleLine(true);
        root.addView(username, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        EditText password = new EditText(this);
        password.setHint("Mật khẩu");
        password.setSingleLine(true);
        password.setInputType(0x00000081);
        root.addView(password, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button login = new Button(this);
        login.setText("Đăng nhập");
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(this, 14);
        root.addView(login, lp);

        status = new TextView(this);
        status.setText("D164 foundation đã tách độc lập. RBAC sẽ được nối ở bước tiếp theo.");
        status.setPadding(0, dp(this, 18), 0, 0);
        root.addView(status);

        login.setOnClickListener(v ->
            status.setText("API: " + BuildConfig.API_BASE_URL + " · xác thực chưa kích hoạt."));

        setContentView(root);
    }
}
