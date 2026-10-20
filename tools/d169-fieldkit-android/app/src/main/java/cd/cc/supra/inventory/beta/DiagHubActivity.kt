package cd.cc.supra.inventory.beta

import android.app.Activity
import android.os.Bundle
import android.os.SystemClock
import android.os.Handler
import android.os.Looper
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
import java.util.concurrent.atomic.AtomicInteger

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
  @Volatile private var phase=0
  @Volatile private var started=false
  @Volatile private var lastPassedPhase=-1
  @Volatile private var testStartedWallMs=0L
  private val dispatchedPhases=Collections.synchronizedSet(HashSet<Int>())
  @Volatile private var pendingNextPhase = -1
  private val attemptedWrites = AtomicInteger(0)
  private val maxTestWrites = 250
  private val testDurationMs = 40L*60L*1000L
  private val acked=Collections.synchronizedSet(HashSet<String>())
  private val agentAcknowledgers=java.util.concurrent.ConcurrentHashMap<String,MutableSet<String>>()
  private val sentOwn=Collections.synchronizedSet(HashSet<String>())
  private val sentPayload=java.util.concurrent.ConcurrentHashMap<String,String>()
  private val sentStartMs=java.util.concurrent.ConcurrentHashMap<String,Long>()
  private val phases=arrayOf("PDA NORMAL / A NORMAL / B NORMAL","PDA NORMAL / A OFFICE / B NORMAL","PDA NORMAL / A NORMAL / B OFFICE","PDA NORMAL / A OFFICE / B OFFICE","PDA NORMAL / A NORMAL / B NORMAL (RESTORE)")
  private var auth:FirebaseAuth?=null
  private var db:FirebaseFirestore?=null
  private var sessionRef:DocumentReference?=null
  private var messages:ListenerRegistration?=null
  private var receipts:ListenerRegistration?=null
  private val seen=Collections.synchronizedSet(HashSet<String>())
  private var epoch=1
  private val kinds=arrayOf("PING","PICKLIST_SIM","PICKLIST_SIM","CALL_SIM","CHAT_SIM","KICK_SIM","LEADER_PROBE","RETRY_SIM","FAILOVER_SIM")
  private lateinit var kind:Spinner

  override fun onCreate(saved:Bundle?) {
    super.onCreate(saved)
    journal=DiagTimeline(this)
    val scroll=ScrollView(this)
    val root=LinearLayout(this).also{it.orientation=1;it.setPadding(24,20,24,25);scroll.addView(it)}
    TextView(this).also{it.text="D171 E009 · PDA TEST ⇄ HAI AGENT TEST";it.textSize=20f;root.addView(it)}
    TextView(this).also{it.text="Kênh mô phỏng riêng, KHÔNG gửi Picklist/WMS thật. Mỗi request cần ACK từ EXE Test.";root.addView(it)}
    userField=field(root,"Tài khoản PICKER thử nghiệm","")
    passwordField=field(root,"Mật khẩu Picker (không lưu)","")
    passwordField.inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
    btn(root,"1 · Đăng nhập Picker") {doLogin()}
    sidField=field(root,"Mã phiên tự động",autoSid());sidField.isEnabled=false
    networkField=field(root,"PDA luôn dùng mạng thường (không chuyển Office)","NORMAL")
    networkField.isEnabled=false
    btn(root,"BẮT ĐẦU TEST TỰ ĐỘNG") {runAutomated(false)}
    // PDA always stays on NORMAL: scenarios advance from authenticated Agent traffic.
    kind=Spinner(this);kind.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,kinds);kind.visibility=android.view.View.GONE;root.addView(kind)
    payloadField=field(root,"Dữ liệu mô phỏng (không dùng mã Picklist thật)","D169-SIM");payloadField.visibility=android.view.View.GONE
    // Manual request controls retired: test matrix sends all permitted synthetic kinds automatically.
    // Epoch is advanced by operator-confirmed network transition.
    // Diagnostic logs remain local and exportable; no Worker/Drive upload.
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
  private fun notice(s:String){runOnUiThread{if(!isFinishing && !isDestroyed)output.text=(s+"\n"+output.text.toString()).take(3500)}}
  private fun safeFailure(e:Throwable):String {
    val chain=generateSequence(e){it.cause}.take(6).toList()
    val firebase=chain.filterIsInstance<FirebaseFirestoreException>().firstOrNull()
    if(firebase!=null)return when(firebase.code) {
      FirebaseFirestoreException.Code.PERMISSION_DENIED -> "D171_FIRESTORE_PERMISSION_DENIED"
      FirebaseFirestoreException.Code.UNAVAILABLE -> "D171_FIRESTORE_NETWORK_UNAVAILABLE"
      FirebaseFirestoreException.Code.DEADLINE_EXCEEDED -> "D171_FIRESTORE_TIMEOUT"
      FirebaseFirestoreException.Code.UNAUTHENTICATED -> "D171_FIRESTORE_AUTH_REQUIRED"
      else -> "D171_FIRESTORE_"+firebase.code.name
    }
    val known=chain.filterIsInstance<IllegalStateException>().firstOrNull()?.message.orEmpty()
    if(known.matches(Regex("^[A-Z][A-Z0-9_]{2,95}$")))return known
    if(chain.any{it is java.util.concurrent.TimeoutException})return "D171_NETWORK_TIMEOUT"
    return "D171_UNEXPECTED_"+e.javaClass.simpleName.uppercase(Locale.ROOT).take(30)
  }
  private fun net():String=networkField.text.toString().trim().ifBlank{"NORMAL"}.take(30)
  private fun safeTestWrite(){
    if(!started || testStartedWallMs<=0 || System.currentTimeMillis()-testStartedWallMs>=testDurationMs)
      throw IllegalStateException("D171_PDA_TEST_DEADLINE_STOP")
    if(attemptedWrites.incrementAndGet()>maxTestWrites){
      started=false;messages?.remove();receipts?.remove()
      throw IllegalStateException("D171_PDA_WRITE_BUDGET_STOP")
    }
  }
  private fun stopAtDeadline(){
    if(started && testStartedWallMs>0L && System.currentTimeMillis()-testStartedWallMs>=testDurationMs){
      started=false;messages?.remove();receipts?.remove()
      journal.event("ONE_SHOT_BUDGET","DEADLINE_STOP")
      notice("Kết thúc kiểm thử sau 40 phút; hãy chia sẻ log JSON để phân tích.")
    }
  }
  private fun autoSid():String{
    val date=SimpleDateFormat("yyyyMMdd",Locale.US).apply{timeZone=TimeZone.getTimeZone("Asia/Ho_Chi_Minh")}.format(Date())
    val bytes=MessageDigest.getInstance("SHA-256").digest(("SUPRA-D169-AUTO-PAIR-V7|"+date).toByteArray(Charsets.UTF_8))
    return bytes.take(16).joinToString(""){String.format(Locale.US,"%02x",it.toInt() and 0xff)}
  }
  private fun runAutomated(next:Boolean){
    if(next){notice("PDA luôn giữ mạng thường; chỉ Agent được đổi mạng.");return}
    worker.execute {
      try {
        if(!::api.isInitialized)throw IllegalStateException("LOGIN_REQUIRED")
        if(started){notice("PDA đang chờ điều phối từ 2 Agent.");return@execute}
        started=true
        testStartedWallMs=System.currentTimeMillis()
        ensureAutoJoined()
        journal.event("ONE_SHOT_BUDGET","ENABLED","writes=250 minutes=40")
        Handler(Looper.getMainLooper()).postDelayed({stopAtDeadline()},testDurationMs)
        journal.event("PDA_READY","PASS","normal_only=true")
        notice("PDA đã sẵn sàng. Giữ nguyên mạng thường. Khi cả 2 Agent bắt đầu, các kịch bản tự chạy.")
      }catch(e:Exception){started=false;val code=safeFailure(e);journal.event("AUTO_READY","ERROR",code);notice("Chưa sẵn sàng: "+code+"\nKiểm tra Agent A (admin) đã bấm BẮT ĐẦU, sau đó Agent B (tamnv2); PDA giữ mạng thường.")}
    }
  }
  private fun dispatchPhase(root:DocumentReference,newPhase:Int){
    if(!started||newPhase !in phases.indices)return
    // Do not consume an early next-phase announcement before previous 9/9 dual ACK.
    if(newPhase>0 && lastPassedPhase!=newPhase-1) {
      if(newPhase==lastPassedPhase+2)pendingNextPhase=newPhase
      journal.event("PDA_PHASE_GATE","DEFER_PREVIOUS_ROUND","phase="+newPhase+" last_pass="+lastPassedPhase)
      return
    }
    if(!dispatchedPhases.add(newPhase))return
    phase=newPhase
    networkField.post{networkField.setText("NORMAL")}
    journal.event("PDA_PHASE","AUTO_START","phase="+newPhase+" always_network=NORMAL")
    worker.execute {
      try {
        val uid=auth?.currentUser?.uid?:throw IllegalStateException("AUTH_REQUIRED")
        if(newPhase>0 && lastPassedPhase!=newPhase-1)
          throw IllegalStateException("D171_PREVIOUS_ROUND_NOT_FINISHED")
        waitForBothAgentReady(root,newPhase)
        safeTestWrite()
        root.collection("members").document(uid).update(mapOf(
          "ready_phase" to newPhase,"ready_network" to "NORMAL","ready_at" to FieldValue.serverTimestamp()))
        val sent=ArrayList<String>()
        var picklistIndex=0
        for(type in kinds){
          val request=UUID.randomUUID().toString().replace("-","")
          val payload="D169-SIM-P"+newPhase+(if(type=="PICKLIST_SIM") {
            picklistIndex++
            if(picklistIndex==1) "|123" else "|1234"
          }else "")
          val map=mapOf("request_id" to request,"sender_uid" to uid,"sender_node" to nodeId,
            "sender_role" to "PICKER","target_uid" to "ALL","kind" to type,
            "payload" to payload,"created_at" to FieldValue.serverTimestamp(),
            "expires_at" to com.google.firebase.Timestamp(Date(System.currentTimeMillis()+240000)))
          sentOwn.add(request)
          sentPayload[request]=payload
          sentStartMs[request]=SystemClock.elapsedRealtime()
          try{safeTestWrite();Tasks.await(root.collection("messages").document(request).set(map),12,TimeUnit.SECONDS)}
          catch(e:Exception){sentOwn.remove(request);sentPayload.remove(request);sentStartMs.remove(request);throw e}
          sent.add(request)
          journal.event("PDA_SEND","SERVER_ACCEPTED_NOT_ACK","request="+request+" kind="+type+" phase="+newPhase)
        }
        for(i in 0 until 60){
          if(sent.all{(agentAcknowledgers[it]?.size?:0)==2})break
          Thread.sleep(1000)
        }
        val passed=sent.count{(agentAcknowledgers[it]?.size?:0)==2}
        if(passed==sent.size){
          lastPassedPhase=newPhase
          if(pendingNextPhase==newPhase+1){
            pendingNextPhase=-1
            dispatchPhase(root,newPhase+1)
          }
        }
        val owner=Tasks.await(root.get(Source.SERVER),12,TimeUnit.SECONDS).getString("owner_uid").orEmpty()
        val adminA=sent.count{agentAcknowledgers[it]?.contains(owner)==true}
        val adminB=sent.count{agentAcknowledgers[it]?.any{agent->agent!=owner}==true}
        journal.event("PDA_AGENT_ACK_SPLIT","COUNT","phase="+newPhase+" A="+adminA+"/9 B="+adminB+"/9")
        journal.event("PDA_PHASE",if(passed==sent.size)"PASS" else "TIMEOUT",
          "phase="+newPhase+" both_agent_ack="+passed+"/"+sent.size)
        notice("Vòng "+(newPhase+1)+"/"+phases.size+" · admin(A): "+adminA+"/9 · tamnv2(B): "+adminB+"/9 · đủ 2 Agent: "+passed+"/9")
        if(newPhase==phases.lastIndex && passed==sent.size)journal.event("FINAL_PHASE","LOG_LOCAL_ONLY_NO_AUTO_UPLOAD")
      }catch(e:Exception){val code=safeFailure(e);journal.event("PDA_PHASE","FAIL",code);notice("Vòng "+(newPhase+1)+" lỗi: "+code)}
    }
  }
  // Agent A is the authenticated session owner; Agent B is the other authenticated
  // Agent member. Both must prove exact same-phase READY and the correct requested
  // network before PDA writes READY or any synthetic request.
  private fun waitForBothAgentReady(root:DocumentReference,newPhase:Int){
    journal.event("PDA_PHASE_GATE","WAIT","phase="+newPhase+" waiting two Agent READY")
    val owner=Tasks.await(root.get(Source.SERVER),12,TimeUnit.SECONDS).getString("owner_uid").orEmpty()
    if(owner.isBlank())throw IllegalStateException("D171_AGENT_A_IDENTITY_MISSING")
    val aNetwork=if(newPhase==1||newPhase==3)"OFFICE" else "NORMAL"
    val bNetwork=if(newPhase==2||newPhase==3)"OFFICE" else "NORMAL"
    for(i in 0 until 15){
      val all=Tasks.await(root.collection("members").get(Source.SERVER),12,TimeUnit.SECONDS).documents
      val agents=all.filter{it.getString("role") in listOf("ADMIN","PICKPACK_ADMIN")}
      val now=System.currentTimeMillis()
      val a=agents.singleOrNull{it.id==owner}
      val b=agents.singleOrNull{it.id!=owner}
      fun correct(d:DocumentSnapshot?,net:String):Boolean =
        d!=null && d.getLong("ready_phase")==newPhase.toLong() &&
        d.getString("ready_network")==net &&
        ((d.getTimestamp("ready_at")?.toDate()?.time?:0L)>now-90000L)
      if(agents.size==2 && correct(a,aNetwork) && correct(b,bNetwork)){
        journal.event("PDA_PHASE_GATE","PASS","phase="+newPhase+" A="+aNetwork+" B="+bNetwork)
        return
      }
      if(i%3==0)notice("Chờ đúng 2 Agent READY vòng "+(newPhase+1)+"/5: admin(A)="+aNetwork+", tamnv2(B)="+bNetwork+". PDA giữ mạng thường.")
      Thread.sleep(5000)
    }
    throw IllegalStateException("D171_TWO_AGENT_SAME_PHASE_READY_TIMEOUT")
  }
  private fun ensureAutoJoined():DocumentReference{
    val active=sessionRef
    if(active!=null)return active
    val uid=auth?.currentUser?.uid?:throw IllegalStateException("AUTH_REQUIRED")
    val root=db!!.collection("d169_diag_sessions").document(autoSid())
    var ready=false
    // Any device may press Start first. Absent session is expected until Agent A creates it.
    for(i in 0 until 80){
      try{
        val d=Tasks.await(root.get(Source.SERVER),8,TimeUnit.SECONDS)
        if(d.exists()){
          if((d.getTimestamp("expires_at")?.toDate()?.time?:0)<=System.currentTimeMillis())
            throw IllegalStateException("D171_SESSION_EXPIRED_NEEDS_ARCHIVE_AND_CLEANUP")
          ready=true;break
        }
      }catch(e:Exception){
        val code=safeFailure(e)
        if(code=="D171_FIRESTORE_PERMISSION_DENIED" || code=="D171_FIRESTORE_AUTH_REQUIRED" ||
          code=="D171_SESSION_EXPIRED_NEEDS_ARCHIVE_AND_CLEANUP")throw e
        if(i%6==0)journal.event("PAIR_DISCOVERY","RETRY",code)
      }
      if(i%6==0)notice("Đang chờ Agent A (admin) tạo phiên test; PDA vẫn giữ mạng thường. Đã chờ "+(i*3)+" giây.")
      Thread.sleep(3000)
    }
    if(!ready)throw IllegalStateException("D171_WAIT_FOR_AGENT_A_START_TIMEOUT")
    claimPickerSession(root,uid)
    val self=root.collection("members").document(uid)
    if(!Tasks.await(self.get(Source.SERVER),12,TimeUnit.SECONDS).exists()){
      val member=mapOf("uid" to uid,"role" to "PICKER","joined_at" to FieldValue.serverTimestamp())
      safeTestWrite();Tasks.await(self.set(member),12,TimeUnit.SECONDS)
    }
    safeTestWrite()
    Tasks.await(self.update(mapOf("ready_phase" to 0,"ready_network" to "NORMAL","ready_at" to FieldValue.serverTimestamp())),12,TimeUnit.SECONDS)
    sessionRef=root
    journal.configure(autoSid(),"NORMAL")
    journal.event("AUTO_PAIR","PASS","node="+nodeId.take(8)+" epoch="+epoch)
    startListeners(root,uid)
    notice("Đã tự động ghép PDA Test với Agent Test.")
    return root
  }
  private fun claimPickerSession(root:DocumentReference,uid:String) {
    val d=Tasks.await(root.get(Source.SERVER),12,TimeUnit.SECONDS)
    val paired=d.getString("paired_picker_uid").orEmpty()
    if(paired.isBlank()) {
      safeTestWrite();Tasks.await(root.update("paired_picker_uid",uid),12,TimeUnit.SECONDS)
      journal.event("PAIR_CLAIM","PASS","Only this authenticated Picker may join")
    } else if(paired != uid) {
      throw IllegalStateException("PHIEN_TEST_DA_GHEP_PICKER_KHAC")
    }
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
      }catch(e:Exception){val code=safeFailure(e);journal.event("PICKER_AUTH","ERROR",code);notice("Đăng nhập lỗi: "+code)}
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
        claimPickerSession(root,uid)
        val member=mapOf("uid" to uid,"role" to "PICKER","joined_at" to FieldValue.serverTimestamp())
        val self=root.collection("members").document(uid)
        if(!Tasks.await(self.get(Source.SERVER),12,TimeUnit.SECONDS).exists())
          safeTestWrite();Tasks.await(self.set(member),12,TimeUnit.SECONDS)
        sessionRef=root
        journal.configure(sid,net());journal.event("DIAG_JOIN","PASS","uid_present epoch="+epoch)
        startListeners(root,uid)
        notice("Đã kết nối EXE Test qua Firestore Beta. Mã phiên: "+sid)
      }catch(e:Exception){journal.event("DIAG_JOIN","ERROR",e.javaClass.simpleName);notice("Không tham gia được: "+e.javaClass.simpleName)}
    }
  }
  private fun startListeners(root:DocumentReference,uid:String) {
    messages?.remove();receipts?.remove();seen.clear()
    val since=com.google.firebase.Timestamp(Date((testStartedWallMs-10000L).coerceAtLeast(0L)))
    messages=root.collection("messages").whereGreaterThanOrEqualTo("created_at",since).addSnapshotListener(MetadataChanges.INCLUDE){snap,error->
      if(error!=null){journal.event("RX_LISTEN","ERROR",error.javaClass.simpleName);return@addSnapshotListener}
      for(ch in snap?.documentChanges.orEmpty()){
        val d=ch.document
        if((d.getTimestamp("created_at")?.toDate()?.time ?: 0L) < testStartedWallMs-30000L)continue
        if(d.getString("sender_node")==nodeId || d.getString("target_uid") !in listOf("ALL",uid))continue
        if((d.getTimestamp("expires_at")?.toDate()?.time?:0)<=System.currentTimeMillis())continue
        val incomingPayload=d.getString("payload").orEmpty()
        if(incomingPayload.startsWith("D171-PHASE-DONE-P"))continue
        val parsed=Regex("^D169-SIM-P([0-4])(?:\\|[0-9]{3,4})?$").matchEntire(incomingPayload)
        val incomingPhase=parsed?.groupValues?.get(1)?.toIntOrNull()
        if(incomingPhase==null||incomingPhase !in phases.indices){
          journal.event("RX_PHASE","INVALID_IGNORED","request="+d.id);continue
        }
        val exactPrefix="D169-SIM-P"+incomingPhase
        val validPayload=if(d.getString("kind")=="PICKLIST_SIM")
          incomingPayload.matches(Regex("^"+Regex.escape(exactPrefix)+"\\|[0-9]{3,4}$"))
          else incomingPayload==exactPrefix
        if(!validPayload){journal.event("RX_PHASE","INVALID_PAYLOAD","request="+d.id);continue}
        if(incomingPhase>phase||!dispatchedPhases.contains(incomingPhase))dispatchPhase(root,incomingPhase)
        // Prior-phase receipts still count when another Agent advances quickly.
        if(incomingPhase>phase){journal.event("RX_PHASE","WAIT_FOR_PHASE","request="+d.id+" incoming="+incomingPhase+" current="+phase);continue}
        if(!seen.add("msg:"+d.id))continue
        val type=d.getString("kind").orEmpty()
        journal.event("RX_FROM_AGENT","RECEIVED","request="+d.id+" kind="+type+" epoch="+epoch)
        receiver.execute{ack(root,d.id,uid,incomingPayload)}
      }
    }
    receipts=root.collection("receipts").whereGreaterThanOrEqualTo("created_at",since).addSnapshotListener{snap,error->
      if(error!=null){journal.event("ACK_LISTEN","ERROR",error.javaClass.simpleName);return@addSnapshotListener}
      for(ch in snap?.documentChanges.orEmpty()){
        val d=ch.document
        if(!seen.add("ack:"+d.id))continue
        val request=d.getString("request_id").orEmpty()
        if(!sentOwn.contains(request))continue
        if(d.getString("receiver_uid")==uid)continue
        if(d.getString("payload_echo")!=sentPayload[request]){
          journal.event("ACK_PAYLOAD","MISMATCH","request="+request)
          continue
        }
        // A server commit or one Agent ACK is insufficient: count two distinct authenticated Agent UIDs.
        val role=d.getString("receiver_role").orEmpty()
        val receiverUid=d.getString("receiver_uid").orEmpty()
        if(role !in listOf("ADMIN","PICKPACK_ADMIN") || receiverUid.isBlank() || d.getString("result")!="ACK")continue
        agentAcknowledgers.computeIfAbsent(request){java.util.concurrent.ConcurrentHashMap.newKeySet<String>()}.add(receiverUid)
        if(agentAcknowledgers[request]?.size==2)acked.add(request)
        val rttMs=SystemClock.elapsedRealtime()-(sentStartMs[request]?:SystemClock.elapsedRealtime())
        journal.event("ACK_FROM_AGENT",d.getString("result").orEmpty(),"request="+request+" receiver_node="+d.getString("receiver_node").orEmpty().take(8)+" rtt_ms="+rttMs+" epoch="+epoch)
        notice("EXE đã phản hồi: "+request.take(8)+" · "+d.getString("result"))
      }
    }
  }
  private fun ack(root:DocumentReference,request:String,uid:String,payloadEcho:String) {
    try {
      val data=mapOf("request_id" to request,"receiver_uid" to uid,"receiver_role" to "PICKER","receiver_node" to nodeId,"payload_echo" to payloadEcho,"result" to "ACK",
        "created_at" to FieldValue.serverTimestamp(),"elapsed_ms" to 0,"network_epoch" to ("pda-"+epoch))
      safeTestWrite()
      Tasks.await(root.collection("receipts").document(request+"_"+uid+"_"+nodeId).set(data),12,TimeUnit.SECONDS)
      journal.event("ACK_TO_AGENT","PASS","request="+request)
    }catch(e:Exception){journal.event("ACK_TO_AGENT","ERROR",safeFailure(e))}
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
        safeTestWrite()
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
