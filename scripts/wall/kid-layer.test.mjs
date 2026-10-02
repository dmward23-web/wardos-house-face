// KIDLAYER3 + CHORELAW2 · node scripts/wall/kid-layer.test.mjs · flash (no key = no request, restore, debounce), check-in,
// the one-use Weekend fun unlock, and the chore law controls (MUSTS / CHOICE / CLOSE / Pack / Mystery) on Atlas's kid-seats.json
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const K = require("../../house-wall-kid.js");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const NOW = Date.parse("2026-10-01T17:30:00-05:00");

function fakeLights(state, log) {
  return { canWrite: () => true, effectiveLights: () => ({ lights: Object.entries(state).map(([id, on]) => ({ id, on })) }),
    setLight: (id, p) => { log.push([id, p.on]); state[id] = p.on; } };
}
function clock(start) { let c = start; const q = []; return { now: () => c, setTimeout: (fn, ms) => q.push([c + ms, fn]), tick(ms) { c += ms; q.sort((a, b) => a[0] - b[0]); while (q.length && q[0][0] <= c) q.shift()[1](); } }; }

// flash
t("config ships EMPTY: no hall light confirmed -> nothing sent", () => {
  const cfg = JSON.parse(fs.readFileSync(new URL("../../config/wall-kid.config.json", import.meta.url)));
  assert.deepEqual(cfg.hallFlashLightIds, []);
  const log = []; const f = K.createFlash({ config: cfg, hasKey: () => true, lights: fakeLights({ kitchen: false }, log) });
  assert.deepEqual(f.flash(), { sent: 0, reason: "no hall light confirmed" }); assert.equal(log.length, 0);
});
t("harris-room is never flashed even if listed", () => assert.deepEqual(K.flashIds({ hallFlashLightIds: ["harris-room", "kitchen", "kitchen"] }), ["kitchen"]));
t("no key -> zero requests, no flash", () => {
  const log = []; const f = K.createFlash({ config: { hallFlashLightIds: ["kitchen"] }, hasKey: () => false, lights: fakeLights({ kitchen: false }, log) });
  assert.equal(f.flash().sent, 0); assert.equal(log.length, 0);
});
t("flash inverts for 2 s then restores each light's prior state exactly", () => {
  const log = [], st = { kitchen: false, "dining-room": true }, c = clock(NOW);
  const f = K.createFlash({ config: { hallFlashLightIds: ["kitchen", "dining-room"] }, hasKey: () => true, lights: fakeLights(st, log), now: c.now, setTimeout: c.setTimeout });
  assert.equal(f.flash().sent, 4);
  assert.deepEqual(log, [["kitchen", true], ["dining-room", false]]);
  c.tick(1999); assert.equal(log.length, 2);
  c.tick(1); assert.deepEqual(log.slice(2), [["kitchen", false], ["dining-room", true]]);
  assert.deepEqual(st, { kitchen: false, "dining-room": true });
});
t("debounce: taps during the flash and within the cooldown send nothing", () => {
  const log = [], c = clock(NOW);
  const f = K.createFlash({ config: { hallFlashLightIds: ["kitchen"], flashCooldownMs: 15000 }, hasKey: () => true, lights: fakeLights({ kitchen: false }, log), now: c.now, setTimeout: c.setTimeout });
  f.flash(); assert.equal(f.flash().reason, "debounced");
  c.tick(2000); assert.equal(f.flash().reason, "debounced");
  c.tick(14999); assert.equal(f.flash().reason, "debounced");
  c.tick(1); assert.equal(f.flash().sent, 2);
  assert.equal(log.length, 3); // one full flash (invert + restore) + the new inversion
});
t("unknown prior state -> that light is skipped (never guessed)", () => {
  const log = []; const L = { canWrite: () => true, effectiveLights: () => ({ lights: [{ id: "kitchen", on: null }] }), setLight: (id, p) => log.push([id, p.on]) };
  assert.equal(K.createFlash({ config: { hallFlashLightIds: ["kitchen"] }, hasKey: () => true, lights: L }).flash().reason, "prior state unknown");
  assert.equal(log.length, 0);
});

// check-in (per device, Atlas's who-home shape)
t("check-in uses Atlas's who-home shape, per device", () => {
  const s = K.memStore(); const j = K.checkIn(s, "ainsley", NOW);
  assert.equal(j.date, "2026-10-01"); assert.ok(j.kids.find((k) => k.id === "ainsley").checkedInAt);
});
t("the old wall-only 'Chore done' mark is gone (one chore copy)", () => {
  assert.equal(K.choreDone, undefined); assert.equal(K.isMarked, undefined); assert.equal(K.seats, undefined);
});

// one-use unlocks · Atlas's data/unlocks.json shape (ATLASLANE4/5)
const LIT = {
  house: { id: "house-weekend-pick", seat: "House", control: "weekend-pick", tile: "Weekend fun", uses: 1, copy: "Us together. Weekend fun." },
  harrisOld: { id: "harris-dinner-vote", seat: "Harris", control: "dinner-vote", tile: "Dinner vote", uses: 1, copy: "old" },
  ainsleyOld: { id: "ainsley-gallery-or-weekend", seat: "Ainsley", control: "gallery-or-weekend", tile: "Gallery", choices: ["gallery-photo"], uses: 1, copy: "old" }
};
const UL = (kinds, extra = {}, week = "2026-09-27") => ({ asOfIso: "2026-10-01", generatedAt: "2026-10-01T17:00:00-05:00",
  week: { id: week }, lit: kinds.map((k) => ({ ...LIT[k], earnedWeek: week })), source: "test", ...extra });
t("Atlas's committed data/unlocks.json parses (lit [] today -> nothing shown)", () => {
  const j = JSON.parse(fs.readFileSync(new URL("../../data/unlocks.json", import.meta.url)));
  assert.ok(Array.isArray(j.lit));
  const u = K.unlocks(j, K.memStore(), Date.parse(j.generatedAt) + 60000);
  assert.ok(u.every((x) => j.lit.some((l) => l.id === x.id)));
  if (!j.lit.length) assert.deepEqual(u, []);
});
t("no file -> no unlocks (never inferred)", () => assert.deepEqual(K.unlocks(null, K.memStore(), NOW), []));
t("stale / other-day file -> no unlocks", () => {
  assert.deepEqual(K.unlocks(UL(["house"], { asOfIso: "2026-09-30" }), K.memStore(), NOW), []);
  assert.deepEqual(K.unlocks(UL(["house"], { generatedAt: "2026-09-29T17:00:00-05:00" }), K.memStore(), NOW), []);
  assert.deepEqual(K.unlocks(UL([], { lit: undefined }), K.memStore(), NOW), []);
});
t("chore law: dinner-vote and gallery controls are gone from the control map; only Weekend fun", () => {
  assert.deepEqual(Object.keys(K.CONTROL), ["weekend-pick"]);
  assert.deepEqual(K.unlocks(UL(["harrisOld", "ainsleyOld", "house"]), K.memStore(), NOW).map((x) => [x.id, x.kid]), [["house-weekend-pick", "house"]]);
});
t("Weekend fun spends once; a newer earnedWeek lights it again (no stacking)", () => {
  const s = K.memStore();
  assert.equal(K.useUnlock(UL(["house"]), s, "house-weekend-pick", null, NOW), "sheet-weekend.html");
  assert.equal(K.useUnlock(UL(["house"]), s, "house-weekend-pick", null, NOW), null);
  assert.equal(K.unlocks(UL(["house"], {}, "2026-10-04"), s, NOW)[0].used, false);
  assert.match(JSON.parse(s.get(K.USES_KEY)).note, /Per-device/);
});

// chore law · Atlas's data/kid-seats.json (ATLASLANE8)
const SEATS = JSON.parse(fs.readFileSync(new URL("../../data/kid-seats.json", import.meta.url)));
const at = (hhmm) => Date.parse(`2026-10-01T${hhmm}:00-05:00`);
const law = (patch = {}) => { const j = structuredClone(SEATS); j.generatedAt = "2026-10-01T03:05:00-05:00"; return Object.assign(j, typeof patch === "function" ? patch(j) || {} : patch); };
const openChoice = (j) => { j.choice = { ...j.choice, claimedBy: null, claimedAt: null, locked: false, done: false, open: true, exception: false }; };
const DAY = "house-checkoffs:%k:2026-10-01";
const keyFor = (k) => DAY.replace("%k", k);

t("committed kid-seats.json: 4 MUSTS per kid, ids must-*, words from Atlas", () => {
  for (const k of K.ORDER) {
    const m = K.musts(SEATS, K.memStore(), k, at("20:30"));
    assert.equal(m.items.length, 4);
    assert.ok(m.items.every((x) => /^must-[a-z]+$/.test(x.id)));
    assert.deepEqual(m.items.map((x) => x.word), SEATS.seats[k].musts.map((x) => x.word));
  }
});
t("not today's / stale / quiet (kids away) -> no chore controls at all", () => {
  assert.equal(K.musts({ ...SEATS, asOfIso: "2026-09-30" }, K.memStore(), "hayes", at("20:30")), null);
  assert.equal(K.musts({ ...SEATS, quiet: true }, K.memStore(), "hayes", at("20:30")), null);
  assert.equal(K.musts(null, K.memStore(), "hayes", at("20:30")), null);
});
t("MUSTS binary and capped at 4: a 5th must in the data is not drawn; a second tap changes nothing", () => {
  const j = law((x) => { x.seats.hayes.musts = x.seats.hayes.musts.concat([{ id: "must-extra", word: "Extra", closed: false }]); });
  const s = K.memStore();
  assert.equal(K.musts(j, s, "hayes", at("16:00")).items.length, 4);
  assert.equal(K.tapMust(s, j, "hayes", "must-extra", at("16:00")).ok, false);
  const r1 = K.tapMust(s, j, "hayes", "must-bed", at("16:00")), r2 = K.tapMust(s, j, "hayes", "must-bed", at("16:01"));
  assert.equal(r1.first, true); assert.equal(r2.first, false);
  assert.deepEqual(JSON.parse(s.get(keyFor("hayes"))), { "must-bed": true });
});
t("Dragon fed replaces Hayes's 4th only when Atlas's data swaps it in", () => {
  const j = law((x) => { x.seats.hayes.musts[3] = { id: "must-dragon", word: "Dragon fed", closed: false }; });
  assert.deepEqual(K.musts(j, K.memStore(), "hayes", at("16:00")).items.map((x) => x.id), ["must-bed", "must-hamper", "must-dish", "must-dragon"]);
  assert.deepEqual(K.musts(j, K.memStore(), "harris", at("16:00")).items.map((x) => x.id).slice(3), ["must-floor"]);
});
t("Harris: the tap fills the tile in the same paint (state returned with the write)", () => {
  const s = K.memStore(), j = law();
  const r = K.tapMust(s, j, "harris", "must-dish", at("16:00"));
  assert.equal(r.musts.done, 1); assert.equal(K.musts(j, s, "harris", at("16:00")).items.find((x) => x.id === "must-dish").closed, true);
  ["must-bed", "must-hamper"].forEach((id) => K.tapMust(s, j, "harris", id, at("16:00")));
  assert.equal(K.tapMust(s, j, "harris", "must-floor", at("16:00")).allNow, true);
});
t("checkoff keys: house-checkoffs:<kid>:<house day> with law ids only (must-*, close, choice-claim, choice-done, pack-*)", () => {
  const s = K.memStore();
  const j = law((x) => { openChoice(x); x.pack = { travelWeek: true, dark: false, items: [{ id: "pack-dragon", word: "Dragon care", done: false }, { id: "pack-bag", word: "Bag", done: false }, { id: "pack-charger", word: "Charger", done: false }] }; });
  K.tapMust(s, j, "harris", "must-bed", at("16:00"));
  K.claimChoice(s, j, "harris", at("16:00")); K.choiceDone(s, j, "harris", at("16:05"));
  K.tapClose(s, j, "hayes", at("20:00"));
  K.tapPack(s, j, "ainsley", "pack-charger", at("16:00"));
  const d = s.dump();
  assert.deepEqual(Object.keys(d).sort(), ["house-checkoffs:ainsley:week:2026-09-27", "house-checkoffs:harris:2026-10-01", "house-checkoffs:hayes:2026-10-01"]);
  assert.deepEqual(JSON.parse(d["house-checkoffs:harris:2026-10-01"]), { "must-bed": true, "choice-claim": true, "choice-done": true });
  assert.deepEqual(JSON.parse(d["house-checkoffs:hayes:2026-10-01"]), { close: true });
  assert.deepEqual(JSON.parse(d["house-checkoffs:ainsley:week:2026-09-27"]), { "pack-charger": true });
  for (const k of Object.keys(d)) assert.match(k, /^house-checkoffs:(harris|hayes|ainsley):(week:)?\d{4}-\d{2}-\d{2}$/); // house-tapsync.js KEY_RE
  for (const v of Object.values(d)) for (const id of Object.keys(JSON.parse(v))) assert.match(id, /^(must-[a-z]+|close|choice-claim|choice-done|pack-(dragon|bag|charger))$/);
  assert.equal(K.dayKey("hayes", K.houseDay(Date.parse("2026-10-02T02:30:00-05:00"))), "house-checkoffs:hayes:2026-10-01"); // resets 3:00 AM CT
});
t("CHOICE: first tap owns it, siblings are locked out, and no un-claim exists", () => {
  const s = K.memStore(), j = law(openChoice);
  assert.equal(K.choice(j, s, "hayes", at("07:30")).open, true);
  assert.deepEqual(K.claimChoice(s, j, "hayes", at("07:30")), { ok: true, owner: "hayes" });
  assert.deepEqual(K.claimChoice(s, j, "harris", at("07:31")), { ok: false, owner: "hayes" });
  assert.deepEqual(K.claimChoice(s, j, "ainsley", at("07:32")), { ok: false, owner: "hayes" });
  assert.equal(s.get(keyFor("harris")), null); assert.equal(s.get(keyFor("ainsley")), null);
  const h = K.choice(j, s, "harris", at("07:33"));
  assert.equal(h.lockedOut, true); assert.equal(h.open, false);
  assert.deepEqual(K.claimChoice(s, j, "hayes", at("07:40")), { ok: true, owner: "hayes" }); // owner re-tap: still owns it
  assert.equal(K.choice(j, s, "hayes", at("07:41")).mine, true);
  assert.equal(K.choiceDone(s, j, "harris", at("08:00")).ok, false); // a sibling can't finish it either
  assert.equal(Object.keys(K).some((n) => /un-?claim|release|drop/i.test(n)), false);
  assert.doesNotMatch(fs.readFileSync(new URL("../../wall.html", import.meta.url), "utf8"), /unclaim|un-claim|data-law-release/i);
});
t("CHOICE: Atlas's claimedBy (another device) wins; unclaimed at 5 PM / exception -> no claim button", () => {
  const s = K.memStore(), j = law((x) => { openChoice(x); x.choice.claimedBy = "Ainsley"; x.choice.locked = true; });
  assert.deepEqual(K.claimChoice(s, j, "harris", at("07:30")), { ok: false, owner: "ainsley" });
  const late = law(openChoice);
  assert.equal(K.choice(late, s, "harris", at("17:00")).open, false);
  assert.equal(K.claimChoice(s, late, "harris", at("17:01")).ok, false);
  assert.equal(K.choice(SEATS, s, "harris", at("20:30")).exception, true); // committed file: unclaimed, Dad Seat exception
});
t("CLOSE: only inside Atlas's window, only for kids in close.kids, writes only that kid's key", () => {
  const s = K.memStore(), j = law();
  assert.equal(K.close(j, s, "harris", at("19:29")), null);
  assert.equal(K.tapClose(s, j, "harris", at("19:29")).ok, false);
  assert.equal(K.tapClose(s, j, "harris", at("21:31")).ok, false);
  assert.equal(K.tapClose(s, j, "harris", at("19:30")).ok, true);
  assert.deepEqual(Object.keys(s.dump()), [keyFor("harris")]);
  assert.equal(K.close(j, s, "harris", at("20:00")).closed, true);
  assert.equal(K.close(j, s, "hayes", at("20:00")).closed, false);
  const away = law((x) => { delete x.close.kids.ainsley; });
  assert.equal(K.close(away, s, "ainsley", at("20:00")), null);
});
t("Mystery close: hidden until that kid's MUSTS are 4/4, never shown off-day", () => {
  const s = K.memStore(), j = law((x) => { x.seats.hayes.mystery = { hidden: false, copy: "Mystery close: +1 pick." }; });
  assert.equal(K.mystery(law(), s, "hayes", at("16:00")), null); // not a mystery day
  ["must-bed", "must-hamper", "must-dish"].forEach((id) => K.tapMust(s, j, "hayes", id, at("16:00")));
  assert.deepEqual(K.mystery(j, s, "hayes", at("16:00")), { hidden: true }); // 3/4
  K.tapMust(s, j, "hayes", "must-floor", at("16:00"));
  assert.deepEqual(K.mystery(j, s, "hayes", at("16:00")), { hidden: false, copy: "Mystery close: +1 pick." });
  const atlasHidden = law((x) => { x.seats.hayes.mystery = { hidden: true }; });
  assert.deepEqual(K.mystery(atlasHidden, s, "hayes", at("16:00")), { hidden: true }); // Atlas still hides it -> stays hidden
  assert.doesNotMatch(JSON.stringify(SEATS.seats), /\$/);
});
t("Pack: travel weeks only, 3-item cap, dark once THIS kid's bag is tapped", () => {
  const s = K.memStore();
  assert.deepEqual(K.pack(SEATS, s, "harris", at("20:30")), { dark: true, items: [] }); // committed: not a travel week
  const j = law((x) => { x.pack = { travelWeek: true, dark: false, items: [{ id: "pack-dragon", word: "Dragon care", done: false }, { id: "pack-bag", word: "Bag", done: false },
    { id: "pack-charger", word: "Charger", done: false }, { id: "pack-snacks", word: "Snacks", done: false }] }; });
  const p = K.pack(j, s, "hayes", at("16:00"));
  assert.equal(p.dark, false); assert.deepEqual(p.items.map((x) => x.id), ["pack-dragon", "pack-bag", "pack-charger"]);
  assert.equal(K.tapPack(s, j, "hayes", "pack-snacks", at("16:00")).ok, false);
  assert.equal(K.tapPack(s, j, "hayes", "pack-dragon", at("16:00")).pack.dark, false);
  assert.equal(K.tapPack(s, j, "hayes", "pack-bag", at("16:01")).pack.dark, true);
  assert.equal(K.tapPack(s, j, "hayes", "pack-charger", at("16:02")).ok, false, "his own Pack is dark");
  assert.deepEqual(JSON.parse(s.get("house-checkoffs:hayes:week:2026-09-27")), { "pack-dragon": true, "pack-bag": true });
});
t("Pack PER KID (Atlas ruling): Hayes taps Bag -> Hayes's Pack dark, Harris's and Ainsley's stay lit (local taps and Atlas kids[kid])", () => {
  const items = [{ id: "pack-dragon", word: "Dragon care" }, { id: "pack-bag", word: "Bag" }, { id: "pack-charger", word: "Charger" }];
  const s = K.memStore(), j = law((x) => { x.pack = { travelWeek: true, dark: false, items }; });
  assert.equal(K.tapPack(s, j, "hayes", "pack-bag", at("16:01")).pack.dark, true);
  assert.equal(K.pack(j, s, "hayes", at("16:02")).dark, true);
  for (const k of ["harris", "ainsley"]) {
    const q = K.pack(j, s, k, at("16:02"));
    assert.deepEqual([q.dark, q.items.map((x) => x.id + ":" + x.done)], [false, ["pack-dragon:false", "pack-bag:false", "pack-charger:false"]], k + " stays lit, nothing marked");
  }
  assert.equal(K.tapPack(s, j, "harris", "pack-charger", at("16:03")).ok, true, "Harris can still pack");
  assert.equal(K.pack(j, s, "ainsley", at("16:03")).items.find((x) => x.id === "pack-charger").done, false, "Harris's charger is his only");
  // Atlas's per-kid shape (kid-seats.json after the hub sync): kids.hayes dark, siblings lit
  const a = law((x) => { x.pack = { travelWeek: true, dark: false, perKid: true, items, kids: {
    hayes: { dark: true, items: [] }, harris: { dark: false, items: items.map((i) => ({ ...i, done: false })) }, ainsley: { dark: false, items: items.map((i) => ({ ...i, done: i.id === "pack-dragon" })) } } }; });
  const e = K.memStore();
  assert.equal(K.pack(a, e, "hayes", at("16:05")).dark, true);
  assert.equal(K.pack(a, e, "harris", at("16:05")).dark, false);
  assert.deepEqual(K.pack(a, e, "ainsley", at("16:05")).items.map((x) => x.done), [true, false, false]);
  // old shared shape never darkens a sibling from a sibling's local tap
  assert.ok(!/ORDER\.some\(function \(k\) \{ return tapOn\(readTaps\(store, weekKey/.test(fs.readFileSync(new URL("../../house-wall-kid.js", import.meta.url), "utf8")), "no any-kid Pack read");
});
t("CLOSE is the routine (Atlas confirmed): the button says only 'Close', no countdown / seconds / timer text for it", () => {
  const wall = fs.readFileSync(new URL("../../wall.html", import.meta.url), "utf8"), kid = fs.readFileSync(new URL("../../house-wall-kid.js", import.meta.url), "utf8");
  const lawHtml = wall.slice(wall.indexOf("function lawHtml("), wall.indexOf("function seatHtml("));
  assert.match(lawHtml, /mustBtn\("data-law-close", kid, "", "Close", cl\.closed, "close"\)/);
  const closeFns = kid.slice(kid.indexOf("function close("), kid.indexOf("/* Pack:"));
  for (const src of [lawHtml.slice(lawHtml.indexOf("K.close(")), closeFns]) assert.doesNotMatch(src.slice(0, 900), /\b90\b|second|secs|countdown|timer|setInterval|setTimeout/i);
  assert.doesNotMatch(wall + kid, /90 seconds|90s\b|\b\d+ ?sec(onds)? left/i);
});
t("rewards by age: Harris run pauses (never reset copy), Hayes run + captain, Ainsley trusted-with only (no counts)", () => {
  const j = law((x) => { x.seats.harris.streak = { days: 3, paused: true }; x.seats.hayes.streak = { days: 1 }; x.seats.hayes.captainTonight = true; });
  assert.deepEqual(K.reward(j, "harris", at("16:00")), { kid: "harris", days: 3, paused: true });
  assert.deepEqual(K.reward(j, "hayes", at("16:00")), { kid: "hayes", days: 1, captain: true });
  assert.equal(K.runText(1), "1 day."); assert.equal(K.runText(0), "");
  const a = K.reward(SEATS, "ainsley", at("20:30"));
  assert.deepEqual(Object.keys(a).sort(), ["kid", "line", "trusted"]);
  assert.deepEqual(a.trusted, SEATS.seats.ainsley.trustedWith);
  assert.equal(K.musts(SEATS, K.memStore(), "ainsley", at("20:30")).seatOnly, true);
});
t("no taps ever touch the bank, a jar or money keys", () => {
  const s = K.memStore(), j = law(openChoice);
  K.ORDER.forEach((k) => { K.tapMust(s, j, k, "must-bed", at("20:00")); K.tapClose(s, j, k, at("20:00")); K.checkIn(s, k, at("20:00")); });
  K.claimChoice(s, j, "hayes", at("16:00"));
  for (const k of Object.keys(s.dump())) assert.doesNotMatch(k, /house-bank|jar|allowance|money/i);
});
console.log(`kid-layer: ${n} tests PASS`);
