package cd.cc.supra.inventory.beta

import android.app.Activity
import android.os.Bundle
import android.os.SystemClock
import android.widget.*
import android.text.InputType
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import org.json.JSONObject
import java.time.Instant
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.text.SimpleDateFormat
import java.security.MessageDigest
import java.util.Collections
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

// D169 isolated test client. NEVER creates relay_poc_jobs or production calls.
class DiagHubActivity : Activity() {
  private lateinit var journal:DiagTimeline
  private lateinit var sidField:EditText
  private lateinit var userField:EditText
  private lateinit var passwordField:EditText
  private lateinit var networkField:EditText
  private lateinit var payloadField:EditText
  private lateinit var output:TextView
  private lateinit var api:InventoryApi
  private val worker=Executors.newSingleThreadExecutor()
  private val receiver=Executors.newSingleThreadExecutor()
  private val nodeId=UUID.randomUUID().toString().replace("-","")
  private var phase=0
  private var started=false
  private val acked=Collections.synchronizedSet(HashSet<String>())
  private val phases=arrayOf("PDA NORMAL / AGENT NORMAL","PDA OFFICE / AGENT OFFICE","PDA NORMAL / AGENT OFFICE","PDA OFFICE / AGENT NORMAL","AGENT A NORMAL / B NORMAL","AGENT A OFFICE / B OFFICE","AGENT A NORMAL / B OFFICE","AGENT A OFFICE / B NORMAL")
  private var auth:FirebaseAuth?=null
  private var db:FirebaseFirestore?=null
  private var sessionRef:DocumentReference?=null
  private var messages:ListenerRegistration?=null
  private var receipts:ListenerRegistration?=null
  private val seen=Collections.synchronizedSet(HashSet<String>())
  private var epoch=1
  private val kinds=arrayOf("PING","PICKLIST_SIM","CALL_SIM","CHAT_SIM","KICK_SIM","LEADER_PROBE","RETRY_SIM","FAILOVER_SIM")
  private lateinit var kind:Spinner

  override fun onCreate(saved:Bundle?) {
    super.onCreate(saved)
    journal=DiagTimeline(this)
    val scroll=ScrollView(this)
    val root=LinearLayout(this).also{it.orientation=1;it.setPadding(24,20,24,25);scroll.addView(it)}
    TextView(this).also{it.text="SUPRA D169 · PDA TEST ⇄ AGENT TEST";it.textSize=20f;root.addView(it)}
    TextView(this).also{it.text="Kênh mô phỏng riêng, KHÔNG gửi Picklist/WMS thật. Mỗi request cần ACK từ EXE Test.";root.addView(it)}
    userField=field(root,"Tài khoản PICKER thử nghiệm","")
    passwordField=field(root,"Mật khẩu Picker (không lưu)","")
    passwordField.inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
    btn(root,"1 · Đăng nhập Picker") {doLogin()}
    sidField=field(root,"Mã phiên tự động",autoSid());sidField.isEnabled=false
    networkField=field(root,"Mạng (xác nhận theo hướng dẫn)","NORMAL")
    btn(root,"BẮT ĐẦU TEST TỰ ĐỘNG") {runAutomated(false)}
    btn(root,"ĐÃ CHUYỂN MẠNG · TEST TIẾP") {runAutomated(true)}
    kind=Spinner(this);kind.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,kinds);kind.visibility=android.view.View.GONE;root.addView(kind)
    payloadField=field(root,"Dữ liệu mô phỏng (không dùng mã Picklist thật)","D169-SIM");payloadField.visibility=android.view.View.GONE
    // Manual request controls retired: test matrix sends all permitted synthetic kinds automatically.
    // Epoch is advanced by operator-confirmed network transition.
    btn(root,"Gửi log lên Google Drive") {upload()}
    btn(root,"Chia sẻ log JSON nếu Drive lỗi") {
      val intent=android.content.Intent(android.content.Intent.ACTION_SEND).apply {
        type="text/plain"
        putExtra(android.content.Intent.EXTRA_TEXT,journal.report().toString(2))
      }
      startActivity(android.content.Intent.createChooser(intent,"Xuất log D169"))
    }
    output=TextView(this);output.text="Đăng nhập Picker rồi bấm BẮT ĐẦU TEST trên cả PDA và EXE.";output.setTextIsSelectable(true);root.addView(output)
    setContentView(scroll)
  }
  private fun field(root:LinearLayout,title:String,value:String):EditText {
    TextView(this).also{it.text=title;root.addView(it)}
    return EditText(this).also{it.setSingleLine(true);it.setText(value);root.addView(it)}
  }
  private fun btn(root:LinearLayout,label:String,cb:()->Unit){Button(this).also{it.text=label;it.setOnClickListener{cb()};root.addView(it)}}
  private fun notice(s:String){runOnUiThread{output.text=(s+"\n"+output.text.toString()).take(3500)}}
  private fun net():String=networkField.text.toString().trim().ifBlank{"NORMAL"}.take(30)
  private fun autoSid():String{
    val date=SimpleDateFormat("yyyyMMdd",Locale.US).apply{timeZone=TimeZone.getTimeZone("Asia/Ho_Chi_Minh")}.format(Date())
    val bytes=MessageDigest.getInstance("SHA-256").digest(("SUPRA-D169-AUTO-PAIR-V7|"+date).toByteArray(Charsets.UTF_8))
    return bytes.take(16).joinToString(""){String.format(Locale.US,"%02x",it.toInt() and 0xff)}
  }
  private fun runAutomated(next:Boolean){
    worker.execute{
      try{
        if(!::api.isInitialized)throw IllegalStateException("LOGIN_REQUIRED")
        if(next&&!started)throw IllegalStateException("BAM_BAT_DAU_TEST_TRUOC")
        if(next){
          if(phase>=phases.size){notice("Đã kiểm tra đủ các nhóm mạng.");return@execute}
          epoch++
          journal.event("NETWORK_SWITCH","OPERATOR_CONFIRMED","phase="+phase+" epoch="+epoch+" transport="+transport())
          networkField.post{networkField.setText(if(phases[phase].contains("PDA OFFICE")) "OFFICE" else "NORMAL")}
        }else{
          if(started){notice("Đang có phiên Test. Chọn ĐÃ CHUYỂN MẠNG để tiếp tục.");return@execute}
        }
        val root=ensureAutoJoined()
        started=true
        val sent=ArrayList<String>()
        journal.event("AUTO_PHASE","START","scenario="+phases[phase]+" epoch="+epoch+" transport="+transport())
        for(type in kinds){
          val request=UUID.randomUUID().toString().replace("-","")
          val uid=auth!!.currentUser!!.uid
          val map=mapOf("request_id" to request,"sender_uid" to uid,"sender_node" to nodeId,
            "sender_role" to "PICKER","target_uid" to "ALL","kind" to type,
            "payload" to "D169-SIM","created_at" to FieldValue.serverTimestamp(),
            "expires_at" to com.google.firebase.Timestamp(Date(System.currentTimeMillis()+240000)))
          val start=SystemClock.elapsedRealtime()
          Tasks.await(root.collection("messages").document(request).set(map),12,TimeUnit.SECONDS)
          sent.add(request)
          journal.event("PDA_SEND","SERVER_ACCEPTED_NOT_ACK","request="+request+" kind="+type+" ms="+(SystemClock.elapsedRealtime()-start))
        }
        for(i in 0 until 30){
          if(sent.all{acked.contains(it)})break
          Thread.sleep(1000)
        }
        val pass=sent.count{acked.contains(it)}
        for(id in sent)journal.event("TEST_TERMINAL",if(acked.contains(id))"ACK_PASS" else "ACK_TIMEOUT","request="+id+" phase="+phase)
        journal.event("AUTO_PHASE","COMPLETE","scenario="+phases[phase]+" pass="+pass+"/"+sent.size)
        phase++
        if(phase<phases.size){
          notice("Kết quả "+pass+"/"+sent.size+". Tiếp theo: "+phases[phase]+". Chuyển mạng theo kịch bản rồi bấm ĐÃ CHUYỂN MẠNG trên các máy.")
        }else{
          notice("Đã chạy hết 8 nhóm thử nghiệm. Gửi log lên Drive và lấy log EXE từ Desktop.")
          upload()
        }
      }catch(e:Exception){journal.event("AUTO_TEST","ERROR",e.javaClass.simpleName);notice("Test lỗi: "+e.javaClass.simpleName+". Kiểm tra mạng/Rules; không có ACK giả.")}
    }
  }
  private fun ensureAutoJoined():DocumentReference{
    val active=sessionRef
    if(active!=null)return active
    val uid=auth?.currentUser?.uid?:throw IllegalStateException("AUTH_REQUIRED")
    val root=db!!.collection("d169_diag_sessions").document(autoSid())
    var ready=false
    for(i in 0 until 12){
      try{
        val d=Tasks.await(root.get(Source.SERVER),8,TimeUnit.SECONDS)
        if(d.exists() && (d.getTimestamp("expires_at")?.toDate()?.time?:0)>System.currentTimeMillis()){ready=true;break}
      }catch(e:Exception){journal.event("PAIR_DISCOVERY","RETRY",e.javaClass.simpleName)}
      Thread.sleep(3000)
    }
    if(!ready)throw IllegalStateException("CHUA_CO_AGENT_TEST__OR_RULES_CHUA_DEPLOY")
    val self=root.collection("members").document(uid)
    if(!Tasks.await(self.get(Source.SERVER),12,TimeUnit.SECONDS).exists()){
      val member=mapOf("uid" to uid,"role" to "PICKER","joined_at" to FieldValue.serverTimestamp())
      Tasks.await(self.set(member),12,TimeUnit.SECONDS)
    }
    sessionRef=root
    journal.configure(autoSid(),net())
    journal.event("AUTO_PAIR","PASS","node="+nodeId.take(8)+" epoch="+epoch)
    startListeners(root,uid)
    notice("Đã tự động ghép PDA Test với Agent Test.")
    return root
  }
  private fun transport():String {
    val cm=getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
    val cap=cm.getNetworkCapabilities(cm.activeNetwork)
    return if(cap?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)==true) "WIFI"
      else if(cap?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)==true) "CELLULAR" else "UNKNOWN"
  }
  private fun configureFirebase() {
    if(FirebaseApp.getApps(this).isEmpty()) {
      val o=FirebaseOptions.Builder().setApiKey(BuildConfig.FIREBASE_API_KEY)
        .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).setApplicationId(BuildConfig.FIREBASE_APP_ID)
        .setGcmSenderId(BuildConfig.FIREBASE_MESSAGING_SENDER_ID).build()
      FirebaseApp.initializeApp(this,o)
    }
    if(db==null) {
      val instance=FirebaseFirestore.getInstance()
      instance.firestoreSettings=FirebaseFirestoreSettings.Builder().setPersistenceEnabled(false).build()
      db=instance
    }
    auth=FirebaseAuth.getInstance()
  }
  private fun device():String {
    val prefs=getSharedPreferences("d169_device",MODE_PRIVATE)
    return prefs.getString("id",null) ?: UUID.randomUUID().toString().also{prefs.edit().putString("id",it).apply()}
  }
  private fun doLogin(){
    val username=userField.text.toString().trim()
    val password=passwordField.text.toString();passwordField.text.clear()
    if(username.isEmpty()||password.isEmpty()){notice("Cần tài khoản và mật khẩu Picker.");return}
    worker.execute {
      try {
        configureFirebase()
        val next=InventoryApi(BuildConfig.API_BASE_URL.trimEnd('/'),"D169-PDA-TEST/1",{})
        val s=next.login(username,password,"android:"+device())
        if(s.role!="PICKER")throw IllegalStateException("NOT_PICKER")
        val custom=s.relayCustomToken ?: throw IllegalStateException("NO_FIREBASE_CUSTOM_TOKEN")
        Tasks.await(auth!!.signInWithCustomToken(custom),15,TimeUnit.SECONDS)
        api=next
        journal.event("PICKER_AUTH","PASS","role=PICKER firebase_uid_present")
        notice("Đã đăng nhập Picker. Bấm BẮT ĐẦU TEST trên PDA và EXE, hai máy tự ghép cặp.")
      }catch(e:Exception){journal.event("PICKER_AUTH","ERROR",e.javaClass.simpleName);notice("Đăng nhập lỗi: "+e.javaClass.simpleName)}
    }
  }
  private fun join(){
    val sid=sidField.text.toString().trim().lowercase()
    if(!sid.matches(Regex("[a-f0-9]{32}"))){notice("Mã phiên phải đúng 32 ký tự.");return}
    worker.execute {
      try {
        if(!::api.isInitialized)throw IllegalStateException("LOGIN_REQUIRED")
        val uid=auth?.currentUser?.uid ?: throw IllegalStateException("FIREBASE_AUTH_MISSING")
        val root=db!!.collection("d169_diag_sessions").document(sid)
        val data=Tasks.await(root.get(Source.SERVER),12,TimeUnit.SECONDS)
        if(!data.exists())throw IllegalStateException("SESSION_NOT_CREATED")
        if((data.getTimestamp("expires_at")?.toDate()?.time?:0)<=System.currentTimeMillis())
          throw IllegalStateException("SESSION_EXPIRED")
        val member=mapOf("uid" to uid,"role" to "PICKER","joined_at" to FieldValue.serverTimestamp())
        val self=root.collection("members").document(uid)
        if(!Tasks.await(self.get(Source.SERVER),12,TimeUnit.SECONDS).exists())
          Tasks.await(self.set(member),12,TimeUnit.SECONDS)
        sessionRef=root
        journal.configure(sid,net());journal.event("DIAG_JOIN","PASS","uid_present epoch="+epoch)
        startListeners(root,uid)
        notice("Đã kết nối EXE Test qua Firestore Beta. Mã phiên: "+sid)
      }catch(e:Exception){journal.event("DIAG_JOIN","ERROR",e.javaClass.simpleName);notice("Không tham gia được: "+e.javaClass.simpleName)}
    }
  }
  private fun startListeners(root:DocumentReference,uid:String) {
    messages?.remove();receipts?.remove();seen.clear()
    messages=root.collection("messages").addSnapshotListener(MetadataChanges.INCLUDE){snap,error->
      if(error!=null){journal.event("RX_LISTEN","ERROR",error.javaClass.simpleName);return@addSnapshotListener}
      for(ch in snap?.documentChanges.orEmpty()){
        val d=ch.document
        if(d.getString("sender_node")==nodeId || d.getString("target_uid") !in listOf("ALL",uid))continue
        if((d.getTimestamp("expires_at")?.toDate()?.time?:0)<=System.currentTimeMillis())continue
        if(!seen.add("msg:"+d.id))continue
        val type=d.getString("kind").orEmpty()
        journal.event("RX_FROM_AGENT","RECEIVED","request="+d.id+" kind="+type+" epoch="+epoch)
        receiver.execute{ack(root,d.id,uid)}
      }
    }
    receipts=root.collection("receipts").addSnapshotListener{snap,error->
      if(error!=null){journal.event("ACK_LISTEN","ERROR",error.javaClass.simpleName);return@addSnapshotListener}
      for(ch in snap?.documentChanges.orEmpty()){
        val d=ch.document
        if(!seen.add("ack:"+d.id))continue
        val request=d.getString("request_id").orEmpty()
        acked.add(request)
        journal.event("ACK_FROM_AGENT",d.getString("result").orEmpty(),"request="+request+" receiver_node="+d.getString("receiver_node").orEmpty().take(8)+" epoch="+epoch)
        notice("EXE đã phản hồi: "+request.take(8)+" · "+d.getString("result"))
      }
    }
  }
  private fun ack(root:DocumentReference,request:String,uid:String) {
    try {
      val data=mapOf("request_id" to request,"receiver_uid" to uid,"receiver_node" to nodeId,"result" to "ACK",
        "created_at" to FieldValue.serverTimestamp(),"elapsed_ms" to 0,"network_epoch" to ("pda-"+epoch))
      Tasks.await(root.collection("receipts").document(request+"_"+uid+"_"+nodeId).set(data),12,TimeUnit.SECONDS)
      journal.event("ACK_TO_AGENT","PASS","request="+request)
    }catch(e:Exception){journal.event("ACK_TO_AGENT","ERROR",e.javaClass.simpleName)}
  }
  private fun send() {
    val kindValue=kind.selectedItem?.toString().orEmpty()
    val payload=payloadField.text.toString().take(80)
    val root=sessionRef
    if(root==null){notice("Hãy tham gia phiên test trước.");return}
    worker.execute {
      try {
        val uid=auth!!.currentUser!!.uid
        val req=UUID.randomUUID().toString().replace("-","")
        val map=mapOf("request_id" to req,"sender_uid" to uid,"sender_node" to nodeId,"sender_role" to "PICKER",
          "target_uid" to "ALL","kind" to kindValue,"payload" to payload,
          "created_at" to FieldValue.serverTimestamp(),"expires_at" to com.google.firebase.Timestamp(Date(System.currentTimeMillis()+240000)))
        val start=SystemClock.elapsedRealtime()
        Tasks.await(root.collection("messages").document(req).set(map),12,TimeUnit.SECONDS)
        journal.event("PDA_SEND","SERVER_ACCEPTED","id="+req+" kind="+kindValue+" create_ms="+(SystemClock.elapsedRealtime()-start)+" epoch="+epoch)
        notice("Gửi "+kindValue+": "+req.take(10)+" (đợi EXE ACK, HTTP success chưa phải ACK)")
      }catch(e:Exception){journal.event("PDA_SEND","ERROR",e.javaClass.simpleName);notice("Gửi lỗi: "+e.javaClass.simpleName)}
    }
  }
  private fun upload(){
    worker.execute {
      try {
        if(!::api.isInitialized)throw IllegalStateException("LOGIN_REQUIRED")
        journal.event("LOG_UPLOAD","START")
        val chunks=journal.uploadParts(18)
        var synced=0
        for(i in chunks.indices) {
          val chunk=chunks[i]
          val response=api.uploadRuntimeLog("INFO","manual_android_log",Instant.now().toString(),
            JSONObject().put("platform","ANDROID").put("package",BuildConfig.APPLICATION_ID),
            chunk,bundleId="D169-"+journal.id()+"-"+chunk.optString("group")+"-"+chunk.optInt("chunk"),
            boundaryId="D169_DIAG",traceId=journal.id())
          if(response.optString("archive_status")=="DRIVE_SYNCED")synced++
        }
        journal.event("LOG_UPLOAD","DONE","synced="+synced+"/"+chunks.size)
        notice("Drive xác nhận "+synced+"/"+chunks.size+" phần; log chưa xác nhận vẫn nằm trên PDA.")
      }catch(e:Exception){journal.event("LOG_UPLOAD","ERROR",e.javaClass.simpleName);notice("Drive chưa xác nhận: "+e.javaClass.simpleName+"; chia sẻ JSON dự phòng")}
    }
  }
  override fun onDestroy(){messages?.remove();receipts?.remove();worker.shutdownNow();receiver.shutdownNow();super.onDestroy()}
}
