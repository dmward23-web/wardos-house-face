// PANEL1 · node scripts/wall/panel.test.mjs · FIVE UPGRADES: setpoint (no key = no request, debounce = one request per settled side),
// Kasa toggles, house timer (Atlas timer slot shape), Atlas ATLASLANE6 readers on the REAL contracts (next-up, logistics-taps,
// school-night), display renames from config/display-rename.json, field weather from the existing Open-Meteo forecast.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const P = require("../../house-wall-panel.js");
const LS = require("../../house-wall-lists.js");
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const NOW = Date.parse("2026-10-01T16:30:00-05:00");
const mem = () => { const m = {}; return { get: (k) => (k in m ? m[k] : null), set: (k, v) => { m[k] = String(v); }, m }; };
function clock() { let c = NOW; const q = []; return { now: () => c, setTimeout: (fn, ms) => { const h = { at: c + ms, fn }; q.push(h); return h; }, clearTimeout: (h) => { const i = q.indexOf(h); if (i >= 0) q.splice(i, 1); },
  async tick(ms) { c += ms; q.sort((a, b) => a.at - b.at); while (q.length && q[0].at <= c) await q.shift().fn(); } }; }
function fakeFetch(log, th) { return (u, o) => { log.push([u, o && o.body ? JSON.parse(o.body) : null]); const b = JSON.parse(o.body);
  const nt = { ...th, [b.mode === "heat" ? "heatSetpoint" : "coolSetpoint"]: b.temp }; return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, thermostat: nt }) }); }; }
const AUTO = { online: true, ambient: 72, mode: "auto", heatSetpoint: 65, coolSetpoint: 73 };

await t("setpoint: no key -> no rows, bump sends nothing, zero requests", async () => {
  const log = [], c = clock();
  const sp = P.createSetpoint({ fetch: fakeFetch(log, AUTO), getToken: () => "", getBase: () => "https://hub.invalid", getReading: () => AUTO, ...c });
  assert.equal(sp.view().reason, "NEED KEY"); assert.equal(sp.bump("heat", 1).ok, false);
  await c.tick(5000); assert.equal(log.length, 0);
});
await t("setpoint: three taps then settle -> ONE request with the final value", async () => {
  const log = [], c = clock();
  const sp = P.createSetpoint({ fetch: fakeFetch(log, AUTO), getToken: () => "k", getBase: () => "https://hub.invalid", getReading: () => AUTO, ...c });
  sp.bump("heat", 1); await c.tick(500); sp.bump("heat", 1); await c.tick(500); sp.bump("heat", -1);
  assert.equal(log.length, 0, "nothing before it settles");
  await c.tick(P.DEBOUNCE_MS + 10);
  assert.equal(log.length, 1);
  assert.equal(log[0][0], "https://hub.invalid/api/sensi/set");
  assert.deepEqual(log[0][1], { kind: "temp", mode: "heat", temp: 66 });
});
await t("setpoint: net zero change -> no request", async () => {
  const log = [], c = clock();
  const sp = P.createSetpoint({ fetch: fakeFetch(log, AUTO), getToken: () => "k", getBase: () => "b", getReading: () => AUTO, ...c });
  sp.bump("cool", 1); sp.bump("cool", -1); await c.tick(5000); assert.equal(log.length, 0);
});
await t("setpoint: auto, both sides changed -> one request per side", async () => {
  const log = [], c = clock();
  const sp = P.createSetpoint({ fetch: fakeFetch(log, AUTO), getToken: () => "k", getBase: () => "b", getReading: () => AUTO, ...c });
  sp.bump("heat", -1); sp.bump("cool", 1); await c.tick(5000);
  assert.deepEqual(log.map((x) => x[1]), [{ kind: "temp", mode: "heat", temp: 64 }, { kind: "temp", mode: "cool", temp: 74 }]);
});
await t("setpoint: deadband 3 held in auto; clamp 50-90", () => {
  const sp = P.createSetpoint({ getToken: () => "k", getBase: () => "b", getReading: () => ({ ...AUTO, heatSetpoint: 70, coolSetpoint: 73 }), setTimeout: () => 0, clearTimeout: () => {} });
  assert.equal(sp.bump("heat", 1).reason, "deadband");
  const lo = P.createSetpoint({ getToken: () => "k", getBase: () => "b", getReading: () => ({ online: true, mode: "heat", heatSetpoint: 50 }), setTimeout: () => 0, clearTimeout: () => {} });
  assert.equal(lo.bump("heat", -1).value, 50);
});
await t("setpoint: Travel on / system off / offline / no live reading -> no steps", () => {
  const mk = (th) => P.createSetpoint({ getToken: () => "k", getBase: () => "b", getReading: () => th }).view();
  assert.equal(mk({ ...AUTO, heatSetpoint: 55, coolSetpoint: 85 }).reason, "Travel is on");
  assert.equal(mk({ ...AUTO, mode: "off" }).reason, "System off");
  assert.equal(mk({ ...AUTO, online: false }).reason, "Thermostat offline");
  assert.equal(mk(null).reason, "no live reading");
  assert.equal(mk({ ...AUTO, mode: "heat" }).rows.length, 1);
});
await t("Kasa toggles: existing roster only; no key -> disabled and toggle sends nothing", () => {
  const eff = { canWrite: true, lights: [{ id: "dining-room", name: "Dining Room", on: true }, { id: "harris-room", name: "Harris's Room", on: false }, { id: "kitchen", name: "Kitchen", on: null }] };
  const calls = [], L = { setLight: (id, p) => calls.push([id, p.on]) };
  assert.ok(P.lightToggles(eff, false).every((x) => x.disabled && x.sub === "NEED KEY"));
  assert.equal(P.toggleLight(L, eff, "dining-room", false).sent, 0); assert.equal(calls.length, 0);
  assert.equal(P.toggleLight(L, eff, "dining-room", true).sent, 1); assert.deepEqual(calls, [["dining-room", false]]);
  assert.equal(P.toggleLight(L, eff, "kitchen", true).sent, 0, "unknown state is not guessed");
  assert.deepEqual(P.lightToggles(eff, true).map((x) => x.id), ["dining-room", "harris-room", "kitchen"]);
});
await t("timer: fixed chips only; label chip; Atlas slot {label, endsAt ISO+offset}; reads 'Oven 12:00.'", () => {
  const s = mem();
  assert.equal(P.setTimer(s, 7, "Oven", NOW), null);
  const j = P.setTimer(s, 15, "Oven", NOW);
  assert.deepEqual(Object.keys(j), ["label", "endsAt"]);
  assert.equal(j.endsAt, "2026-10-01T16:45:00-05:00");
  assert.equal(P.timerView(s, NOW + 3 * 60000).text, "Oven 12:00.");
  assert.equal(P.timerView(s, NOW + 3 * 60000 + 500).text, "Oven 12:00.", "11:59.5 left -> m:ss rounded up");
  P.setTimer(s, 5, "Pizza", NOW); assert.equal(P.timerView(s, NOW).text, "Timer 5:00.", "unknown label -> plain Timer");
  s.set(P.TIMER_KEY, JSON.stringify({ label: "Oven!", endsAt: "2026-10-01T16:45:00-05:00" })); assert.equal(P.timerView(s, NOW), null, "invalid label renders nothing");
  s.set(P.TIMER_KEY, JSON.stringify({ label: "Oven", endsAt: 1790000000000 })); assert.equal(P.timerView(s, NOW), null, "endsAt must be an ISO string");
});
await t("timer: one object (a new set replaces), persists across reload (same store)", () => {
  const s = mem(); P.setTimer(s, 10, "Bath", NOW); P.setTimer(s, 20, "Laundry", NOW);
  assert.equal(P.timerView(s, NOW).text, "Laundry 20:00.");
  const reloaded = { get: s.get, set: s.set };
  assert.equal(P.timerView(reloaded, NOW + 60000).text, "Laundry 19:00.");
  assert.deepEqual(Object.keys(s.m), [P.TIMER_KEY]);
});
await t("timer: ends on the board then clears; module never touches lights or network", () => {
  const s = mem(); P.setTimer(s, 5, "Oven", NOW);
  const v = P.timerView(s, NOW + 5 * 60000); assert.equal(v.ended, true); assert.equal(v.text, "Oven 0:00.", "clamps at 0:00.");
  P.clearTimer(s); assert.equal(P.timerView(s, NOW), null);
  const src = require("node:fs").readFileSync(new URL("../../house-wall-panel.js", import.meta.url), "utf8");
  const timerSrc = src.slice(src.indexOf("/* House timer */"));
  assert.doesNotMatch(timerSrc, /setLight|fetch|flash/);
});
const fs = require("node:fs");
const J = (f) => JSON.parse(fs.readFileSync(new URL("../../" + f, import.meta.url), "utf8"));
const R = LS.compileRenames(J("config/display-rename.json"));
const AT = Date.parse("2026-10-01T18:40:00-05:00"); /* the files' own run window (generated 6:34-6:35 PM CT) */
await t("ATLASLANE6 readers: absent -> null (tiles hidden)", () => {
  assert.equal(LS.leaveLine(null, NOW), null); assert.equal(LS.logisticsControls(null, NOW), null); assert.equal(LS.schoolNight(null, NOW), null);
  assert.equal(LS.fieldGame(null, NOW), null); assert.equal(LS.fieldWeather(null, null), null);
});
await t("next-up.json (ATLAS-DATA-LANE.md NEXT UP): real file -> 'Hayes + Harris drop-off · Leave 8:10. (Fri)'", () => {
  const j = J("data/next-up.json");
  assert.deepEqual(Object.keys(j.next).sort(), ["copy", "day", "label", "leaveAt", "leaveIso", "startIso"]);
  assert.equal(LS.leaveLine(j, AT, R).text, "Hayes + Harris drop-off \u00b7 Leave 8:10. (Fri)");
  const today = { ...j, next: { ...j.next, day: "Today", leaveIso: "2026-10-01T18:55:00-05:00", copy: "Leave 6:55." } };
  assert.equal(LS.leaveLine(today, AT, R).text, "Hayes + Harris drop-off \u00b7 Leave 6:55.", "Today adds no day tag");
  assert.equal(LS.leaveLine({ ...j, next: null }, AT, R), null, "next null -> hidden");
  assert.equal(LS.leaveLine({ ...j, next: { ...j.next, copy: "Leave at 8:10 AM!" } }, AT, R), null, "copy must be exactly 'Leave h:mm.'");
  assert.equal(LS.leaveLine(j, Date.parse("2026-10-02T08:11:00-05:00"), R), null, "passed / next day -> hidden");
  assert.equal(LS.leaveLine({ ...j, generatedAt: "2026-10-01T09:00:00-05:00" }, AT, R), null, "stale -> hidden");
});
await t("logistics-taps.json (LOGISTICS-TAPS.md): the file's four controls, labels and chips; sendsToPeople must be false", () => {
  const j = J("data/logistics-taps.json");
  const c = LS.logisticsControls(j, AT);
  assert.deepEqual(c.map((x) => [x.id, x.label]), [["im-home", "I'm home"], ["leaving", "Leaving"], ["check-in", "Check in"], ["running-late", "Running late"]]);
  assert.deepEqual(c[2].kids, ["Harris", "Hayes", "Ainsley"]); assert.deepEqual(c[3].chips, [5, 10, 15, 20, 30]);
  assert.deepEqual(c[0].lights.on, ["kitchen", "dining-room"]); assert.deepEqual(c[1].lights.off, ["dining-room", "harris-room", "kitchen"]);
  assert.equal(LS.logisticsControls({ ...j, sendsToPeople: true }, AT), null);
  assert.equal(LS.logisticsControls(j, Date.parse("2026-10-02T03:01:00-05:00")), null, "past resetsAt (3:00 AM house day) -> hidden");
  assert.equal(LS.logisticsControls({ ...j, controls: [{ id: "text-someone", label: "x" }] }, AT), null, "unknown controls are not drawn");
});
await t("logistics taps: status copy per contract, latest tap wins, 3:00 AM reset, invalid input ignored, sends always []", () => {
  const c = LS.logisticsControls(J("data/logistics-taps.json"), AT), s = mem();
  const at = (hm) => Date.parse("2026-10-01T" + hm + ":00-05:00");
  assert.equal(LS.applyTap(s, c, { control: "im-home" }, at("18:05")).logistics.status.line, "Home 6:05.");
  assert.equal(LS.applyTap(s, c, { control: "check-in", kid: "Ainsley" }, at("18:52")).logistics.status.line, "Ainsley home 6:52.");
  const late = LS.applyTap(s, c, { control: "running-late", minutes: 15 }, at("18:55"));
  assert.equal(late.logistics.status.line, "Running 15 min late."); assert.deepEqual(late.effects, { lights: null, checkIn: null, sends: [] });
  const lv = LS.applyTap(s, c, { control: "leaving" }, at("20:05"));
  assert.equal(lv.logistics.status.line, "Leaving 8:05."); assert.deepEqual(lv.effects.lights.off, ["dining-room", "harris-room", "kitchen"]); assert.deepEqual(lv.effects.sends, []);
  const ci = LS.applyTap(s, c, { control: "check-in", kid: "Hayes" }, at("20:06")); assert.equal(ci.effects.checkIn, "hayes");
  const before = s.m[LS.STATE_KEY];
  for (const bad of [{ control: "running-late", minutes: 7 }, { control: "check-in", kid: "Riley" }, { control: "text" }, null])
    assert.deepEqual(LS.applyTap(s, c, bad, at("20:10")).effects, { lights: null, checkIn: null, sends: [] });
  assert.equal(s.m[LS.STATE_KEY], before, "invalid taps change nothing");
  assert.deepEqual(Object.keys(s.m), [LS.STATE_KEY], "one local key, nothing else written");
  assert.equal(LS.logisticsFor(LS.readState(s), Date.parse("2026-10-02T02:59:00-05:00")).taps.length, 5, "same house day until 3:00 AM");
  assert.equal(LS.logisticsFor(LS.readState(s), Date.parse("2026-10-02T03:00:00-05:00")).status, null, "3:00 AM CT reset");
  const src = fs.readFileSync(new URL("../../house-wall-lists.js", import.meta.url), "utf8");
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ""), /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/, "the lists module has no network code");
});
await t("school-night.json: real file, visibleFromIso..visibleUntilIso only, Atlas's copy lines", () => {
  const j = J("data/school-night.json");
  assert.deepEqual(LS.schoolNight(j, AT, R).lines, [{ k: "Pickup", v: "Hayes pickup. Leave 6:20." }, { k: "Form", v: "Ainsley \u00b7 LKMS baby pic due Fri 3:00." }]);
  assert.equal(LS.schoolNight(j, Date.parse("2026-10-01T14:59:00-05:00"), R), null);
  assert.equal(LS.schoolNight(j, Date.parse("2026-10-01T19:00:00-05:00"), R), null, "hides at 7:00 even on the same file");
  const off = { asOfIso: j.asOfIso, generatedAt: j.generatedAt, visibleFrom: "15:00", visibleUntil: "19:00", visibleFromIso: j.visibleFromIso, visibleUntilIso: j.visibleUntilIso, schoolNight: false, visible: false };
  assert.equal(LS.schoolNight(off, AT, R), null, "not a school night -> no strip, no placeholder");
  assert.equal(LS.schoolNight({ ...j, pickup: [], gear: [], form: undefined }, AT, R), null, "nothing to say -> hidden");
  assert.deepEqual(LS.schoolNight({ ...j, gear: [{ who: ["Ainsley"], items: ["swim bag"], copy: "Ainsley \u00b7 swim bag." }] }, AT, R).lines[1], { k: "Gear", v: "Ainsley \u00b7 swim bag." });
});
await t("display renames: published config has display strings only, no patterns (ATLASLANE9); wall compiles none; other text unchanged", () => {
  const cfg = J("config/display-rename.json");
  assert.deepEqual(cfg.renames.map((r) => r.replace), ["Nonna and Papa", "Nonna birthday"], "only the display strings ship");
  assert.ok(cfg.renames.every((r) => !("pattern" in r) && !("evidence" in r)), "raw-title patterns live in Atlas's private box file");
  assert.equal(R.renames.length, 0, "pattern-less renames are skipped (data is renamed at build time)");
  assert.equal(LS.displayText("Nonna and Papa in KC", R), "Nonna and Papa in KC", "built text passes through");
  assert.equal(LS.displayText("Pick up Hayes at Casey's", R), "Pick up Hayes at Casey's", "calendar text as the data gives it");
  assert.equal(LS.displayText("Erin + Hayes lunch", R), "Erin + Hayes lunch", "Erin stays Erin");
  assert.equal(LS.displayText("Harris — provider in-home @ mom’s · 4:00", R), null, "parent scrub still drops a parent word");
  const RP = LS.compileRenames({ ...cfg, renames: [{ id: "t", pattern: "\\bZia\\b", replace: "Nonna" }, { id: "u", replace: "Papa" }] });
  assert.equal(LS.displayText("Zia visit", RP), "Nonna visit", "a rule with a pattern still applies; the one without is skipped");
  assert.equal(LS.displayText("x", null), "x", "no config -> unchanged (files are scrubbed at build time)");
  for (const f of ["house-wall-lists.js", "wall.html"]) assert.doesNotMatch(fs.readFileSync(new URL("../../" + f, import.meta.url), "utf8"), /\bmom\b|\bmoms\b|Nonna|Papa/i, f + " has no hardcoded parent names");
});
const WX = { source: "open-meteo", hourlyTemp: { time: ["2026-10-05T16:00", "2026-10-05T17:00", "2026-10-05T18:00"], temp: [66.2, 64.4, 61.6] } };
const CAL = { upcomingLeaves: [
  { id: "a", summary: "Hayes baseball \u2014 Falcons vs KC Tigers (away) \u00b7 5:30 game", start: "2026-10-05T17:30:00-05:00", allDay: false },
  { id: "b", summary: "Ainsley swim \u2014 Coach Ann \u00b7 5:00 practice", start: "2026-10-05T17:00:00-05:00", allDay: false },
  { id: "c", summary: "Harris flag \u2014 vs BV Gardner (home) \u00b7 arrive 1:00 \u00b7 game 1:30", start: "2026-10-06T13:00:00-05:00", allDay: false } ] };
const MON4 = Date.parse("2026-10-05T16:00:00-05:00");
await t("field weather: tonight's game time ('5:30 game') + the forecast hour it starts in -> '64\u00b0 at 5:30'", () => {
  const g = LS.fieldGame(CAL, MON4, R);
  assert.equal(g.at, "5:30"); assert.equal(g.gameMs, Date.parse("2026-10-05T17:30:00-05:00"));
  assert.deepEqual(LS.fieldWeather(g, WX), { text: "64\u00b0 at 5:30", temp: 64, hour: "2026-10-05T17:00", source: "open-meteo hourly temperature_2m" });
  const g2 = LS.fieldGame({ upcomingLeaves: [CAL.upcomingLeaves[2]] }, Date.parse("2026-10-06T09:00:00-05:00"), R);
  assert.equal(g2.at, "1:30", "'game 1:30' in the title beats the 1:00 arrive start");
});
await t("field weather: no game -> no weather; practice is not a game; passed game -> none; real cal today has none", () => {
  assert.equal(LS.fieldGame({ upcomingLeaves: [CAL.upcomingLeaves[1]] }, MON4, R), null);
  assert.equal(LS.fieldWeather(LS.fieldGame({ upcomingLeaves: [] }, MON4, R), WX), null);
  assert.equal(LS.fieldGame(CAL, Date.parse("2026-10-05T17:31:00-05:00"), R), null, "game already started");
  assert.equal(LS.fieldGame(J("data/cal-live.json"), AT, R), null, "Thu Oct 1: no game tonight -> no weather");
});
await t("field weather: no forecast for that hour -> none (never invented); fallback source without hourly temps -> none", () => {
  const g = LS.fieldGame(CAL, MON4, R);
  assert.equal(LS.fieldWeather(g, { ...WX, hourlyTemp: { time: ["2026-10-05T16:00"], temp: [66] } }), null, "hour missing");
  assert.equal(LS.fieldWeather(g, { ...WX, hourlyTemp: { time: WX.hourlyTemp.time, temp: [66, null, 61] } }), null, "null value");
  assert.equal(LS.fieldWeather(g, { source: "wttr", temp: 60 }), null, "wttr fallback has no hourly temp here");
  assert.equal(LS.fieldWeather(g, { source: "open-meteo", temp: 60, hourlyTemp: null }), null, "current temp is never used as the field temp");
});
await t("field weather reuses the existing Open-Meteo pill call: same URL + hourly temperature_2m, no new fetch/key in the wall", () => {
  const wxSrc = fs.readFileSync(new URL("../../house-weather.js", import.meta.url), "utf8");
  assert.equal((wxSrc.match(/api\.open-meteo\.com/g) || []).length, 1, "one Open-Meteo call, the pill's own");
  assert.match(wxSrc, /&hourly=precipitation_probability,precipitation,temperature_2m/);
  assert.match(wxSrc, /hourlyTemp: j\.hourly/);
  const wall = fs.readFileSync(new URL("../../wall.html", import.meta.url), "utf8");
  assert.match(wall, /<script src="house-weather\.js"><\/script>/);
  assert.doesNotMatch(wall, /open-meteo\.com|weather\.gov|wttr\.in|apikey|api_key/i, "the wall itself has no weather URL or key");
  const block = wall.slice(wall.indexOf("function needWx("), wall.indexOf("function paintSchool("));
  assert.match(block, /W\.load\(/); assert.doesNotMatch(block, /fetch\(/);
  const ps = wall.slice(wall.indexOf("function paintSchool("), wall.indexOf("FIVE UPGRADES #4"));
  assert.match(ps, /var game = sn \? LS\.fieldGame/); assert.match(ps, /if \(game\) \{ needWx\(\)/, "weather is asked only when there is a game");
});
console.log(`panel: ${n} tests PASS`);
