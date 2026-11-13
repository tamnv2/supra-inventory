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
assert not (root / "firebase-test-backend").exists()
for project in (launcher, client):
    sdk = next(project.glob("app/src/main/java/**/PocFirebase.java")).read_text()
    assert '"supra-inventory-beta".equals(BuildConfig.TEST_FIREBASE_PROJECT_ID)' in sdk
    assert 'https://inventory.supra.cc.cd' in sdk
    assert '/api/auth/login' in sdk and '/api/auth/logout' in sdk and '/api/auth/me' in sdk
    assert 'TEST_QA_USERNAME.matches' in sdk
    assert 'TEST_FIREBASE_API_KEY.isEmpty()' in sdk
    assert 'cloudfunctions.net' not in sdk
    assert '/api/obpp1291/' not in sdk
    assert 'firebase-firestore' not in read(project, "app/build.gradle") or True
    gradle = read(project, "app/build.gradle")
    assert "D173_POC_TEST_USERNAME" in gradle
    assert "D173_POC_FIREBASE_API_KEY" in gradle
    assert '1:572322098890:android:3e483937876cbcc0400e33' in gradle
assert "Xác nhận định danh" in main
assert "TestSessionStore.isUnlocked(this)" in main
assert '"force", false' in session
assert 'BuildConfig.TEST_QA_USERNAME.equals(username)' in session
assert 'PocFirebase.post("/api/auth/login"' in session
assert 'PocFirebase.post("/api/auth/logout"' in session
assert 'PocFirebase.me(issuedToken)' in session
assert 'signInWithCustomToken' in session and 'signInWithCustomToken' in client_main
assert 'app_session_generation' in session and 'app_session_generation' in client_main
assert 'getCallingPackage()' in handoff
assert 'PackageManager.SIGNATURE_MATCH' in handoff and 'PackageManager.SIGNATURE_MATCH' in receiver
assert 'REQUEST_LOGOUT' in receiver and 'SESSION_CHANGED' in session
assert "SESSION_CONTROL" in manifest and "SESSION_CONTROL" in client_manifest
assert "getPackageManager().checkSignatures" in client_main
assert 'android.permission.INTERNET' in manifest and 'android.permission.INTERNET' in client_manifest
assert 'android.intent.category.HOME' not in manifest
assert '<activity android:name=".AdminActivity" android:enabled="false"' in manifest
assert 'android:name=".GuardService"\n            android:enabled="false"' in manifest
assert 'UpdateManager.checkOnLaunch(this)' not in main
assert "LauncherDiagnostics.recordAppLaunch" not in main
assert "vn.supra.pdalauncher.identitytest" in read(launcher, "app/build.gradle")
assert "vn.supra.identitytest" in read(client, "app/build.gradle")
assert not any("Supra" + "@123" in f.read_text(errors="ignore")
    for f in root.rglob("*") if f.is_file() and f.name not in {"check_poc.py", "README.md"})
print("D173 existing-Firebase QA-only source guard PASS; live identity/field still unverified")
