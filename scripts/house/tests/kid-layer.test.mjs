import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { choreWeek, normalizeTaps, weekClosed, mustsFor, computeKidLayer, consumeUnlock, missNameHits, harrisMissionFor, weekIdOfTapDay } from "../kid-layer-lib.mjs";
import { scanObject, bannedHits, readJson, addDays } from "../lib.mjs";
import { calendar, at, ROOT } from "./fixture.mjs";

const CONFIG = readJson(path.join(ROOT, "config/kid-layer.config.json"));
/* Real quest ids/cadences (kids-week.json), incl. an optional add-on that must never count. */
const q = (id, cadence = "daily", extra = {}) => ({ id, what: id, stars: 1, cadence, ...extra });
const KW = { kids: {
  harris: { quests: [q("har-bed"), q("har-backpack"), q("har-dishes"), q("har-toys", "weekly")] },
  hayes: { quests: [q("hay-bed"), q("hay-dishes"), q("hay-room", "weekly")] },
  ainsley: { quests: [q("ain-bed"), q("ain-laundry", "weekly"), q("ain-babysit", "addon", { optional: true })] },
} };
const WEEK = "2026-09-25";
const TAP_DAYS = Array.from({ length: 7 }, (_, i) => addDays(WEEK, i + 1)); /* Sat Sep 26 .. Fri Oct 2 */

/** Local (localStorage) tap shape: {key: {id: true}}. Harris: that day's one fixed mission. */
function closeWeek(taps, kid, { skipDay = null, skipWeekly = false, week = WEEK } = {}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i + 1));
  if (kid === "harris") {
    for (const d of days) if (d !== skipDay) { const k = `house-checkoffs:harris:${d}`; (taps[k] = taps[k] || {})[harrisMissionFor(d, CONFIG).id] = true; }
    return taps;
  }
  for (const m of mustsFor(KW, kid)) {
    if (m.cadence === "daily") for (const d of days) {
      if (d === skipDay) continue;
      const k = `house-checkoffs:${kid}:${d}`; (taps[k] = taps[k] || {})[m.id] = true;
    } else if (!skipWeekly) { const k = `house-checkoffs:${kid}:week:${week}`; (taps[k] = taps[k] || {})[m.id] = true; }
  }
  return taps;
}
const FRI_AM = at("2026-10-02T07:45:00-05:00");
const run = (taps, uses = { uses: [] }, now = FRI_AM, cal = calendar()) => computeKidLayer({ calendar: cal, kidsWeek: KW, taps, uses, config: CONFIG, now });
const ids = (layer) => layer.unlocks.lit.map((u) => u.id).sort();

test("chore week = Fri 3:00 PM -> Fri 3:00 PM, tap days Sat..Fri (kids-data.js weekStartIso)", () => {
  const w = choreWeek(at("2026-10-01T18:00:00-05:00"));
  assert.equal(w.id, WEEK);
  assert.deepEqual(w.tapDays, TAP_DAYS);
  assert.equal(choreWeek(at("2026-10-02T14:59:00-05:00")).id, WEEK);
  assert.equal(choreWeek(at("2026-10-02T15:00:00-05:00")).id, "2026-10-02");
});

test("week close: every daily must on all 7 tap days + every weekly must; add-ons never count", () => {
  const w = choreWeek(FRI_AM);
  const m = mustsFor(KW, "ainsley");
  assert.ok(!m.some((x) => x.id === "ain-babysit"));
  assert.equal(weekClosed(m, normalizeTaps(closeWeek({}, "ainsley")), "ainsley", w), true);
  assert.equal(weekClosed(m, normalizeTaps(closeWeek({}, "ainsley", { skipDay: "2026-09-30" })), "ainsley", w), false);
  assert.equal(weekClosed(m, normalizeTaps(closeWeek({}, "ainsley", { skipWeekly: true })), "ainsley", w), false);
  /* leave-Friday morning tap is required; an arrival-Friday (Sep 25) tap doesn't substitute */
  const t = closeWeek({}, "hayes", { skipDay: "2026-10-02" });
  t["house-checkoffs:hayes:2026-09-25"] = { "hay-bed": true, "hay-dishes": true };
  assert.equal(weekClosed(mustsFor(KW, "hayes"), normalizeTaps(t), "hayes", w), false);
  /* hub store shape {id: {v, t}} reads the same; v:false is not a tap */
  const hub = {};
  for (const [k, v] of Object.entries(closeWeek({}, "hayes"))) hub[k] = Object.fromEntries(Object.entries(v).map(([id]) => [id, { v: true, t: 1 }]));
  assert.equal(weekClosed(mustsFor(KW, "hayes"), normalizeTaps(hub), "hayes", w), true);
  hub[`house-checkoffs:hayes:${TAP_DAYS[3]}`]["hay-bed"] = { v: false, t: 2 };
  assert.equal(weekClosed(mustsFor(KW, "hayes"), normalizeTaps(hub), "hayes", w), false);
});

test("one use: a closed week lights one control; spending it turns it dark; second spend is a no-op", () => {
  const taps = closeWeek({}, "harris");
  let layer = run(taps);
  assert.deepEqual(ids(layer), ["harris-dinner-vote"]);
  assert.equal(layer.unlocks.lit[0].copy, "Harris. Week closed. Dinner vote.");
  let uses = consumeUnlock({ uses: [] }, "harris-dinner-vote", layer, FRI_AM);
  assert.equal(uses.uses.length, 1);
  layer = run(taps, uses);
  assert.deepEqual(ids(layer), []);
  assert.equal(consumeUnlock(uses, "harris-dinner-vote", layer, FRI_AM).uses.length, 1, "already spent");
  assert.equal(consumeUnlock({ uses: [] }, "hayes-weekend-pick", run({}), FRI_AM).uses.length, 0, "not lit, can't spend");
});

test("Ainsley spends one: gallery photo OR weekend pick, never both", () => {
  const taps = closeWeek({}, "ainsley");
  const layer = run(taps);
  const u = layer.unlocks.lit.find((x) => x.id === "ainsley-gallery-or-weekend");
  assert.deepEqual(u.choices, ["gallery-photo", "weekend-pick"]);
  assert.equal(consumeUnlock({ uses: [] }, u.id, layer, FRI_AM, "bad").uses.length, 0);
  const uses = consumeUnlock({ uses: [] }, u.id, layer, FRI_AM, "gallery-photo");
  assert.equal(uses.uses[0].choice, "gallery-photo");
  assert.deepEqual(ids(run(taps, uses)), []);
});

test("carry-over: once lit, an unlock stays lit until spent, through the kids-away week into the next home week", () => {
  const taps = closeWeek({}, "hayes");
  for (const now of ["2026-10-02T14:59:00-05:00", "2026-10-02T15:00:00-05:00", "2026-10-05T18:00:00-05:00", "2026-10-12T18:00:00-05:00"]) {
    const layer = run(taps, { uses: [] }, at(now));
    assert.deepEqual(ids(layer), ["hayes-weekend-pick"], now);
    assert.equal(layer.unlocks.lit[0].earnedWeek, WEEK, now);
    assert.equal(layer.unlocks.resetsAt, undefined, "no reset");
  }
  /* kids-away week: seat marks go quiet, unlock still lit */
  const away = run(taps, { uses: [] }, at("2026-10-05T18:00:00-05:00"));
  assert.equal(away.kidSeats.quiet, true);
  assert.equal(away.kidSeats.seats.hayes.week.closed, false, "new week's mark is not closed; the unlock is what carries");
  /* spent in the next home week -> dark; stays dark */
  const MON = at("2026-10-12T18:00:00-05:00");
  const uses = consumeUnlock({ uses: [] }, "hayes-weekend-pick", run(taps, { uses: [] }, MON), MON);
  assert.deepEqual(uses.uses[0], { unlock: "hayes-weekend-pick", weekId: WEEK, usedAt: "2026-10-12T18:00:00-05:00" });
  assert.deepEqual(ids(run(taps, uses, MON)), []);
  assert.deepEqual(ids(run(taps, uses, at("2026-10-20T18:00:00-05:00"))), []);
  /* a spend for some other week never clears this one */
  assert.deepEqual(ids(run(taps, { uses: [{ unlock: "hayes-weekend-pick", weekId: "2026-09-18", usedAt: "x" }] }, MON)), ["hayes-weekend-pick"]);
});

test("no stacking: a newer close of the same kind replaces an unspent one; spent then closed again = lit again", () => {
  const NEXT = "2026-10-09";
  const taps = closeWeek(closeWeek({}, "hayes"), "hayes", { week: NEXT });
  const T = at("2026-10-17T10:00:00-05:00");
  let layer = run(taps, { uses: [] }, T);
  assert.equal(layer.unlocks.lit.length, 1, "two closed weeks, one unlock");
  assert.equal(layer.unlocks.lit[0].earnedWeek, NEXT);
  assert.equal(layer.unlocks.lit[0].uses, 1);
  /* spending the replaced week's unlock doesn't touch the newer one */
  assert.deepEqual(ids(run(taps, { uses: [{ unlock: "hayes-weekend-pick", weekId: WEEK, usedAt: "x" }] }, T)), ["hayes-weekend-pick"]);
  /* spent week A, then closes week B -> lit again (for B) */
  const usedA = consumeUnlock({ uses: [] }, "hayes-weekend-pick", run(closeWeek({}, "hayes"), { uses: [] }, at("2026-10-03T10:00:00-05:00")), at("2026-10-03T10:00:00-05:00"));
  assert.equal(usedA.uses[0].weekId, WEEK);
  layer = run(taps, usedA, T);
  assert.deepEqual(ids(layer), ["hayes-weekend-pick"]);
  assert.equal(layer.unlocks.lit[0].earnedWeek, NEXT);
  /* spending B -> dark; A never re-lights */
  layer = run(taps, consumeUnlock(usedA, "hayes-weekend-pick", layer, T), T);
  assert.deepEqual(ids(layer), []);
});

test("week ids: a daily tap's date maps to its chore week (Fri belongs to the week before)", () => {
  assert.equal(weekIdOfTapDay("2026-09-26"), WEEK);
  assert.equal(weekIdOfTapDay("2026-10-01"), WEEK);
  assert.equal(weekIdOfTapDay("2026-10-02"), WEEK);
  assert.equal(weekIdOfTapDay("2026-10-03"), "2026-10-02");
});

test("Us together: house weekend pick only when all three weeks close; independent of kids' own unlocks", () => {
  let taps = closeWeek(closeWeek({}, "harris"), "hayes");
  let layer = run(taps);
  assert.equal(layer.kidSeats.usTogether.lit, false);
  assert.ok(!ids(layer).includes("house-weekend-pick"));
  taps = closeWeek(taps, "ainsley");
  layer = run(taps);
  assert.equal(layer.kidSeats.usTogether.lit, true);
  assert.deepEqual(ids(layer), ["ainsley-gallery-or-weekend", "harris-dinner-vote", "hayes-weekend-pick", "house-weekend-pick"]);
  const house = layer.unlocks.lit.find((u) => u.id === "house-weekend-pick");
  assert.equal(house.seat, "House");
  assert.equal(house.copy, "Us together. Weekend fun, house pick.");
  const uses = consumeUnlock({ uses: [] }, "house-weekend-pick", layer, FRI_AM);
  assert.deepEqual(ids(run(taps, uses)), ["ainsley-gallery-or-weekend", "harris-dinner-vote", "hayes-weekend-pick"]);
  /* carries over; kids spending their own unlocks doesn't touch it */
  const MON = at("2026-10-12T18:00:00-05:00");
  let own = { uses: [] };
  for (const id of ["harris-dinner-vote", "hayes-weekend-pick"]) own = consumeUnlock(own, id, run(taps, own, MON), MON);
  own = consumeUnlock(own, "ainsley-gallery-or-weekend", run(taps, own, MON), MON, "weekend-pick");
  assert.deepEqual(ids(run(taps, own, MON)), ["house-weekend-pick"]);
  /* all three must close in the SAME week: Harris + Hayes week A, Ainsley week B -> no house pick */
  const split = closeWeek(closeWeek(closeWeek({}, "harris"), "hayes"), "ainsley", { week: "2026-10-09" });
  assert.ok(!ids(run(split, { uses: [] }, at("2026-10-17T10:00:00-05:00"))).includes("house-weekend-pick"));
});

test("Harris: one fixed mission per day of week; it never changes after taps; it alone closes his day", () => {
  const THU = at("2026-10-01T18:00:00-05:00");
  const before = run({}, { uses: [] }, THU).kidSeats.seats.harris;
  assert.deepEqual(before.mission, { id: "har-shower", word: "Shower", copy: "Harris. Shower." });
  assert.equal(before.today.closed, false);
  /* other musts tapped: mission unchanged, day still open */
  const other = { "house-checkoffs:harris:2026-10-01": { "har-bed": true, "har-backpack": true, "har-dishes": true } };
  const mid = run(other, { uses: [] }, THU).kidSeats.seats.harris;
  assert.deepEqual(mid.mission, before.mission);
  assert.equal(mid.today.closed, false);
  /* the mission tapped: mark closes, mission still the same */
  const done = run({ "house-checkoffs:harris:2026-10-01": { "har-shower": true } }, { uses: [] }, THU).kidSeats.seats.harris;
  assert.deepEqual(done.mission, before.mission);
  assert.equal(done.today.closed, true);
  /* rotation covers every day with an approved word; Fri after 3:00 PM (arrival) has no mission */
  const byDow = TAP_DAYS.map((d) => harrisMissionFor(d, CONFIG).id);
  assert.deepEqual(byDow, ["har-bed", "har-trash", "har-dishes", "har-empty", "har-postgame", "har-shower", "har-backpack"]);
  assert.equal(new Set(byDow).size, 7);
  assert.equal(run({}, { uses: [] }, at("2026-10-02T07:45:00-05:00")).kidSeats.seats.harris.copy, "Harris. Backpack.");
  assert.equal(run({}, { uses: [] }, at("2026-10-09T16:00:00-05:00")).kidSeats.seats.harris.mission, null);
});

test("Harris week closes when every home day's mission is closed; weekly musts not needed; Hayes/Ainsley keep full musts", () => {
  /* all 7 home days' missions, no weekly, no other musts */
  let layer = run(closeWeek({}, "harris"));
  assert.equal(layer.kidSeats.seats.harris.week.closed, true);
  assert.equal(layer.kidSeats.seats.harris.copy, "Harris. Week closed.");
  assert.deepEqual(ids(layer), ["harris-dinner-vote"]);
  /* one home day's mission missing -> open; tapping every OTHER must that day doesn't substitute */
  const miss = closeWeek({}, "harris", { skipDay: "2026-09-29" });
  miss["house-checkoffs:harris:2026-09-29"] = { "har-bed": true, "har-backpack": true, "har-dishes": true };
  assert.equal(run(miss).kidSeats.seats.harris.week.closed, false);
  /* partial-home week (mid-week handoff Wed Oct 7 3:00 PM): only Thu Oct 8 + Fri Oct 9 are home days */
  const cal = calendar([{ summary: "Kids with Dan", start: { dateTime: "2026-10-07T15:00:00-05:00" }, end: { dateTime: "2026-10-09T15:00:00-05:00" } }]);
  const FRI = at("2026-10-09T14:00:00-05:00");
  const two = { "house-checkoffs:harris:2026-10-08": { "har-shower": true }, "house-checkoffs:harris:2026-10-09": { "har-backpack": true } };
  layer = run(two, { uses: [] }, FRI, cal);
  assert.equal(layer.kidSeats.seats.harris.week.closed, true);
  assert.equal(layer.unlocks.lit.find((u) => u.id === "harris-dinner-vote").earnedWeek, "2026-10-02");
  assert.equal(run({ "house-checkoffs:harris:2026-10-08": { "har-shower": true } }, { uses: [] }, FRI, cal).kidSeats.seats.harris.week.closed, false);
  /* a week with no home days never closes */
  assert.equal(run({}, { uses: [] }, FRI).kidSeats.seats.harris.week.closed, false);
  /* Hayes on the same partial week still needs the full musts (7 days + weekly) */
  const hay = { "house-checkoffs:hayes:2026-10-08": { "hay-bed": true, "hay-dishes": true }, "house-checkoffs:hayes:2026-10-09": { "hay-bed": true, "hay-dishes": true }, "house-checkoffs:hayes:week:2026-10-02": { "hay-room": true } };
  assert.equal(run(hay, { uses: [] }, FRI, cal).kidSeats.seats.hayes.week.closed, false);
  /* Ainsley without her weekly must stays open */
  assert.equal(run(closeWeek({}, "ainsley", { skipWeekly: true })).kidSeats.seats.ainsley.week.closed, false);
});

test("unlock spends file: empty shape, documented per-device; spending keeps the note", () => {
  const u = readJson(path.join(ROOT, "data/unlock-uses.json"));
  assert.deepEqual(u.uses, []);
  assert.match(u.note, /^Per-device until a shared write path is approved/);
  assert.deepEqual(Object.keys(u).sort(), ["note", "uses"]);
  const layer = run(closeWeek({}, "hayes"));
  const next = consumeUnlock(u, "hayes-weekend-pick", layer, FRI_AM);
  assert.equal(next.note, u.note);
  assert.equal(next.uses.length, 1);
  assert.equal(u.uses.length, 0, "input not mutated");
});

test("no names in miss states, no miss words, no callout of who broke Us together", () => {
  const scenarios = [{}, closeWeek({}, "hayes"), closeWeek(closeWeek({}, "hayes"), "ainsley"), closeWeek({}, "harris", { skipDay: "2026-09-29" })];
  for (const taps of scenarios) for (const now of [FRI_AM, at("2026-10-01T18:00:00-05:00"), at("2026-10-05T18:00:00-05:00")]) {
    const { kidSeats, unlocks } = run(taps, { uses: [] }, now);
    assert.deepEqual(missNameHits(kidSeats), []);
    assert.deepEqual(missNameHits(unlocks), []);
    assert.equal(JSON.stringify(kidSeats.usTogether), JSON.stringify({ lit: kidSeats.usTogether.lit }), "Us together never lists kids");
  }
  /* only Hayes closed: only Hayes appears in unlocks */
  const u = JSON.stringify(run(closeWeek({}, "hayes")).unlocks);
  assert.match(u, /Hayes/);
  assert.doesNotMatch(u, /Harris|Ainsley/);
  /* the checker itself catches violations */
  assert.ok(missNameHits({ a: { name: "Harris", closed: false } }).length);
  assert.ok(missNameHits({ copy: "Hayes missed Tuesday" }).length);
  assert.ok(missNameHits({ row: [{ mark: "empty", who: "Ainsley" }] }).length);
});

test("Harris: one mission, operational copy; Hayes: Mon–Sun marks + real game countdown, no stats", () => {
  const taps = { "house-checkoffs:harris:2026-10-01": { "har-bed": true, "har-backpack": true } };
  const { kidSeats } = run(taps, { uses: [] }, at("2026-10-01T18:00:00-05:00"));
  assert.equal(kidSeats.seats.harris.copy, "Harris. Shower.");
  const row = kidSeats.seats.hayes.row;
  assert.deepEqual(row.map((r) => r.dow), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert.deepEqual(row.map((r) => r.mark), ["empty", "empty", "empty", "ahead", "ahead", "off", "off"]);
  assert.equal(kidSeats.seats.hayes.countdown, null, "tonight's game already started; nothing else in the fixture");
  const noon = run(taps, { uses: [] }, at("2026-10-01T12:00:00-05:00")).kidSeats.seats.hayes.countdown;
  assert.equal(noon.copy, "Baseball · vs Lions · Today");
  assert.equal(noon.startIso, "2026-10-01T17:30:00-05:00");
  const blob = JSON.stringify(kidSeats);
  assert.doesNotMatch(blob, /"(done|need|pct|percent|stars?|streak|count|score|points|total)"\s*:/i);
  assert.deepEqual(Object.keys(kidSeats.seats.ainsley), ["name", "week"], "Ainsley: week mark only");
  /* kids away: seats go quiet */
  const away = run({}, { uses: [] }, at("2026-10-05T18:00:00-05:00")).kidSeats;
  assert.equal(away.quiet, true);
  assert.equal(away.seats.harris.mission, undefined);
});

test("banned in kid-layer output: $, jar, balance, payout, rank, mom, '!'", () => {
  for (const [id, s] of [["$", "$10"], ["jar", "Gem jar"], ["balance", "balance"], ["payout", "payout"], ["rank", "ranked first"], ["rank", "leaderboard"], ["mom", "mom"]]) {
    assert.ok(bannedHits(s).includes(id), s);
  }
  const all = closeWeek(closeWeek(closeWeek({}, "harris"), "hayes"), "ainsley");
  for (const taps of [{}, all]) {
    const { kidSeats, unlocks } = run(taps);
    assert.deepEqual(scanObject(kidSeats), []);
    assert.deepEqual(scanObject(unlocks), []);
  }
});

test("committed data/kid-seats.json + data/unlocks.json + config are clean", () => {
  for (const rel of ["data/kid-seats.json", "data/unlocks.json", "data/unlock-uses.json", "config/kid-layer.config.json"]) {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) continue;
    const o = readJson(fp);
    assert.deepEqual(scanObject(o), [], rel);
    assert.deepEqual(missNameHits(o), [], rel);
  }
});
