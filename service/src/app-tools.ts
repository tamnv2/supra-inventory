type GithubReleaseAsset = {
  name?: string;
  size?: number;
  digest?: string;
  browser_download_url?: string;
};

type GithubRelease = {
  tag_name?: string;
  name?: string;
  published_at?: string;
  target_commitish?: string;
  html_url?: string;
  assets?: GithubReleaseAsset[];
};

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

const RELEASES_URL = "https://api.github.com/repos/tamnv2/supra-inventory/releases?per_page=30";
const APK_ASSET_NAME = "supra-inventory-beta.apk";
const CACHE_MS = 5 * 60_000;
let cached: { expires_at: number; release: PdaAppRelease; asset_url: string } | null = null;

async function loadLatest(): Promise<{ release: PdaAppRelease; asset_url: string }> {
  if (cached && cached.expires_at > Date.now()) return { release: cached.release, asset_url: cached.asset_url };
  const response = await fetch(RELEASES_URL, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "supra-inventory-pda-download",
    },
  });
  if (!response.ok) throw new Error(`GITHUB_RELEASES_HTTP_${response.status}`);
  const releases = (await response.json()) as GithubRelease[];
  const candidates = releases
    .filter((item) => /^beta-vc\d+$/.test(String(item.tag_name || "")))
    .sort((a, b) => Number(String(b.tag_name).replace("beta-vc", "")) - Number(String(a.tag_name).replace("beta-vc", "")));
  for (const item of candidates) {
    const asset = (item.assets || []).find((entry) => entry.name === APK_ASSET_NAME && entry.browser_download_url);
    if (!asset?.browser_download_url) continue;
    const release: PdaAppRelease = {
      tag: String(item.tag_name || ""),
      name: String(item.name || item.tag_name || "SUPRA Inventory Beta"),
      published_at: item.published_at ? String(item.published_at) : null,
      source: item.target_commitish ? String(item.target_commitish) : null,
      release_url: item.html_url ? String(item.html_url) : null,
      asset_name: APK_ASSET_NAME,
      size_bytes: Number(asset.size || 0),
      digest: asset.digest ? String(asset.digest) : null,
      stable_download_path: "/downloads/pda/latest",
    };
    cached = { expires_at: Date.now() + CACHE_MS, release, asset_url: asset.browser_download_url };
    return { release, asset_url: asset.browser_download_url };
  }
  throw new Error("PDA_APK_RELEASE_NOT_FOUND");
}

export async function latestPdaAppRelease(): Promise<PdaAppRelease> {
  return (await loadLatest()).release;
}

export async function redirectLatestPdaApk(): Promise<Response> {
  try {
    const latest = await loadLatest();
    return new Response(null, {
      status: 302,
      headers: {
        location: latest.asset_url,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
  } catch {
    return new Response("Không tìm thấy bản App PDA mới nhất.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
}
