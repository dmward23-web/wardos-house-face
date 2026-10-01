import { test } from "node:test";
import assert from "node:assert/strict";
import { computePickupChain } from "../../pickup-chain.mjs";
import { calendar, CONFIG, KIDS_WEEK, at } from "./fixture.mjs";

const run = (iso, cal = calendar()) => computePickupChain({ calendar: cal, kidsWeek: KIDS_WEEK, config: CONFIG, now: at(iso) });

test("school-day morning: kid rides only, in time order, with who/where/time/leave-by", () => {
  const out = run("2026-10-01T07:00:00-05:00");
  assert.equal(out.schoolDay, true);
  const drop = out.rows[0];
  assert.deepEqual(drop.who, ["Hayes", "Harris"]);
  assert.equal(drop.where, "Sunset Ridge Elementary");
  assert.equal(drop.time, "8:25 AM");
  assert.equal(drop.leaveBy, "8:10 AM");
  const harris = out.rows.find((r) => r.what === "SRE pickup");
  assert.deepEqual(harris.who, ["Harris"]);
  assert.equal(harris.by, "Dad");
  assert.equal(harris.time, "3:40 PM");
  assert.equal(harris.leaveBy, "3:15 PM");
  const hayesCasey = out.rows.find((r) => r.by && r.by.startsWith("Casey"));
  assert.deepEqual(hayesCasey.who, ["Hayes"]);
  assert.equal(hayesCasey.by, "Casey");
  assert.equal(hayesCasey.what, "Casey picks up Hayes");
  const casey = out.rows.find((r) => /at Casey's/.test(r.what));
  assert.equal(casey.what, "Pick up Hayes at Casey's");
  assert.equal(casey.where, "Casey's");
  assert.doesNotMatch(JSON.stringify(out), /\bmoms?\b/i);
  assert.equal(hayesCasey.leaveBy, null); /* Dad's leave-by never pinned on someone else's pickup */
  const times = out.rows.map((r) => Date.parse(r.timeIso));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("gear comes from the event text; cancelled events are dropped", () => {
  const out = run("2026-10-01T07:00:00-05:00");
  const bb = out.rows.find((r) => /baseball/i.test(r.what));
  assert.deepEqual(bb.gear, ["cleats", "glove"]);
  assert.equal(bb.time, "5:30 PM");
  assert.equal(bb.leaveBy, "4:55 PM");
  assert.ok(!out.rows.some((r) => /CANCEL|flag practice/i.test(r.what)));
});

test("never work, therapy, money, Erin, legal, admin, Dan-only, or another family's kid", () => {
  const out = run("2026-10-01T07:00:00-05:00");
  const blob = JSON.stringify(out);
  for (const bad of [/therapy/i, /anxiety/i, /erin/i, /legal/i, /\$/, /\bjars?\b/i, /payout/i, /wells/i, /autopay/i, /balance/i, /cursor/i, /work call/i, /GET ·/, /Johnson/i, /gift/i, /\bmom\b/i, /!/]) {
    assert.doesNotMatch(blob, bad);
  }
});

test("7:00 PM CT cutoff: 6:59 still shows, 7:00 and later is empty", () => {
  const before = run("2026-10-01T18:59:00-05:00");
  assert.ok(before.rows.length > 0);
  assert.ok(before.rows.some((r) => r.time === "6:59 PM"));
  for (const iso of ["2026-10-01T19:00:00-05:00", "2026-10-01T19:01:00-05:00", "2026-10-01T21:00:00-05:00", "2026-10-01T23:59:00-05:00"]) {
    const o = run(iso);
    assert.deepEqual(o.rows, [], iso);
    assert.match(o.reason, /7:00 PM/);
  }
  /* DST-safe: cutoff is CT wall clock (Nov 6 is CST, -06:00) */
  assert.equal(run("2026-11-06T19:00:00-06:00").rows.length, 0);
});

test("pickup chain carries the now+7d calendar-window warning", () => {
  assert.deepEqual(run("2026-10-01T07:00:00-05:00").warnings, []);
  assert.ok(run("2026-10-20T07:00:00-05:00").warnings.some((w) => /does not reach now\+7d/.test(w)));
});

test("empty on non-school days and while the kids are with their mom", () => {
  assert.deepEqual(run("2026-10-03T09:00:00-05:00").rows, []);       /* Sat */
  assert.equal(run("2026-10-03T09:00:00-05:00").reason, "Not a school day");
  assert.deepEqual(run("2026-10-09T07:00:00-05:00").rows, []);       /* Fri, AHH no school */
  const away = run("2026-10-05T07:00:00-05:00");                      /* Mon, their mom's week */
  assert.deepEqual(away.rows, []);
  assert.equal(away.reason, "Kids away · back Fri 3:00");
});
