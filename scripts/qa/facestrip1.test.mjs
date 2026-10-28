/* FACESTRIP1 (Alfred D2 P2, Atlas 2026-10-28 10:09, Alfred 10:10) · faceText drops a money sign AND the whole amount for EVERY
   calendar feed (cal-live, cal-months, kids-week), so no page writes '(bring <sign>N)' even mid-render.
   Regex approach: COPY + PARITY. The browser cannot import scripts/text-law.json (no module loader on the glass, file not
   served as a script), so house-face-law.js carries CALLIVE-NODOLLAR r3's money and moneysign sources byte for byte and this
   test reads r3's text-law.json and asserts the strings are identical and give identical matches.
   r3 source: FS_R3_TEXT_LAW, else scripts/text-law.json once it carries the r3 "money" rule, else the r3 staging copy.
   node --test scripts/qa/facestrip1.test.mjs (no browser). Signs are written as code points: this file holds no literal sign. */
import { assertSealed } from "./temp-home.mjs";
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

/* r3 text-law: pinned by the sha256 of each rule source (the file sha moves when r3 lands with other rules) */
const R3_STAGE = "/workspace/wright-scratch/callive-nodollar-r3/text-law.json.new";   /* sha256 0f7743fe9372d705... */
const MONEY_SHA16 = "7df5e9ede8ec9e42";   /* sha256 of the rule source, first 16 */
const SIGN_SHA16 = "c64912fce7ddae86";
function r3Law() {
  const cands = [process.env.FS_R3_TEXT_LAW, path.join(ROOT, "scripts/text-law.json"), R3_STAGE].filter(Boolean);
  for (const f of cands) {
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, "utf8")), m = (d.rules || []).find((r) => r.id === "money"), g = (d.rules || []).find((r) => r.id === "moneysign");
    if (m && g) return { file: f, fileSha: sha(fs.readFileSync(f)), money: m, sign: g };
  }
  return null;
}
const R3 = r3Law();

function loadLaw(opts = {}) {
  const box = {}; box.window = box;
  if (opts.noLookbehind) { const R = RegExp; box.RegExp = function (src, fl) { if (/\(\?<[!=]/.test(String(src))) throw new SyntaxError("no lookbehind"); return new R(src, fl); }; }
  vm.createContext(box); vm.runInContext(read("house-face-law.js"), box, { filename: "house-face-law.js" });
  return box.HouseFaceLaw;
}
const L = loadLaw();

test("FACESTRIP1 parity: house-face-law.js money + sign sources are r3's text-law.json strings, byte for byte", () => {
  assert.ok(R3, "r3 text-law.json with the money / moneysign rules is readable");
  assert.equal(sha(R3.money.re).slice(0, 16), MONEY_SHA16, "r3 money rule is the 0f7743fe one");
  assert.equal(sha(R3.sign.re).slice(0, 16), SIGN_SHA16, "r3 moneysign rule is the 0f7743fe one");
  if (R3.file === R3_STAGE) assert.equal(R3.fileSha.slice(0, 16), "0f7743fe9372d705", "staging copy is r3 0f7743fe");
  assert.equal(typeof L.MONEY_SRC, "string", "HouseFaceLaw.MONEY_SRC exported");
  assert.equal(L.MONEY_SRC, R3.money.re, "money source identical");
  assert.equal(L.SIGN_SRC, R3.sign.re, "moneysign source identical");
  assert.equal(Buffer.compare(Buffer.from(L.MONEY_SRC), Buffer.from(R3.money.re)), 0, "byte compare");
  assert.equal(L.MONEY_RE.source, new RegExp(R3.money.re, "gi").source, "the compiled browser pattern is r3 compiled (source escapes the slash)");
  assert.equal(L.MONEY_RE.flags, "gi", "flags: r3 i + global");
  assert.equal(R3.money.flags, "i"); assert.equal(R3.money.global, true); assert.equal(R3.sign.global, true);
  assert.equal(L.MONEY_LB_OK, true, "native lookbehind in node");
});

/* fixtures: [input, faceText on the tip]. Alfred 10:10 forms first, then context rows, then near-misses (unchanged). */
const MONEY = [
  [S + "5", ""], [FW + "5", ""], [SM + "5", ""], ["613" + S + "5", ""], ["613 " + S, ""], [S + "1,256", ""], [S + ".77", ""], [S + " 193", ""],
  [S + "5k", ""], [S + "2.5m", ""], ["-" + S + "5", ""], [S + "5-" + S + "10", ""], [S + "5/hr sitter", "sitter"], [S + "5 per week", ""], ["613" + S, ""],
  ["Field trip (bring " + S + "5)", "Field trip (bring)"], ["Book fair " + S + "1,256", "Book fair"], ["Snack " + S + ".77 each", "Snack each"],
  ["Fee " + S + " 193 due", "Fee due"], ["Cards 613" + S + "5 swap", "Cards swap"], ["Gift jar 613 " + S, "Gift jar"], ["Fair " + FW + "5 ride", "Fair ride"],
  ["Bake " + SM + "5 sale", "Bake sale"], ["Bus " + S + "5k raffle", "Bus raffle"], ["Gala " + S + "2.5m goal", "Gala goal"], ["Fees " + S + "1,256.50 due", "Fees due"],
  ["Lego set " + S + "45", "Lego set"], ["Lunch (" + S + "3.25)", "Lunch"], ["Photo day, " + S + "12", "Photo day"], ["Dues " + FW + "1,256", "Dues"],
];
const KEEP = ["5km run", "Room 5m", "3:15 pm", "Leave 7:40", "2026-10-28", "Oct 28", "10/28", "Grade 2", "2nd grade", "Hayes 2nd", "Room 213", "Age 7",
  "Ages 5-7", "1-2 pm", "Gate B12", "Bus 14", "Game 2 of 3", "Swim 4:30-5:15"];

for (const [x, want] of MONEY) test("FACESTRIP1 fixture money: " + JSON.stringify(x) + " reads " + JSON.stringify(want), () => {
  const got = L.faceText(x);
  assert.equal(got, want);
  assert.doesNotMatch(String(got), /[\x24\uFF04\uFE69]/, "no sign left");
});
for (const x of KEEP) test("FACESTRIP1 fixture near-miss kept: " + JSON.stringify(x), () => {
  assert.equal(L.moneyFree(x), x, "moneyFree leaves it alone");
  assert.equal(L.faceText(x), x, "faceText leaves it alone");
});

test("FACESTRIP1 parity: the browser pattern and r3's pattern give identical matches on all " + (MONEY.length + KEEP.length) + " fixtures", () => {
  assert.ok(R3);
  const r3 = new RegExp(R3.money.re, "gi"), sg = new RegExp(R3.sign.re, "g");
  const all = MONEY.map((m) => m[0]).concat(KEEP);
  assert.ok(all.length >= 25, "25+ fixtures: " + all.length);
  for (const x of all) {
    const a = [...x.matchAll(L.MONEY_RE)].map((m) => [m.index, m[0]]), b = [...x.matchAll(r3)].map((m) => [m.index, m[0]]);
    assert.deepEqual(a, b, "same matches on " + JSON.stringify(x));
    assert.equal(x.replace(L.MONEY_RE, "").replace(new RegExp(L.SIGN_SRC, "g"), ""), x.replace(r3, "").replace(sg, ""), "same r3 result on " + JSON.stringify(x));
  }
});

/* The FACESTRIP1 local edge rule (kept out of MONEY_SRC) is the ONLY place moneyFree goes past r3: these two forms. */
test("FACESTRIP1 edge rule: exactly the two forms r3 leaves a bare number on ('613 sign', '613 sign 5'); open item for r3 r4", () => {
  const r3 = new RegExp(R3.money.re, "gi"), sg = new RegExp(R3.sign.re, "g"), tidy = (t) => t.replace(/\s{2,}/g, " ").trim();
  const r3Only = (x) => tidy(x.replace(r3, "").replace(sg, ""));
  assert.equal(r3Only("613 " + S), "613"); assert.equal(r3Only("613" + S + "5"), "5");
  const extra = MONEY.map((m) => m[0]).filter((x) => /[0-9]/.test(r3Only(x)) && !/[0-9]/.test(L.moneyFree(x)));
  assert.deepEqual(extra, ["613" + S + "5", "613 " + S, "Cards 613" + S + "5 swap", "Gift jar 613 " + S]);
  for (const x of KEEP) assert.equal(x.replace(new RegExp(L.EDGE_SRC, "gi"), ""), x, "edge rule spares " + x);
});

test("FACESTRIP1 no-lookbehind engines (Safari < 16.4): the capture fallback gives the same result on every fixture", () => {
  const F = loadLaw({ noLookbehind: true });
  assert.equal(F.MONEY_LB_OK, false, "fallback path taken");
  for (const [x] of MONEY) assert.equal(F.faceText(x), L.faceText(x), x);
  for (const x of KEEP) assert.equal(F.faceText(x), x, x);
});

/* JS vs Python boundary before k/m (Alfred 10:10: flag, do not hide). JS \b is ASCII, Python 3 str \b is Unicode: after
   'k' or 'm' a non-ASCII letter is a boundary in JS only, so JS drops the k / m and Python keeps it. Money is gone either way. */
const SPLIT = [S + "5k\u00e9", S + "5k\u00f6", S + "5m\u00f1"];
test("FACESTRIP1 open item: r3 money rule JS vs Python differ ONLY before a non-ASCII letter after k / m", { skip: spawnSync("python3", ["-c", "1"]).status === 0 ? false : "SKIP no python3" }, () => {
  const all = MONEY.map((m) => m[0]).concat(KEEP, SPLIT, [S + "5km", S + "5kid", S + "5 km", S + "5k_", S + "5k1"]);
  const py = spawnSync("python3", ["-c", "import json,re,sys\nd=json.load(sys.stdin)\nm=re.compile(d['re'],re.I)\nprint(json.dumps([m.sub('',x) for x in d['xs']]))"],
    { input: JSON.stringify({ re: R3.money.re, xs: all }), encoding: "utf8" });
  assert.equal(py.status, 0, py.stderr);
  const P = JSON.parse(py.stdout), r3 = new RegExp(R3.money.re, "gi"), diff = [];
  all.forEach((x, i) => { const j = x.replace(r3, ""); if (j !== P[i]) diff.push([x, j, P[i]]); });
  assert.deepEqual(diff.map((d) => d[0]), SPLIT, "only the non-ASCII-after-k/m rows differ: " + JSON.stringify(diff));
  for (const d of diff) assert.doesNotMatch(d[1] + d[2], /[\x24\uFF04\uFE69]|[0-9]/, "both drop the amount");
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
  assert.equal(live.upcomingLeaves[0].location, "Book fair, Main");
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
