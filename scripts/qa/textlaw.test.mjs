/* TEXTLAW2 · node --test scripts/qa/textlaw.test.mjs
   One visible-text law (scripts/text-law.json) read by both data writers:
   1. cal-from-events.mjs cleanText and scripts/text_law.py clean_text give the same words for the same input.
   2. Known titles come out plain (no codes, flight numbers, em dashes, arrows, other-house names, partner name), and the law is idempotent.
   3. cal-months.py writes clean labels into cal-months.json from a fixture pull and leaves withDan exactly as the pull says.
   Fixture only; no real data written. */
import { assertSealed } from "./temp-home.mjs";   // TEMPHOME1 (LHVID1): WARDOS_* unset and a temp HOME before any private-list reader loads
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
/* PRIVNAME1 · tests use synthetic names; the real ones live only in the private names file (never in git).
   CALSCRUB1 · the box-only event rules are switched off so only the public law is tested. */
process.env.WARDOS_NAMES = "partner=Partner;coparent=Coparent;external=Smith";
process.env.WARDOS_TEXT_LAW_PRIVATE = "/nonexistent/text-law.private.json";
const { cleanText } = await import("../cal-from-events.mjs");
const SYNTH = /\b(Partner|Coparent)\b/;
/* the real names, only to check the committed data (skipped where the private file is absent, e.g. CI) */
const PRIV_DIR_FILE = path.join(process.env.WARDOS_PRIVATE_DIR || path.join(os.homedir(), ".local/share/wardos-private"), "private-names.tsv");
const PRIV_FILE = fs.existsSync(PRIV_DIR_FILE) ? PRIV_DIR_FILE : path.join(os.homedir(), ".config/wardos/private-names.tsv");
const REAL = fs.existsSync(PRIV_FILE) ? fs.readFileSync(PRIV_FILE, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#") && l.includes("\t")).map((l) => l.split("\t")[1].trim()) : [];
const REAL_RE = REAL.length ? new RegExp("\\b(" + REAL.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b") : null;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const py = (list) => JSON.parse(execFileSync("python3", [path.join(ROOT, "scripts/text_law.py")], { input: JSON.stringify(list) }).toString());

const CASES = [
  ["Dan+Partner CLE weekend #QX7P2L", "Dad: CLE weekend"], // privacy-scan:allow booking_code
  ["<strong>Fri</strong> Dan+Partner CLE weekend", "<strong>Fri</strong> Dad: CLE weekend"],
  ["Flight to Springfield XY 1234 #QQW987", "Flight to Springfield"], // privacy-scan:allow booking_code
  ["Flight home (XY 987) ABC→DEF", "Flight home"],
  ["Kids — pickup at their mom's", "Kids · pickup"],
  ["Partner + Dan — Park concert (two bands)", "Dad: Park concert (two bands)"],
  ["Ainsley practice — field 3 → field 5", "Ainsley practice · field 3 to field 5"],
  ["Hayes ortho MOVED → Wed 5:10", "Hayes ortho moved to Wed 5:10"],
  ["Drop at Coparent's 5:00", "Drop 5:00"],
  ["Kids — pickup at Coparent's · 2:45", "Kids · pickup · 2:45"],
  ["Hayes — drop Riley’s mom (batting carpool)", "Hayes · drop Riley’s family (batting carpool)"],
  ["Dan #QWERTZ ✈️ ABC→DEF 1:35pm · leave 11:35", "Dan ✈️ 1:35pm · leave 11:35"], // privacy-scan:allow booking_code
  ["Pack bags —", "Pack bags"],
  ["Pizza night", "Pizza night"],
  ["Ward Kids [AHH No School]", "No School"],
  ["Ward Kids [HA No School]", "No School"],
  ["Ward Kids [HAA Half Day]", "Half Day"],
  ["<strong>Fri</strong> Ward Kids [A No School]", "<strong>Fri</strong> No School"],
  ["Smith Club [RH No School]", "Smith Club · No School"],
  ["Dan Springfield [DRIVE · fly backup ]", "Dan Springfield · DRIVE · fly backup"],
  ["Partner STL [ Sat in · Tue out]", "STL · Sat in · Tue out"],
  ["Pizza with Partner · 7:00", "Pizza · 7:00"],
  ["Dinner with Partner", "Dad: Dinner"],
  ["Dan + Partner DRIVE to KC · leave 6:30", "Dad: DRIVE to KC · leave 6:30"],
  ["Host sit-down · Partner + /Dad · 5:30", "Host sit-down · Dad · 5:30"],
  ["Dan Springfield · drive in with Partner, departs @ 8:10a", "Dan Springfield · drive in, departs @ 8:10a"],
  ["Pick up Partner’s bag", "Pick up bag"],
  ["Dan + Kids Springfield [Driving]", "Dan + Kids Springfield · Driving"],
  ["Pickup [AHH]", "Pickup"],
  ["Owls vs Hawks (Sec 112, Row F, Seats 5-6)", "Owls vs Hawks"], // privacy-scan:allow seat_code
  ["https://example.com/a—b", "https://example.com/a—b"],
  ["2026-10-17T15:30:00-05:00", "2026-10-17T15:30:00-05:00"],
  ["", ""],
];

assertSealed();
test("both writers read the same law and agree word for word", () => {
  const inputs = CASES.map((c) => c[0]);
  assert.deepEqual(py(inputs), inputs.map(cleanText));
});

test("known titles come out plain", () => {
  for (const [a, b] of CASES) assert.equal(cleanText(a), b, a);
});

test("no codes, flight numbers, em dashes, arrows or private names survive; idempotent", () => {
  for (const [a] of CASES) {
    const c = cleanText(a);
    if (/^(https?:|\d{4}-)/.test(a)) continue;
    assert.doesNotMatch(c, /\[|\]|—|→|->|#[A-Z0-9]{5,}|\b[A-Z]{2} ?\d{3,4}\b|\bmom['’]?s?\b|Partner|Coparent/i, c);
    assert.equal(cleanText(c), c, `not idempotent: ${a}`);
    assert.deepEqual(py([c]), [c]);
  }
});

test("cal-months.py writes clean labels and keeps withDan", () => {
  /* a throwaway HOME + private dir: an empty privacy-scrub.tsv (the real one stays on the box) and the synthetic names */
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "textlaw-home-"));
  fs.mkdirSync(path.join(home, ".config/wardos"), { recursive: true });
  fs.writeFileSync(path.join(home, ".config/wardos/privacy-scrub.tsv"), "# test: no scrub rules\n");
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "textlaw-")), "cal-months.json");
  const env = { ...process.env, HOME: home, WARDOS_PRIVATE_DIR: path.join(home, "priv") };
  execFileSync("python3", [path.join(ROOT, "scripts/cal-months.py"), out, path.join(ROOT, "scripts/qa/fixtures/textlaw.events.json")], { stdio: "pipe", env });
  const days = JSON.parse(fs.readFileSync(out, "utf8")).days;
  const labels = Object.values(days).flatMap((d) => d.items.map((i) => i.l));
  for (const l of labels) assert.doesNotMatch(l, /—|→|#[A-Z0-9]{6}|\bWN ?\d|\bmom['’]?s?\b|Partner|Coparent/i, l);
  assert.ok(labels.some((l) => l.startsWith("Flight to Springfield") && l.endsWith("· 3:30") && !/XY/.test(l)), labels.join(" | "));
  assert.ok(labels.includes("Owls vs Hawks · game night · 7:00"), labels.join(" | "));
  assert.ok(labels.some((l) => l.startsWith("Kids · pickup")), labels.join(" | "));
  assert.ok(labels.some((l) => l.startsWith("Dad: Park concert")), labels.join(" | "));
  assert.ok(labels.includes("Ainsley practice · field 3 to field 5 · 9:00"), labels.join(" | "));
  const flight = days["2026-11-06"].items.find((i) => i.l.startsWith("Flight to Springfield"));
  assert.equal(flight.c, "flight", "classed on the raw title before the words change");
  const withDan = Object.fromEntries(Object.entries(days).map(([k, v]) => [k, v.withDan]));
  assert.deepEqual(withDan, { "2026-11-06": true, "2026-11-07": true, "2026-11-08": true, "2026-11-09": false, "2026-11-12": false });
});

/* SHAREDLAW2 (Atlas ruling) + PRIVNAME1 · a Dan trip with the partner is written 'Dad: <trip>' with no partner name by the
   writers, so no glass and no committed data carries it; the Dad-only page drops the 'Dad: ' prefix in the browser. */
import { createRequire } from "node:module";
const AF = createRequire(import.meta.url)(path.join(ROOT, "away-filter.js"));
test("no private name in any committed file (names live only in the private names file)", () => {
  const law = fs.readFileSync(path.join(ROOT, "scripts/text-law.json"), "utf8");
  assert.match(law, /\{PARTNER\}/); assert.match(law, /\{COPARENT\}/);
  if (!REAL_RE) return;
  /* every committed text file at HEAD (git ls-files), not a hand-picked list */
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT }).toString().split("\0").filter(Boolean);
  const hits = [];
  for (const f of files) {
    let buf; try { buf = fs.readFileSync(path.join(ROOT, f)); } catch (e) { continue; }
    if (buf.includes(0)) continue;   // binary
    if (REAL_RE.test(buf.toString("utf8"))) hits.push(f);
  }
  assert.deepEqual(hits, [], "private names in committed files: " + hits.join(", "));
});
test("writers: partner trips read 'Dad: <trip>', no partner name; Dad-only page drops the prefix", () => {
  for (const [a] of CASES) { const c = cleanText(a); if (!/^(https?:|\d{4}-)/.test(a)) assert.doesNotMatch(c, SYNTH, c); }
  assert.equal(AF.dadText("Dad: CLE weekend"), "CLE weekend");
  assert.equal(AF.dadText("<strong>Fri</strong> Dad: CLE weekend"), "<strong>Fri</strong> CLE weekend");
  assert.equal(AF.dadText("Dad trip"), "Dad trip");
  const py2 = JSON.parse(execFileSync("python3", [path.join(ROOT, "scripts/text_law.py")], { input: JSON.stringify(["Dan+Partner CLE weekend"]), env: { ...process.env } }).toString());
  assert.deepEqual(py2, ["Dad: CLE weekend"]);
});
test("writers fail closed without the private names", () => {
  const env = { ...process.env, WARDOS_NAMES: "", WARDOS_PRIVATE_NAMES: "/nonexistent/private-names.tsv", WARDOS_PRIVATE_DIR: "/nonexistent" };
  assert.throws(() => execFileSync("python3", [path.join(ROOT, "scripts/text_law.py")], { input: "[]", env, stdio: "pipe" }));
  assert.throws(() => execFileSync(process.execPath, ["-e", `import(${JSON.stringify(path.join(ROOT, "scripts/cal-from-events.mjs"))}).then(m => m.cleanText("x")).catch(e => { console.error(e.message); process.exit(3); })`], { env, stdio: "pipe" }));
});
test("only sheet-dan.html is Dad-only", () => {
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && /data-away-install/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
  const dadOnly = pages.filter((f) => /data-away-install[^>]*data-dad-only/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
  assert.deepEqual(dadOnly, ["sheet-dan.html"]);
});

/* EXTFILTER1 · external calendar rows are filtered (synthetic term "Smith"; the real terms live only in the private names
   file): matching rows drop, other matches read the placeholder. Made-up names only. */
test("cal-months.py: external calendar rows filtered", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "textlaw-ex-home-"));
  fs.mkdirSync(path.join(home, ".config/wardos"), { recursive: true });
  fs.writeFileSync(path.join(home, ".config/wardos/privacy-scrub.tsv"), "# test: no scrub rules\n");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "textlaw-ex-"));
  const pull = path.join(dir, "pull.json"), out = path.join(dir, "cal-months.json");
  fs.writeFileSync(pull, JSON.stringify({ items: [
    { id: "o1", summary: "Smith Club [RH No School]", start: { date: "2026-11-11" }, end: { date: "2026-11-12" } },
    { id: "o2", summary: "Riley Smith · antibiotics (last dose)", start: { dateTime: "2026-11-11T12:00:00-06:00" }, end: { dateTime: "2026-11-11T12:15:00-06:00" } },
    { id: "o3", summary: "Jordan Smith ortho", start: { dateTime: "2026-11-12T08:00:00-06:00" }, end: { dateTime: "2026-11-12T08:30:00-06:00" } },
    { id: "o4", summary: "Pizza at the Smiths' · 6:00", start: { dateTime: "2026-11-12T18:00:00-06:00" }, end: { dateTime: "2026-11-12T20:00:00-06:00" } },
    { id: "o5", summary: "Hayes practice", start: { dateTime: "2026-11-12T16:00:00-06:00" }, end: { dateTime: "2026-11-12T17:00:00-06:00" } },
  ] }));
  const env = { ...process.env, HOME: home, WARDOS_PRIVATE_DIR: path.join(home, "priv") };
  execFileSync("python3", [path.join(ROOT, "scripts/cal-months.py"), out, pull], { stdio: "pipe", env });
  const days = JSON.parse(fs.readFileSync(out, "utf8")).days;
  const labels = Object.values(days).flatMap((d) => d.items.map((i) => i.l));
  for (const l of labels) assert.doesNotMatch(l, /\bSmith/, l);
  assert.ok(!labels.some((l) => /antibiotic|ortho/i.test(l)), "filtered rows dropped: " + labels.join(" | "));
  assert.deepEqual(days["2026-11-11"].items.map((i) => i.l), ["Friends Club · No School"]);
  assert.ok(labels.includes("Pizza at the Friends' · 6:00"), labels.join(" | "));
  const hay = days["2026-11-12"].items.find((i) => i.l.startsWith("Hayes practice"));
  assert.equal(hay.c, "hay", "kid rows keep their key");
  /* the reclean path (box-only private file) applies the same rule to an older file */
  const priv = path.join(home, "priv"); fs.mkdirSync(priv, { recursive: true });
  fs.writeFileSync(path.join(priv, "cal-months.json"), JSON.stringify({ days: { "2026-09-09": { withDan: false, items: [
    { c: "aware", l: "Jordan Smith · antibiotics (last dose) · 12:00" }, { c: "aware", l: "Smith Club · No School" }, { c: "hay", l: "Hayes practice · 4:00" }] } } }));
  execFileSync("python3", [path.join(ROOT, "scripts/cal-months.py"), "--reclean-private"], { stdio: "pipe", env });
  const re = JSON.parse(fs.readFileSync(path.join(priv, "cal-months.json"), "utf8")).days["2026-09-09"].items.map((i) => i.l);
  assert.deepEqual(re, ["Friends Club · No School", "Hayes practice · 4:00"]);
  /* the shared helper, word for word */
  const ex = JSON.parse(execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, sys.argv[1]); from text_law import external_filter; print(json.dumps([external_filter(x) for x in json.loads(sys.argv[2])]))",
    path.join(ROOT, "scripts"), JSON.stringify(["Smith Club · 1/2 Day", "Riley Smith birthday", "The Smith group BBQ", "Pat · drop at Smith's"])], { env: process.env }).toString());
  assert.deepEqual(ex, ["Friends Club · 1/2 Day", null, "The Friends group BBQ", "Pat · drop at Friends'"]);
});

/* EXTFILTER2 · the JS writers (calendar-refresh -> kids-week, cal-from-events -> cal-live) apply the same filter as
   cal-months.py through scripts/private-dir.mjs (twin of text_law.external_filter); case-insensitive.
   Synthetic "Smith" only. */
const EX_CASES = ["Smith Club · 1/2 Day", "SMITH CLUB · No School", "smith club no school", "Riley Smith birthday", "Riley SMITH · antibiotics",
  "Smith, Riley · ortho", "The Smith group BBQ", "Pat · drop at Smith's", "Pat · drop at SMITH'S", "Pizza at the Smiths' · 6:00", "Hayes practice", "Smithson party", "Jordan Smith ortho"];
const EX_WANT = ["Friends Club · 1/2 Day", "Friends CLUB · No School", "Friends club no school", null, null, null, "The Friends group BBQ",
  "Pat · drop at Friends'", "Pat · drop at Friends'", "Pizza at the Friends' · 6:00", "Hayes practice", "Smithson party", null];
test("external filter: Python and JS twins agree word for word, case-insensitive", async () => {
  const PD = await import("../private-dir.mjs");
  assert.deepEqual(EX_CASES.map((x) => (PD.externalDrop(x) ? null : PD.externalMask(x))), EX_WANT);
  const py3 = JSON.parse(execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, sys.argv[1]); from text_law import external_filter; print(json.dumps([external_filter(x) for x in json.loads(sys.argv[2])]))",
    path.join(ROOT, "scripts"), JSON.stringify(EX_CASES)], { env: process.env }).toString());
  assert.deepEqual(py3, EX_WANT);
});
test("cal-from-events (cal-live) and calendar-refresh (kids-week) filter external calendar rows", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ex-js-"));
  const priv = path.join(dir, "priv"); fs.mkdirSync(priv, { recursive: true, mode: 0o700 });
  const ev = path.join(dir, "events.json");
  const mk = (id, summary, s, e) => ({ id, summary, start: { dateTime: s }, end: { dateTime: e } });
  fs.writeFileSync(ev, JSON.stringify({ events: [
    mk("j1", "SMITH Club · No School", "2026-10-14T08:00:00-05:00", "2026-10-14T09:00:00-05:00"),
    mk("j2", "Riley smith · antibiotics (last dose)", "2026-10-14T12:00:00-05:00", "2026-10-14T12:15:00-05:00"),
    mk("j3", "Smith, Riley · ortho", "2026-10-14T13:00:00-05:00", "2026-10-14T13:30:00-05:00"),
    mk("j4", "Pat swim · drop at smith's", "2026-10-14T16:00:00-05:00", "2026-10-14T17:00:00-05:00"),
  ] }));
  const env = { ...process.env, WARDOS_PRIVATE_DIR: priv };
  const a = spawnSync("node", [path.join(ROOT, "scripts/cal-from-events.mjs"), "--events", ev, "--out", path.join(priv, "cal-live.json")], { encoding: "utf8", env });
  assert.equal(a.status, 0, a.stderr);
  const wk = path.join(priv, "kids-week.json");
  fs.copyFileSync(path.join(ROOT, "scripts/qa/fixtures/private/kids-week.synthetic.json"), wk);
  const b = spawnSync("node", [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", ev, "--week", wk, "--now", "2026-10-14T06:40:00-05:00"], { encoding: "utf8", env });
  assert.equal(b.status, 0, b.stderr);
  for (const f of ["cal-live.json", "kids-week.json"]) {
    const t = fs.readFileSync(path.join(priv, f), "utf8");
    assert.doesNotMatch(t, /smith/i, f + " carries the term");
    assert.doesNotMatch(t, /antibiotic|ortho/i, f + " carries a filtered row");
  }
  const PD = await import("../private-dir.mjs");   /* the shared ingest step both writers call */
  assert.deepEqual(PD.externalEvents(JSON.parse(fs.readFileSync(ev, "utf8")).events).map((e) => e.summary), ["Friends Club · No School", "Pat swim · drop at Friends'"]);
});
