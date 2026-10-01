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
await t("ALFREDP0-5: hub has no Show me the Money / Jars tile; kid surfaces show no Balance", () => {
  assert.doesNotMatch(hub.replace(/<!--[\s\S]*?-->/g, ""), /Show me the Money|Kids jars on board|class="tile stars"/);
  const kd = read("kids-data.js").replace(/var EMBEDDED = .*\n/, "");
  assert.doesNotMatch(kd, /"Balance \$"|Balance \$" \+/);
  assert.doesNotMatch(read("sheet-allowance.html"), /"Balance \$"\+/);
});
await t("$ allowlist: the ONLY rate tag allowed is Ainsley's babysit $15/hr (Dan, 6:27 PM CT)", () => {
  const files = ["kids-data.js", "sheet-chores.html", "sheet-allowance.html", "kid-ainsley.html", "kid-hayes.html", "kid-harris.html", "sheet-index.html", "wall.html"];
  let hits = 0;
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      if (/var EMBEDDED = /.test(line)) return; // calendar/data snapshot, not render code
      const rates = line.match(/\$\d+(?:\.\d+)?\s*\/\s*hr/g) || [];
      rates.forEach((r) => {
        assert.equal(r, "$15/hr", `${f}:${i + 1} unexpected rate ${r}`);
        assert.match(line, /hire|babysit|addon-tag|earnOpt|ain-babysit/i, `${f}:${i + 1} $15/hr outside the babysit tag`);
        hits++;
      });
    });
  }
  assert.ok(hits >= 3, "the babysit tag is kept (not stripped)");
  assert.doesNotMatch(copy(wall), /\$/, "wall face itself shows no $ at all");
});
await t("timer + grocery never touch the Kasa lights or the flash", () => {
  const code = wall.replace(/<!--[\s\S]*?-->/g, "");
  const tb = code.slice(code.indexOf("FIVE UPGRADES #2"), code.indexOf("FIVE UPGRADES #3"));
  assert.ok(tb.length > 200); assert.doesNotMatch(tb, /setLight|flash\.flash|HouseLights/);
  const gb = code.slice(code.indexOf("FIVE UPGRADES #4"), code.indexOf('document.addEventListener("click", function (e) {\n    var t = e.target.closest ? e.target.closest("[data-sp]'));
  assert.ok(gb.length > 200); assert.doesNotMatch(gb, /setLight|flash\.flash|href=|location\./);
});
await t("grocery tile hosts Ledger's house-grocery-list.js as-is; tile hidden by default; no link out", () => {
  assert.match(wall, /<script src="house-grocery-list\.js"><\/script>/);
  assert.match(wall, /id="w-groc"[^>]*hidden/);
  const tile = wall.slice(wall.indexOf('id="w-groc"'), wall.indexOf("<!-- Ask pip"));
  assert.doesNotMatch(tile, /<a |href=/);
});
await t("doors lamp + doorbell line: hidden, no reader, never a feed or still", () => {
  assert.match(wall, /id="w-doors"[^>]*hidden><\/div>/); assert.match(wall, /id="w-bell"[^>]*hidden><\/div>/);
  assert.doesNotMatch(wall.replace(/<!--[\s\S]*?-->/g, ""), /doors?-live\.json|doorbell[^"\n]*\.json|ring-live/);
});
await t("no hardcoded Mom in wall code or copy (data labels render as given)", () => {
  const mine = ["wall.html", "house-wall-kid.js", "house-wall-panel.js", "house-wall-lists.js", "house-wall-actions.js", "tokens-wall-v2.css", "config/wall-kid.config.json"];
  for (const f of mine) assert.doesNotMatch(read(f), /\bmom\b/i, f);
  // house-wall-status.js keeps "mom" only inside PEOPLE_RE, the open-loops BLOCK filter (it hides such loops; it never prints the word)
  read("house-wall-status.js").split("\n").forEach((l, i) => { if (/\bmom\b/i.test(l)) assert.match(l, /PEOPLE_RE = /, `house-wall-status.js:${i + 1}`); });
});
console.log(`wall-guards: ${n} tests PASS`);
