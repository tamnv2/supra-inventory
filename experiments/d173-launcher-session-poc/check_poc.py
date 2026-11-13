from pathlib import Path
root = Path(__file__).parent
launcher = root / "launcher"
client = root / "test-client"
def read(folder, name):
    return (folder / name).read_text()
main = read(launcher, "app/src/main/java/vn/supra/pdalauncher/MainActivity.java")
session = read(launcher, "app/src/main/java/vn/supra/pdalauncher/TestSessionStore.java")
handoff = read(launcher, "app/src/main/java/vn/supra/pdalauncher/HandoffActivity.java")
receiver = read(launcher, "app/src/main/java/vn/supra/pdalauncher/SessionCommandReceiver.java")
client_main = read(client, "app/src/main/java/vn/supra/identitytest/MainActivity.java")
manifest = read(launcher, "app/src/main/AndroidManifest.xml")
client_manifest = read(client, "app/src/main/AndroidManifest.xml")
workflow = (root.parent.parent / ".github/workflows/d173-launcher-session-poc.yml").read_text()
assert "environment: beta" in workflow
assert "vars.FIREBASE_WEB_API_KEY_BETA || secrets.FIREBASE_WEB_API_KEY_BETA" in workflow
assert "D173_POC_TEST_USERNAME" not in workflow
assert not (root / "firebase-test-backend").exists()
for project in (launcher, client):
    sdk = next(project.glob("app/src/main/java/**/PocFirebase.java")).read_text()
    gradle = read(project, "app/build.gradle")
    assert '"supra-inventory-beta".equals(BuildConfig.TEST_FIREBASE_PROJECT_ID)' in sdk
    assert "https://inventory.supra.cc.cd" in sdk
    assert "/api/auth/login" in sdk and "/api/auth/logout" in sdk and "/api/auth/me" in sdk
    assert "TEST_QA_USERNAME" not in sdk and "TEST_QA_USERNAME" not in gradle
    assert "D173_POC_FIREBASE_API_KEY" in gradle
    assert "cloudfunctions.net" not in sdk and "/api/obpp1291/" not in sdk
assert "Xác nhận định danh" in main
assert "TestSessionStore.isUnlocked(this)" in main
assert '"force", false' in session and '"username", account' in session
assert '"PICKER".equals(role) || "REPORTER".equals(role) || "ADMIN".equals(role)' in session
assert 'PocFirebase.post("/api/auth/login"' in session
assert 'PocFirebase.post("/api/auth/logout"' in session
assert 'PocFirebase.me(issuedToken)' in session
assert 'signInWithCustomToken' in session and 'signInWithCustomToken' in client_main
# Regression D173-E256: publicUser() exposes user_id, NOT username.
worker = (root.parent.parent / "service/src/index.ts").read_text()
internal_user = worker.split("interface InternalUser {", 1)[1].split("}", 1)[0]
public_user = worker.split("function publicUser(", 1)[1].split("\\n}", 1)[0]
assert "username:" not in internal_user
assert "username:" not in public_user
assert 'user.optString("username")' not in session
assert 'user.optString("username")' not in client_main
assert 'user.optString("user_id").isEmpty()' in session
assert 'userId.equals(String.valueOf(claims.get("app_user_id")))' in client_main
assert 'sameWorkerAccount(user, token.getClaims(), uid)' in client_main
assert 'sameWorkerAccount(user, token.getClaims(), local.getString("firebase_uid", ""))' in client_main
assert 'String stage = "WORKER_LOGIN";' in session
assert 'sameWorkerAccount' in client_main and 'app_user_id' in client_main
assert 'app_session_generation' in session and 'app_session_generation' in client_main
assert 'getCallingPackage()' in handoff
assert 'PackageManager.SIGNATURE_MATCH' in handoff and 'PackageManager.SIGNATURE_MATCH' in receiver
assert "SESSION_CONTROL" in manifest and "SESSION_CONTROL" in client_manifest
assert "getPackageManager().checkSignatures" in client_main
assert 'android.permission.INTERNET' in manifest and 'android.permission.INTERNET' in client_manifest
assert 'android.intent.category.HOME' not in manifest
assert '<activity android:name=".AdminActivity" android:enabled="false"' in manifest
assert 'android:name=".GuardService"\n            android:enabled="false"' in manifest
assert 'UpdateManager.checkOnLaunch(this)' not in main
assert "vn.supra.pdalauncher.identitytest" in read(launcher, "app/build.gradle")
assert "vn.supra.identitytest" in read(client, "app/build.gradle")
print("D173 existing Firebase user -> Launcher -> test-client auto SSO source guard PASS")
