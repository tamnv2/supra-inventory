#!/usr/bin/env python3
"""D173-E140 exact Worker index delta: ONLY signed shift claims; no D172/mail drift."""
import subprocess
from pathlib import Path

def fail(msg):
    raise SystemExit("D173_E140_WORKER_DELTA_FAIL:"+msg)
accepted=subprocess.check_output(["git","show","origin/main:service/src/index.ts"],text=True)
expected=accepted
changes=[
    ("import { d173PickerShiftIsExpired } from \"./d173-picker-shift\";","import { d173PickerShiftLogoutAtMs, d173PickerShiftIsExpired } from \"./d173-picker-shift\";"),
    ("      app_session_generation: identity.sessionGeneration,\n    });","      app_session_generation: identity.sessionGeneration,\n      ...(user.base_role === \"PICKER\" ? {\n        picker_shift_logout_at_ms: d173PickerShiftLogoutAtMs(user.android_session_started_at) ?? 0,\n      } : {}),\n    });"),
    ("    app_session_generation: activated.generation,\n  });","    app_session_generation: activated.generation,\n    ...(channel === \"ANDROID\" && user.base_role === \"PICKER\" ? {\n      picker_shift_logout_at_ms: activated.pickerShiftLogoutAtMs ?? 0,\n    } : {}),\n  });"),
    ("          app_session_generation: activated.generation,\n        })","          app_session_generation: activated.generation,\n          ...(user.base_role === \"PICKER\" ? {\n            picker_shift_logout_at_ms: activated.pickerShiftLogoutAtMs ?? 0,\n          } : {}),\n        })"),
    ("        picker_shift_logout_at_ms: activated.pickerShiftLogoutAtMs,\n        picker_shift_server_now_ms: Date.now(),","        picker_shift_logout_at_ms: activated.pickerShiftLogoutAtMs ?? 0,\n        picker_shift_server_now_ms: Date.now(),")
]
for n,(before,after) in enumerate(changes):
    if expected.count(before)!=1: fail("MAIN_ANCHOR_"+str(n))
    expected=expected.replace(before,after,1)
actual=Path("service/src/index.ts").read_text(encoding="utf8")
if actual!=expected: fail("UNAPPROVED_WORKER_INDEX_CHANGE")
for path in ("service/src/obpp1291-core.ts","service/src/google-mail.ts","service/src/system-reset.ts",
             "service/wrangler.beta.toml","ops/d173-email-release-authorization.json",
             "ops/d173-email-sender-activation-authorization.json"):
    before=subprocess.check_output(["git","show","origin/main:"+path],text=True)
    if before!=Path(path).read_text(encoding="utf8"): fail("PROTECTED_FILE_CHANGED:"+path)
print("D173_E140_WORKER_INDEX_EXACT_CLAIMS_ONLY__EMAIL_D172_UNCHANGED_PASS")
