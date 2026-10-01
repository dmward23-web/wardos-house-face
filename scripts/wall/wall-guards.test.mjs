// WALLGUARD1 · node scripts/wall/wall-guards.test.mjs · static + fake-fetch guards for wall.html (branch wall-redesign-1)
// Scenes never touch the thermostat; chore done never writes jar/bank keys; no $-page badges; no jar/$ copy; no camera feed.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = new URL("../../", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), "utf8");
const A = require("../../house-wall-actions.js");
const K = require("../../house-wall-kid.js");
const S = require("../../house-wall-status.js");
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const wall = read("wall.html"), hub = read("sheet-index.html"), actions = read("house-wall-actions.js");
/** visible copy: drop comments, <script>, <style>, tags and attributes */
const copy = (h) => h.replace(/<!--[\s\S]*?-->/g, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

await t("scene handlers in wall.html never reference sensi/travel (paintScenes + click block, <=12 lines each)", () => {
  const lines = wall.split("\n");
  const idx = lines.findIndex((l) => /\["home", "leave"\]\.forEach/.test(l));
  const pre = lines.findIndex((l) => /function paintScenes\(/.test(l));
  const end = lines.findIndex((l, i) => i > idx && /function paintTravel\(/.test(l));
  assert.ok(idx > 0 && pre > 0 && end > idx && end - idx <= 12 && idx - pre <= 12, "scene blocks found");
  const win = lines.slice(pre, end).join("\n");
  assert.ok(/act\.scene\(id\)/.test(win));
  assert.doesNotMatch(win, /sensi|travel/i);
});
await t("house-wall-actions scene() body never references sensi/travel", () => {
  const m = actions.match(/function scene\(id\) \{[\s\S]*?\n    \}/);
  assert.ok(m); assert.doesNotMatch(m[0], /sensi|travel|call\(|fetch/i);
});
await t("fake fetch: both scenes with a key -> 0 /api/sensi calls, only setLight", async () => {
  const calls = [], lit = [];
  const act = A.create({ fetch: (u) => { calls.push(u); return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }); },
    getToken: () => "k", getBase: () => "https://hub.invalid", lights: { canWrite: () => true, setLight: (id, p) => lit.push([id, p.on]) } });
  act.scene("home"); act.scene("leave");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(calls.filter((u) => /\/api\/sensi/.test(u)).length, 0);
  assert.equal(calls.length, 0);
  assert.ok(lit.length > 0);
});
await t("chore done + check-in never write jar / bank / MUSTS-book keys", () => {
  const s = K.memStore(), NOW = Date.parse("2026-10-01T17:30:00-05:00");
  K.KIDS.forEach((k) => { K.choreDone(s, k.id, NOW); K.choreDone(s, k.id, NOW + 1000); K.checkIn(s, k.id, NOW); });
  const keys = Object.keys(s.dump());
  assert.ok(keys.length > 0);
  keys.forEach((k) => assert.match(k, /^wardos-wall-(mark|whohome)/));
  keys.forEach((k) => assert.doesNotMatch(k, /jar|bank|checkoff|allowance|money/i));
});
await t("wall.html source never touches house-checkoffs / house-bank / jar keys", () => {
  const code = wall.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /house-checkoffs|house-bank|HouseBank|HouseChores/);
  assert.doesNotMatch(read("house-wall-kid.js").replace(/\/\*[\s\S]*?\*\//g, ""), /house-checkoffs|house-bank/);
});
await t("wall.html has no badge or link to sheet-allowance, sheet-chores or kid-*.html", () => {
  assert.doesNotMatch(wall, /href="(sheet-allowance|sheet-chores|kid-[a-z]+)\.html"/);
  assert.equal((wall.match(/class="badge/g) || []).length, 17);
});
await t("no $ amounts or 'jar' in wall.html visible copy; no bot names either", () => {
  const c = copy(wall);
  assert.doesNotMatch(c, /\$\s?\d/);
  assert.doesNotMatch(c, /\bjars?\b/i);
  assert.doesNotMatch(c, /\b(Alfred|Atlas|Ledger|Prism|Vita|Harbor|Wright)\b/);
});
await t("no <video>, nest-webrtc or house-nest in wall.html / sheet-index.html", () => {
  for (const h of [wall, hub]) {
    assert.doesNotMatch(h, /<video/i);
    assert.doesNotMatch(h, /nest-webrtc|house-nest\.js|mountHubCamDeck|nest-snaps\//);
  }
});
await t("hub keeps a 1-tap path to wall.html and the key entry button", () => {
  assert.match(hub, /<a class="hub-wall-link" href="wall\.html"/);
  assert.match(hub, /id="hub-key-btn" data-hub-key-entry/);
});
await t("laundry controls expose no Pause (LG has no pause op)", () => {
  const c = S.laundryControls({ status: "live" }, {});
  assert.equal("pause" in c, false);
  assert.doesNotMatch(read("sheet-google-home.html"), /data-laundry-op="pause"/);
});
await t("v2 finish: no motion, hall flash config ships empty, pip parked", () => {
  const css = read("tokens-wall-v2.css");
  assert.match(css, /animation: none !important; transition: none !important/);
  assert.doesNotMatch(css, /@keyframes/);
  assert.deepEqual(JSON.parse(read("config/wall-kid.config.json")).hallFlashLightIds, []);
  assert.match(wall, /id="w-pip"[^>]*data-state="off" hidden/);
});
console.log(`wall-guards: ${n} tests PASS`);
