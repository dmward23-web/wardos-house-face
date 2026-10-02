// LEDGER · kid weekly earned book tests · node --test scripts/wall/kid-earned.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const require = createRequire(import.meta.url);
const K = require(join(repo, "house-kid-earned.js"));
const seedText = readFileSync(join(repo, "data", "kid-earned.json"), "utf8");
const seed = () => JSON.parse(seedText);
function mem(init = {}) {
  const m = { ...init };
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, dump: () => m };
}
const at = iso => () => Date.parse(iso);
const NOW = "2026-10-01T20:00:00-05:00";          // Thu Oct 1, 8 PM CT -> week 2026-09-25 (Fri 3 PM rule)
const book = (o = {}) => K.create({ seed: seed(), storage: mem(), now: at(NOW), ...o });
const totalOf = (b, kid) => b.display().kids.find(k => k.kid === kid).weekTotal;

test("seed: three real kids, current weekKey, entries [], chips, existing week convention", () => {
  const s = seed();
  assert.deepEqual(s.kids.map(k => [k.id, k.name]), [["harris", "Harris"], ["hayes", "Hayes"], ["ainsley", "Ainsley"]]);
  assert.deepEqual(s.entries, [], "no invented earnings");
  assert.equal(s.week.rule, "fri-1500");
  assert.equal(s.weekKey, K.weekKeyFor(Date.parse(s.asOfIso), s.week), "seed weekKey = current week");
  assert.deepEqual(s.bonusAmounts.map(a => a.cents), [100, 200, 500]);
  assert.deepEqual(s.bonusAmounts.map(a => a.label), ["$1", "$2", "$5"]);
  assert.deepEqual(s.bonusReasons.map(r => r.label), ["Kind to a sibling", "Helped without asking", "Great attitude", "Extra effort", "Good listener"]);
  for (const k of s.kids) assert.ok(Number.isInteger(k.earnedCapCents));
});

test("idempotent: applying the same entry id twice is a no-op", () => {
  const b = book();
  const r = b.addBonus({ kid: "hayes", amountChip: 200, reasonChip: "Great attitude", pinOk: true });
  assert.ok(r.ok);
  assert.equal(b.apply(r.entry), false);
  assert.equal(b.apply({ ...r.entry }), false);
  assert.equal(b.merge([r.entry, r.entry]), 0);
  assert.equal(b.entries().length, 1);
  assert.equal(totalOf(b, "hayes"), "$2");
  const e1 = b.addEarned({ kid: "hayes", sourceId: "hay-bed-2026-09-27", amountCents: 100 });
  const e2 = b.addEarned({ kid: "hayes", sourceId: "hay-bed-2026-09-27", amountCents: 100 });
  assert.ok(e1.entry && e2.noop, "same tap twice = one earned entry");
  assert.equal(totalOf(b, "hayes"), "$3");
});

test("union merge of two devices with overlap: no double count (kills resync double-pay)", () => {
  const A = book(), B = book();
  const bonus = A.addBonus({ kid: "harris", amountChip: 500, reasonChip: "kind-sibling", pinOk: true }).entry;
  A.addEarned({ kid: "harris", sourceId: "har-bed-2026-09-27", amountCents: 100 });
  B.addEarned({ kid: "harris", sourceId: "har-bed-2026-09-27", amountCents: 100 }); // same tap seen on B
  B.addEarned({ kid: "harris", sourceId: "har-dishes-2026-09-28", amountCents: 100 });
  B.merge([bonus]);                                                                   // B already got A's bonus once
  // full resync both ways, twice
  for (let i = 0; i < 2; i++) { A.merge(B.entries()); B.merge(A.entries()); }
  assert.equal(A.entries().length, 3);
  assert.equal(B.entries().length, 3);
  assert.equal(totalOf(A, "harris"), "$7");
  assert.equal(totalOf(B, "harris"), "$7");
});

test("partial earned (old Ainsley $0/$20 shape) is not $0", () => {
  // Old shape: some musts done, one missed -> MUSTGATE1 weekEarnDollars() returned 0 (kids-data.js:412-413, 482-484).
  const b = book();
  const done = [["ain-bed", 5], ["ain-toys", 5], ["ain-dishwasher", 3], ["ain-bath", 3]]; // 16 of 20 cap; ain-living + laundry missed
  for (const [id, n] of done) b.addEarned({ kid: "ainsley", sourceId: id + "-2026-09-26", amountCents: n * 100 });
  assert.notEqual(totalOf(b, "ainsley"), "$0");
  assert.equal(totalOf(b, "ainsley"), "$16", "sum of what was earned, not $0 and not all-or-nothing");
  const p = book();
  p.addEarned({ kid: "ainsley", sourceId: "ain-bed-2026-09-26", amountCents: 350 });
  assert.equal(totalOf(p, "ainsley"), "$3.50", "proportional, cents formatting");
  const t = p.totals().find(r => r.kid === "ainsley");
  assert.equal(t.earnedCents, 350);
  assert.ok(Number.isInteger(t.totalCents));
});

test("week boundary (existing rule): Fri 2:59:59 PM -> Fri 3:00 PM CT, incl. DST-end week", () => {
  const w = seed().week;
  assert.equal(K.weekKeyFor(Date.parse("2026-10-02T14:59:59-05:00"), w), "2026-09-25");
  assert.equal(K.weekKeyFor(Date.parse("2026-10-02T15:00:00-05:00"), w), "2026-10-02");
  // Sat 23:59 -> Sun 00:00 is mid-week under the Dad-week rule (same key)
  assert.equal(K.weekKeyFor(Date.parse("2026-10-03T23:59:59-05:00"), w), "2026-10-02");
  assert.equal(K.weekKeyFor(Date.parse("2026-10-04T00:00:00-05:00"), w), "2026-10-02");
  // DST ends Sun Nov 1 2026 (CDT -05 -> CST -06): week Fri Oct 30 3 PM CDT .. Fri Nov 6 3 PM CST
  assert.equal(K.weekKeyFor(Date.parse("2026-11-01T01:30:00-06:00"), w), "2026-10-30");
  assert.equal(K.weekKeyFor(Date.parse("2026-11-06T14:59:59-06:00"), w), "2026-10-30");
  assert.equal(K.weekKeyFor(Date.parse("2026-11-06T15:00:00-06:00"), w), "2026-11-06");
  assert.equal(K.weekKeyFor(Date.parse("2026-11-06T20:59:59Z"), w), "2026-10-30");
  assert.equal(K.weekKeyFor(Date.parse("2026-11-06T21:00:00Z"), w), "2026-11-06");
  // DST starts Sun Mar 14 2027
  assert.equal(K.weekKeyFor(Date.parse("2027-03-19T14:59:59-05:00"), w), "2027-03-12");
  assert.equal(K.weekKeyFor(Date.parse("2027-03-19T15:00:00-05:00"), w), "2027-03-19");
});

test("week boundary (brief's Sunday rule, available as week.rule='sun-0000'): Sat 23:59:59 -> Sun 00:00 CT, incl. DST", () => {
  const w = { rule: "sun-0000" };
  assert.equal(K.weekKeyFor(Date.parse("2026-10-03T23:59:59-05:00"), w), "2026-09-27");
  assert.equal(K.weekKeyFor(Date.parse("2026-10-04T00:00:00-05:00"), w), "2026-10-04");
  // DST-end week: Sat Oct 31 23:59:59 CDT -> Sun Nov 1 00:00 CDT; that week ends Sat Nov 7 23:59:59 CST
  assert.equal(K.weekKeyFor(Date.parse("2026-11-01T04:59:59Z"), w), "2026-10-25");
  assert.equal(K.weekKeyFor(Date.parse("2026-11-01T05:00:00Z"), w), "2026-11-01");
  assert.equal(K.weekKeyFor(Date.parse("2026-11-08T05:59:59Z"), w), "2026-11-01");
  assert.equal(K.weekKeyFor(Date.parse("2026-11-08T06:00:00Z"), w), "2026-11-08");
  // DST-start: Sun Mar 14 2027 00:00 CST
  assert.equal(K.weekKeyFor(Date.parse("2027-03-14T05:59:59Z"), w), "2027-03-07");
  assert.equal(K.weekKeyFor(Date.parse("2027-03-14T06:00:00Z"), w), "2027-03-14");
});

test("weekly reset = display filter; history kept, never deleted", () => {
  let t = Date.parse("2026-10-02T14:00:00-05:00");
  const b = K.create({ seed: seed(), storage: mem(), now: () => t });
  b.addBonus({ kid: "hayes", amountChip: "$5", reasonChip: "Extra effort", pinOk: true });
  assert.equal(totalOf(b, "hayes"), "$5");
  t = Date.parse("2026-10-02T15:00:00-05:00");
  assert.equal(totalOf(b, "hayes"), "$0", "new week shows $0");
  assert.equal(b.entries().length, 1, "old entry kept");
  assert.equal(b.totals("2026-09-25").find(r => r.kid === "hayes").totalCents, 500, "audit by weekKey");
});

test("chip validation: off-chip amounts and reasons rejected; no free text", () => {
  const b = book();
  for (const amountChip of [300, 150, 1000, "3", "$3", -100, 0, "100", null]) {
    assert.equal(b.addBonus({ kid: "harris", amountChip, reasonChip: "Great attitude", pinOk: true }).error, "amount-not-a-chip", String(amountChip));
  }
  for (const reasonChip of ["Was nice", "great attitude", "", "Kind to a sibling $5", null]) {
    assert.equal(b.addBonus({ kid: "harris", amountChip: 100, reasonChip, pinOk: true }).error, "reason-not-a-chip", String(reasonChip));
  }
  assert.equal(b.addBonus({ kid: "erin", amountChip: 100, reasonChip: "Great attitude", pinOk: true }).error, "bad-kid");
  assert.equal(b.apply({ id: "b-harris-1-abcd", kid: "harris", type: "bonus", amount: 300, reason: "Great attitude", at: NOW, weekKey: "2026-09-25" }), false, "off-chip bonus entry from a sync is refused");
  assert.equal(b.apply({ id: "b-harris-2-abcd", kid: "harris", type: "bonus", amount: 150.5, reason: "Great attitude", at: NOW, weekKey: "2026-09-25" }), false, "non-integer cents refused");
  assert.equal(b.entries().length, 0);
  assert.deepEqual(b.bonusAmounts().map(a => a.label), ["$1", "$2", "$5"]);
});

test("parent gate required (pinOk === true AND the parentGate hook if supplied)", () => {
  const b = book();
  for (const pinOk of [undefined, false, "true", 1, "1234"]) {
    assert.equal(b.addBonus({ kid: "ainsley", amountChip: 100, reasonChip: "Good listener", pinOk }).error, "parent-gate");
  }
  const hooked = book({ parentGate: () => false });
  assert.equal(hooked.addBonus({ kid: "ainsley", amountChip: 100, reasonChip: "Good listener", pinOk: true }).error, "parent-gate");
  const ok = book({ parentGate: ctx => ctx.action === "bonus" });
  assert.ok(ok.addBonus({ kid: "ainsley", amountChip: 100, reasonChip: "Good listener", pinOk: true }).ok);
  const r = b.addBonus({ kid: "ainsley", amountChip: 100, reasonChip: "Good listener", pinOk: true });
  assert.equal(b.undoBonus(r.entry.id).error, "parent-gate", "undo is gated too");
});

test("undo = reversal entry (negative, references original), within 10 minutes only", () => {
  let t = Date.parse(NOW);
  const b = K.create({ seed: seed(), storage: mem(), now: () => t });
  const r = b.addBonus({ kid: "harris", amountChip: 200, reasonChip: "Helped without asking", pinOk: true }).entry;
  assert.match(r.id, /^b-harris-\d{13}-[a-z0-9]{4}$/);
  t += 9 * 60 * 1000;
  const u = b.undoBonus(r.id, { pinOk: true });
  assert.ok(u.ok);
  assert.deepEqual([u.entry.id, u.entry.amount, u.entry.reversalOf, u.entry.type], ["r-" + r.id, -200, r.id, "bonus"]);
  assert.equal(b.entries().length, 2, "original kept, reversal appended");
  assert.equal(totalOf(b, "harris"), "$0");
  assert.equal(b.display().kids.find(k => k.kid === "harris").bonusCount, 0);
  assert.ok(b.undoBonus(r.id, { pinOk: true }).noop, "double undo = no-op");
  const late = b.addBonus({ kid: "harris", amountChip: 100, reasonChip: "Great attitude", pinOk: true }).entry;
  t += 10 * 60 * 1000 + 1;
  assert.equal(b.undoBonus(late.id, { pinOk: true }).error, "undo-window-closed");
  assert.equal(totalOf(b, "harris"), "$1");
});

test("display: weekTotal + bonusCount only; no per-chore $, no reasons, no links", () => {
  const b = book();
  b.addEarned({ kid: "hayes", sourceId: "hay-room-week-2026-09-25", amountCents: 200 });
  b.addEarned({ kid: "hayes", sourceId: "hay-bed-2026-09-26", amountCents: 100 });
  b.addBonus({ kid: "hayes", amountChip: 500, reasonChip: "Extra effort", pinOk: true });
  const d = b.display();
  const h = d.kids.find(k => k.kid === "hayes");
  assert.deepEqual(Object.keys(h).sort(), ["bonusCount", "kid", "name", "weekTotal"]);
  assert.equal(h.weekTotal, "$8");
  assert.equal(h.bonusCount, 1);
  const text = JSON.stringify(d);
  assert.equal((text.match(/\$/g) || []).length, 3, "only the three weekTotal strings carry $");
  assert.ok(!/hay-|ain-|har-|Extra effort|Chores|http|www\.|href/.test(text), "no chore ids, reasons or links");
  assert.deepEqual(Object.keys(d).sort(), ["kids", "syncLabel", "synced", "weekKey"]);
  assert.equal(K.formatCents(700), "$7");
  assert.equal(K.formatCents(750), "$7.50");
  assert.equal(K.formatCents(705), "$7.05");
});

test("earned cap holds from existing weeklyAllowance; bonus sits on top; un-tap reverses earned", () => {
  const b = book();
  for (let i = 0; i < 15; i++) b.addEarned({ kid: "harris", sourceId: "har-x" + i + "-2026-09-26", amountCents: 100 });
  assert.equal(totalOf(b, "harris"), "$10");
  b.addBonus({ kid: "harris", amountChip: 100, reasonChip: "Good listener", pinOk: true });
  assert.equal(totalOf(b, "harris"), "$11");
  const c = book();
  c.addEarned({ kid: "hayes", sourceId: "hay-bed-2026-09-26", amountCents: 100 });
  assert.ok(c.undoEarned({ kid: "hayes", sourceId: "hay-bed-2026-09-26" }).entry);
  assert.equal(totalOf(c, "hayes"), "$0");
  const again = c.addEarned({ kid: "hayes", sourceId: "hay-bed-2026-09-26", amountCents: 100 }).entry;
  assert.equal(again.id, "e-hayes-hay-bed-2026-09-26-2", "re-tap = deterministic next generation id");
  assert.equal(totalOf(c, "hayes"), "$1");
});

test("shared write is OFF by default: no network, pending queue, visible 'Not synced'", async () => {
  assert.equal(K.SHARED_WRITE_ENABLED, false);
  assert.equal(K.SHARED_KEY, "house.kidEarned.shared.v1");
  assert.equal(K.PENDING_KEY, "wardos.kidEarned.pending.v1");
  let calls = 0;
  const storage = mem();
  const b = K.create({ seed: seed(), storage, now: at(NOW), fetch: () => { calls++; return Promise.reject(new Error("must not be called")); }, hubBase: "https://hub.example" });
  const s0 = b.syncState();
  assert.equal(s0.synced, false);
  assert.equal(s0.label, "Not synced");
  b.addBonus({ kid: "ainsley", amountChip: 200, reasonChip: "Kind to a sibling", pinOk: true });
  const r = await b.pushShared();
  assert.deepEqual([r.ok, r.reason, r.pendingCount], [false, "shared-write-off", 1]);
  assert.equal(calls, 0, "no request while the flag is off");
  assert.equal(b.display().syncLabel, "Not synced");
  assert.deepEqual(Object.keys(storage.dump()), ["wardos.kidEarned.pending.v1"], "only the pending key is written; never the shared key");
  const reload = K.create({ seed: seed(), storage, now: at(NOW) });
  assert.equal(reload.pending().length, 1, "pending survives reload");
  assert.equal(reload.display().kids.find(k => k.kid === "ainsley").weekTotal, "$2");
  const src = readFileSync(join(repo, "house-kid-earned.js"), "utf8");
  assert.match(src, /var SHARED_WRITE_ENABLED = false;/);
});

test("no stored mutable bank; bad storage / no seed still works", async () => {
  const src = readFileSync(join(repo, "house-kid-earned.js"), "utf8");
  assert.ok(!/house-bank|balance\s*[+-]?=/.test(src), "no bank/balance writes");
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const b = K.create({ seed: null, storage: broken, now: at(NOW) });
  assert.ok(b.addBonus({ kid: "harris", amountChip: 100, reasonChip: "x", pinOk: true }).error); // no chips without a seed
  assert.equal(b.display().kids.length, 3);
  const viaLoad = await K.load({ fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(seed()) }), storage: mem(), now: at(NOW) });
  assert.equal(viaLoad.weekKeyNow(), "2026-09-25");
});
