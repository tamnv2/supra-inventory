import type { LauncherRelease } from "./app-tools";

interface Env { INVENTORY_CORE: DurableObjectNamespace }

export interface LauncherUpdateRule {
  id: string;
  scope: "ALL" | "MODEL" | "DEVICE";
  targets: string[];
  version: string;
  version_code: number;
  sha256: string;
  required: boolean;
  enabled: boolean;
}

export interface LauncherUpdateConfig {
  revision: number;
  rules: LauncherUpdateRule[];
  updated_at?: string;
  updated_by?: string;
}

const DEVICE_RE = /^[a-f0-9]{64}$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SHA_RE = /^[a-f0-9]{64}$/;

function core(env: Env): DurableObjectStub {
  return env.INVENTORY_CORE.get(env.INVENTORY_CORE.idFromName("inventory-core"));
}

export function validateLauncherRules(raw: unknown): LauncherUpdateRule[] {
  if (!Array.isArray(raw) || raw.length > 100) throw new Error("INVALID_UPDATE_RULE_COUNT");
  const ids = new Set<string>();
  return raw.map((value: unknown) => {
    const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const id = String(item.id || "").trim();
    const scope = String(item.scope || "");
    const targets = Array.isArray(item.targets) ? item.targets.map(x => String(x).trim()) : [];
    const version = String(item.version || "").trim();
    const versionCode = Number(item.version_code);
    const sha256 = String(item.sha256 || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{1,60}$/.test(id) || ids.has(id)) throw new Error("INVALID_UPDATE_RULE_ID");
    ids.add(id);
    if (!["ALL","MODEL","DEVICE"].includes(scope)) throw new Error("INVALID_UPDATE_SCOPE");
    if (targets.length > 500 || (scope !== "ALL" && targets.length === 0)) throw new Error("INVALID_UPDATE_TARGET_COUNT");
    if (scope === "ALL" && targets.length) throw new Error("ALL_RULE_MUST_HAVE_EMPTY_TARGETS");
    if (scope === "DEVICE" && targets.some(x => !DEVICE_RE.test(x))) throw new Error("INVALID_DEVICE_KEY");
    if (scope === "MODEL" && targets.some(x => !/^[A-Za-z0-9._-]{2,100}$/.test(x))) throw new Error("INVALID_UPDATE_MODEL");
    if (!VERSION_RE.test(version) || !Number.isSafeInteger(versionCode) || versionCode <= 325) {
      throw new Error("INVALID_UPDATE_VERSION");
    }
    const parts = version.split(".").map(Number);
    if (parts[0]*10000 + parts[1]*100 + parts[2] !== versionCode) throw new Error("UPDATE_VERSION_CODE_MISMATCH");
    if (!SHA_RE.test(sha256)) throw new Error("INVALID_UPDATE_SHA256");
    if (typeof item.required !== "boolean" || typeof item.enabled !== "boolean") throw new Error("INVALID_UPDATE_FLAGS");
    return { id, scope: scope as LauncherUpdateRule["scope"], targets: [...new Set(targets)], version,
      version_code: versionCode, sha256, required: item.required, enabled: item.enabled };
  });
}

export async function loadLauncherUpdateConfig(env: Env): Promise<LauncherUpdateConfig> {
  const response = await core(env).fetch("https://inventory-core.internal/launcher-update/policies");
  if (!response.ok) throw new Error("UPDATE_CONFIG_UNAVAILABLE");
  return await response.json() as LauncherUpdateConfig;
}

function normalizeVersion(release: LauncherRelease) {
  return {
    channel: "launcher",
    tag: release.tag,
    version: release.version,
    version_code: release.version_code,
    published_at: release.published_at,
    source: release.source,
    size_bytes: release.size_bytes,
    sha256: release.sha256,
    apk_path: release.stable_download_path,
    checksum_path: "/downloads/launcher/latest.sha256",
    required: true,
    policy_revision: 0,
    policy_id: "foundation",
  };
}

// Never trust a client-supplied model or Serial. Resolve them using the device key
// already recorded by Launcher in the authoritative PDA registry.
export async function resolveLauncherManifest(
  env: Env, deviceKeyInput: string | null, release: LauncherRelease,
): Promise<Record<string, unknown>> {
  const foundation = normalizeVersion(release);
  const deviceKey = String(deviceKeyInput || "").trim().toLowerCase();
  if (!DEVICE_RE.test(deviceKey)) return foundation; // Existing v0.3.24 fleet -> foundation v0.3.25.
  const registryResponse = await core(env).fetch(
    `https://inventory-core.internal/pda-registry/status?device_key=${encodeURIComponent(deviceKey)}`);
  if (!registryResponse.ok) return foundation;
  const registry = await registryResponse.json() as {registered?: boolean;record?:{model?:string;manufacturer?:string}};
  if (!registry.registered || !registry.record) return foundation;
  const config = await loadLauncherUpdateConfig(env);
  const model = String(registry.record.model || "").trim().toUpperCase();
  const candidates = config.rules.filter(r => {
    if (!r.enabled) return false;
    if (r.scope === "ALL") return true;
    if (r.scope === "MODEL") return r.targets.some(t => t.toUpperCase() === model);
    return r.targets.includes(deviceKey);
  }).sort((a,b) =>
    ({DEVICE:3,MODEL:2,ALL:1}[b.scope] - {DEVICE:3,MODEL:2,ALL:1}[a.scope]) ||
    b.version_code - a.version_code);
  const chosen = candidates[0];
  if (!chosen || chosen.version_code <= release.version_code) return { ...foundation, policy_revision: config.revision };
  return {
    channel: "launcher",
    tag: `v${chosen.version}`,
    version: chosen.version,
    version_code: chosen.version_code,
    sha256: chosen.sha256,
    apk_path: `/downloads/launcher/releases/${chosen.version}`,
    required: chosen.required,
    policy_revision: config.revision,
    policy_id: chosen.id,
  };
}
