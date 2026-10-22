package cd.cc.supra.obpp1291

import android.content.Context
import android.os.Build
import androidx.work.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.Duration
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.ZoneId
import java.util.UUID
import java.util.concurrent.TimeUnit

/** OBPP1291 diagnostics only; no QR, MCH, DO, password or session token inside logs. */
object ObppDiagnostics {
    private val vn=ZoneId.of("Asia/Ho_Chi_Minh")
    private const val PREFIX="obpp1291_log_"
    private const val MAX_EVENTS=220
    @Volatile private var uploading=false
    private fun folder(ctx:Context):File=File(ctx.filesDir,"obpp1291_diagnostics").apply { mkdirs() }
    private fun today()=LocalDate.now(vn).toString().replace("-","")
    private fun deviceId(ctx:Context):String{
        val prefs=ctx.getSharedPreferences("obpp1291_diagnostics_device",Context.MODE_PRIVATE)
        val old=prefs.getString("id",null)
        if(old!=null)return old
        val id=UUID.randomUUID().toString()
        prefs.edit().putString("id",id).apply()
        return id
    }
    @Synchronized fun event(ctx:Context, action:String, success:Boolean=true, durationMs:Long=0, code:Int=0) {
        try {
            if(!action.matches(Regex("[A-Z0-9_]{3,48}")))return
            val active=File(folder(ctx),PREFIX+today()+".json")
            val data=if(active.exists())JSONObject(active.readText()) else JSONObject()
                .put("source","OBPP1291").put("bundle_id",UUID.randomUUID().toString().replace("-",""))
                .put("generated_at",java.time.Instant.now().toString())
                .put("device_id",deviceId(ctx)).put("version",BuildConfig.VERSION_NAME)
                .put("device",JSONObject().put("manufacturer",Build.MANUFACTURER.take(30))
                    .put("model",Build.MODEL.take(50)).put("sdk_int",Build.VERSION.SDK_INT))
                .put("events",JSONArray())
                .put("metrics",JSONObject().put("request_count",0).put("error_count",0)
                    .put("latency_ms_total",0).put("approx_bytes_sent",0))
            val events=data.getJSONArray("events")
            val entry=JSONObject().put("at",java.time.Instant.now().toString())
                .put("action",action).put("success",success)
                .put("duration_ms",durationMs.coerceIn(0,120000))
                .put("http_status",code.coerceIn(0,599))
            if(events.length()<MAX_EVENTS)events.put(entry)
            val metrics=data.getJSONObject("metrics")
            metrics.put("request_count",metrics.optInt("request_count")+1)
            if(!success)metrics.put("error_count",metrics.optInt("error_count")+1)
            metrics.put("latency_ms_total",metrics.optLong("latency_ms_total")+durationMs.coerceIn(0,120000))
            // Atomic replacement; retain failed bundles until actual Google Drive ACK.
            val temp=File(active.path+".tmp")
            temp.writeText(data.toString())
            if(!temp.renameTo(active)){temp.copyTo(active,overwrite=true);temp.delete()}
        }catch(_:Exception){ /* never interrupt warehouse operations for diagnostics */ }
    }
    fun installCrashHandler(ctx:Context) {
        val previous=Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            event(ctx.applicationContext,"APP_CRASH_"+error.javaClass.simpleName.uppercase()
                .filter { it.isLetterOrDigit() }.take(24),false)
            previous?.uncaughtException(thread,error)
        }
    }
    @Synchronized private fun list(ctx:Context):List<File> =
        folder(ctx).listFiles()?.filter { it.name.startsWith(PREFIX) && it.name.endsWith(".json") }
            ?.sortedBy { it.name }?.take(30) ?: emptyList()

    /** Only DRIVE_SYNCED deletes the local bundle. Core BUFFERED alone is not enough. */
    fun upload(ctx:Context,manual:Boolean):Boolean {
        synchronized(this){ if(uploading)return false; uploading=true }
        try {
        val token=ObppSessionStore.restore(ctx)?.first ?: return false
        event(ctx,if(manual)"LOG_MANUAL_SEND" else "LOG_SCHEDULED_SEND")
        // Atomically rotate today's active journal. Foreground events now
        // append to a NEW file and cannot be deleted by this in-flight upload.
        synchronized(this){
            val active=File(folder(ctx),PREFIX+today()+".json")
            if(active.exists()){
                val sealed=File(folder(ctx),PREFIX+today()+"_"+UUID.randomUUID().toString()+".json")
                if(!active.renameTo(sealed))return false
            }
        }
        for(file in list(ctx)){
            try {
                val data=JSONObject(file.readText())
                data.put("manual",manual)
                val conn=URL(BuildConfig.API_BASE_URL.trimEnd('/')+
                    "/api/obpp1291/logs/upload").openConnection() as HttpURLConnection
                conn.requestMethod="POST"
                conn.connectTimeout=12000
                conn.readTimeout=20000
                conn.doOutput=true
                conn.setRequestProperty("Authorization","Bearer "+token)
                conn.setRequestProperty("Content-Type","application/json; charset=utf-8")
                val payload=data.toString().toByteArray(Charsets.UTF_8)
                if(payload.size>48000)return false
                conn.outputStream.use{ it.write(payload) }
                val ok=try{
                    val result=if(conn.responseCode in 200..299)
                        JSONObject(conn.inputStream.bufferedReader().use{it.readText()}) else JSONObject()
                    result.optBoolean("drive_synced",false) &&
                        result.optString("archive_status")=="DRIVE_SYNCED"
                }finally{conn.disconnect()}
                if(!ok)return false
                if(!file.delete())return false
            }catch(_:Exception){return false}
        }
        return true
        }finally{synchronized(this){uploading=false}}
    }

    private fun enqueue(ctx:Context, delayMs:Long, retry:Boolean, unique:String){
        val request=OneTimeWorkRequestBuilder<ObppLogWorker>()
            .setInitialDelay(delayMs.coerceAtLeast(1000),TimeUnit.MILLISECONDS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInputData(workDataOf("retry" to retry))
            .build()
        WorkManager.getInstance(ctx.applicationContext)
            .enqueueUniqueWork(unique,ExistingWorkPolicy.KEEP,request)
    }
    fun scheduleDaily(ctx:Context) {
        val now=ZonedDateTime.now(vn)
        var whenRun=now.withHour(21).withMinute(15).withSecond(0).withNano(0)
        if(!whenRun.isAfter(now))whenRun=whenRun.plusDays(1)
        val target=whenRun.toLocalDate().toString().replace("-","")
        enqueue(ctx,Duration.between(now,whenRun).toMillis(),false,"obpp1291_daily_"+target)
    }
    fun scheduleRetry(ctx:Context){
        enqueue(ctx,15*60*1000L,true,"obpp1291_retry_"+today())
    }
    fun sendManual(ctx:Context,done:(Boolean)->Unit) {
        Thread {
            val success=upload(ctx.applicationContext,true)
            done(success)
        }.start()
    }
}

class ObppLogWorker(ctx:Context,params:WorkerParameters):Worker(ctx,params){
    override fun doWork():Result {
        val retried=inputData.getBoolean("retry",false)
        val done=ObppDiagnostics.upload(applicationContext,false)
        if(!done&&!retried)ObppDiagnostics.scheduleRetry(applicationContext)
        ObppDiagnostics.scheduleDaily(applicationContext)
        return Result.success() // Retention is local until Drive ACK; retry exactly once today.
    }
}
