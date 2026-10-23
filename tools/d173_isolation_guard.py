#!/usr/bin/env python3
"""D173 PR path/isolation audit. Read-only, never deploys or reads providers.

The rule is deliberately branch-scoped: Owner-approved D172 repairs have their
own release gates; D173 must never silently edit D172-owned modules.
"""
from __future__ import annotations
import argparse
import os
from pathlib import Path
import subprocess
import sys

OBPP_PREFIX = (
    "obpp1291/",
    "service/src/obpp1291-",
    "tests/d172-",
    "tools/d172_",
    ".github/workflows/d172-",
    "docs/D172_",
)
OBPP_EXACT = {
    ".github/workflows/release-obpp1291.yml",
    "ops/change-continuity/D172.json",
    "ops/d172-release-authorization.json",
    "docs/specs/OBPP1291_FALLEN_GOODS.md",
}
SHARED_PREFIX = ("service/src/", "service/wrangler.", "firebase/")
SHARED_EXACT = {
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/deploy-firebase-firestore.yml",
    "ops/project-scope.json",
    "ops/resource-registry.json",
}

def is_obpp_owned(p: str) -> bool:
    return p in OBPP_EXACT or p.startswith(OBPP_PREFIX)

def is_shared(p: str) -> bool:
    return p in SHARED_EXACT or p.startswith(SHARED_PREFIX)

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--head", required=True)
    args = ap.parse_args()
    changed = subprocess.check_output(
        ["git", "diff", "--name-only", f"{args.base}...{args.head}"],
        text=True,
    ).splitlines()
    forbidden = [p for p in changed if is_obpp_owned(p)]
    shared = [p for p in changed if is_shared(p)]
    print(f"D173_ISOLATION_AUDIT changed={len(changed)} shared={len(shared)} forbidden={len(forbidden)}")
    for path in forbidden:
        print(f"D173_FORBIDDEN_D172_OWNED_PATH: {path}", file=sys.stderr)
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with Path(out).open("a", encoding="utf-8") as fp:
            fp.write(f"shared_changed={'true' if shared else 'false'}\n")
    if forbidden:
        print(
            "D173_ISOLATION_FAIL: move this work to Owner-approved D172 PR; "
            "do not bypass by editing cross-owned paths.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    if shared:
        print("D173_SHARED_WORKER_CHANGE: D172 isolated regression required in CI")
    print("D173_ISOLATION_PASS")

if __name__ == "__main__":
    main()
