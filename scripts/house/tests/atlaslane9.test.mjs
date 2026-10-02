/* ATLASLANE9 (Alfred QA, Oct 1 9:18 PM CT):
   (1) kids-week follows the chore law at the generator: 4 binary MUSTS per kid (Dragon fed swaps Hayes's 4th only while the
       dragon is home), Ainsley has no stars and no currency anywhere, zero $ except the '$15/hr' babysitting tag.
   (2) the raw-title rename patterns are out of the published repo (private box file); only display strings ship. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { kidCopyDeep, kidLawHits, kidLawWeek, kidMoneyHits, lawConfig, ALLOWED_TAG } from "../kid-copy.mjs";
import { loadRenames, displayText, privateRulesPath, RENAME_CONFIG } from "../display-rename.mjs";
import { calendar, ROOT } from "./fixture.mjs";

const embedded = (src) => JSON.parse(/var EMBEDDED = (\{[\s\S]*?\});/.exec(src)[1]);
const LAW_WORDS = ["Bed made", "Hamper in", "Dish to the sink", "Own floor clear"];
const mustsOf = (w, k) => w.kids[k].quests.filter((q) => !(q.optional === true || q.cadence === "addon"));
function lawAsserts(w, name) {
  assert.deepEqual(kidLawHits(w), [], name);
  for (const k of ["harris", "hayes", "ainsley"]) {
    assert.deepEqual(mustsOf(w, k).map((q) => q.what), LAW_WORDS, `${name} ${k}: four MUSTS`);
    assert.ok(mustsOf(w, k).every((q) => q.cadence === "daily" && q.must === true), `${name} ${k}: binary daily`);
  }
  const a = w.kids.ainsley;
  for (const f of ["currency", "bankGoal", "goal"]) assert.equal(a[f], undefined, `${name}: Ainsley ${f}`);
  assert.ok(!/"stars"\s*:|★|\bstars?\b/i.test(JSON.stringify(a)), `${name}: no star anywhere on Ainsley`);
  assert.equal(a.quests.find((q) => q.id === "ain-babysit").rateLabel, ALLOWED_TAG, `${name}: babysitting tag kept`);
  assert.deepEqual(kidMoneyHits(w), [], name);
  const s = JSON.stringify(w);
  assert.equal((s.match(/\$/g) || []).length, s.split(ALLOWED_TAG).length - 1, `${name}: every $ is the tag`);
}

test("committed kids-week copies (root, data/, kids-data.js EMBEDDED) follow the chore law", () => {
  for (const rel of ["kids-week.json", "data/kids-week.json"]) lawAsserts(JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")), rel);
  lawAsserts(embedded(fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8")), "kids-data.js EMBEDDED");
});

test("generator: calendar-refresh regenerates the law from the old 5/7/7 chart (temp dir, no mirror, no deploy)", () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "atlas9-"));
  const old = execFileSync("git", ["show", "c9ee49a:data/kids-week.json"], { cwd: ROOT, encoding: "utf8" });
  const o = JSON.parse(old);
  assert.deepEqual(["ainsley", "harris", "hayes"].map((k) => o.kids[k].quests.filter((q) => q.cadence === "daily").length), [5, 7, 7], "the old chart Alfred flagged");
  assert.ok(kidLawHits(o).length > 0);
  fs.writeFileSync(path.join(T, "kids-week.json"), old);
  fs.copyFileSync(path.join(ROOT, "kids-data.js"), path.join(T, "kids-data.js"));
  fs.writeFileSync(path.join(T, "events.json"), JSON.stringify(calendar()));
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", path.join(T, "events.json"), "--week", path.join(T, "kids-week.json"),
    "--no-mirror", "--now", "2026-10-01T21:20:00-05:00"], { cwd: T, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  lawAsserts(JSON.parse(fs.readFileSync(path.join(T, "kids-week.json"), "utf8")), "regenerated");
  fs.rmSync(T, { recursive: true, force: true });
  for (const f of ["scripts/calendar-refresh.mjs", "scripts/cal-from-events.mjs"])
    assert.ok((fs.readFileSync(path.join(ROOT, f), "utf8").match(/kidCopyDeep\(displayDeep\(/g) || []).length >= 2, f);
});

test("Dragon fed replaces Hayes's fourth only while the dragon is home; the law pass is idempotent; weekly missions gone", () => {
  const w = JSON.parse(fs.readFileSync(path.join(ROOT, "data/kids-week.json"), "utf8"));
  assert.equal(lawConfig().musts.dragon.inHouse, false);
  const home = structuredClone(lawConfig()); home.musts.dragon.inHouse = true;
  const d = kidLawWeek(w, home);
  assert.deepEqual(mustsOf(d, "hayes").map((q) => q.what), ["Bed made", "Hamper in", "Dish to the sink", "Dragon fed"]);
  assert.deepEqual(mustsOf(d, "harris").map((q) => q.what), LAW_WORDS, "only Hayes swaps");
  assert.deepEqual(mustsOf(d, "ainsley").map((q) => q.what), LAW_WORDS, "only Hayes swaps");
  assert.deepEqual(kidLawHits(d, home), []);
  assert.ok(kidLawHits(d).length > 0, "dragon must while the dragon is away is a breach");
  assert.deepEqual(kidCopyDeep(w), w, "running the pass again changes nothing");
  for (const k of ["harris", "hayes", "ainsley"]) assert.ok(!(w.kids[k].missions || []).some((m) => /^weekly$/i.test(m.when)), k);
  for (const k of ["harris", "hayes"]) assert.ok(w.kids[k].currency && w.kids[k].bankGoal, `${k} keeps currency (Ledger's domain)`);
});

test("rename patterns live outside the published repo; only display strings ship", () => {
  const pub = JSON.parse(fs.readFileSync(RENAME_CONFIG, "utf8"));
  assert.deepEqual(pub.renames, [{ id: "nonna-papa", replace: "Nonna and Papa" }, { id: "nonna-birthday", replace: "Nonna birthday" }]);
  const src = fs.readFileSync(RENAME_CONFIG, "utf8");
  assert.ok(!/"pattern"|"evidence"|\bMom\b|\bErin\b/.test(src), "no raw titles, patterns or source names in the public config");
  const pfp = privateRulesPath(pub);
  assert.ok(!path.resolve(pfp).startsWith(path.resolve(ROOT) + path.sep), "private file is outside the repo / deployed folder");
  /* the board's client-side compileRenames must skip pattern-less renames (an empty RegExp would match everywhere) */
  const lists = fs.readFileSync(path.join(ROOT, "house-wall-lists.js"), "utf8");
  assert.match(lists, /filter\(function \(r\) \{ return r && typeof r\.pattern === "string" && r\.pattern; \}\)/);
  /* fail closed: no private file -> no renames */
  const none = loadRenames(RENAME_CONFIG, path.join(os.tmpdir(), "no-such-private.json"));
  assert.deepEqual([none.privateLoaded, none.renames.length], [false, 0]);
  if (!fs.existsSync(pfp)) return; /* CI / another box: the real examples are private */
  assert.equal((fs.statSync(pfp).mode & 0o077), 0, "private file is mode 600");
  const priv = JSON.parse(fs.readFileSync(pfp, "utf8"));
  const R = loadRenames(RENAME_CONFIG, pfp);
  assert.equal(R.privateLoaded, true);
  for (const ex of priv.examples || []) assert.equal(displayText(ex.in, R), ex.out, "private example maps to its display string");
  /* no tracked text file carries a raw example title */
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter((f) => f && /\.(json|js|mjs|py|md|html|css|txt|ya?ml|sh|tsv)$/.test(f));
  const needles = (priv.examples || []).map((e) => e.in).filter((n) => n && n !== (priv.examples || []).find((e) => e.in === n).out);
  const leaks = [];
  for (const f of tracked) { const fp = path.join(ROOT, f); if (!fs.existsSync(fp)) continue; const s = fs.readFileSync(fp, "utf8"); for (const n of needles) if (s.includes(n)) leaks.push(f); }
  assert.deepEqual([...new Set(leaks)], []);
});
