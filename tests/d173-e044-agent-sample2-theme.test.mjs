import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Owner Sample 2 native dark/light palettes use exact reference RGB", () => {
  const theme = read("relay-agent/D173E036Theme.cs");
  for (const rgb of [
    // Dark: window, sidebar, card, header, type, muted, border
    [14, 23, 38], [16, 30, 48], [25, 39, 58], [34, 53, 77],
    [228, 236, 247], [155, 173, 194], [52, 68, 90],
    // Light: window, sidebar, header, type, muted, border
    [247, 249, 252], [254, 254, 254], [237, 242, 248],
    [37, 56, 80], [101, 119, 141], [220, 229, 238],
    // Single selected-navigation/accent color, both themes.
    [0, 142, 136]
  ]) {
    assert.ok(theme.includes("Color.FromArgb(" + rgb.join(", ") + ")"), rgb.join(","));
  }
  assert.match(theme, /D173IsDarkThemeActive/);
  assert.match(theme, /D173VietnamNight/);
  assert.match(theme, /ApplyD173GridTheme/);
  assert.match(theme, /cell\.ReadOnly/);
  assert.match(theme, /control == _wmsWebViewport/);
  assert.doesNotMatch(theme, /HttpClient|Firestore|Sqlite/);
});

test("Sidebar selection and active actions use teal, never unrelated bright blue", () => {
  const sidebar = read("relay-agent/D173E038Sidebar.cs");
  const performance = read("relay-agent/D173DesktopResources.cs");
  const operations = read("relay-agent/D119AgentFeatures.cs");
  const shell = read("relay-agent/Program.cs");
  assert.match(sidebar, /selected \? palette\.Accent : palette\.Sidebar/);
  assert.doesNotMatch(sidebar, /Color\.FromArgb\(36, 116, 216\)/);
  assert.match(performance, /Color\.FromArgb\(0, 142, 136\)/);
  assert.match(performance, /Tag = "D173Sample2Card"/);
  assert.match(shell, /Tag = "D173Sample2Card"/);
  assert.match(operations, /D173Sample2Colors\(D173IsDarkThemeActive\(\)\)\.Disabled/);
  assert.doesNotMatch(operations, /\.Style\.BackColor = Color\.Gainsboro/);
});
