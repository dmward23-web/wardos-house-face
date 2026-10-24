/* ALLDAY1 · an all-day kid item that began at midnight today stays on the feed until its end date (regression). */
import test from "node:test";
import assert from "node:assert/strict";
import { isUpcomingOrAllDayToday } from "../cal-from-events.mjs";

const now = Date.parse("2026-10-23T18:30:00-05:00");
const mid = Date.parse("2026-10-23T00:00:00-05:00");
const next = Date.parse("2026-10-24T00:00:00-05:00");

test("today's all-day item is kept until its end date", () => {
  assert.equal(isUpcomingOrAllDayToday({ allDay: true, startMs: mid, endMs: next }, now), true);
});
test("yesterday's all-day item is dropped", () => {
  assert.equal(isUpcomingOrAllDayToday({ allDay: true, startMs: mid - 864e5, endMs: mid }, now), false);
});
test("a timed item that already started is still dropped", () => {
  assert.equal(isUpcomingOrAllDayToday({ allDay: false, startMs: now - 6e4, endMs: now + 36e5 }, now), false);
});
test("a future item is kept", () => {
  assert.equal(isUpcomingOrAllDayToday({ allDay: true, startMs: next, endMs: next + 864e5 }, now), true);
});
