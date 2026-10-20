// node livinghouse/tests/lh-l3.test.mjs
// Layer 3: school morning for the two boys, long-press text, audience mode. Synthetic fixtures only.
process.env.TZ = "America/Chicago";
import { assertSealed } from "../../scripts/qa/temp-home.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
assertSealed();
const req = createRequire(import.meta.url);
req("../../house-face-law.js");
const R = req("../lh-rules.js");
const A = req("../../away-filter.js");
const LeaveBy = req("../../phone2/leaveby.js");
const L3 = req("../lh-l3.js");
const L = globalThis.HouseFaceLaw;
const ms = (s) => Date.parse(s);

function show(s) {
  let t = R.glassTitle(String(s || ""));
  t = R.stripSchool(t);
  t = R.seatsResidue(t);
  if (!t || R.orphan(t) || R.stateText(t) || R.money(t) || (L && L.isCustody(t))) return "";
  try { if (L && L.faceText) t = L.faceText(t); } catch (e) { /* keep t */ }
  t = R.seatsResidue(t);
  if (!t || R.stateText(t) || R.money(t)) return "";
  return t;
}
function allow(ev) {
  const s = String(ev.summary || "");
  return !R.money(s) && !R.stateText(s) && !R.otherPerson(s) && !(L && L.isDressDay && L.isDressDay(s));
}
function run(now, cal, months, extra) {
  A.setMonths(months || null);
  const away = !!(A.hasMonths() && A.isAwayAt(ms(now)));
  return L3.schoolMorning(Object.assign({
    nowMs: ms(now), away, cal, raws: cal && cal.upcomingLeaves, keepItem: (ev, t) => !A.hasMonths() || A.keepItem(ev, t),
    find: LeaveBy.find, show, allow, rules: R
  }, extra || {}));
}
const home = (days) => ({ changeMin: 900, days });
const span = (from, to, withDan) => {
  const days = {};
  for (let t = Date.parse(from + "T12:00:00Z"), end = Date.parse(to + "T12:00:00Z"); t <= end; t += 864e5) {
    days[new Date(t).toISOString().slice(0, 10)] = { withDan: withDan };
  }
  return days;
};

const school = {
  upcomingLeaves: [
    { id: "h1", summary: "Hayes item 1 leave 7:05", start: "2026-10-20T07:40:00-05:00", end: "2026-10-20T15:00:00-05:00", allDay: false },
    { id: "r1", summary: "Harris item 1", start: "2026-10-20T08:00:00-05:00", end: "2026-10-20T15:00:00-05:00", allDay: false },
    { id: "a1", summary: "Ainsley item 1 leave 7:20", start: "2026-10-20T07:50:00-05:00", end: "2026-10-20T15:00:00-05:00", allDay: false },
    { id: "late", summary: "Hayes afternoon practice", start: "2026-10-20T16:00:00-05:00", end: "2026-10-20T17:00:00-05:00", allDay: false }
  ]
};
const monthsHome = home(span("2026-10-01", "2026-12-31", true));

// school morning 6:30: both boys, leave only when leaveby finds one, Ainsley is not in the sequence
{
  const r = run("2026-10-20T06:30:00-05:00", school, monthsHome);
  assert.equal(r.active, true); assert.equal(r.why, "on"); assert.equal(r.feed, "live"); assert.equal(r.moonSet, true);
  assert.deepEqual(r.lines.map((x) => x.kid), ["hayes", "harris"]);
  assert.equal(r.lines[0].leave, true);
  assert.equal(r.lines[0].text, "Hayes · Leave 7:05 AM");
  assert.equal(r.lines[1].leave, false);
  assert.equal(r.lines[1].text, "Harris · Item 1 8:00 AM");
  assert.ok(!/\bleave\b/i.test(r.lines[1].text), "no guessed leave");
  assert.ok(!r.lines.some((x) => x.kid === "ainsley"));
}
assert.equal(run("2026-10-20T06:29:00-05:00", school, monthsHome).why, "before");
assert.equal(run("2026-10-20T08:30:00-05:00", school, monthsHome).why, "after");
assert.equal(run("2026-10-20T05:30:00-05:00", school, monthsHome).active, false);

// away day: no lines, even with the same events moved onto that morning
{
  const awayCal = { upcomingLeaves: school.upcomingLeaves.map((e) => Object.assign({}, e, {
    start: e.start.replace("2026-10-20", "2026-10-21"), end: e.end.replace("2026-10-20", "2026-10-21")
  })) };
  const days = span("2026-10-01", "2026-12-31", true);
  days["2026-10-21"] = { withDan: false };
  const r = run("2026-10-21T06:30:00-05:00", awayCal, home(days));
  assert.equal(r.active, false); assert.equal(r.why, "away"); assert.equal(r.lines.length, 0); assert.equal(r.moonSet, false);
}

// return morning stays away until the feed's change minute, so the sequence stays off
{
  const days = span("2026-10-01", "2026-12-31", true);
  days["2026-10-21"] = { withDan: false };
  const r = run("2026-10-22T06:30:00-05:00", school, home(days));
  assert.equal(A.isAwayAt(ms("2026-10-22T06:30:00-05:00")), true);
  assert.equal(r.why, "away"); assert.equal(r.lines.length, 0);
}

// switch day, no change minute: kid items are held, so the sequence does not run
{
  const days = { "2026-10-19": { withDan: true }, "2026-10-20": { withDan: true }, "2026-10-21": { withDan: false } };
  const r = run("2026-10-20T06:30:00-05:00", school, { days });
  assert.equal(A.isAwayAt(ms("2026-10-20T06:30:00-05:00")), false);
  assert.equal(r.why, "held"); assert.equal(r.lines.length, 0);
}

// missing feed: empty and flagged, and a missing months feed is not an away day
{
  const r = run("2026-10-20T06:30:00-05:00", null, null);
  assert.equal(r.active, false); assert.equal(r.why, "missing"); assert.equal(r.feed, "missing"); assert.equal(r.lines.length, 0);
  assert.equal(A.hasMonths(), false); assert.equal(A.isAwayAt(ms("2026-10-20T06:30:00-05:00")), false);
}

// Dad day (home afternoon) is not the school sequence. Oct 24, Oct 31, Nov 1 are not school mornings. Dec 1 is.
assert.equal(run("2026-10-22T15:00:00-05:00", school, monthsHome).why, "after");
assert.equal(run("2026-10-24T06:30:00-05:00", school, monthsHome).why, "weekend");
assert.equal(run("2026-10-31T06:30:00-05:00", school, monthsHome).why, "weekend");
assert.equal(run("2026-11-01T06:30:00-06:00", school, monthsHome).why, "weekend");
{
  const dec = { upcomingLeaves: [
    { id: "h1", summary: "Hayes item 1 leave 7:05", start: "2026-12-01T07:40:00-06:00", end: "2026-12-01T15:00:00-06:00", allDay: false },
    { id: "r1", summary: "Harris item 1", start: "2026-12-01T08:00:00-06:00", end: "2026-12-01T15:00:00-06:00", allDay: false }
  ] };
  const r = run("2026-12-01T06:30:00-06:00", dec, monthsHome);
  assert.equal(r.why, "on");
  assert.equal(r.lines[0].text, "Hayes · Leave 7:05 AM");
  assert.equal(r.lines[1].text, "Harris · Item 1 8:00 AM");
}

// no school drops the sequence; one boy's no-school day leaves the other boy
{
  const off = { upcomingLeaves: school.upcomingLeaves.concat([{ id: "ns", summary: "No School", start: "2026-10-20", end: "2026-10-21", allDay: true }]) };
  assert.equal(run("2026-10-20T06:30:00-05:00", off, monthsHome).why, "noschool");
  const one = { upcomingLeaves: school.upcomingLeaves.concat([{ id: "ns", summary: "Hayes No School", start: "2026-10-20", end: "2026-10-21", allDay: true }]) };
  const r = run("2026-10-20T06:30:00-05:00", one, monthsHome);
  assert.equal(r.why, "on");
  assert.deepEqual(r.lines.map((x) => x.kid), ["harris"]);
}

// money, dress-up, and someone else's Hayes never become a line. No leave word when leaveby finds nothing.
{
  const bad = { upcomingLeaves: [
    { id: "m", summary: "Hayes earned 5 dollars", start: "2026-10-20T07:30:00-05:00", end: "2026-10-20T08:00:00-05:00", allDay: false },
    { id: "d", summary: "Harris spirit day", start: "2026-10-20T08:00:00-05:00", end: "2026-10-20T09:00:00-05:00", allDay: false },
    { id: "o", summary: "Hayes Exampleton practice", start: "2026-10-20T07:00:00-05:00", end: "2026-10-20T08:00:00-05:00", allDay: false }
  ] };
  const r = run("2026-10-20T06:30:00-05:00", bad, monthsHome);
  assert.equal(r.lines.length, 0);
  const plain = { upcomingLeaves: [{ id: "p", summary: "Harris item 1", start: "2026-10-20T08:00:00-05:00", end: "2026-10-20T09:00:00-05:00", allDay: false }] };
  const q = run("2026-10-20T06:30:00-05:00", plain, monthsHome, { find: () => null });
  assert.equal(q.lines.length, 1); assert.equal(q.lines[0].leave, false); assert.ok(!/\bleave\b/i.test(q.lines[0].text));
}

// a later leave keeps the sequence up past 8:30, and not past 10:00
{
  const late = { upcomingLeaves: [{ id: "h", summary: "Hayes item 1 leave 9:00", start: "2026-10-20T09:20:00-05:00", end: "2026-10-20T15:00:00-05:00", allDay: false }] };
  assert.equal(run("2026-10-20T08:40:00-05:00", late, monthsHome).why, "on");
  assert.equal(run("2026-10-20T09:36:00-05:00", late, monthsHome).why, "after");
}

// voice is a muted hook: it does not speak
assert.equal(L3.voice.muted, true);
assert.equal(L3.voice.speak("Moon clock"), false);
const l3src = fs.readFileSync(new URL("../lh-l3.js", import.meta.url), "utf8");
assert.ok(!/speechSynthesis\s*\.\s*speak/.test(l3src), "speech is not called");
assert.ok(!/Date\.now\(\)|new Date\(\)/.test(l3src), "lh-l3 does not read the current clock");

// long-press copy: text first; away days add no kid, candle, or stone line
assert.equal(L3.pressCopy("sign", { away: true }), "The Ward's");
assert.equal(L3.pressCopy("moon", {}), "Moon clock");
assert.equal(L3.pressCopy("dad", {}), "Dad");
assert.equal(L3.pressCopy("window", { away: true, line: "Hayes · Leave 7:05 AM" }), "");
assert.equal(L3.pressCopy("candle", { away: true, line: "Today · Leave 7:05 AM" }), "");
assert.equal(L3.pressCopy("stone", { away: true, line: "Hayes · item 1" }), "");
assert.equal(L3.pressCopy("window", { line: "Harris · item 1 8:00 AM" }), "Harris · item 1 8:00 AM");
assert.equal(L3.pressCopy("candle", { audience: "guest", danOnly: true, line: "Dad: Example Fest" }), "");
assert.equal(L3.pressCopy("cauldron", { line: "" }), "Chores");

// audience: kid hours by default, guest and dan only by an explicit choice
assert.equal(L3.audienceFrom("", ""), "kids");
assert.equal(L3.audienceFrom("nope", "nope"), "kids");
assert.equal(L3.audienceFrom("guest", "dan"), "guest");
assert.equal(L3.audienceFrom("", "dan"), "dan");
assert.equal(L3.cycleAudience("kids", "tap"), "guest");
assert.equal(L3.cycleAudience("guest", "tap"), "kids");
assert.equal(L3.cycleAudience("dan", "tap"), "kids");
assert.equal(L3.cycleAudience("kids", "hold"), "dan");
assert.equal(L3.audienceLabel("kids"), "Audience");
assert.equal(L3.audienceLabel("guest"), "Family");
assert.equal(L3.danOnlyText("Dad: Example Fest"), true);
assert.equal(L3.danOnlyText("Example Fest with Sam · leave 4:10"), true);
assert.equal(L3.danOnlyText("Dad: Hayes dentist"), false);
assert.equal(L3.danOnlyText("Hayes item 1"), false);
assert.equal(L3.danOnlyText("Dinner with Dad"), false);

// page wiring, and no away-state words in the new copy
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = fs.readFileSync(new URL("../lh.js", import.meta.url), "utf8");
assert.ok(html.indexOf('src="lh-l3.js') < html.indexOf('src="lh.js'), "layer 3 rules load before the page");
assert.match(html, /data-voice="muted"/);
assert.match(html, /id="lh-rough"[^>]*data-feed="missing"/);
assert.match(html, /id="lh-partner"[^>]*data-feed="missing"/);
assert.ok(!/speechSynthesis/.test(js), "the page never calls speech");
const feeds = fs.readFileSync(new URL("../FEEDS.md", import.meta.url), "utf8");
assert.match(feeds, /MUTED HOOK/);
assert.match(feeds, /data-morning=missing/);
const vis = [...html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/>([^<]+)</g)].map((m) => m[1].trim()).filter(Boolean);
assert.deepEqual(vis.filter((s) => R.stateText(s)), []);
for (const file of [l3src, vis.join("\n")]) {
  assert.ok(!/kids away|back in \d+|dad week|\bcustody\b|smith/i.test(file), "no away-state copy");
}

console.log("lh-l3: ok");
