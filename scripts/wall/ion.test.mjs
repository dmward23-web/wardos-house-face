// ION1: wall.html wears Prism's FINAL Ion kit (plates/2026-10-01/redesign/ion-handoff). Static guards; the browser half is scripts/wall/check-ion.py.
import assert from "node:assert/strict";
import fs from "node:fs";
const root = new URL("../../", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), "utf8");
const exists = (f) => fs.existsSync(new URL(f, root));
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok - " + name); };
const wall = read("wall.html");
const KIT = ["tokens-wall-kiosk27-v2.css", "tokens-v3-2100-A.css", "finish-v3-2100.css", "ion-master.css"];
const css = Object.fromEntries(fs.readdirSync(new URL("wall-ion/", root)).filter((f) => f.endsWith(".css")).map((f) => [f, read("wall-ion/" + f)]));
const links = [...wall.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);

await t("kit CSS loads in Prism's order (tokens-wall-kiosk27-v2, tokens-v3-2100-A, finish-v3-2100, ion-master), all local under wall-ion/", () => {
  const kitIdx = KIT.map((f) => links.indexOf("wall-ion/" + f));
  assert.ok(kitIdx.every((i) => i >= 0), "all four kit files linked: " + links.join(", "));
  assert.deepEqual([...kitIdx].sort((a, b) => a - b), kitIdx, "kit order");
  assert.equal(links.at(-1), "wall-ion/ion-wright.css", "Wright's bridge loads last");
  assert.ok(links.indexOf("wall-ion/wall-v3-layout.css") === kitIdx[0] + 1, "master's inline layout block sits where the master has it (right after the kiosk tokens)");
  assert.ok(links.every((h) => !/^https?:|^\/\//.test(h)), "no remote CSS");
  assert.doesNotMatch(wall, /fonts\.googleapis|fonts\.gstatic|@import/);
  assert.match(wall, /<body class="wall-kiosk" data-plate="v3" data-master="ion">/);
});
await t("kit files are Prism's bytes except the asset paths (assets/ -> ../fonts, ../camo-tile.png)", () => {
  const kitDir = new URL("../plates/2026-10-01/redesign/ion-handoff/", "file:///workspace/x/");
  for (const f of KIT) {
    assert.ok(css[f], f);
    const src = new URL(f, kitDir);
    if (!fs.existsSync(src)) continue; /* plates are outside the repo; on the box they are checked byte-for-byte */
    const fix = fs.readFileSync(src, "utf8").replace(/url\("assets\/fonts\//g, 'url("../fonts/').replace(/url\("assets\/InterVariable\.ttf"\)/g, 'url("../fonts/InterVariable.ttf")').replace(/url\("assets\/camo-tile\.png"\)/g, 'url("../camo-tile.png")');
    assert.equal(css[f], fix, f + " drifted from the kit");
  }
});
await t("fonts + ground ship in the repo and load locally only; every font has its OFL license", () => {
  const urls = Object.values(css).flatMap((s) => [...s.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]));
  assert.ok(urls.length >= 7);
  for (const u of urls) { assert.ok(!/^https?:|^\/\//.test(u), u); assert.ok(exists(new URL(u, new URL("wall-ion/", root)).pathname.replace(new URL(root).pathname, "")), "missing " + u); }
  for (const f of ["Oxanium-VF.ttf", "Michroma-Regular.ttf", "SpaceGrotesk-VF.ttf", "JetBrainsMono-VF.ttf", "InterVariable.ttf"]) assert.ok(exists("fonts/" + f), f);
  for (const f of ["Oxanium-OFL.txt", "Michroma-OFL.txt", "SpaceGrotesk-OFL.txt", "JetBrainsMono-OFL.txt", "Inter-OFL.txt"]) assert.match(read("fonts/" + f), /SIL OPEN FONT LICENSE/i, f);
  assert.ok(exists("camo-tile.png") && exists("wardos-mark-header.png"));
  assert.match(wall, /<img class="mark" src="wardos-mark-header\.png"/);
});
await t("MOTION: exactly the four kit loops (drift 28s, scan 11s, sweep 6s, breathe 3.6s), transform/opacity only, all OFF under prefers-reduced-motion", () => {
  const all = Object.values(css).join("\n");
  const kf = [...all.matchAll(/@keyframes ([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
  assert.deepEqual(kf.map((m) => m[1]).sort(), ["x21-breathe", "x21-drift", "x21-scan", "x21-sweep"]);
  for (const m of kf) for (const d of m[2].matchAll(/\{([^{}]*)\}/g)) for (const p of d[1].split(";").map((x) => x.split(":")[0].trim()).filter(Boolean)) assert.ok(["transform", "opacity"].includes(p), m[1] + " animates " + p);
  const uses = [...all.matchAll(/animation:\s*([^;}]+)/g)].map((m) => m[1].trim()).filter((v) => !/^none/.test(v));
  assert.deepEqual(uses.map((u) => u.split(/\s+/).slice(0, 2).join(" ")).sort(), ["x21-breathe 3.6s", "x21-drift 28s", "x21-scan 11s", "x21-sweep 6s"]);
  assert.match(css["finish-v3-2100.css"], /\.panel::before[^}]*x21-drift/); assert.match(css["finish-v3-2100.css"], /\.panel::after[^}]*x21-scan/);
  assert.match(css["finish-v3-2100.css"], /\.clock::after[^}]*x21-sweep/); assert.match(css["finish-v3-2100.css"], /\.led\.bad::after[^}]*x21-breathe/);
  const rm = css["finish-v3-2100.css"].slice(css["finish-v3-2100.css"].indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rm, /html body\.wall-kiosk\[data-plate\] \*, html body\.wall-kiosk\[data-plate\] \*::before, html body\.wall-kiosk\[data-plate\] \*::after \{ animation: none !important; transition: none !important; \}/);
  for (const f of ["ion-master.css", "ion-wright.css", "wall-v3-layout.css"]) assert.doesNotMatch(css[f], /@keyframes|animation\s*:|transition\s*:/, f + " adds no motion");
  assert.doesNotMatch(wall.replace(/<!--[\s\S]*?-->/g, ""), /requestAnimationFrame|\.animate\(|@keyframes/, "no JS motion on the wall");
});
await t("wall-scoped: Ion CSS only on wall.html; kid pages and the hub don't link it; the bridge only styles body.wall-kiosk[data-master=ion]", () => {
  for (const f of fs.readdirSync(new URL(".", root)).filter((f) => f.endsWith(".html") && f !== "wall.html")) assert.doesNotMatch(read(f), /wall-ion\//, f);
  for (const line of css["ion-wright.css"].split("\n").filter((l) => /\{/.test(l) && !/^\s*\/\*/.test(l))) assert.match(line, /^html body\.wall-kiosk(\.is-stacked)?\[data-plate\]\[data-master="ion"\](:not\(\.is-stacked\))? /, line.slice(0, 90));
  const hex = [...css["ion-wright.css"].matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase()).filter((h) => h !== "#07111d"); /* #07111d = the kit's ink-on-accent */
  assert.deepEqual(hex, [], "bridge uses Ion token colors only");
  assert.doesNotMatch(css["ion-wright.css"], /rgba?\(\s*\d/, "no raw rgb in the bridge: rgba(var(--*-rgb)) only");
});
await t("State-preview callouts are drawings: none ship (no data-state-preview / .spv / sp-tag / photo slot on the wall)", () => {
  assert.doesNotMatch(wall, /data-state-preview|class="spv|sp-tag|State preview|pframe|data-disputed/i);
  assert.doesNotMatch(wall, /Wipe the island|Trash to the can|Fold one basket|Reset the couch|Dragon care|Tree trim bids|After school<\/span>/, "no master sample copy");
});
await t("every tile keeps data-tile-id + data-owner; Week -> sheet-index, Dad Seat -> sheet-dan (not the master's both-on-sheet-dan)", () => {
  const ids = [...wall.matchAll(/<[^>]*data-tile-id="([^"]+)"[^>]*>/g)];
  assert.ok(ids.length >= 50);
  for (const m of ids) assert.match(m[0], /data-owner="(Atlas|Wright|Ledger|Prism|Vita)"/, m[1]);
  assert.match(wall, /data-tile-id="rail-week"[^>]*href="sheet-index\.html#hub-home"/);
  assert.match(wall, /data-tile-id="rail-dad-seat"[^>]*href="sheet-dan\.html#ds-next"/);
});
await t("Harris: same-minute fill (no transition) + the existing soft HouseSfx.tap only; no new audio", () => {
  assert.match(wall, /data-feedback="tap-sound-fill"/);
  assert.match(css["ion-wright.css"], /\.law-fill i \{ display: block; height: 100%; background: var\(--ok\); \}/);
  assert.doesNotMatch(wall, /new Audio|AudioContext|\.mp3|\.wav|\.ogg/);
});
console.log(`ion: ${n} tests PASS`);
