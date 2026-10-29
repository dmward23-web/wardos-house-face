/* FACESTRIP1 r2 (Alfred 10:26 C + 10:30 FAIL 76adad3179670dc1) · faceText drops a money sign AND the whole amount for EVERY
   calendar feed (cal-live, cal-months, kids-week), so no page writes '(bring <sign>N)' even mid-render.
   Regex approach: COPY + PARITY. The browser cannot import scripts/text-law.json (no module loader on the glass, file not
   served as a script), so house-face-law.js carries CALLIVE-NODOLLAR r3b's money and moneysign sources byte for byte (flags "",
   no \b, boundaries are (?![A-Za-z0-9_])). r2 drops the FACESTRIP1 local EDGE rule: r3b's law covers '613 <sign>' / '613<sign>5'.
   This test reads r3b's text-law.json and asserts identical strings, identical matches, and byte-equal output against the
   python3 cal-months-window.py (_nodollar) and cal-from-events.mjs (noDollarDeep) writers of an r3b tree.
   r3b source: FS_R3B_TEXT_LAW, else scripts/text-law.json once it carries the r3b rules, else the r3b staging copy.
   r3b writers: FS_R3B_TREE (a tree whose scripts/ hold r3b cal-months-window.py, cal-from-events.mjs, text-law.json), else the
   r3b sandbox b79 tree. node --test scripts/qa/facestrip1.test.mjs (no browser). Signs are written as code points. */
import { assertSealed } from "./temp-home.mjs";
import { ciOnlySkip } from "./ci-only-skip.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const S = String.fromCharCode(36), FW = "\uFF04", SM = "\uFE69";
assertSealed();

/* r3b text-law: pinned by the sha256 of each rule source (the file sha moves when r3b lands with other rules) */
/* FACESTRIP1 r3 (Alfred 11:21 CT FAIL 0cb4c11b): the law is CALLIVE-NODOLLAR r3c (text-law 03d916de); names below keep their r2 spelling */
const R3B_STAGE = "/workspace/wright-scratch/callive-nodollar-r3c/text-law.json.new";   /* sha256 03d916de... (r3c) */
const R3B_TREE = process.env.FS_R3C_TREE || process.env.FS_R3B_TREE || "/workspace/wright-scratch/callive-nodollar-r3c/sbx/trees/b79-r3c";
const MONEY_SHA16 = "b18bbaa30dd4eac3";   /* sha256 of the rule source, first 16 */
const SIGN_SHA16 = "d75796359943f86a";
function r3bLaw() {
  const cands = [process.env.FS_R3B_TEXT_LAW, path.join(ROOT, "scripts/text-law.json"), R3B_STAGE].filter(Boolean);
  for (const f of cands) {
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, "utf8")), m = (d.rules || []).find((r) => r.id === "money"), g = (d.rules || []).find((r) => r.id === "moneysign");
    if (m && g && sha(m.re).slice(0, 16) === MONEY_SHA16) return { file: f, fileSha: sha(fs.readFileSync(f)), money: m, sign: g };
  }
  return null;
}
const R3 = r3bLaw();
/* TESTFIX1 · the r3c law lives only in the box staging copy (private); the GitHub runner has none, so these 3 parity tests
   skip THERE only. On the box a missing law still fails them (ciOnlySkip returns false off the runner). */
const R3_CI_SKIP = ciOnlySkip("FACESTRIP1", !R3, "private r3c text-law.json (box staging copy) is not on the runner; the box gate runs these 3 parity tests");

function loadLaw(opts = {}) {
  const box = {}; box.window = box;
  if (opts.noLookbehind) { const R = RegExp; box.RegExp = function (src, fl) { if (/\(\?<[!=]/.test(String(src))) throw new SyntaxError("no lookbehind"); return new R(src, fl); }; }
  vm.createContext(box); vm.runInContext(read("house-face-law.js"), box, { filename: "house-face-law.js" });
  return box.HouseFaceLaw;
}
const L = loadLaw();

test("FACESTRIP1 r2 parity: house-face-law.js money + sign sources are r3b's text-law.json strings, byte for byte, flags \"\"", { skip: R3_CI_SKIP }, () => {
  assert.ok(R3, "r3b text-law.json with the r3b money / moneysign rules is readable");
  assert.equal(sha(R3.money.re).slice(0, 16), MONEY_SHA16, "r3b money rule");
  assert.equal(sha(R3.sign.re).slice(0, 16), SIGN_SHA16, "r3b moneysign rule");
  if (R3.file === R3B_STAGE) assert.equal(R3.fileSha.slice(0, 16), "03d916def7ed8572", "staging copy is r3c 03d916de");
  assert.equal(typeof L.MONEY_SRC, "string", "HouseFaceLaw.MONEY_SRC exported");
  assert.equal(L.MONEY_SRC, R3.money.re, "money source identical");
  assert.equal(L.SIGN_SRC, R3.sign.re, "moneysign source identical");
  assert.equal(Buffer.compare(Buffer.from(L.MONEY_SRC), Buffer.from(R3.money.re)), 0, "byte compare money");
  assert.equal(Buffer.compare(Buffer.from(L.SIGN_SRC), Buffer.from(R3.sign.re)), 0, "byte compare moneysign");
  assert.equal(R3.money.flags, ""); assert.equal(R3.sign.flags || "", ""); assert.equal(R3.money.global, true); assert.equal(R3.sign.global, true);
  assert.equal(L.MONEY_RE.source, new RegExp(R3.money.re, "g").source, "the compiled browser pattern is r3b compiled");
  assert.equal(L.MONEY_RE.flags, "g", "flags: r3b \"\" + global (no i)"); assert.equal(L.SIGN_RE.flags, "g");
  for (const src of [L.MONEY_SRC, L.SIGN_SRC]) { assert.ok(!src.includes("\\b"), "no \\b in the law"); assert.ok(!/\\s/.test(src), "no \\s in the law"); }
  assert.equal(L.MONEY_LB_OK, true, "native lookbehind in node");
});
test("FACESTRIP1 r2: the local EDGE rule is gone (r3b covers its forms); moneyFree is r3b money, r3b moneysign, tidy only", () => {
  const src = read("house-face-law.js");
  assert.ok(!("EDGE_SRC" in L), "EDGE_SRC not exported");
  assert.doesNotMatch(src, /EDGE_SRC|EDGE_RE|\bEDGE\b/, "no EDGE in house-face-law.js");
  const m = src.match(/function moneyFree\(t\) \{[\s\S]*?\n  \}/); assert.ok(m, "moneyFree found");
  assert.equal((m[0].match(/\.replace\(/g) || []).length, 8, "money + sign (native or fallback arm: 2 x 2) + 4 tidy replaces, nothing else");
  assert.match(m[0], /\.replace\(\/\\\(\\s\+\/g, "\("\)\.replace\(\/\\s\+\\\)\/g, "\)"\)\.replace\(\/\\s\*\\\(\\\)\/g, ""\)\.replace\(\/\\s\{2,\}\/g, " "\)\.trim\(\)/, "tidy is the writers' tidy (cal-from-events noDollarText), byte for byte");
  assert.match(m[0], /t\.replace\(MONEY_RE, /); assert.match(m[0], /u\.replace\(SIGN_RE, /);
});

/* fixtures: [input, faceText on the tip]. Alfred 10:10 forms, the 10:30 defect-1 trailing signs and defect-2 USD / US forms,
   context rows, then near-misses and the defect-2 controls (unchanged). */
const MONEY = [
  [S + "5", ""], [FW + "5", ""], [SM + "5", ""], ["613" + S + "5", ""], ["613 " + S, ""], [S + "1,256", ""], [S + ".77", ""], [S + " 193", ""],
  [S + "5k", ""], [S + "2.5m", ""], ["-" + S + "5", ""], [S + "5-" + S + "10", ""], [S + "5/hr sitter", "sitter"], [S + "5 per week", ""], ["613" + S, ""],
  ["613 " + S + "5", ""], ["613 " + FW, ""], ["1,256 " + S, ""],
  ["USD 50", ""], ["50 USD", ""], ["US" + S + "50", ""], ["USD" + S + "50", ""], ["usd 50", ""], ["US" + FW + "50", ""],
  ["Fee USD 50 due", "Fee due"], ["Trip 47 USD", "Trip"], ["Club US" + S + "48 now", "Club now"], ["Gate USD" + S + "49", "Gate"],
  ["Field trip (bring " + S + "5)", "Field trip (bring)"], ["Book fair " + S + "1,256", "Book fair"], ["Snack " + S + ".77 each", "Snack each"],
  ["Fee " + S + " 193 due", "Fee due"], ["Cards 613" + S + "5 swap", "Cards swap"], ["Gift jar 613 " + S, "Gift jar"], ["Fair " + FW + "5 ride", "Fair ride"],
  ["Bake " + SM + "5 sale", "Bake sale"], ["Bus " + S + "5k raffle", "Bus raffle"], ["Gala " + S + "2.5m goal", "Gala goal"], ["Fees " + S + "1,256.50 due", "Fees due"],
  ["Lego set " + S + "45", "Lego set"], ["Lunch (" + S + "3.25)", "Lunch"], ["Photo day, " + S + "12", "Photo day"], ["Dues " + FW + "1,256", "Dues"],
  ["Jar 1,256 " + S + " goal", "Jar goal"], ["Cards 613 " + S + "5 swap", "Cards swap"],
  /* r3c (Alfred 0cb4c11b): D2k USD glued to digits, A16 sign-minus, A4/A5 zero-width spacing, D2i 'US <sign>50' */
  ["USD50", ""], ["usd50", ""], ["USD5.00", ""], ["Fee USD50 due", "Fee due"], ["Fees usd1,256.50 now", "Fees now"],
  [S + "-5", ""], ["USD-50", ""], [S + "\u22125", ""], ["Fee USD \u2212 50 due", "Fee due"], [FW + "-5", ""],
  [S + "\u200b5", ""], ["5\u200b" + S, ""], [S + "\u20605", ""], [S + "\u00ad5", ""], [S + "\u200c5", ""], [S + "\u200d5", ""], ["Fee " + S + "\u200b1,256 due", "Fee due"], ["Jar 613\u2060" + S + " goal", "Jar goal"],
  ["US " + S + "50", ""], ["Fee US " + S + "50 due", "Fee due"],
];
const KEEP = ["5km run", "Room 5m", "3:15 pm", "Leave 7:40", "2026-10-28", "Oct 28", "10/28", "Grade 2", "2nd grade", "Hayes 2nd", "Room 213", "Age 7",
  "Ages 5-7", "1-2 pm", "Gate B12", "Bus 14", "Game 2 of 3", "Swim 4:30-5:15", "USB 50", "BUS 5", "Focus 5", "Focus 5 USB 50 BUS 5", "Join us 5", "US 5",
  /* r3c controls */ "USDT 50", "USDT50", "USDA 5 lunch", "US History", "BUSD 5", "a - 5"];
/* accent rows (defect 3: no \b): letters after k / m and before US / USD; JS and Python must be byte-equal */
const ACCENT = [S + "5k\u00e9", S + "5k\u00f6", S + "5m\u00f1", S + "5km", S + "5kid", S + "5 km", S + "5k_", S + "5k1", "\u00e9USD 50", "caf\u00e9 " + S + "5 \u00e0 midi",
  "Na\u00efve USD 9", "R\u00e9sum\u00e9 50 USD", "\u00fcber US" + S + "5k", "Fee " + S + "5M\u00e9", S + "5\u212A"];
/* accepted over-strip class (10:30 ruling): a number right before a trailing sign is read as the amount */
const OVERSTRIP = [["Room 214 " + S + "5", "Room"], ["USB 50 USD 9", "USB"]];
const ALL = MONEY.map((m) => m[0]).concat(KEEP, ACCENT, OVERSTRIP.map((m) => m[0]));

for (const [x, want] of MONEY) test("FACESTRIP1 fixture money: " + JSON.stringify(x) + " reads " + JSON.stringify(want), () => {
  const got = L.faceText(x);
  assert.equal(got, want);
  assert.doesNotMatch(String(got), /[\x24\uFF04\uFE69]|(?<![A-Za-z])[uU][sS][dD]?(?![A-Za-z])/, "no sign, no US / USD left");
  assert.doesNotMatch(String(got), /[0-9\u200b-\u200d\u2060\u00ad\u2212]/, "r3c: no digit, minus or zero-width char left");
});
for (const x of KEEP) test("FACESTRIP1 fixture near-miss kept: " + JSON.stringify(x), () => {
  assert.equal(L.moneyFree(x), x, "moneyFree leaves it alone");
  assert.equal(L.faceText(x), x, "faceText leaves it alone");
});
for (const [x, want] of OVERSTRIP) test("FACESTRIP1 accepted over-strip: " + JSON.stringify(x) + " reads " + JSON.stringify(want), () => assert.equal(L.moneyFree(x), want));
/* pinned: the k / m suffix is eaten only when no ASCII word char follows ((?![A-Za-z0-9_])), so a non-ASCII letter after it stays
   on its own ('\u00e9'), 'km' / 'kid' / 'k_' / 'k1' keep their letters (the amount still goes); a non-ASCII letter before USD
   does not shield it. Python gives the same bytes (asserted below). */
const ACCENT_WANT = ["\u00e9", "\u00f6", "\u00f1", "km", "kid", "km", "k_", "k1", "\u00e9", "caf\u00e9 \u00e0 midi", "Na\u00efve", "R\u00e9sum\u00e9", "\u00fcber", "Fee \u00e9", ""];
test("FACESTRIP1 accent rows: amount, sign and US / USD gone; pinned output on all " + ACCENT.length, () => {
  assert.equal(ACCENT_WANT.length, ACCENT.length);
  ACCENT.forEach((x, i) => { assert.equal(L.moneyFree(x), ACCENT_WANT[i], x); assert.doesNotMatch(L.moneyFree(x), /[\x24\uFF04\uFE69]|USD?/, x); });
});

test("FACESTRIP1 parity: the browser pattern and r3b's pattern give identical matches on all " + ALL.length + " fixtures", { skip: R3_CI_SKIP }, () => {
  assert.ok(R3);
  const r3 = new RegExp(R3.money.re, "g"), sg = new RegExp(R3.sign.re, "g");
  assert.ok(ALL.length >= 80, "80+ fixtures: " + ALL.length);
  for (const x of ALL) {
    const a = [...x.matchAll(L.MONEY_RE)].map((m) => [m.index, m[0]]), b = [...x.matchAll(r3)].map((m) => [m.index, m[0]]);
    assert.deepEqual(a, b, "same matches on " + JSON.stringify(x));
    assert.equal(x.replace(L.MONEY_RE, "").replace(L.SIGN_RE, ""), x.replace(r3, "").replace(sg, ""), "same r3b result on " + JSON.stringify(x));
  }
});

/* defect 3: no \b, so JS and Python agree byte for byte on every fixture, accent rows included (r3's JS/Python k/m split is gone) */
const PY = spawnSync("python3", ["-c", "1"]).status === 0;
test("FACESTRIP1 r2: r3b law is byte-equal in JS and Python on every fixture (accent rows included)", { skip: R3_CI_SKIP || (PY ? false : "SKIP no python3") }, () => {
  const py = spawnSync("python3", ["-c", "import json,re,sys\nd=json.load(sys.stdin)\nm=re.compile(d['m']);g=re.compile(d['g'])\nprint(json.dumps([g.sub('',m.sub('',x)) for x in d['xs']]))"],
    { input: JSON.stringify({ m: R3.money.re, g: R3.sign.re, xs: ALL }), encoding: "utf8" });
  assert.equal(py.status, 0, py.stderr);
  const P = JSON.parse(py.stdout), r3 = new RegExp(R3.money.re, "g"), sg = new RegExp(R3.sign.re, "g"), diff = [];
  ALL.forEach((x, i) => { const j = x.replace(r3, "").replace(sg, ""); if (Buffer.compare(Buffer.from(j), Buffer.from(P[i]))) diff.push([x, j, P[i]]); });
  assert.deepEqual(diff, [], "JS vs Python split: " + JSON.stringify(diff));
});

/* parity with the r3b writers: browser moneyFree vs python3 cal-months-window.py _nodollar and cal-from-events.mjs noDollarDeep */
const TREE_OK = PY && fs.existsSync(path.join(R3B_TREE, "scripts/cal-months-window.py")) && fs.existsSync(path.join(R3B_TREE, "scripts/cal-from-events.mjs"));
function writers(xs) {
  const env = { ...process.env, WARDOS_NAMES: "partner=Qqpartner;coparent=Qqcoparent;external=Zzfixture;school=ZZS", WARDOS_TEXT_LAW_PRIVATE: "/nonexistent/text-law.private.json", PYTHONDONTWRITEBYTECODE: "1" };
  const py = spawnSync("python3", ["-c", [
    "import json,os,sys,importlib.util", "D=sys.argv[1]; sys.dont_write_bytecode=True; sys.path.insert(0, os.path.join(D,'scripts'))",
    "sp=importlib.util.spec_from_file_location('cmw', os.path.join(D,'scripts','cal-months-window.py')); m=importlib.util.module_from_spec(sp); sp.loader.exec_module(m)",
    "xs=json.load(sys.stdin); print(json.dumps({'law': open(os.path.join(D,'scripts','text-law.json'),'rb').read().hex(), 'out': [m._nodollar({'l': x})['l'] for x in xs]}))"].join("\n"), R3B_TREE],
    { input: JSON.stringify(xs), encoding: "utf8", env });
  assert.equal(py.status, 0, "cmw: " + py.stderr);
  const js = spawnSync(process.execPath, ["--input-type=module", "-e",
    "const C = await import(process.env.FS_CFE); let s = ''; for await (const c of process.stdin) s += c; process.stdout.write(JSON.stringify({ src: C.MONEY_SRC, sign: C.MONEY_SIGN_SRC, out: JSON.parse(s).map((x) => C.noDollarDeep({ summary: x }).summary) }));",
    ], { input: JSON.stringify(xs), encoding: "utf8", env: { ...env, FS_CFE: path.join(R3B_TREE, "scripts/cal-from-events.mjs") } });
  assert.equal(js.status, 0, "cfe: " + js.stderr);
  const p = JSON.parse(py.stdout), j = JSON.parse(js.stdout);
  return { lawSha: sha(Buffer.from(p.law, "hex")), cmw: p.out, cfe: j.out, cfeSrc: j.src, cfeSign: j.sign };
}
test("FACESTRIP1 r2 parity: browser moneyFree === python3 cal-months-window _nodollar === cal-from-events noDollarDeep, byte for byte", { skip: TREE_OK ? false : (ciOnlySkip("FACESTRIP1-r2-parity", true, "the r3b worktree is a box-only scratch tree, never on the runner") || "SKIP no r3b tree / python3 (" + R3B_TREE + ")") }, () => {
  const W = writers(ALL), diff = [];
  assert.equal(W.lawSha.slice(0, 16), "03d916def7ed8572", "the writers' tree carries r3c text-law.json 03d916de");
  assert.equal(W.cfeSrc, L.MONEY_SRC, "cfe MONEY_SRC is the browser source"); assert.equal(W.cfeSign, L.SIGN_SRC, "cfe MONEY_SIGN_SRC is the browser source");
  ALL.forEach((x, i) => { const b = L.moneyFree(x);
    if (Buffer.compare(Buffer.from(b), Buffer.from(W.cmw[i])) || Buffer.compare(Buffer.from(b), Buffer.from(W.cfe[i]))) diff.push({ x, browser: b, cmw: W.cmw[i], cfe: W.cfe[i] }); });
  assert.deepEqual(diff, [], "three-way split");
});

test("FACESTRIP1 no-lookbehind engines (Safari < 16.4): the capture fallback gives the same result on every fixture", () => {
  const F = loadLaw({ noLookbehind: true });
  assert.equal(F.MONEY_LB_OK, false, "fallback path taken");
  assert.doesNotMatch(F.MONEY_RE.source + F.SIGN_RE.source, /\(\?<[!=]/, "fallback patterns hold no lookbehind");
  for (const [a] of F.MONEY_LB_FALLBACK) assert.ok(L.MONEY_SRC.includes(a) || L.SIGN_SRC.includes(a), "every fallback pair maps a lookbehind that is in the law: " + a);
  const lbs = (L.MONEY_SRC + L.SIGN_SRC).match(/\(\?<[!=](?:[^()\\]|\\.|\[(?:[^\]\\]|\\.)*\])*\)/g) || [];
  for (const lb of lbs) assert.ok(F.MONEY_LB_FALLBACK.some(([a]) => a.includes(lb)), "every lookbehind in the law has a fallback: " + lb);
  for (const x of ALL) { assert.equal(F.moneyFree(x), L.moneyFree(x), "moneyFree " + JSON.stringify(x)); assert.equal(F.faceText(x), L.faceText(x), "faceText " + JSON.stringify(x)); }
  for (const x of KEEP) assert.equal(F.faceText(x), x, x);
});

test("FACESTRIP1 unit: cleanFeed strips money from every calendar feed's text, leaves ids / times / urls alone", () => {
  const live = L.cleanFeed("cal-live", { upcomingLeaves: [{ id: "a" + S + "1", summary: "Field trip (bring " + S + "5)", location: "Book fair " + S + "1,256, Main", start: "2026-10-29T09:00:00-05:00", end: "2026-10-29T10:00:00-05:00" }],
    nextLeave: { summary: "Gift jar 613 " + S, what: "Fair " + FW + "5 ride" }, boardStrip: { queue: [{ what: "Bake " + SM + "5 sale", hint: "Gala " + S + "2.5m goal" }] } });
  const months = L.cleanFeed("cal-months", { days: { "2026-10-01": { withDan: true, items: [{ c: "shr", l: "Snack " + S + ".77 each" }, { c: "hay", l: "Fee " + S + " 193 due" }, { c: "har", l: "5km run" }] } } });
  const kids = L.cleanFeed("kids-week", { kids: { hayes: { today: [{ what: "Cards 613" + S + "5 swap", when: "3:15 pm" }], bankGoal: { title: "Lego set " + S + "45", blurb: "1 \u2605 = " + S + "1 \u00b7 " + S + "45 goal", need: 45 } },
    ainsley: { today: [{ what: "Bus " + S + "5k raffle" }] } } });
  for (const [n, d] of [["cal-live", live], ["cal-months", months], ["kids-week", kids]]) {
    const txt = JSON.stringify(d, (k, v) => (k === "id" || k === "start" || k === "end" ? undefined : v));
    assert.doesNotMatch(txt, /[\x24\uFF04\uFE69]/, n + " no sign: " + txt);
    assert.doesNotMatch(txt, /1,256|\.77|193|613|2\.5m|5k\b/, n + " no amount: " + txt);
  }
  assert.equal(live.upcomingLeaves[0].summary, "Field trip (bring)");
  assert.equal(live.upcomingLeaves[0].location, "Book fair , Main", "r2: the writers' tidy (no space-comma fold), same bytes as cal-from-events / cal-months-window");
  assert.equal(live.upcomingLeaves[0].id, "a" + S + "1", "ids are never touched (SKIP_KEY)");
  assert.equal(live.upcomingLeaves[0].start, "2026-10-29T09:00:00-05:00");
  assert.equal(JSON.stringify(months.days["2026-10-01"].items.map((i) => i.l)), JSON.stringify(["Snack each", "Fee due", "5km run"]));
  assert.equal(kids.kids.hayes.today[0].what, "Cards swap"); assert.equal(kids.kids.hayes.today[0].when, "3:15 pm");
  assert.equal(kids.kids.hayes.bankGoal.title, "Lego set"); assert.equal(kids.kids.hayes.bankGoal.need, 45, "numbers that are not text stay");
  assert.equal(L.faceText(S + "45"), "", "a money-only string reads empty (the old fallback handed the original back)");
});

/* Static no-bypass: every calendar-text path to DOM, storage or transient state goes through faceText first. */
const TEXT_KEYS = ["summary", "location", "l", "title", "what", "hint", "label", "blurb", "text", "where", "when"];
test("FACESTRIP1 static: the law runs on every feed payload before any page sees it, and money feeds never touch storage", () => {
  const law = read("house-face-law.js"), pf = read("private-feed.js");
  assert.match(law, /function faceText\(s\) \{\n[^\n]*\n\s*s = moneyFree\(s\); if \(!s\) return s;/, "faceText money-frees first, for every string");
  assert.match(law, /if \(typeof v === "string" && !\(key && SKIP_KEY\.test\(key\)\)\) return isCustody\(v\) \? "" : faceText\(v\);/, "cleanFeed walk hands every text string to faceText");
  const skip = new RegExp(law.match(/var SKIP_KEY = \/(.*)\/;/)[1]);
  for (const k of TEXT_KEYS) assert.ok(!skip.test(k), "text key " + k + " is not skipped");
  assert.match(pf, /var LAW_FEEDS = \{ "cal-live": 1, "cal-months": 1, "kids-week": 1 \};/);
  assert.match(pf, /var MONEY_FEEDS = \{ "kids-week": 1, "cal-live": 1, "cal-months": 1 \};/);
  assert.match(pf, /\.then\(function \(res\) \{ if \(res && res\.data\) res\.data = law\(name, res\.data\); return res; \}\)/, "getJSON applies the law to live and cached data");
  assert.match(pf, /if \(!noCache\(name\)\) lsSet\(cacheKey/, "money feeds are never stored");
  const lsSets = pf.match(/lsSet\(/g).length; assert.equal(lsSets, 3, "lsSet call sites unchanged (proxy token + school names + the noCache-guarded feed cache)");
});
const SINKS = /\.innerHTML\s*[+]?=|\.outerHTML\s*=|\.textContent\s*=|\.innerText\s*=|\.nodeValue\s*=|insertAdjacentHTML\(|setAttribute\(|setItem\(|document\.write|\bhtml\s*\+?=/;
function inlineScript(f, marker) { const s = read(f), i = s.indexOf(marker); assert.ok(i >= 0, f + " has " + marker); return s.slice(i, s.indexOf("</script>", i)); }
function stripCalls(code, names) {   /* drop every balanced call to a sanitizer, so what is left is raw */
  const re = new RegExp("\\b(?:" + names.join("|") + ")\\(", "g"); let out = "", i = 0, m;
  while ((m = re.exec(code))) { if (m.index < i) continue; out += code.slice(i, m.index) + "SAFE"; let d = 0, j = m.index + m[0].length - 1;
    for (; j < code.length; j++) { if (code[j] === "(") d++; else if (code[j] === ")") { d--; if (!d) break; } } i = j + 1; re.lastIndex = i; }
  return out + code.slice(i);
}
for (const [f, marker, sanit] of [["month.html", "MONTHS1 · month view", ["esc", "cleanCal", "plainWords"]], ["sheet-load-day.html", "LOADLIVE1", ["e"]]]) {
  test("FACESTRIP1 static: " + f + " writes calendar text only through " + sanit.join(" / ") + ", and each money-frees", () => {
    const code = inlineScript(f, marker);
    const def = (n) => { const m = code.match(new RegExp("function " + n + "\\s*\\((\\w+)\\)\\s*\\{?([^\\n]*)")); assert.ok(m, f + " defines " + n); return m[2]; };
    const head = sanit[sanit.length - 1] === "e" ? def("e") : def("esc");
    assert.match(head, f === "month.html" ? /^\s*s = money\(s\);/ : /^var L=window\.HouseFaceLaw;if\(L&&L\.moneyFree\)t=L\.moneyFree\(/, f + " escape money-frees first, before it writes");
    if (f === "month.html") assert.match(code, /function money\(s\) \{[^\n]*L\.moneyFree\(String\(s == null \? "" : s\)\)/, "money() is HouseFaceLaw.moneyFree");
    if (f === "month.html") { assert.match(code, /function cleanCal\(s\) \{\n\s*s = String\(money\(s\) \|\| ""\);/, "cleanCal money-frees"); assert.match(code, /function plainWords\(s\) \{\n\s*s = cleanCal\(s\);/, "plainWords goes through cleanCal"); }
    /* taint: calendar fields (it.l, ev.summary, x.summary, x.location, ...) and every local assigned from one on the same line;
       a write sink may carry them only inside a sanitizer call (stripCalls swaps those for SAFE) */
    const FIELD = /\b(?:it|ev|x|item|row|rows\[\d+\]|chip)\.(?:summary|location|l|label|title|what|hint|where)\b(?!\s*=[^=])/;
    const raw = stripCalls(code, sanit).replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, '""'), taint = new Set(); let grew = true;
    const used = (rhs) => FIELD.test(rhs) || [...taint].some((t) => new RegExp("(^|[^.\\w])" + t + "\\b(?!\\s*:)").test(rhs));
    while (grew) { grew = false; for (const m of raw.matchAll(/(?:^|[;{(\s,])(?:var\s+)?([A-Za-z_]\w*)\s*=(?!=)([^;\n]*)/g)) {
      if (!taint.has(m[1]) && !/^(html|rows|chips|counts|shown2)$/.test(m[1]) && used(m[2].split(/,\s*[A-Za-z_]\w*\s*=(?!=)/)[0])) { taint.add(m[1]); grew = true; } } }
    const bad = [];
    raw.split("\n").forEach((ln, i) => { for (const part of ln.split(";")) { if (!SINKS.test(part)) continue;
      const rhs = part.replace(/^[\s\S]*?(?:\.innerHTML|\.textContent|\.innerText|\bhtml)\s*\+?=/, "").replace(/\.(?:min|c|start|end|length)\b/g, "");
      if (used(rhs)) bad.push((i + 1) + ": " + part.trim().slice(0, 140)); } });
    assert.deepEqual(bad, [], f + " raw calendar text at a write sink");
  });
}
test("FACESTRIP1 static: every page that reads a calendar feed loads private-feed.js (the law wrapper) and house-face-law.js", () => {
  const CONSUMERS = /data\/(?:cal-live|cal-months|kids-week)\.json|["'](?:cal-live|cal-months|kids-week)["']/;
  const js = fs.readdirSync(ROOT).filter((f) => f.endsWith(".js")).concat(fs.readdirSync(path.join(ROOT, "livinghouse")).filter((f) => f.endsWith(".js")).map((f) => "livinghouse/" + f))
    .filter((f) => f !== "private-feed.js" && f !== "house-face-law.js" && CONSUMERS.test(read(f)));
  const SKIPD = /^(scripts|tests?|plates|plates-receipt|vendor|node_modules|\.git)$/, pages = [];
  (function walk(d) { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = d ? d + "/" + e.name : e.name; if (e.isDirectory()) { if (!SKIPD.test(e.name)) walk(p); } else if (e.name.endsWith(".html")) pages.push(p); } })("");
  const bad = []; let n = 0;
  for (const p of pages) {
    const s = read(p), loads = js.filter((f) => s.includes(path.basename(f) + "?") || s.includes(path.basename(f) + '"'));
    if (!CONSUMERS.test(s.replace(/<script src[^>]*>/g, "")) && !loads.length) continue; n++;
    if (!/private-feed\.js/.test(s) || !/house-face-law\.js\?v=FACESTRIP1/.test(s)) bad.push(p + " (" + loads.join(",") + ")");
  }
  assert.ok(n >= 15, "consumer pages found: " + n);
  assert.deepEqual(bad, []);
});
test("FACESTRIP1 static: house-face-law.js is re-tokened FACESTRIP1 on every page that loads it", () => {
  const SKIPD = /^(scripts|tests?|plates|plates-receipt|vendor|node_modules|\.git)$/, hits = [], old = []; let n = 0;
  (function walk(d) { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = d ? d + "/" + e.name : e.name; if (e.isDirectory()) { if (!SKIPD.test(e.name)) walk(p); }
    else if (e.name.endsWith(".html")) for (const m of read(p).matchAll(/house-face-law\.js(\?v=[A-Za-z0-9_.-]+)?["']/g)) { n++; if (m[1] !== "?v=FACESTRIP1") old.push(p + " " + (m[1] || "(no token)")); } } })("");
  assert.ok(n >= 47, "tags found " + n); assert.deepEqual(old, []);
});

/* FACESTRIP1 r3 · collision rule (Alfred 0cb4c11b): SPECIALSLAW1 lands first and moves house-face-law.js f5fccfc5 -> 9a84948c on the
   same tracked path, so this second lander carries SPECIALSLAW1's three hunks (isSpecialText / isSpecialRow at :83, cleanKid skip, exports). */
test("FACESTRIP1 r3: house-face-law.js carries SPECIALSLAW1's isSpecialText / isSpecialRow (second lander keeps both)", () => {
  const src = read("house-face-law.js");
  assert.equal((src.match(/function isSpecialRow\(r\)/g) || []).length, 1, "isSpecialRow defined once");
  assert.equal((src.match(/function isSpecialText\(s, schoolAlt\)/g) || []).length, 1, "isSpecialText defined once");
  assert.match(src, /r\.kind !== "note" && !isSpecialRow\(r\) &&/, "cleanKid skips special rows");
  assert.equal(L.isSpecialText("Hayes \u2014 ZZS specials: Art"), true); assert.equal(L.isSpecialText("ZZS No Specials"), false);
  assert.equal(L.isSpecialText("Hayes \u2014 ZZS specials: Art", "ZZS"), true); assert.equal(L.isSpecialRow({ kind: "special" }), true);
  assert.equal(L.isSpecialRow({ what: "Hayes swim" }), false);
});
