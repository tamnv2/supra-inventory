package com.supra.m2lab.pda;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.widget.*;
import android.text.InputType;
import android.graphics.Typeface;
import android.view.Gravity;
import org.json.JSONObject;
import okhttp3.*;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    // Fixed emulator gateway / adb reverse only. No credentials, Firebase, OTA or live host.
    private static final String HOST="10.0.2.2:9897";
    private final OkHttpClient http=new OkHttpClient.Builder().build();
    private final ExecutorService bg=Executors.newSingleThreadExecutor();
    private WebSocket socket;
    private String actor="p1";
    private String mode="WS";
    private TextView output,status;
    private Spinner actorPicker, modePicker;
    private EditText sku,batchId,version,eventId;
    private LinearLayout area;
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.rgb(17,38,68));
        ScrollView scroll=new ScrollView(this);
        area=new LinearLayout(this);
        area.setOrientation(LinearLayout.VERTICAL);
        area.setPadding(20,18,20,24);
        area.setBackgroundColor(Color.rgb(243,247,251));
        scroll.addView(area);
        setContentView(scroll);
        text("SUPRA · D173 M2",22,true);
        TextView label=text("LAB PDA — DỮ LIỆU GIẢ LẬP · KHÔNG PRODUCTION",12,true);
        label.setTextColor(Color.rgb(160,65,0));
        status=text("Chưa kết nối",13,false);
        actorPicker=spinner(new String[]{"Picker 01","Picker 02","Reporter"},new String[]{"p1","p2","r1"},true);
        modePicker=spinner(new String[]{"M2 WebSocket","HTTP đối chứng"},new String[]{"WS","HTTP"},false);
        sku=input("SKU-001");
        batchId=input("Mã batch, ví dụ 1");
        batchId.setInputType(InputType.TYPE_CLASS_NUMBER);
        version=input("Version, ví dụ 1");
        version.setInputType(InputType.TYPE_CLASS_NUMBER);
        eventId=input("Mã event ACK");
        eventId.setInputType(InputType.TYPE_CLASS_NUMBER);
        button("KẾT NỐI",()->connect());
        button("BÁO HẾT HÀNG",()->send("REPORT",new JSONObject().put("sku",sku.getText().toString())));
        button("THU HỒI (60 GIÂY)",()->send("WITHDRAW",new JSONObject().put("batch_id",number(batchId))));
        button("ĐÃ XEM KẾT QUẢ",()->send("ACK",new JSONObject().put("batch_id",number(batchId)).put("event_id",number(eventId))));
        button("REPORTER · ĐÃ CÓ HÀNG",()->resolve("RESOLVE","HAS_STOCK"));
        button("REPORTER · CHO PHÉP SKIP",()->resolve("RESOLVE","SKIP_ALLOWED"));
        button("REPORTER · SỬA SKIP",()->resolve("CORRECT","HAS_STOCK"));
        button("LẤY TRẠNG THÁI",()->send("SNAPSHOT",new JSONObject()));
        button("XEM USAGE GIẢ LẬP",()->send("METERS",new JSONObject()));
        output=text("Sẵn sàng. Chỉ kết nối local 10.0.2.2:9897.",13,false);
        output.setTextIsSelectable(true);
        connect();
    }
    private void resolve(String op,String result) {
        try {send(op,new JSONObject().put("batch_id",number(batchId)).put("expected_version",number(version)).put("resolution",result));}
        catch(Exception e){notice("JSON "+e.getClass().getSimpleName());}
    }
    private int number(EditText e) {try{return Integer.parseInt(e.getText().toString());}catch(Exception err){return 0;}}
    private TextView text(String s,int size,boolean bold){
        TextView t=new TextView(this); t.setText(s);t.setTextSize(size);t.setTextColor(Color.rgb(23,40,61));
        if(bold)t.setTypeface(null,Typeface.BOLD);
        t.setPadding(3,10,3,10);area.addView(t);return t;
    }
    private EditText input(String hint){EditText e=new EditText(this);e.setHint(hint);e.setSingleLine(true);e.setTextSize(14);area.addView(e);return e;}
    private Spinner spinner(String[] labels,String[] values,boolean isActor){
        Spinner s=new Spinner(this);ArrayAdapter<String> a=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,labels);s.setAdapter(a);area.addView(s);
        s.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){
          public void onNothingSelected(android.widget.AdapterView<?> parent){}
          public void onItemSelected(android.widget.AdapterView<?> parent,View v,int position,long id){
            if(isActor)actor=values[position];else mode=values[position];connect();
          }
        });return s;
    }
    private interface Action {void run() throws Exception;}
    private void button(String title,Action work) {
        Button b=new Button(this);b.setText(title);b.setTextSize(13);area.addView(b);
        b.setOnClickListener(v->{try{work.run();}catch(Exception e){notice("Lỗi: "+e.getClass().getSimpleName());}});
    }
    private void notice(String s){runOnUiThread(()->{if(output!=null)output.setText(s+"\n\n"+output.getText());});}
    private void connect(){
      if(socket!=null){socket.close(1000,"role-switch");socket=null;}
      if(status==null)return;
      status.setText("Vai trò "+actor+" · "+mode+" · máy chủ GIẢ LẬP");
      if(!mode.equals("WS"))return;
      Request request=new Request.Builder().url("ws://"+HOST+"/socket?uid="+actor+"&gen=1").build();
      socket=http.newWebSocket(request,new WebSocketListener(){
        @Override public void onOpen(WebSocket ws,Response response){notice("WebSocket local đã kết nối");}
        @Override public void onMessage(WebSocket ws,String msg){notice("WS: "+msg);}
        @Override public void onFailure(WebSocket ws,Throwable e,Response response){notice("WS lỗi: "+e.getClass().getSimpleName()+" (thao tác sẽ HTTP fallback)");}
      });
    }
    private void send(String operation,JSONObject args) {
      try {
        JSONObject frame=new JSONObject().put("request_id",UUID.randomUUID().toString()).put("operation",operation).put("args",args);
        if(mode.equals("WS")&&socket!=null&&socket.send(frame.toString())){notice("Đã gửi WS "+operation);return;}
        Request request=new Request.Builder().url("http://"+HOST+"/command?uid="+actor+"&gen=1")
          .post(RequestBody.create(frame.toString(),MediaType.get("application/json"))).build();
        bg.execute(()->{
          try(Response response=http.newCall(request).execute()){
            String body=response.body()==null?"":response.body().string();
            notice(operation+" → "+body);
          }catch(IOException e){notice("Không kết nối được local Worker. Kiểm tra 10.0.2.2:9897.");}
        });
      }catch(Exception e){notice("Không gửi được: "+e.getClass().getSimpleName());}
    }
    @Override protected void onDestroy(){if(socket!=null)socket.close(1000,"activity-ended");bg.shutdownNow();http.dispatcher().executorService().shutdown();super.onDestroy();}
}
