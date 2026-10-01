// PANEL1 · node scripts/wall/panel.test.mjs · FIVE UPGRADES: setpoint (no key = no request, debounce = one request per settled side),
// Kasa toggles, house timer (per device, persists, ends on the board), Atlas LANE6 readers hidden when absent.
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
await t("timer: fixed chips only; label chip; reads 'Oven 12:00'", () => {
  const s = mem();
  assert.equal(P.setTimer(s, 7, "Oven", NOW), null);
  P.setTimer(s, 15, "Oven", NOW);
  assert.equal(P.timerView(s, NOW + 3 * 60000).text, "Oven 12:00");
  P.setTimer(s, 5, "Pizza", NOW); assert.equal(P.timerView(s, NOW).text, "Timer 5:00", "unknown label -> plain Timer");
});
await t("timer: one object (a new set replaces), persists across reload (same store)", () => {
  const s = mem(); P.setTimer(s, 10, "Bath", NOW); P.setTimer(s, 20, "Laundry", NOW);
  assert.equal(P.timerView(s, NOW).text, "Laundry 20:00");
  const reloaded = { get: s.get, set: s.set };
  assert.equal(P.timerView(reloaded, NOW + 60000).text, "Laundry 19:00");
  assert.deepEqual(Object.keys(s.m), [P.TIMER_KEY]);
});
await t("timer: ends on the board then clears; module never touches lights or network", () => {
  const s = mem(); P.setTimer(s, 5, "Oven", NOW);
  const v = P.timerView(s, NOW + 5 * 60000); assert.equal(v.ended, true); assert.equal(v.text, "Oven 0:00");
  P.clearTimer(s); assert.equal(P.timerView(s, NOW), null);
  const src = require("node:fs").readFileSync(new URL("../../house-wall-panel.js", import.meta.url), "utf8");
  const timerSrc = src.slice(src.indexOf("/* House timer */"));
  assert.doesNotMatch(timerSrc, /setLight|fetch|flash/);
});
await t("Atlas LANE6 readers: absent -> null (tiles hidden)", () => {
  assert.equal(LS.leaveLine(null, NOW), null); assert.equal(LS.logisticsTaps(null, NOW), null); assert.equal(LS.schoolNight(null, NOW), null);
});
const G = { asOfIso: "2026-10-01", generatedAt: "2026-10-01T15:00:00-05:00" };
await t("leave-by line: today + fresh + future only, the file's words", () => {
  assert.deepEqual(LS.leaveLine({ ...G, leaveBy: { copy: "Leave 5:10.", atIso: "2026-10-01T17:10:00-05:00" } }, NOW), { copy: "Leave 5:10.", atMs: Date.parse("2026-10-01T17:10:00-05:00") });
  assert.equal(LS.leaveLine({ ...G, leaveBy: { copy: "Leave 4:10.", atIso: "2026-10-01T16:10:00-05:00" } }, NOW), null);
  assert.equal(LS.leaveLine({ ...G, asOfIso: "2026-09-30", leaveBy: { copy: "Leave 5:10.", atIso: "2026-10-01T17:10:00-05:00" } }, NOW), null);
});
await t("four taps: known ids only; running late needs minute chips; tap log is per device, nothing sent", () => {
  const j = { ...G, taps: [{ id: "im-home", label: "I'm home" }, { id: "leaving", label: "Leaving" }, { id: "check-in", label: "Check in" }, { id: "running-late", label: "Running late", minutes: [5, 10, 15] }, { id: "text-mom", label: "x" }] };
  const v = LS.logisticsTaps(j, NOW);
  assert.deepEqual(v.taps.map((x) => x.id), ["im-home", "leaving", "check-in", "running-late"]);
  assert.equal(LS.logisticsTaps({ ...G, taps: [{ id: "running-late", label: "Running late" }] }, NOW), null);
  const s = mem(); LS.logTap(s, "running-late", { minutes: 10 }, NOW);
  assert.equal(LS.lastTaps(s, NOW)["running-late"].minutes, 10);
  assert.deepEqual(Object.keys(s.m), ["wardos-wall-logistics:2026-10-01"]);
});
await t("school night: only 3:00-6:59 PM CT", () => {
  const j = { ...G, schoolNight: true, pickup: "3:40 SRE", gear: ["cleats"], formDue: "Field trip form", fieldWeather: "62° dry" };
  assert.equal(LS.schoolNight(j, NOW).lines.length, 4);
  assert.equal(LS.schoolNight(j, Date.parse("2026-10-01T14:59:00-05:00")), null);
  assert.equal(LS.schoolNight(j, Date.parse("2026-10-01T19:00:00-05:00")), null);
});
console.log(`panel: ${n} tests PASS`);
