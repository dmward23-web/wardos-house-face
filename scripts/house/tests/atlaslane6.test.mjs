/* ATLASLANE6 tests: next-up, logistics taps, school-night strip, display renames, zero-$ / no-score guards. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { computeNextUp, timerCopy } from "../../next-up.mjs";
import { computeSchoolNight } from "../../school-night.mjs";
import { computePickupChain } from "../../pickup-chain.mjs";
import { CONTROLS, LATE_CHIPS, SHARED, applyTap, logisticsFor, toHubEntries, fromHubEntries, logisticsFile } from "../logistics-lib.mjs";
import { displayText, displayDeepReport, momHits, moneyHits, moneyText, loadRenames, RENAME_CONFIG } from "../display-rename.mjs";
import { scoreHits } from "../kid-layer-lib.mjs";
import { scanObject, readJson, publicText } from "../lib.mjs";
import { calendar, allDay, KIDS_WEEK, CONFIG, at, ROOT } from "./fixture.mjs";

const timed = (summary, start, end, extra = {}) => ({ summary, start: { dateTime: start }, end: { dateTime: end }, ...extra });
const nu = (now, extra = []) => computeNextUp({ calendar: calendar(extra), now: at(now) });
const LABEL_RE = /^(Hayes|Harris|Ainsley)( \+ (Hayes|Harris|Ainsley))* (pickup|drop-off|ride|swim|baseball|softball|flag|soccer|football|basketball|volleyball|lesson|homework help|tutoring|rehearsal|choir|scouts|camp|practice|game|activity)$/;

/* ---------------- A) next-up ---------------- */
test("next-up: next real leave from the calendar, copy exactly 'Leave h:mm.'", () => {
  let o = nu("2026-10-01T07:30:00-05:00");
  assert.deepEqual(o.next, { label: "Hayes + Harris drop-off", copy: "Leave 8:10.", leaveAt: "8:10", leaveIso: "2026-10-01T08:10:00-05:00", startIso: "2026-10-01T08:10:00-05:00", day: "Today" });
  /* noon: therapy, Midwest Anxiety, GET stub, $ gift, Wells, jar, their-mom pickup, work call all skipped */
  o = nu("2026-10-01T12:00:00-05:00");
  assert.equal(o.next.label, "Harris pickup");
  assert.equal(o.next.copy, "Leave 3:15.");
  o = nu("2026-10-01T15:20:00-05:00");
  assert.deepEqual([o.next.label, o.next.copy], ["Ainsley swim", "Leave 4:25."]);
  o = nu("2026-10-01T16:30:00-05:00");
  assert.deepEqual([o.next.label, o.next.copy], ["Hayes baseball", "Leave 4:55."]);
  for (const s of ["07:30", "12:00", "15:20", "16:30"]) {
    const x = nu(`2026-10-01T${s}:00-05:00`);
    assert.match(x.next.copy, /^Leave \d{1,2}:\d{2}\.$/);
    assert.match(x.next.label, LABEL_RE, "label = names + fixed word, never event text");
    assert.equal(x.timer, null);
    assert.deepEqual(scanObject(x), []);
    assert.deepEqual(momHits(x), []);
  }
});

test("next-up: same leave-by logic as pickup-chain (description leave line, 'Was:' ignored, 'not a leave')", () => {
  const casey = timed("Pick up Hayes at Casey's (Riley's mom)", "2026-10-01T18:30:00-05:00", "2026-10-01T18:55:00-05:00",
    { location: "Casey's (Riley's mom), 9504 W 148th St", description: "Leave-by 6:25pm from Genesis. Event ~6:45pm pickup." });
  const o = nu("2026-10-01T17:00:00-05:00", [casey]);
  assert.deepEqual([o.next.label, o.next.copy], ["Hayes pickup", "Leave 6:25."]);
  assert.doesNotMatch(JSON.stringify(o), /Casey|Riley|mom|148th/i, "no private event text");
  const pc = computePickupChain({ calendar: calendar([casey]), kidsWeek: KIDS_WEEK, config: CONFIG, now: at("2026-10-01T17:00:00-05:00") });
  assert.equal(pc.rows.find((r) => r.startIso === "2026-10-01T18:30:00-05:00").leaveBy, "6:25 PM", "pickup-chain agrees");
  /* history after 'Was:' ignored; conditional leave line used */
  const flag = timed("Harris flag — vs BV Gardner (home) · arrive 1:00 · game 1:30", "2026-10-02T13:00:00-05:00", "2026-10-02T14:30:00-05:00",
    { location: "Heritage Park Soccer Complex, Field 10", description: "Arrive 1:00 · Game 1:30 · Leave-by 12:40 if Dan drives. Was: arrive 1:15 / leave 12:55." });
  assert.equal(nu("2026-10-02T10:00:00-05:00", [flag]).next.copy, "Leave 12:40.");
  /* calendar says it isn't a leave */
  const aw = timed("Hayes flag practice · 6:00", "2026-10-02T09:30:00-05:00", "2026-10-02T10:30:00-05:00", { location: "Fields by the Library", description: "Awareness only — not a leave from 147th." });
  assert.equal(nu("2026-10-02T09:00:00-05:00", [aw]).next, null);
});

test("next-up: needs a real place and Dad's leave; never home/desk/phone/work/stubs; kids away = nothing", () => {
  const extra = [
    timed("Hayes homework help · leave 9:00", "2026-10-02T09:00:00-05:00", "2026-10-02T09:30:00-05:00", { location: "Home, 6719 W 147th Terrace" }),
    timed("Harris carpool call · leave 9:05", "2026-10-02T09:05:00-05:00", "2026-10-02T09:30:00-05:00", { location: "Phone call" }),
    timed("BUY · Hayes cleats · leave 9:10", "2026-10-02T09:10:00-05:00", "2026-10-02T09:30:00-05:00", { location: "Scheels, 1 St" }),
    timed("Desk block — Harris forms · leave 9:12", "2026-10-02T09:12:00-05:00", "2026-10-02T09:30:00-05:00", { location: "Office, 1 St" }),
    timed("Casey picks up Hayes — SRE · 9:40", "2026-10-02T09:15:00-05:00", "2026-10-02T09:45:00-05:00", { location: "Sunset Ridge Elementary, 1 St" }),
  ];
  assert.equal(nu("2026-10-02T08:50:00-05:00", extra).next, null);
  const away = nu("2026-10-05T07:30:00-05:00");
  assert.equal(away.next, null);
  assert.match(away.reason, /^Kids away/);
  /* leave already passed -> the next one */
  assert.equal(nu("2026-10-01T15:16:00-05:00").next.label, "Ainsley swim");
  /* tomorrow's leave carries its day */
  const fri = timed("Hayes + Harris — SRE drop-off · 8:25", "2026-10-02T08:10:00-05:00", "2026-10-02T08:40:00-05:00", { location: "Sunset Ridge Elementary, 14901 England St" });
  const eve = nu("2026-10-01T20:00:00-05:00", [fri]);
  assert.deepEqual([eve.next.copy, eve.next.day], ["Leave 8:10.", "Fri"]);
});

test("next-up timer slot: one timer, Wright owns it; contract {label, endsAt} -> 'Oven 12:00.'", () => {
  const T = at("2026-10-01T17:00:00-05:00");
  assert.equal(timerCopy({ label: "Oven", endsAt: "2026-10-01T17:12:00-05:00" }, T), "Oven 12:00.");
  assert.equal(timerCopy({ label: "Oven", endsAt: "2026-10-01T17:01:01-05:00" }, T), "Oven 1:01.");
  assert.equal(timerCopy({ label: "Oven", endsAt: "2026-10-01T16:00:00-05:00" }, T), "Oven 0:00.", "ends on the board");
  assert.equal(timerCopy(null, T), null);
  assert.equal(timerCopy({ label: "Oven!", endsAt: "2026-10-01T17:12:00-05:00" }, T), null);
  assert.equal(timerCopy({ label: "Oven", endsAt: "soon" }, T), null);
  const f = readJson(path.join(ROOT, "data/next-up.json"));
  assert.equal(f.timer, null);
  assert.ok("next" in f);
});

/* ---------------- B) logistics taps ---------------- */
test("logistics: four taps, fixed chips, no keyboard, nothing sends to a person", () => {
  assert.deepEqual(CONTROLS.map((c) => c.id), ["im-home", "leaving", "check-in", "running-late"]);
  assert.deepEqual(LATE_CHIPS, [5, 10, 15, 20, 30]);
  assert.deepEqual(CONTROLS.find((c) => c.id === "check-in").kids, ["Harris", "Hayes", "Ainsley"]);
  const blob = JSON.stringify(CONTROLS).toLowerCase();
  for (const w of ["sms", "email", "slack", "harbor", "text", "send", "http", "url", "keyboard", "input", "need-ride", "ride"]) assert.ok(!blob.includes(w), w);
  const src = fs.readFileSync(path.join(ROOT, "scripts/house/logistics-lib.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|node:http|child_process|sendMessage|nodemailer/);
  const T = at("2026-10-01T17:40:00-05:00");
  for (const tap of [{ control: "im-home" }, { control: "leaving" }, { control: "check-in", kid: "Hayes" }, { control: "running-late", minutes: 10 }]) {
    const r = applyTap(null, null, tap, T);
    assert.deepEqual(r.effects.sends, []);
    assert.equal(r.effects.thermostat, null, "never the thermostat");
  }
});

test("logistics: Dan's light decisions; status line + who-home are the only writes", () => {
  const T = (hm) => at(`2026-10-01T${hm}:00-05:00`);
  let r = applyTap(null, null, { control: "leaving" }, T("08:05"));
  assert.deepEqual(r.effects.lights, { off: ["dining-room", "harris-room", "kitchen"] });
  assert.equal(r.logistics.status.line, "Leaving 8:05.");
  r = applyTap(r.logistics, r.whoHome, { control: "running-late", minutes: 15 }, T("17:40"));
  assert.equal(r.logistics.status.line, "Running 15 min late.");
  assert.equal(r.effects.lights, null);
  r = applyTap(r.logistics, r.whoHome, { control: "check-in", kid: "Ainsley" }, T("17:52"));
  assert.equal(r.logistics.status.line, "Ainsley home 5:52.");
  assert.equal(r.whoHome.kids.find((k) => k.id === "ainsley").checkedInAt, "2026-10-01T17:52:00-05:00");
  r = applyTap(r.logistics, r.whoHome, { control: "im-home" }, T("18:05"));
  assert.deepEqual(r.effects.lights, { on: ["kitchen", "dining-room"] });
  assert.equal(r.logistics.status.line, "Home 6:05.");
  assert.equal(r.logistics.taps.length, 4);
  /* invalid taps change nothing: no free minutes, no unknown kid, no unknown control */
  for (const bad of [{ control: "running-late", minutes: 7 }, { control: "check-in", kid: "Riley" }, { control: "need-ride" }, { control: "text-mom" }]) {
    const x = applyTap(r.logistics, r.whoHome, bad, T("18:10"));
    assert.equal(x.logistics.taps.length, 4, JSON.stringify(bad));
    assert.equal(x.effects.lights, null);
  }
  /* house day reset at 3:00 AM */
  assert.equal(logisticsFor(r.logistics, at("2026-10-02T02:59:00-05:00")).taps.length, 4);
  assert.equal(logisticsFor(r.logistics, at("2026-10-02T03:00:00-05:00")).status, null);
  for (const line of r.logistics.taps.map((x) => logisticsFor({ taps: [x] }, T("18:10")).status.line)) {
    assert.match(line, /^[A-Z][^!]*\.$/); assert.deepEqual(scanObject({ line }), []);
  }
});

test("logistics: shared key documented and OFF; per-device file; Need a ride stays on Pack", () => {
  assert.equal(SHARED.enabled, false);
  const T = at("2026-10-01T18:00:00-05:00");
  const st = applyTap(applyTap(null, null, { control: "running-late", minutes: 20 }, T - 600000).logistics, null, { control: "check-in", kid: "Harris" }, T).logistics;
  const hub = toHubEntries(st);
  assert.deepEqual(hub.map((e) => [e.key, e.id, e.v]), [["house-logistics:2026-10-01", "late-20", true], ["house-logistics:2026-10-01", "checkin-harris", true]]);
  assert.deepEqual(fromHubEntries(hub, T).taps, st.taps);
  assert.equal(fromHubEntries([{ key: "house-checkoffs:hayes:2026-10-01", id: "home", v: true, t: T }], T).taps.length, 0);
  const f = readJson(path.join(ROOT, "data/logistics-taps.json"));
  assert.equal(f.shared.enabled, false);
  assert.equal(f.perDevice, true);
  assert.equal(f.sendsToPeople, false);
  assert.deepEqual(f.taps, []);
  assert.deepEqual(scanObject(f).concat(momHits(f)), []);
  assert.deepEqual(scanObject(logisticsFile(st, T)), []);
  const pf = readJson(path.join(ROOT, "data/pack-flags.json"));
  assert.deepEqual(Object.keys(pf).sort(), ["clearsAt", "date", "flags"], "pack-flags unchanged");
});

/* ---------------- C) school-night strip ---------------- */
const sn = (now, extra = [], packFlags = null) => computeSchoolNight({ calendar: calendar(extra), kidsWeek: KIDS_WEEK, config: CONFIG, packFlags, now: at(now) });
const BASE_KEYS = ["asOfIso", "generatedAt", "visibleFrom", "visibleUntil", "visibleFromIso", "visibleUntilIso", "schoolNight", "visible"].sort();

test("school-night: 3:00-7:00 PM on school nights only; gone outside with no placeholder", () => {
  for (const [now, sch] of [["2026-10-01T14:59:00-05:00", true], ["2026-10-01T19:00:00-05:00", true], ["2026-10-02T16:00:00-05:00", false],
    ["2026-10-05T16:00:00-05:00", false], ["2026-10-08T16:00:00-05:00", false]]) {
    const o = sn(now);
    assert.equal(o.visible, false, now);
    assert.equal(o.schoolNight, sch, now);
    assert.deepEqual(Object.keys(o).sort(), BASE_KEYS, `${now}: no placeholder content`);
  }
  const o = sn("2026-10-01T15:00:00-05:00");
  assert.equal(o.visible, true);
  assert.equal(o.visibleFrom, "15:00"); assert.equal(o.visibleUntil, "19:00");
  assert.equal(o.visibleUntilIso, "2026-10-01T19:00:00-05:00");
  /* Sunday with school Monday (kids home) shows; a weekday Day off doesn't, even with school tomorrow */
  assert.equal(sn("2026-10-11T16:00:00-05:00").visible, true, "Sun Oct 11, school Mon");
  assert.equal(sn("2026-10-12T16:00:00-05:00").visible, true, "Johnson Kids no-school is another family: Tue is a school day");
  const off = sn("2026-10-14T16:00:00-05:00", [allDay("Ward Kids [AHH No School]", "2026-10-14", "2026-10-15")]);
  assert.equal(off.visible, false, "Day off night");
});

test("school-night: pickup from pickup-chain, gear from real events + Pack, real form only, weather source needed", () => {
  const flags = { flags: [{ kid: "Hayes", text: "Library book", createdAt: "2026-10-01T07:00:00-05:00" }] };
  let o = sn("2026-10-01T15:05:00-05:00", [], flags);
  assert.deepEqual(o.pickup.map((p) => [p.label, p.time, p.leaveBy, p.by]), [["Harris pickup", "3:40", "3:15", "Dad"], ["Hayes pickup", "3:40", null, "Casey"],
    ["Hayes pickup", "6:20", null, "Dad"], ["Harris pickup", "6:59", null, null]]);
  assert.equal(o.pickup[0].copy, "Harris pickup 3:40. Leave 3:15.");
  assert.equal(o.pickup[1].copy, "Hayes pickup 3:40 · Casey.", "someone else's pickup names the driver, no leave, no parent words");
  const gear = Object.fromEntries(o.gear.map((g) => [g.who, g.items]));
  assert.deepEqual(gear.Ainsley, ["Swim bag"]);
  assert.deepEqual(gear.Hayes.sort(), ["Baseball bag", "Cleats", "Glove", "Library book"].sort());
  assert.equal(o.form, undefined, "no real form in the fixture -> omitted (the GET stub never counts)");
  assert.equal(o.weather, null);
  assert.equal(o.weatherSource, "source needed");
  /* a real due item on the calendar */
  const due = timed("Ainsley — LKMS baby pic due · 3pm", "2026-10-02T12:00:00-05:00", "2026-10-02T12:15:00-05:00", { location: "Lakewood Middle School" });
  o = sn("2026-10-01T16:00:00-05:00", [due]);
  assert.equal(o.form.copy, "Ainsley · LKMS baby pic due Fri 3:00.");
  assert.equal(o.form.dueIso, "2026-10-02T15:00:00-05:00");
  /* tomorrow's gear from the event title */
  const pe = timed("Hayes — SRE specials: PE + Library (tennis shoes, library book)", "2026-10-02T07:00:00-05:00", "2026-10-02T07:15:00-05:00", { location: "Sunset Ridge Elementary" });
  o = sn("2026-10-01T16:00:00-05:00", [pe]);
  assert.ok(o.gear.find((g) => g.who === "Hayes").items.includes("Tennis shoes"));
  for (const x of [o, sn("2026-10-01T18:30:00-05:00", [due, pe], flags)]) { assert.deepEqual(scanObject(x), []); assert.deepEqual(momHits(x), []); }
  const f = readJson(path.join(ROOT, "data/school-night.json"));
  assert.deepEqual(scanObject(f).concat(momHits(f)), []);
  if (!f.visible) assert.deepEqual(Object.keys(f).sort(), BASE_KEYS);
});

/* ---------------- display renames (DAN RULING t2812u #2) ---------------- */
/* ATLASLANE9: the real raw-title patterns are private (box file, outside the published repo), so this test uses synthetic
   private rules (Zia / Zio) through the same env override the builders read. The real examples are checked in atlaslane9. */
test("display rename: private patterns + public display strings (synthetic), parent scrub, cal-months.py parity", () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "atlas6-rename-"));
  const pfp = path.join(T, "private.json");
  fs.writeFileSync(pfp, JSON.stringify({ renames: [
    { id: "nonna-papa", pattern: "\\bZia\\s*(?:&|and|\\+|/)\\s*Zio\\b" },
    { id: "nonna-birthday", pattern: "(?<!'s )\\bZia birthday\\b" },
  ] }));
  const rules = loadRenames(RENAME_CONFIG, pfp);
  assert.equal(rules.privateLoaded, true);
  assert.equal(displayText("Zia & Zio in KC", rules), "Nonna and Papa in KC");
  assert.equal(displayText("Erin + Zia/Zio · MCI curb · WN2480 9:10", rules), "Erin + Nonna and Papa · MCI curb · WN2480 9:10");
  assert.equal(displayText("Zia birthday", rules), "Nonna birthday");
  assert.equal(displayText("Riley's Zia birthday", rules), "Riley's Zia birthday", "someone else's: never renamed to Nonna");
  assert.equal(displayText("Erin drop Hayes", rules), "Erin drop Hayes");
  assert.equal(displayText("Pick up Hayes at Casey's (Riley's mom)", rules), "Pick up Hayes at Casey's");
  assert.equal(displayText("Harris — provider in-home @ mom’s · 4:00", rules), null);
  const none = loadRenames(RENAME_CONFIG, path.join(T, "absent.json"));
  assert.equal(displayText("Zia & Zio in KC", none), "Zia & Zio in KC", "no private file: no renames");
  const rep = displayDeepReport({ days: { a: { items: [{ l: "Zia birthday" }, { l: "x @ mom’s" }] } } }, rules);
  assert.deepEqual(rep.value, { days: { a: { items: [{ l: "Nonna birthday" }] } } });
  const old = process.env.WARDOS_DISPLAY_RENAME_PRIVATE;
  process.env.WARDOS_DISPLAY_RENAME_PRIVATE = pfp;
  try { assert.equal(publicText("Zia & Zio in KC"), "Nonna and Papa in KC", "public text path uses the rename"); }
  finally { if (old === undefined) delete process.env.WARDOS_DISPLAY_RENAME_PRIVATE; else process.env.WARDOS_DISPLAY_RENAME_PRIVATE = old; }
  /* cal-months.py reads the same public config + private file: parity */
  const py = `import json,os,re\nsrc=open(${JSON.stringify(path.join(ROOT, "scripts/cal-months.py"))}).read()\nns={'json':json,'os':os,'re':re,'__file__':${JSON.stringify(path.join(ROOT, "scripts/cal-months.py"))}}\nexec(src[src.index('# ATLASLANE6'):src.index('BLOCK = re.compile(')],ns)\nprint(json.dumps([ns['display'](s) for s in json.loads(input())]))`;
  const cases = ["Zia & Zio in KC", "Erin + Zia/Zio · MCI curb", "Zia birthday", "Harris — provider in-home @ mom’s · 4:00", "LKMS yearbook order ($30) · 12:00", "Babysit $15/hr"];
  const r = spawnSync("python3", ["-c", py], { input: JSON.stringify(cases) + "\n", encoding: "utf8", env: { ...process.env, WARDOS_DISPLAY_RENAME_PRIVATE: pfp } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), ["Nonna and Papa in KC", "Erin + Nonna and Papa · MCI curb", "Nonna birthday", null, "LKMS yearbook order · 12:00", "Babysit $15/hr"]);
  fs.rmSync(T, { recursive: true, force: true });
  /* every builder that writes public calendar data runs the pass */
  for (const f of ["scripts/calendar-refresh.mjs", "scripts/cal-from-events.mjs"]) assert.match(fs.readFileSync(path.join(ROOT, f), "utf8"), /displayDeep\(/, f);
  assert.match(fs.readFileSync(path.join(ROOT, "scripts/cal-months.py"), "utf8"), /label = display\(scrub\(summ\)\)/);
});

const PUBLIC = ["data/cal-months.json", "data/cal-live.json", "data/kids-week.json", "kids-week.json", "data/next-up.json", "data/school-night.json",
  "data/logistics-taps.json", "data/pickup-chain.json", "data/house-mode.json", "data/kid-seats.json", "data/unlocks.json", "data/unlock-uses.json", "data/who-home.json", "data/pack-flags.json"];
function load(rel) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) return null;
  return readJson(fp);
}
test("no 'Mom' anywhere in public wall data (incl. kids-data.js EMBEDDED)", () => {
  for (const rel of PUBLIC) { const o = load(rel); if (o) assert.deepEqual(momHits(o), [], rel); }
  const js = fs.readFileSync(path.join(ROOT, "kids-data.js"), "utf8");
  const m = /var EMBEDDED = (\{[\s\S]*?\});/.exec(js);
  assert.ok(m);
  assert.deepEqual(momHits(JSON.parse(m[1])), [], "kids-data.js EMBEDDED");
});

/* ---------------- D) zero $ + no score (DAN RULING #1: '$15/hr' is the one exception) ---------------- */
test("zero $ in Atlas lane data; '$15/hr' is the only allowed dollar string", () => {
  assert.deepEqual(moneyHits({ rateLabel: "$15/hr" }), [], "whitelisted exact tag");
  assert.equal(moneyText("$15/hr"), "$15/hr");
  assert.ok(moneyHits({ a: "Tour Jar · $20" }).length);
  assert.ok(moneyHits({ a: "$16/hr" }).length, "only the exact tag");
  for (const rel of ["data/cal-months.json", "data/cal-live.json", "data/next-up.json", "data/school-night.json", "data/logistics-taps.json", "data/pickup-chain.json",
    "data/house-mode.json", "data/kid-seats.json", "data/unlocks.json", "data/unlock-uses.json", "data/who-home.json", "data/pack-flags.json", "config/kid-layer.config.json"]) {
    const o = load(rel); if (o) assert.deepEqual(moneyHits(o), [], rel);
  }
  /* Ainsley's tag survives the build pass (restored if anything stripped it) */
  const kw = load("data/kids-week.json");
  const sit = kw.kids.ainsley.quests.find((q) => q.id === "ain-babysit");
  assert.equal(sit.rateLabel, "$15/hr");
  assert.equal(displayDeepReport(kw).value.kids.ainsley.quests.find((q) => q.id === "ain-babysit").rateLabel, "$15/hr");
});

test("Alfred KL-05 under the chore law (ATLASLANE8): Ainsley gets no stars and no counts, trusted-with only", () => {
  const ks = load("data/kid-seats.json");
  const a = ks.seats.ainsley;
  assert.ok(Object.keys(a).every((k) => ["name", "week", "musts", "today", "trustedWith", "line", "mystery", "copy"].includes(k)), JSON.stringify(Object.keys(a)));
  assert.deepEqual(Object.keys(a.week), ["closed"]);
  assert.deepEqual(scoreHits(ks), []);
  assert.ok(scoreHits({ seats: { ainsley: { chip: "XP 0/8" } } }).length);
  assert.ok(scoreHits({ seats: { ainsley: { done: 3 } } }).length);
  assert.ok(scoreHits({ seats: { ainsley: { copy: "10 points" } } }).length);
  assert.ok(scoreHits({ copy: "$10" }).length, "no dollar sign anywhere");
  /* the law gives the brothers a run of days (Harris pauses, Hayes restarts): a number there is allowed */
  assert.deepEqual(scoreHits({ seats: { hayes: { streak: { days: 3 } } } }), []);
});
