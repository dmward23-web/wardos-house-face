/* KIDWORLD1 · drawn world off the kid boards: Prism's costume plate first (costumes visible), no drawn fog/motes/shafts over a plate. */
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const R = (f) => fs.readFileSync(new URL("../../" + f, import.meta.url), "utf8");
for (const k of ["hayes", "harris", "ainsley"]) test(`${k}: costume plate first on wall and phone, plain plate fallback`, () => {
  const s = R(`kid-${k}.html`);
  assert.match(s, new RegExp(`data-asset="kidboards/${k}-wall-costume\\.webp\\|kidboards/${k}-wall\\.png"`));
  assert.match(s, new RegExp(`data-asset-ph="kidboards/${k}-phone-costume\\.webp\\|kidboards/${k}-phone-v2\\.png\\|kidboards/${k}-phone\\.png"`)); assert.doesNotMatch(s, /-nov\./, k);
});
test("costume plate names pass the proxy art allowlist", () => {
  const re = new RegExp(R("scripts/nest-webrtc-proxy.mjs").match(/HALLOWEEN_ART_RE = \/(.+)\/;/)[1]);
  for (const k of ["hayes", "harris", "ainsley"]) for (const v of ["wall", "phone"]) assert.ok(re.test(`kidboards/${k}-${v}-costume.webp`), k + v);
  /* LIVEWX2 · shape alone is not enough: each costume plate is on the exact path+sha allowlist the proxy serves from */
  /* the list is private (never git); checked when this box has it, by the account's own home (th.sh swaps HOME) */
  let files = null; try { files = JSON.parse(fs.readFileSync(path.join(os.userInfo().homedir, ".local/share/wardos-private/night-media/art-halloween-allow.json"), "utf8")).files; } catch { /* off this box */ }
  if (files) for (const k of ["hayes", "harris", "ainsley"]) for (const v of ["wall", "phone"]) {
    const e = files[`kidboards/${k}-${v}-costume.webp`]; assert.ok(e && /^[0-9a-f]{64}$/.test(e.sha256 || e.sha || e), k + v + " listed with a sha");
  }
});
test("wg-assets marks data-costume-baked only for a *-costume plate", () => {
  const s = R("wg-assets.js"); assert.match(s, /if \(\/-costume\\\.\/\.test\(name\)\) el\.setAttribute\("data-costume-baked", ""\); else el\.removeAttribute\("data-costume-baked"\)/);
});
test("hayes-loot draws no fog, motes, shafts, storm rim, glider, fronds or chest shadows over a plate; beams/pops/victory stay", () => {
  const s = R("hayes-loot.js"), f = s.slice(s.indexOf("function frame()"), s.indexOf("function breathe("));
  assert.match(f, /var plate = document\.body\.hasAttribute\("data-asset-on"\)/);
  for (const c of ["back(t)", "stormEdge(t)", "glider(t)", "middle(t)", "nearLayer(t)", "grounding(info, r, sx)"]) {
    const line = f.split("\n").find((l) => l.includes(c)); assert.ok(line && /!plate/.test(line), c + " not gated: " + line);
  }
  assert.match(f, /beam\(/); assert.match(f, /victory\(tm\)/); assert.match(f, /lootCard\(p, tm\)/);
});
/* KIDWORLD2 · season end: costume plates drop after the Halloween window (the october scene packs, real CT date), plain plate returns */
import vm from "node:vm"; import { createRequire } from "node:module";
const Packs = createRequire(import.meta.url)("../../livinghouse/scene-packs.js");
async function pickAt(iso, wide, nov) {
  const attrs = { "data-asset": "kidboards/hayes-wall-costume.webp|kidboards/hayes-wall.png", "data-asset-ph": "kidboards/hayes-phone-costume.webp|kidboards/hayes-phone-v2.png|kidboards/hayes-phone.png", "data-asset-var": "--wg-kidbg" };
  const el = { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; }, style: { setProperty() {}, removeProperty() {} } };
  const art = ["kidboards/hayes-wall-costume.webp", "kidboards/hayes-wall.png", "kidboards/hayes-phone-costume.webp", "kidboards/hayes-phone-v2.png"].concat(nov ? ["kidboards/hayes-wall-nov.webp", "kidboards/hayes-phone-nov.webp"] : []);
  const win = { innerWidth: wide ? 1920 : 440, innerHeight: wide ? 1080 : 956, LHScenePacks: Packs, LHClock: { now: () => new Date(iso) },
    document: { currentScript: { src: "http://x/wg-assets.js" }, querySelectorAll: () => [el], documentElement: { classList: { add() {} } } },
    fetch: async () => ({ ok: true, json: async () => ({ art, video: false }) }), setTimeout, clearTimeout, setInterval: () => 0, addEventListener() {}, dispatchEvent() {}, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    Image: class { set src(v) { this._s = v; queueMicrotask(() => this.onload && this.onload()); } } };
  win.window = win; vm.createContext(win); vm.runInContext(R("wg-assets.js"), win);
  for (let i = 0; i < 20 && !attrs["data-asset-on"]; i++) await new Promise((r) => setTimeout(r, 5));
  return { on: attrs["data-asset-on"], baked: "data-costume-baked" in attrs };
}
test("season window: costume plate Oct 1 00:00 to Oct 31 23:59 CT, plain plate from Nov 1 00:00 CT (wall and phone)", async () => {
  for (const [iso, cos] of [["2026-09-30T23:59:00-05:00", false], ["2026-10-01T00:00:00-05:00", true], ["2026-10-23T21:15:00-05:00", true], ["2026-10-31T23:59:00-05:00", true], ["2026-11-01T00:00:00-05:00", false], ["2026-11-01T04:30:00Z", true], ["2026-11-01T05:30:00Z", false], ["2026-11-15T12:00:00-06:00", false]]) {
    const w = await pickAt(iso, true), p = await pickAt(iso, false);
    assert.equal(w.on, cos ? "kidboards/hayes-wall-costume.webp" : "kidboards/hayes-wall.png", "wall " + iso); assert.equal(w.baked, cos, "baked " + iso);
    assert.equal(p.on, cos ? "kidboards/hayes-phone-costume.webp" : "kidboards/hayes-phone-v2.png", "phone " + iso);
  }
});
test("kid pages load the shared clock and season gate before wg-assets; no gate = plain plate", () => {
  for (const k of ["hayes", "harris", "ainsley"]) { const s = R(`kid-${k}.html`), a = s.indexOf("livinghouse/scene-packs.js"), c = s.indexOf("livinghouse/clock.js"), w = s.indexOf('src="wg-assets.js?v=LIVEWX2B"'); assert.ok(c > 0 && a > c && w > a, k); }
  assert.match(R("wg-assets.js"), /if \(!P \|\| !P\.forDate\) return false/);
});
/* LIVEWX2 · November plates are the ambient line's (NOVPACK1, livinghouse/ambient): wg-assets never picks a -nov plate even when the art is
   served, so there is one wiring; the proxy still serves -nov names for that line */
test("nov plates: not wired here (ambient line owns them); proxy still serves the names", async () => {
  for (const iso of ["2026-10-31T23:59:00-05:00", "2026-11-01T00:00:00-05:00", "2026-11-20T09:00:00-06:00"]) {
    const w = await pickAt(iso, true, true), p = await pickAt(iso, false, true);
    assert.doesNotMatch(w.on || "", /-nov\./, "wall " + iso); assert.doesNotMatch(p.on || "", /-nov\./, "phone " + iso);
  }
  assert.doesNotMatch(R("wg-assets.js"), /-nov/);
  const re = new RegExp(R("scripts/nest-webrtc-proxy.mjs").match(/HALLOWEEN_ART_RE = \/(.+)\/;/)[1]);
  for (const k of ["hayes", "harris", "ainsley"]) for (const v of ["wall", "phone"]) for (const x of ["webp", "png"]) assert.ok(re.test(`kidboards/${k}-${v}-nov.${x}`), k + v + x);
});
