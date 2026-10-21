package cd.cc.supra.inventory.beta

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

// D171 E039: no exact alarms, foreground service, per-event cloud writes or
// periodic wake loop. Android Doze may delay these user-approved slot starts.
internal object D171DailyLogSchedule {
    private val zone = ZoneId.of("Asia/Ho_Chi_Minh")
    private val dayFormat = DateTimeFormatter.BASIC_ISO_DATE
    private val slots = listOf("1315", "2115")

    fun schedule(context: Context) {
        val now = ZonedDateTime.now(zone)
        slots.forEach { slot ->
            val hour = slot.substring(0, 2).toInt()
            val minute = slot.substring(2, 4).toInt()
            var target = now.toLocalDate().atTime(LocalTime.of(hour, minute)).atZone(zone)
            if (!target.isAfter(now)) target = target.plusDays(1)
            enqueue(context.applicationContext, slot, target)
        }
    }

    fun scheduleTomorrow(context: Context, slot: String, day: String) {
        if (slot !in slots || !day.matches(Regex("\\d{8}"))) return
        val next = try { LocalDate.parse(day, dayFormat).plusDays(1) } catch (_: Exception) { return }
        val hour = slot.substring(0, 2).toInt()
        val minute = slot.substring(2, 4).toInt()
        val target = next.atTime(hour, minute).atZone(zone)
        if (!target.isAfter(ZonedDateTime.now(zone))) {
            // A device that stayed off for days must not queue a catch-up storm.
            schedule(context)
            return
        }
        enqueue(context.applicationContext, slot, target)
    }

    private fun enqueue(context: Context, slot: String, time: ZonedDateTime) {
        val day = time.format(dayFormat)
        val deviceId = context.getSharedPreferences("notification_device", Context.MODE_PRIVATE)
            .getString("device_id", "").orEmpty()
        val seed = "$deviceId|$day|$slot"
        val jitter = (seed.hashCode().toLong() and 0x7FFFFFFF) % (15L * 60_000L)
        val delayMs = (time.toInstant().toEpochMilli() + jitter - System.currentTimeMillis()).coerceAtLeast(0L)
        val req = OneTimeWorkRequestBuilder<D171DailyLogWorker>()
            .setInputData(workDataOf("slot" to slot, "day" to day))
            .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
            .setBackoffCriteria(BackoffPolicy.LINEAR, 15L, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "supra-d171-log-$day-$slot", ExistingWorkPolicy.KEEP, req
        )
    }
}

internal class D171DailyLogWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val slot = inputData.getString("slot").orEmpty()
        val day = inputData.getString("day").orEmpty()
        if (slot != "1315" && slot != "2115") return Result.success()
        if (!day.matches(Regex("\\d{8}"))) return Result.success()
        // Re-enqueue tomorrow only once. This ensures a process-dead Android can
        // keep a persistent WorkManager schedule across ordinary restarts.
        try { D171DailyLogSchedule.scheduleTomorrow(applicationContext, slot, day) } catch (_: Exception) { }
        val session = InteractiveSessionStore.load(applicationContext) ?: return Result.success()
        val synced = AndroidSupportLogResponder.sendDaily(applicationContext, session, "$day-$slot")
        if (synced) return Result.success()
        // At most three 15-minute retries; next slot covers any retained journal.
        return if (runAttemptCount < 3) Result.retry() else Result.success()
    }
}
