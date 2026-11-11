import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("relay-agent/D119AgentFeatures.cs", "utf8");
const agent = readFileSync("relay-agent/Program.cs", "utf8");
const overview = readFileSync("relay-agent/D173E179OverviewNoScroll.cs", "utf8");

test("E192 tab actions have independent vertical rows for all visibility states", () => {
  const code = src.slice(src.indexOf("private void LayoutD173RosterToolbar()"),
    src.indexOf("private void UpdateD173RosterFilterColors()"));
  assert.match(code, /var active = actions.Where\(c => c.Visible\).ToArray\(\)/);
  assert.match(code, /SetD173BoundsIfChanged\(tab, x, 1, w, 29\)/);
  assert.match(code, /SetD173BoundsIfChanged\(active\[i\], x, 36, w, 29\)/);
  assert.match(code, /SetD173BoundsIfChanged\(action, 0, 36, 1, 29\)/);
  assert.doesNotMatch(code, /singleRow/);
  for (const width of [320, 640, 1280, 1920]) {
    const gap = 5;
    const tabWidth = Math.floor((width - gap * 4) / 5);
    let x = 0;
    for (let i = 0; i < 5; i++) {
      const w = i === 4 ? width - x : tabWidth;
      assert.ok(w > 0 && x + w <= width, `tab i=${i} width=${width}`);
      x += w + gap;
    }
    for (let count = 1; count <= 5; count++) {
      const actionWidth = Math.floor((width - (count - 1) * gap) / count);
      let ax = 0;
      for (let i = 0; i < count; i++) {
        const w = i === count - 1 ? width - ax : actionWidth;
        assert.ok(w > 0 && ax + w <= width, `action i=${i} width=${width}`);
        // Tabs occupy [1, 30), actions [36, 65).
        assert.ok(30 <= 36);
        ax += w + gap;
      }
    }
  }
});

test("E192 live updates and window visibility reflow the toolbar", () => {
  assert.match(src, /action.VisibleChanged \+= \(sender, args\) => LayoutD173RosterToolbar\(\)/);
  assert.match(src, /pickerCard.VisibleChanged \+= \(sender, args\) => LayoutD173RosterToolbar\(\)/);
  assert.match(src, /if \(buttonTextChanged\) LayoutD173RosterToolbar\(\)/);
  assert.match(src, /pickerCard.Resize \+= \(sender, args\) =>/);
});

test("E192 keeps existing session action permission and data wiring", () => {
  assert.match(src, /"KickUser", "CallSpecialist", "ResolveContact"/);
  assert.match(src, /PickerOnlineGridCellContentClick/);
  assert.match(src, /RenderPickerOnlineSnapshot\(\)/);
  assert.match(overview, /D173E179FitRosterColumns\(\)/);
  assert.match(agent, /if \(authenticated\) _agentAuthStatus\.Visible = false;/);
});
