interface Env {
  APP_ENV: string;
  PROJECT_KEY: string;
  MANAGEMENT_SHEET_ID: string;
  REGISTRY_API_BASE: string;
  PDA_CORE: DurableObjectNamespace;
  PDA_MGMT_ROOT_BOOTSTRAP_PASSWORD?: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
  SOURCE_COMMIT?: string;
}

const CORE_NAME = "pda-management-core";
const CHANNEL_BASE = "https://github.com/tamnv2/supra-inventory/releases/download/pda-mgmt-channel";
const CHANNEL_MANIFEST_URL = CHANNEL_BASE + "/pda-mgmt-manifest.json";
const CHANNEL_APK_URL = CHANNEL_BASE + "/supra-pda-management-beta.apk";
const CHANNEL_CHECKSUM_URL = CHANNEL_BASE + "/supra-pda-management-beta.apk.sha256";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export class PdaManagementCore {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", storage: "sqlite-do", schema_version: 1 });
    }
    return json({ error: "NOT_FOUND" }, 404);
  }
}

async function coreHealth(env: Env): Promise<Record<string, unknown>> {
  try {
    const stub = env.PDA_CORE.get(env.PDA_CORE.idFromName(CORE_NAME));
    const response = await stub.fetch("https://pda-core.internal/health");
    return await response.json() as Record<string, unknown>;
  } catch {
    return { status: "unavailable" };
  }
}

async function releaseManifest(): Promise<Response> {
  const upstream = await fetch(CHANNEL_MANIFEST_URL, {
    headers: {
      "accept": "application/json",
      "user-agent": "SUPRA-PDA-Management-Beta-Worker"
    }
  });
  if (!upstream.ok) {
    return json({ error: "UPDATE_CHANNEL_UNAVAILABLE", upstream_status: upstream.status }, 503);
  }

  const raw = await upstream.text();
  try {
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    const versionCode = Number(manifest.version_code || 0);
    const tag = String(manifest.tag || "");
    const versionName = String(manifest.version_name || "");
    if (
      versionCode <= 0 ||
      tag !== `pda-mgmt-beta-vc${versionCode}` ||
      versionName !== `0.1.0-beta.${versionCode}`
    ) {
      return json({ error: "UPDATE_CHANNEL_INVALID" }, 502);
    }
  } catch {
    return json({ error: "UPDATE_CHANNEL_INVALID_JSON" }, 502);
  }

  return new Response(raw, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      "x-content-type-options": "nosniff"
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      const storage = await coreHealth(env);
      const configReady = Boolean(env.MANAGEMENT_SHEET_ID && env.REGISTRY_API_BASE);
      return json({
        status: storage.status === "ok" && configReady ? "ok" : "degraded",
        environment: env.APP_ENV,
        project: env.PROJECT_KEY,
        source_commit: env.SOURCE_COMMIT || "",
        storage,
        management_sheet_configured: Boolean(env.MANAGEMENT_SHEET_ID),
        registry_source_configured: Boolean(env.REGISTRY_API_BASE),
        root_bootstrap_secret_configured: Boolean(env.PDA_MGMT_ROOT_BOOTSTRAP_PASSWORD),
        google_runtime_secret_configured: Boolean(env.GOOGLE_RUNTIME_SA_JSON),
        usage_policy: {
          heartbeat: false,
          firebase: false,
          android_background_poll: false,
          mutations: "event-driven-idempotent",
          sheet: "mirror-not-critical-path"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/downloads/app/manifest") {
      return releaseManifest();
    }

    if (request.method === "GET" && url.pathname === "/downloads/app/latest") {
      return Response.redirect(CHANNEL_APK_URL, 302);
    }

    if (request.method === "GET" && url.pathname === "/downloads/app/latest.sha256") {
      return Response.redirect(CHANNEL_CHECKSUM_URL, 302);
    }

    if (request.method === "GET" && url.pathname === "/api/config") {
      return json({
        app_scope: "PDA_MANAGEMENT",
        environment: env.APP_ENV,
        registry_mode: "ON_DEMAND_ETAG",
        offline_mutation: false
      });
    }

    return json({ error: "NOT_FOUND" }, 404);
  }
};
