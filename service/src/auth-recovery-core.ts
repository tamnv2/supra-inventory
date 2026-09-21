interface RecoveryChallenge {
  token_hash: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function challengeKey(hash: string): string {
  return `password-recovery:${hash}`;
}

function rateKey(userId: string): string {
  return `password-recovery-rate:${userId}`;
}

export async function handleAuthRecoveryCoreRequest(
  state: DurableObjectState,
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/auth/password-recovery/")) return null;

  if (request.method === "POST" && url.pathname === "/auth/password-recovery/store") {
    const body = (await request.json()) as {
      token_hash?: string;
      user_id?: string;
      expires_at?: string;
      created_at?: string;
    };
    const tokenHash = String(body.token_hash || "").trim().toLowerCase();
    const userId = String(body.user_id || "").trim();
    const expiresAt = String(body.expires_at || "").trim();
    const createdAt = String(body.created_at || "").trim() || new Date().toISOString();
    if (!/^[a-f0-9]{64}$/.test(tokenHash) || !userId || !Number.isFinite(Date.parse(expiresAt))) {
      return response({ error: "invalid_input" }, 400);
    }
    const lastSent = await state.storage.get<string>(rateKey(userId));
    if (lastSent && Date.now() - Date.parse(lastSent) < 60_000) {
      return response({ error: "RECOVERY_RATE_LIMITED" }, 429);
    }
    const challenge: RecoveryChallenge = { token_hash: tokenHash, user_id: userId, expires_at: expiresAt, created_at: createdAt };
    await state.storage.put(challengeKey(tokenHash), challenge);
    await state.storage.put(rateKey(userId), createdAt);
    return response({ status: "stored" });
  }

  if (request.method === "POST" && url.pathname === "/auth/password-recovery/verify") {
    const body = (await request.json()) as { token_hash?: string };
    const tokenHash = String(body.token_hash || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(tokenHash)) return response({ error: "RECOVERY_TOKEN_INVALID" }, 400);
    const challenge = await state.storage.get<RecoveryChallenge>(challengeKey(tokenHash));
    if (!challenge) return response({ error: "RECOVERY_TOKEN_INVALID" }, 400);
    if (Date.parse(challenge.expires_at) <= Date.now()) {
      await state.storage.delete(challengeKey(tokenHash));
      return response({ error: "RECOVERY_TOKEN_EXPIRED" }, 400);
    }
    return response({ status: "valid", user_id: challenge.user_id, expires_at: challenge.expires_at });
  }

  if (request.method === "POST" && url.pathname === "/auth/password-recovery/consume") {
    const body = (await request.json()) as { token_hash?: string };
    const tokenHash = String(body.token_hash || "").trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(tokenHash)) await state.storage.delete(challengeKey(tokenHash));
    return response({ status: "consumed" });
  }

  if (request.method === "POST" && url.pathname === "/auth/password-recovery/delete") {
    const body = (await request.json()) as { token_hash?: string };
    const tokenHash = String(body.token_hash || "").trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(tokenHash)) await state.storage.delete(challengeKey(tokenHash));
    return response({ status: "deleted" });
  }

  return response({ error: "not_found" }, 404);
}
