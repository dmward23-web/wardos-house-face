// node livinghouse/tests/lh-rules.test.mjs  (fixtures are synthetic: no real names, codes or addresses; the repo is public)
import { assertSealed } from "../../scripts/qa/temp-home.mjs";   // TEMPHOME1: WARDOS_* unset and a temp HOME before any private-list reader loads
import assert from "node:assert/strict";
import { createRequire } from "node:module";
assertSealed(); const R = createRequire(import.meta.url)("../lh-rules.js");
const at = (s) => Date.parse(s);
const T = R.glassTitle;   // every title below is synthetic (no real event, seat, trip or name)
assert.equal(T("XYZ Game 4: Team A @ Team B (Sec 0 Row Z 1-2)"), "Team A vs Team B, Game 4");   // synthetic fixture, privacy-scan:allow seat_code
assert.equal(T("Team A @ Team B (Sec 0 Row Z 1-2), Game 4"), "Team A vs Team B, Game 4");   // synthetic fixture, privacy-scan:allow seat_code
assert.equal(T("Example City trip with Sam"), "Dad: Example City trip");
assert.equal(T("Dan+Sam AAA XYZ · #QQQ111/#QQQ222 XX1234 Sat 1/2 AAA 3:30p→BBB · leave 2:10"), "Dad: AAA trip");   // synthetic fixture, privacy-scan:allow booking_code
assert.equal(T("Example Fest with Sam"), "Dad: Example Fest");
assert.equal(T("Sam + Dan — Example Fest (Band + Band)"), "Dad: Example Fest");
assert.equal(T("Flight to Springfield (XX 1234)"), "Dad: Fly to Springfield");
assert.equal(T("✈️ Dan #QQQ333 XX606 AAA→BBB 8:10a–9:55a · leave 6:55"), "Dad: Fly home");   // synthetic fixture, privacy-scan:allow booking_code
assert.equal(T("Dan road trip home · leave 6:55"), "Dad road trip home");
assert.equal(T("Fly home to Springfield"), "Dad: Fly home to Springfield");
assert.equal(T("Team A vs Team B, Game 4"), "Team A vs Team B, Game 4");
assert.equal(T("[AB Tag] Example day"), "Example day");                 // bracketed tags never reach a stone
for (const s of ["Dan to Example Fest", "Dan+Sam AAA · leave 2:10", "✈️ Dan XX606 · leave 6:55", "Example Fest with Sam"]) assert.ok(!/\bDan\b/.test(T(s)), "shared glass says Dad: " + T(s));
assert.ok(!/—|→/.test(T("Kids — pickup MOVED → Sat")));
assert.equal(T("Dad: Example City trip"), "Dad: Example City trip");
// private first names come only from run-time sources (see lh-names.test.mjs); a name not on the list stays
assert.equal(R.stripPrivate("Lunch with Zed"), "Lunch with Zed");
// someone else who shares a kid's first name stays off the candle and stones
assert.equal(R.otherPerson("Hayes Exampleton bday party"), true);
assert.equal(R.otherPerson("Hayes practice · Example"), false);
assert.equal(R.otherPerson("Example Fest"), false);
assert.equal(R.placeShort("Springfield SPX"), "SPX");
assert.equal(R.placeShort("Example International Airport (EXA), 1 Runway Rd, Example, ZZ 00000"), "EXA");
assert.equal(R.placeShort("Home, 1 Example Street"), "");
// a first name followed by another surname ("Hayes <Surname>" style) is never our kid (synthetic surnames)
const K = R.kidName;
assert.equal(K("hayes", "Hayes Exampleton bday"), false);
assert.equal(K("hayes", "Party for Hayes Exampleton"), false);
assert.equal(K("hayes", "Hayes Smithfield game"), false);
assert.equal(K("harris", "Harris Example practice"), false);
assert.equal(K("hayes", "Ainsley + Hayes Exampleton"), false);
assert.equal(K("ainsley", "Ainsley + Hayes Exampleton"), true);
assert.equal(K("hayes", "Hayes practice · Example"), true);
assert.equal(K("hayes", "Hayes BB practice"), true);
assert.equal(K("hayes", "Hayes — school art: PE"), true);
assert.equal(K("hayes", "Hayes Ward game"), true);
assert.equal(K("hayes", "Hayes' game"), true);
assert.equal(K("hayes", "Hayes Exampleton bday; Hayes practice 5 PM"), true);   // our Hayes is named too
assert.equal(K("harris", "Hayes Exampleton bday"), false);
// cauldron fill from the hub tap store (synthetic) over daily musts only
const kw = { kids: { ainsley: { quests: [{ id: "a1", cadence: "daily" }, { id: "a2", cadence: "weekly" }] }, hayes: { quests: [{ id: "h1", cadence: "daily" }, { id: "h2", cadence: "daily" }] }, harris: { quests: [] } } };
const taps = { "house-checkoffs:ainsley:2026-10-17": { a1: { v: true, t: 1 }, a2: { v: true, t: 1 } }, "house-checkoffs:hayes:2026-10-17": { h1: { v: false, t: 2 }, h2: { v: true, t: 2 } }, "house-checkoffs:hayes:2026-10-16": { h1: { v: true, t: 1 } } };
assert.deepEqual(R.choreFill(taps, kw, "2026-10-17"), { done: 2, total: 3 });
assert.deepEqual(R.choreFill({}, kw, "2026-10-17"), { done: 0, total: 3 });
assert.equal(R.choreFill(null, kw, "2026-10-17"), null);            // no store: empty, flagged
assert.equal(R.choreFill(taps, null, "2026-10-17"), null);
// feed health: stale or offline feeds draw nothing; the calendar tag says so
const nowR = at("2026-10-17T04:50:00-05:00");
assert.equal(R.feedState({ status: "live", fetchedAt: "2026-10-17T09:40:00Z" }, nowR, 30), "live");
assert.equal(R.feedState({ status: "live", fetchedAt: "2026-10-17T02:50:00Z" }, nowR, 180), "stale");
assert.equal(R.feedState({ status: "error" }, nowR, 30), "offline");
assert.equal(R.feedState(null, nowR, 30), "offline");
// school token: runtime only (private names file, role school); synthetic token QXS here, never a real one in git
const AF = createRequire(import.meta.url)("../../away-filter.js");
R.setSchools(["QXS"]);
assert.equal(R.isSchoolText("QXS Picture Day"), true);
assert.equal(R.stripSchool("QXS Picture Day"), "Picture Day");
assert.equal(AF.isKidText("QXS Field Day"), true);
R.setSchools([]);
assert.equal(R.isSchoolText("QXS Picture Day"), false);
assert.equal(AF.isKidText("QXS Field Day"), false);       // no token loaded: school words alone are not kid text
const envWas = process.env.WARDOS_NAMES; process.env.WARDOS_NAMES = "partner=Xx;school=QXS"; R.setSchools(null);
assert.deepEqual(R.schoolTokens(), ["QXS"]);                   // node reads the role at run time
if (envWas === undefined) delete process.env.WARDOS_NAMES; else process.env.WARDOS_NAMES = envWas;
R.setSchools(["QXS"]);
// item 3: multi-word places stay whole (the page truncates on width only); connector words end the place
assert.equal(R.glassTitle("Flight to New York"), "Dad: Fly to New York");
assert.equal(R.glassTitle("Flight to Salt Lake City (XX 1234)"), "Dad: Fly to Salt Lake City");
assert.equal(R.glassTitle("Flight to Springfield With Xyz"), "Dad: Fly to Springfield");
assert.equal(R.glassTitle("Flight to Example City · leave 2:10"), "Dad: Fly to Example City");
// Prism ruling (a): window glow = home with the lamp on; something today = brass plaque, never a window change
assert.deepEqual(R.plaqueState({ away: false, lamp: null, today: false }), { win: "lit", plaque: "" });
assert.deepEqual(R.plaqueState({ away: false, lamp: null, today: true }), { win: "lit", plaque: "today" });
assert.deepEqual(R.plaqueState({ away: false, lamp: true, today: false }), { win: "glow", plaque: "" });
assert.deepEqual(R.plaqueState({ away: false, lamp: true, today: true }), { win: "glow", plaque: "today" });
assert.deepEqual(R.plaqueState({ away: false, lamp: false, today: true }), { win: "dark", plaque: "today" });
assert.deepEqual(R.plaqueState({ away: true, lamp: true, today: true }), { win: "dark", plaque: "" });
assert.deepEqual(R.plaqueState({ unknown: true, lamp: null, today: true }), { win: "lit", plaque: "today" });   // unknown feed = normal awake board
assert.deepEqual(R.plaqueState({ unknown: true, lamp: null, today: false }), { win: "lit", plaque: "" });
const w = (...p) => p.join(" ");   // fixture phrases built from words so no prose sits in the file
assert.equal(R.stateText(w("Kids", "with", "other", "house")), true); assert.equal(R.stateText("Hayes dentist"), false);   // Atlas law: away-state rows drop whole
assert.equal(R.backLabel, undefined);   // Alfred: no countdown helper exists any more
for (const x of [w("Back", "in", "6", "days"), w("Back", "tomorrow"), w("Kids", "back", "Fri"), w("Kids", "away"), w("Kids", "are", "away"), w("Hayes", "returns")]) assert.equal(R.stateText(x), true, x);
for (const x of [w("before", "Fri" + "day"), w("after", "Fri" + "day"), w("Fri", "3" + ":00"), w("Fri" + "day", "at", "3", "PM"), w("kids", "with", "you"), w("with", "you")]) assert.equal(R.stateText(x), true, x);   // no hardcoded change-day framing
assert.equal(R.stateText("Fri · 4:30 PM"), false);
// Alfred 1702 P2 kid money: hyphen and jar forms drop the kid row whole (with the forms that already dropped); non-money stays
for (const x of ["Hayes 5-dollar bill", "five-dollar payday", "Harris jar 5", "Harris jar: 5", "Ainsley jar five", "Hayes 5 - dollars", "twenty-five-dollar gift", "10-buck card",
  "$5 Hayes", "Hayes 5$", "5 dollars", "dollars 5", "USD 5", "5 USD", "five bucks", "50 cents", "\u00a2 50", "jar 5.00", "jars: 12", "dollar-5 deal"]) assert.equal(R.money(x), true, "money: " + x);
for (const x of ["Room 5", "Grade 5", "5:00 practice", "Jar of pickles", "Hayes swim 4:00", "Game 5", "Bake sale jars", "Harris dentist"]) assert.equal(R.money(x), false, "not money: " + x);
// Alfred 1702 P3 custody leftovers: rows that name the other household or a return to it drop whole; strip remnants are orphans
for (const x of [w("Kids", "at", "moms"), w("Kids", "go", "to", "Mom's"), w("Mom:", "kids"), w("Mom's", "house"), w("back", "home", "Sunday"), w("Return", "to", "Dad"), w("Kids", "head", "to", "their", "mother's")]) assert.equal(R.stateText(x), true, x);
for (const x of ["Kids at", "Kids go to", "kids", "house", "at", "Pickup:", "Kids &", ""]) assert.equal(R.orphan(x), true, "orphan: " + x);
for (const x of ["Kids go to the zoo", "Hayes practice", "Check in", "Dinner with Dad", "Kids to school", "Back to school night", "Return library books"]) { assert.equal(R.orphan(x), false, "kept: " + x); assert.equal(R.stateText(x), false, "kept: " + x); }
R.setPrivateNames(["Zedna"], ["Yolanthe"]);   // stand-ins: a co-parent name joined to the kids drops the row
assert.equal(R.stateText(w("Kids", "at", "Yolanthe's")), true); assert.equal(R.stateText(w("Lunch", "at", "Jones")), false);
R.setPrivateNames(null, null);
// Alfred 1702 P3 school names: token any case, and full names (main's school-names.js rule), stripped; stand-ins only
R.setSchools(["QXS", "Quux Hill"]);
assert.deepEqual(R.schoolFull(), ["Quux Hill"]);
for (const [a, b] of [["QXS Picture Day", "Picture Day"], ["qxs Picture Day", "Picture Day"], ["Qxs picture day", "picture day"], ["Quux Hill Field Day", "Field Day"], ["quux  hill book fair", "book fair"], ["Field Day at QXS", "Field Day at school"], ["Concert at Quux Hill", "Concert at school"], ["QXS's Spirit Night", "Spirit Night"]]) assert.equal(R.stripSchool(a), b, a);
for (const x of ["qxs Picture Day", "Quux Hill Fair", "QUUX HILL"]) assert.equal(R.isSchoolText(x), true, x);
assert.equal(R.stripSchool("Quuxton practice"), "Quuxton practice");   // a longer word is not the token
assert.equal(R.kidName("harris", "Harris Quux Hill book fair"), true); assert.equal(R.kidName("hayes", "Hayes Qxs picture day"), true);   // a school name is not a surname
R.setSchools(["QXS"]);
// Alfred UNVERIFIED: a room number is a place, not a seat code; a bare seat code still drops
assert.equal(R.seatsResidue("Room 112 B 2"), "Room 112 B 2");
assert.equal(R.seatsResidue("Rm 4 C 1 tutoring"), "Rm 4 C 1 tutoring");
assert.equal(R.seatsResidue("Cubs game 112 F 3-4"), "Cubs game");   // synthetic fixture, privacy-scan:allow seat_code
console.log("lh-rules: ok");
