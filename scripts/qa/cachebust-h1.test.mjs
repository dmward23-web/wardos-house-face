/* H1-CB (Alfred P2, gate ship-2026-10-24T0321-halloween1) · cache-bust regression, git-free (runs in a git-archive tree).
   Every script/link that halloween1 changed must not load with the ?v= token it carried before the range, or a wall/phone
   holding the old copy keeps it (house-fresh.js only reloads on a NEW stamp). Pairs = (asset, pre-range token) taken from
   the 7137f63f..e4fd7c6c check; a file that changes again later just needs a newer token than both.
   It only reads html, but it names a private-list reader asset, so it sits on the TEMPHOME1 helper like every such test. */
import { assertSealed } from "./temp-home.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
test("TEMPHOME1: sealed before reading anything", () => { assertSealed(); });
const STALE = [
  ["away-filter.js", "LIVEFIX2"],
  ["away-filter.js", "LIVEFIX3"],
  ["house-board-strip.js", "P1FIX"],
  ["house-clock.js", "PRIVFEED3"],
  ["house-face-law.js", "LIVEFIX1"],
  ["house-face-law.js", "LIVEFIX3"],
  ["house-lights.js", "FOLLOWUP6"],
  ["house-ori-calm.js", "CALM1"],
  ["house-spotify.js", "MERGE1C"],
  ["house-trips-bind.js", "PRIVFEED1"],
  ["month-theme/month-overlay.js", "MERGE1C"],
  ["night/night-host.css", "MERGE1C"],
  ["private-feed.js", "CAMREST2"],
  ["private-feed.js", "FOLLOWUP6"],
  ["school-names.js", "SCHOOLNAMES1"],
  /* H1P2D3 · wg-assets changed in the range after the kid pages' LIVEWX2B and the hub's HALLOWEEN1; the delta-3 files move off their old tokens */
  ["wg-assets.js", "LIVEWX2B"],
  ["wg-assets.js", "HALLOWEEN1"],
  ["wg-wall-land.css", "WALLFILL1"],
  ["livinghouse/lh.css", "COLDLOAD1"],
  ["livinghouse/lh.js", "LIVEWX2B"],
  ["livinghouse/scene-packs.js", "L4A"],
  ["livinghouse/scene-packs.js", "KIDWORLD2"],
  /* H1P2D4 · the wall fit block and the hashed event id move these two off delta-3 */
  ["wg-wall-land.css", "H1P2D3"],
  /* PAIRUI1 · the three scripts this commit changes move off their previous tokens */
  ["house-board-strip.js", "HUBPAIR1"],
  ["house-lights.js", "HUBPAIR1"],
  ["house-lights.js", "PAIRUI1"], /* PAIRUI1b · house-lights.js changed again */
  ["house-nest.js", "CAMREST2"],
  ["livinghouse/scene-packs.js", "H1P2D3"],
  /* HUBPAIR1 · pairing hotfix: every changed script moves off the token it carried on efd454b6 */
  ["house-hub.js", "HUBPIN1"],
  ["house-pair.js", "HUBPIN1"],
  ["private-feed.js", "HALLOWEEN1"],
  ["private-feed.js", "WGQUIET1"],
  ["house-lights.js", "HALLOWEEN1"],
  ["house-board-strip.js", "HALLOWEEN1"]
];
const SKIP = /^(scripts|tests?|plates|plates-receipt|vendor|node_modules|\.git)$/;
function pages(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.test(e.name)) pages(path.join(dir, e.name), out); }
    else if (e.name.endsWith(".html")) out.push(path.join(dir, e.name));
  }
  return out;
}
test("H1-CB · no served page loads a halloween1-changed asset with its pre-range ?v= token", () => {
  const hits = [];
  for (const f of pages(ROOT)) {
    const s = fs.readFileSync(f, "utf8"), d = path.dirname(f);
    for (const m of s.matchAll(/(?:src|href)\s*=\s*["']([A-Za-z0-9_./-]+\.(?:js|css))\?v=([A-Za-z0-9_.-]+)["']/g)) {
      const a = path.relative(ROOT, path.resolve(d, m[1]));
      if (STALE.some(([x, t]) => x === a && t === m[2])) hits.push(path.relative(ROOT, f) + " " + a + "?v=" + m[2]);
    }
  }
  assert.deepEqual(hits, []);
});
/* HUBPAIR1 · a script changed again after halloween1 carries the newer token */
const NEWER = { "house-board-strip.js": "PAIRUI1", "house-lights.js": "PAIRUI1B" }; /* PAIRUI1 · both changed again; PAIRUI1b · lights once more */
test("H1-CB · the six named scripts are re-tokened on the pages that load them", () => {
  const want = { "house-board-strip.js": "sheet-index.html", "house-lights.js": "sheet-lights.html", "house-ori-calm.js": "sheet-index.html",
    "house-spotify.js": "sheet-spotify.html", "house-trips-bind.js": "sheet-us.html", "school-names.js": "kid-hayes.html" };
  for (const [a, f] of Object.entries(want))
    assert.match(fs.readFileSync(path.join(ROOT, f), "utf8"), new RegExp('src="' + a.replace(/[.]/g, "\\.") + '\\?v=' + (NEWER[a] || "HALLOWEEN1") + '"'), a + " in " + f);
});
test("H1-CB · the check is not a blanket pass", () => {
  assert.ok(STALE.some(([a, t]) => a === "house-lights.js" && t === "FOLLOWUP6"));
});
