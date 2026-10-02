/* ATLASLANE7 tests: kids-week generator emits no $, jar, payday or balance copy (only Ainsley's "$15/hr" tag);
   every Atlas CLI treats --help as print-only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { kidCopyText, kidCopyDeep, kidMoneyHits, EXACT, ALLOWED_TAG } from "../kid-copy.mjs";
import { momHits } from "../display-rename.mjs";
import { hits as wrightHits } from "../../wall/kid-path-copy.mjs";
import { calendar, ROOT } from "./fixture.mjs";

const embedded = (src) => JSON.parse(/var EMBEDDED = (\{[\s\S]*?\});/.exec(src)[1]);
const dollars = (s) => (s.match(/\$/g) || []).length;
const tags = (s) => s.split(ALLOWED_TAG).length - 1;

test("kid copy: jar -> the kid's goal word, $ chore amounts -> stars, Ainsley's tag stays, ids untouched", () => {
  assert.equal(kidCopyText("Gem Jar · earn then save", "harris"), "Gems · earn then save");
  assert.equal(kidCopyText("Tour Jar · $20", "ainsley"), "Tour goal");
  assert.equal(kidCopyText("ALL musts → jar $10 + $10 payday", "hayes"), "ALL musts clear");
  assert.equal(kidCopyText("Payday with Dad after honest musts", "hayes"), "Goal with Dad after honest musts");
  assert.equal(kidCopyText("$7 wk", "hayes"), "7★ wk");
  assert.equal(kidCopyText("$7 ea wk · bed + dishes", "harris"), "7★ ea wk · bed + dishes");
  assert.equal(kidCopyText("Balance $0", "ainsley"), "Stars 0★");
  assert.equal(kidCopyText("Victory Jar bonus → jar → payday", "harris"), "Victory Coins bonus");
  assert.equal(kidCopyText("$15/hr", "ainsley"), "$15/hr");
  assert.equal(kidCopyText("Babysit $15/hr · Tour Jar $20", "ainsley"), "Babysit $15/hr · Tour goal 20★");
  assert.equal(kidCopyText("Make bed — morning reset", "ainsley"), "Make bed — morning reset", "clean copy untouched");
  for (const v of EXACT.values()) assert.deepEqual(kidMoneyHits({ v }), [], v);
  const w = kidCopyDeep({ kids: { harris: { bankGoal: { id: "gem-jar", title: "Gem Jar · earn then save", need: 10 } } } });
  assert.equal(w.kids.harris.bankGoal.id, "gem-jar", "ids key saved state: not copy");
  assert.equal(w.kids.harris.bankGoal.need, 10);
  /* every current string matches Wright's KIDPATH1 wording, except reward (payday is not allowed either) */
  const prev = JSON.parse(execFileSync("git", ["show", "c9ee49a:data/kids-week.json"], { cwd: ROOT, encoding: "utf8" }));
  const root = JSON.parse(fs.readFileSync(path.join(ROOT, "kids-week.json"), "utf8"));
  const mine = kidCopyDeep(prev);
  for (const k of ["harris", "hayes", "ainsley"]) for (const f of ["fun", "missions", "goal", "quests", "currency", "streakLabel"]) {
    assert.deepEqual(mine.kids[k][f], root.kids[k][f], `${k}.${f}`);
  }
  assert.equal(root.kids.hayes.bankGoal.reward, "Goal with Dad after honest musts");
});

test("regenerated kids-week (calendar-refresh build) has zero $ except Ainsley's '$15/hr' tag, no jar/payday/balance", () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "atlas7-"));
  /* start from the OLD money copy the builder used to preserve forever */
  fs.writeFileSync(path.join(T, "kids-week.json"), execFileSync("git", ["show", "c9ee49a:data/kids-week.json"], { cwd: ROOT, encoding: "utf8" }));
  fs.copyFileSync(path.join(ROOT, "kids-data.js"), path.join(T, "kids-data.js"));
  fs.writeFileSync(path.join(T, "events.json"), JSON.stringify(calendar()));
  const before = fs.readFileSync(path.join(ROOT, "kids-week.json"), "utf8");
  const r = spawnSync("node", [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", path.join(T, "events.json"), "--week", path.join(T, "kids-week.json"),
    "--no-mirror", "--now", "2026-10-01T18:30:00-05:00"], { cwd: T, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(ROOT, "kids-week.json"), "utf8"), before, "repo copy untouched by the test");
  for (const [name, src] of [["kids-week.json", fs.readFileSync(path.join(T, "kids-week.json"), "utf8")], ["data/kids-week.json", fs.readFileSync(path.join(T, "data/kids-week.json"), "utf8")]]) {
    const w = JSON.parse(src);
    assert.deepEqual(kidMoneyHits(w), [], name);
    assert.equal(dollars(src), tags(src), `${name}: every $ is the allowed tag`);
    assert.equal(tags(src), 1, `${name}: the tag is kept once`);
    assert.equal(w.kids.ainsley.quests.find((q) => q.id === "ain-babysit").rateLabel, "$15/hr");
    assert.deepEqual(momHits(w), [], name);
    assert.deepEqual(wrightHits("kids-week.json", src), [], `${name}: Wright's kid-path scanner`);
  }
  const emb = embedded(fs.readFileSync(path.join(T, "kids-data.js"), "utf8"));
  assert.deepEqual(kidMoneyHits(emb), [], "kids-data.js EMBEDDED");
  const es = JSON.stringify(emb);
  assert.equal(dollars(es), tags(es));
  fs.rmSync(T, { recursive: true, force: true });
});

test("committed kids-week copies (root, data/, kids-data.js EMBEDDED) carry no money copy except the tag", () => {
  for (const rel of ["kids-week.json", "data/kids-week.json"]) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    assert.deepEqual(kidMoneyHits(JSON.parse(src)), [], rel);
    assert.equal(dollars(src), tags(src), rel);
    assert.deepEqual(wrightHits("kids-week.json", src), [], rel);
  }
  const emb = embedded(fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8"));
  assert.deepEqual(kidMoneyHits(emb), []);
  for (const f of ["scripts/calendar-refresh.mjs", "scripts/cal-from-events.mjs"]) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok((s.match(/kidCopyDeep\(displayDeep\(/g) || []).length >= 2, `${f}: every kids-week write runs the pass`);
  }
});

test("--help is print-only on every Atlas CLI (never writes)", () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "atlas7h-"));
  const data = ["next-up", "school-night", "logistics-taps", "pickup-chain", "house-mode", "kid-seats", "unlocks"].map((n) => path.join(ROOT, `data/${n}.json`));
  const snap = () => data.map((f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") + fs.statSync(f).mtimeMs : null));
  const before = snap();
  for (const cli of ["next-up", "school-night", "logistics-taps", "pickup-chain", "house-mode", "kid-layer", "display-rename"]) {
    for (const flag of ["--help", "-h"]) {
      const out = path.join(T, `${cli}.json`);
      const r = spawnSync("node", [path.join(ROOT, `scripts/${cli}.mjs`), flag, "--out", out], { cwd: T, encoding: "utf8" });
      assert.equal(r.status, 0, `${cli} ${flag}: ${r.stderr}`);
      assert.match(r.stdout, /^Usage: node scripts\//, cli);
      assert.match(r.stdout, /writes nothing/);
      assert.equal(fs.existsSync(out), false, `${cli} ${flag} wrote ${out}`);
    }
  }
  assert.deepEqual(snap(), before, "no committed data file touched");
  assert.deepEqual(fs.readdirSync(T), []);
  fs.rmSync(T, { recursive: true, force: true });
});
