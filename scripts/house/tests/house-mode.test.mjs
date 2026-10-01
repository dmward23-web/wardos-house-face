import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { computeHouseMode, modeAt, activeOverride, loadInputs, DEFAULTS } from "../../house-mode.mjs";
import { normalizeEvents, kidsHomeSpans, ctWallMs, addDays, MODES } from "../lib.mjs";
import { calendar, CONFIG, KIDS_WEEK, at, ROOT } from "./fixture.mjs";

const ctx = (cal = calendar(), override = null, config = CONFIG) => {
  const events = normalizeEvents(cal);
  return { events, spans: kidsHomeSpans(events), kidsWeek: KIDS_WEEK, config, override };
};
const m = (c, iso) => modeAt(c, at(iso)).mode;
const GUEST = { mode: "guest", since: "2026-10-01T00:00:00-05:00", until: "2026-10-20T00:00:00-05:00" };

test("labels are exactly the seven modes", () => {
  assert.deepEqual(Object.values(MODES), ["School day", "After school", "Weekend", "Kids away", "Nashville week", "Guest", "Quiet"]);
});

test("precedence: override > Nashville week > Kids away > Weekend > After school > School day", () => {
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
  assert.equal(m(ctx(), "2026-10-09T16:00:00-05:00"), "weekend");      /* Fri, AHH no school */
  assert.equal(m(ctx(), "2026-10-01T16:00:00-05:00"), "after-school");
  assert.equal(m(ctx(), "2026-10-01T09:00:00-05:00"), "school-day");
  /* Nashville beats kids home too (spec order), e.g. Fri Oct 23 evening */
  assert.equal(m(ctx(), "2026-10-23T17:00:00-05:00"), "nashville-week");
});

test("after school runs from SRE dismissal to 8 PM; school night after bedtime", () => {
  assert.equal(m(ctx(), "2026-10-01T15:39:00-05:00"), "school-day");
  assert.equal(m(ctx(), "2026-10-01T15:40:00-05:00"), "after-school");
  assert.equal(m(ctx(), "2026-10-01T19:59:00-05:00"), "after-school");
  assert.equal(m(ctx(), "2026-10-01T20:00:00-05:00"), "school-day"); /* Thu night -> Fri school */
  assert.equal(m(ctx(), "2026-10-16T08:00:00-05:00"), "nashville-week");
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
  const inp = loadInputs({ ...DEFAULTS, kidsWeek: "/workspace/wardos-house-face/data/kids-week.json", override: "/nonexistent" });
  for (let d = "2026-10-02"; d <= "2026-10-12"; d = addDays(d, 1)) {
    const out = computeHouseMode({ ...inp, now: ctWallMs(d, 12, 0) });
    assert.notEqual(out.mode, "nashville-week", d);
  }
  assert.equal(hash(), before, "calendar file must not change");
});
