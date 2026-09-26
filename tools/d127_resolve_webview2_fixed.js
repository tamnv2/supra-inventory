const { chromium } = require("playwright-core");
const fs = require("fs");

const version = process.argv[2];
const output = process.argv[3] || "";
if (!/^\d+(?:\.\d+){3}$/.test(version || "")) {
  throw new Error("Invalid WebView2 runtime version.");
}

async function clickTextInScope(scope, page, text) {
  const exact = scope.getByText(text, { exact: true });
  if (await exact.count()) {
    await exact.first().click();
    return true;
  }
  const global = page.getByText(text, { exact: true });
  if (await global.count()) {
    await global.last().click();
    return true;
  }
  return false;
}

async function selectNative(scope, wanted, predicate) {
  const selects = scope.locator("select");
  for (let i = 0; i < await selects.count(); i++) {
    const select = selects.nth(i);
    const options = await select.locator("option").allTextContents();
    const match = options.map(v => v.trim()).find(predicate);
    if (match) {
      await select.selectOption({ label: match });
      return true;
    }
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(
    "https://developer.microsoft.com/en-us/microsoft-edge/webview2?form=MA13LH#download-section",
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.getByText("Fixed Version", { exact: true }).first().waitFor();
  await page.waitForTimeout(2500);

  const fixed = page.getByText("Fixed Version", { exact: true }).first();
  let scope = fixed.locator(
    'xpath=ancestor::*[.//*[normalize-space(.)="Select Version"] and .//*[normalize-space(.)="Select Architecture"]][1]'
  );
  if (!(await scope.count())) scope = page.locator("body");

  let versionSelected = await selectNative(
    scope,
    version,
    value => value === version
  );
  if (!versionSelected) {
    const opened = await clickTextInScope(scope, page, "Select Version");
    if (!opened) throw new Error("Fixed Version selector was not found.");
    await page.waitForTimeout(250);
    const option = page.getByText(version, { exact: true });
    if (!(await option.count())) {
      throw new Error("Requested Fixed Version is not available on Microsoft's page: " + version);
    }
    await option.last().click();
    versionSelected = true;
  }

  let archSelected = await selectNative(
    scope,
    "x64",
    value => /^x64$/i.test(value)
  );
  if (!archSelected) {
    const opened = await clickTextInScope(scope, page, "Select Architecture");
    if (!opened) throw new Error("Fixed Version architecture selector was not found.");
    await page.waitForTimeout(250);
    const option = page.getByText(/^x64$/i, { exact: true });
    if (!(await option.count())) throw new Error("x64 Fixed Version option was not found.");
    await option.last().click();
    archSelected = true;
  }

  await page.waitForTimeout(500);

  let downloadControl = scope.getByRole("link", { name: "Download", exact: true });
  if (!(await downloadControl.count())) {
    downloadControl = scope.getByRole("button", { name: "Download", exact: true });
  }
  if (!(await downloadControl.count())) {
    downloadControl = scope.getByText("Download", { exact: true });
  }
  if (!(await downloadControl.count())) throw new Error("Fixed Version Download control was not found.");

  const control = downloadControl.last();
  const href = await control.getAttribute("href");
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await control.click();
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  const expected = `Microsoft.WebView2.FixedVersionRuntime.${version}.x64.cab`;
  if (suggested.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Unexpected Fixed Version filename: ${suggested}; expected ${expected}`);
  }

  if (output) {
    await download.saveAs(output);
    const stat = fs.statSync(output);
    if (stat.size < 100 * 1024 * 1024) {
      throw new Error("Downloaded Fixed WebView2 CAB is unexpectedly small.");
    }
    process.stdout.write(`saved=${output} bytes=${stat.size} href=${href || "download-event"}\n`);
  } else {
    await download.cancel();
    process.stdout.write(`resolved=${suggested} href=${href || "download-event"}\n`);
  }

  await browser.close();
})().catch(error => {
  process.stderr.write((error && error.stack) ? error.stack + "\n" : String(error) + "\n");
  process.exit(1);
});
