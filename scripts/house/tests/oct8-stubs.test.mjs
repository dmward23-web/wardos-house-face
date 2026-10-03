/* OCT8 4 · the six stub pages: wired to real data, or no live link left pointing at them. */
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
test("Groceries reads the wall's list module and + add opens the pick list", async () => {
  const s = read("sheet-groceries.html");
  assert.match(s, /<script src="house-grocery-list\.js\?v=OCT8"><\/script>/);
  assert.match(s, /<button type="button" class="add-btn" id="gp-add"/);
  assert.match(s, /G\.load\(\{ storage: st \}\)/);
  assert.doesNotMatch(s, /<div class="fav add">\+ add favorite<\/div>/);
  const G = (await import("node:module")).createRequire(import.meta.url)(path.join(ROOT, "house-grocery-list.js"));
  assert.equal(G.STORAGE_KEY, "wardos.grocery.v1"); /* the same key the wall's quick-add chips write */
});
test("Our Ideas slots have an add handler (not just a tap sound)", () => {
  const s = read("sheet-weekend.html");
  assert.match(s, /house\.ideas\.v1/); assert.match(s, /function edit\(el, i\)/);
  assert.doesNotMatch(s, /<div class="a"[^>]*>Tap to add an idea<\/div>/, "kid cards open kid boards; they must not promise an add");
});
test("Countdowns counts down to the next calendar events", () => {
  const s = read("sheet-countdowns.html");
  assert.match(s, /id="cd-next"/); assert.match(s, /data\/cal-live\.json/); assert.match(s, /upcomingLeaves/);
});
test("Needs photo and Load day have no live link left; Dinner stays unlinked", () => {
  const w = read("wall.html");
  for (const id of ["rail-needs-photo", "rail-load-day", "rail-dinner-vote"]) assert.match(w, new RegExp(`data-tile-id="${id}" data-no-source class="badge " hidden`));
  for (const f of ["sheet-today.html", "sheet-gallery-hero.html", "sheet-index.html"]) assert.doesNotMatch(read(f), /href="sheet-load-day\.html/);
  assert.doesNotMatch(read("house-links.js"), /\["sheet-pack\.html", "\.handoff", "sheet-load-day\.html"\]/);
});
