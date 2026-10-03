/* OCT8 5-7 · stale content follows its data, nav labels name their page, the preview reads its own data. */
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
test("5a: a wall source chip from an earlier day carries its weekday", () => {
  assert.match(read("wall.html"), /OCT8-5a[\s\S]{0,200}ctDay\(sm\) !== ctDay\(now\)/);
});
test("5b: the pack page reads house-mode.json and has no frozen Kids home now / Fri Oct 2", () => {
  const s = read("sheet-pack.html");
  assert.match(s, /data\/house-mode\.json/);
  for (const bad of [/now → Fri 3:00/, /Handoff · <span class="hl">Fri Oct 2/, /Fri Oct 2 handoff/, /class="tab on"/]) assert.doesNotMatch(s, bad);
});
test("5c: the trips hero comes from cal-live.json, no static Leave 9:00", () => {
  const s = read("sheet-win.html");
  assert.match(s, /data\/cal-live\.json/); assert.doesNotMatch(s, /Leave 9:00|leave 9:00/);
});
test("6: rail labels name the page they open (destinations unchanged)", () => {
  const w = read("wall.html");
  assert.match(w, /data-tile-id="rail-week"[^>]*href="sheet-index\.html#hub-home"[^>]*><span>Main board<\/span>/);
  assert.match(w, /data-tile-id="rail-weekend-fun"[^>]*href="sheet-weekend\.html#weekend-board"[^>]*><span>Our Ideas<\/span>/);
  assert.match(w, /data-tile-id="rail-week-win"[^>]*href="sheet-win\.html#win-board"[^>]*><span>Family trips<\/span>/);
});
test("7: the preview guard reads bundled data first, live only as the fallback", () => {
  const g = read("scripts/preview/preview-guard.js");
  assert.match(g, /return of\(url, opts\)\.then\(function \(r\) \{ if \(r\.ok\) return r;/);
  assert.match(g, /\.catch\(function \(\) \{ return LIVE \? of\(LIVE \+ name/);
});
