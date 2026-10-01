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

// 1 · cams
t("cams all online -> Cams OK", () => assert.deepEqual(S.camsLight(nest(true), { now: NOW, roster: ROSTER }), { id: "cams", ok: true, text: "Cams OK", href: "sheet-google-home.html" }));
t("cams online:null (today's reality) -> hidden", () => assert.equal(S.camsLight(nest(null), { now: NOW, roster: ROSTER }), null));
t("one offline -> named", () => assert.equal(S.camsLight(nest([true, true, false, true, true]), { now: NOW, roster: ROSTER }).text, "Garage offline"));
t("three offline -> first +2", () => assert.equal(S.camsLight(nest([false, true, false, true, false]), { now: NOW, roster: ROSTER }).text, "Living Room +2 offline"));
t("missing roster cam -> named", () => {
  const d = nest(true); d.cameras = d.cameras.filter((c) => c.name !== "Kitchen camera");
  assert.equal(S.camsLight(d, { now: NOW, roster: ROSTER }).text, "Kitchen offline");
});
t("stale nest -> hidden", () => assert.equal(S.camsLight(nest(true, { fetchedAt: iso(31 * MIN) }), { now: NOW, roster: ROSTER }), null));
t("nest not live -> hidden", () => assert.equal(S.camsLight(nest(true, { status: "need_token" }), { now: NOW }), null));
t("doors source OK -> Doors + cams OK", () => assert.equal(S.camsLight(nest(true), { now: NOW, roster: ROSTER, doors: { ok: true, asOf: iso(MIN), freshMs: 30 * MIN } }).text, "Doors + cams OK"));
t("stale doors source ignored -> Cams OK", () => assert.equal(S.camsLight(nest(true), { now: NOW, roster: ROSTER, doors: { ok: true, asOf: iso(2 * H), freshMs: 30 * MIN } }).text, "Cams OK"));

// 2 · thermostat
const sensi = (th = {}, extra = {}) => ({ status: "live", updatedAt: iso(4 * MIN), error: null,
  thermostat: { online: true, ambient: 73, mode: "Auto", heatSetpoint: 65, coolSetpoint: 73, setpoint: 65, ...th }, ...extra });
const SCHOOL = { id: "school", label: "School day" };
t("ambient + mode, no band -> ok", () => assert.deepEqual(S.thermoLight(sensi(), { now: NOW, mode: SCHOOL }), { id: "thermo", ok: true, text: "73\u00b0, School day", href: "sheet-google-home.html" }));
t("no house mode -> ambient only", () => assert.equal(S.thermoLight(sensi(), { now: NOW }).text, "73\u00b0"));
t("band mismatch -> not ok, quiet", () => {
  const r = S.thermoLight(sensi(), { now: NOW, mode: SCHOOL, bands: { school: { heatSetpoint: [68, 72] } } });
  assert.equal(r.ok, false); assert.equal(r.text, "73\u00b0, School day \u00b7 check set 65\u201373\u00b0");
});
t("band match -> ok", () => assert.equal(S.thermoLight(sensi(), { now: NOW, mode: SCHOOL, bands: { school: { heatSetpoint: [60, 66], mode: ["Auto"] } } }).ok, true));
t("offline -> Thermostat offline", () => assert.equal(S.thermoLight(sensi({ online: false }), { now: NOW }).text, "Thermostat offline"));
t("stale sensi -> hidden", () => assert.equal(S.thermoLight(sensi({}, { updatedAt: iso(31 * MIN) }), { now: NOW }), null));

// 3 · load day
t("load day today", () => assert.equal(S.loadDayLight({ asOfIso: "2026-10-01", loadDay: { isoDate: "2026-10-01" } }, { now: NOW }).text, "Load day today"));
t("load day tomorrow", () => assert.equal(S.loadDayLight({ asOfIso: "2026-10-01", loadDay: { isoDate: "2026-10-02" } }, { now: NOW }).text, "Load day tomorrow"));
t("load day in 2 days -> hidden", () => assert.equal(S.loadDayLight({ asOfIso: "2026-10-01", loadDay: { isoDate: "2026-10-03" } }, { now: NOW }), null));
t("stale load-day source -> hidden", () => assert.equal(S.loadDayLight({ asOfIso: "2026-09-21", loadDay: { isoDate: "2026-10-01" } }, { now: NOW }), null));
t("CT date near midnight UTC", () => assert.equal(S._ctIso(Date.parse("2026-10-02T03:30:00Z")), "2026-10-01"));

// 4 · dragon + pond
const TRAVEL = { id: "nashville", label: "Nashville week" };
const care = { dragon: { fed: true, asOf: iso(2 * H) }, pond: { filterOk: false, asOf: iso(2 * H) } };
t("not travel mode -> none", () => assert.deepEqual(S.travelLights(SCHOOL, care, { now: NOW, fresh: { dragon: 24 * H, pond: 24 * H } }), []));
t("travel mode, no cadence given -> hidden", () => assert.deepEqual(S.travelLights(TRAVEL, care, { now: NOW }), []));
t("travel mode with windows -> two lines", () => assert.deepEqual(
  S.travelLights(TRAVEL, care, { now: NOW, fresh: { dragon: 24 * H, pond: 24 * H } }).map((l) => [l.text, l.ok]),
  [["Dragon fed", true], ["Pond filter not OK", false]]));

// strip
t("strip today-like feeds -> only thermo", () => assert.deepEqual(
  S.statusStrip({ nest: nest(null), sensi: sensi() }, { now: NOW, roster: ROSTER }).map((l) => l.id), ["thermo"]));

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
