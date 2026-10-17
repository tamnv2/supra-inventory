package cd.cc.supra.diagnostic;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.*;
import java.util.concurrent.Executors;
import java.net.InetAddress;
import org.json.*;
public final class MainActivity extends Activity {
  private TextView display;
  private final java.util.concurrent.ExecutorService worker=Executors.newSingleThreadExecutor();
  public void onCreate(Bundle b){super.onCreate(b);
    LinearLayout root=new LinearLayout(this);root.setOrientation(1);
    TextView intro=new TextView(this);intro.setText("SUPRA — PDA Network Test V4\nBản kiểm thử độc lập, không tác động app chính.");root.addView(intro);
    Button run=new Button(this);run.setText("Kiểm tra DNS");root.addView(run);
    display=new TextView(this);root.addView(display);setContentView(root);
    run.setOnClickListener(v->{run.setEnabled(false);worker.execute(()->{
      String status;
      try {int count=InetAddress.getAllByName("firestore.googleapis.com").length;status="DNS Firestore: "+count+" addresses";}
      catch(Exception e){status="DNS error: "+e.getClass().getSimpleName();}
      String result=status;runOnUiThread(()->{display.setText(result);run.setEnabled(true);});
    });});
  }
  protected void onDestroy(){worker.shutdownNow();super.onDestroy();}
}
