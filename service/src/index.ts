interface Env {
  APP_ENV: string;
  PROJECT_KEY: string;
  GOOGLE_RUNTIME_SA_JSON?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string;
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_OAUTH_REDIRECT_URI?: string;
}

const REQUIRED_RUNTIME_BINDINGS = [
  "GOOGLE_RUNTIME_SA_JSON",
  "GOOGLE_DRIVE_OAUTH_CLIENT_ID",
  "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET",
  "GOOGLE_DRIVE_OAUTH_REDIRECT_URI",
] as const;

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        service: env.PROJECT_KEY || "supra-inventory",
        environment: env.APP_ENV || "unknown",
        status: "running",
        health: "/health",
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const bindingPresence = Object.fromEntries(
        REQUIRED_RUNTIME_BINDINGS.map((name) => [name, Boolean(env[name])]),
      );
      const missing = REQUIRED_RUNTIME_BINDINGS.filter((name) => !env[name]);

      return json(
        {
          status: missing.length === 0 ? "ok" : "degraded",
          service: env.PROJECT_KEY || "supra-inventory",
          environment: env.APP_ENV || "unknown",
          required_bindings: bindingPresence,
          missing_bindings: missing,
          timestamp: new Date().toISOString(),
        },
        missing.length === 0 ? 200 : 503,
      );
    }

    return json({ error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
