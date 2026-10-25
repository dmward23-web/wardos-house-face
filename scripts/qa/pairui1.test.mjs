/* PAIRUI1 · the unpaired hub face shows ONE pairing prompt (the banner chip), no empty "Needs pairing" card,
   a pairing word on the cams, and a lights strip that reads as needing pairing (never Ready, no ALL OFF).
   Real browser (scripts/qa/pairui1_viewport.py) on a loopback copy of the repo; other hosts are aborted. */
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
    const p = spawn("python3", [path.join(ROOT, "scripts/qa/pairui1_viewport.py"), mode, String(w), String(h)]);
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
/* one browser at a time */
let runs = null;
function all() {
  if (!runs) {
    const list = [["unpaired"], ["unpaired", 1280, 800], ["unpaired", 1920, 1080], ["paired"], ["paired", 1280, 800], ["paired", 1920, 1080], ["offline"], ["kid"]];
    runs = (async () => { const o = {}; for (const a of list) o[a.join("@")] = await run(...a); return o; })();
  }
  return runs;
}

test("PAIRUI1 · unpaired: exactly one pairing prompt, no empty Needs pairing card (phone and desk)", SKIP, async () => {
  const r = await all();
  for (const k of ["unpaired", "unpaired@1280@800", "unpaired@1920@1080"]) {
    assert.deepEqual(r[k].errors, [], k);
    for (const t of ["t0", "t1"]) {
      const s = r[k][t];
      assert.equal(s.pairState, "hub-no-key", k + " " + J(s));
      assert.equal(s.leavebyVisible, 0, k + " " + t + " no strip card under the clock " + J(s));
      const prompts = s.needs.filter((c) => !/^hub-cam-rest-word$|^hub-lights-pairword(-word)?$/.test(c));
      assert.equal(prompts.length, 1, k + " " + t + " one prompt " + J(s));
    }
  }
});

test("PAIRUI1 · unpaired cams say Needs pairing; the lights strip says Needs pairing with no switches or ALL OFF", SKIP, async () => {
  const s = (await all())["unpaired"].t1;
  assert.deepEqual(s.camWords, ["Needs pairing", "Needs pairing", "Needs pairing"], J(s));
  assert.equal(s.resting, 0, J(s));
  assert.equal(s.pairWord, 1, J(s));
  assert.equal(s.bulkVisible, 0, "no ALL OFF " + J(s));
  assert.equal(s.switches, 0, J(s));
});

test("PAIRUI1 · lights never say Ready: unpaired, paired, forced offline, kid board", SKIP, async () => {
  const r = await all();
  for (const k of Object.keys(r)) for (const t of ["t0", "t1"]) assert.deepEqual(r[k][t].ready, [], k + " " + t);
});

test("PAIRUI1 · paired state unchanged: strip card shows, cams keep Camera resting on an outage, no pairing words", SKIP, async () => {
  const r = await all();
  for (const k of ["paired", "paired@1280@800", "paired@1920@1080", "offline"]) {
    const s = r[k].t1;
    assert.deepEqual(r[k].errors, [], k);
    assert.equal(s.needs.length, 0, k + " " + J(s));
    assert.equal(s.leavebyVisible, 1, k + " " + J(s));
    assert.deepEqual(s.camWords, ["Camera resting", "Camera resting", "Camera resting"], k + " " + J(s));
    assert.equal(s.pairWord, 0, k);
    assert.equal(s.bulkVisible, 1, k);
  }
  assert.equal(r.paired.t1.pairState, "paired");
});

test("PAIRUI1 · source: readyWord has no Ready, the cam word keeps Camera resting for outages, pages carry ?v=PAIRUI1", () => {
  const L = read("house-lights.js");
  const fn = (L.match(/function readyWord\(up\)\s*\{[^\n]*\}/) || [""])[0];
  assert.ok(fn, "readyWord present");
  assert.doesNotMatch(fn.replace(/readyWord/g, ""), /ready/i, "no Ready word: " + fn);
  const N = read("house-nest.js");
  assert.match(N, /restWord = why === "pair" \? "Needs pairing" : "Camera resting"/);
  assert.match(read("sheet-index.html"), /house-board-strip\.js\?v=PAIRUI1/);
  assert.match(read("sheet-index.html"), /house-lights\.js\?v=CAMREST5"/); /* CAMREST4 · re-tokened; CAMREST5 · again */
  assert.match(read("sheet-index.html"), /house-nest\.js\?v=CAMREST3"/); /* CAMREST3 · house-nest.js changed again */
  assert.match(read("kid-harris.html"), /house-lights\.js\?v=CAMREST5"/); /* CAMREST4 · re-tokened; CAMREST5 · again */
});

test("PAIRUI1b · the lights pair pill is the camera rest pill: same glow, fill, border and word", SKIP, async () => {
  const r = await all();
  for (const k of ["unpaired", "unpaired@1280@800", "unpaired@1920@1080"]) {
    const { lights, cam } = r[k].t1.pill;
    assert.ok(lights && cam, k + " both pills visible " + J(r[k].t1.pill));
    assert.match(lights.shadow, /rgba\(232, 163, 61, 0\.45\) 0px 0px 14px/, k + " glow");
    assert.equal(lights.boxWeight, "400", k + " CAMREST4 · pill box weight 400, as the cam rest pill"); assert.equal(lights.bg, "rgba(28, 18, 8, 0.82)", k + " dark fill");
    assert.deepEqual(lights, cam, k + " lights pill matches cam pill");
  }
});

test("PAIRUI1b · desk: the unpaired lights panel is one compact row sized to the pill; paired desk panel unchanged", SKIP, async () => {
  const r = await all();
  for (const k of ["unpaired@1280@800", "unpaired@1920@1080"]) {
    const p = r[k].t1.panel;
    assert.ok(p && p.pillH > 0, k + " " + J(p));
    assert.ok(p.h <= p.pillH * 2 + 8, k + " panel hugs the pill, no empty dark box " + J(p));
    assert.ok(p.w >= p.pillW, k + " " + J(p));
  }
  for (const k of ["paired@1280@800", "paired@1920@1080"]) {
    const p = r[k].t1.panel;
    assert.ok(p && p.h > 100 && p.pillH === 0, k + " full lights panel " + J(p));
  }
});

test("PAIRUI1b · kid board light pad says Not connected, never Needs pairing or Ready; hub keeps Needs pairing", SKIP, async () => {
  const r = await all();
  const k = r.kid.t1;
  assert.deepEqual(r.kid.errors, []);
  assert.deepEqual(k.kidPad, ["Not connected"], J(k));
  assert.equal(k.needs.length, 0, J(k));
  assert.equal(r.unpaired.t1.pairWord, 1);
});

test("PAIRUI1b · source: paintKidPad has no Needs pairing; only kid-harris of the kid boards loads the lights pad", () => {
  const L = read("house-lights.js");
  const a = L.indexOf("function paintKidPad("), b = L.indexOf("host.onclick", a);
  assert.ok(a > 0 && b > a);
  assert.doesNotMatch(L.slice(a, b), /needs pairing/i);
  assert.match(L.slice(a, b), /pillTxt = "Not connected"/);
  const kids = fs.readdirSync(ROOT).filter((f) => /^kid-[a-z]+\.html$/.test(f));
  const withLights = kids.filter((f) => /house-lights\.js/.test(read(f)) || /kid-light-host/.test(read(f)));
  assert.deepEqual(withLights, ["kid-harris.html"], "every kid board with a light pad is covered: " + withLights);
});
