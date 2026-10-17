package cd.cc.supra.inventory.beta
import android.content.Context
import android.os.Build
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.security.MessageDigest
internal class DiagTimeline(private val context: Context) {
 private val prefs=context.getSharedPreferences("d169_diag_evidence_v5",Context.MODE_PRIVATE)
 private val lock=Any()
 fun id():String=prefs.getString("test_session_id","D169_DIAG_01").orEmpty()
 fun label():String=prefs.getString("network_label","NORMAL").orEmpty()
 fun configure(id:String,label:String) {prefs.edit().putString("test_session_id",id).putString("network_label",label).apply();event("CONFIG","SET","new_epoch")}
 fun event(stage:String,result:String,detail:String="") {
  synchronized(lock) {
   val old=runCatching{JSONArray(prefs.getString("events","[]"))}.getOrDefault(JSONArray())
   old.put(JSONObject().put("at_utc",Instant.now().toString()).put("mono_ms",SystemClock.elapsedRealtime())
     .put("session_id",id()).put("network_label",label()).put("event",stage.take(100))
     .put("result",result.take(80)).put("detail",safe(detail).take(300)))
   val limited=JSONArray();for(i in (old.length()-350).coerceAtLeast(0) until old.length())limited.put(old.get(i))
   prefs.edit().putString("events",limited.toString()).commit()
  }
 }
 fun report():JSONObject {
  val runtime=context.getSharedPreferences("runtime_logs",Context.MODE_PRIVATE)
  val rawEvents=runCatching {JSONArray(prefs.getString("events","[]"))}.getOrDefault(JSONArray())
  val original=runCatching {JSONArray(runtime.getString("journal_events","[]"))}.getOrDefault(JSONArray())
  val active=InteractiveSessionStore.load(context)?.userId.orEmpty()
  val owner=runtime.getString("journal_owner","").orEmpty()
  val accepted=if(active.isNotBlank() && owner==active)original else JSONArray()
  val doc=JSONObject().put("format","SUPRA_D169_ACTUAL_PICKER_FIELD_V5")
    .put("test_session_id",id()).put("network_label",label())
    .put("device",JSONObject().put("sdk",Build.VERSION.SDK_INT).put("model",Build.MODEL.take(48)))
    .put("generated_at",Instant.now().toString())
    .put("diagnostic_event_count",rawEvents.length())
    .put("main_app_event_count",accepted.length())
    .put("main_app_dropped_count",runtime.getLong("journal_dropped",0L))
    .put("events",rawEvents)
    .put("main_app_journal",accepted)
  return doc
 }
 fun uploadParts(maxEvents:Int=20):List<JSONObject> {
  val doc=report();val a=doc.getJSONArray("events");val b=doc.getJSONArray("main_app_journal")
  val output=ArrayList<JSONObject>()
  for(kind in listOf("DIAG" to a, "APP" to b)) {
   val n=kind.second.length()
   if(n==0) continue
   val segments=(n+maxEvents-1)/maxEvents
   for(chunk in 0 until segments){
    val part=JSONObject().put("format","SUPRA_D169_FIELD_LOG_CHUNK_V5")
      .put("test_session_id",id()).put("network_label",label())
      .put("group",kind.first).put("chunk",chunk+1).put("chunk_count",segments)
      .put("group_event_count",n).put("generated_at",Instant.now().toString())
    val events=JSONArray()
    for(i in chunk*maxEvents until minOf(n,(chunk+1)*maxEvents))events.put(kind.second.get(i))
    part.put("events",events)
    output.add(part)
   }
  }
  if(output.isEmpty()) output.add(doc)
  return output
 }

 fun clear(){prefs.edit().remove("events").apply()}
 private fun safe(s:String):String = s.replace(Regex("(?i)(bearer|authorization|password|secret|token|apikey|api_key)\\s*[:=]\\s*[^\\s,;]+"),"$1=[REDACTED]")
}
