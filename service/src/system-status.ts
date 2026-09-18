interface SystemStatusEnv {
  INVENTORY_CORE: DurableObjectNamespace;
  APP_ENV?: string;
  PROJECT_KEY?: string;
  SOURCE_COMMIT?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_WEB_API_KEY?: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN?: string;
  ARCHIVE_SHEET_ID?: string;
  ARCHIVE_FOLDER_ID?: string;
  EXPORTS_FOLDER_ID?: string;
  LOGS_FOLDER_ID?: string;
}

type CoreMetrics = Record<string, unknown>;

type ProviderCache = {
  expires_at: number;
  value: Record<string, unknown>;
};

const CORE_NAME = "inventory-core";
const PROVIDER_CACHE_MS = 5 * 60_000;
let providerCache: ProviderCache | null = null;

function core(env: SystemStatusEnv): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName(CORE_NAME));
}

async function coreMetrics(env: SystemStatusEnv): Promise<CoreMetrics> {
  const response = await core(env).fetch("https://inventory-core.internal/admin/system-metrics");
  if (!response.ok) throw new Error(`CORE_METRICS_HTTP_${response.status}`);
  return (await response.json()) as CoreMetrics;
}

async function refreshGoogleAccessToken(env: SystemStatusEnv): Promise<string> {
  if (!env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || !env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || !env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) {
    throw new Error("GOOGLE_DRIVE_OAUTH_NOT_CONFIGURED");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`GOOGLE_OAUTH_REFRESH_FAILED:${payload.error_description || payload.error || response.status}`);
  }
  return payload.access_token;
}

async function driveJson(token: string, path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`DRIVE_HTTP_${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

async function driveFolderUsage(token: string, folderId: string | undefined, label: string): Promise<Record<string, unknown>> {
  if (!folderId) return { label, configured: false };
  let pageToken = "";
  let itemCount = 0;
  let binaryBytes = 0;
  let newest = "";
  let pages = 0;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      spaces: "drive",
      pageSize: "1000",
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime)",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const payload = await driveJson(token, `/files?${params.toString()}`) as {
      nextPageToken?: string;
      files?: Array<{ size?: string; modifiedTime?: string }>;
    };
    pages += 1;
    for (const file of payload.files || []) {
      itemCount += 1;
      binaryBytes += Number(file.size || 0);
      if (file.modifiedTime && file.modifiedTime > newest) newest = file.modifiedTime;
    }
    pageToken = String(payload.nextPageToken || "");
  } while (pageToken && pages < 20);
  return {
    label,
    configured: true,
    item_count: itemCount,
    binary_size_bytes: binaryBytes,
    newest_modified_at: newest || null,
    note: "Dung lượng thư mục cộng từ file có trường size; Google-native file có thể không có size riêng trong files.list.",
  };
}

async function driveFileMetadata(token: string, fileId: string | undefined, label: string): Promise<Record<string, unknown>> {
  if (!fileId) return { label, configured: false };
  const payload = await driveJson(
    token,
    `/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,quotaBytesUsed`,
  );
  return {
    label,
    configured: true,
    name: payload.name || null,
    mime_type: payload.mimeType || null,
    size_bytes: Number(payload.size || payload.quotaBytesUsed || 0),
    modified_at: payload.modifiedTime || null,
  };
}

async function googleDriveProvider(env: SystemStatusEnv): Promise<Record<string, unknown>> {
  const token = await refreshGoogleAccessToken(env);
  const about = await driveJson(token, "/about?fields=storageQuota") as {
    storageQuota?: { limit?: string; usage?: string; usageInDrive?: string; usageInDriveTrash?: string };
  };
  const quota = about.storageQuota || {};
  const [logs, archive, exports, archiveSheet] = await Promise.all([
    driveFolderUsage(token, env.LOGS_FOLDER_ID, "Logs"),
    driveFolderUsage(token, env.ARCHIVE_FOLDER_ID, "Archive"),
    driveFolderUsage(token, env.EXPORTS_FOLDER_ID, "Exports"),
    driveFileMetadata(token, env.ARCHIVE_SHEET_ID, "Archive Sheet"),
  ]);
  return {
    status: "ok",
    storage_quota: {
      limit_bytes: quota.limit ? Number(quota.limit) : null,
      usage_bytes: quota.usage ? Number(quota.usage) : null,
      usage_in_drive_bytes: quota.usageInDrive ? Number(quota.usageInDrive) : null,
      trash_bytes: quota.usageInDriveTrash ? Number(quota.usageInDriveTrash) : null,
      scope: "Google account storage; not project-folder-only",
    },
    folders: { logs, archive, exports },
    archive_sheet: archiveSheet,
    api_limit_reference: {
      daily_billing_threshold_quota_units: 400_000_000,
      per_minute_project_quota_units: 1_000_000,
      per_minute_user_project_quota_units: 325_000,
      files_get_units: 5,
      files_list_units: 100,
      source_updated: "2026-05-01",
    },
  };
}

async function githubProvider(): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.github.com/repos/tamnv2/supra-inventory/releases?per_page=20", {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "supra-inventory-system-status",
    },
  });
  if (!response.ok) throw new Error(`GITHUB_RELEASES_HTTP_${response.status}`);
  const releases = (await response.json()) as Array<{
    tag_name?: string;
    published_at?: string;
    target_commitish?: string;
    assets?: Array<{ name?: string; size?: number; digest?: string; browser_download_url?: string }>;
  }>;
  const beta = releases
    .filter((item) => /^beta-vc\d+$/.test(String(item.tag_name || "")))
    .sort((a, b) => Number(String(b.tag_name).replace("beta-vc", "")) - Number(String(a.tag_name).replace("beta-vc", "")))[0];
  return {
    status: response.ok ? "ok" : "error",
    latest_beta_release: beta ? {
      tag: beta.tag_name,
      published_at: beta.published_at,
      source: beta.target_commitish,
      assets: (beta.assets || []).map((asset) => ({
        name: asset.name,
        size_bytes: asset.size || 0,
        digest: asset.digest || null,
      })),
    } : null,
  };
}

async function providerMetrics(env: SystemStatusEnv, force = false): Promise<Record<string, unknown>> {
  if (!force && providerCache && providerCache.expires_at > Date.now()) return providerCache.value;
  const value: Record<string, unknown> = {
    refreshed_at: new Date().toISOString(),
    cache_seconds: PROVIDER_CACHE_MS / 1000,
  };
  const [drive, github] = await Promise.allSettled([googleDriveProvider(env), githubProvider()]);
  value.google_drive = drive.status === "fulfilled" ? drive.value : { status: "error", error: String(drive.reason instanceof Error ? drive.reason.message : drive.reason) };
  value.github = github.status === "fulfilled" ? github.value : { status: "error", error: String(github.reason instanceof Error ? github.reason.message : github.reason) };
  providerCache = { expires_at: Date.now() + PROVIDER_CACHE_MS, value };
  return value;
}

export async function collectSystemStatus(env: SystemStatusEnv, forceProviders = false): Promise<Record<string, unknown>> {
  const [coreResult, providersResult] = await Promise.allSettled([
    coreMetrics(env),
    providerMetrics(env, forceProviders),
  ]);
  const coreValue = coreResult.status === "fulfilled" ? coreResult.value : { error: String(coreResult.reason) };
  const providers = providersResult.status === "fulfilled" ? providersResult.value : { error: String(providersResult.reason) };

  return {
    generated_at: new Date().toISOString(),
    environment: env.APP_ENV || "unknown",
    source_commit: env.SOURCE_COMMIT || null,
    core: coreValue,
    providers,
    limits: {
      cloudflare_workers: {
        plan_detected: false,
        note: "Runtime không có quyền đọc entitlement tài khoản; hiển thị song song mốc Free/Paid để tránh suy đoán gói.",
        free: {
          requests_per_day: 100_000,
          cpu_ms_per_http_request: 10,
          memory_bytes_per_isolate: 128 * 1024 * 1024,
          subrequests_per_request: 50,
        },
        paid: {
          requests_per_day: null,
          cpu_ms_per_http_request_default: 30_000,
          cpu_ms_per_http_request_configurable_max: 300_000,
          memory_bytes_per_isolate: 128 * 1024 * 1024,
          subrequests_per_request: 10_000,
        },
        docs_updated: "2026-09-05",
      },
      durable_objects_sqlite: {
        storage_per_object_bytes: 10_000_000_000,
        free_storage_per_account_bytes: 5_000_000_000,
        free_rows_read_per_day: 5_000_000,
        free_rows_written_per_day: 100_000,
        soft_requests_per_second_per_object: 1_000,
        default_cpu_ms_per_request: 30_000,
        websocket_message_bytes: 32 * 1024 * 1024,
        docs_updated: "2026-06-01",
      },
      firebase_auth: {
        spark_tier1_daily_active_users: 3_000,
        custom_token_signins_per_minute_project: 45_000,
        token_exchanges_per_minute_project: 18_000,
        new_account_creations_per_hour_per_ip: 100,
        registered_accounts: "unlimited",
        note: "Các mốc Spark chỉ là tham chiếu nếu project đang ở Spark; runtime hiện không tự đọc billing plan.",
      },
    },
    refresh_policy: {
      core_seconds: 60,
      provider_cache_seconds: PROVIDER_CACHE_MS / 1000,
      reason: "Dữ liệu lõi cập nhật nhẹ; Google Drive/GitHub cache 5 phút để tránh tốn quota không cần thiết.",
    },
  };
}
