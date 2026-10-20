/* NOCUSTODY1 · no custody words on any board (Atlas 08:58 Oct 17; Alfred sweeps all 37 boards).
   NOCUSTODY3 · the week-change time as pack framing (Fri 3:00, before/after Friday) and "kids with you" count too.
   (1) the board HTML, JS and CSS in the public tree carry none of the phrases (case-insensitive), in visible text,
       aria text or JS-built strings. Only matcher lines marked "custody-law:allow" may name them (capped).
   (2) house-face-law.js blanks feed strings and drops feed rows that carry one, so live or cached data can't show one. */
import { assertSealed } from "./temp-home.mjs";   // TEMPHOME1 (LHVID1'): names lh-rules.js, so it runs sealed
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PHRASES = /kids with (?:dad|mom|dan)\b|\b(?:dad|mom)(?:'?s)? weeks?\b|home week|away week|\bcustody\b|their mom'?s week|\bkids away\b|\btheir week\b|kids-with-dan|your base with dad|hand-?\s?offs?\b|\b(?:chores|payday) with dad\b|who.{1,6}s where|\bkids with you\b|\bfri(?:day)?\b\W{0,3}3:00\b|\b(?:before|after) friday\b|\bwhose (?:week|weekend|night|turn)\b|\b(?:kids?|boys|weeks?|weekends?|nights?) (?:with|at) (?:mom|mommy|mother|dad|daddy|father)(?:['\u2019]?s)?\b|\bwith (?:mom|mommy|mother)\b|\b(?:mom|mommy|mother|dad|daddy|father)['\u2019]?s (?:kids|weekend|night|house|place)\b|\b(?:mom|mommy|mother)(?:['\u2019]?s)? (?:has|have|had|gets?|got|takes?|keeps?) (?:the )?kids\b|\b(?:kids?|custody) exchange\b|\bexchange (?:day|time|point)\b|(?:^\s*|\b(?!who\b)[a-z]+\s+)(?:has|have|had|gets?|got|keeps?) (?:the )?kids\b(?=\s*(?:$|[\u00b7|]|(?:this|next) (?:week|weekend)\b|(?:until|till|through|thru)\b|all week\b))/i;   // synced with house-face-law.js NOCUST_RX (Atlas + Alfred narrowed list)
const ALLOW = "custody-law:allow";
/* NOCUSTODY4 · phrases split by markup ('Fri</span> 3:00') or line breaks: match on text with tags stripped and
   whitespace collapsed, per line and (for HTML) across the whole page. */
export function textOf(s) { return String(s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " "); }
export function hasPhrase(s) { return PHRASES.test(s) || PHRASES.test(textOf(s)); }
assertSealed();
const MAX_ALLOW = 10;   // 8 on main + the two Living House matchers (livinghouse/lh-rules.js STATE_RE and LEAVE_RE)

function boardFiles() {
  const out = [];
  for (const f of fs.readdirSync(ROOT)) if (/\.(html|js|css)$/.test(f)) out.push(f);
  for (const d of ["art", "ori", "livinghouse", "night"]) {
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

/* Atlas + Alfred ruling (1702 defect 4): the law drops only lines that say which parent or household the kids are with.
   "has the kids" counts only as the arrangement (nothing after it, a dot, this/next week or weekend, until/through), never
   with a place, a time or an errand after it ("at practice", "from school", "for haircut", "3rd period").
   Plain logistics stay on every board (must-keep); the real arrangement phrasings drop (must-drop). Fixture words only. */
export const MUST_KEEP = ["Bus takes kids at 7:40", "Coach has the kids at practice", "Uncle gets kids from school", "Teacher has kids 3rd period",
  "Dad takes kids for haircut", "Dinner with Dad", "Gift exchange", "Hayes swim 4:00", "Sitter has the kids tonight", "Kids at the pool", "Grandma takes kids to the zoo Sat", "Who has kids gear", "Library has kids story time", "who has kids"];
export const MUST_DROP = ["Dad week", "Mom's week", "Whose week", "whose weekend", "Kids with Mom", "Kids with Dad", "Weekend with Dad", "Dinner with Mom",
  "Mom has the kids", "Mom gets the kids Fri", "Next handoff", "hand-off 6 PM", "Kid exchange 6 PM", "Custody exchange", "Exchange day", "Dad's weekend",
  "Mom's house", "Dad's kids", "custody", "Dad has the kids", "Has kids", "Zedna has the kids this week", "Jones has kids \u00b7 Fri", "Mom has the kids until Sun", "Kids at Mom's", "Their mom's week", "Kids away"];
test("narrowed law: logistics stay, the arrangement drops (law and phrase list agree)", () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(ROOT, "house-face-law.js"), "utf8"), ctx);
  const L = ctx.HouseFaceLaw;
  for (const s of MUST_KEEP) { assert.equal(L.isCustody(s), false, "must keep: " + s); assert.equal(PHRASES.test(s), false, "phrase list keeps: " + s); }
  for (const s of MUST_DROP) { assert.equal(L.isCustody(s), true, "must drop: " + s); assert.ok(PHRASES.test(s) || L.isCustody(s), s); }
  const kept = L.cleanFeed("kids-week", { kids: { hayes: { name: "Hayes", today: MUST_KEEP.map((what) => ({ when: "4:00", what })).concat(MUST_DROP.map((what) => ({ when: "4:00", what }))) } } });
  assert.deepEqual(JSON.parse(JSON.stringify(kept.kids.hayes.today.map((r) => r.what))), MUST_KEEP.map((s) => L.faceText(s)), "cleanFeed keeps every logistics row and drops every arrangement row");
  /* a co-parent name (run time only, stand-in here) joined to kids, week or weekend drops; without the role nothing extra drops */
  for (const s of ["Yolanthe's weekend", "Kids at Yolanthe"]) assert.equal(L.isCustody(s), false, "no role loaded: " + s);
  ctx.WARDOS_PRIVATE_NAMES = { coparent: ["Yolanthe"] };
  for (const s of ["Yolanthe has the kids", "Yolanthe's weekend", "Kids at Yolanthe", "Week with Yolanthe"]) assert.equal(L.isCustody(s), true, "co-parent: " + s);
  for (const s of MUST_KEEP) assert.equal(L.isCustody(s), false, "must keep with role: " + s);
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
