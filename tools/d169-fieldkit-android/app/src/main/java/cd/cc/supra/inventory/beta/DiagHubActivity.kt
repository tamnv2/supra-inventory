package cd.cc.supra.inventory.beta
import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.content.Intent
import android.widget.*
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.SystemClock
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import org.json.JSONObject
import java.time.Instant
import java.util.UUID
class DiagHubActivity : Activity() {
 private lateinit var trace:DiagTimeline
 private lateinit var sid:EditText
 private lateinit var net:EditText
 private lateinit var pick:EditText
 private lateinit var out:TextView
 private var busy=false
 private fun field(root:LinearLayout,label:String,value:String):EditText {
   TextView(this).also{it.text=label;root.addView(it)}
   return EditText(this).also{it.setSingleLine(true);it.setText(value);root.addView(it)}
 }
 private fun btn(root:LinearLayout,s:String,action:()->Unit){Button(this).also{it.text=s;it.setOnClickListener{action()};root.addView(it)}}
 private fun note(s:String){runOnUiThread {out.text=(s+"\n"+out.text.toString()).take(4000)}}
 private fun netMode():String {val cm=getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
  val n=cm.getNetworkCapabilities(cm.activeNetwork)?:return "NO_NETWORK"
  return if(n.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))"WIFI" else if(n.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR))"CELLULAR" else "OTHER"
 }
 override fun onCreate(saved:Bundle?){super.onCreate(saved);trace=DiagTimeline(this)
  val scroll=ScrollView(this);val panel=LinearLayout(this);panel.orientation=1;panel.setPadding(24,20,24,20);scroll.addView(panel)
  TextView(this).also{it.text="SUPRA D169 — TEST PICKER ⇄ AGENT";it.textSize=20f;panel.addView(it)}
  TextView(this).also{it.text="Dùng đúng nghiệp vụ thật. Chỉ gửi mã Picklist thử nghiệm được phép; Agent chính có thể thực hiện WMS thực.";panel.addView(it)}
  sid=field(panel,"Mã đợt (trùng với EXE) ",trace.id());net=field(panel,"Nhãn mạng (NORMAL / OFFICE) ",trace.label())
  btn(panel,"Bắt đầu / chuyển mạng") {
   val a=sid.text.toString().trim();val b=net.text.toString().trim()
   if(!a.matches(Regex("[A-Za-z0-9_-]{3,48}")) || !b.matches(Regex("[A-Za-z0-9_-]{3,48}"))){note("Nhãn không hợp lệ")}else{
    trace.configure(a,b);trace.event("NETWORK_EPOCH","START",netMode());note("Đã đặt mã "+a+" trên mạng "+b)
   }
  }
  btn(panel,"Đăng nhập Picker / xem gọi về, chat, kick") {trace.event("PICKER_APP","OPEN");startActivity(Intent(this,MainActivity::class.java))}
  pick=field(panel,"Nhập 3–20 chữ số cuối Picklist thật","")
  btn(panel,"Gửi Picklist thật và chờ kết quả Agent") {
   val code=pick.text.toString().trim()
   if(!code.matches(Regex("[0-9]{3,20}"))){note("Mã Picklist chỉ gồm 3–20 chữ số");return@btn}
   AlertDialog.Builder(this).setTitle("Kiểm tra nghiệp vụ THẬT").setMessage("Yêu cầu này được gửi đến Agent PRIMARY thật, có thể kích hoạt WMS. Chỉ thử mã được phép.")
    .setNegativeButton("Huỷ",null).setPositiveButton("Gửi") {_,_->sendPicklist(code)}.show()
  }
  btn(panel,"Xuất log trực tiếp lên Google Drive") {upload()}
  btn(panel,"Chia sẻ JSON dự phòng") {val intent=Intent(Intent.ACTION_SEND).setType("application/json")
      .putExtra(Intent.EXTRA_TEXT,trace.report().toString(2));startActivity(Intent.createChooser(intent,"Chia sẻ log D169"))}
  out=TextView(this);out.text="Hãy đăng nhập Picker trong cửa sổ App thực, sau đó quay lại giao diện này.";out.setTextIsSelectable(true)
  panel.addView(out);setContentView(scroll)
 }
 private fun api():InventoryApi {
  val session=InteractiveSessionStore.load(this)?:throw IllegalStateException("PICKER_LOGIN_REQUIRED")
  val a=InventoryApi(BuildConfig.API_BASE_URL,"SUPRA-D169-DIAG/"+BuildConfig.VERSION_NAME,
    onSessionChanged={ next->InteractiveSessionStore.save(this,next) })
  a.restoreSession(session);return a
 }
 private fun ensureFirebase(){
  if(FirebaseApp.getApps(this).isNotEmpty())return
  if(BuildConfig.FIREBASE_API_KEY.isEmpty())throw IllegalStateException("MISSING_FIREBASE_CONFIG")
  val options=FirebaseOptions.Builder().setApiKey(BuildConfig.FIREBASE_API_KEY)
    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).setApplicationId(BuildConfig.FIREBASE_APP_ID)
    .setGcmSenderId(BuildConfig.FIREBASE_MESSAGING_SENDER_ID).build()
  FirebaseApp.initializeApp(this,options)
 }
 private fun sendPicklist(code:String){
  if(busy){note("Đang kiểm tra request trước");return}
  busy=true
  val operation=UUID.randomUUID().toString()
  trace.event("PICKLIST_SEND","START","test_id="+operation+" length="+code.length)
  Thread {
    val t=SystemClock.elapsedRealtime()
    try{
      val a=api();ensureFirebase()
      val relay=RelayPocClient(this,a,log={trace.event("RELAY_LOG","EVENT",it)},onProgress={trace.event("PICKLIST_PROGRESS","EVENT",it);note(it)})
      try{
        val result=relay.sendProbe(code)
        val ms=SystemClock.elapsedRealtime()-t
        trace.event("PICKLIST_ACK","TERMINAL","request="+result.requestId+" agent="+result.agentId.take(36)+" network="+result.agentNetwork.take(32)+" status="+result.lookupStatus+" elapsed_ms="+ms+" lookup_ms="+result.lookupMs)
        note("Kết quả: "+result.lookupStatus+" | Agent: "+result.agentId+" | "+ms+"ms")
      }finally{relay.close()}
    }catch(e:Exception){trace.event("PICKLIST_ACK","ERROR",e.javaClass.simpleName+" elapsed_ms="+(SystemClock.elapsedRealtime()-t));note("Lỗi chờ ACK: "+e.javaClass.simpleName)}
    finally{runOnUiThread{busy=false}}
  }.start()
 }
 private fun upload(){
  if(busy){note("Đợi kết thúc nghiệp vụ trước khi xuất log");return}
  busy=true;trace.event("LOG_UPLOAD","START",netMode())
  Thread {
   try{
    val a=api()
    val chunks=trace.uploadParts(20)
    var driveSynced=0
    var deferred=0
    for(index in chunks.indices){
      val part=chunks[index]
      val key="D169_"+trace.id()+"_"+part.optString("group","LOG")+"_"+part.optInt("chunk",index+1)
      val response=a.uploadRuntimeLog("INFO","manual_android_log",Instant.now().toString(),
        JSONObject().put("platform","ANDROID").put("package",BuildConfig.APPLICATION_ID),
        part,bundleId=key,boundaryId="D169_DIAGNOSTIC",traceId=trace.id())
      val status=response.optString("archive_status","UNKNOWN")
      if(status=="DRIVE_SYNCED")driveSynced++ else deferred++
      note("Lô "+(index+1)+"/"+chunks.size+": "+status)
    }
    trace.event("LOG_UPLOAD","COMPLETE","drive_synced="+driveSynced+" deferred="+deferred+" total="+chunks.size)
    note(if(deferred==0)"ĐÃ LƯU ĐỦ "+driveSynced+" LÔ TRÊN GOOGLE DRIVE" else "Đã gửi "+chunks.size+" lô; "+deferred+" lô CHƯA XÁC NHẬN Drive. Không xoá log cục bộ.")
   }catch(e:Exception){trace.event("LOG_UPLOAD","ERROR",e.javaClass.simpleName)
     note("Gửi log chưa hoàn tất: "+e.javaClass.simpleName+"; dùng Chia sẻ JSON hoặc gửi lại")}
   finally{runOnUiThread{busy=false}}
  }.start()
 }

}
