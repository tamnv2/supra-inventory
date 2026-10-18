import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const strings = read("android/app/src/main/res/values/strings.xml");
const main = read("android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt");
const gradle = read("android/app/build.gradle.kts");
const tools = read("web/src/operational-app.ts");
const androidCi = read(".github/workflows/verify-apps.yml");
const worker = read("service/wrangler.beta.toml");

test("official Android launcher and in-app branding hide Beta", () => {
  assert.match(manifest, /android:label="1291 Báo hàng"/);
  assert.match(strings, /<string name="app_name">1291 Báo hàng<\/string>/);
  assert.doesNotMatch(manifest, /1291 Báo hàng Beta/);
  assert.doesNotMatch(main, /1291 Báo hàng Beta|Beta vc\$\{BuildConfig/);
  assert.match(main, /"vc\$\{BuildConfig\.VERSION_CODE\}/);
});

test("official public download UI does not advertise a Beta track", () => {
  assert.doesNotMatch(tools, /Beta · hoạt động/);
  assert.match(tools, /Chính thức · hoạt động/);
  assert.match(tools, /pdaAppRelease\?\.tag.*replace\(\/\^beta/);
});

test("existing signed app and updater remain in-place compatible", () => {
  assert.match(gradle, /applicationId = "cd\.cc\.supra\.inventory\.beta"/);
  assert.match(gradle, /BETA_SIGNER_SHA256/);
  assert.match(gradle, /https:\/\/inventory-beta\.supra\.cc\.cd\/downloads\/pda\/manifest/);
  assert.match(main, /\^beta-vc/);
  assert.match(main, /0\.2\.0-beta\.\$\{info\.versionCode\}/);
  assert.match(androidCi, /tag="beta-vc\$\{APP_VERSION_CODE\}"/);
});

test("same authoritative Worker and durable storage remain untouched", () => {
  assert.match(worker, /name = "supra-inventory-beta"/);
  assert.match(worker, /class_name = "InventoryCore"/);
  assert.match(worker, /pattern = "inventory-beta\.supra\.cc\.cd"/);
  assert.doesNotMatch(androidCi, /title="1291 Báo hàng Beta/);
});
