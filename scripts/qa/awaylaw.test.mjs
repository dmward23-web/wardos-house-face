// AWAYLAW1 · away-filter.js unit test on synthetic data only (PF4: no real calendar in git).
// Away days come only from cal-months withDan: scripts/qa/fixtures/private/cal-months.synthetic.json marks
// Mon 10/19 to Sun 10/25 as away, so with the 3:00 PM switch the window is Sun 10/18 3:00 PM to Mon 10/26 3:00 PM CT.
// Run: node --test scripts/qa/awaylaw.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const A = require(join(root, "away-filter.js"));
const months = JSON.parse(readFileSync(join(root, "scripts/qa/fixtures/private/cal-months.synthetic.json"), "utf8"));
function at(iso) { globalThis.location = { search: "?now=" + encodeURIComponent(iso) }; A.setMonths(months); }
const ms = (s) => Date.parse(s);
const LIVE = () => ({ upcomingLeaves: [
  { summary: "Harris flag football · 9:00", start: "2026-10-24T09:00:00-05:00" },
  { summary: "Hayes dentist", start: "2026-10-21T15:30:00-05:00" },
  { summary: "Ainsley piano", start: "2026-10-27T16:00:00-05:00" },
  { summary: "Dan dinner downtown", start: "2026-10-21T19:00:00-05:00" },
  { summary: "Pizza night", start: "2026-10-22T18:00:00-05:00" },
  { summary: "No School", start: "2026-10-23", end: "2026-10-24", allDay: true }
] });
const WEEK = () => ({ kids: {
  hayes: { name: "Hayes", today: [{ when: "Wed 21 · 3:30", what: "Hayes dentist" }, { when: "Tue 27 · 4:00", what: "Hayes practice" }], hottest: { when: "Wed 21 · 3:30", what: "Hayes dentist" } },
  dan: { name: "Dan", today: [{ when: "Wed 21 · 7:00", what: "Dinner downtown" }] }
}, boardStrip: { queue: [{ summary: "Harris flag football", startIso: "2026-10-24T09:00:00-05:00" }, { summary: "Ainsley piano", startIso: "2026-10-27T16:00:00-05:00" }] } });

test("window from cal-months withDan and the feed's changeMin (900): Sun 10/18 3:00 PM to Mon 10/26 3:00 PM CT", () => {
  A.setMonths({ ...months, changeMin: 900 });
  assert.equal(A.isAwayAt(ms("2026-10-18T14:59:00-05:00")), false);
  assert.equal(A.isAwayAt(ms("2026-10-18T15:00:00-05:00")), true);
  assert.equal(A.isAwayAt(ms("2026-10-20T16:00:00-05:00")), true);
  assert.equal(A.isAwayAt(ms("2026-10-26T14:59:00-05:00")), true);
  assert.equal(A.isAwayAt(ms("2026-10-26T15:00:00-05:00")), false);
  assert.equal(A.isAwayAt(ms("2026-10-27T09:00:00-05:00")), false);
});

for (const nowIso of ["2026-10-20T16:00:00-05:00", "2026-10-22T10:00:00-05:00"]) {
  test("?now=" + nowIso + " · cal-live: no kid event inside the away window, adult items stay", () => {
    at(nowIso);
    const out = A.filterCalLive(LIVE());
    const s = out.upcomingLeaves.map((e) => e.summary);
    assert.ok(!s.includes("Harris flag football · 9:00") && !s.includes("Hayes dentist") && !s.includes("No School"), s.join(" | "));
    for (const keep of ["Ainsley piano", "Dan dinner downtown", "Pizza night"]) assert.ok(s.includes(keep), keep);
  });
  test("?now=" + nowIso + " · cal-months: no kid item on away days, withDan stays for Month", () => {
    at(nowIso);
    const out = A.filterCalMonths(JSON.parse(JSON.stringify(months)));
    for (const d of ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]) {
      const kid = (out.days[d].items || []).filter((it) => A.isKidItem({ c: it.c, l: it.l }));
      assert.deepEqual(kid.map((x) => x.l), [], d);
    }
    assert.equal(out.days["2026-10-20"].withDan, false, "withDan must stay for Month");
  });
  test("?now=" + nowIso + " · kids-week: no timed kid row, hottest or strip item inside the window", () => {
    at(nowIso);
    const out = A.filterKidsWeek(WEEK());
    for (const r of out.kids.hayes.today || []) { const w = A.whenOf(r, ms(nowIso)); if (w && w.ms) assert.equal(A.isAwayAt(w.ms), false, r.when + " " + r.what); }
    if (out.kids.hayes.hottest) { const w = A.whenOf(out.kids.hayes.hottest, ms(nowIso)); if (w && w.ms) assert.equal(A.isAwayAt(w.ms), false, "hottest"); }
    assert.equal((out.kids.dan.today || []).length, 1, "Dan's own entry keeps adult times");
    for (const q of out.boardStrip.queue) assert.equal(A.isAwayAt(ms(q.startIso)), false, q.summary);
  });
}

test("glass: NOCUSTODY phrases are dropped, nothing computed in their place", () => {
  const CUST = /kids away|back (mon|tue|wed|thu|fri|sat|sun)|kids with|dad week|mom['’]?s week|their mom|hand-?offs?/i;
  for (const s of ["kids away · back Mon Oct 26 · 3:00", "Kids away · Back Fri", "KIDS AWAY", "mom’s week", "Kids with Dan", "Kids handoff · Fri Oct 16"]) {
    assert.equal(A.glass(s), "", s);
  }
  assert.equal(A.glass("Fri Oct 16 · Dad week · chores"), "Fri Oct 16 · chores");
  assert.equal(A.glass("Pack · Kids away · 3:00 · Swim"), "Pack · Swim");
  for (const s of ["Dinner with Dad · 6:00", "Hayes swim · 4:00", "Week tile"]) assert.equal(A.glass(s), s, "other text untouched: " + s);
  for (const s of ["kids away · back Mon Oct 26 · 3:00", "Pack · Kids away · 3:00 · Swim", "Fri Oct 16 · Dad week · chores"]) assert.doesNotMatch(A.glass(s), CUST, s);
});

test("TEXTLAW3 · a bare 'No School' row is still a kid item and hides on away days; the school code reads 'school'", () => {
  at("2026-10-20T16:00:00-05:00");
  for (const t of ["No School", "Early Release" /* privacy-scan:allow calendar_string */, "1/2 Day", "Smith Club · No School", "school pickup · 3:40", "Hayes flag"]) assert.equal(A.isKidText(t), true, t);
  assert.equal(A.isKidText("Pizza night"), false);
  const now = ms("2026-10-20T16:00:00-05:00");
  assert.equal(A.keepItem({ summary: "No School", start: "2026-10-22", end: "2026-10-23", allDay: true }, now), false, "Thu 10/22 is an away day");
  assert.equal(A.keepItem({ summary: "No School", start: "2026-10-27", end: "2026-10-28", allDay: true }, now), true, "Tue 10/27 is Dan's");
});

test("isKidText: a school-coded row is a kid row once the private names route has the code (SCHOOLNAMES1; stand-in QXS)", () => {
  const SN = require(join(root, "school-names.js"));
  assert.equal(A.isKidText("QXS book fair · 6:00"), false, "no codes known: not classified");
  SN.setSchools(["QXS"]);
  try {
    assert.equal(A.isKidText("QXS book fair · 6:00"), true);
    assert.equal(A.isKidText("Dan dentist · 6:00"), false);
  } finally { SN.setSchools(null); }
});
