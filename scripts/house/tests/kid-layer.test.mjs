import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { choreWeek, normalizeTaps, weekClosed, mustsFor, computeKidLayer, consumeUnlock, missNameHits } from "../kid-layer-lib.mjs";
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

/** Local (localStorage) tap shape: {key: {id: true}}. */
function closeWeek(taps, kid, { skipDay = null, skipWeekly = false } = {}) {
  for (const m of mustsFor(KW, kid)) {
    if (m.cadence === "daily") for (const d of TAP_DAYS) {
      if (d === skipDay) continue;
      const k = `house-checkoffs:${kid}:${d}`; (taps[k] = taps[k] || {})[m.id] = true;
    } else if (!skipWeekly) { const k = `house-checkoffs:${kid}:week:${WEEK}`; (taps[k] = taps[k] || {})[m.id] = true; }
  }
  return taps;
}
const FRI_AM = at("2026-10-02T07:45:00-05:00");
const run = (taps, uses = { uses: [] }, now = FRI_AM) => computeKidLayer({ calendar: calendar(), kidsWeek: KW, taps, uses, config: CONFIG, now });
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
  for (const [k, v] of Object.entries(closeWeek({}, "harris"))) hub[k] = Object.fromEntries(Object.entries(v).map(([id]) => [id, { v: true, t: 1 }]));
  assert.equal(weekClosed(mustsFor(KW, "harris"), normalizeTaps(hub), "harris", w), true);
  hub[`house-checkoffs:harris:${TAP_DAYS[3]}`]["har-bed"] = { v: false, t: 2 };
  assert.equal(weekClosed(mustsFor(KW, "harris"), normalizeTaps(hub), "harris", w), false);
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

test("weekly reset Fri to Fri: unlocks expire at Fri 3:00 PM; a spend in one week doesn't touch the next", () => {
  const taps = closeWeek({}, "hayes");
  assert.deepEqual(ids(run(taps, { uses: [] }, at("2026-10-02T14:59:00-05:00"))), ["hayes-weekend-pick"]);
  assert.deepEqual(ids(run(taps, { uses: [] }, at("2026-10-02T15:00:00-05:00"))), []); /* new week, nothing closed */
  const spentOld = { uses: [{ unlock: "hayes-weekend-pick", weekId: "2026-09-18", usedAt: "2026-09-25T10:00:00-05:00" }] };
  assert.deepEqual(ids(run(taps, spentOld)), ["hayes-weekend-pick"], "last week's spend doesn't carry");
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
  assert.equal(kidSeats.seats.harris.copy, "Harris. Dishes.");
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
  for (const rel of ["data/kid-seats.json", "data/unlocks.json", "config/kid-layer.config.json"]) {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) continue;
    const o = readJson(fp);
    assert.deepEqual(scanObject(o), [], rel);
    assert.deepEqual(missNameHits(o), [], rel);
  }
});
