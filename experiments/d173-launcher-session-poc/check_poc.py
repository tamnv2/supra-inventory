from pathlib import Path
root = Path(__file__).parent
launcher = root / "launcher"
client = root / "test-client"
server = root / "firebase-test-backend"
read = lambda base, path: (base / path).read_text()
main = read(launcher, "app/src/main/java/vn/supra/pdalauncher/MainActivity.java")
handoff = read(launcher, "app/src/main/java/vn/supra/pdalauncher/HandoffActivity.java")
session = read(launcher, "app/src/main/java/vn/supra/pdalauncher/TestSessionStore.java")
receiver = read(launcher, "app/src/main/java/vn/supra/pdalauncher/SessionCommandReceiver.java")
manifest = read(launcher, "app/src/main/AndroidManifest.xml")
client_manifest = read(client, "app/src/main/AndroidManifest.xml")
app = read(client, "app/src/main/java/vn/supra/identitytest/MainActivity.java")
backend = read(server, "index.mjs")
logic = read(server, "session-logic.mjs")
for project in [launcher, client]:
    sdk = next(project.glob("app/src/main/java/**/PocFirebase.java")).read_text()
    assert "TEST_FIREBASE_PROJECT_ID" in sdk
    assert "supra-d173-poc-[a-z0-9-]" in sdk
    assert "FirebaseAuth.getInstance" in sdk
    assert "custom_token" not in sdk
assert "Xác nhận định danh" in main
assert "TestSessionStore.isUnlocked(this)" in main
assert "signInWithEmailAndPassword" in session
assert "getCallingPackage()" in handoff
assert "PackageManager.SIGNATURE_MATCH" in handoff and "PackageManager.SIGNATURE_MATCH" in receiver
assert 'REQUEST_LOGOUT' in receiver and 'SESSION_CHANGED' in session
assert "SESSION_CONTROL" in manifest and "SESSION_CONTROL" in client_manifest
assert "getPackageManager().checkSignatures" in app
assert "signInWithCustomToken" in app
assert "getIdToken(true)" in app
assert "poc_session_generation" in app
assert "firebase_uid" in app
assert "canRedeem" in backend and "createCustomToken" in backend
assert "ensureDedicatedTestProject(project)" in backend
assert "NOT_DEDICATED_TEST_PROJECT" in logic
assert "android.permission.INTERNET" in manifest and "android.permission.INTERNET" in client_manifest
assert "android.intent.category.HOME" not in manifest
assert '<activity android:name=".AdminActivity" android:enabled="false"' in manifest
assert 'android:name=".GuardService"\n            android:enabled="false"' in manifest
assert "UpdateManager.checkOnLaunch(this)" not in main
assert "LauncherDiagnostics.recordAppLaunch" not in main
assert "vn.supra.pdalauncher.identitytest" in read(launcher,"app/build.gradle")
assert "vn.supra.identitytest" in read(client, "app/build.gradle")
assert not any('Supra@123' in p.read_text(errors="ignore") for p in root.rglob("*")
    if p.is_file() and p.name not in {"check_poc.py", "README.md"})
print("Dedicated Firebase test source guard PASS; NOT a live Firebase/field assertion")
