/* LIVEFIX3 · (1) Ainsley's schedule section (kid-ainsley) shows no digit, time or date (weekday words only), no countdown
   and no away-window end; the header clock is chrome and is left alone; the boys' pages are byte-identical.
   (2) Atlas: the hub (sheet-index, Dan's phone view) gets the narrow away exception (conferences show, practice and
   skate stay hidden); opened from the wall (?from=wall) and on wall.html the strict away law stands.
   Real browser (scripts/qa/livefix3_viewport.py) on synthetic fixtures (Smith/QXS/Jones stand-ins). */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
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
    assert.ok(o.state.readRows > 0, "the 'Read 20 min 3x by 7:30' quest fixture renders (scrubbed) " + JSON.stringify(o));
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

/* RESCOPE146 · byte-identical to main 442eb257 once the Halloween theme layer is stripped: the wg-glass link, the wg-assets
   script, and the data-asset* attributes on <body>. Anything else that differs is a real drift and fails. */
/* KIDWORLD1/LIVEWX2 · the theme layer also carries the shared clock + season-gate tags that load ahead of wg-assets, and
   cache tokens (?v=) on scripts the layer changed; only the token is normalized, the file name and tag must still match. */
const THEME_TAGS = /(?:<script src="livinghouse\/clock\.js\?v=[A-Z0-9]+"><\/script><script src="livinghouse\/scene-packs\.js\?v=[A-Z0-9]+"><\/script>)?<script src="wg-assets\.js(?:\?v=[A-Z0-9]+)?" defer><\/script>\n?/g;
const THEME_STRIP = (t) => t.replace(/<link rel="stylesheet" href="wg-glass\.css[^"]*" \/>\n?/g, "").replace(THEME_TAGS, "").split("\n")
  .filter((l) => !/^<link rel="stylesheet" href="wg-glass\.css[^"]*" \/>$/.test(l))
  .map((l) => l.replace(/ data-asset(?:-ph|-var|-lit)?="[^"]*"/g, "").replace(/(<script src="(?:house-clock|hayes-loot)\.js)\?v=[A-Z0-9]+"/g, '$1?v=V"'))
  .join("\n");
test("the boys' pages are byte-identical to main 442eb257 apart from the Halloween theme layer", () => {
  for (const f of ["kid-hayes.html", "kid-harris.html", "kid-hayes-pre-theme.html", "kid-harris-pre-theme.html"]) {
    const base = execFileSync("git", ["show", "442eb25762967d4a1e7de1de70cd0991e15e0426:" + f], { cwd: ROOT }).toString();
    const now = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.equal(THEME_STRIP(now), THEME_STRIP(base), f + " drifted beyond the theme layer");
  }
});
test("the theme strip is not a blanket pass: a copy change still fails", () => {
  assert.notEqual(THEME_STRIP("<p>ALL CLEAR</p>"), THEME_STRIP("<p>ALL DONE</p>"));
  assert.notEqual(THEME_STRIP('<script src="house-clock.js?v=A"></script>'), THEME_STRIP('<script src="house-lights.js?v=A"></script>'), "a swapped script still fails");
  assert.notEqual(THEME_STRIP('<script src="livinghouse/scene-packs.js?v=A"></script>'), "", "a lone season tag is not theme layer");
});
