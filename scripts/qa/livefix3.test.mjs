/* LIVEFIX3 · (1) Ainsley's schedule section (kid-ainsley) shows no digit, time or date (weekday words only), no countdown
   and no away-window end; the header clock is chrome and is left alone; the boys' pages are byte-identical.
   (2) Atlas: the hub (sheet-index, Dan's phone view) gets the narrow away exception (conferences show, practice and
   skate stay hidden); opened from the wall (?from=wall) and on wall.html the strict away law stands.
   Real browser (scripts/qa/livefix3_viewport.py) on synthetic fixtures (Smith/QXS/Jones stand-ins). */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };
function run(mode, w = 440, h = 956) {
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/livefix3_viewport.py"), mode, String(w), String(h)], { encoding: "utf8", timeout: 240000 });
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.deepEqual(o.errors, [], mode + " page errors");
  return o;
}

test("Ainsley page at 440 and 1920 (feed via the hub route /api/private/*.json): no digit, date or away-window end outside the header clock", SKIP, () => {
  for (const [w, h] of [[440, 956], [1920, 1080]]) {
    const o = run("ainsley", w, h);
    assert.ok(o.hub_hits > 0, "fed through /api/private/ " + JSON.stringify(o));
    assert.ok(o.state.texts > 3, JSON.stringify(o));
    assert.deepEqual(o.state.digits, [], w + " " + JSON.stringify(o));
    assert.deepEqual(o.state.endDate, [], w + " " + JSON.stringify(o));
  }
});

test("hub on an away day: conferences show, practice and skate hidden; from the wall and on the wall: nothing", SKIP, () => {
  const hub = run("hub").state;
  assert.ok(hub.conf >= 2, JSON.stringify(hub));
  assert.equal(hub.practice, 0); assert.equal(hub.skate, 0);
  for (const m of ["hubwall", "wall"]) {
    const s = run(m).state;
    assert.equal(s.conf + s.practice + s.skate, 0, m + " " + JSON.stringify(s));
  }
});

test("the boys' pages are byte-identical to main 442eb257", () => {
  const d = execFileSync("git", ["diff", "--name-only", "442eb25762967d4a1e7de1de70cd0991e15e0426", "--", "kid-hayes.html", "kid-harris.html", "kid-hayes-pre-theme.html", "kid-harris-pre-theme.html"], { cwd: ROOT }).toString().trim();
  assert.equal(d, "");
});
