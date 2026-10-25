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
    const list = [["unpaired"], ["unpaired", 1280, 800], ["paired"], ["offline"], ["kid"]];
    runs = (async () => { const o = {}; for (const a of list) o[a.join("@")] = await run(...a); return o; })();
  }
  return runs;
}

test("PAIRUI1 · unpaired: exactly one pairing prompt, no empty Needs pairing card (phone and desk)", SKIP, async () => {
  const r = await all();
  for (const k of ["unpaired", "unpaired@1280@800"]) {
    assert.deepEqual(r[k].errors, [], k);
    for (const t of ["t0", "t1"]) {
      const s = r[k][t];
      assert.equal(s.pairState, "hub-no-key", k + " " + J(s));
      assert.equal(s.leavebyVisible, 0, k + " " + t + " no strip card under the clock " + J(s));
      const prompts = s.needs.filter((c) => !/^hub-cam-rest-word$|^hub-lights-pairword$/.test(c));
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
  for (const k of ["paired", "offline"]) {
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
  assert.match(read("sheet-index.html"), /house-lights\.js\?v=PAIRUI1/);
  assert.match(read("sheet-index.html"), /house-nest\.js\?v=PAIRUI1/);
  assert.match(read("kid-harris.html"), /house-lights\.js\?v=PAIRUI1/);
});
