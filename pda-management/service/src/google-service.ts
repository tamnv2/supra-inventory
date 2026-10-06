interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

export async function getGoogleServiceAccountAccessToken(
  rawServiceAccountJson: string,
  scope: string,
): Promise<string> {
  let credentials: ServiceAccountJson;
  try {
    credentials = JSON.parse(rawServiceAccountJson) as ServiceAccountJson;
  } catch {
    throw new Error("GOOGLE_RUNTIME_SA_JSON_INVALID");
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("GOOGLE_RUNTIME_SA_JSON_INCOMPLETE");
  }

  const cacheKey = credentials.client_email + "|" + scope;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token;

  const tokenUri = credentials.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "GOOGLE_TOKEN_EXCHANGE_FAILED");
  }
  const lifetimeMs = Math.max(10 * 60_000, Number(payload.expires_in || 3600) * 1000);
  tokenCache.set(cacheKey, {
    token: payload.access_token,
    expiresAt: Date.now() + lifetimeMs,
  });
  if (tokenCache.size > 8) {
    const nowMs = Date.now();
    for (const [key, value] of tokenCache) {
      if (value.expiresAt <= nowMs) tokenCache.delete(key);
    }
  }
  return payload.access_token;
}
