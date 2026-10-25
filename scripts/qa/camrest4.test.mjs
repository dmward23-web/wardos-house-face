/* CAMREST4 · Alfred FAIL on CAMREST3 239004c8: the Harris kid light pad was inside the hidden legacy panel (no visible
   Not connected, taps landed on the world canvas), the lights pairing pill weighed 500 not the rest pill's 400, and the
   resting cam tile counted the grove's blur bleed as clipped overflow. Real browser (scripts/qa/camrest4_viewport.py). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const browser = spawnSync("python3", ["-c", "import playwright.sync_api"], { encoding: "utf8" }).status === 0 && process.env.QA_NO_BROWSER !== "1";
const SKIP = browser ? {} : { skip: "SKIP no playwright (QA_NO_BROWSER)" };
const J = (o) => JSON.stringify(o).slice(0, 1200);

function run(mode, w = 440, h = 956) {
  return new Promise((resolve, reject) => {
    const p = spawn("python3", [path.join(ROOT, "scripts/qa/camrest4_viewport.py"), mode, String(w), String(h)]);
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGTERM"), 180000);
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(t);
      if (code !== 0) return reject(new Error(mode + " exit " + code + " " + err.slice(-600)));
      try { resolve(JSON.parse(out.trim().split("\n").pop())); } catch (e) { reject(new Error(mode + " bad json " + out.slice(-300))); }
    });
  });
}
let runs = null;
function all() {
  if (!runs) {
    const list = [["kid401"], ["kid401", 1280, 800], ["kid0"], ["kid0", 1280, 800], ["kidC"], ["kidC", 1280, 800], ["rest"], ["rest", 1280, 800], ["rest", 1920, 1080]];
    for (const k of ["hayes", "harris", "ainsley"]) list.push(["ctl-" + k], ["ctl-" + k, 1280, 800]);
    runs = (async () => { const o = {}; for (const a of list) o[a.join("@")] = await run(...a); return o; })();
  }
  return runs;
}

test("CAMREST4 · kid pad with a revoked key or no key shows Not connected, visibly, on the world (phone and desk)", SKIP, async () => {
  const r = await all();
  for (const k of ["kid401", "kid401@1280@800", "kid0", "kid0@1280@800"]) {
    const s = r[k].t0;
    assert.deepEqual(r[k].errors, [], k);
    assert.equal(s.kwOn, true, k + " world on " + J(s));
    assert.equal(s.padVisible, true, k + " pad visible " + J(s));
    assert.equal(s.pillText, "Not connected", k + " " + J(s));
    assert.equal(s.pillVisible, true, k + " pill visible, not display none " + J(s));
    assert.equal(s.rockerEnabled, false, k + " no taps without a key " + J(s));
  }
});

test("CAMREST4 · kid pad in State C (paired by code): the tap lands on the rocker and writes /api/lights/set", SKIP, async () => {
  const r = await all();
  for (const k of ["kidC", "kidC@1280@800"]) {
    const s = r[k];
    assert.deepEqual(s.errors, [], k);
    assert.equal(s.t0.pillText, "LIVE", k + " " + J(s));
    assert.equal(s.t0.pillVisible, true, k + " " + J(s));
    assert.equal(s.t0.rockerEnabled, true, k + " " + J(s));
    assert.equal(s.t0.rockerHit, true, k + " the rocker is on top, not the world canvas " + J(s));
    assert.equal(s.writes, 1, k + " one write " + J(s));
  }
});

test("CAMREST4 · resting cam tiles: no clipped element at phone, desk and wall widths", SKIP, async () => {
  const r = await all();
  for (const k of ["rest", "rest@1280@800", "rest@1920@1080"]) {
    const s = r[k].t0;
    assert.deepEqual(r[k].errors, [], k);
    assert.equal(s.restTiles, 3, k + " three resting tiles " + J(s));
    assert.deepEqual(s.clipped, [], k + " " + J(s));
    assert.ok(s.restOverflow.every((o) => o === "clip"), k + " " + J(s));
    assert.ok(s.restFit.every(Boolean), k + " each rest tile fits its tile box, never wider " + J(s));
  }
});

test("CAMREST4 · every kid board, phone and desk: each world control is on top at its centre (the canvas never eats a tap)", SKIP, async () => {
  const r = await all();
  for (const kid of ["hayes", "harris", "ainsley"]) for (const k of ["ctl-" + kid, "ctl-" + kid + "@1280@800"]) {
    const s = r[k].t0;
    assert.deepEqual(r[k].errors, [], k);
    assert.equal(s.kwOn, true, k + " " + J(s));
    assert.ok(s.controls.length >= 3, k + " controls found " + J(s.controls));
    assert.deepEqual(s.controls.filter((c) => !c.ok), [], k + " blocked controls");
  }
  for (const k of ["kidC", "kidC@1280@800"]) {
    assert.ok(r[k].t0.controls.some((c) => /cmd-rocker/.test(c.c) && c.ok), k + " the live Harris light rocker is one of them " + J(r[k].t0.controls));
    assert.deepEqual(r[k].t0.controls.filter((c) => !c.ok), [], k + " blocked controls");
  }
});

test("CAMREST4 · source: the kid pad is lifted (host node moved, no second write path); pair pill box 400, word 500; tokens", () => {
  const H = read("kid-harris.html"), L = read("house-lights.js"), C = read("tokens-hub-cams.css");
  const a = L.indexOf("function kidLightLift("), b = L.indexOf("global.HouseLights", a);
  assert.ok(a > 0 && b > a);
  assert.match(L.slice(a, b), /wrap\.appendChild\(host\)/, "the host node itself moves");
  assert.doesNotMatch(L.slice(a, b), /lights\/set|fetch\(|onclick/, "no parallel write path");
  assert.match(L, /\.kid-light-host \.light-pad-state\.cmd-pill--need \{ display:inline-flex !important/);
  assert.match(H, /HouseLights\.mountKidLight\("#kid-harris-light", "harris-room"\)/);
  assert.match(L, /\.hub-lights-pairword\{[^}]*font-weight:400!important/);
  assert.match(L, /\.hub-lights-pairword \.hub-lights-pairword-word\{[^}]*font-weight:500/);
  assert.match(L, /<span class="hub-lights-pairword-word">Needs pairing<\/span>/);
  assert.match(C, /\.hub-cam-rest \{[^}]*overflow: hidden;[^}]*overflow: clip;/);
  for (const f of ["sheet-index.html", "sheet-google-home.html"]) assert.match(read(f), /tokens-hub-cams\.css\?v=CAMREST4"/, f);
  for (const f of ["sheet-index.html", "sheet-google-home.html", "sheet-lights.html", "kid-harris.html"]) assert.match(read(f), /house-lights\.js\?v=CAMREST4"/, f);
});
