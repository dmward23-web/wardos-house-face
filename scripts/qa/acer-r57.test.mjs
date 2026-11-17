/* r57 · display-loaded boards, one title, one empty hero, and the weekend header.
   The law-absent check does not load house-event-display.js. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";

function lawOnly() {
  const box = { Intl, Date, WeakSet, decodeURIComponent };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read("house-face-law.js"), box, { filename: "house-face-law.js" });
  return box.HouseFaceLaw;
}

test("r57 the law drops mediation and the probes when the display script is absent", () => {
  const L = lawOnly();
  assert.equal(L && typeof L.cleanFeed, "function");
  const feed = L.cleanFeed("cal-live", {
    upcomingLeaves: [
      { summary: "mediation legal", start: "2026-11-20T15:00:00-06:00" },
      { summary: "H4 yes checkup", start: "2026-11-20T16:00:00-06:00" },
      { summary: "Raffle", organizer: { displayName: "therapy-token" }, start: "2026-11-20T17:00:00-06:00" },
      { summary: "Skate City Night", start: "2026-11-20T18:00:00-06:00" }
    ]
  });
  const blob = JSON.stringify(feed.upcomingLeaves || []);
  assert.equal(blob.includes("mediation"), false, blob);
  assert.equal(blob.includes("legal"), false, blob);
  assert.equal(blob.includes("H4"), false, blob);
  assert.equal(blob.includes("checkup"), false, blob);
  assert.equal(blob.includes("Raffle"), false, blob);
  assert.equal(blob.includes("therapy"), false, blob);
  assert.match(blob, /Skate City Night/);
});

let cached = null;
function board() {
  if (cached) return cached;
  const r = spawnSync("python3", [path.join(ROOT, "scripts/qa/acer_r57_board.py")], { encoding: "utf8", timeout: 180000 });
  assert.equal(r.status, 0, (r.stderr || "").slice(-800) + (r.stdout || "").slice(-500));
  cached = JSON.parse(r.stdout.trim().split("\n").pop());
  return cached;
}

test("r57 a row with three title fields renders one title", { skip: browser ? false : "SKIP no playwright" }, () => {
  const o = board();
  assert.equal(o.same, "Skate City Night", JSON.stringify(o.same));
  assert.equal(/Skate City Night Skate City Night/.test(o.same), false);
  assert.equal(o.different, "Lantern walk");
  assert.equal(/Other title|Third title/.test(o.page), false, o.page.slice(0, 400));
});

test("r57 hub, Today, and kid boards show the allowed rows and hide the probes", { skip: browser ? false : "SKIP no playwright" }, () => {
  const o = board();
  for (const title of ["Skate City Night", "costume parade", "Friends Club", "basketball", "partner dinner", "Picture day", "Soccer", "Art club"]) {
    assert.match(o.hub, new RegExp(title), "hub " + title);
    assert.match(o.today, new RegExp(title), "today " + title);
  }
  assert.match(o.hayes, /Skate City Night/);
  assert.match(o.hayes, /costume parade/);
  assert.match(o.hayes, /Friends Club/);
  assert.match(o.hayes, /basketball/);
  assert.match(o.ainsley, /partner dinner/);
  assert.match(o.ainsley, /Picture day/);
  assert.match(o.ainsley, /Soccer/);
  assert.match(o.ainsley, /Art club/);
  assert.match(o.harris, /Art club/);
  for (const blob of [o.hub, o.today, o.hayes, o.harris, o.ainsley]) {
    assert.doesNotMatch(blob, /dentist|doctor|therap|mediation|H4|Raffle/i, blob.slice(0, 300));
  }
  assert.equal(o.harrisAllDone, false, o.harrisTile);
  assert.equal(o.stripBlank, false);
});

test("r57 the hero shows the next event, or one empty line inside the safe area", { skip: browser ? false : "SKIP no playwright" }, () => {
  const o = board();
  assert.match(o.hayesHero, /Skate City Night|costume parade|Friends Club|basketball/);
  assert.equal(o.empty.count, 1, JSON.stringify(o.empty));
  assert.ok(o.empty.left >= 48 && o.empty.right <= 1872, JSON.stringify(o.empty));
  assert.equal(/NOTHING NEXT ON THE CALENDAR NOTHING NEXT/.test(o.empty.text), false, o.empty.text);
});

test("r57 the weekend header stays in the safe area without overlapping Our Ideas", { skip: browser ? false : "SKIP no playwright" }, () => {
  const o = board();
  assert.equal(o.weekend.overlap, false, JSON.stringify(o.weekend));
  assert.equal(o.weekend.leftOf, 0, JSON.stringify(o.weekend.boxes));
  assert.equal(o.weekend.clockClipped, false, JSON.stringify(o.weekend.clock));
});
