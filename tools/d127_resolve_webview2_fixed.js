const { chromium } = require("playwright-core");
const fs = require("fs");

const requested = process.argv[2] || "latest";
const output = process.argv[3] || "";
if (requested !== "latest" && !/^\d+(?:\.\d+){3}$/.test(requested)) {
  throw new Error("Invalid WebView2 runtime version.");
}

function compareVersions(a, b) {
  const av = a.split(".").map(Number);
  const bv = b.split(".").map(Number);
  for (let i = 0; i < 4; i++) {
    const d = (av[i] || 0) - (bv[i] || 0);
    if (d) return d;
  }
  return 0;
}

async function availableVersions(scope, page) {
  const found = new Set();
  const selects = scope.locator("select");
  for (let i = 0; i < await selects.count(); i++) {
    for (const raw of await selects.nth(i).locator("option").allTextContents()) {
      const value = raw.trim();
      if (/^\d+(?:\.\d+){3}$/.test(value)) found.add(value);
    }
  }
  if (found.size) return [...found].sort(compareVersions).reverse();

  const trigger = scope.getByText("Select Version", { exact: true });
  const globalTrigger = page.getByText("Select Version", { exact: true });
  if (await trigger.count()) await trigger.first().click();
  else if (await globalTrigger.count()) await globalTrigger.last().click();
  else throw new Error("Fixed Version selector was not found.");
  await page.waitForTimeout(350);

  const texts = await page.locator("body *").allTextContents();
  for (const raw of texts) {
    const value = raw.trim();
    if (/^\d+(?:\.\d+){3}$/.test(value)) found.add(value);
  }
  return [...found].sort(compareVersions).reverse();
}

async function chooseVersion(scope, page, version) {
  const selects = scope.locator("select");
  for (let i = 0; i < await selects.count(); i++) {
    const select = selects.nth(i);
    const options = (await select.locator("option").allTextContents()).map(v => v.trim());
    if (options.includes(version)) {
      await select.selectOption({ label: version });
      return;
    }
  }
  const option = page.getByText(version, { exact: true });
  if (!(await option.count())) {
    const trigger = scope.getByText("Select Version", { exact: true });
    const globalTrigger = page.getByText("Select Version", { exact: true });
    if (await trigger.count()) await trigger.first().click();
    else if (await globalTrigger.count()) await globalTrigger.last().click();
    await page.waitForTimeout(250);
  }
  const refreshed = page.getByText(version, { exact: true });
  if (!(await refreshed.count())) throw new Error("Requested Fixed Version is not available: " + version);
  await refreshed.last().click();
}

async function chooseX64(scope, page) {
  const selects = scope.locator("select");
  for (let i = 0; i < await selects.count(); i++) {
    const select = selects.nth(i);
    const options = (await select.locator("option").allTextContents()).map(v => v.trim());
    const match = options.find(v => /^x64$/i.test(v));
    if (match) {
      await select.selectOption({ label: match });
      return;
    }
  }
  let trigger = scope.getByText("Select Architecture", { exact: true });
  if (!(await trigger.count())) trigger = page.getByText("Select Architecture", { exact: true });
  if (!(await trigger.count())) throw new Error("Fixed Version architecture selector was not found.");
  await trigger.last().click();
  await page.waitForTimeout(250);
  const option = page.getByText(/^x64$/i, { exact: true });
  if (!(await option.count())) throw new Error("x64 Fixed Version option was not found.");
  await option.last().click();
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

  const versions = await availableVersions(scope, page);
  if (!versions.length) throw new Error("Microsoft Fixed Version list is empty.");
  const version = requested === "latest" ? versions[0] : requested;
  if (!versions.includes(version)) {
    throw new Error("Requested Fixed Version is unavailable. Available: " + versions.slice(0, 8).join(", "));
  }

  await chooseVersion(scope, page, version);
  await chooseX64(scope, page);
  await page.waitForTimeout(500);

  let downloadControl = scope.getByRole("link", { name: "Download", exact: true });
  if (!(await downloadControl.count())) downloadControl = scope.getByRole("button", { name: "Download", exact: true });
  if (!(await downloadControl.count())) downloadControl = scope.getByText("Download", { exact: true });
  if (!(await downloadControl.count())) throw new Error("Fixed Version Download control was not found.");

  const control = downloadControl.last();
  const href = await control.getAttribute("href");

  let downloadPromise = page.waitForEvent("download", { timeout: 6000 }).catch(() => null);
  await control.click();
  let download = await downloadPromise;

  if (!download) {
    const acceptCandidates = [
      page.getByRole("button", { name: /Accept and Download/i }),
      page.getByRole("link", { name: /Accept and Download/i }),
      page.getByText(/Accept and Download/i, { exact: true })
    ];
    let accept = null;
    for (const candidate of acceptCandidates) {
      const count = await candidate.count();
      for (let i = count - 1; i >= 0; i--) {
        const item = candidate.nth(i);
        if (await item.isVisible().catch(() => false)) {
          accept = item;
          break;
        }
      }
      if (accept) break;
    }
    if (!accept) {
      throw new Error("Microsoft download consent did not expose an Accept and Download control.");
    }
    downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await accept.click();
    download = await downloadPromise;
  }

  const suggested = download.suggestedFilename();
  const expected = `Microsoft.WebView2.FixedVersionRuntime.${version}.x64.cab`;
  if (suggested.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Unexpected Fixed Version filename: ${suggested}; expected ${expected}`);
  }

  if (output) {
    await download.saveAs(output);
    const stat = fs.statSync(output);
    if (stat.size < 100 * 1024 * 1024) throw new Error("Downloaded Fixed WebView2 CAB is unexpectedly small.");
    process.stdout.write(`version=${version} saved=${output} bytes=${stat.size} href=${href || "download-event"}\n`);
  } else {
    await download.cancel();
    process.stdout.write(`version=${version} resolved=${suggested} href=${href || "download-event"}\n`);
  }

  await browser.close();
})().catch(error => {
  process.stderr.write((error && error.stack) ? error.stack + "\n" : String(error) + "\n");
  process.exit(1);
});
