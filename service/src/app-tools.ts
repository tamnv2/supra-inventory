export type PdaAppRelease = {
  tag: string;
  name: string;
  published_at: string | null;
  source: string | null;
  release_url: string | null;
  asset_name: string;
  size_bytes: number;
  digest: string | null;
  stable_download_path: string;
};

export type AgentAppRelease = {
  tag: string;
  name: string;
  published_at: string | null;
  source: string | null;
  release_url: string | null;
  asset_name: string;
  size_bytes: number;
  digest: string | null;
  stable_download_path: string;
};

type ChannelManifest = {
  tag?: string;
  name?: string;
  published_at?: string;
  source?: string;
  size_bytes?: number;
  sha256?: string;
};

const REPOSITORY = "tamnv2/supra-inventory";
const CHANNEL_TAG = "inventory-channel";
const CHANNEL_BASE = `https://github.com/${REPOSITORY}/releases/download/${CHANNEL_TAG}`;
const RELEASE_BASE = `https://github.com/${REPOSITORY}/releases/tag`;
const PDA_MANIFEST_URL = `${CHANNEL_BASE}/pda-latest.json`;
const PDA_ASSET_NAME = "supra-inventory-beta.apk";
const PDA_ASSET_URL = `${CHANNEL_BASE}/${PDA_ASSET_NAME}`;
const PDA_CHECKSUM_URL = `${CHANNEL_BASE}/${PDA_ASSET_NAME}.sha256`;
const AGENT_MANIFEST_URL = `${CHANNEL_BASE}/agent-latest.json`;
const AGENT_ASSET_NAME = "Agent.Auto.Confirm.Pick.Pack.exe";
const AGENT_ASSET_URL = `${CHANNEL_BASE}/${AGENT_ASSET_NAME}`;
const AGENT_CHECKSUM_URL = `${CHANNEL_BASE}/${AGENT_ASSET_NAME}.sha256`;
const CACHE_MS = 5 * 60_000;

let pdaCache: { expires_at: number; release: PdaAppRelease } | null = null;
let agentCache: { expires_at: number; release: AgentAppRelease } | null = null;

function digestFromSha(value: unknown): string | null {
  const sha = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(sha) ? `sha256:${sha}` : null;
}

async function loadManifest(url: string): Promise<ChannelManifest> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "supra-inventory-release-channel",
      "cache-control": "no-cache",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`RELEASE_CHANNEL_HTTP_${response.status}`);
  const payload = await response.json() as ChannelManifest;
  if (!payload || typeof payload !== "object") throw new Error("RELEASE_CHANNEL_INVALID_JSON");
  return payload;
}

export async function latestPdaAppRelease(): Promise<PdaAppRelease> {
  if (pdaCache && pdaCache.expires_at > Date.now()) return pdaCache.release;
  const manifest = await loadManifest(PDA_MANIFEST_URL);
  const tag = String(manifest.tag || "");
  if (!/^beta-vc\d+$/.test(tag)) throw new Error("PDA_RELEASE_CHANNEL_INVALID_TAG");
  const release: PdaAppRelease = {
    tag,
    name: String(manifest.name || `1291 Beta ${tag}`),
    published_at: manifest.published_at ? String(manifest.published_at) : null,
    source: manifest.source ? String(manifest.source) : null,
    release_url: `${RELEASE_BASE}/${encodeURIComponent(tag)}`,
    asset_name: PDA_ASSET_NAME,
    size_bytes: Math.max(0, Number(manifest.size_bytes || 0)),
    digest: digestFromSha(manifest.sha256),
    stable_download_path: "/downloads/pda/latest",
  };
  pdaCache = { expires_at: Date.now() + CACHE_MS, release };
  return release;
}

export async function latestAgentAppRelease(): Promise<AgentAppRelease> {
  if (agentCache && agentCache.expires_at > Date.now()) return agentCache.release;
  const manifest = await loadManifest(AGENT_MANIFEST_URL);
  const tag = String(manifest.tag || "");
  if (!/^relay-agent-v\d+$/.test(tag)) throw new Error("AGENT_RELEASE_CHANNEL_INVALID_TAG");
  const release: AgentAppRelease = {
    tag,
    name: String(manifest.name || `Agent Auto Confirm Pick Pack ${tag}`),
    published_at: manifest.published_at ? String(manifest.published_at) : null,
    source: manifest.source ? String(manifest.source) : null,
    release_url: `${RELEASE_BASE}/${encodeURIComponent(tag)}`,
    asset_name: AGENT_ASSET_NAME,
    size_bytes: Math.max(0, Number(manifest.size_bytes || 0)),
    digest: digestFromSha(manifest.sha256),
    stable_download_path: "/downloads/agent/latest",
  };
  agentCache = { expires_at: Date.now() + CACHE_MS, release };
  return release;
}

function stableRedirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

export function redirectLatestPdaApk(): Response {
  return stableRedirect(PDA_ASSET_URL);
}

export function redirectLatestPdaChecksum(): Response {
  return stableRedirect(PDA_CHECKSUM_URL);
}

export function redirectLatestAgentExe(): Response {
  return stableRedirect(AGENT_ASSET_URL);
}

export function redirectLatestAgentChecksum(): Response {
  return stableRedirect(AGENT_CHECKSUM_URL);
}
