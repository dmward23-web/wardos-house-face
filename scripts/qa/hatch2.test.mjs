/* HATCH2 · preview-only wire of Prism's Hearthlings hatch v2 stills (node --test scripts/qa/hatch2.test.mjs).
   Proves: (1) only preview-hatch2.html loads hatch2-preview.js and no other tracked page names either file, so every default
   view is unchanged; (2) the art names are kidboards/hatch-<kid>-v2.(webp|png), which the proxy's private-art shape rule serves
   (path + sha256 list, never git); (3) <picture> puts the webp <source> first and the png <img> last; (4) nothing is asked for
   when caps does not key the file, or the kid param is missing or unknown; (5) the sheet jpg is not wired; (6) kid copy rules:
   no '$', no em dash, no arrows, no stars or counts. Pure node, no browser, no network, nothing written to disk. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const k of Object.keys(process.env)) if (k.startsWith("WARDOS_")) delete process.env[k];
const PAGE = fs.readFileSync(path.join(ROOT, "preview-hatch2.html"), "utf8");
const JS = fs.readFileSync(path.join(ROOT, "hatch2-preview.js"), "utf8");
const KIDS = ["hayes", "harris", "ainsley"];
const { HALLOWEEN_ART_RE } = await import(path.join(ROOT, "scripts/nest-webrtc-proxy.mjs"));

function el(tag) {
  return { tag, children: [], attrs: {}, textContent: "", type: "", srcset: "", src: "", alt: "", decoding: "",
    appendChild(c) { this.children.push(c); return c; }, setAttribute(k, v) { this.attrs[k] = String(v); } };
}
function run(search, have, viaEvent) {
  const stage = el("main"), body = el("body"), asked = [], listeners = {};
  const art = { base: "night/media/art/halloween/", have };
  const ctx = {
    location: { search }, URLSearchParams,
    document: { body, getElementById: (id) => (id === "h2-stage" ? stage : null), createElement: (t) => el(t) },
    addEventListener: (n, f) => { listeners[n] = f; },
    window: {},
  };
  if (!viaEvent) ctx.window.WGArt = art;
  vm.runInNewContext(JS, ctx);
  if (viaEvent && listeners["wg:caps"]) { ctx.window.WGArt = art; listeners["wg:caps"](); }
  const walk = (n) => { for (const c of n.children) { if (c.src) asked.push(c.src); if (c.srcset) asked.push(c.srcset); walk(c); } };
  walk(stage);
  return { stage, body, asked };
}
const all = (k) => ({ ["kidboards/hatch-" + k + "-v2.webp"]: 1, ["kidboards/hatch-" + k + "-v2.png"]: 1 });

test("only the preview page loads the preview script; no tracked page names either file", () => {
  assert.match(PAGE, /<script src="hatch2-preview\.js\?v=HATCH2" defer><\/script>/);
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT }).toString().split("\0").filter((f) => /\.(html|js|mjs|css|json|webmanifest)$/.test(f));
  const hits = tracked.filter((f) => !["preview-hatch2.html", "hatch2-preview.js", "scripts/qa/hatch2.test.mjs"].includes(f))
    .filter((f) => { try { return /preview-hatch2|hatch2-preview/.test(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch { return false; } });
  assert.deepEqual(hits, [], "a live file references the hatch2 preview");
});

test("art names fit the proxy private-art shape rule (no git art)", () => {
  for (const k of KIDS) for (const x of ["webp", "png"]) assert.ok(HALLOWEEN_ART_RE.test("kidboards/hatch-" + k + "-v2." + x), k + " " + x);
  const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT }).toString();
  assert.doesNotMatch(tracked, /hatch-(hayes|harris|ainsley)-v2|hatch-v2-sheet/, "hatch art bytes must stay out of git");
});

for (const via of [false, true]) test("picture is webp source first, png img fallback, per kid" + (via ? " (wg:caps event)" : ""), () => {
  for (const k of KIDS) {
    const r = run("?kid=" + k, all(k), via);
    assert.equal(r.stage.children.length, 1);
    const pic = r.stage.children[0];
    assert.equal(pic.tag, "picture");
    assert.deepEqual(pic.children.map((c) => c.tag), ["source", "img"]);
    assert.equal(pic.children[0].type, "image/webp");
    assert.equal(pic.children[0].srcset, "night/media/art/halloween/kidboards/hatch-" + k + "-v2.webp");
    assert.equal(pic.children[1].src, "night/media/art/halloween/kidboards/hatch-" + k + "-v2.png");
    assert.equal(r.body.attrs["data-hatch2-on"], k);
  }
});

test("nothing is asked for without the listed art, or without a known kid", () => {
  for (const k of KIDS) assert.deepEqual(run("?kid=" + k, {}).asked, []);
  assert.deepEqual(run("", all("hayes")).asked, []);
  assert.deepEqual(run("?kid=dad", all("hayes")).asked, []);
  assert.deepEqual(run("?kid=harris", all("hayes")).asked, [], "another kid's art never shows");
});

test("sheet jpg is reference only and is not wired", () => {
  assert.doesNotMatch(PAGE + JS, /hatch-v2-sheet|\.jpg/);
});

test("kid copy: no $, no em dash, no arrows, no stars or counts", () => {
  for (const [n, s] of [["page", PAGE.replace(/<!--|-->/g, "")], ["js", JS]]) {   /* the html comment delimiters are markup, not copy */
    assert.doesNotMatch(s, /\$/, n + " has a dollar sign");
    assert.doesNotMatch(s, /\u2014/, n + " has an em dash");
    assert.doesNotMatch(s, /[\u2190-\u21FF\u27F0-\u27FF\u2900-\u297F]|->|=>/, n + " has an arrow");
    assert.doesNotMatch(s, /[\u2605\u2606\u2B50]/, n + " has a star");
  }
  const r = run("?kid=ainsley", all("ainsley"));
  assert.equal(JSON.stringify(r.stage).match(/textContent":"[^"]+/g), null, "no words or counts on the stage");
});
