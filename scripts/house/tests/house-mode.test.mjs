import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { computeHouseMode, modeAt, activeOverride, loadInputs, DEFAULTS } from "../../house-mode.mjs";
import { normalizeEvents, kidsHomeSpans, ctWallMs, addDays, MODES, buildCalendar } from "../lib.mjs";
import { calendar, allDay, CONFIG, KIDS_WEEK, at, ROOT } from "./fixture.mjs";

const ctx = (cal = calendar(), override = null, config = CONFIG) => {
  const events = normalizeEvents(cal);
  return { events, spans: kidsHomeSpans(events), kidsWeek: KIDS_WEEK, config, override };
};
const m = (c, iso) => modeAt(c, at(iso)).mode;
const GUEST = { mode: "guest", since: "2026-10-01T00:00:00-05:00", until: "2026-10-20T00:00:00-05:00" };

test("labels are exactly the eight modes", () => {
  assert.deepEqual(Object.values(MODES), ["School day", "After school", "Weekend", "Day off", "Kids away", "Nashville week", "Guest", "Quiet"]);
});

test("precedence: override > Kids home > Nashville week > Kids away > Day off/Weekend > After school > School day", () => {
  /* Oct 18 (Sun): Nashville event + kids away + weekend all true */
  assert.equal(m(ctx(calendar(), GUEST), "2026-10-18T12:00:00-05:00"), "guest");
  assert.equal(m(ctx(calendar(), { ...GUEST, mode: "quiet" }), "2026-10-18T12:00:00-05:00"), "quiet");
  assert.equal(m(ctx(), "2026-10-18T12:00:00-05:00"), "nashville-week");
  /* weekday control (kids home) vs weekday in the excluded trip window (kids away) */
  assert.equal(m(ctx(), "2026-10-26T12:00:00-05:00"), "school-day"); /* control: kids home Mon */
  assert.equal(m(ctx(), "2026-10-05T12:00:00-05:00"), "kids-away");  /* trip excluded -> kids away wins */
  /* Kids home: weekend > after school > school day */
  assert.equal(m(ctx(), "2026-09-26T12:00:00-05:00"), "weekend");      /* Sat */
  assert.equal(m(ctx(), "2026-10-10T16:00:00-05:00"), "weekend");      /* Sat */
  assert.equal(m(ctx(), "2026-10-09T16:00:00-05:00"), "day-off");      /* Fri, AHH no school, kids home from 3:00 */
  assert.equal(m(ctx(), "2026-10-01T16:00:00-05:00"), "after-school");
  assert.equal(m(ctx(), "2026-10-01T09:00:00-05:00"), "school-day");
  /* Kids home beats Nashville week (handoff Friday Oct 23: trip event runs to midnight, kids home at 3:00) */
  assert.equal(m(ctx(), "2026-10-23T17:00:00-05:00"), "after-school");
});

test("handoff day: Nashville week ends the minute a 'Kids with Dan' span starts", () => {
  const c = ctx();
  assert.equal(m(c, "2026-10-23T14:59:00-05:00"), "nashville-week");
  assert.equal(m(c, "2026-10-23T15:00:00-05:00"), "school-day");       /* kids home, before 3:40 dismissal */
  assert.equal(m(c, "2026-10-23T15:40:00-05:00"), "after-school");
  assert.equal(m(c, "2026-10-23T20:30:00-05:00"), "weekend");           /* Fri night -> Sat */
  const out = computeHouseMode({ calendar: calendar(), kidsWeek: KIDS_WEEK, config: CONFIG, now: at("2026-10-23T10:00:00-05:00") });
  assert.equal(out.mode, "nashville-week");
  assert.equal(out.until, "2026-10-23T15:00:00-05:00");
  /* a trip that overlaps a whole kids-home span never shows while they're home */
  const overlap = ctx(calendar([allDay("Dan Nashville [test overlap]", "2026-09-27", "2026-09-30")]));
  assert.equal(m(overlap, "2026-09-28T10:00:00-05:00"), "school-day");
});

test("no-school weekday with the kids home = 'Day off' (not Weekend)", () => {
  const c = ctx(calendar([
    allDay("Ward Kids — no school (teacher PD)", "2026-10-27", "2026-10-28"),
    allDay("Ainsley — no school (LKMS conferences)", "2026-10-28", "2026-10-29"),
  ]));
  const r = modeAt(c, at("2026-10-27T10:00:00-05:00"));
  assert.equal(r.mode, "day-off");
  assert.equal(MODES[r.mode], "Day off");
  assert.equal(m(c, "2026-10-27T17:00:00-05:00"), "day-off");          /* no after-school on a day off */
  assert.equal(m(c, "2026-10-26T21:00:00-05:00"), "day-off");          /* Mon night -> Tue day off */
  assert.equal(m(c, "2026-10-28T10:00:00-05:00"), "school-day");       /* only one kid off = still a school day */
  assert.equal(m(c, "2026-10-24T10:00:00-05:00"), "weekend");          /* Sat stays Weekend */
  assert.equal(m(ctx(), "2026-10-09T10:00:00-05:00"), "kids-away");    /* no-school weekday, kids with their mom */
  const out = computeHouseMode({ calendar: calendar([allDay("Ward Kids — no school (teacher PD)", "2026-10-27", "2026-10-28")]), kidsWeek: KIDS_WEEK, config: CONFIG, now: at("2026-10-27T10:00:00-05:00") });
  assert.equal(out.label, "Day off");
  assert.equal(out.since, "2026-10-26T20:00:00-05:00");
  assert.equal(out.until, "2026-10-27T20:00:00-05:00");
});

test("sources: cal-live wins on the same event; 'Kids with Dan' comes from the box dump; window warning at now+7d", () => {
  const dump = calendar();
  const calLive = { status: "live", windowStart: "2026-09-25", windowEnd: "2026-10-08",
    upcomingLeaves: [{ id: "x1", summary: "Hayes + Harris — SRE drop-off · 8:25 (cal-live)", start: "2026-10-02T08:10:00-05:00", end: "2026-10-02T08:40:00-05:00", allDay: false }] };
  dump.events.push({ id: "x1", summary: "OLD TITLE", start: { dateTime: "2026-10-02T08:10:00-05:00" }, end: { dateTime: "2026-10-02T08:40:00-05:00" } });
  const both = buildCalendar([{ name: "data/cal-live.json", data: calLive, window: { from: "2026-09-25", to: "2026-10-08" } }, { name: "dump", data: dump }]);
  assert.ok(both.events.some((e) => e.id === "x1" && /cal-live/.test(e.summary)));
  assert.ok(!both.events.some((e) => e.summary === "OLD TITLE"));
  assert.equal(both.hasKidsHome, true);
  /* cal-live alone (it never publishes 'Kids with Dan'): warn, never claim Kids away */
  const liveOnly = buildCalendar([{ name: "data/cal-live.json", data: calLive, window: { from: "2026-09-25", to: "2026-10-08" } }]);
  const lo = computeHouseMode({ calendar: liveOnly, kidsWeek: KIDS_WEEK, config: CONFIG, now: at("2026-10-01T17:45:00-05:00") });
  assert.notEqual(lo.mode, "kids-away");
  assert.ok(lo.warnings.some((w) => /Kids away not evaluated/.test(w)));
  /* window: explicit cal-live window ends Oct 8 (inclusive) */
  const ok = computeHouseMode({ calendar: liveOnly, kidsWeek: KIDS_WEEK, config: CONFIG, now: at("2026-10-01T17:45:00-05:00") });
  assert.ok(!ok.warnings.some((w) => /now\+7d/.test(w)), "Oct 1 + 7d = Oct 8 is inside");
  const late = computeHouseMode({ calendar: liveOnly, kidsWeek: KIDS_WEEK, config: CONFIG, now: at("2026-10-02T00:30:00-05:00") });
  assert.ok(late.warnings.some((w) => /calendar window 2026-09-25\.\.2026-10-08 does not reach now\+7d \(2026-10-09\)/.test(w)));
  /* inferred window for a dump with no explicit bounds */
  const far = computeHouseMode({ calendar: calendar(), kidsWeek: KIDS_WEEK, config: CONFIG, now: at("2026-10-20T12:00:00-05:00") });
  assert.ok(far.warnings.some((w) => /does not reach now\+7d/.test(w)));
});

test("after school runs from SRE dismissal to 8 PM; school night after bedtime", () => {
  assert.equal(m(ctx(), "2026-10-01T15:39:00-05:00"), "school-day");
  assert.equal(m(ctx(), "2026-10-01T15:40:00-05:00"), "after-school");
  assert.equal(m(ctx(), "2026-10-01T19:59:00-05:00"), "after-school");
  assert.equal(m(ctx(), "2026-10-01T20:00:00-05:00"), "school-day"); /* Thu night -> Fri school */
  assert.equal(m(ctx(), "2026-10-16T08:00:00-05:00"), "school-day");     /* trip day 1, kids still home till 3:00 */
  assert.equal(m(ctx(), "2026-10-16T15:00:00-05:00"), "nashville-week"); /* kids leave -> Nashville week */
  assert.equal(m(ctx(), "2026-10-30T09:00:00-05:00"), "school-day"); /* Fri Oct 30, kids with Dan till 3 */
  const out = computeHouseMode({ calendar: calendar(), kidsWeek: KIDS_WEEK, config: CONFIG, now: at("2026-10-01T17:28:00-05:00") });
  assert.equal(out.mode, "after-school");
  assert.equal(out.label, "After school");
  assert.equal(out.since, "2026-10-01T15:40:00-05:00");
  assert.equal(out.until, "2026-10-01T20:00:00-05:00");
  for (const k of ["mode", "label", "since", "until", "asOfIso", "source", "reason"]) assert.ok(k in out, k);
});

test("dismissal falls back to 3:00 PM when the data has none", () => {
  const c = ctx(calendar());
  c.kidsWeek = {};
  /* Oct 30 is a Kids-with-Dan Friday with no SRE pickup event */
  assert.equal(m(c, "2026-10-29T14:59:00-05:00"), "school-day");
  assert.equal(m(c, "2026-10-29T15:00:00-05:00"), "after-school");
});

test("kids away = outside every 'Kids with Dan' span; reason says 'their mom'", () => {
  const c = ctx();
  assert.equal(m(c, "2026-10-02T14:59:00-05:00"), "school-day");
  assert.equal(m(c, "2026-10-02T15:00:00-05:00"), "kids-away");
  const r = modeAt(c, at("2026-10-06T10:00:00-05:00"));
  assert.equal(r.mode, "kids-away");
  assert.match(r.reason, /their mom/);
});

test("Oct 2–12 2026 Nashville trip never triggers Nashville week (config exclusion)", () => {
  const ex = CONFIG.nashvilleWeek.excludeDateRanges;
  assert.ok(ex.some((r) => r.from === "2026-10-02" && r.to === "2026-10-12" && r.note === "excluded per Dan"));
  const c = ctx();
  for (let d = "2026-10-02"; d <= "2026-10-12"; d = addDays(d, 1)) {
    for (let h = 0; h < 24; h++) {
      const t = ctWallMs(d, h, 30);
      assert.notEqual(modeAt(c, t).mode, "nashville-week", `${d} ${h}:30`);
    }
  }
  /* exclusion is bounded: the next real trip still lights up */
  assert.equal(m(c, "2026-10-17T12:00:00-05:00"), "nashville-week");
  /* without the exclusion the same data WOULD be Nashville week (proves the exclusion is what blocks it) */
  const noEx = ctx(calendar(), null, { ...CONFIG, nashvilleWeek: { ...CONFIG.nashvilleWeek, excludeDateRanges: [] } });
  assert.equal(m(noEx, "2026-10-05T12:00:00-05:00"), "nashville-week");
});

test("override: guest/quiet only, needs an unexpired 'until', absent by default", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "data/house-mode-override.json")), false);
  const t = at("2026-10-01T12:00:00-05:00");
  assert.equal(activeOverride({ mode: "guest" }, t), null);                                   /* no expiry */
  assert.equal(activeOverride({ mode: "guest", until: "2026-10-01T11:00:00-05:00" }, t), null); /* expired */
  assert.equal(activeOverride({ mode: "school-day", until: "2026-10-02T00:00:00-05:00" }, t), null); /* not manual */
  assert.ok(activeOverride({ mode: "Quiet", until: "2026-10-02T00:00:00-05:00" }, t));
  const out = computeHouseMode({ calendar: calendar(), kidsWeek: KIDS_WEEK, config: CONFIG, override: GUEST, now: t });
  assert.equal(out.mode, "guest");
  assert.equal(out.until, "2026-10-20T00:00:00-05:00");
});

test("real box data, if present: read-only, and no Nashville week Oct 2–12", { skip: !fs.existsSync(DEFAULTS.events) }, () => {
  const hash = () => crypto.createHash("sha256").update(fs.readFileSync(DEFAULTS.events)).digest("hex");
  const before = hash();
  const inp = loadInputs({ ...DEFAULTS, dataDir: "/workspace/wardos-house-face/data", override: "/nonexistent" });
  for (let d = "2026-10-02"; d <= "2026-10-12"; d = addDays(d, 1)) {
    const out = computeHouseMode({ ...inp, now: ctWallMs(d, 12, 0) });
    assert.notEqual(out.mode, "nashville-week", d);
  }
  assert.equal(hash(), before, "calendar file must not change");
});
