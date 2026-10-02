/* ATLASLANE8 · House Face chore law (Dan, locked Oct 1 2026 8:01 PM CT) · Atlas data side. One test block per rule.
   Replaces the kid layer v3 tests (one Harris mission by weekday, MUSTGATE1, per-kid week unlocks): those rules are gone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeKidLayer, mustsFor, dayClosed, normalizeTaps, claimChoice, closeTile, choiceJobFor, consumeUnlock, lawWeek,
  scoreHits, consequenceHits, missNameHits, repairDeadline, ORDER } from "../kid-layer-lib.mjs";
import { scanObject, readJson, addDays, ctWallMs } from "../lib.mjs";
import { kidMoneyHits } from "../kid-copy.mjs";
import { calendar, at, ROOT } from "./fixture.mjs";

const CONFIG = readJson(path.join(ROOT, "config/kid-layer.config.json"));
const cfg = (patch = {}) => ({ ...structuredClone(CONFIG), ...patch });
const MUSTS = ["must-bed", "must-hamper", "must-dish", "must-floor"];
/* hub shape {v, t}; hh:mm CT on `iso` unless whenIso given */
function tap(taps, kid, iso, id, hm = "07:30", whenIso = iso) {
  const [h, m] = hm.split(":").map(Number);
  const k = `house-checkoffs:${kid}:${iso}`;
  (taps[k] = taps[k] || {})[id] = { v: true, t: ctWallMs(whenIso, h, m) };
  return taps;
}
const allMusts = (taps, kid, iso, hm = "07:30", skip = null) => { for (const id of MUSTS) if (id !== skip) tap(taps, kid, iso, id, hm); return taps; };
const close = (taps, kid, iso, hm = "20:00") => tap(taps, kid, iso, "close", hm);
const run = (taps, now, { config = CONFIG, uses = { uses: [] }, cal = calendar() } = {}) => computeKidLayer({ calendar: cal, taps, uses, config, now: at(now) });
const scansClean = (o) => { for (const x of [o.kidSeats, o.unlocks]) assert.deepEqual(scanObject(x).concat(missNameHits(x), scoreHits(x), consequenceHits(x)), []); };
const NIGHTS = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]; /* Mon..Thu, kids home (fixture Kids with Dan Sep 25 3 PM - Oct 2 3 PM) */

test("law week = Sunday to Sunday; repair edge = Saturday 12:00 AM of that week", () => {
  const w = lawWeek("2026-10-01");
  assert.equal(w.id, "2026-09-27");
  assert.deepEqual([w.days[0], w.days[6]], ["2026-09-27", "2026-10-03"]);
  assert.equal(repairDeadline("2026-09-29", CONFIG), ctWallMs("2026-10-03", 0, 0));
  const o = run({}, "2026-10-01T20:05:00-05:00");
  assert.equal(o.kidSeats.week.id, "2026-09-27");
  assert.match(o.kidSeats.law, /locked Oct 1 2026/);
});

test("MUSTS: four per kid, binary (three of four is open), Dragon fed replaces Hayes's fourth only while the dragon is in the house", () => {
  for (const k of ORDER) assert.deepEqual(mustsFor(k, CONFIG).map((m) => m.word), ["Bed made", "Hamper in", "Dish to the sink", "Own floor clear"], k);
  assert.equal(CONFIG.musts.dragon.inHouse, false, "the dragon is not in the house now");
  const inHouse = cfg(); inHouse.musts.dragon.inHouse = true;
  assert.deepEqual(mustsFor("hayes", inHouse).map((m) => m.word), ["Bed made", "Hamper in", "Dish to the sink", "Dragon fed"]);
  assert.deepEqual(mustsFor("harris", inHouse).map((m) => m.word).length, 4, "only Hayes swaps");
  const t = allMusts({}, "hayes", "2026-10-01", "07:30", "must-floor");
  assert.equal(dayClosed(normalizeTaps(t), "hayes", "2026-10-01", CONFIG), false, "no partial credit");
  tap(t, "hayes", "2026-10-01", "must-floor");
  assert.equal(dayClosed(normalizeTaps(t), "hayes", "2026-10-01", CONFIG), true);
  assert.equal(dayClosed(normalizeTaps(t), "hayes", "2026-10-01", inHouse), false, "dragon in: floor no longer counts, dragon fed does");
  const o = run(t, "2026-10-01T20:05:00-05:00");
  assert.equal(o.kidSeats.seats.hayes.musts.length, 4);
  assert.ok(o.kidSeats.seats.hayes.musts.every((m) => m.closed === true));
  assert.equal(o.kidSeats.seats.hayes.today.closed, true);
  assert.ok(o.kidSeats.seats.harris.musts.every((m) => typeof m.closed === "boolean" && Object.keys(m).join() === "id,word,closed"));
  scansClean(o);
});

test("CHOICE: one shared job a day; first tap owns it and locks it; a sibling can't take it; unclaimed at 5 PM = Dad Seat exception", () => {
  const jobs = Array.from({ length: 4 }, (_, i) => choiceJobFor(addDays("2026-09-27", i), CONFIG).word);
  assert.deepEqual(jobs.slice().sort(), ["Fold one basket", "Reset the couch", "Trash to the can", "Wipe the island"], "rotates through all four");
  const d = "2026-10-01";
  let s = claimChoice({}, "hayes", d, ctWallMs(d, 7, 40), CONFIG);
  assert.deepEqual([s.ok, s.owner], [true, "hayes"]);
  const s2 = claimChoice(s.taps, "harris", d, ctWallMs(d, 7, 41), CONFIG);
  assert.deepEqual([s2.ok, s2.owner], [false, "hayes"], "sibling can't take a claimed job");
  assert.deepEqual(s2.taps, s.taps, "nothing written for the sibling");
  /* two devices: the earlier tap wins even if it synced later */
  const raw = tap(tap({}, "ainsley", d, "choice-claim", "07:50"), "harris", d, "choice-claim", "07:45");
  let o = run(raw, "2026-10-01T12:00:00-05:00");
  assert.equal(o.kidSeats.choice.claimedBy, "Harris");
  assert.equal(o.kidSeats.choice.locked, true);
  assert.equal(o.kidSeats.choice.copy, `${choiceJobFor(d, CONFIG).word} · Harris.`);
  /* unclaimed: open before 5 PM, exception at 5 PM, claims closed after */
  o = run({}, "2026-10-01T16:59:00-05:00");
  assert.deepEqual([o.kidSeats.choice.open, o.kidSeats.choice.exception], [true, false]);
  assert.deepEqual(o.kidSeats.dadSeat.loops, []);
  o = run({}, "2026-10-01T17:00:00-05:00");
  assert.deepEqual([o.kidSeats.choice.open, o.kidSeats.choice.exception], [false, true]);
  assert.deepEqual(o.kidSeats.dadSeat.loops.map((l) => l.kind), ["choice"]);
  assert.equal(o.kidSeats.dadSeat.loops[0].kid, null, "an exception names no kid");
  assert.equal(claimChoice({}, "hayes", d, ctWallMs(d, 17, 5), CONFIG).ok, false, "no claim after 5 PM");
  assert.equal(run(tap({}, "hayes", d, "choice-claim", "17:10"), "2026-10-01T18:00:00-05:00").kidSeats.choice.exception, true, "late claim tap ignored");
  scansClean(o);
});

test("CLOSE: bedtime window, each kid closes only their own tile; overnight Dad Seat = open loops only + one Caught-it line shown once", () => {
  const d = "2026-10-01";
  assert.equal(closeTile({}, "hayes", d, ctWallMs(d, 18, 0), CONFIG).ok, false, "before the window");
  const c = closeTile({}, "hayes", d, ctWallMs(d, 20, 10), CONFIG);
  assert.equal(c.ok, true);
  assert.deepEqual(Object.keys(c.taps), ["house-checkoffs:hayes:2026-10-01"], "writes only that kid's tile");
  assert.equal(closeTile({}, "hayes", d, ctWallMs(d, 23, 0), CONFIG).ok, false, "after the window");
  /* Thu: Harris + Ainsley all MUSTS + close; Hayes MUSTS minus hamper, no close; Hayes claimed + did the island */
  const t = {};
  allMusts(t, "harris", d, "07:20"); close(t, "harris", d);
  allMusts(t, "ainsley", d, "07:30"); close(t, "ainsley", d);
  allMusts(t, "hayes", d, "07:30", "must-hamper");
  tap(t, "hayes", d, "choice-claim", "07:35"); tap(t, "hayes", d, "choice-done", "16:00");
  const late = close({}, "hayes", d, "22:30");
  assert.equal(run({ ...t, ...late }, "2026-10-01T22:45:00-05:00").kidSeats.close.kids.hayes.closed, false, "a close after the window doesn't count");
  const night = run(t, "2026-10-01T23:00:00-05:00");
  const ds = night.kidSeats.dadSeat;
  assert.equal(ds.mode, "overnight");
  assert.deepEqual(ds.loops.map((l) => l.copy), ["Hayes · Hamper in.", "Hayes · Close."], "open loops only, nothing closed listed");
  assert.equal(ds.caughtIt.line, "Hayes wiped the island.", "one line about the actual thing");
  assert.equal(run(t, "2026-10-02T01:00:00-05:00").kidSeats.dadSeat.loopDay, d, "after midnight still Thursday's loops");
  /* morning: shown overnight only; next afternoon it has moved to the week strip */
  const fri = run(t, "2026-10-02T13:00:00-05:00");
  assert.equal(fri.kidSeats.quiet, false);
  assert.equal(fri.kidSeats.dadSeat.caughtIt, null);
  assert.deepEqual(fri.kidSeats.dadSeat.weekStrip.map((x) => x.line), ["Hayes wiped the island."]);
  /* morning with nothing open = no lecture */
  const t2 = {}; for (const k of ORDER) { allMusts(t2, k, d); close(t2, k, d); }
  const m = run(t2, "2026-10-02T07:00:00-05:00").kidSeats.dadSeat;
  assert.equal(m.mode, "morning");
  assert.deepEqual(m.loops.filter((l) => l.kind !== "choice"), []);
  scansClean(night);
});

test("Harris: a miss pauses his run, it never resets it", () => {
  const t = {};
  for (const d of ["2026-09-28", "2026-09-29"]) allMusts(t, "harris", d);
  /* Wed Sep 30 missed */
  let s = run(t, "2026-10-01T07:00:00-05:00").kidSeats.seats.harris;
  assert.deepEqual(s.streak, { days: 2, paused: true });
  allMusts(t, "harris", "2026-10-01", "07:10");
  s = run(t, "2026-10-01T07:15:00-05:00").kidSeats.seats.harris;
  assert.deepEqual(s.streak, { days: 3, paused: false }, "the miss didn't zero it");
  assert.equal(s.mission, null);
  assert.equal(s.copy, "Harris. All four done.");
  const open = run({}, "2026-10-01T07:15:00-05:00").kidSeats.seats.harris;
  assert.equal(open.mission.word, "Bed made", "his tile shows the next open MUST");
  assert.equal(open.copy, "Harris. Bed made.");
});

test("Hayes: run of closed days (a miss restarts it quietly) plus captain of the night, rotating", () => {
  const t = {};
  for (const d of ["2026-09-28", "2026-09-30", "2026-10-01"]) allMusts(t, "hayes", d);
  const s = run(t, "2026-10-01T19:40:00-05:00").kidSeats.seats.hayes;
  assert.deepEqual(s.streak, { days: 2 });
  assert.ok(!/miss|lost|reset/i.test(s.copy), s.copy);
  const caps = NIGHTS.slice(0, 3).map((d) => run({}, `${d}T19:40:00-05:00`).kidSeats.close.captain);
  assert.deepEqual(caps.slice().sort(), ["Ainsley", "Harris", "Hayes"], "rotates through the kids home");
  const hayesNight = NIGHTS.find((d) => run({}, `${d}T19:40:00-05:00`).kidSeats.close.captain === "Hayes");
  const h = run(t, `${hayesNight}T19:40:00-05:00`).kidSeats.seats.hayes;
  assert.equal(h.captainTonight, true);
  assert.match(h.copy, /Captain tonight\.$/);
});

test("Ainsley: no stars, no counts; trusted-with only; no check after five days running; her line is specific and rare", () => {
  const o = run({}, "2026-10-01T20:05:00-05:00");
  const a = o.kidSeats.seats.ainsley;
  assert.deepEqual(a.trustedWith, ["Phone upstairs", "Later lights-out", "Picks Sunday dinner"]);
  assert.equal(a.streak, undefined);
  assert.deepEqual(scoreHits(o.kidSeats), []);
  assert.ok(!/\d|★|stars?|streak/i.test(JSON.stringify(a)), "no number anywhere on her seat");
  assert.ok(scoreHits({ seats: { ainsley: { copy: "Week 3" } } }).length);
  assert.ok(scoreHits({ seats: { ainsley: { done: 3 } } }).length);
  assert.ok(scoreHits({ seats: { ainsley: { streak: { days: 1 } } } }).length);
  /* hamper closed Sun..Thu = five home days running -> no check on hamper, and one line the day it crosses */
  const t = {};
  for (const d of ["2026-09-27", ...NIGHTS]) tap(t, "ainsley", d, "must-hamper");
  const thu = run(t, "2026-10-01T20:05:00-05:00").kidSeats;
  assert.ok(thu.seats.ainsley.trustedWith.includes("No check · Hamper in"));
  assert.deepEqual(thu.dadSeat.noCheck, ["Ainsley · Hamper in"]);
  assert.equal(thu.seats.ainsley.line, "Ainsley. Hamper in is yours now. No check.");
  const wed = run(t, "2026-09-30T20:05:00-05:00").kidSeats.seats.ainsley;
  assert.equal(wed.line, null, "four days: no line, no no-check");
  assert.ok(!wed.trustedWith.some((x) => /No check/.test(x)));
  tap(t, "ainsley", "2026-10-02", "must-hamper");
  assert.equal(run(t, "2026-10-02T08:00:00-05:00").kidSeats.seats.ainsley.line, null, "rare: not again the next day");
  assert.ok(consequenceHits({ line: "Ainsley. Great job." }).length, "never generic praise");
  scansClean(run(t, "2026-10-01T20:05:00-05:00"));
});

test("Week win: Sunday tile, one name + one reason, rotating by week; quiet week = house held; absent other days", () => {
  assert.equal(run({}, "2026-10-01T20:05:00-05:00").kidSeats.weekWin, null);
  const quiet = run({}, "2026-10-04T10:00:00-05:00").kidSeats.weekWin;
  assert.deepEqual([quiet.houseHeld, quiet.name, quiet.copy], [true, null, "Week win: house held."]);
  const t = {};
  tap(t, "hayes", "2026-09-29", "choice-claim", "07:30"); tap(t, "hayes", "2026-09-29", "choice-done", "16:00");
  const w = run(t, "2026-10-04T10:00:00-05:00").kidSeats.weekWin;
  assert.equal(w.weekId, "2026-09-27");
  assert.equal(w.name, "Hayes");
  assert.equal(w.copy, `Week win: Hayes. ${choiceJobFor("2026-09-29", CONFIG).did.replace(/^./, (c) => c.toUpperCase())}.`);
  /* rotation: the next weeks are other names, whatever anyone did (not a ranking) */
  const names = ["2026-10-04", "2026-10-11", "2026-10-18"].map((sun) => {
    const c = cfg(); const wk = lawWeek(addDays(sun, -7));
    return c.weekWin.rotation[(Math.round((ctWallMs(wk.id, 12) - ctWallMs(c.rotationEpoch, 12)) / 86400000 / 7) % 3 + 3) % 3];
  });
  assert.equal(new Set(names).size, 3);
  const t2 = {}; for (const d of ["2026-10-10", "2026-10-11"]) allMusts(t2, "harris", d); /* week of Oct 4: Harris home only Sat Oct 10 */
  const w2 = run(t2, "2026-10-11T10:00:00-05:00").kidSeats.weekWin;
  assert.equal(w2.name, "Harris");
  assert.equal(w2.reason, "All MUSTS, every day home.");
});

test("Us together: 12 closes available (Mon-Thu, three kids); 10 or more lights Weekend fun, carried until spent", () => {
  const t = {};
  let n = 0;
  for (const d of NIGHTS) for (const k of ORDER) { if (n++ >= 9) break; allMusts(t, k, d); close(t, k, d); }
  let o = run(t, "2026-10-01T21:00:00-05:00");
  assert.deepEqual(o.kidSeats.usTogether, { closes: 9, available: 12, unlockAt: 10, lit: false });
  assert.deepEqual(o.unlocks.lit, []);
  /* a close without that day's MUSTS isn't a close */
  close(t, "ainsley", "2026-10-01");
  assert.equal(run(t, "2026-10-01T21:00:00-05:00").kidSeats.usTogether.closes, 9);
  allMusts(t, "ainsley", "2026-10-01");
  o = run(t, "2026-10-01T21:00:00-05:00");
  assert.deepEqual(o.kidSeats.usTogether, { closes: 10, available: 12, unlockAt: 10, lit: true });
  assert.deepEqual(o.unlocks.lit.map((u) => [u.id, u.seat, u.control, u.tile, u.earnedWeek, u.copy]),
    [["house-weekend-pick", "House", "weekend-pick", "Weekend fun", "2026-09-27", "Us together. Weekend fun."]]);
  assert.equal(o.kidSeats.usTogether.closes <= 12, true);
  /* carries through the kids-away week, one use, then dark */
  const away = run(t, "2026-10-07T12:00:00-05:00");
  assert.equal(away.unlocks.lit.length, 1);
  const uses = consumeUnlock({ uses: [] }, "house-weekend-pick", away, at("2026-10-10T10:00:00-05:00"));
  assert.deepEqual(run(t, "2026-10-10T11:00:00-05:00", { uses }).unlocks.lit, []);
  assert.deepEqual(Object.keys(o.kidSeats.usTogether), ["closes", "available", "unlockAt", "lit"], "no list of who");
});

test("Repair: a missed MUST can close before Saturday fun; never after, never into next week", () => {
  const t = {};
  allMusts(t, "harris", "2026-09-29", "07:30", "must-dish");
  assert.equal(dayClosed(normalizeTaps(t), "harris", "2026-09-29", CONFIG), false);
  const fixed = structuredClone(t); tap(fixed, "harris", "2026-09-29", "must-dish", "16:00", "2026-10-01"); /* Thu, for Tuesday */
  assert.equal(dayClosed(normalizeTaps(fixed), "harris", "2026-09-29", CONFIG), true);
  const o = run(fixed, "2026-10-01T23:00:00-05:00");
  assert.equal(o.kidSeats.dadSeat.caughtIt.line, "Harris went back and took the dish to the sink.");
  const tooLate = structuredClone(t); tap(tooLate, "harris", "2026-09-29", "must-dish", "09:00", "2026-10-03"); /* Saturday */
  assert.equal(dayClosed(normalizeTaps(tooLate), "harris", "2026-09-29", CONFIG), false, "after Saturday fun");
  const nextWeek = structuredClone(t); tap(nextWeek, "harris", "2026-09-29", "must-dish", "18:00", "2026-10-05");
  assert.equal(dayClosed(normalizeTaps(nextWeek), "harris", "2026-09-29", CONFIG), false, "does not carry into next week");
  const sat = tap({}, "harris", "2026-10-03", "must-bed", "09:00", "2026-10-04");
  assert.equal(normalizeTaps(sat) && dayClosed(normalizeTaps(allMusts(sat, "harris", "2026-10-03", "08:00", "must-bed")), "harris", "2026-10-03", CONFIG), false, "a Saturday miss has no repair window");
});

test("Pack: travel week only, three items (dragon care, bag, charger), dark PER KID when that kid's bag is at the door", () => {
  const off = run({}, "2026-10-01T20:05:00-05:00").kidSeats.pack;
  assert.deepEqual([off.travelWeek, off.dark, off.items], [false, true, []], "a handoff Friday is not travel");
  assert.deepEqual(Object.values(off.kids).map((k) => k.dark), [true, true, true]);
  const trip = calendar([{ summary: "Dan + Kids Nashville", start: { date: "2026-10-02T00:00:00Z" }, end: { date: "2026-10-05T00:00:00Z" } }]);
  let p = run({}, "2026-10-01T20:05:00-05:00", { cal: trip }).kidSeats.pack;
  assert.equal(p.travelWeek, true); assert.equal(p.dark, false); assert.equal(p.perKid, true);
  assert.deepEqual(p.items.map((x) => x.word), ["Dragon care", "Bag", "Charger"], "three items only");
  const t = { "house-checkoffs:hayes:week:2026-09-27": { "pack-charger": { v: true, t: at("2026-10-01T19:00:00-05:00") } } };
  p = run(t, "2026-10-01T20:05:00-05:00", { cal: trip }).kidSeats.pack;
  assert.deepEqual(p.kids.hayes.items.map((x) => x.done), [false, false, true]);
  assert.deepEqual(p.kids.harris.items.map((x) => x.done), [false, false, false], "Hayes's tap is his only");
  t["house-checkoffs:hayes:week:2026-09-27"]["pack-bag"] = true;
  p = run(t, "2026-10-01T20:05:00-05:00", { cal: trip }).kidSeats.pack;
  assert.deepEqual([p.kids.hayes.dark, p.kids.hayes.items], [true, []], "Hayes's bag at the door: Hayes's Pack dark");
  assert.deepEqual([p.kids.harris.dark, p.kids.ainsley.dark, p.dark], [false, false, false], "siblings stay lit");
  assert.equal(p.kids.ainsley.items.length, 3);
  const c = cfg(); c.pack.travelWeeks = ["2026-10-11"];
  assert.equal(run({}, "2026-10-12T19:00:00-05:00").kidSeats.pack.travelWeek, false);
  assert.equal(run({}, "2026-10-12T19:00:00-05:00", { config: c }).kidSeats.pack.travelWeek, true, "Dan can list a week");
});

test("Mystery close: once a week, hidden until that kid's MUSTS are closed, never money", () => {
  const days = lawWeek("2026-10-01").days.filter((d) => run({}, `${d}T12:00:00-05:00`).kidSeats.seats.harris.mystery);
  assert.equal(days.length, 1, "one day a week");
  const d = days[0];
  const t = allMusts({}, "hayes", d);
  const s = run(t, `${d}T18:00:00-05:00`).kidSeats.seats;
  assert.deepEqual(s.harris.mystery, { hidden: true });
  assert.equal(s.hayes.mystery.hidden, false);
  assert.ok(CONFIG.mystery.pool.includes(s.hayes.mystery.copy));
  for (const x of CONFIG.mystery.pool) assert.deepEqual(kidMoneyHits({ x }).concat(scanObject({ x })), [], x);
});

test("No leaderboard, no consequence text on a miss: fixed kid order, no rank / who-kept-it-dark, no penalty words", () => {
  const good = {}, bad = {};
  for (const d of NIGHTS) { allMusts(good, "ainsley", d); close(good, "ainsley", d); allMusts(bad, "harris", d); close(bad, "harris", d); }
  for (const [t, now] of [[good, "2026-10-01T23:00:00-05:00"], [bad, "2026-10-01T23:00:00-05:00"], [{}, "2026-10-02T07:00:00-05:00"], [good, "2026-10-04T10:00:00-05:00"]]) {
    const o = run(t, now);
    assert.deepEqual(Object.keys(o.kidSeats.seats), ["harris", "hayes", "ainsley"], "order never follows performance");
    scansClean(o);
    assert.ok(!/\b(rank|leader|winner|most|best|ahead of|lose|lost|grounded|penalt\w*|consequence|owe|missed)\b/i.test(JSON.stringify(o.kidSeats.dadSeat) + JSON.stringify(o.kidSeats.seats).replace(/"mark": ?"ahead"/g, "")));
  }
  assert.ok(consequenceHits({ copy: "Hayes lost his weekend" }).length);
  assert.ok(consequenceHits({ copy: "No screens tonight" }).length);
  assert.ok(scanObject({ copy: "Leaderboard" }).length);
});

test("Jar is Ledger's tile: no jar, $, kid dollars or old chart rules in Atlas's chore files; committed outputs match the law", () => {
  for (const rel of ["config/kid-layer.config.json", "data/kid-seats.json", "data/unlocks.json", "data/unlock-uses.json"]) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.ok(!/\$|\bjars?\b|\bpay-?day\b|\bbalances?\b|allowance|cash|\bnice one\b/i.test(src), rel);
    assert.deepEqual(scanObject(JSON.parse(src)), [], rel);
    assert.ok(!/harrisMissionByDow|missionWords|harris-dinner-vote|hayes-weekend-pick|ainsley-gallery-or-weekend|MUSTGATE|house-checkoffs:[a-z]+:week:\d{4}-\d{2}-\d{2}"?\s*:\s*\{\s*"(har|hay|ain)-/.test(src), `${rel}: old chart rule`);
  }
  const ks = readJson(path.join(ROOT, "data/kid-seats.json")), ul = readJson(path.join(ROOT, "data/unlocks.json"));
  assert.equal(ks.week.id, lawWeek(ks.asOfIso).id);
  for (const k of ORDER) assert.equal(ks.seats[k].musts.length, 4);
  assert.ok(ul.lit.every((u) => u.id === "house-weekend-pick"));
  const lib = fs.readFileSync(path.join(ROOT, "scripts/house/kid-layer-lib.mjs"), "utf8");
  assert.ok(!/harrisMissionFor|MUSTGATE1 \(|weekClosed\(musts/.test(lib), "old rules are gone from the lib, not stacked");
});
