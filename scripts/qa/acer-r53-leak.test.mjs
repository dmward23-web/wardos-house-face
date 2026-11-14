/* F1 F2 F3 F5. Synthetic tokens only. Boy and health words are assembled at runtime. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const bit = (...p) => p.join("");
const WHEN = "2026-11-16T19:00:00-06:00";
const BOY = bit("Harr", "is");
const HEALTH = bit("dent", "ist");

function boot() {
  const ctx = {
    Intl, Date, decodeURIComponent, WeakSet,
    document: { readyState: "complete", write() {}, documentElement: { getAttribute() { return null; }, setAttribute() {} }, addEventListener() {} },
    location: { pathname: "/sheet-dan.html" }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("house-event-display.js"), ctx);
  vm.runInContext(read("house-face-law.js"), ctx);
  return ctx;
}

test("r53 F1 a container-key row is classified and does not keep a raw title", () => {
  const L = boot().HouseFaceLaw;
  const feed = L.cleanFeed("cal-live", { upcomingLeaves: [{ summary: BOY + " " + HEALTH, kids: {}, start: WHEN, end: "2026-11-16T20:00:00-06:00" }] });
  const blob = JSON.stringify(feed);
  assert.equal(blob.includes(BOY), false, blob);
  assert.equal(blob.includes(HEALTH), false, blob);
});

test("r53 F2 a subject or name title is classified before the page holds it", () => {
  const L = boot().HouseFaceLaw;
  const feed = L.cleanFeed("kids-week", { kids: { ainsley: { today: [{ subject: BOY + " " + bit("clin", "ic") }, { name: bit("Hay", "es ") + bit("ther", "apy") }] } } });
  const blob = JSON.stringify(feed.kids.ainsley.today);
  assert.equal(blob.includes(BOY), false, blob);
  assert.equal(blob.includes("Hay"), false, blob);
});

test("r53 F3 a disguised boy-name plus health drops on Dad's board", () => {
  const D = boot().HouseEventDisplay;
  const rows = [
    { what: "H4 yes " + bit("check", "up"), startIso: WHEN },
    { what: "H@yes " + bit("allerg", "ist"), startIso: WHEN },
    { what: bit("Harr", "1s ") + bit("spe", "ech"), description: "#wardos-show", startIso: WHEN }
  ];
  for (const row of rows) assert.equal(D.summarize(row, "dan"), null, JSON.stringify(row.what));
});

test("r53 F5 an id or startIso cannot carry a boy-name plus health string", () => {
  const L = boot().HouseFaceLaw;
  const feed = L.cleanFeed("cal-live", { upcomingLeaves: [{ summary: "Swim", id: BOY + "-therapy-clinic", startIso: WHEN + " " + bit("Hay", "es ") + bit("ther", "apy"), start: WHEN }] });
  const row = feed.upcomingLeaves[0];
  const blob = JSON.stringify(row);
  assert.equal(blob.includes(BOY), false, blob);
  assert.equal(blob.includes("Hay"), false, blob);
  assert.equal(row.startIso, WHEN);
});
