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

test("seed file: list starts EMPTY; catalog/quickAdd/pickList shape and stable ids", () => {
  const s = seed();
  assert.equal(s.version, 1);
  assert.match(s.asOfIso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[56]:00$/);
  assert.ok(!("asOf" in s), "field is asOfIso, not asOf");
  assert.deepEqual(s.items, [], "9/25 items were bought; the wall list starts empty");
  assert.ok(Array.isArray(s.catalog) && s.catalog.length > 0);
  const ids = new Set(), names = new Set();
  for (const c of s.catalog) {
    assert.deepEqual(Object.keys(c).sort(), ["id", "name", "store"]);
    assert.match(c.id, /^g-[a-z0-9-]+$/);
    assert.equal(c.id, G.slug(c.name), "id is the stable slug of the name");
    assert.ok(!ids.has(c.id)); ids.add(c.id);
    assert.ok(!names.has(G.normalize(c.name))); names.add(G.normalize(c.name));
    assert.ok(["any", "costco"].includes(c.store));
  }
  assert.equal(s.catalog.find(c => c.id === "g-gallon-milk").store, "costco");
  for (const q of s.quickAdd) assert.ok(ids.has(q), "chip resolves to catalog: " + q);
  for (const p of s.pickList) assert.ok(names.has(G.normalize(p)), "pick resolves to catalog: " + p);
  const offered = new Set([...s.quickAdd, ...s.pickList.map(G.slug)]);
  for (const c of s.catalog) assert.ok(offered.has(c.id), "every catalog item is a chip or a pick: " + c.id);
  assert.ok(s.pickList.length > 0 && s.pickList.length <= 12, "pick list stays short");
});

test("seed file: zero dollars, no price strings, no links, no stale window", () => {
  assert.ok(!seedText.includes("$"), "no $ anywhere in seed");
  assert.ok(!/\b\d+\.\d{1,2}\b/.test(seedText.replace(/"(asOfIso|addedAt)": "[^"]+"/g, "")), "no decimal price strings");
  assert.ok(!/¢|https?:|www\./i.test(seedText), "no cents, no links out");
  assert.ok(!/\b(price|deal|sale|coupon|balance|total|bogo)\b/i.test(seedText), "no deal/price/balance words");
  assert.ok(!/stale|expires|ttl/i.test(seedText), "no stale window");
  for (const it of [...seed().items, ...seed().catalog]) assert.equal(G.isUnsafe(it.name), false, it.name);
  for (const p of seed().pickList) assert.equal(G.isUnsafe(p), false, p);
});

test("load seed: empty list; filters work after adding from the catalog (all vs costco)", () => {
  const l = G.create({ seed: seed(), storage: mem(), now: fixedNow });
  assert.deepEqual(l.list(), []);
  assert.deepEqual(l.filter("all"), []);
  assert.deepEqual(l.filter("costco"), []);
  assert.equal(l.quickAdd().length, seed().quickAdd.length);
  assert.ok(l.quickAdd().every(c => !c.onList));
  const milk = l.add("g-gallon-milk");
  assert.deepEqual([milk.id, milk.name, milk.store], ["g-gallon-milk", "Gallon milk", "costco"]);
  l.add("g-bananas");
  assert.deepEqual(l.filter("costco").map(i => i.id), ["g-gallon-milk"]);
  assert.ok(l.filter("costco").every(i => i.store === "costco"));
  assert.deepEqual(l.filter("all").map(i => i.id), ["g-gallon-milk", "g-bananas"]);
  assert.ok(l.quickAdd().find(c => c.id === "g-gallon-milk").onList);
  assert.equal(l.asOfIso, seed().asOfIso);
});

test("add: from pick list, from chip id, store override, CT timestamp", () => {
  const l = G.create({ seed: seed(), storage: mem(), now: fixedNow });
  const n0 = l.list().length;
  const eggs = l.add("Eggs");
  assert.equal(eggs.id, "g-eggs");
  const rav = l.add("Frozen cheese ravioli");
  assert.deepEqual([rav.id, rav.store], ["g-frozen-cheese-ravioli", "any"]);
  const chip = l.add("g-organic-1pct-milk");
  assert.deepEqual([chip.name, chip.store], ["Organic 1% milk", "any"]);
  assert.equal(l.add("g-not-in-catalog"), null, "unknown id is not turned into an item");
  assert.equal(eggs.store, "any");
  assert.equal(eggs.addedAt, "2026-10-01T18:30:00-05:00");
  const bread = l.add("Bread", "costco");
  assert.equal(bread.store, "costco");
  assert.ok(l.filter("costco").some(i => i.id === bread.id));
  assert.equal(l.list().length, n0 + 4);
  assert.ok(l.pickList().find(p => p.name === "Eggs").onList);
});

test("dedupe: unchecked re-add is a no-op; checked re-add unchecks", () => {
  const l = G.create({ seed: seed(), storage: mem(), now: fixedNow });
  assert.equal(l.add("g-bananas").id, "g-bananas");
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
  assert.equal(l.toggle("g-apples"), null, "not on the list yet");
  l.add("g-apples");
  assert.equal(l.toggle("g-apples").checked, true);
  assert.equal(l.toggle("g-apples").checked, false);
  assert.equal(l.toggle("g-nope"), null);
});

test("clearChecked removes checked items only, and cleared seed items stay gone on reload", () => {
  const storage = mem();
  const l = G.create({ seed: seed(), storage, now: fixedNow });
  ["g-apples", "g-grapes", "g-gallon-milk"].forEach(id => l.add(id));
  const n0 = l.list().length;
  l.toggle("g-apples"); l.toggle("g-grapes");
  assert.equal(l.clearChecked(), 2);
  assert.equal(l.list().length, n0 - 2);
  assert.ok(l.list().every(i => !i.checked));
  assert.equal(l.clearChecked(), 0);
  const again = G.create({ seed: seed(), storage, now: fixedNow });
  assert.ok(!again.list().some(i => i.id === "g-apples"), "cleared item does not return");
  assert.deepEqual(again.list().map(i => i.id), ["g-gallon-milk"], "unchecked Costco item survives clear");
  assert.equal(again.add("Apples").checked, false, "can be re-added from a chip");
  assert.ok(again.list().some(i => i.id === "g-apples"));
});

test("per-device persistence under wardos.grocery.v1; shared key not touched", () => {
  const storage = mem();
  const l = G.create({ seed: seed(), storage, now: fixedNow });
  l.add("Celery"); l.add("g-cheese-sticks"); l.toggle("g-cheese-sticks");
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
  s2.items.push({ id: "g-celery", name: "Celery", store: "any", checked: false, addedAt: s2.asOfIso }); /* if Ledger ever seeds a real need */
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
  assert.deepEqual(ok.list(), []);
  assert.equal(ok.add("g-gallon-milk").store, "costco");
});

test("module source carries no $ figures and no links out", () => {
  const src = readFileSync(join(repo, "house-grocery-list.js"), "utf8");
  assert.ok(!/\$\s?\d/.test(src));
  assert.ok(!/<a\s|href=/i.test(src));
});
