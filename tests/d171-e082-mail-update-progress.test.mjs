import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const activity = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
const mail = read("service/src/google-mail.ts");

test("D171 OTA reports downloaded bytes, percentage, MiB/s and an unknown-length fallback", () => {
  assert.match(activity, /connection\.contentLengthLong/);
  assert.match(activity, /received \+= count/);
  assert.match(activity, /speedBps \/ 1048576\.0/);
  assert.match(activity, /percent = .*received \* 100L/);
  assert.match(activity, /total <= 0/);
  assert.match(activity, /received != total/);
});

test("D171 OTA does not weaken signed APK and in-flight Picker verification", () => {
  assert.match(activity, /sha256\(temp\) != expected/);
  assert.match(activity, /verifyDownloadedApk\(temp, info\)/);
  assert.match(activity, /verifyInstalledSignerTrusted\(\)/);
  assert.match(activity, /if \(api\.session != null\) builder\.setNegativeButton/);
});

test("D171 no-reply cutover requires exact sender and an existing verified provider binding", () => {
  assert.match(mail, /sender !== "no-reply@supra\.cc\.cd"/);
  assert.match(mail, /if \(!env\.EMAIL\) throw new Error\("PROJECT_MAIL_SERVICE_NOT_READY"\)/);
  assert.match(mail, /await env\.EMAIL\.send/);
  assert.match(mail, /PROJECT_MAIL_SEND_FAILED_/);
  assert.match(mail, /const token = await refreshGoogleAccessToken\(env\)/);
  assert.doesNotMatch(mail, /catch[^]*?await refreshGoogleAccessToken\(env\)/);
});
