#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parent / "apply_android_vc33_native_ui.py"
source = path.read_text(encoding="utf-8")
start = source.find("old_update = '''")
new_marker = source.find("new_update = '''", start)
call = 'main = replace_once(main, old_update, new_update, "native_update_gate")'
if start < 0 or new_marker < 0 or call not in source:
    raise SystemExit("CODEMOD_REPAIR_ANCHOR_NOT_FOUND")
source = source[:start] + source[new_marker:]
replacement = '''update_start = main.find("    private fun checkForUpdate(silent: Boolean) {")
update_end = main.find("    private fun downloadAndVerify(info: UpdateInfo): File {", update_start)
if update_start < 0 or update_end < 0 or update_end <= update_start:
    raise SystemExit("ANCHOR_NOT_FOUND:native_update_gate_section")
main = main[:update_start] + new_update + "\\n" + main[update_end:]'''
source = source.replace(call, replacement, 1)
path.write_text(source, encoding="utf-8")
print("ANDROID_VC33_CODEMOD_REPAIRED")
