import { retryBufferedRuntimeLogArchives, type PendingRuntimeLogArchive } from "./runtime-logs";
import { retryIncompleteHrSnapshotIfDue, type HrSyncState } from "./hr-event-sync";

type MaintenanceEnv = Parameters<typeof retryBufferedRuntimeLogArchives>[0] & Parameters<typeof retryIncompleteHrSnapshotIfDue>[0];
type MaintenancePlan = {
  runtime_logs?: { ok?: boolean; items?: PendingRuntimeLogArchive[] };
  hr_sync?: { ok?: boolean; sync?: HrSyncState | null };
};

/** The established five-minute tasks share only their initial read. Failed
 * plan sections retain the original reader and independent retry/error path. */
export async function runD173ScheduledMaintenance(env: MaintenanceEnv): Promise<void> {
  let plan: MaintenancePlan | null = null;
  try {
    const stub = env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
    const response = await stub.fetch("https://inventory-core.internal/maintenance/plan?limit=20");
    if (response.ok) plan = await response.json() as MaintenancePlan;
  } catch { /* Preserve both existing fallback readers on unavailable storage. */ }
  const logs = plan?.runtime_logs?.ok === true && Array.isArray(plan.runtime_logs.items)
    ? { items: plan.runtime_logs.items } : undefined;
  const hr = plan?.hr_sync?.ok === true ? { sync: plan.hr_sync.sync || null } : undefined;
  await Promise.all([
    retryBufferedRuntimeLogArchives(env, 20, logs).catch(error =>
      console.error("runtime_log_drive_retry_failed", error instanceof Error ? error.message : "unknown")),
    retryIncompleteHrSnapshotIfDue(env, hr).catch(error =>
      console.error("hr_incomplete_recheck_failed", error instanceof Error ? error.message : "unknown")),
  ]);
}
