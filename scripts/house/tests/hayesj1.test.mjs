/* HAYESJ1 (Dan, Oct 2 5:3x PM CT): the Sat Oct 3 J. Alexander's birthday dinner is for HAYES JOHNSON (Erin's side),
   not our Hayes. One shared kid-name matcher (house-kid-match.js) decides every kid tag taken from an event title:
   generators (lib.mjs kidsIn, calendar-refresh.mjs, cal-months.py) and boards (kid pages' NEXT UP via kids-data.js,
   kid-engage who's-up, board strip, hub tiles, wall away band, countdowns birthday). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { kidsIn } from "../lib.mjs";
import { kidMentions, classify } from "../../calendar-refresh.mjs";
const require = createRequire(import.meta.url);
const ROOT = new URL("../../../", import.meta.url).pathname;
const KM = require(path.join(ROOT, "house-kid-match.js"));
const JOHNSON = ["Hayes Johnson's birthday dinner", "Hayes Johnson\u2019s birthday dinner", "hayes johnson birthday · J. Alexander's · 5:30", "Johnson Kids [RH No School]"];
const OURS = "Hayes flag · SRE Falcons vs Ridley · arrive 8:30 · game 9:00";
const ids = (a) => a.map((k) => k.id);

test("shared matcher: Hayes Johnson / Johnson Kids are never our kids; Hayes flag still is", () => {
  for (const t of JOHNSON) {
    assert.deepEqual(KM.kidsIn(t), [], t);
    assert.equal(KM.has(t, "hayes"), false, t);
    assert.equal(KM.isBirthdayFor(t, "hayes"), false, t + " is not our Hayes's birthday");
  }
  assert.deepEqual(ids(KM.kidsIn(OURS)), ["hayes"]);
  assert.equal(KM.has("Hayes + Harris — SRE pickup", "harris"), true);
  assert.equal(KM.isBirthdayFor("Hayes birthday — dinner 5:30", "hayes"), true, "a real Hayes birthday still counts");
});

test("generators: lib kidsIn and calendar-refresh tag no kid for the Johnson dinner", () => {
  for (const t of JOHNSON) {
    assert.deepEqual(kidsIn(t), [], t);
    const m = kidMentions(t); assert.ok(!m.hayes && !m.harris && !m.ainsley, t);
    const c = classify({ summary: t });
    assert.ok(!c || (!c.kid && !(c.kids && (c.kids.hayes || c.kids.harris || c.kids.ainsley))), t + " -> " + JSON.stringify(c));
  }
  assert.deepEqual(ids(kidsIn(OURS)), ["hayes"]);
  assert.equal(kidMentions(OURS).hayes, true);
  assert.equal(classify({ summary: OURS }).kid, "hayes", "Hayes flag is still Hayes's game");
});

test("cal-months.py (month board) reads the same matcher: Johnson dinner is not tagged Hayes", () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "hayesj1-"));
  fs.mkdirSync(path.join(T, ".config/wardos"), { recursive: true }); fs.writeFileSync(path.join(T, ".config/wardos/privacy-scrub.tsv"), "");
  fs.writeFileSync(path.join(T, "p.json"), JSON.stringify({ events: [
    { event_id: "a", summary: "Hayes Johnson's birthday dinner", start_time: "2026-10-03T17:30:00-05:00", end_time: "2026-10-03T19:00:00-05:00" },
    { event_id: "b", summary: OURS, start_time: "2026-10-04T08:30:00-05:00", end_time: "2026-10-04T10:00:00-05:00" }] }));
  const r = spawnSync("python3", [path.join(ROOT, "scripts/cal-months.py"), path.join(T, "out.json"), path.join(T, "p.json")], { env: { ...process.env, HOME: T }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const d = JSON.parse(fs.readFileSync(path.join(T, "out.json"), "utf8")).days;
  assert.notEqual(d["2026-10-03"].items[0].c, "hay", "Johnson dinner tagged " + d["2026-10-03"].items[0].c);
  assert.equal(d["2026-10-04"].items[0].c, "hay");
});

test("kid page NEXT UP (kids-data.js): the Johnson dinner is never Hayes's next thing; his flag game is", () => {
  const src = fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8");
  const ls = { getItem: () => null, setItem() {}, removeItem() {} };
  const document = { body: { getAttribute: () => null }, readyState: "complete", querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {}, documentElement: { getAttribute: () => null } };
  const win = { localStorage: ls, document, CustomEvent: function () {}, addEventListener() {}, fetch: () => Promise.reject(new Error("offline")), HouseKidMatch: KM };
  const ctx = { window: win, localStorage: ls, document, CustomEvent: function () {}, console, Intl, Date, setTimeout, clearTimeout };
  ctx.window.window = ctx.window; vm.createContext(ctx); vm.runInContext(src, ctx);
  const W = ctx.window.WardKids;
  const data = { kids: { hayes: { name: "Hayes" }, harris: { name: "Harris" }, ainsley: { name: "Ainsley" } }, boardStrip: { queue: [
    { summary: "Hayes Johnson's birthday dinner", place: "J. Alexander's · 5:30", kind: "other", startIso: "2026-10-03T17:30:00-05:00" },
    { summary: OURS, kind: "sport", startIso: "2026-10-04T08:30:00-05:00" }] } };
  for (const k of ["hayes", "harris", "ainsley"]) {
    const got = W.consumeQueueForKid(data, k).map((i) => i.summary);
    assert.ok(!got.some((s) => /Johnson/.test(s)), k + " NEXT UP has the Johnson dinner");
  }
  assert.deepEqual(Array.from(W.consumeQueueForKid(data, "hayes"), (i) => i.summary), [OURS]);
});

test("boards: kid-engage who's-up, wall away band and countdowns use the shared matcher", () => {
  const eng = fs.readFileSync(path.join(ROOT, "house-kid-engage.js"), "utf8");
  const fn = /function whoInSummary\(summary\) \{[\s\S]*?\n  \}\n/.exec(eng)[0];
  const who = vm.runInNewContext("(function(){ var KM = K; function notOurs(s){ return KM.strip(s); } " + fn + " return whoInSummary; })()", { K: KM });
  assert.deepEqual(Array.from(who("Hayes Johnson's birthday dinner")), []);
  assert.deepEqual(Array.from(who(OURS)), ["hayes"]);
  global.HouseKidMatch = KM;
  const S = require(path.join(ROOT, "house-wall-status.js"));
  const cal = { upcomingLeaves: [{ summary: "Hayes Johnson's birthday dinner", start: "2026-10-03T17:30:00-05:00", end: "2026-10-03T19:00:00-05:00" },
    { summary: "Hayes flag · SRE Falcons", start: "2026-10-04T08:30:00-05:00", end: "2026-10-04T10:00:00-05:00" }] };
  const days = S.awayDays(cal, { now: Date.parse("2026-10-02T17:40:00-05:00"), until: "2026-10-09T15:00:00-05:00" });
  const texts = days.flatMap((d) => d.items.map((i) => i.text));
  assert.ok(texts.some((t) => /Hayes Johnson/.test(t)), "the Johnson dinner is Dan's own plan in a kids-away week: " + JSON.stringify(texts));
  assert.ok(!texts.some((t) => /flag/.test(t)), "our Hayes's game stays off Dan's away band");
  const gb = fs.readFileSync(path.join(ROOT, "house-glass-bind.js"), "utf8");
  assert.match(gb, /KM\.isBirthdayFor\(e\.summary, "hayes"\)/, "countdowns birthday asks the shared matcher");
  for (const f of ["house-board-strip.js", "house-hub-tiles-bind.js", "house-kid-engage.js", "kids-data.js"]) assert.match(fs.readFileSync(path.join(ROOT, f), "utf8"), /notOurs\(/, f);
});

test("every page that runs a title->kid matcher loads house-kid-match.js first", () => {
  const MATCHERS = /src="(house-board-strip|house-hub-tiles-bind|house-kid-engage|kids-data|house-glass-bind|house-wall-status)\.js/;
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !/-pre-theme\.html$/.test(f));
  let n = 0;
  for (const f of pages) {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8"); const m = MATCHERS.exec(s); if (!m) continue;
    const at = s.indexOf('src="house-kid-match.js'); n++;
    assert.ok(at >= 0 && at < m.index, f + " loads " + m[1] + ".js before house-kid-match.js");
  }
  assert.ok(n >= 10, "pages checked: " + n);
});
