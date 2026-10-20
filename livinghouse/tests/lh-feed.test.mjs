// node livinghouse/tests/lh-feed.test.mjs  (Alfred FAIL 2026-10-17: P2 feed, P2 law, P3 change minute and over-drop. Synthetic fixtures only.)
import { assertSealed } from "../../scripts/qa/temp-home.mjs";   // TEMPHOME1: WARDOS_* unset and a temp HOME before any private-list reader loads
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
for (const k of Object.keys(process.env)) if (k.startsWith("WARDOS_")) delete process.env[k];
{ const fs = req("node:fs"), os = req("node:os"), path = req("node:path"); process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), "lhfeed-home-")); }   // never read a real private names file
req("../../house-face-law.js");
assertSealed(); const L = globalThis.HouseFaceLaw, R = req("../lh-rules.js"), A = req("../../away-filter.js");
const ms = (s) => Date.parse(s);
const kid = { summary: "Hayes soccer", start: "2026-10-20T16:30:00-05:00" };

// P2 feed: missing, empty and junk feeds are UNKNOWN = the normal awake board (lit windows, kid items kept)
const BAD = { missing: null, empty: { days: {} }, junk: "<html>502</html>", junkDays: { days: [1, 2] }, junkFlags: { days: { "2026-10-20": { withDan: "maybe" }, "2026-10-21": {} } } };
for (const [name, feed] of Object.entries(BAD)) {
  A.setMonths({ days: { "2026-10-20": { withDan: false } } }); assert.equal(A.hasMonths(), true);   // a valid away feed first ...
  A.setMonths(feed);                                                                                 // ... then the bad one replaces it
  assert.equal(A.hasMonths(), false, name + ": unknown");
  assert.equal(A.isAwayAt(ms("2026-10-20T17:00:00-05:00")), false, name + ": never away");
  assert.equal(A.keepItem(kid, ms("2026-10-20T08:00:00-05:00")), true, name + ": kid item kept");
  assert.deepEqual(R.plaqueState({ away: false, unknown: true, lamp: null, today: true }), { win: "lit", plaque: "today" }, name + ": lit board");
}
// away only on a valid feed that says away
A.setMonths({ days: { "2026-10-20": { withDan: false } } });
assert.equal(A.isAwayAt(ms("2026-10-20T17:00:00-05:00")), true);
assert.equal(A.keepItem(kid, ms("2026-10-20T08:00:00-05:00")), false);
assert.deepEqual(R.plaqueState({ away: true, lamp: true, today: true }), { win: "dark", plaque: "" });

// P3 change minute: from the feed (changeMin); absent or junk = no intra-day switch
const days = { "2026-10-19": { withDan: true }, "2026-10-20": { withDan: false }, "2026-10-21": { withDan: true } };
A.setMonths({ days });
assert.equal(A.CHANGE_MIN, null);
assert.equal(A.isAwayAt(ms("2026-10-19T20:00:00-05:00")), false, "no changeMin: the home day stays home all day");
assert.equal(A.isAwayAt(ms("2026-10-21T06:00:00-05:00")), false, "no changeMin: the next home day is home from midnight");
assert.equal(A.isAwayAt(ms("2026-10-20T12:00:00-05:00")), true);
A.setMonths({ days, changeMin: 600 });
assert.equal(A.CHANGE_MIN, 600);
assert.equal(A.isAwayAt(ms("2026-10-19T09:59:00-05:00")), false);
assert.equal(A.isAwayAt(ms("2026-10-19T10:00:00-05:00")), true, "flips at the feed's minute");
assert.equal(A.isAwayAt(ms("2026-10-21T09:59:00-05:00")), true);
assert.equal(A.isAwayAt(ms("2026-10-21T10:00:00-05:00")), false);
for (const bad of [2000, -5, "600", 12.5, null]) { A.setMonths({ days, changeMin: bad }); assert.equal(A.CHANGE_MIN, null, "junk changeMin " + bad); }
assert.ok(!/15\s*\*\s*60/.test(req("node:fs").readFileSync(new URL("../../away-filter.js", import.meta.url), "utf8")), "no hardcoded change hour");

// P3 over-drop: neutral words survive
for (const t of ["Away game", "Back to school night", "Return library books", "Dinner with Dad", "Hayes away game", "Harris back to school night"]) {
  assert.equal(R.stateText(t), false, t); assert.equal(L.isCustody(t), false, t); assert.equal(L.keepEvent({ summary: t }), true, t);
}

for (const [t, k] of [["Hayes Away game", "hayes"], ["Harris Back to school night", "harris"], ["Ainsley Return library books", "ainsley"]]) {
  assert.equal(R.otherPerson(t), false, t); assert.equal(R.kidName(k, t), true, t); assert.equal(R.glassTitle(t), t, t);   // a capitalised event word is not a surname
}
assert.equal(R.glassTitle("Dinner with Dad"), "Dinner with Dad"); assert.equal(R.glassTitle("Example Fest with Sam"), "Dad: Example Fest");
for (const t of ["Hayes returns", "Hayes returns Sunday", "Kids are back", "Back in 6 days", "Kids away"]) assert.equal(R.stateText(t), true, t);   // the arrangement still drops
// P2 law: Alfred's fixtures are dropped or scrubbed (the page test checks the cards and the callout)
assert.equal(R.stateText("Dad weeks plan"), true); assert.equal(L.isCustody("Dad weeks plan"), true);
assert.equal(R.stateText("Who\u2019s where"), true); assert.equal(R.stateText("Who's where"), true);
assert.equal(R.money("Ainsley jar $5 payday"), true); assert.equal(R.money("Jar $ 12.50"), true); assert.equal(R.money("Hayes 5th grade"), false);
assert.equal(R.seats(L.faceText("Sec 112, Row F, Seats 3-4")), "");   // privacy-scan:allow seat_code (Alfred's synthetic fixture)
assert.equal(R.seats(L.faceText("Team A vs Team B · Sec 112, Row F, Seats 3-4")), "Team A vs Team B");   // privacy-scan:allow seat_code (synthetic)
assert.equal(L.faceText("LKMS picture day"), "school picture day");
for (const t of ["Second grade play", "Row the boat", "Secret santa"]) assert.equal(R.seats(t), t);
// the feed goes through main's cleanFeed on load, like private-feed.js on every board
const src = req("node:fs").readFileSync(new URL("../lh.js", import.meta.url), "utf8");
for (const n of ["cal-live", "kids-week", "cal-months"]) assert.ok(src.includes('lw("' + n + '"'), "cleanFeed on " + n);
assert.ok(/function face\(t\)[^\n]*faceText[^\n]*seats[^\n]*isCustody/.test(src), "face(): faceText, seats, isCustody");
assert.ok(/e\.t = face\(e\.t\)/.test(src) && /what = face\(what\)/.test(src), "face() on the cards and the callout");

// ---- Alfred base2 (2026-10-17 16:04) ----
// P2 money: every form drops the kid row whole
for (const t of ["Harris earned 5 dollars", "5 bucks", "five bucks", "5$", "USD 5", "jar 5.00", "50\u00a2", "\u00a2", "5 dollars", "$5", "$ 12.50", "5 USD", "dollars 5", "twenty five bucks", "a few dollars", "75 cents", "Ainsley jar $5 payday"])
  assert.equal(R.money(t), true, "money: " + t);
for (const t of ["Room 5", "Grade 5", "5:00 practice", "Jar of pickles", "Milwaukee Bucks game", "Hayes 2nd grade", "Bus 15", "Harris 5th grade play", "Game 4"]) assert.equal(R.money(t), false, "not money: " + t);
for (const [t, k] of [["Harris Grade 5 play", "harris"], ["Hayes Jar of pickles", "hayes"], ["Hayes Room 5 open house", "hayes"]]) { assert.equal(R.otherPerson(t), false, t); assert.equal(R.kidName(k, t), true, t); assert.equal(R.money(t), false, t); }
assert.ok(/LHRules\.money\(s\)/.test(src) && /KID\.test\(t\) && LHRules\.money\(t\)\) return false/.test(src) && /LHRules\.money\(what\)\) return ""/.test(src), "money drops the row (kid items, stones, callout)");
// P3 custody residue: main's isCustody catches the "has (the) kids" forms; the row drops, nothing is stripped
for (const t of ["Mom has kids", "Dad has the kids", "Zedna has the kids this week", "Has kids", "Yolanthe has kids \u00b7 Fri", "Mom has the kids until Sun"]) assert.equal(L.isCustody(t), true, "custody: " + t);
for (const t of ["Hayes has kids' choir", "Library has kids story time", "The school has kids bring lunch", "Takes kids to the zoo", "Who has kids gear"]) assert.equal(L.isCustody(t), false, "not custody: " + t);
assert.equal(R.residue("has kids"), ""); assert.equal(R.residue(R.glassTitle("Mom has kids")), "");   // a stripped subject drops the row
assert.equal(R.residue("Hayes has practice"), "Hayes has practice");
assert.ok(/\.replace\(KIDRE\[k\], ""\)[^;]*\.replace\(\/\^\\s\*\(\?:has\|have\|gets\?\|got\|is\)/.test(src), "callout: a stripped kid name leaves the item, never a bare verb (Hayes has practice reads Practice)");
// P3 seat leftovers
for (const t of ["Play / /", "Game \u00b7,2,3", "112 F 3-4", "/ ,"]) assert.equal(R.seatsResidue(t), "", "drop: " + t);
assert.equal(R.seatsResidue("Cubs game 112 F 3-4"), "Cubs game"); assert.equal(R.seatsResidue("Cubs game & 6"), "Cubs game");
for (const t of ["3-4 PM practice", "Soccer 9-10am", "Grade 5 B 3-4 PM", "Room 5 B 3:30", "Game 3-4", "Team A vs Team B, Game 4", "Hayes soccer practice"]) assert.equal(R.seatsResidue(t), t, "keep: " + t);
// 5(b) school path: main's school-names.js first, an empty list is never cached
const SN = req("../../school-names.js");
R.setSchools([]); SN.setSchools(null);
assert.equal(R.schoolTokens().length, 0, "no names in a temp HOME"); SN.setSchools(["QXS"]);
assert.ok(R.schoolTokens().length === 1 && R.schoolTokens()[0] === "QXS", "names that arrive later are picked up (no empty cache)");
assert.equal(R.stripSchool("QXS picture day"), "picture day"); assert.equal(R.isSchoolText("at QXS"), true);
R.setSchools([]); SN.setSchools(null); assert.equal(R.schoolTokens().length, 0);
assert.ok(/function school\(t\)[^\n]*stripSchool/.test(src) && /t = school\(t\)/.test(src) && /school\(LHRules\.placeShort\(e\.loc\)\)/.test(src), "school strip on stones, callout and candle");
const html = req("node:fs").readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.ok(html.indexOf("../school-names.js") > 0 && html.indexOf("../school-names.js") < html.indexOf("lh-rules.js"), "school names load before LH rules");
// 5(b) hard guard: no real feeds on live Pages
assert.equal(R.feedsAllowed({ hostname: "127.0.0.1", protocol: "http:" }), true); assert.equal(R.feedsAllowed({ hostname: "localhost" }), true); assert.equal(R.feedsAllowed({ protocol: "file:" }), true);
for (const h of ["dmward23-web.github.io", "example.com", "127.0.0.1.example.com", "192.168.1.5"]) assert.equal(R.feedsAllowed({ hostname: h, protocol: "https:" }), false, h);
assert.ok(/function J\(u\) \{ if \(!FEEDS_OK\) return Promise\.resolve\(null\)/.test(src), "every feed read goes through the guard");
const feedsMd = req("node:fs").readFileSync(new URL("../FEEDS.md", import.meta.url), "utf8");
assert.ok(/school names load first/i.test(feedsMd) && /every display path/i.test(feedsMd) && /never cache an empty/i.test(feedsMd), "FEEDS.md wiring conditions");

// Atlas 5(a): switch days. No changeMin = kid items hidden all day on a switch day, board otherwise normal; with changeMin = switch at it
const sw = { "2026-10-22": { withDan: true }, "2026-10-23": { withDan: true }, "2026-10-24": { withDan: false }, "2026-10-25": { withDan: false }, "2026-10-26": { withDan: true }, "2026-10-27": { withDan: true } };
const item = (iso) => ({ summary: "Hayes soccer", start: iso });
A.setMonths({ days: sw });
assert.equal(A.isSwitchDay("2026-10-23"), true); assert.equal(A.isSwitchDay("2026-10-26"), true); assert.equal(A.isSwitchDay("2026-10-22"), false);
assert.equal(A.keepItem(item("2026-10-23T09:00:00-05:00"), ms("2026-10-23T08:00:00-05:00")), false, "switch day, no changeMin: morning kid item hidden");
assert.equal(A.keepItem(item("2026-10-23T19:00:00-05:00"), ms("2026-10-23T08:00:00-05:00")), false, "switch day, no changeMin: evening kid item hidden");
assert.equal(A.keepItem({ summary: "Harris picture day", start: "2026-10-26" }, ms("2026-10-26T08:00:00-05:00")), false, "switch day (back), all-day kid item hidden");
assert.equal(A.isAwayAt(ms("2026-10-23T19:00:00-05:00")), false, "switch day, no changeMin: the board is the normal home board");
assert.equal(A.keepItem({ summary: "Book club", start: "2026-10-23T19:00:00-05:00" }, ms("2026-10-23T08:00:00-05:00")), true, "grown-up items stay");
assert.equal(A.keepItem(item("2026-10-22T19:00:00-05:00"), ms("2026-10-22T08:00:00-05:00")), true, "normal day unchanged");
assert.equal(A.keepItem(item("2026-10-27T19:00:00-05:00"), ms("2026-10-27T08:00:00-05:00")), true, "normal day unchanged");
A.setMonths({ days: sw, changeMin: 900 });
assert.equal(A.keepItem(item("2026-10-23T09:00:00-05:00"), ms("2026-10-23T08:00:00-05:00")), true, "switch day with changeMin: before the minute shown");
assert.equal(A.keepItem(item("2026-10-23T16:00:00-05:00"), ms("2026-10-23T08:00:00-05:00")), false, "switch day with changeMin: after the minute hidden");
assert.equal(A.isAwayAt(ms("2026-10-23T16:00:00-05:00")), true, "away after the minute");
assert.equal(A.keepItem(item("2026-10-26T14:00:00-05:00"), ms("2026-10-26T08:00:00-05:00")), false); assert.equal(A.keepItem(item("2026-10-26T16:00:00-05:00"), ms("2026-10-26T08:00:00-05:00")), true);
assert.equal(A.keepItem(item("2026-10-22T19:00:00-05:00"), ms("2026-10-22T08:00:00-05:00")), true, "normal day unchanged");
const afSrc = req("node:fs").readFileSync(new URL("../../away-filter.js", import.meta.url), "utf8");
assert.ok(!/\b(?:fri|friday|sat|saturday|sun|sunday)\b\s*[:=]/i.test(afSrc) && !/dow\s*===\s*\d/.test(afSrc), "no hardcoded weekday");
console.log("lh-feed: ok");
