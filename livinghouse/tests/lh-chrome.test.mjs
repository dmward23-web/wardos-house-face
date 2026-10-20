// node livinghouse/tests/lh-chrome.test.mjs
// Prism P2 (v2 stills) and Alfred's test-chrome rule, checked on the shipped CSS and scripts.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("..", import.meta.url));
const src = (f) => readFileSync(dir + f, "utf8");
const css = src("lh.css");
const rule = (sel) => { const i = css.indexOf(sel + " {"); assert.ok(i >= 0, "missing rule " + sel); return css.slice(i, css.indexOf("}", i)); };

// 1. unlit candle: a wax stub with a dark wick and a melted rim, not a flat grey block
assert.match(rule(".lh-candle .wax::before"), /content: ""/, "wick pseudo element");
assert.match(rule(".lh-candle .wax::before"), /#0b0807/, "the wick is dark");
assert.match(rule(".lh-candle .wax::after"), /radial-gradient/, "melted wax rim");
const unlit = rule(".lh-candle.unlit .wax");
assert.match(unlit, /filter: none/, "unlit wax is not greyed by a filter");
assert.ok(!/saturate|grayscale|brightness/.test(unlit), "no grey-out filter on the unlit wax");
assert.match(unlit, /linear-gradient\(90deg, #b8a682/, "unlit wax keeps a warm wax tone");
assert.ok(!/candle[^"]*\.(webp|png|jpg)/.test(css), "the stub is drawn in CSS, no image asset");

// 2. the Calendar offline tag holds at least 17 px on the wall, whatever the wall scale
const ft = rule("html.lh-wall .lh-feedtag");
const m = ft.match(/font-size: max\((\d+)px/);
assert.ok(m && Number(m[1]) >= 17, "wall feed tag font floor >= 17 px");
assert.ok(css.indexOf("html.lh-wall .lh-feedtag {") > css.indexOf(".lh-feedtag {"), "the wall floor comes after the base rule");

// 3. test chrome (CLOCK OVERRIDE tag, PREVIEW tag, probe overlay, frozen clock) renders only behind a test query param
function runClock(search) {
  const made = [], listeners = {};
  const doc = { addEventListener: (t, f) => { listeners[t] = f; }, createElement: (t) => { const e = { tag: t }; made.push(e); return e; }, body: { appendChild: () => {} } };
  const win = {};
  new Function("window", "document", "location", "URLSearchParams", "performance", src("clock.js"))(win, doc, { search }, URLSearchParams, performance);
  if (listeners.DOMContentLoaded) listeners.DOMContentLoaded();
  return { C: win.LHClock, made };
}
for (const q of ["", "?rec=1", "?freeze=1", "?rec=1&freeze=1", "?now=", "?now=not-a-date", "?now=not-a-date&rec=1", "?kid=hayes&month=10"]) {
  const r = runClock(q);
  assert.equal(r.made.length, 0, "no clock tag for " + JSON.stringify(q));
  assert.equal(r.C.override, null, "no override for " + JSON.stringify(q));
  assert.equal(r.C.frozen, false, "clock never frozen for " + JSON.stringify(q));
  assert.ok(Math.abs(r.C.ms() - Date.now()) < 50, "real clock for " + JSON.stringify(q));
}
{ const r = runClock("?now=2026-10-17T13:00:00-05:00&rec=1"); assert.equal(r.made.length, 1); assert.equal(r.C.frozen, true); }
const html = src("index.html"), js = src("lh.js");
assert.match(html, /<div class="lh-preview" id="lh-preview" hidden>/, "PREVIEW tag ships hidden");
assert.ok(!/lh-clocktag|lh-probe|CLOCK OVERRIDE/.test(html + css.replace(/\.lh-(clocktag|probe)\b/g, "")), "no override or probe chrome in markup");
for (const f of ["lh.js", "lh-rules.js", "../house-face-law.js", "../away-filter.js"]) assert.ok(!/className = "lh-clocktag"|textContent = "CLOCK OVERRIDE/.test(src(f)), f + " never builds the clock tag");
const unhide = js.match(/pv\.hidden = [^;]+;/g) || [];
assert.ok(unhide.length >= 1 && unhide.every((u) => /!cu\.preview|false/.test(u)), "PREVIEW is only unhidden by the preview flag or its own param");
for (const l of js.split("\n").filter((l) => /preview: true/.test(l))) assert.match(l, /STATE === /, "the preview flag comes only from ?state");
for (const l of js.split("\n").filter((l) => /pv\.hidden = false/.test(l))) assert.match(l, /q\.get\("halloween"\) === "preview"/, "the Halloween PREVIEW needs its param");
assert.match(js, /var STATE = q\.get\("state"\)/, "?state is the only preview switch");

console.log("lh-chrome: ok");
