/* ALLDAY1 + NEXTLEAVE1 · node --test scripts/qa/allday-nextleave.test.mjs
   1. calendar-refresh.mjs: an all-day event (date-only start) carries allDay, reads "All day", never a clock time,
      sorts before the day's timed rows (never as noon) and stays out of the timed Next Up queue.
   2. "Next leave" (generator boardStrip.nextLeave + the hub Dad card) skips the 6:30 QXS specials note and all-day
      notes and picks the first real leave/drop (7:40 QXS drop in the fixture). Fixture only; no real data written. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const FX = path.join(ROOT, "scripts/qa/fixtures/allday-nextleave.events.json");

/* SCHOOLNAMES1 · the real school code never lives in git: the fixture uses the synthetic code QXS, handed to the
   generator as private role "school" (WARDOS_NAMES) and to the browser files through SchoolNames.setSchools. */
const SCHOOL_ENV = "school=QXS";
function generate(nowIso) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "allday-"));
  fs.mkdirSync(path.join(dir, "data"));
  fs.copyFileSync(path.join(ROOT, "scripts/qa/fixtures/private/kids-week.synthetic.json"), path.join(dir, "kids-week.json")); /* PRIVFEED1 */
  fs.copyFileSync(path.join(ROOT, "kids-data.js"), path.join(dir, "kids-data.js"));
  execFileSync("node", [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", FX, "--week", path.join(dir, "kids-week.json"), "--no-mirror", "--now", nowIso], { stdio: "pipe", env: { ...process.env, WARDOS_NAMES: SCHOOL_ENV } });
  return JSON.parse(fs.readFileSync(path.join(dir, "kids-week.json"), "utf8"));
}
const W = generate("2026-10-13T06:40:00-05:00");
const rows = (k, list) => (W.kids[k][list] || []);

/* LAW8C1 (ported in PRIVFEED3 from ALLDAYQA1) · QXS colour / dress-up days are dropped on purpose (never a row anywhere); the all-day law is checked on a
   real all-day item instead (fixture: QXS field trip, Tue 10/13). */
test("colour days never become rows (LAW8C1)", () => {
  for (const k of ["hayes", "harris", "dan", "ainsley"]) for (const list of ["today", "school", "week"])
    for (const r of rows(k, list)) assert.doesNotMatch(r.what || "", /Yellow Day|Orange Day|Green Day/, `${k}.${list}: ${r.what}`);
});

test("all-day rows read 'All day', never a clock time", () => {
  let seen = 0;
  for (const k of ["hayes", "harris", "dan"]) {
    for (const list of ["today", "school", "week"]) {
      for (const r of rows(k, list)) {
        if (/field trip/i.test(r.what || "")) {
          seen++;
          assert.match(r.when, /All day$/, `${k}.${list}: ${r.when} ${r.what}`);
          assert.doesNotMatch(r.when, /\d{1,2}:\d{2}/, `${k}.${list} prints a time: ${r.when}`);
        }
      }
    }
  }
  assert.ok(seen > 0, "field trip row present");
  assert.ok(rows("hayes", "today").some((r) => /field trip/i.test(r.what) && /All day/.test(r.when)), "field trip on Hayes today");
});

test("all-day sorts before the day's timed rows, never as noon", () => {
  const t = rows("harris", "today").map((r) => r.what);
  const ft = t.findIndex((w) => /field trip/i.test(w));
  assert.ok(ft >= 0 && ft < t.findIndex((w) => /specials/.test(w)), t.join(" | "));
});

test("all-day stays out of the timed Next Up queue", () => {
  const q = W.boardStrip.queue;
  assert.ok(q.length > 0);
  for (const it of q) {
    assert.doesNotMatch(it.summary || "", /Yellow Day|Orange Day|Green Day|Hayes Testerly/, "all-day in queue: " + it.summary);
    assert.doesNotMatch(String(it.time), /^12:00$/, "noon from an all-day: " + it.summary);
  }
});

test("Hayes Testerly is never tagged to our Hayes", () => {
  for (const list of ["today", "school", "week"]) for (const r of rows("hayes", list)) assert.doesNotMatch(r.what || "", /Testerly/);
});

test("generator nextLeave skips specials + all-day: 7:40 QXS drop", () => {
  assert.match(W.boardStrip.queue[0].summary, /QXS specials/, "fixture: queue[0] is the 6:30 specials note");
  assert.equal(W.boardStrip.queue[0].leaveBy, false);
  const nl = W.boardStrip.nextLeave;
  assert.ok(nl, "nextLeave present");
  assert.equal(nl.time, "7:40");
  assert.equal(nl.kind, "school_drop");
  assert.match(nl.place, /QXS drop/);
});

test("a title that says pickup counts as a leave whatever its kind (4:05 pickup at Quinn's)", () => {
  const quinn = W.boardStrip.queue.find((q) => /Quinn/.test(q.summary));
  assert.ok(quinn, "fixture pickup in queue");
  assert.equal(quinn.leaveBy, true);
  for (const q of W.boardStrip.queue) if (/specials/.test(q.summary)) assert.equal(q.leaveBy, false, q.summary);
});

function hubDadCard(week, nowIso) {
  const fixed = Date.parse(nowIso);
  class FDate extends Date { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } }
  const stage = { innerHTML: "" };
  const tile = { querySelector: () => null, querySelectorAll: () => [] };   /* LAW8C1 · paintAway walks the grid */
  const document = {
    readyState: "complete",
    querySelector: (sel) => (sel === ".tile.dan [data-dad-stage]" ? stage : tile),
    addEventListener() {},
  };
  const fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(week) });
  const ctx = vm.createContext({ document, fetch, Date: FDate, Intl, setInterval() {}, console, Promise, JSON, Math, String, Number, Object, Array, RegExp, Error });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "school-names.js"), "utf8"), ctx);
  ctx.SchoolNames.setSchools(["QXS"]);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-hub-tiles-bind.js"), "utf8"), ctx);
  return new Promise((r) => setTimeout(() => r(stage.innerHTML), 30));
}
const loudOf = (h) => (/<div class="kf-loud">([^<]*)</.exec(h) || [])[1];
const titleOf = (h) => (/<div class="kf-title">([^<]*)</.exec(h) || [])[1];

test("hub Dad card 'Next leave' = 7:40 QXS drop (generator output)", async () => {
  const h = await hubDadCard(W, "2026-10-13T06:40:00-05:00");
  assert.match(loudOf(h) || "", /7:40/, h);
  assert.match(titleOf(h) || "", /QXS drop/i, h);
  assert.doesNotMatch(h, /specials|Yellow Day/i, h);
});

test("hub Dad card on older data (no leaveBy flag, all-day noon row first) still skips them", async () => {
  const q = [
    { kind: "school", time: "12:00", badge: "Tue", place: "QXS Yellow Day", summary: "Hayes + Harris — QXS Yellow Day", allDay: true, startIso: "2026-10-13T17:00:00.000Z", endIso: "2026-10-14T17:00:00.000Z" },
    { kind: "school", time: "6:30", badge: "Tue", place: "QXS specials: Art", summary: "Harris — QXS specials: Art", startIso: "2026-10-13T11:30:00.000Z", endIso: "2026-10-13T11:45:00.000Z" },
    { kind: "school_drop", time: "7:40", badge: "Tue", place: "Boys QXS drop", summary: "Hayes + Harris — QXS drop-off · 7:55", startIso: "2026-10-13T12:40:00.000Z", endIso: "2026-10-13T12:55:00.000Z" },
  ];
  const h = await hubDadCard({ asOfIso: "2026-10-13", boardStrip: { queue: q }, kids: { dan: { today: [], week: [] } } }, "2026-10-13T06:40:00-05:00");
  assert.match(loudOf(h) || "", /7:40/, h);
  assert.doesNotMatch(h, /specials|Yellow Day|12:00/i, h);
});

test("kid page row parser (kids-data.js consumeParseWhen): 'Tue 13 · All day' has no clock time", () => {
  const src = fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8");
  const fn = /function consumeParseWhen\(when\) \{[\s\S]*?\n  \}\n/.exec(src);
  assert.ok(fn, "consumeParseWhen found");
  const ctx = vm.createContext({});
  vm.runInContext(fn[0] + "; this.f = consumeParseWhen;", ctx);
  const a = ctx.f("Tue 13 · All day");
  assert.equal(a.allDay, true);
  assert.equal(a.time, "");
  assert.equal(a.dow, "Tue");
  const b = ctx.f("Tue 13 · 7:40");
  assert.equal(b.allDay, false);
  assert.equal(b.time, "7:40");
});
