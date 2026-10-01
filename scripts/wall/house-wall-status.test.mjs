// WALLKIT1 · node scripts/wall/house-wall-status.test.mjs
// Pure-function tests for house-wall-status.js (not wired to any page).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const S = require("../../house-wall-status.js");

const NOW = Date.parse("2026-10-01T22:15:00Z"); // Thu Oct 1 2026 5:15 PM CT
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const MIN = 60 * 1000, H = 60 * MIN;
const ROSTER = ["Living Room camera", "Front door doorbell", "Garage camera", "Kitchen camera", "Backyard camera"];
const nest = (online, extra = {}) => ({
  status: "live", fetchedAt: iso(5 * MIN), error: null,
  cameras: ROSTER.map((name, i) => ({ name, online: Array.isArray(online) ? online[i] : online })),
  ...extra,
});
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

// 1 · cams (cams only, hidden until a real per-camera check exists)
t("cams all checked online -> Cams OK", () => assert.deepEqual(S.camsLight(nest(true), { now: NOW, roster: ROSTER }), { id: "cams", ok: true, text: "Cams OK", href: "sheet-google-home.html" }));
t("cams online:null (today's reality) -> hidden", () => assert.equal(S.camsLight(nest(null), { now: NOW, roster: ROSTER }), null));
t("one null + one offline -> still hidden (no real check)", () => assert.equal(S.camsLight(nest([true, null, false, true, true]), { now: NOW, roster: ROSTER }), null));
t("one offline (all checked) -> named", () => assert.equal(S.camsLight(nest([true, true, false, true, true]), { now: NOW, roster: ROSTER }).text, "Garage offline"));
t("three offline -> first +2", () => assert.equal(S.camsLight(nest([false, true, false, true, false]), { now: NOW, roster: ROSTER }).text, "Living Room +2 offline"));
t("missing roster cam -> named", () => {
  const d = nest(true); d.cameras = d.cameras.filter((c) => c.name !== "Kitchen camera");
  assert.equal(S.camsLight(d, { now: NOW, roster: ROSTER }).text, "Kitchen offline");
});
t("stale nest -> hidden", () => assert.equal(S.camsLight(nest(true, { fetchedAt: iso(31 * MIN) }), { now: NOW, roster: ROSTER }), null));
t("nest not live -> hidden", () => assert.equal(S.camsLight(nest(true, { status: "need_token" }), { now: NOW }), null));
t("doors never shown (no doors option)", () => assert.equal(S.camsLight(nest(true), { now: NOW, roster: ROSTER, doors: { ok: true } }).text, "Cams OK"));

// house mode (READ from data/house-mode.json; never inferred)
const HM = (key, label, asOfIso = "2026-10-01") => ({ asOfIso, mode: { key, label } });
t("house mode read", () => assert.deepEqual(S.readHouseMode(HM("school-day", "School day"), { now: NOW }), { key: "school-day", label: "School day" }));
t("flat shape also read", () => assert.equal(S.readHouseMode({ asOfIso: "2026-10-01", key: "kids-away", label: "Kids away" }, { now: NOW }).key, "kids-away"));
t("missing house-mode.json -> null", () => assert.equal(S.readHouseMode(null, { now: NOW }), null));
t("stale house-mode.json -> null", () => assert.equal(S.readHouseMode(HM("school-day", "School day", "2026-09-30"), { now: NOW }), null));
t("unknown / old key (custody-out) -> null", () => assert.equal(S.readHouseMode(HM("custody-out", "x"), { now: NOW }), null));
t("kids-away is a known key", () => assert.ok(S.MODE_KEYS.includes("kids-away")));

// 2 · thermostat (plain reading; no flag while temps null)
const sensi = (th = {}, extra = {}) => ({ status: "live", updatedAt: iso(4 * MIN), error: null,
  thermostat: { online: true, ambient: 73, mode: "Auto", heatSetpoint: 65, coolSetpoint: 73, setpoint: 65, ...th }, ...extra });
const SCHOOL = { key: "school-day", label: "School day" };
t("plain reading '73° · school day'", () => assert.deepEqual(S.thermoLight(sensi(), { now: NOW, mode: SCHOOL }), { id: "thermo", ok: true, text: "73\u00b0 \u00b7 school day", href: "sheet-google-home.html" }));
t("no house mode -> ambient only", () => assert.equal(S.thermoLight(sensi(), { now: NOW }).text, "73\u00b0"));
t("temps null -> never flagged", () => {
  const r = S.thermoLight(sensi(), { now: NOW, mode: SCHOOL, temps: { "school-day": { heatSetpoint: null, coolSetpoint: null } } });
  assert.equal(r.ok, true); assert.equal(r.text, "73\u00b0 \u00b7 school day");
});
t("real band numbers + mismatch -> quiet flag", () => {
  const r = S.thermoLight(sensi(), { now: NOW, mode: SCHOOL, temps: { "school-day": { heatSetpoint: [68, 72], coolSetpoint: null } } });
  assert.equal(r.ok, false); assert.equal(r.text, "73\u00b0 \u00b7 school day \u00b7 check set 65\u201373\u00b0");
});
t("offline -> Thermostat offline", () => assert.equal(S.thermoLight(sensi({ online: false }), { now: NOW }).text, "Thermostat offline"));
t("stale sensi -> hidden", () => assert.equal(S.thermoLight(sensi({}, { updatedAt: iso(31 * MIN) }), { now: NOW }), null));

// 3 · load day
t("load day today", () => assert.equal(S.loadDayLight({ asOfIso: "2026-10-01", loadDay: { isoDate: "2026-10-01" } }, { now: NOW }).text, "Load day today"));
t("load day tomorrow", () => assert.equal(S.loadDayLight({ asOfIso: "2026-10-01", loadDay: { isoDate: "2026-10-02" } }, { now: NOW }).text, "Load day tomorrow"));
t("load day in 2 days -> hidden", () => assert.equal(S.loadDayLight({ asOfIso: "2026-10-01", loadDay: { isoDate: "2026-10-03" } }, { now: NOW }), null));
t("stale load-day source -> hidden", () => assert.equal(S.loadDayLight({ asOfIso: "2026-09-21", loadDay: { isoDate: "2026-10-01" } }, { now: NOW }), null));
t("CT date near midnight UTC", () => assert.equal(S._ctIso(Date.parse("2026-10-02T03:30:00Z")), "2026-10-01"));

// 4 · travel-week care (dragon: no line ever; pond: real source only; gate = house-mode.json)
const TRAVEL = { key: "nashville-week", label: "Nashville week" };
const care = { dragon: { fed: true, asOf: iso(2 * H), freshMs: 24 * H }, pond: { filterOk: false, asOf: iso(2 * H), freshMs: 24 * H } };
t("not travel mode -> none", () => assert.deepEqual(S.travelLights(SCHOOL, care, { now: NOW }), []));
t("no house mode (file missing) -> none", () => assert.deepEqual(S.travelLights(null, care, { now: NOW }), []));
t("travel mode -> pond only, dragon never", () => assert.deepEqual(S.travelLights(TRAVEL, care, { now: NOW }).map((l) => [l.id, l.text]), [["pond", "Pond filter not OK"]]));
t("pond without cadence -> hidden", () => assert.deepEqual(S.travelLights(TRAVEL, { pond: { filterOk: true, asOf: iso(MIN) } }, { now: NOW }), []));

// strip
t("strip today-like feeds (no house-mode.json) -> only plain thermo", () => assert.deepEqual(
  S.statusStrip({ nest: nest(null), sensi: sensi() }, { now: NOW, roster: ROSTER }).map((l) => l.text), ["73\u00b0"]));
t("strip reads mode label from house-mode.json", () => assert.deepEqual(
  S.statusStrip({ sensi: sensi(), houseMode: HM("kids-away", "Kids away") }, { now: NOW }).map((l) => l.text), ["73\u00b0 \u00b7 kids away"]));
t("strip never infers travel week (no file) even with pond data", () => assert.equal(
  S.statusStrip({ care }, { now: NOW }).length, 0));

// laundry (LG ThinQ Connect field names; NEED TOKEN; never a made-up time)
const unit = (currentState, timer, armed) => ({ state: { runState: { currentState },
  ...(timer ? { timer } : {}), remoteControlEnable: { remoteControlEnabled: armed === true } } });
const L = (washer, dryer, extra = {}) => ({ status: "live", fetchedAt: iso(MIN), washer, dryer, ...extra });
t("no laundry object -> NEED TOKEN", () => assert.equal(S.laundryLight(null, { now: NOW }).text, "NEED TOKEN"));
t("status need_token -> NEED TOKEN", () => assert.equal(S.laundryLight({ status: "need_token" }, { now: NOW }).text, "NEED TOKEN"));
t("hasToken false -> NEED TOKEN", () => assert.equal(S.laundryLight({ status: "live", hasToken: false, fetchedAt: iso(MIN) }, { now: NOW }).text, "NEED TOKEN"));
t("laundry stale -> hidden", () => assert.equal(S.laundryLight(L(unit("RUNNING", { remainHour: 0, remainMinute: 32 }), null, { fetchedAt: iso(31 * MIN) }), { now: NOW }), null));
t("'Washer 0:32 · Dryer DONE'", () => assert.equal(S.laundryLight(L(unit("RUNNING", { remainHour: 0, remainMinute: 32 }), unit("END")), { now: NOW }).text, "Washer 0:32 \u00b7 Dryer DONE"));
t("running without timer -> 'running', never a time", () => assert.equal(S.laundryLight(L(unit("SPINNING"), unit("POWER_OFF")), { now: NOW }).text, "Washer running"));
t("timer present but snapshot > 5 min -> no time printed", () => assert.equal(S.laundryLight(L(unit("RUNNING", { remainHour: 1, remainMinute: 5 }), null, { fetchedAt: iso(10 * MIN) }), { now: NOW }).text, "Washer running"));
t("bad timer values -> no time", () => assert.equal(S.laundryLight(L(unit("RUNNING", { remainHour: 0, remainMinute: 75 })), { now: NOW }).text, "Washer running"));
t("both off -> hidden", () => assert.equal(S.laundryLight(L(unit("POWER_OFF"), unit("INITIAL")), { now: NOW }), null));
t("paused / error honest", () => {
  const r = S.laundryLight(L(unit("PAUSE"), unit("ERROR")), { now: NOW });
  assert.equal(r.text, "Washer paused \u00b7 Dryer error"); assert.equal(r.ok, false);
});
t("location-list state picks MAIN", () => assert.equal(S.laundryLight(L({ state: [
  { location: { locationName: "MINI" }, runState: { currentState: "END" } },
  { location: { locationName: "MAIN" }, runState: { currentState: "RUNNING" }, timer: { remainHour: 0, remainMinute: 7 } }] }), { now: NOW }).text, "Washer 0:07"));
t("unknown run state shown raw, not guessed", () => assert.equal(S.laundryLight(L(unit("FOTA")), { now: NOW }).text, "Washer fota"));
t("controls: no token -> all disabled, sends nothing", () => assert.deepEqual(S.laundryControls(null, "washer", { now: NOW }), { start: false, pause: false, off: false, sends: false, reason: "NEED TOKEN" }));
t("controls: Remote Start not armed -> Start disabled", () => {
  const c = S.laundryControls(L(unit("INITIAL", null, false)), "washer", { now: NOW });
  assert.equal(c.start, false); assert.equal(c.sends, false);
});
t("controls: armed + idle -> Start only (+Off)", () => {
  const c = S.laundryControls(L(unit("INITIAL", null, true)), "washer", { now: NOW });
  assert.deepEqual([c.start, c.pause, c.off], [true, false, true]);
});
t("controls: armed + running -> Pause/Off, not Start", () => {
  const c = S.laundryControls(L(unit("RUNNING", null, true)), "washer", { now: NOW });
  assert.deepEqual([c.start, c.pause, c.off], [false, true, true]);
});
t("controls: stale -> all disabled", () => assert.equal(S.laundryControls(L(unit("INITIAL", null, true), null, { fetchedAt: iso(31 * MIN) }), "washer", { now: NOW }).sends, false));

// scenes (Dan's Kasa definitions)
t("Leaving = all 3 Kasa off", () => assert.deepEqual(S.scenePlan("leave"), [{ id: "dining-room", on: false }, { id: "harris-room", on: false }, { id: "kitchen", on: false }]));
t("I'm home = Kitchen + Dining on, no Sensi, no brightness", () => assert.deepEqual(S.scenePlan("home"), [{ id: "kitchen", on: true }, { id: "dining-room", on: true }]));
t("scene labels exact", () => assert.deepEqual(S.sceneButtons({ hasKey: true }).map((b) => b.label), ["I\u2019m home", "Leaving"]));
t("no key -> NEED KEY, sends nothing", () => assert.deepEqual(S.sceneButtons({}).map((b) => [b.sub, b.disabled, b.sends]), [["NEED KEY", true, false], ["NEED KEY", true, false]]));
t("unknown scene -> no writes (mode chips recall nothing)", () => assert.deepEqual(S.scenePlan("school-day"), []));

// thermostat Travel (arm then confirm)
const TR = { online: true, ambient: 70, mode: "Auto", heatSetpoint: 55, coolSetpoint: 85 };
t("status light reads Travel from the LIVE reading", () => assert.equal(S.thermoLight(sensi(TR), { now: NOW, mode: SCHOOL }).text, "Travel \u00b7 55\u201385"));
t("near-travel values are not Travel", () => assert.equal(S.isTravelThermo({ mode: "Heat", heatSetpoint: 55, coolSetpoint: 85 }), false));
t("arm: first tap arms, no fire", () => assert.deepEqual(S.armTap(null, NOW), { arm: { armedAt: NOW }, fire: false }));
t("arm: second tap at 4.9s fires", () => assert.equal(S.armTap({ armedAt: NOW }, NOW + 4900).fire, true));
t("arm: tap at 5.0s re-arms instead (auto-disarmed)", () => assert.deepEqual(S.armTap({ armedAt: NOW }, NOW + 5000), { arm: { armedAt: NOW + 5000 }, fire: false }));
t("button labels: Travel -> armed text", () => {
  const th = sensi().thermostat;
  assert.equal(S.travelButton(th, { hasKey: true, now: NOW }).label, "Travel");
  const b = S.travelButton(th, { hasKey: true, arm: { armedAt: NOW - 1000 }, now: NOW });
  assert.equal(b.label, "Tap again \u00b7 Travel 55\u201385"); assert.equal(b.sends, true);
});
t("button in Travel reads Back home", () => assert.equal(S.travelButton(TR, { hasKey: true, saved: true, now: NOW }).label, "Back home"));
t("Back home without capture -> 'no saved setting', sends nothing", () => {
  const b = S.travelButton(TR, { hasKey: true, saved: false, arm: { armedAt: NOW }, now: NOW });
  assert.deepEqual([b.sub, b.disabled, b.sends], ["no saved setting", true, false]);
});
t("no key -> NEED KEY, disabled", () => assert.deepEqual([S.travelButton(sensi().thermostat, { now: NOW }).sub, S.travelButton(sensi().thermostat, { now: NOW }).disabled], ["NEED KEY", true]));

// next up + stale dot
const CAL = { status: "live", fetchedAt: new Date(NOW - 30 * 60000).toISOString(), asOfIso: "2026-10-01",
  nextLeave: { summary: "Swim pickup", start: "2026-10-01T18:20:00-05:00", end: "2026-10-01T18:55:00-05:00", location: "Pool, 1 Main St", allDay: false } };
t("next up: real event -> time + calendar words", () => assert.deepEqual(
  (({ time, ampm, what, where, ends }) => ({ time, ampm, what, where, ends }))(S.nextUp(CAL, { now: NOW })),
  { time: "6:20", ampm: "PM", what: "Swim pickup", where: "Pool", ends: "6:55 PM" }));
t("next up: place already in the words is not repeated", () => assert.equal(S.nextUp({ ...CAL, nextLeave: { ...CAL.nextLeave, summary: "Swim at Pool" } }, { now: NOW }).where, null));
t("next up: stale cal -> hidden", () => assert.equal(S.nextUp({ ...CAL, fetchedAt: new Date(NOW - 7 * 3600000).toISOString() }, { now: NOW }), null));
t("next up: other day as-of -> hidden", () => assert.equal(S.nextUp({ ...CAL, asOfIso: "2026-09-30" }, { now: NOW }), null));
t("next up: over -> hidden", () => assert.equal(S.nextUp(CAL, { now: Date.parse("2026-10-01T19:00:00-05:00") }), null));
t("next up: all-day -> hidden", () => assert.equal(S.nextUp({ ...CAL, nextLeave: { ...CAL.nextLeave, allDay: true } }, { now: NOW }), null));
t("stale dot lists only present stale feeds", () => assert.deepEqual(S.staleFeeds({ cal: CAL, sensi: { status: "live", updatedAt: new Date(NOW - 3600000).toISOString() } }, { now: NOW }), ["thermostat"]));

// 5 · open loops
const loop = (o) => ({ kind: "house-object", severity: "task", asOf: iso(MIN), freshMs: H, ...o });
t("money / kid dollar / people / non-house dropped", () => {
  const items = [
    loop({ object: "HVAC filter", text: "HVAC filter due" }),
    loop({ object: "Tree trim", text: "Tree trim bids" }),
    loop({ object: "Card", text: "Card balance $40" }),
    loop({ object: "Reward jar", text: "Reward jar full" }),
    loop({ object: "Front door", text: "Text Erin about front door" }),
    { kind: "chat", object: "Kitchen", text: "Kitchen thing", severity: "task", asOf: iso(MIN), freshMs: H },
  ];
  assert.deepEqual(S.openLoops(items, { now: NOW }).map((i) => i.object), ["HVAC filter"]);
});
t("ranking safety > device > task, then due, max 3", () => {
  const items = [
    loop({ object: "Gutters", text: "Gutters due", due: "2026-10-05" }),
    loop({ object: "Bulb", text: "Bulb out", due: "2026-10-03" }),
    loop({ object: "Garage door", text: "Garage door open", severity: "safety" }),
    loop({ object: "Kitchen light", text: "Kitchen light offline", severity: "device" }),
  ];
  assert.deepEqual(S.openLoops(items, { now: NOW }).map((i) => i.object), ["Garage door", "Kitchen light", "Bulb"]);
});
t("stale loops dropped; empty -> []", () => assert.deepEqual(S.openLoops([loop({ object: "Bulb", text: "Bulb out", asOf: iso(2 * H) })], { now: NOW }), []));
t("roster device with a kid's name survives", () => {
  const l = S.lightLoops({ status: "live", fetchedAt: iso(5 * MIN), lights: [{ name: "Harris's Room", online: false }, { name: "Kitchen", online: true }] });
  assert.deepEqual(S.openLoops(l, { now: NOW }).map((i) => i.text), ["Harris's Room light offline"]);
});
t("typed (non-roster) name of a kid dropped", () => assert.deepEqual(S.openLoops([loop({ object: "Hayes room fan", text: "Hayes room fan broken" })], { now: NOW }), []));

console.log(`house-wall-status: ${n} tests PASS`);
