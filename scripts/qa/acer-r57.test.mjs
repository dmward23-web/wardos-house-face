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

test("r57 the fixture serves svg and photos as their image types", () => {
  const src = read("scripts/qa/acer_r57_board.py");
  assert.match(src, /\.svg": "image\/svg\+xml"/);
  assert.match(src, /\.png": "image\/png"/);
  assert.match(src, /\.webp": "image\/webp"/);
  assert.match(src, /\.jpg": "image\/jpeg"/);
});

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

test("TODAYFIT1 the Today header, list, and photos stay inside the panel", { skip: browser ? false : "SKIP no playwright" }, () => {
  const fit = board().todayFit;
  assert.ok(fit, "today layout was not measured");
  assert.deepEqual(fit.overlaps, [], "TODAY calendar overlaps the kid chips " + JSON.stringify(fit));
  assert.equal(fit.listInside, true, "the list leaves its panel " + JSON.stringify(fit.lb) + " panel " + JSON.stringify(fit.pb));
  assert.equal(fit.aboveRail, true, "the list crosses Musts/Jar/Days " + JSON.stringify(fit.lb) + " rail " + JSON.stringify(fit.rb));
  const total = Number(fit.total);
  assert.equal(fit.rows + fit.more, total, "visible rows + N is not the event total " + JSON.stringify({ rows: fit.rows, more: fit.more, total: fit.total }));
  assert.ok(fit.more >= 1, "the 10-row fixture must hide at least one row " + JSON.stringify({ rows: fit.rows, more: fit.more, scrollHeight: fit.scrollHeight, clientHeight: fit.clientHeight }));
  assert.equal(fit.scrollOk, true, "the list scrolls inside its box " + fit.scrollHeight + " > " + fit.clientHeight);
  assert.deepEqual(fit.clipped, [], "a shown row is cut by the list, the panel, or the rail " + JSON.stringify(fit.clipped));
  for (const t of fit.texts) assert.ok(t.sw <= t.cw + 1, "text is cut " + JSON.stringify(t));
  assert.ok(fit.imgs.length > 0, "sheet-today has no images");
  for (const img of fit.imgs) assert.ok(img.w > 0, "image did not decode " + JSON.stringify(img));
});

function channel(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function contrast(a, b) {
  const L = (rgb) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  const hi = Math.max(L(a), L(b));
  const lo = Math.min(L(a), L(b));
  return (hi + 0.05) / (lo + 0.05);
}

test("TODAYSLAB1 Today titles sit on the row chip and +N more lines up with the row text", { skip: browser ? false : "SKIP no playwright" }, () => {
  const globalInk = read("house-home.js").split("\n")[177];
  assert.match(globalInk, /html body \.lb-day-what,html body \.lb-day-tchip,html body \.leaveby-row-title,html body \.kid-what-line\{color:#f4efe6!important;-webkit-text-fill-color:#f4efe6!important;background:#101820!important/);
  const slab = board().todayFit.slab;
  assert.match(slab.titleBg, /^rgba\(0,\s*0,\s*0,\s*0\)$/, "title background is not transparent " + slab.titleBg);
  const ratio = contrast(slab.ink, slab.chip);
  assert.ok(ratio >= 4.5, "title-to-row-chip contrast " + ratio.toFixed(2) + " " + JSON.stringify({ ink: slab.ink, chip: slab.chip }));
  assert.ok(Array.isArray(slab.rows) && slab.rows.length >= 2, "TODAYSLAB1 visible rows " + (slab.rows ? slab.rows.length : 0));
  for (let i = 0; i < slab.rows.length; i++) {
    const row = slab.rows[i];
    assert.ok(row && row.ink && row.chip, "row " + i + " missing ink or chip " + JSON.stringify(row));
    const rowRatio = contrast(row.ink, row.chip);
    assert.ok(rowRatio >= 4.5, "row " + i + " title-to-row-chip contrast " + rowRatio.toFixed(2) + " " + JSON.stringify({ ink: row.ink, chip: row.chip, isNext: row.isNext }));
  }
  assert.ok(Math.abs(slab.moreX - slab.timeX) <= 2, "+N more is off the row text " + JSON.stringify({ moreX: slab.moreX, timeX: slab.timeX, rowX: slab.rowX }));
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
