package cd.cc.supra.diagnostic;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Typeface;
import android.text.InputType;
import android.view.View;
import android.widget.*;
import org.json.JSONObject;
import java.io.OutputStream;
import java.util.concurrent.*;
public final class MainActivity extends Activity {
  private EditText api,email,password,session,node,label;
  private TextView status,result;
  private Button login,run,export;
  private JSONObject report;
  private String token="";
  private final ExecutorService queue=Executors.newSingleThreadExecutor();
  private static final int SAVE=11;
  @Override public void onCreate(Bundle state){super.onCreate(state);
    ScrollView scroll=new ScrollView(this);LinearLayout root=new LinearLayout(this);root.setPadding(24,22,24,22);root.setOrientation(1);scroll.addView(root);
    TextView heading=text(root,"SUPRA — PDA Network Test V4.1");
    heading.setTypeface(null,Typeface.BOLD);heading.setTextSize(20);
    text(root,"App kiểm thử riêng. Không đụng tới nghiệp vụ WMS, Picklist và Agent chính.");
    api=field(root,"Firebase Web API Key","",true);
    email=field(root,"Email Firebase","",false);password=field(root,"Mật khẩu Firebase (không lưu)","",true);
    login=button(root,"Đăng nhập Firebase",()->login());
    status=text(root,"Chưa đăng nhập. Có thể chạy kiểm tra mạng cơ bản.");
    session=field(root,"Mã đợt kiểm tra (nhập giống EXE)","D169_DIAG_01",false);
    node=field(root,"Tên thiết bị","PDA_A",false);label=field(root,"Nhãn mạng","NORMAL",false);
    run=button(root,"Bắt đầu kiểm tra",()->diagnose());
    export=button(root,"Xuất file JSON",()->export());export.setEnabled(false);
    result=text(root,"Chưa có báo cáo.");result.setTextIsSelectable(true);setContentView(scroll);
  }
  private TextView text(LinearLayout root,String message){
    TextView t=new TextView(this);t.setText(message);t.setTextSize(15);t.setPadding(0,9,0,9);root.addView(t);return t;
  }
  private EditText field(LinearLayout root,String title,String val,boolean secret){
    text(root,title);EditText t=new EditText(this);t.setSingleLine(true);t.setText(val);
    if(secret)t.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
    root.addView(t);return t;
  }
  private Button button(LinearLayout root,String name,Runnable action){
    Button b=new Button(this);b.setText(name);b.setOnClickListener(v->action.run());root.addView(b);return b;
  }
  private String read(EditText t){return t.getText().toString().trim();}
  private void info(String s){runOnUiThread(()->status.setText(s));}
  private boolean valid(String s){return s.length()>=3&&s.length()<=48&&s.matches("[A-Za-z0-9_-]+");}
  private void login(){
    final String key=read(api),user=read(email),secret=read(password);password.setText("");
    login.setEnabled(false);info("Đang xác thực...");
    queue.execute(()->{try{
      String id=FirebaseLogin.authenticate(key,user,secret);
      token=id;info("Đăng nhập Firebase thành công. Chưa xác minh quyền nghiệp vụ.");
    }catch(Exception ex){info("Đăng nhập thất bại: "+safe(ex));}
    finally{runOnUiThread(()->login.setEnabled(true));}});
  }
  private String safe(Exception e){String m=e.getMessage();if(m!=null&&(m.startsWith("AUTH_HTTP_")||m.startsWith("AUTH_MISSING")||m.startsWith("MISSING_")))return m;return e.getClass().getSimpleName();}
  private void diagnose(){
    final String s=read(session),n=read(node),l=read(label);
    if(!valid(s)||!valid(n)||!valid(l)){info("Kiểm tra lại mã đợt, tên thiết bị, nhãn mạng.");return;}
    run.setEnabled(false);info("Đang thu thập trạng thái mạng...");
    queue.execute(()->{try{
      JSONObject data=NetworkChecks.run(this,token,s,n,l);report=data;
      String summary=data.toString(2);
      runOnUiThread(()->{result.setText(summary);export.setEnabled(true);status.setText("Đã kiểm tra. Hãy xuất JSON để đối chiếu với EXE.");});
    }catch(Exception ex){info("Lỗi kiểm tra: "+safe(ex));}
    finally{runOnUiThread(()->run.setEnabled(true));}});
  }
  private void export(){
    if(report==null)return;
    Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");
    i.putExtra(Intent.EXTRA_TITLE,"SUPRA_"+read(node)+"_"+read(label)+"_V4.json");startActivityForResult(i,SAVE);
  }
  @Override protected void onActivityResult(int request,int code,Intent intent){
    super.onActivityResult(request,code,intent);
    if(request==SAVE&&code==RESULT_OK&&intent!=null&&report!=null){
      try(OutputStream out=getContentResolver().openOutputStream(intent.getData())){
        out.write(report.toString(2).getBytes("UTF-8"));status.setText("Đã lưu JSON.");
      }catch(Exception e){status.setText("Lưu JSON thất bại.");}
    }
  }
  @Override protected void onDestroy(){queue.shutdownNow();token="";super.onDestroy();}
}
