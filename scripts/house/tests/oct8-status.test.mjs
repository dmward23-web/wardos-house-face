/* OCT8-2 · the status page every freshness tap opens is live per-feed status, not a build plate. */
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import vm from "node:vm"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
test("status page: #status-feeds is the live list; no static build summary or 'not connected' calendar line", () => {
  const s = read("sheet-status.html");
  assert.match(s, /id="status-feeds"/); assert.match(s, /id="status-feed-list"/); assert.match(s, /house-status-feeds\.js/);
  for (const bad of [/Pages built/, /Template lock/, /Calendar wire/, /not connected/, /Promo-ready/, /through Fri Oct 2/]) assert.doesNotMatch(s, bad);
});
test("house-status-feeds reads each feed's own stamp", () => {
  const src = read("house-status-feeds.js");
  const ctx = { window: {}, document: { readyState: "loading", addEventListener() {} }, setInterval() {}, fetch() {} }; ctx.window = ctx;
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const F = ctx.HouseStatusFeeds;
  assert.equal(F.stampOf({ fetchedAt: "a", generatedAt: "b" }), "a");
  assert.equal(F.stampOf({ generatedAt: "b" }), "b");
  assert.equal(F.stampOf({}), "");
  const files = F.FEEDS.map((x) => x[1]);
  for (const f of ["cal-live.json", "kids-week.json", "sensi-live.json", "nest-live.json", "lights-live.json", "house-mode.json", "next-up.json", "school-night.json", "kid-seats.json"]) assert.ok(files.includes(f), f + " (a wall source chip) is listed");
});
