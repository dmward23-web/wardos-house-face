/* CALREGEN1 · node --test scripts/qa/calregen1.test.mjs
   Neutral fixture only. No live calendar fetch. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("regen prints sha256, keeps the prior file, scans 0, and keeps houseAwayIso", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "calregen-"));
  const home = path.join(dir, "home");
  fs.mkdirSync(path.join(home, ".config", "wardos"), { recursive: true });
  fs.writeFileSync(path.join(home, ".config", "wardos", "privacy-scrub.tsv"), "# stand-in\n");
  const out = path.join(dir, "cal-months.json");
  fs.writeFileSync(out, "{\"status\":\"old\"}\n");
  const prior = fs.readFileSync(out);
  const r = spawnSync("python3", [
    path.join(ROOT, "scripts/cal-regen.py"),
    "--fixture", path.join(ROOT, "scripts/qa/fixtures/calregen-primary.json"),
    "--out", out,
  ], { encoding: "utf8", env: { ...process.env, HOME: home, CAL_THROUGH: "2027-01-08", WARDOS_NAMES: "partner=Samplepartner;coparent=Samplecoparent" } });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /sha256 before /);
  assert.match(r.stdout, /sha256 after /);
  assert.match(r.stdout, /privacy-scan 0/);
  assert.match(r.stdout, /money-scan 0/);
  assert.equal(fs.readFileSync(out + ".bak").equals ? fs.readFileSync(out + ".bak").equals(prior) : fs.readFileSync(out + ".bak").toString() === prior.toString(), true);
  const doc = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.ok(Array.isArray(doc.houseAwayIso) && doc.houseAwayIso.length === 1);
  assert.match(r.stdout, /rollback:/);
  assert.doesNotMatch(r.stdout + fs.readFileSync(out, "utf8"), /@/);
});
