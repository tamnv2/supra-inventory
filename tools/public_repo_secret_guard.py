#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

PEM_BLOCK = re.compile(
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\r\n]{64,}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    re.MULTILINE,
)
SENSITIVE_NAMES = (
    "GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN",
    "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET",
    "CF_API_TOKEN_INVENTORY_BETA",
    "BETA_KEYSTORE_PASSWORD",
    "BETA_KEY_PASSWORD",
    "ROOT_BOOTSTRAP_PASSWORD",
    "GOOGLE_RUNTIME_SA_JSON",
)
ASSIGNMENT = re.compile(
    rf"(?:{'|'.join(map(re.escape, SENSITIVE_NAMES))})\s*(?:=|:)\s*([\"'])(.+?)\1"
)
SAFE_MARKERS = (
    "${{",
    "secrets.",
    "vars.",
    "env.",
    "process.env",
    "github_secret:",
    "cloudflare_secret:",
    "<secret>",
    "REDACTED",
)


def tracked_files() -> list[Path]:
    out = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
    return [ROOT / p.decode() for p in out.split(b"\0") if p]


def main() -> None:
    findings: list[str] = []
    for path in tracked_files():
        try:
            raw = path.read_bytes()
            if b"\0" in raw:
                continue
            text = raw.decode("utf-8")
        except Exception:
            continue
        rel = path.relative_to(ROOT).as_posix()
        if PEM_BLOCK.search(text):
            findings.append(f"{rel}: committed private-key PEM payload")
        if rel.endswith((".md", ".py")):
            continue
        for match in ASSIGNMENT.finditer(text):
            value = match.group(2).strip()
            if not value:
                continue
            if any(marker in value for marker in SAFE_MARKERS):
                continue
            if value in SENSITIVE_NAMES:
                continue
            findings.append(f"{rel}: possible inline sensitive value for {match.group(0).split(match.group(1))[0].strip()}")
    if findings:
        print("PUBLIC_REPO_SECRET_GUARD_FAIL", file=sys.stderr)
        for finding in findings:
            print(f"- {finding}", file=sys.stderr)
        raise SystemExit(1)
    print("PUBLIC_REPO_SECRET_GUARD_PASS")


if __name__ == "__main__":
    main()
