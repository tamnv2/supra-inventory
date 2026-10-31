#!/usr/bin/env python3
"""Guard isolated D173-E110 sources before native builds (no live provider/production)."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[2]
SANDBOX=ROOT/"tools/d173_e110_sandbox"
assert SANDBOX.is_dir()
required=[
  SANDBOX/"worker.mjs",SANDBOX/"wrangler.toml",SANDBOX/"web/index.html",
  SANDBOX/"android/app/src/main/AndroidManifest.xml",
  SANDBOX/"android/app/build.gradle.kts",
  SANDBOX/"agent/M2Lab.Agent.csproj"
]
for f in required: assert f.exists(),f"missing {f}"
for f in SANDBOX.rglob("*"):
    if not f.is_file() or f.suffix not in (".mjs",".js",".java",".cs",".xml",".toml",".kts",".html",".json",".md",".css"):continue
    data=f.read_text(encoding="utf8").lower()
    # Do not embed real account endpoints in compilable source.
    if f.suffix in (".mjs",".js",".java",".cs",".toml",".kts",".xml",".html"):
        for forbidden in ("inventory.supra.cc.cd","inventory-beta.supra.cc.cd","wms-supra.winmart.vn",
                          "firebaseapp.com","workers.dev","cloudflare.com/api","private_key",
                          "google_runtime_sa_json","cloudflare_api_token","wrangler deploy"):
            assert forbidden not in data,(f,forbidden)
app=(SANDBOX/"android/app/build.gradle.kts").read_text()
assert 'applicationId = "com.supra.m2lab.pda"' in app
assert "127.0.0.1" in (SANDBOX/"wrangler.toml").read_text()
assert 'workers_dev = false' in (SANDBOX/"wrangler.toml").read_text()
assert "127.0.0.1:9897" in (SANDBOX/"agent/Program.cs").read_text()
assert "10.0.2.2:9897" in (SANDBOX/"android/app/src/main/java/com/supra/m2lab/pda/MainActivity.java").read_text()
print("D173_E110_ISOLATION_GUARD_PASS")
