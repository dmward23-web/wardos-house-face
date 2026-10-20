// node livinghouse/tests/no-override-leak.test.mjs
// Alfred rule (a): without ?now and ?probe, no CLOCK OVERRIDE tag and no probe overlay ever render, and the clock is real.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("..", import.meta.url));
const src = (f) => readFileSync(dir + f, "utf8");
function runClock(search) {
  const made = [], listeners = {};
  const doc = { addEventListener: (t, f) => { listeners[t] = f; }, createElement: (t) => { const e = { tag: t }; made.push(e); return e; }, body: { appendChild: () => {} } };
  const win = {};
  new Function("window", "document", "location", "URLSearchParams", "performance", src("clock.js"))(win, doc, { search }, URLSearchParams, performance);
  if (listeners.DOMContentLoaded) listeners.DOMContentLoaded();
  return { C: win.LHClock, made };
}
// 1. no params: real clock, no override, no DOM node
let r = runClock("");
assert.equal(r.C.override, null);
assert.ok(Math.abs(r.C.ms() - Date.now()) < 50, "clock must be real without ?now");
assert.equal(r.made.length, 0, "no CLOCK OVERRIDE node without ?now");
// 2. unrelated params still clean
r = runClock("?phase=night&month=10");
assert.equal(r.made.length, 0);
// 3. ?now shifts the clock and shows the tag
r = runClock("?now=2026-10-31T19:00:00-05:00");
assert.ok(Math.abs(r.C.ms() - Date.parse("2026-10-31T19:00:00-05:00")) < 1000);
assert.equal(r.made.length, 1); assert.match(r.made[0].textContent, /^CLOCK OVERRIDE 2026-10-31T19:00/);
// 4. probe: never in the page markup, injected only behind ?probe=1
const html = src("index.html"), js = src("lh.js");
assert.ok(!/probe\.js|lh-probe|lh-clocktag/.test(html), "index.html must not carry probe or override markup");
const inj = js.match(/if \(q\.get\("probe"\) === "1"\) \{[^}]*probe\.js[^}]*\}/);
assert.ok(inj, "probe.js injected only inside the ?probe=1 guard");
assert.equal((js.match(/probe\.js/g) || []).length, 1, "no other probe.js reference");
// 5. only clock.js reads the current time
for (const f of ["lh.js", "probe.js", "../phone2/leaveby.js", "../house-face-law.js"]) {
  const s = src(f).replace(/g\.LHClock \? g\.LHClock\.(now|ms)\(\) : (new Date\(\)|Date\.now\(\))/g, "");
  assert.ok(!/Date\.now\(\)|new Date\(\)/.test(s), f + " reads the current time outside clock.js");
}
console.log("no-override-leak: ok");
