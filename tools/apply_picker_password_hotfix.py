#!/usr/bin/env python3
from pathlib import Path

path = Path("service/src/index.ts")
text = path.read_text(encoding="utf-8")

old_env = "  ROOT_BOOTSTRAP_PASSWORD?: string;\n  ARCHIVE_SHEET_ID?: string;"
new_env = "  ROOT_BOOTSTRAP_PASSWORD?: string;\n  PICKER_DEFAULT_PASSWORD?: string;\n  ARCHIVE_SHEET_ID?: string;"
if old_env not in text and new_env not in text:
    raise SystemExit("ENV_ANCHOR_NOT_FOUND")
text = text.replace(old_env, new_env, 1)

old_login = '''  if (!user.password_hash || !user.password_salt) {\n    if (user.role !== "ROOT" || user.user_id !== "root" || !env.ROOT_BOOTSTRAP_PASSWORD) {\n      return json({ error: "PASSWORD_NOT_INITIALIZED", message: "Tài khoản chưa được khởi tạo mật khẩu." }, 503);\n    }\n    await savePassword(env, user.user_id, env.ROOT_BOOTSTRAP_PASSWORD);\n    user = (await getUserByUsername(env, username))!;\n  }'''
new_login = '''  if (!user.password_hash || !user.password_salt) {\n    let bootstrapPassword: string | null = null;\n    if (user.role === "ROOT" && user.user_id === "root" && env.ROOT_BOOTSTRAP_PASSWORD) {\n      bootstrapPassword = env.ROOT_BOOTSTRAP_PASSWORD;\n    } else if (user.role === "PICKER") {\n      bootstrapPassword = env.PICKER_DEFAULT_PASSWORD || env.ROOT_BOOTSTRAP_PASSWORD || null;\n    }\n    if (!bootstrapPassword) {\n      return json({ error: "PASSWORD_NOT_INITIALIZED", message: "Tài khoản chưa được khởi tạo mật khẩu." }, 503);\n    }\n    await savePassword(env, user.user_id, bootstrapPassword);\n    user = (await getUserByUsername(env, username))!;\n  }'''
if old_login not in text and new_login not in text:
    raise SystemExit("LOGIN_ANCHOR_NOT_FOUND")
text = text.replace(old_login, new_login, 1)

path.write_text(text, encoding="utf-8")
print("picker password hotfix applied")
