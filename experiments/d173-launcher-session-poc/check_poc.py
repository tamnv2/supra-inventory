from pathlib import Path

root = Path(__file__).parent
launcher = root / "launcher"
client = root / "test-client"
main = (launcher / "app/src/main/java/vn/supra/pdalauncher/MainActivity.java").read_text()
hand = (launcher / "app/src/main/java/vn/supra/pdalauncher/HandoffActivity.java").read_text()
session = (launcher / "app/src/main/java/vn/supra/pdalauncher/TestSessionStore.java").read_text()
receiver = (launcher / "app/src/main/java/vn/supra/pdalauncher/SessionCommandReceiver.java").read_text()
manifest = (launcher / "app/src/main/AndroidManifest.xml").read_text()
client_manifest = (client / "app/src/main/AndroidManifest.xml").read_text()
client_main = (client / "app/src/main/java/vn/supra/identitytest/MainActivity.java").read_text()

assert "TestSessionStore.isUnlocked(this)" in main
assert 'Xác nhận định danh' in main
assert 'isValidFormat' in session
assert 'package vn.supra.pdalauncher' in main
assert 'getCallingPackage()' in hand
assert 'PackageManager.SIGNATURE_MATCH' in hand and 'PackageManager.SIGNATURE_MATCH' in receiver
assert 'REQUEST_LOGOUT' in receiver and 'SESSION_CHANGED' in session
assert 'SESSION_CONTROL' in manifest and 'SESSION_CONTROL' in client_manifest
assert 'getPackageManager().checkSignatures' in client_main
assert 'android.permission.INTERNET' not in manifest
assert 'android.permission.INTERNET' not in client_manifest
assert 'android.intent.category.HOME' not in manifest
assert 'android:enabled="false"' in manifest
assert 'vn.supra.pdalauncher.identitytest' in (launcher / 'app/build.gradle').read_text()
assert 'vn.supra.identitytest' in (client / 'app/build.gradle').read_text()
assert 'signInWithCustomToken' not in client_main
# Never ship a credential as a hidden value inside a public APK.
assert not any('Supra@123' in p.read_text(errors='ignore')
               for p in root.rglob('*') if p.is_file() and '.git' not in p.parts)
print("PoC static separation and token-safety checks PASS (not runtime or Firebase FIELD PASS)")
