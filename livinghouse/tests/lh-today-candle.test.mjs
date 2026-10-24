// node livinghouse/tests/lh-today-candle.test.mjs · Prism re-check N1 (today's stones) + N2 (candle day). Synthetic fixtures only.
import { assertSealed } from "../../scripts/qa/temp-home.mjs";   // TEMPHOME1: WARDOS_* unset and a temp HOME before any private-list reader loads
process.env.TZ = "America/Chicago";            // LeaveBy reads wall-clock times in the board zone (CT)
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
assertSealed(); const R = req("../lh-rules.js");
const LeaveBy = req("../../phone2/leaveby.js");  // the base's own leaveby.js, never a copy
const at = (s) => Date.parse(s);

/* N1 · Sat 3:30 AM: today's all-day trip and tonight's 7 PM game are TODAY stones; only items whose time has passed leave */
const ev = [
  { id: "trip", all: true,  s: "2026-10-17T00:00:00-05:00", e: "2026-10-19T00:00:00-05:00", raw: "Trip", t: "Dad: Example trip" },
  { id: "early", all: false, s: "2026-10-17T01:00:00-05:00", e: "2026-10-17T02:00:00-05:00", raw: "Done", t: "Already over" },
  { id: "fly", all: false, s: "2026-10-17T15:30:00-05:00", e: "2026-10-17T17:00:00-05:00", raw: "Fly", t: "Dad: Fly to Example" },
  { id: "game", all: false, s: "2026-10-17T19:00:00-05:00", e: "2026-10-17T22:30:00-05:00", raw: "Game", t: "Team A vs Team B, Game 4" },
  { id: "home", all: false, s: "2026-10-18T05:25:00-05:00", e: "2026-10-18T07:05:00-05:00", raw: "Home", t: "Dad: Fly home" },
  { id: "bday", all: true,  s: "2026-10-18T00:00:00-05:00", e: "2026-10-19T00:00:00-05:00", raw: "Pat bday", t: "Pat bday" },
  { id: "fri", all: false, s: "2026-10-23T06:55:00-05:00", e: "2026-10-23T08:00:00-05:00", raw: "Fri", t: "Friday thing" },
];
let p = R.pickStones(ev, at("2026-10-17T03:30:00-05:00"), { max: 4, skipId: "fly" });
assert.deepEqual(p.map((x) => x.id), ["trip", "game", "home", "fri"]);
assert.equal(p[0].day, 0); assert.equal(p[1].day, 0); assert.equal(p[2].day, 1);
// 8 PM: the game is under way (not over) so it stays; the trip stays all day
p = R.pickStones(ev, at("2026-10-17T20:00:00-05:00"), { max: 4 });
assert.deepEqual(p.map((x) => x.id).slice(0, 2), ["trip", "game"]);
// 11 PM: the game is over and leaves; the trip (all day, multi-day) still reads as today
p = R.pickStones(ev, at("2026-10-17T23:00:00-05:00"), { max: 4 });
assert.ok(!p.some((x) => x.id === "game")); assert.equal(p[0].id, "trip"); assert.equal(p[0].day, 0);
// Sun: the trip that began yesterday is a today stone until it ends
p = R.pickStones(ev, at("2026-10-18T09:00:00-05:00"), { max: 3 });
assert.equal(p[0].id, "trip"); assert.equal(p[0].day, 0); assert.ok(!p.some((x) => x.id === "bday"));
assert.equal(R.pickStones(ev, at("2026-10-17T03:30:00-05:00"), { max: 3 }).length, 3);

/* N2 · the candle from LeaveBy (raw events): lit on the leave day, a day prefix otherwise */
const raw = [
  { id: "trip", allDay: true, start: "2026-10-17T00:00:00-05:00", end: "2026-10-19T00:00:00-05:00", summary: "Dan+Sam XYZ · #QQQ111 XX1234 Sat 10/17 AAA 3:30p→BBB · leave 2:10" },   // synthetic fixture, privacy-scan:allow booking_code
  { id: "fly", allDay: false, start: "2026-10-17T15:30:00-05:00", end: "2026-10-17T17:00:00-05:00", summary: "Flight to Example (XX 1234)" },
];
const lb = LeaveBy.find(raw[1], raw);
assert.ok(lb, "LeaveBy finds the trip leg"); assert.equal(lb.leave.getTime(), at("2026-10-17T14:10:00-05:00"));
let c = R.candle(lb.leave.getTime(), at("2026-10-16T13:00:00-05:00"));     // Fri 1 PM preview
assert.deepEqual([c.lit, c.label], [false, "Tomorrow · Leave 2:10 PM"]);
c = R.candle(lb.leave.getTime(), at("2026-10-17T03:30:00-05:00"));         // Sat early morning: the leave day
assert.deepEqual([c.lit, c.label], [true, "Today · Leave 2:10 PM"]);
c = R.candle(lb.leave.getTime(), at("2026-10-15T13:00:00-05:00"));         // Thu
assert.deepEqual([c.lit, c.label], [false, "Sat · Leave 2:10 PM"]);
assert.equal(R.candle(lb.leave.getTime(), at("2026-10-17T14:30:00-05:00")), null);   // gone once the leave passes
console.log("lh-today-candle: ok");

/* Prism ruling (b) · candlePick: the candle is the next LEAVE-BY (kid trips included), never Ainsley's LKMS; no leave-by = null (unlit, empty) */
const cev = [
  { id: "lesson", all: false, s: "2026-10-15T19:00:00-05:00", e: "2026-10-15T19:45:00-05:00", raw: "Ainsley piano lesson", t: "Ainsley piano lesson" },
  { id: "lkms", all: false, s: "2026-10-16T07:30:00-05:00", e: "2026-10-16T08:00:00-05:00", raw: "Ainsley LKMS drop", t: "Ainsley LKMS drop" },
  { id: "dentist", all: false, s: "2026-10-16T14:00:00-05:00", e: "2026-10-16T14:45:00-05:00", raw: "Hayes dentist", t: "Hayes dentist" },
  { id: "haircut", all: false, s: "2026-10-16T16:30:00-05:00", e: "2026-10-16T17:00:00-05:00", raw: "Dad: Haircut", t: "Dad: Haircut" },
];
const craw = [
  { id: "lesson", allDay: false, start: "2026-10-15T19:00:00-05:00", end: "2026-10-15T19:45:00-05:00", summary: "Ainsley piano lesson" },
  { id: "lkms", allDay: false, start: "2026-10-16T07:30:00-05:00", end: "2026-10-16T08:00:00-05:00", summary: "Ainsley LKMS drop · leave 7:10" },
  { id: "dentist", allDay: false, start: "2026-10-16T14:00:00-05:00", end: "2026-10-16T14:45:00-05:00", summary: "Hayes dentist", description: "leave 1:30" },
  { id: "haircut", allDay: false, start: "2026-10-16T16:30:00-05:00", end: "2026-10-16T17:00:00-05:00", summary: "Dad: Haircut" },
];
let cp = R.candlePick(cev, craw, at("2026-10-15T18:30:00-05:00"), LeaveBy.find);      // Thu dusk: the lesson has no leave-by, LKMS is never the candle
assert.equal(cp.ev.id, "dentist"); assert.equal(cp.lb.leave.getTime(), at("2026-10-16T13:30:00-05:00"));
assert.deepEqual([R.candle(cp.lb.leave.getTime(), at("2026-10-15T18:30:00-05:00")).lit], [false]);   // tomorrow's leave: unlit, names the day
cp = R.candlePick(cev, craw, at("2026-10-16T13:00:00-05:00"), LeaveBy.find);           // Fri 1 PM: the next leave-by wins
assert.equal(cp.ev.id, "dentist");
assert.equal(R.candlePick(cev, craw, at("2026-10-16T13:45:00-05:00"), LeaveBy.find), null);   // leave passed, the haircut has no leave-by: empty
assert.equal(R.candlePick(cev.slice(0, 2), craw, at("2026-10-15T18:30:00-05:00"), LeaveBy.find), null);   // only a lesson + LKMS: empty candle
assert.equal(R.candlePick([], [], at("2026-10-15T18:30:00-05:00"), LeaveBy.find), null);
assert.equal(R.candlePick(cev, craw, at("2026-10-15T18:30:00-05:00"), null), null);    // no LeaveBy loaded: empty, never a guess
console.log("lh-today-candle: candlePick ok");
