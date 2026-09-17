#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess

path = Path("docs/specs/ACCEPTANCE_TESTING.md")
text = path.read_text(encoding="utf-8")
canonical_pending = "The last deployed/signed baseline before the current change is `beta-vc31`, schema v5. The current Android-focused change addresses physical-device evidence from the Owner: narrow-screen login/header breakage, legacy Picker password initialization, mandatory latest-version login gating, adaptive launcher icon treatment and removal of non-operational UI prose. Until the current branch passes required CI, Beta deploy and signed APK publishing, those changes are **source/spec pending verification**, not runtime PASS."
pattern = r"(## Current field frontier\n\n).*?(\n\nPhysical logged-in PDA FCM delivery and Owner field/business acceptance remain separate pending evidence even after technical build/deploy PASS\.)"
updated, count = re.subn(pattern, lambda m: m.group(1) + canonical_pending + m.group(2), text, count=1, flags=re.S)
if count != 1:
    raise SystemExit("ACCEPTANCE_SECTION_NOT_FOUND")
path.write_text(updated, encoding="utf-8")
subprocess.run(["python3", "tools/finalize_vc32_runtime.py"], check=True)
