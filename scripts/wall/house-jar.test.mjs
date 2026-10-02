// LEDGER · house jar tests (time + picks, never cash) · node --test scripts/wall/house-jar.test.mjs
// House rule for jar files: the currency glyph never appears, so this file builds it from its char code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const require = createRequire(import.meta.url);
const J = require(join(repo, "house-jar.js"));
const CUR = String.fromCharCode(36);
const JAR_FILES = ["house-jar.js", "data/house-jar.json", "docs/house-jar-CONTRACT.md", "scripts/wall/house-jar.test.mjs"];
const seedText = readFileSync(join(repo, "data", "house-jar.json"), "utf8");
const seed = () => JSON.parse(seedText);
function mem(init = {}) {
  const m = { ...init };
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, dump: () => m };
}
const NOW = "2026-10-01T20:00:00-05:00";
const clock = iso => { let t = Date.parse(iso); const f = () => t; f.set = s => { t = Date.parse(s); }; f.add = ms => { t += ms; }; return f; };
const book = (o = {}) => J.create({ seed: seed(), storage: mem(), now: clock(NOW), ...o });
const P = { pinOk: true };
const bal = (b, jar) => b.parentView(P).jars.find(j => j.jar === jar);

test("seed: family + three personal jars, rule text, units, chips, reasons, entries []", () => {
  const s = seed();
  assert.deepEqual(s.jars.map(j => [j.id, j.name, j.kind]), [["family", "Family jar", "family"], ["harris", "Harris", "personal"], ["hayes", "Hayes", "personal"], ["ainsley", "Ainsley", "personal"]]);
  assert.deepEqual(s.units.map(u => u.id), ["min", "pick"]);
  assert.deepEqual(s.entries, []);
  assert.deepEqual(s.niceOneChips.map(c => c.label), ["+10 min", "+15 min", "+1 pick"]);
  assert.equal(s.niceOneReasons.length, 5);
  assert.ok(/never cash/i.test(s.ruleText));
  assert.ok(!/\d/.test(s.ruleText), "rule text carries no numbers");
});

test("zero currency glyph in any jar file; no cash words in seed copy", () => {
  for (const f of JAR_FILES) assert.ok(!readFileSync(join(repo, f), "utf8").includes(CUR), f);
  assert.ok(!/dollar|cents|allowance|payday|balance/i.test(seedText), "no cash vocabulary in seed");
});

test("idempotent: same id twice is a no-op; same close credited from two screens = one entry", () => {
  const b = book();
  const n = b.niceOne({ jar: "hayes", chip: "min-10", reason: "Great attitude", ...P }).entry;
  assert.equal(b.apply(n), false);
  assert.equal(b.merge([n, { ...n }]), 0);
  assert.ok(b.credit({ jar: "hayes", unit: "pick", qty: 1, sourceId: "close-2026-10-01", reason: "close-done" }).entry);
  assert.ok(b.credit({ jar: "hayes", unit: "pick", qty: 1, sourceId: "close-2026-10-01", reason: "close-done" }).noop);
  assert.equal(b.entries().length, 2);
  assert.deepEqual([bal(b, "hayes").min, bal(b, "hayes").pick], [10, 1]);
});

test("union merge of two devices with overlap: no double count (no double-pay)", () => {
  const A = book(), B = book();
  const n = A.niceOne({ jar: "family", chip: "pick-1", reason: "Extra effort", ...P }).entry;
  A.credit({ jar: "harris", unit: "min", qty: 15, sourceId: "close-2026-10-01", reason: "close-done" });
  B.credit({ jar: "harris", unit: "min", qty: 15, sourceId: "close-2026-10-01", reason: "close-done" });
  B.merge([n]);
  B.niceOne({ jar: "harris", chip: "min-10", reason: "Kind to a sibling", ...P });
  for (let i = 0; i < 2; i++) { A.merge(B.entries()); B.merge(A.entries()); }
  assert.equal(A.entries().length, 3);
  assert.deepEqual(A.parentView(P), B.parentView(P));
  assert.equal(bal(A, "harris").min, 25);
  assert.equal(bal(A, "family").pick, 1);
});

test("stolen close zeros ONLY that kid's day, in any arrival order", () => {
  const mk = () => {
    const t = clock("2026-09-30T19:00:00-05:00");
    const b = J.create({ seed: seed(), storage: mem(), now: t });
    const e = [];
    e.push(b.credit({ jar: "hayes", unit: "min", qty: 15, sourceId: "close-2026-09-30", reason: "Close done", at: "2026-09-30T20:30:00-05:00" }).entry); // earlier day
    e.push(b.credit({ jar: "hayes", unit: "min", qty: 15, sourceId: "close-2026-10-01", reason: "Close done", at: "2026-10-01T20:30:00-05:00" }).entry);
    e.push(b.credit({ jar: "hayes", unit: "pick", qty: 1, sourceId: "choice-2026-10-01", reason: "Close done", at: "2026-10-01T07:30:00-05:00" }).entry);
    e.push(b.credit({ jar: "harris", unit: "min", qty: 10, sourceId: "close-2026-10-01", reason: "Close done", at: "2026-10-01T20:30:00-05:00" }).entry); // sibling
    e.push(b.credit({ jar: "family", unit: "pick", qty: 1, sourceId: "us-2026-10-01", reason: "Close done", at: "2026-10-01T20:31:00-05:00" }).entry); // family
    e.push(b.zeroDay({ kid: "hayes", reason: "took-claimed-choice", at: "2026-10-01T21:00:00-05:00" }).entry);
    return e;
  };
  const entries = mk();
  const orders = [entries, [...entries].reverse(), [entries[5], entries[2], entries[0], entries[4], entries[1], entries[3]]];
  for (const order of orders) {
    const b = J.create({ seed: seed(), storage: mem(), now: clock(NOW) });
    assert.equal(b.merge(order), 6);
    assert.deepEqual([bal(b, "hayes").min, bal(b, "hayes").pick], [15, 0], "today voided, yesterday kept");
    assert.equal(bal(b, "harris").min, 10, "sibling untouched");
    assert.equal(bal(b, "family").pick, 1, "family jar untouched");
  }
  const b = book();
  assert.ok(b.zeroDay({ kid: "hayes", reason: "stolen-close", dayKey: "2026-10-01" }).entry);
  assert.ok(b.zeroDay({ kid: "hayes", reason: "took-claimed-choice", dayKey: "2026-10-01" }).noop, "one zero-day per kid per day");
  assert.equal(b.zeroDay({ kid: "family", reason: "stolen-close" }).error, "bad-kid", "family jar can't be zeroed");
  assert.equal(b.zeroDay({ kid: "hayes", reason: "was rude" }).error, "not-a-reason");
});

test("disputed close: parent reversal of the zero-day restores that day", () => {
  const b = book();
  b.credit({ jar: "ainsley", unit: "pick", qty: 1, sourceId: "close-2026-10-01", reason: "Close done" });
  const z = b.zeroDay({ kid: "ainsley", reason: "stolen-close" }).entry;
  assert.equal(bal(b, "ainsley").pick, 0);
  assert.equal(b.reverse(z.id).error, "parent-gate");
  assert.ok(b.reverse(z.id, P).entry);
  assert.equal(bal(b, "ainsley").pick, 1);
  assert.equal(b.entries().length, 3, "nothing deleted");
});

test("redeem: parent-only, can't go below 0, floor holds even if a zero-day lands later", () => {
  const b = book();
  b.niceOne({ jar: "harris", chip: "min-15", reason: "Good listener", ...P });
  assert.equal(b.redeem({ jar: "harris", unit: "min", qty: 20, reason: "time-used", ...P }).error, "not-enough");
  assert.equal(b.redeem({ jar: "harris", unit: "min", qty: 10, reason: "time-used" }).error, "parent-gate");
  assert.ok(b.redeem({ jar: "harris", unit: "min", qty: 10, reason: "Time used", ...P }).ok);
  assert.equal(bal(b, "harris").min, 5);
  assert.equal(b.redeem({ jar: "harris", unit: "pick", qty: 1, reason: "picked-movie", ...P }).error, "not-enough");
  b.zeroDay({ kid: "harris", reason: "stolen-close" }); // voids today's add after the spend
  assert.equal(bal(b, "harris").min, 0, "never negative");
  assert.equal(b.redeem({ jar: "harris", unit: "min", qty: 1, reason: "time-used", ...P }).error, "not-enough");
});

test("chips: off-chip values and reasons rejected (no free amount, no free text)", () => {
  const b = book();
  for (const chip of ["min-20", "+20 min", 10, "10", "pick-2", null, "min-10 "]) {
    assert.equal(b.niceOne({ jar: "hayes", chip, reason: "Great attitude", ...P }).error, "not-a-chip", String(chip));
  }
  for (const reason of ["Nice", "", null, "great attitude"]) {
    assert.equal(b.niceOne({ jar: "hayes", chip: "min-10", reason, ...P }).error, "not-a-reason", String(reason));
  }
  const forged = { id: "n-hayes-1790000000000-abcd", jar: "hayes", type: "add", unit: "min", qty: 45, reason: "Great attitude", at: NOW, dayKey: "2026-10-01" };
  assert.equal(b.apply(forged), false, "off-chip Nice one from a sync is refused");
  assert.equal(b.apply({ ...forged, qty: 10.5 }), false, "non-integer qty refused");
  assert.equal(b.apply({ ...forged, unit: "usd", qty: 10 }), false, "no cash unit");
  assert.equal(b.credit({ jar: "hayes", unit: "min", qty: 500, sourceId: "x-1", reason: "close-done" }).error, "bad-qty");
  assert.equal(b.entries().length, 0);
});

test("parent gate required for Nice one, redeem, reversal and the parent view", () => {
  const b = book();
  for (const pinOk of [undefined, false, "true", 1, "1234"]) {
    assert.equal(b.niceOne({ jar: "hayes", chip: "min-10", reason: "Great attitude", pinOk }).error, "parent-gate");
    assert.equal(b.parentView({ pinOk }).error, "parent-gate");
  }
  const hooked = book({ parentGate: () => false });
  assert.equal(hooked.niceOne({ jar: "hayes", chip: "min-10", reason: "Great attitude", ...P }).error, "parent-gate");
  const ok = book({ parentGate: ctx => ctx.action === "nice-one" });
  assert.ok(ok.niceOne({ jar: "hayes", chip: "min-10", reason: "Great attitude", ...P }).ok);
});

test("Nice one undo = reversal within 10 minutes; nothing deleted", () => {
  const t = clock(NOW);
  const b = J.create({ seed: seed(), storage: mem(), now: t });
  const n = b.niceOne({ jar: "family", chip: "pick-1", reason: "Helped without asking", ...P }).entry;
  t.add(9 * 60000);
  const r = b.reverse(n.id, P).entry;
  assert.deepEqual([r.id, r.type, r.refId], ["r-" + n.id, "reversal", n.id]);
  assert.equal(bal(b, "family").pick, 0);
  assert.ok(b.reverse(n.id, P).noop);
  const late = b.niceOne({ jar: "family", chip: "pick-1", reason: "Helped without asking", ...P }).entry;
  t.add(10 * 60000 + 1);
  assert.equal(b.reverse(late.id, P).error, "undo-window-closed");
  assert.equal(b.entries().length, 3);
});

test("wall display API exports NO numbers and no currency glyph (balances not listed)", () => {
  const b = book();
  b.niceOne({ jar: "hayes", chip: "min-15", reason: "Extra effort", ...P });
  b.credit({ jar: "family", unit: "pick", qty: 2, sourceId: "us-2026-10-01", reason: "close-done" });
  const d = b.wallDisplay();
  assert.deepEqual(Object.keys(d).sort(), ["jars", "ruleText", "syncLabel", "synced"]);
  assert.equal(d.ruleText, seed().ruleText);
  const walk = v => {
    if (typeof v === "number") assert.fail("number on the wall: " + v);
    if (typeof v === "string") { assert.ok(!/\d/.test(v), "digit in wall string: " + v); assert.ok(!v.includes(CUR)); }
    if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(d);
  for (const j of d.jars) assert.deepEqual(Object.keys(j).sort(), ["jar", "name"], "no fill state, no counts");
  assert.ok(!/Extra effort|Close done|min|pick/i.test(JSON.stringify(d.jars)));
});

test("shared write OFF by default: no request, pending queue, visible 'Not synced'", async () => {
  assert.equal(J.SHARED_WRITE_ENABLED, false);
  assert.equal(J.SHARED_KEY, "house.jar.shared.v1");
  assert.equal(J.PENDING_KEY, "wardos.jar.pending.v1");
  let calls = 0;
  const storage = mem();
  const b = J.create({ seed: seed(), storage, now: clock(NOW), fetch: () => { calls++; return Promise.reject(new Error("no")); }, hubBase: "https://hub.example" });
  assert.equal(b.wallDisplay().syncLabel, "Not synced");
  b.niceOne({ jar: "ainsley", chip: "pick-1", reason: "Kind to a sibling", ...P });
  const r = await b.pushShared();
  assert.deepEqual([r.ok, r.reason], [false, "shared-write-off"]);
  assert.equal(calls, 0);
  assert.equal(b.wallDisplay().synced, false);
  assert.deepEqual(Object.keys(storage.dump()), ["wardos.jar.pending.v1"], "never writes the shared key");
  const again = J.create({ seed: seed(), storage, now: clock(NOW) });
  assert.equal(again.pending().length, 1);
  assert.equal(bal(again, "ainsley").pick, 1);
  assert.match(readFileSync(join(repo, "house-jar.js"), "utf8"), /var SHARED_WRITE_ENABLED = false;/);
});

test("DST-safe dayKey (America/Chicago)", () => {
  // DST ends Sun Nov 1 2026: both 1:30 AMs are Nov 1
  assert.equal(J.dayKeyFor(Date.parse("2026-11-01T01:30:00-05:00")), "2026-11-01");
  assert.equal(J.dayKeyFor(Date.parse("2026-11-01T01:30:00-06:00")), "2026-11-01");
  assert.equal(J.dayKeyFor(Date.parse("2026-11-01T23:59:59-06:00")), "2026-11-01");
  assert.equal(J.dayKeyFor(Date.parse("2026-11-02T06:00:00Z")), "2026-11-02");
  assert.equal(J.dayKeyFor(Date.parse("2026-11-01T04:59:59Z")), "2026-10-31");
  assert.equal(J.dayKeyFor(Date.parse("2026-11-01T05:00:00Z")), "2026-11-01");
  // DST starts Sun Mar 14 2027
  assert.equal(J.dayKeyFor(Date.parse("2027-03-14T05:59:59Z")), "2027-03-13");
  assert.equal(J.dayKeyFor(Date.parse("2027-03-14T06:00:00Z")), "2027-03-14");
  assert.equal(J.dayKeyFor(Date.parse("2027-03-15T04:59:59Z")), "2027-03-14");
  assert.equal(J.dayKeyFor(Date.parse("2027-03-15T05:00:00Z")), "2027-03-15");
  assert.equal(J.ctIso(Date.parse("2026-11-01T07:30:00Z")), "2026-11-01T01:30:00-06:00");
  // a zero-day on the DST-end day hits only that day
  const b = book();
  b.credit({ jar: "hayes", unit: "min", qty: 10, sourceId: "close-2026-10-31", reason: "close-done", at: "2026-10-31T23:30:00-05:00" });
  b.credit({ jar: "hayes", unit: "min", qty: 10, sourceId: "close-2026-11-01", reason: "close-done", at: "2026-11-01T01:30:00-06:00" });
  b.zeroDay({ kid: "hayes", reason: "stolen-close", at: "2026-11-01T22:00:00-06:00" });
  assert.equal(bal(b, "hayes").min, 10);
});

test("persists across days and weeks (no weekly wipe); no stored bank", () => {
  const t = clock("2026-09-26T10:00:00-05:00");
  const b = J.create({ seed: seed(), storage: mem(), now: t });
  b.niceOne({ jar: "family", chip: "pick-1", reason: "Extra effort", ...P });
  t.set("2026-10-20T10:00:00-05:00");
  assert.equal(bal(b, "family").pick, 1);
  const src = readFileSync(join(repo, "house-jar.js"), "utf8");
  assert.ok(!/house-bank|balance\s*[+-]?=/.test(src));
});
