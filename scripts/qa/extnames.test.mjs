/* EXTNAMES1 · node --test scripts/qa/extnames.test.mjs
   private-names role "external" (plus the old key during the transition): a kid's first name followed by one of those
   names is not our kid, in both generators (calendar-refresh.mjs, cal-months.py). Every other role (partner, coparent,
   household, school, anything unknown) is NEVER filtered; an unknown role gets one count-only warning. No external
   rows = one count-only config warning. Synthetic stand-ins only (Smith, Jones, Zedna, Yolanthe, Quill, QXS); the
   cal-months runs use a temp HOME with a stand-in privacy-scrub.tsv so the empty-HOME CI run works too. */
import { assertSealed } from "./temp-home.mjs";   // TEMPHOME1 (LHVID1): WARDOS_* unset and a temp HOME before any private-list reader loads
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OLD_KEY = "otherfamily"; /* the transition key, accepted until the rename step (a later commit drops it) */
const ev = (id, summary, hh, mm) => ({ id, summary, start: { dateTime: `2026-10-13T${hh}:${mm}:00-05:00` }, end: { dateTime: `2026-10-13T${hh}:${mm === "00" ? "50" : "59"}:00-05:00` } });
const EVENTS = { events: [
  { id: "wk", summary: "Kids with Dan", start: { dateTime: "2026-10-09T15:00:00-05:00" }, end: { dateTime: "2026-10-16T15:00:00-05:00" } }, /* the generator's week window, as in allday-nextleave */
  ev("p", "Harris Zedna art class", "15", "00"),      /* partner stand-in */
  ev("c", "Ainsley Yolanthe dinner", "15", "10"),     /* coparent stand-in */
  ev("h", "Hayes Ward flag game", "15", "20"),        /* household surname */
  ev("hh", "Hayes Harris pickup", "15", "30"),        /* household name that is also a kid name */
  ev("x", "Hayes Smith birthday party", "16", "00"),  /* external */
  ev("o", "Harris Jones playdate", "16", "10"),       /* old key */
  ev("u", "Ainsley Quill recital", "16", "20"),       /* unknown role */
  ev("k", "Hayes swim practice", "17", "30"),
] };
const NAMES = [["partner", "Zedna"], ["coparent", "Yolanthe"], ["household", "Ward"], ["household", "Harris"], ["school", "QXS"],
  ["external", "Smith"], [OLD_KEY, "Jones"], ["mystery", "Quill"]];
const BASE_ENV = () => { const e = { ...process.env }; for (const k of Object.keys(e)) if (k.startsWith("WARDOS_")) delete e[k]; return e; };

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extnames-"));
  fs.writeFileSync(path.join(dir, "ev.json"), JSON.stringify(EVENTS));
  return dir;
}
function refresh(names) {
  const dir = tmp();
  fs.copyFileSync(path.join(ROOT, "scripts/qa/fixtures/private/kids-week.synthetic.json"), path.join(dir, "kids-week.json"));
  fs.copyFileSync(path.join(ROOT, "kids-data.js"), path.join(dir, "kids-data.js"));
  const r = spawnSync("node", [path.join(ROOT, "scripts/calendar-refresh.mjs"), "--events", path.join(dir, "ev.json"), "--week", path.join(dir, "kids-week.json"), "--no-mirror", "--now", "2026-10-13T06:40:00-05:00"],
    { encoding: "utf8", env: { ...BASE_ENV(), WARDOS_NAMES: names.map(([r, n]) => r + "=" + n).join(";") } });
  assert.equal(r.status, 0, r.stderr);
  const W = JSON.parse(fs.readFileSync(path.join(dir, "kids-week.json"), "utf8"));
  const all = (k) => ["today", "sports", "school", "appointments", "week"].flatMap((l) => (W.kids[k][l] || []).map((x) => x.what || "")).join(" | ")
    + " | " + String((W.kids[k].hottest || {}).what || "");
  return { stderr: r.stderr, hayes: all("hayes"), harris: all("harris"), ainsley: all("ainsley") };
}
function months(names) {
  const dir = tmp();
  const home = path.join(dir, "home");
  fs.mkdirSync(path.join(home, ".config", "wardos"), { recursive: true });
  fs.writeFileSync(path.join(home, ".config", "wardos", "privacy-scrub.tsv"), "# stand-in scrub rule\nQXSscrubstandin\tx\n");
  const np = path.join(dir, "names.tsv");
  fs.writeFileSync(np, names.map(([r, n]) => r + "\t" + n).join("\n") + "\n", { mode: 0o600 });
  const out = path.join(dir, "out.json");
  const r = spawnSync("python3", [path.join(ROOT, "scripts/cal-months.py"), out, path.join(dir, "ev.json")],
    { encoding: "utf8", env: { ...BASE_ENV(), HOME: home, WARDOS_PRIVATE_NAMES: np } });
  assert.equal(r.status, 0, r.stderr);
  const items = JSON.parse(fs.readFileSync(out, "utf8")).days["2026-10-13"].items;
  return { stderr: r.stderr, item: (re) => items.find((i) => re.test(i.l)) || {} };
}

assertSealed();
test("calendar-refresh: external and old-key rows are filtered; partner, coparent, household and unknown rows stay", () => {
  const r = refresh(NAMES);
  assert.doesNotMatch(r.hayes, /Smith/, "external filtered");
  assert.doesNotMatch(r.harris, /Jones/, "old key filtered");
  assert.match(r.harris, /art class/i, "partner row stays");
  /* a row that names the co-parent was already dropped by the base CALENDAR LAW rule (COPARENT_RE, unchanged here):
     the external filter must not change its fate either way */
  const noExt = refresh(NAMES.filter(([role]) => role !== "external" && role !== OLD_KEY));
  assert.equal(/dinner/i.test(r.ainsley), /dinner/i.test(noExt.ainsley), "coparent row: same result with or without the external roles");
  for (const k of ["hayes", "harris", "ainsley"]) {
    const keep = (t) => t.split(" | ").filter((x) => !/Smith|Jones/.test(x)).join(" | ");
    assert.equal(keep(r[k]), keep(noExt[k]), k + ": only the external and old-key rows differ");
  }
  assert.match(r.hayes, /Ward flag game/, "household Ward row stays, names intact");
  assert.match(r.hayes, /pickup/i, "household Harris: Hayes keeps the pickup");
  assert.match(r.harris, /pickup/i, "household Harris: Harris keeps the pickup");
  assert.match(r.ainsley, /recital/i, "unknown role is not filtered");
  assert.match(r.hayes, /swim/i);
  assert.equal((r.stderr.match(/WARN private-names: 1 unknown role\(s\), not filtered/g) || []).length, 1);
  assert.doesNotMatch(r.stderr, /role external has 0/);
  assert.doesNotMatch(r.stderr, /Quill|Smith|Jones|Zedna|Yolanthe|QXS/);
  const open = refresh([["school", "QXS"]]);
  assert.match(open.hayes + open.harris, /Smith|Jones/, "fixture check: without the roles the outside rows do reach a kid");
});

test("cal-months: external and old-key rows are filtered; partner, coparent, household and unknown rows stay", () => {
  const m = months(NAMES);
  assert.notEqual(m.item(/Smith/).c, "hay", "external filtered");
  assert.notEqual(m.item(/Jones/).c, "har", "old key filtered");
  assert.equal(m.item(/art class/).c, "har", "partner row stays on Harris");
  assert.equal(m.item(/dinner/).c, "ain", "coparent row stays on Ainsley");
  assert.equal(m.item(/flag game/).c, "hay", "household Ward row stays on Hayes");
  assert.match(m.item(/flag game/).l, /^Hayes Ward flag game/, "names intact");
  assert.notEqual(m.item(/pickup/).c, undefined);
  assert.equal(m.item(/recital/).c, "ain", "unknown role is not filtered");
  assert.equal((m.stderr.match(/WARN private-names: 1 unknown role\(s\), not filtered/g) || []).length, 1);
  assert.doesNotMatch(m.stderr, /role external has 0/);
  assert.doesNotMatch(m.stderr, /Quill|Smith|Jones|Zedna|Yolanthe|QXS/);
});

test("only the old key present: still filtered, and no missing-external warning", () => {
  const r = refresh([["school", "QXS"], [OLD_KEY, "Jones"]]);
  assert.doesNotMatch(r.harris, /Jones/);
  assert.doesNotMatch(r.stderr, /role external has 0/);
  const m = months([["partner", "Zedna"], ["coparent", "Yolanthe"], ["school", "QXS"], [OLD_KEY, "Jones"]]);
  assert.notEqual(m.item(/Jones/).c, "har");
  assert.doesNotMatch(m.stderr, /role external has 0/);
});

test("no external rows under either key: one count-only config warning in each generator", () => {
  const r = refresh([["school", "QXS"], ["partner", "Zedna"]]);
  assert.equal((r.stderr.match(/WARN private-names: role external has 0 entries \(config error\)/g) || []).length, 1);
  assert.doesNotMatch(r.stderr, /QXS|Zedna/);
  const m = months([["partner", "Zedna"], ["coparent", "Yolanthe"], ["school", "QXS"]]);
  assert.equal((m.stderr.match(/WARN private-names: role external has 0 entries \(config error\)/g) || []).length, 1);
  assert.doesNotMatch(m.stderr, /QXS|Zedna|Yolanthe/);
});
