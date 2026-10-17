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
 fun report():JSONObject=JSONObject().put("format","SUPRA_D169_ACTUAL_PICKER_FIELD_V5")
  .put("test_session_id",id()).put("network_label",label())
  .put("device",JSONObject().put("sdk",Build.VERSION.SDK_INT).put("model",Build.MODEL.take(48)))
  .put("generated_at",Instant.now().toString())
  .put("events",JSONArray(prefs.getString("events","[]")))
 fun clear(){prefs.edit().remove("events").apply()}
 private fun safe(s:String):String = s.replace(Regex("(?i)(bearer|authorization|password|secret|token|apikey|api_key)\\s*[:=]\\s*[^\\s,;]+"),"$1=[REDACTED]")
}
