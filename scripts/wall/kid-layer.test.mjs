// KIDLAYER3 · node scripts/wall/kid-layer.test.mjs · flash (no key = no request, restore, debounce) + one-use unlocks
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

// marks + check-in (never the MUSTS book or the bank)
t("chore done fills today's wall mark once; repeat tap is not 'first' (no second flash)", () => {
  const s = K.memStore();
  assert.deepEqual(K.choreDone(s, "harris", NOW), { marked: true, first: true });
  assert.deepEqual(K.choreDone(s, "harris", NOW + 1000), { marked: true, first: false });
  assert.equal(K.isMarked(s, "harris", NOW), true);
});
t("chore done never writes house-checkoffs / house-bank / jar keys", () => {
  const s = K.memStore(); K.choreDone(s, "hayes", NOW); K.checkIn(s, "hayes", NOW);
  for (const k of Object.keys(s.dump())) assert.ok(!/house-checkoffs|house-bank|jar|allowance/i.test(k), k);
});
t("mark resets with the CT day", () => assert.equal(K.isMarked((() => { const s = K.memStore(); K.choreDone(s, "ainsley", NOW); return s; })(), "ainsley", NOW + 24 * 3600000), false));
t("check-in uses Atlas's who-home shape, per device", () => {
  const s = K.memStore(); const j = K.checkIn(s, "ainsley", NOW);
  assert.equal(j.date, "2026-10-01"); assert.ok(j.kids.find((k) => k.id === "ainsley").checkedInAt);
});

// one-use unlocks · Atlas's data/unlocks.json shape (ATLASLANE4/5)
const LIT = {
  harris: { id: "harris-dinner-vote", seat: "Harris", control: "dinner-vote", tile: "Dinner vote", uses: 1, copy: "Harris. Week closed. Dinner vote." },
  hayes: { id: "hayes-weekend-pick", seat: "Hayes", control: "weekend-pick", tile: "Weekend fun", uses: 1, copy: "Hayes. Week closed. You pick." },
  ainsley: { id: "ainsley-gallery-or-weekend", seat: "Ainsley", control: "gallery-or-weekend", tile: "Gallery or Weekend fun", choices: ["gallery-photo", "weekend-pick"], uses: 1, copy: "Ainsley. Week closed. Gallery or weekend, your call." },
  house: { id: "house-weekend-pick", seat: "House", control: "weekend-pick", tile: "Weekend fun", uses: 1, copy: "Us together. Weekend fun, house pick." }
};
const UL = (kinds, extra = {}, week = "2026-09-25") => ({ asOfIso: "2026-10-01", generatedAt: "2026-10-01T17:00:00-05:00",
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
  assert.deepEqual(K.unlocks(UL(["harris"], { asOfIso: "2026-09-30" }), K.memStore(), NOW), []);
  assert.deepEqual(K.unlocks(UL(["harris"], { generatedAt: "2026-09-29T17:00:00-05:00" }), K.memStore(), NOW), []);
  assert.deepEqual(K.unlocks(UL([], { lit: undefined }), K.memStore(), NOW), []);
});
t("Harris -> dinner vote; Hayes -> Weekend fun; Ainsley -> gallery photo OR weekend; House -> Weekend fun", () => {
  const u = K.unlocks(UL(["harris", "hayes", "ainsley", "house"]), K.memStore(), NOW);
  assert.deepEqual(u.map((x) => [x.id, x.kid, x.choices.map((c) => c.href)]), [
    ["harris-dinner-vote", "harris", ["sheet-dinner.html"]], ["hayes-weekend-pick", "hayes", ["sheet-weekend.html"]],
    ["ainsley-gallery-or-weekend", "ainsley", ["sheet-gallery-hero.html", "sheet-weekend.html"]], ["house-weekend-pick", "house", ["sheet-weekend.html"]]]);
  assert.equal(u[0].copy, "Harris. Week closed. Dinner vote.");
});
t("Us together shows only when Atlas lists house-weekend-pick (wall never derives it)", () =>
  assert.equal(K.unlocks(UL(["harris", "hayes", "ainsley"]), K.memStore(), NOW).some((x) => x.kid === "house"), false));
t("unknown seat / control -> not drawn", () => {
  const j = UL([]); j.lit = [{ ...LIT.hayes, earnedWeek: "2026-09-25", control: "laser-tag" }, { ...LIT.harris, earnedWeek: "2026-09-25", seat: "Erin" }];
  assert.deepEqual(K.unlocks(j, K.memStore(), NOW), []);
});
t("one use, then dark; spend recorded in Atlas's unlock-uses shape", () => {
  const s = K.memStore(), j = UL(["ainsley"]);
  assert.equal(K.useUnlock(j, s, "ainsley-gallery-or-weekend", "nope", NOW), null); // a two-choice unlock needs a real choice
  assert.equal(K.useUnlock(j, s, "ainsley-gallery-or-weekend", "gallery-photo", NOW), "sheet-gallery-hero.html");
  assert.equal(K.unlocks(j, s, NOW)[0].used, true);
  assert.equal(K.useUnlock(j, s, "ainsley-gallery-or-weekend", "weekend-pick", NOW), null); // not even the other choice
  const uses = JSON.parse(s.get(K.USES_KEY));
  assert.deepEqual(uses.uses, [{ unlock: "ainsley-gallery-or-weekend", weekId: "2026-09-25", usedAt: new Date(NOW).toISOString(), choice: "gallery-photo" }]);
  assert.match(uses.note, /Per-device/);
});
t("single-control unlock spends once; a newer earnedWeek lights it again (no stacking)", () => {
  const s = K.memStore();
  assert.equal(K.useUnlock(UL(["hayes"]), s, "hayes-weekend-pick", null, NOW), "sheet-weekend.html");
  assert.equal(K.useUnlock(UL(["hayes"]), s, "hayes-weekend-pick", null, NOW), null);
  assert.equal(K.unlocks(UL(["hayes"], {}, "2026-10-09"), s, NOW)[0].used, false);
});

// seats · Atlas's data/kid-seats.json
t("seats read Atlas's committed kid-seats.json (Harris mission word, Hayes 7-day row, Ainsley week mark)", () => {
  const j = JSON.parse(fs.readFileSync(new URL("../../data/kid-seats.json", import.meta.url)));
  const s = K.seats(j, Date.parse(j.generatedAt) + 60000);
  assert.ok(s.harris && typeof s.harris.word === "string");
  assert.equal(s.hayes.row.length, 7);
  assert.equal(typeof s.ainsley.weekClosed, "boolean");
});
t("seats: not today's / quiet -> null", () => {
  const j = JSON.parse(fs.readFileSync(new URL("../../data/kid-seats.json", import.meta.url)));
  assert.equal(K.seats({ ...j, asOfIso: "2026-09-30" }, Date.parse(j.generatedAt)), null);
  assert.equal(K.seats({ ...j, quiet: true }, Date.parse(j.generatedAt)), null);
});
console.log(`kid-layer: ${n} tests PASS`);
