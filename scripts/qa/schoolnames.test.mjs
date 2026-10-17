/* SCHOOLNAMES1 · the kids' school code and name never live in git (node --test scripts/qa/schoolnames.test.mjs).
   school-names.js reads role "school" at run time (same sources and token rule as livinghouse/lh-rules.js), the hub
   serves only that role with the device token, and with no names every school pattern matches nothing.
   Synthetic values only (QXS / Quux Hill); temp dirs, no real data. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
/* SCHOOLKEY2 · hermetic: a box with real school rows (or a WARDOS_PRIVATE_NAMES / WARDOS_NAMES in the shell) must never
   leak into this test, or a failing assert would print them */
delete process.env.WARDOS_PRIVATE_NAMES; delete process.env.WARDOS_NAMES;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "schoolnames-"));
const PRIV = path.join(TMP, "private");
fs.mkdirSync(PRIV, { recursive: true, mode: 0o700 });
const NAMES = path.join(PRIV, "private-names.tsv");
fs.writeFileSync(NAMES, "# synthetic\npartner\tZed Partnerly\ncoparent\tYolanda\nschool\tQXS\nschool\tQuux Hill\nschool\tbad-token!\n", { mode: 0o600 });

function freshSchoolNames() {
  const src = fs.readFileSync(path.join(ROOT, "school-names.js"), "utf8");
  const ctx = vm.createContext({});
  vm.runInContext(src, ctx);
  return ctx.SchoolNames;
}

test("no names known: every school pattern matches nothing (fail closed)", () => {
  const S = freshSchoolNames();
  assert.equal(S.schoolTokens().length, 0);
  assert.equal(S.rx("§ drop", "i").test("QXS drop"), false);
  assert.equal(S.rx("\\b§\\b|¶", "i").test("Quux Hill drop"), false);
  assert.equal(S.isSchoolText("QXS pickup"), false);
  assert.equal(S.label("School"), "School");
});

test("setSchools: tokens, full names and the LHRules token rule", () => {
  const S = freshSchoolNames();
  S.setSchools(["QXS", "Quux Hill", "bad-token!", "WAYTOOLONGCODE"]);
  assert.deepEqual([...S.schoolTokens()], ["QXS"]);
  assert.deepEqual([...S.fullNames()], ["Quux Hill"]);
  assert.ok(S.rx("§ drop-off|§ drop\\b", "i").test("Hayes + Harris — QXS drop-off · 7:55"));
  assert.ok(S.rx("\\b§\\b", "").test("boys QXS run"));
  assert.equal(S.rx("\\b§\\b", "").test("boys qxs run"), false, "no flag stays case-sensitive");
  assert.ok(S.rx("\\b§\\b|¶", "i").test("Quux  Hill pickup"));
  assert.equal(S.stripSchool("QXS specials: Art"), "specials: Art");
  assert.equal(S.label("School"), "QXS");
  S.setSchools(null);
});

test("browser source: window.WARDOS_PRIVATE_NAMES.school (set by private-feed.js), picked up after a late arrival", () => {
  const ctx = vm.createContext({ window: {} });
  ctx.window.window = ctx.window;
  vm.runInContext(fs.readFileSync(path.join(ROOT, "school-names.js"), "utf8"), ctx);
  const S = ctx.window.SchoolNames;
  assert.equal(S.alt(), "(?!)", "nothing before the feed");
  ctx.window.WARDOS_PRIVATE_NAMES = { school: ["QXS"] };
  assert.equal(S.alt(), "QXS", "empty is never cached");
});

test("node sources: WARDOS_PRIVATE_NAMES file, WARDOS_NAMES, nothing", () => {
  const run = (env) => execFileSync("node", ["-e", "const S=require(process.argv[1]);process.stdout.write(JSON.stringify([S.schoolTokens(),S.fullNames()]))", path.join(ROOT, "school-names.js")],
    { env: { PATH: process.env.PATH, HOME: TMP, ...env } }).toString();
  assert.equal(run({ WARDOS_PRIVATE_NAMES: NAMES }), '[["QXS"],["Quux Hill"]]');
  assert.equal(run({ WARDOS_PRIVATE_DIR: PRIV }), '[["QXS"],["Quux Hill"]]');
  assert.equal(run({ WARDOS_NAMES: "partner=X;school=QXS" }), '[["QXS"],[]]');
  assert.equal(run({}), "[[],[]]");
});

test("hub route /api/private/private-names.json: token only, role school only", async () => {
  process.env.WARDOS_PRIVATE_DIR = PRIV;
  const { handlePrivate } = await import("../private-feed.mjs");
  const TOKEN = "test-token-0123456789abcdef";
  const server = http.createServer((req, res) => { if (!handlePrivate(req, res, { tokens: [TOKEN], origins: new Set(), dir: PRIV })) { res.writeHead(404); res.end(); } });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/api/private/private-names.json`;
  try {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers: { "X-Private-Feed-Token": "wrong-token-0123456789" } })).status, 401);
    const r = await fetch(base, { headers: { "X-Private-Feed-Token": TOKEN } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control") || "", /no-store/);
    const txt = await r.text();
    assert.deepEqual(JSON.parse(txt), { school: ["QXS", "Quux Hill"] });
    assert.doesNotMatch(txt, /Partnerly|Yolanda|bad-token/);
  } finally { server.close(); }
});

test("generator: the school run classifies with the private name and not without it", () => {
  const FX = path.join(ROOT, "scripts/qa/fixtures/allday-nextleave.events.json");
  const gen = (names) => {
    const dir = fs.mkdtempSync(path.join(TMP, "gen-"));
    fs.copyFileSync(path.join(ROOT, "scripts/qa/fixtures/private/kids-week.synthetic.json"), path.join(dir, "kids-week.json"));
    execFileSync("node", [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", FX, "--week", path.join(dir, "kids-week.json"), "--no-mirror", "--now", "2026-10-13T06:40:00-05:00"],
      { stdio: "pipe", env: { ...process.env, WARDOS_NAMES: names } });
    return JSON.parse(fs.readFileSync(path.join(dir, "kids-week.json"), "utf8"));
  };
  const withName = gen("school=QXS").boardStrip.nextLeave;
  assert.equal(withName.kind, "school_drop");
  assert.equal(withName.place, "Boys QXS drop");
  const without = gen("partner=Nobody").boardStrip.nextLeave;
  assert.ok(!without || without.kind !== "school_drop", "no school name = no school drop");
});

test("the tree carries no school name rule outside school-names.js (no literal school code in the browser helpers)", () => {
  for (const f of ["kids-data.js", "house-kid-engage.js", "house-hub-tiles-bind.js", "house-board-strip.js", "scripts/calendar-refresh.mjs", "scripts/cal-from-events.mjs"]) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(/SCHRX\(|SchoolNames|school-names\.js/.test(s), f + " uses school-names.js");
  }
  for (const f of ["sheet-us.html", "sheet-today.html", "sheet-index.html", "sheet-dan.html", "sheet-countdowns.html", "sheet-chores.html", "sheet-allowance.html", "month.html", "mercury-run.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html"]) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    const i = s.indexOf("private-feed.js"), j = s.indexOf("school-names.js");
    assert.ok(i > 0 && j > i, f + " loads school-names.js right after private-feed.js");
  }
});

/* SCHOOLKEY2 · the school code also hides as a key prefix ("<code>_drop"). \b treats '_' as a word character, so the scanner
   uses (?<![A-Za-z])CODE(?![a-z]) for role school. Synthetic QXS only; the plant is a zz-* file this test owns. */
test("privacy-scan catches a school code joined by '_', a digit or a capital (QXS_drop, QXSDrop, QXSX, qxsDrop) and still ignores it inside words", () => {
  assert.equal(/\bQXS\b/i.test("QXS_drop"), false, "the old \\b rule is blind to this form");
  const plant = path.join(ROOT, "zz-schoolkey2-plant.txt");
  const scan = (env) => spawnSync("node", [path.join(ROOT, "scripts/privacy-scan.mjs"), "--tree", "--only", "(^|/)zz-schoolkey2-plant"],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, WARDOS_PRIVACY_DENYLIST: path.join(TMP, "no-denylist"), ...env } });
  try {
    for (const bad of ['leaveBys: { QXS_drop: "leave 8:10" }', '"qxs_pickup": "x"', "row.QXS_drop", "kind=QXS-run", "QXS2", "QXSDrop", "QXSX", "qxsDrop", "Quux  Hill_x"]) {
      fs.writeFileSync(plant, "plain line\n" + bad + "\n");
      const r = scan({ WARDOS_PRIVATE_NAMES: NAMES });
      assert.equal(r.status, 1, "caught: line " + bad.length + " chars");
      assert.match(r.stdout, /PRIVACY denylist\s+zz-schoolkey2-plant\.txt:2/);
      assert.doesNotMatch(r.stdout, /QXS/i, "the code itself is never printed");
    }
    for (const ok of ["AQXSB", "fqxsx drop", "QXSdrop", "school_drop", "QXZ_drop"]) {
      fs.writeFileSync(plant, ok + "\n");
      assert.equal(scan({ WARDOS_PRIVATE_NAMES: NAMES }).status, 0, "letters on either side still block: " + ok.length);
    }
    fs.writeFileSync(plant, "QXS_drop\n");
    assert.equal(scan({ WARDOS_PRIVATE_NAMES: path.join(TMP, "no-names.tsv"), HOME: TMP, WARDOS_PRIVATE_DIR: path.join(TMP, "none") }).status, 0, "with no school row the scanner has nothing to find");
  } finally { fs.rmSync(plant, { force: true }); }
});

test("generator default leave-by keys and the synthetic fixture use neutral or synthetic prefixes only", () => {
  const gen = fs.readFileSync(path.join(ROOT, "scripts/calendar-refresh.mjs"), "utf8");
  assert.match(gen, /school_drop: "leave/);
  assert.match(gen, /school_pickup: "leave/);
  const keys = gen.match(/\b[A-Za-z]{2,8}_(?:drop|pickup)\b/g) || [];
  assert.deepEqual([...new Set(keys)].sort(), ["school_drop", "school_pickup"]);
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/qa/fixtures/private/kids-week.synthetic.json"), "utf8"));
  assert.deepEqual(Object.keys(fx.leaveBys).sort(), ["QXS_drop", "QXS_pickup", "note"]);
});
