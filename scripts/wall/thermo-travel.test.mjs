// TRAVEL1 · node scripts/wall/thermo-travel.test.mjs
// Server side (scripts/sensi-travel.mjs) with a fake Sensi + memory store, and the wall glue
// (house-wall-actions.js) with a fake fetch so we can count requests.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import * as T from "../sensi-travel.mjs";
const require = createRequire(import.meta.url);
const A = require("../../house-wall-actions.js");
const S = require("../../house-wall-status.js");

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

function fakeSensi(start, log) {
  const th = { online: true, ambient: 72, ...start };
  return {
    th,
    async readState() { log.push("read"); return { ...th }; },
    async setMode(m) { log.push("mode:" + m); th.mode = m; return { ...th }; },
    async setTemp(k, v) { log.push(k + ":" + v); th[k === "heat" ? "heatSetpoint" : "coolSetpoint"] = v; return { ...th }; },
  };
}
function memStore(log, initial = null) {
  let c = initial;
  return { load: () => c, save: (x) => { log.push("save"); c = x; }, clear: () => { log.push("clear"); c = null; } };
}

// ---- server ----
await t("capture happens BEFORE any write", async () => {
  const log = []; const sensi = fakeSensi({ mode: "heat", heatSetpoint: 66, coolSetpoint: 74 }, log);
  await T.goTravel({ sensi, store: memStore(log), now: 0 });
  assert.equal(log[0], "read"); assert.equal(log[1], "save");
  assert.deepEqual(log.slice(2), ["mode:auto", "cool:85", "heat:55"]);
  assert.equal(T.isTravel(sensi.th), true);
});
await t("restore is exact (mode + both setpoints), then capture cleared", async () => {
  const log = []; const store = memStore(log);
  const sensi = fakeSensi({ mode: "cool", heatSetpoint: 64, coolSetpoint: 76 }, log);
  await T.goTravel({ sensi, store });
  const r = await T.goBack({ sensi, store });
  assert.deepEqual({ mode: sensi.th.mode, h: sensi.th.heatSetpoint, c: sensi.th.coolSetpoint }, { mode: "cool", h: 64, c: 76 });
  assert.equal(r.ok, true); assert.equal(store.load(), null); assert.equal(log.at(-1), "clear");
});
await t("no restore without a capture: nothing sent", async () => {
  const log = []; const sensi = fakeSensi({ mode: "auto", heatSetpoint: 55, coolSetpoint: 85 }, log);
  await assert.rejects(T.goBack({ sensi, store: memStore(log) }), /no saved setting/);
  assert.deepEqual(log, []);
});
await t("already in Travel: no writes, existing capture kept", async () => {
  const log = []; const cap = { v: 1, mode: "auto", heatSetpoint: 65, coolSetpoint: 73, capturedAt: "x" };
  const store = memStore(log, cap); const sensi = fakeSensi({ mode: "auto", heatSetpoint: 55, coolSetpoint: 85 }, log);
  const r = await T.goTravel({ sensi, store });
  assert.equal(r.already, true); assert.deepEqual(log, ["read"]); assert.equal(store.load(), cap);
});
await t("incomplete live reading: nothing captured, nothing sent", async () => {
  const log = []; const sensi = fakeSensi({ mode: "auto", heatSetpoint: null, coolSetpoint: 73 }, log);
  await assert.rejects(T.goTravel({ sensi, store: memStore(log) }), /nothing sent/);
  assert.deepEqual(log, ["read"]);
});
await t("restore mismatch keeps the capture", async () => {
  const log = []; const cap = { v: 1, mode: "heat", heatSetpoint: 66, coolSetpoint: 74, capturedAt: "x" };
  const store = memStore(log, cap); const sensi = fakeSensi({ mode: "auto", heatSetpoint: 55, coolSetpoint: 85 }, log);
  sensi.setMode = async () => { log.push("mode:ignored"); return { ...sensi.th }; }; // thermostat refuses mode
  await assert.rejects(T.goBack({ sensi, store }), /saved setting kept/);
  assert.equal(store.load(), cap);
});
await t("file store: mode 600, survives reload, atomic", async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "travel-")), "sub", "restore.json");
  const a = T.fileStore(f); const cap = T.captureOf({ mode: "Auto", heatSetpoint: 65, coolSetpoint: 73 }, 0);
  a.save(cap);
  assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  assert.deepEqual(T.fileStore(f).load(), cap); // a fresh store (page/proxy reload) still sees it
  a.clear(); assert.equal(T.fileStore(f).load(), null);
});

await t("with key but lights client not ready: nothing sent, quiet reason", async () => {
  const writes = [];
  const w = A.create({ getToken: () => "k", getBase: () => "https://hub", lights: { canWrite: () => false, setLight: (id, p) => writes.push([id, p]) } });
  assert.deepEqual(w.scene("leave"), { sent: 0, reason: "lights offline" }); assert.equal(writes.length, 0);
});
// ---- wall glue (request counting) ----
function fakeFetch(calls, reply) {
  return (url, opt) => { calls.push([opt && opt.method || "GET", url, opt && opt.body]); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(reply(url, opt)) }); };
}
const live = { online: true, ambient: 73, mode: "Auto", heatSetpoint: 65, coolSetpoint: 73 };
await t("no key: scenes + travel send zero requests", async () => {
  const calls = [], writes = [];
  const w = A.create({ fetch: fakeFetch(calls, () => ({ ok: true })), getToken: () => "", getBase: () => "https://hub",
    lights: { setLight: (id, p) => writes.push([id, p]) }, initialReading: live });
  assert.deepEqual(w.scene("leave"), { sent: 0, reason: "NEED KEY" });
  await w.refresh(); await w.tap(); await w.tap();
  assert.equal(calls.length, 0); assert.equal(writes.length, 0);
  assert.equal(w.button().sub, "NEED KEY");
});
await t("with key: scene uses the existing lights client exactly", async () => {
  const writes = [];
  const w = A.create({ getToken: () => "k", getBase: () => "https://hub", lights: { setLight: (id, p) => writes.push([id, p]) } });
  assert.deepEqual(w.scene("home"), { sent: 2 });
  assert.deepEqual(writes, [["kitchen", { on: true }], ["dining-room", { on: true }]]);
});
await t("arm then confirm: one POST only on the second tap; auto-disarm after 5s", async () => {
  const calls = []; let clock = 1000; const timers = [];
  let posted = false; const tr = { ...live, heatSetpoint: 55, coolSetpoint: 85 };
  const w = A.create({ fetch: fakeFetch(calls, (u, o) => { if (o && o.method === "POST") { posted = true; return { ok: true, saved: true, thermostat: tr }; } return posted ? { ok: true, saved: true, thermostat: tr } : { ok: true, saved: false, thermostat: live }; }),
    getToken: () => "k", getBase: () => "https://hub", now: () => clock, setTimeout: (fn, ms) => { timers.push([fn, ms]); return timers.length; }, clearTimeout: () => {} });
  await w.refresh(); assert.equal(calls.length, 1);
  let r = await w.tap(); assert.equal(r.sent, false); assert.equal(w.button().label, "Tap again \u00b7 Travel 55\u201385");
  assert.equal(timers[0][1], S.ARM_MS);
  timers[0][0](); assert.equal(w.button().label, "Travel"); // auto-disarm fired
  await w.tap(); clock += 2000; r = await w.tap();
  assert.equal(r.sent, true); assert.equal(calls.filter((c) => c[0] === "POST").length, 1); assert.equal(JSON.parse(calls[1][2]).action, "travel");
  assert.equal(calls.length, 3); // POST then one GET re-read of the live reading
  assert.equal(w.button().label, "Back home");
});
await t("Back home with no capture on the hub: zero POSTs", async () => {
  const calls = [];
  const w = A.create({ fetch: fakeFetch(calls, () => ({ ok: true, saved: false, thermostat: { ...live, heatSetpoint: 55, coolSetpoint: 85 } })),
    getToken: () => "k", getBase: () => "https://hub", now: () => 0 });
  await w.refresh(); await w.tap(); await w.tap();
  assert.equal(calls.filter((c) => c[0] === "POST").length, 0);
  assert.equal(w.button().sub, "no saved setting");
});
console.log(`thermo-travel: ${n} tests PASS`);
