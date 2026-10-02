// CHORELAW3 · kid boards use the chore law's per-kid must-* ids (Dan's chore law, Atlas's kids-week).
// node scripts/wall/chore-ids.test.mjs
import fs from "node:fs"; import vm from "node:vm"; import assert from "node:assert/strict";
const root = new URL("../../", import.meta.url);
const src = fs.readFileSync(new URL("kids-data.js", root), "utf8");
const week = JSON.parse(fs.readFileSync(new URL("kids-week.json", root), "utf8"));
let n = 0; const t = async (name, fn) => { await fn(); n++; };
function boot(store = {}, pageKid = null) {
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const body = { getAttribute: (a) => (a === "data-kid" ? pageKid : null) };
  const document = { body, readyState: "complete", querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {}, documentElement: { getAttribute: () => null } };
  const win = { localStorage: ls, document, CustomEvent: function () {}, addEventListener() {}, fetch: () => Promise.reject(new Error("offline")) };
  const ctx = { window: win, localStorage: ls, document, CustomEvent: function () {}, console, Intl, Date, setTimeout, clearTimeout };
  ctx.window.window = ctx.window; vm.createContext(ctx); vm.runInContext(src, ctx);
  const W = ctx.window.WardKids; W._data = week; return { W, store };
}
const kids = week.kids;
await t("kids-week (Atlas ATLASLANE9) carries the law's ids; kids-data knows every one, nothing else", () => {
  const { W } = boot();
  for (const k of ["harris", "hayes", "ainsley"]) for (const q of kids[k].quests) if (!q.optional && q.cadence !== "addon") assert.ok(W.MUST_IDS[q.id], k + " " + q.id + " is a law must id");
  for (const id of ["must-bed", "must-hamper", "must-dish", "must-floor", "must-dragon"]) assert.ok(W.MUST_IDS[id], id);
});
await t("a qualified tap writes the kid's own day key (the wall's key), plain id; siblings untouched", () => {
  const { W, store } = boot();
  W.setCheck("hayes:must-bed", true, week);
  const k = "house-checkoffs:hayes:" + W.DAY_ISO;
  assert.deepEqual(JSON.parse(store[k]), { "must-bed": true });
  assert.equal(W.getCheck("hayes:must-bed", week), true);
  assert.equal(W.getCheck("harris:must-bed", week), false); assert.equal(W.getCheck("ainsley:must-bed", week), false);
  assert.ok(!(W.CHECK_KEY in store) || !JSON.parse(store[W.CHECK_KEY])["must-bed"], "never written to the shared flat key");
});
await t("unqualified must id: the kid board's own kid (body data-kid); with no kid it is a no-op, never a shared write", () => {
  const a = boot({}, "ainsley"); a.W.setCheck("must-dish", true, week);
  assert.deepEqual(JSON.parse(a.store["house-checkoffs:ainsley:" + a.W.DAY_ISO]), { "must-dish": true });
  const none = boot({}, null); assert.equal(none.W.setCheck("must-dish", true, week), null);
  assert.deepEqual(Object.keys(none.store), []);
  assert.equal(none.W.getCheck("must-dish", week), false);
});
await t("old ids: saved har-bed / hay-dishes checkoffs carry over to the must; retired ids (backpack, trash) never write and never count", () => {
  const { W, store } = boot();
  const kh = "house-checkoffs:harris:" + W.DAY_ISO, ky = "house-checkoffs:hayes:" + W.DAY_ISO;
  store[kh] = JSON.stringify({ "har-bed": true }); store[ky] = JSON.stringify({ "hay-dishes": true, "hay-backpack": true });
  assert.equal(W.getCheck("harris:must-bed", week), true); assert.deepEqual(JSON.parse(store[kh]), { "must-bed": true }, "migrated in place");
  assert.equal(W.getCheck("hayes:must-dish", week), true);
  assert.equal(W.getCheck("har-bed", week), true, "an old row id reads its must");
  W.setCheck("har-bed", false, week); assert.deepEqual(JSON.parse(store[kh]), { "must-bed": false }, "an old row tap writes the must");
  const before = JSON.stringify(store);
  assert.equal(W.setCheck("hay-backpack", true, week), null); assert.equal(W.setCheck("har-trash", true, week), null);
  assert.equal(JSON.stringify(store), before, "retired: no write");
  assert.equal(W.getCheck("hay-backpack", week), false);
  assert.ok(W.resolveCheck("hay-backpack").retired); assert.ok(!W.resolveCheck("ain-babysit").retired, "Ainsley's hire add-on stays");
  for (const [old, to] of Object.entries(W.LEGACY_TO_MUST)) assert.ok(W.MUST_IDS[to], old + " -> " + to);
});
await t("CHORELAW3 Ainsley: no stars:1 default, no star currency, no grow token, no star chips on her board", () => {
  const { W } = boot();
  assert.equal(W.questMeta("ainsley", "ainsley:must-bed", week).stars, 0);
  assert.equal(W.questMeta("ainsley", "nope", week).stars, 0, "fallback is 0 for her");
  assert.equal(W.questMeta("ainsley", "x", {}).stars, 0);
  assert.equal(W.questMeta("hayes", "hayes:must-bed", week).stars, 1, "boys unchanged");
  assert.ok(!/★/.test(JSON.stringify(W.getBankView("ainsley", week).currency || {})), "no ★ currency fallback");
  assert.equal(W.growGoalView("ainsley", week, W.getBankView("ainsley", week)).unit, "");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(code, /ainsley: \{ cls: "grow-jar", token: "", label: "" \}/);
  assert.match(code, /if \(NO_STARS\[bank\.kidId\]\) \{/);
});
await t("kid boards render qualified tap ids (data-check=\"kid:must-x\") and no data-stars for Ainsley", () => {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(code, /var cid = qid\(kidId, q\.id\);/);
  assert.match(code, /data-check="' \+ esc\(cid\) \+ '" data-day-iso=/);
  assert.match(code, /var starsAttr = NO_STARS\[kidId\] \? "" :/);
  assert.doesNotMatch(code, /data-check="' \+ esc\(q\.id\)/, "no unqualified tap id left");
  const eng = fs.readFileSync(new URL("house-kid-engage.js", root), "utf8");
  assert.match(eng, /getCheck\(Q\(kidId, qs\[i\]\.id\), iso\)/); assert.match(eng, /data-hq-claim="' \+ esc\(Q\(kidId, q\.id\)\)/);
});
console.log(`chore-ids: ${n} tests PASS`);
