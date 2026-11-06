import { publishPickerSessionRevocation } from "./firestore-projection";

type ShiftCronEnv = Parameters<typeof publishPickerSessionRevocation>[0] & {
  INVENTORY_CORE: DurableObjectNamespace;
};
type ShiftTarget = { user_id: string; firebase_uid: string; revoked_generation: number };
type ShiftPlan = {
  status?: string;
  cutoff_key?: string;
  applied_at_ms?: number;
  targets?: ShiftTarget[];
  done?: boolean;
};

/**
 * D173-E146: existing five-minute Worker cron, no new trigger or Android request.
 * Only 14:00 and 22:00 Asia/Ho_Chi_Minh (07:00/15:00 UTC);
 * bounded retries through minute 30 for failed Firebase delivery.
 * Durable state is owned by InventoryCore, not Worker memory.
 */
export async function runD173PickerShiftCron(env: ShiftCronEnv, scheduledTime: number): Promise<void> {
  const tick = new Date(scheduledTime);
  const hour = tick.getUTCHours();
  const minute = tick.getUTCMinutes();
  if ((hour !== 7 && hour !== 15) || minute > 30 || minute % 5 !== 0) return;
  const day = new Date(scheduledTime + 7 * 60 * 60_000).toISOString().slice(0, 10);
  const cutoffKey = day + ":" + (hour === 7 ? "14" : "22");
  const core = env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
  const planResponse = await core.fetch("https://inventory-core.internal/auth/revoke-expired-picker-android-sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cutoff_key: cutoffKey }),
  });
  if (!planResponse.ok) throw new Error("PICKER_SHIFT_CUTOFF_CORE_HTTP_" + planResponse.status);
  const plan = await planResponse.json() as ShiftPlan;
  if (plan.cutoff_key !== cutoffKey || plan.status !== "ok") {
    throw new Error("PICKER_SHIFT_CUTOFF_INVALID_PLAN");
  }
  if (plan.done === true) return;
  const targets = Array.isArray(plan.targets) ? plan.targets : [];
  const appliedAt = Number(plan.applied_at_ms);
  if (!Number.isFinite(appliedAt) || !targets.length || targets.length > 2000) {
    throw new Error("PICKER_SHIFT_CUTOFF_INVALID_OUTBOX");
  }
  const delivered: string[] = [];
  let failed = 0;
  // Bounded concurrency. A failed individual write cannot block other Pickers.
  for (let i = 0; i < targets.length; i += 12) {
    const slice = targets.slice(i, i + 12);
    const batch = await Promise.allSettled(slice.map(async target => {
      if (!target.user_id || !target.firebase_uid ||
          !Number.isSafeInteger(target.revoked_generation) || target.revoked_generation < 1) {
        throw new Error("PICKER_SHIFT_INVALID_TARGET");
      }
      await publishPickerSessionRevocation(env, {
        user_id: target.user_id,
        firebase_uid: target.firebase_uid,
        revoked_generation: target.revoked_generation,
        kicked_at_ms: appliedAt,
        issued_by_user_id: "SYSTEM_SHIFT_CUTOFF",
        issued_by_agent_instance_id: "SHIFT_CRON",
      });
      return target.user_id;
    }));
    for (const result of batch) {
      if (result.status === "fulfilled") delivered.push(result.value);
      else failed += 1;
    }
  }
  if (delivered.length) {
    const ack = await core.fetch("https://inventory-core.internal/auth/ack-expired-picker-android-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cutoff_key: cutoffKey, delivered_user_ids: delivered }),
    });
    if (!ack.ok) throw new Error("PICKER_SHIFT_CUTOFF_ACK_HTTP_" + ack.status);
  }
  if (failed > 0) {
    // No identities or sensitive values in logs. Retry on the next existing Cron tick.
    throw new Error("PICKER_SHIFT_CUTOFF_SIGNAL_DEFERRED count=" + failed);
  }
}
