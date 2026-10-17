/* NOCUSTODY1 · no custody words on any board (Atlas 08:58 Oct 17; Alfred sweeps all 37 boards).
   NOCUSTODY3 · the week-change time as pack framing (Fri 3:00, before/after Friday) and "kids with you" count too.
   (1) the board HTML, JS and CSS in the public tree carry none of the phrases (case-insensitive), in visible text,
       aria text or JS-built strings. Only matcher lines marked "custody-law:allow" may name them (capped).
   (2) house-face-law.js blanks feed strings and drops feed rows that carry one, so live or cached data can't show one. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PHRASES = /kids with (?:dad|mom|dan)\b|\b(?:dad|mom)(?:'?s)? weeks?\b|home week|away week|\bcustody\b|their mom'?s week|\bkids away\b|\btheir week\b|kids-with-dan|your base with dad|hand-?\s?offs?\b|\b(?:chores|payday) with dad\b|who.{1,6}s where|\bkids with you\b|\bfri(?:day)?\b\W{0,3}3:00\b|\b(?:before|after) friday\b/i;
const ALLOW = "custody-law:allow";
/* NOCUSTODY4 · phrases split by markup ('Fri</span> 3:00') or line breaks: match on text with tags stripped and
   whitespace collapsed, per line and (for HTML) across the whole page. */
export function textOf(s) { return String(s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " "); }
export function hasPhrase(s) { return PHRASES.test(s) || PHRASES.test(textOf(s)); }
const MAX_ALLOW = 8;

function boardFiles() {
  const out = [];
  for (const f of fs.readdirSync(ROOT)) if (/\.(html|js|css)$/.test(f)) out.push(f);
  for (const d of ["art", "ori"]) {
    const walk = (rel) => {
      for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
        const r = path.join(rel, e.name);
        if (e.isDirectory()) walk(r); else if (/\.(html|js|css)$/.test(e.name)) out.push(r);
      }
    };
    if (fs.existsSync(path.join(ROOT, d))) walk(d);
  }
  return out;
}

test("37 boards plus their JS and CSS: no custody phrase anywhere (visible, aria, JS-built)", () => {
  const files = boardFiles();
  assert.ok(files.filter((f) => /^[^/]+\.html$/.test(f)).length >= 37, "all boards scanned");
  const hits = [];
  let allows = 0;
  for (const f of files) {
    const lines = fs.readFileSync(path.join(ROOT, f), "utf8").split("\n");
    lines.forEach((ln, i) => {
      if (!hasPhrase(ln)) return;
      if (ln.includes(ALLOW)) { allows++; return; }
      hits.push(f + ":" + (i + 1));
    });
    if (/\.html$/.test(f) && PHRASES.test(textOf(lines.filter((ln) => !ln.includes(ALLOW)).join("\n")))) {
      if (!hits.some((h) => h.startsWith(f + ":"))) hits.push(f + " (text across lines)");
    }
  }
  assert.deepEqual(hits, [], "custody phrase on a board: " + hits.join(", "));
  assert.ok(allows <= MAX_ALLOW, "too many custody-law:allow lines (" + allows + "); only the matchers may use it");
});

test("the phrase list catches every form Alfred sweeps for", () => {
  for (const s of ["Kids with Dad", "kids with Mom", "Kids with Dan", "Dad week", "MOM WEEK", "Dad's week", "Home week", "Away week",
    "custody", "Their mom's week", "Kids away", "their week", "No Kids-with-Dan days", "YOUR BASE WITH DAD", "Next handoff", "hand-offs", "Chores with Dad", "payday with Dad", "Who’s where",
    "Fri 3:00", "fri 3:00", "Friday 3:00", "Leave by · Fri / 3:00", "pack before Friday", "BEFORE FRIDAY", "after Friday", "Kids with you at home", "KIDS WITH YOU"]) assert.ok(PHRASES.test(s), s);
  for (const s of ["Dinner with Dad", "this week", "Week tile", "home", "Dad board", "Daddy weekend", "Friday", "3:00 swim", "Fri list", "with you"]) assert.equal(PHRASES.test(s), false, s);
});

test("markup and line breaks do not hide a phrase (tags stripped, whitespace collapsed)", () => {
  for (const s of ['Leave by · <span class="hl">Fri</span> 3:00', "<b>Fri</b>\n   3:00", "pack <em>before</em>  Friday", "Kids <i>with</i> you", "hand<wbr>off"])
    assert.ok(hasPhrase(s), s);
  assert.equal(hasPhrase('<span class="hl">Fri</span> list'), false);
  assert.equal(hasPhrase("<b>3:00</b> swim"), false);
});

test("face law blanks custody strings and drops custody rows from feed data (live or cached)", () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-face-law.js"), "utf8"), ctx);
  const L = ctx.HouseFaceLaw;
  const out = L.cleanFeed("kids-week", {
    homeWeek: { with: "Dad", place: "Home", through: "next Dad week", throughLabel: "kids away · back Fri" },
    boardStrip: { detailHtml: "kids with Dad at <strong>home</strong> through Fri", queue: [{ summary: "Kids with Dan", kind: "custody" }, { summary: "Hayes swim", place: "Pool" }] },
    kids: { hayes: { name: "Hayes", hottest: { when: "home week", what: "Kids away" }, today: [{ when: "4:00", what: "Swim" }, { when: "Now", what: "Dad week live" }, { when: "All day", what: "🏡 YOUR BASE with Dad" }, { when: "All day", what: "your base WITH DAD", hint: "x" }] } },
  });
  const txt = JSON.stringify(out);
  assert.equal(PHRASES.test(txt), false, "no phrase survives the face law");
  assert.equal(out.homeWeek.with, "Dad", "state fields are not text and stay as they are");
  assert.equal(out.boardStrip.queue.length, 1);
  assert.equal(out.kids.hayes.today.length, 1);
  assert.equal(out.kids.hayes.hottest, undefined);
  const months = L.cleanFeed("cal-months", { days: { "2026-10-17": { withDan: true, items: [{ c: "a", l: "Kids with Dan" }, { c: "b", l: "Swim 4:00" }] } } });
  assert.deepEqual(JSON.parse(JSON.stringify(months.days["2026-10-17"].items)), [{ c: "b", l: "Swim 4:00" }]);
});

test("no control characters (U+0000 to U+001F except tab, newline, CR) in any board HTML, JS or CSS", () => {
  const bad = [];
  for (const f of boardFiles()) {
    const t = fs.readFileSync(path.join(ROOT, f), "utf8");
    const lines = t.split("\n");
    lines.forEach((ln, i) => { if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(ln)) bad.push(f + ":" + (i + 1)); });
  }
  assert.deepEqual(bad, [], "control characters: " + bad.join(", "));
});
