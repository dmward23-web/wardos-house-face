/* ATLASLANE8 · every Atlas CLI exits non-zero on an unknown or valueless flag BEFORE any read or write
   (school-night --bogus used to rebuild data/school-night.json). --help stays print-only, exit 0. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { ROOT } from "./fixture.mjs";

const CLIS = ["next-up", "school-night", "logistics-taps", "pickup-chain", "house-mode", "kid-layer", "display-rename"];
const WATCH = [...["data", "config"].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith(".json")).map((f) => `${d}/${f}`)),
  "kids-week.json", "kids-data.js"];
const snap = () => Object.fromEntries(WATCH.map((f) => { const p = path.join(ROOT, f); return [f, crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") + ":" + fs.statSync(p).mtimeMs]; }));
const run = (cli, args, cwd) => spawnSync(process.execPath, [path.join(ROOT, `scripts/${cli}.mjs`), ...args], { cwd, encoding: "utf8", timeout: 20000 });

test("unknown / valueless / bad flags: exit 2, usage on stderr, nothing written anywhere", () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "atlas8-"));
  const before = snap();
  for (const cli of CLIS) {
    const out = path.join(T, `${cli}.json`), outDir = path.join(T, cli);
    const bad = [["--bogus"], ["--bogus", "--out", out], ["--out", out, "--now"], ["--now", "--stdout"], ["--now", "not-a-date", "--out", out], ["--stdout=1"], ["-x"]];
    if (cli !== "display-rename") bad.push(["stray-arg"], ["--out", out, "--out", out]);
    else bad.push(["--bogus", "kids-week.json"], ["--kid-copy", "--nope", "data/kids-week.json"]);
    if (cli === "kid-layer") bad.push(["--out-dir", outDir, "--bogus"], ["--out-dir"]);
    for (const args of bad) {
      const r = run(cli, args, T);
      assert.equal(r.status, 2, `${cli} ${args.join(" ")}: exit ${r.status} ${r.stderr}`);
      assert.match(r.stderr, new RegExp(`^${cli}: .*Nothing written\\.`), `${cli} ${args.join(" ")}`);
      assert.match(r.stderr, /Usage: node scripts\//);
      assert.equal(r.stdout, "", `${cli} ${args.join(" ")} printed a build line`);
      assert.equal(fs.existsSync(out) || fs.existsSync(outDir), false, `${cli} ${args.join(" ")} wrote`);
    }
    for (const h of ["--help", "-h"]) {
      const r = run(cli, ["--bogus", h], T);
      assert.equal(r.status, 0, `${cli} --bogus ${h}: help still wins`);
      assert.match(r.stdout, /writes nothing\. Unknown flags exit 2, nothing written\./);
    }
  }
  assert.deepEqual(snap(), before, "no repo data/config file touched");
  assert.deepEqual(fs.readdirSync(T), []);
  fs.rmSync(T, { recursive: true, force: true });
});

test("valid runs still work (stdout only, or into a temp --out)", () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "atlas8v-"));
  for (const cli of ["next-up", "school-night", "logistics-taps", "pickup-chain", "house-mode"]) {
    const r = run(cli, ["--now", "2026-10-01T18:40:00-05:00", "--stdout"], ROOT);
    assert.equal(r.status, 0, `${cli}: ${r.stderr}`); JSON.parse(r.stdout);
  }
  const sn = run("school-night", ["--now", "2026-10-01T16:00:00-05:00", "--pack-flags", path.join(ROOT, "data/pack-flags.json"), "--out", path.join(T, "sn.json")], ROOT);
  assert.equal(sn.status, 0, sn.stderr);
  assert.ok(fs.existsSync(path.join(T, "sn.json")), "--pack-flags is a known value flag");
  const kl = run("kid-layer", ["--now", "2026-10-01T20:05:00-05:00", "--taps", path.join(T, "none.json"), "--out-dir", T], ROOT);
  assert.equal(kl.status, 0, kl.stderr);
  assert.deepEqual(fs.readdirSync(T).sort(), ["kid-seats.json", "sn.json", "unlocks.json"]);
  const dr = run("display-rename", ["--check", "--kid-copy", "data/kids-week.json"], ROOT);
  assert.equal(dr.status, 0, dr.stdout + dr.stderr);
  fs.rmSync(T, { recursive: true, force: true });
});

test("one strict parser, no stacked copies: every CLI goes through scripts/house/cli-args.mjs", () => {
  for (const cli of CLIS) {
    const src = fs.readFileSync(path.join(ROOT, `scripts/${cli}.mjs`), "utf8");
    assert.ok(/cliArgs\(|parseArgs\(process\.argv/.test(src), cli);
    assert.ok(!/process\.argv\.includes\("--help"\)/.test(src), `${cli}: old loose --help check removed`);
    assert.ok(!/cli-guard/.test(src), cli);
  }
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/house-mode.mjs"), "utf8"), /cliArgs\(argv/);
});
