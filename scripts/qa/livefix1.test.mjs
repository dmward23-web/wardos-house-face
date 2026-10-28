/* LIVEFIX1 · (1) Ainsley's rows carry no digit, time, date, star, $ or % on any board that paints kids-week
   (house-face-law.js cleanKidsWeek: kid-ainsley, hub, Dad, sheet-allowance, sheet-chores); the boys keep their times.
   (2) therapy rows (generic words in house-face-law.js, provider / person names in the box-only privacy-block.txt)
   never reach any board: dropped at the glass (cleanFeed / keepEvent / cleanKidsWeek) and at ingest by the builders
   (scripts/private-dir.mjs externalEvents for cal-from-events + calendar-refresh, scripts/cal-months.py).
   Synthetic stand-ins only (Smith / QXS / Jones); the real lists are never read. */
import { assertSealed } from "./temp-home.mjs";   // TEMPHOME1
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
assertSealed(); createRequire(import.meta.url)(path.join(ROOT, "house-face-law.js"));
const L = globalThis.HouseFaceLaw;
const AIN_BAD = /[\d$%\u2605\u2606\u2b50]/;

function week() {
  return {
    kids: {
      ainsley: {
        id: "ainsley", name: "Ainsley",
        appointments: [{ when: "Mon 26 · 2:20", what: "Smith appt", hint: "with Dad" }, { when: "Mon 26 · 9:00", what: "Dentist" }],
        sports: [{ when: "Tue 27 · leave 4:25", what: "Ainsley swim", hint: "YOUR board" }],
        rides: [{ id: "swim", what: "Swim", when: "Tue/Thu · leave 4:25", hours: "leave 4:25 · 5:00" }],
        school: [{ when: "Thu 29 · All day", what: "No School" }],
        hottest: { when: "THU 29 · 4:25", what: "SWIM", badges: ["THU", "4:25"] },
        missions: [{ when: "Weekly", what: "Laundry = 5 stars · $20 payday · 50%" }],
        streakLabel: "4-day streak",
      },
      hayes: { id: "hayes", name: "Hayes", sports: [{ when: "Tue 27 · 4:25", what: "Hayes flag practice" }] },
    },
  };
}

/* DAYPKG1 item 2 (expectation refresh): the fixture rows are dated Mon 26 / Tue 27 / Thu 29 (October 2026) and were checked
   against the real wall clock, so from Tue 10-27 the Mon 26 rows count as ended and cleanKidsWeek drops them
   ("Cannot read properties of undefined (reading 'when')" on the Dentist row): a calendar failure, not a law failure.
   The test now pins the law clock (house-face-law ctNow / rowEnded read globalThis.LHClock when present) to the
   day the fixture was written, Sun 2026-10-25 12:00 CT, and restores it after; every assertion is unchanged. */
const FIXTURE_NOW = Date.parse("2026-10-25T17:00:00Z");
function atFixtureClock(fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, "LHClock"), prev = globalThis.LHClock;
  globalThis.LHClock = { now: () => new Date(FIXTURE_NOW), ms: () => FIXTURE_NOW };
  try { return fn(); } finally { if (had) globalThis.LHClock = prev; else delete globalThis.LHClock; }
}
test("Ainsley rows: no digit, time, date, star, $ or %; the boys keep their times", () => atFixtureClock(() => {
  const w = L.cleanKidsWeek(week());
  const a = w.kids.ainsley;
  const strings = JSON.stringify([a.appointments, a.sports, a.rides, a.school, a.hottest, a.missions, a.streakLabel].map((x) => x));
  const vis = [];
  (function walk(v, k) {
    if (Array.isArray(v)) v.forEach((x) => walk(x, k));
    else if (v && typeof v === "object") for (const kk of Object.keys(v)) { if (kk !== "id" && kk !== "_law") walk(v[kk], kk); }
    else if (typeof v === "string") vis.push(v);
  })([a.appointments, a.sports, a.rides, a.school, a.hottest, a.missions, a.streakLabel], "");
  for (const s of vis) assert.doesNotMatch(s, AIN_BAD, "Ainsley row shows a digit/mark: " + s + " in " + strings);
  assert.equal(a.sports[0].when, "Tue");
  assert.equal(a.appointments.find((r) => /Dentist/.test(r.what)).when, "Mon");
  assert.equal(w.kids.hayes.sports[0].when, "Tue 27 · 4:25", "the boys keep their times");
}));

test("therapy rows never reach a board (glass law): cal-live, cal-months, kids-week", () => {
  const cal = L.cleanFeed("cal-live", { upcomingLeaves: [
    { summary: "Ainsley · Smith therapy", start: "2026-10-26T14:20:00-05:00" },
    { summary: "Hayes · QXS counseling", start: "2026-10-26T15:00:00-05:00" },
    { summary: "Jones psychiatrist", start: "2026-10-26T16:00:00-05:00" },
    { summary: "Anxiety clinic · Smith", start: "2026-10-26T16:30:00-05:00" },
    { summary: "Hayes + Harris · Skate City Night · 6:00", start: "2026-10-26T18:00:00-05:00" },
  ] });
  assert.deepEqual(cal.upcomingLeaves.map((e) => e.summary), ["Hayes + Harris · Skate City Night · 6:00"]);
  assert.equal(L.keepEvent({ summary: "Smith psychologist" }), false);
  assert.equal(L.keepEvent({ summary: "Harris flag practice" }), true);
  const months = L.cleanFeed("cal-months", { days: { "2026-10-26": { withDan: true, items: [{ c: "ain", l: "Ainsley therapist · 2:20" }, { c: "har", l: "Flag 5:30" }] } } });
  assert.deepEqual(months.days["2026-10-26"].items.map((i) => i.l), ["Flag 5:30"]);
  const w = week(); w.kids.ainsley.appointments.push({ when: "Mon 26 · 3:00", what: "QXS counselor" });
  L.cleanKidsWeek(w);
  assert.ok(!w.kids.ainsley.appointments.some((r) => /counsel/i.test(r.what)));
});

function tmpHome(tag) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "livefix1-" + tag + "-"));
  fs.mkdirSync(path.join(home, ".config/wardos"), { recursive: true });
  fs.mkdirSync(path.join(home, "priv"), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(home, ".config/wardos/privacy-scrub.tsv"), "# test: no scrub rules\n");
  fs.writeFileSync(path.join(home, ".config/wardos/privacy-block.txt"), "# synthetic stand-in provider\n\\bQXS\\b\n");
  fs.writeFileSync(path.join(home, ".config/wardos/private-names.tsv"), "# synthetic stand-ins\npartner\tJones\ncoparent\tQxsmom\n");
  return home;
}
const day = (h) => "2026-10-26T" + h + ":00-05:00";
const EVENTS = { items: [
  { id: "a", summary: "Ainsley · QXS appt", start: { dateTime: day("14:20") }, end: { dateTime: day("15:00") } },
  { id: "b", summary: "Smith therapy", start: { dateTime: day("15:30") }, end: { dateTime: day("16:00") } },
  { id: "c", summary: "Harris flag practice · 5:30-6:30", start: { dateTime: day("17:30") }, end: { dateTime: day("18:30") } },
] };

test("builders drop therapy rows at ingest (private block names + generic words)", (t) => {
  const home = tmpHome("b");
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const ev = path.join(home, "events.json");
  fs.writeFileSync(ev, JSON.stringify(EVENTS));
  const env = { ...process.env, HOME: home, WARDOS_PRIVATE_DIR: path.join(home, "priv") };
  const r = spawnSync("node", ["--input-type=module", "-e",
    "import fs from 'node:fs'; import { externalEvents } from " + JSON.stringify(path.join(ROOT, "scripts/private-dir.mjs")) + ";" +
    "const e = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).items;" +
    "process.stdout.write(JSON.stringify(externalEvents(e).map((x) => x.summary)));", ev], { encoding: "utf8", env });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ["Harris flag practice · 5:30-6:30"], "cal-from-events + calendar-refresh ingest");
  const out = path.join(home, "priv", "cal-months.json");
  const py = spawnSync("python3", [path.join(ROOT, "scripts/cal-months.py"), out, ev], { encoding: "utf8", env });
  assert.equal(py.status, 0, "cal-months drops (not fails) a therapy row: " + py.stderr);
  const labels = Object.values(JSON.parse(fs.readFileSync(out, "utf8")).days).flatMap((d) => d.items.map((i) => i.l));
  assert.ok(labels.some((l) => /flag/i.test(l)), labels.join(" | "));
  assert.ok(!labels.some((l) => /QXS|therap/i.test(l)), labels.join(" | "));
});
