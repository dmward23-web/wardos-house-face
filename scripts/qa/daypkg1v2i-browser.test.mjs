/* DAYPKG1 v2i · real-browser proof for Alfred's v2h FAIL (scripts/qa/daypkg1v2i_viewport.py, Playwright Chromium over a pipe).
   Skips under QA_NO_BROWSER=1 (it is NOT in the static list). Each case is one browser, launched and closed in turn.
   1. transient '$': a MutationObserver + DOM setter hooks installed before any script, on all 4 kid boards, record 0 '$' writes
      (the feed carries a money goal on every kid); no '$' in the parsed DOM or kid storage after 65 s.
   2. sheet-allowance: [data-dad-wk] reads '$N wk' (never a star).
   3. midnight: a board open at 23:59:40 CT moves to the new day within 30 s of midnight.
   4. header / Home tap lands on sheet-index.html. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };
const D = String.fromCharCode(36);
function run(mode, page, w = 440, h = 956) {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/daypkg1v2i_viewport.py"), mode, page, String(w), String(h)], { encoding: "utf8", timeout: 180000 });
  if (process.env.V2I_DRIVER_LOG) { try { fs.appendFileSync(process.env.V2I_DRIVER_LOG, JSON.stringify({ mode, page, w, h, pid: r.pid, status: r.status, signal: r.signal }) + "\n"); } catch (e) {} }
  assert.equal(r.status, 0, mode + " " + page + " exit " + r.status + " " + String(r.stderr).slice(-500));
  return JSON.parse(r.stdout.trim().split("\n").pop());
}

for (const page of ["kid-hayes", "kid-harris", "kid-ainsley", "mercury-run"]) for (const [w, h] of [[440, 956], [1280, 800]]) {
  test("DAYPKG1 v2i browser: no transient '" + D + "' ever written on " + page + " @" + w + " (observer before scripts; money goal in the feed)", SKIP, () => {
    const o = run("kidobs", page, w, h);
    assert.ok(o.feedHits.includes("kids-week"), "the feed was served: " + JSON.stringify(o.feedHits));
    assert.deepEqual(o.state.hits, [], "transient writes " + JSON.stringify(o.state.hits));
    assert.deepEqual(o.state.domDollar, []); assert.deepEqual(o.state.storageDollar, []);
    for (const g of o.state.goal) assert.ok(!/[$\d]/.test(g[1]), JSON.stringify(g));
  });
}
test("DAYPKG1 v2i browser: sheet-allowance weekly figure reads '" + D + "N wk' (not a star)", SKIP, () => {
  for (const [w, h] of [[440, 956], [1280, 800]]) {
    const o = run("allowance", "sheet-allowance", w, h);
    const shown = o.state.filter((x) => x.text);
    assert.ok(shown.length >= 1, JSON.stringify(o.state));
    for (const x of shown) { assert.match(x.text, /^\$\d+(?:\.\d+)? wk$/, JSON.stringify(x)); assert.ok(!x.text.includes("\u2605")); }
  }
});
for (const page of ["kid-hayes", "sheet-chores"]) test("DAYPKG1 v2i browser: midnight rollover on " + page + " within 30 s (fake clock 23:59:40 CT)", SKIP, () => {
  const o = run("midnight", page);
  assert.ok(o.state.fresh, JSON.stringify(o.state));
  assert.ok(o.state.secondsAfterMidnight != null && o.state.secondsAfterMidnight >= 0 && o.state.secondsAfterMidnight <= 30, JSON.stringify(o.state));
});
for (const page of ["kid-hayes", "kid-harris", "sheet-chores", "sheet-allowance"]) test("DAYPKG1 v2i browser: header / Home tap on " + page + " lands on sheet-index", SKIP, () => {
  const o = run("home", page);
  assert.equal(o.state.landed, "/sheet-index.html", JSON.stringify(o));
});
