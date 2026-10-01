// LEDGER · grocery list tests · node --test scripts/wall/grocery-list.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const require = createRequire(import.meta.url);
const G = require(join(repo, "house-grocery-list.js"));
const seedText = readFileSync(join(repo, "data", "grocery-list.json"), "utf8");
const seed = () => JSON.parse(seedText);
function mem(init = {}) {
  const m = { ...init };
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, dump: () => m };
}
const fixedNow = () => Date.parse("2026-10-01T23:30:00Z");

test("seed file: shape, schema, stable ids", () => {
  const s = seed();
  assert.equal(s.version, 1);
  assert.match(s.asOfIso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[56]:00$/);
  assert.ok(!("asOf" in s), "field is asOfIso, not asOf");
  assert.ok(Array.isArray(s.items) && s.items.length > 0);
  const ids = new Set();
  for (const it of s.items) {
    assert.deepEqual(Object.keys(it).sort(), ["addedAt", "checked", "id", "name", "store"]);
    assert.match(it.id, /^g-[a-z0-9-]+$/);
    assert.ok(!ids.has(it.id)); ids.add(it.id);
    assert.ok(["any", "costco"].includes(it.store));
    assert.equal(it.checked, false);
    assert.match(it.addedAt, /-0[56]:00$/);
  }
  for (const q of s.quickAdd) assert.ok(ids.has(q) || typeof q === "string");
  assert.ok(s.pickList.length > 0 && s.pickList.length <= 12, "pick list stays short");
});

test("seed file: zero dollars, no price strings, no links, no stale window", () => {
  assert.ok(!seedText.includes("$"), "no $ anywhere in seed");
  assert.ok(!/\b\d+\.\d{1,2}\b/.test(seedText.replace(/"(asOfIso|addedAt)": "[^"]+"/g, "")), "no decimal price strings");
  assert.ok(!/¢|https?:|www\./i.test(seedText), "no cents, no links out");
  assert.ok(!/\b(price|deal|sale|coupon|balance|total|bogo)\b/i.test(seedText), "no deal/price/balance words");
  assert.ok(!/stale|expires|ttl/i.test(seedText), "no stale window");
  for (const it of seed().items) assert.equal(G.isUnsafe(it.name), false, it.name);
});

test("load seed + list + filter (all vs costco)", () => {
  const l = G.create({ seed: seed(), storage: mem(), now: fixedNow });
  assert.equal(l.list().length, seed().items.length);
  assert.equal(l.filter("all").length, l.list().length);
  const c = l.filter("costco");
  assert.ok(c.length >= 1);
  assert.ok(c.every(i => i.store === "costco"));
  assert.equal(c.length, seed().items.filter(i => i.store === "costco").length);
  assert.equal(l.asOfIso, seed().asOfIso);
});

test("add: from pick list, from chip id, store override, CT timestamp", () => {
  const l = G.create({ seed: seed(), storage: mem(), now: fixedNow });
  const n0 = l.list().length;
  const eggs = l.add("Eggs");
  assert.equal(eggs.id, "g-eggs");
  assert.equal(eggs.store, "any");
  assert.equal(eggs.addedAt, "2026-10-01T18:30:00-05:00");
  const bread = l.add("Bread", "costco");
  assert.equal(bread.store, "costco");
  assert.ok(l.filter("costco").some(i => i.id === bread.id));
  assert.equal(l.list().length, n0 + 2);
  assert.ok(l.pickList().find(p => p.name === "Eggs").onList);
});

test("dedupe: unchecked re-add is a no-op; checked re-add unchecks", () => {
  const l = G.create({ seed: seed(), storage: mem(), now: fixedNow });
  const n0 = l.list().length;
  l.add("bananas"); l.add("  BANANAS "); l.add("g-bananas");
  assert.equal(l.list().length, n0);
  assert.equal(l.toggle("g-bananas").checked, true);
  const back = l.add("Bananas");
  assert.equal(back.checked, false);
  assert.equal(l.list().length, n0);
  l.add("Eggs"); l.add("eggs!");
  assert.equal(l.list().filter(i => G.normalize(i.name) === "eggs").length, 1);
});

test("toggle: flips, unknown id = null", () => {
  const l = G.create({ seed: seed(), storage: mem(), now: fixedNow });
  assert.equal(l.toggle("g-apples").checked, true);
  assert.equal(l.toggle("g-apples").checked, false);
  assert.equal(l.toggle("g-nope"), null);
});

test("clearChecked removes checked items only, and cleared seed items stay gone on reload", () => {
  const storage = mem();
  const l = G.create({ seed: seed(), storage, now: fixedNow });
  const n0 = l.list().length;
  l.toggle("g-apples"); l.toggle("g-grapes");
  assert.equal(l.clearChecked(), 2);
  assert.equal(l.list().length, n0 - 2);
  assert.ok(l.list().every(i => !i.checked));
  assert.equal(l.clearChecked(), 0);
  const again = G.create({ seed: seed(), storage, now: fixedNow });
  assert.ok(!again.list().some(i => i.id === "g-apples"), "cleared seed item does not return");
  assert.equal(again.add("Apples").checked, false, "can be re-added from a chip");
  assert.ok(again.list().some(i => i.id === "g-apples"));
});

test("per-device persistence under wardos.grocery.v1; shared key not touched", () => {
  const storage = mem();
  const l = G.create({ seed: seed(), storage, now: fixedNow });
  l.add("Celery"); l.toggle("g-cheese-sticks");
  assert.equal(G.STORAGE_KEY, "wardos.grocery.v1");
  assert.equal(G.SHARED_KEY_LAST_YES, "house.grocery.shared.v1");
  const keys = Object.keys(storage.dump());
  assert.deepEqual(keys, ["wardos.grocery.v1"]);
  const r = G.create({ seed: seed(), storage, now: fixedNow });
  assert.ok(r.list().some(i => i.name === "Celery"));
  assert.equal(r.list().find(i => i.id === "g-cheese-sticks").checked, true);
});

test("merge: new seed items reach a device that already has state", () => {
  const storage = mem();
  G.create({ seed: seed(), storage, now: fixedNow }).add("Butter");
  const s2 = seed();
  s2.items.push({ id: "g-celery", name: "Celery", store: "any", checked: false, addedAt: s2.asOfIso });
  const r = G.create({ seed: s2, storage, now: fixedNow });
  assert.ok(r.list().some(i => i.id === "g-celery"));
  assert.ok(r.list().some(i => i.name === "Butter"));
});

test("no-dollars guard on add: prices, deals and links are rejected", () => {
  const l = G.create({ seed: seed(), storage: mem(), now: fixedNow });
  const n0 = l.list().length;
  for (const bad of ["Milk $3.99", "Eggs 2.49", "BOGO chips", "https://hy-vee.com", "www.costco.com", "Deal of the week", "", "   "]) {
    assert.equal(l.add(bad), null, bad);
  }
  assert.equal(l.list().length, n0);
});

test("bad storage / no seed still works (no stale badge, no throw)", async () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const l = G.create({ seed: null, storage: broken, now: fixedNow });
  assert.deepEqual(l.list(), []);
  assert.equal(l.add("Eggs").name, "Eggs");
  const viaLoad = await G.load({ fetch: () => Promise.reject(new Error("offline")), storage: mem(), now: fixedNow });
  assert.deepEqual(viaLoad.list(), []);
  const ok = await G.load({ fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(seed()) }), storage: mem(), now: fixedNow });
  assert.equal(ok.list().length, seed().items.length);
});

test("module source carries no $ figures and no links out", () => {
  const src = readFileSync(join(repo, "house-grocery-list.js"), "utf8");
  assert.ok(!/\$\s?\d/.test(src));
  assert.ok(!/<a\s|href=/i.test(src));
});
