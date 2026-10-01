/* PANEL1 · house-wall-panel.js · branch wall-redesign-1 · loaded only by wall.html (not deployed).
   FIVE UPGRADES (Dan, Oct 1 6:19 PM CT) · #1 top-band house controls + #2 the NEXT UP house timer.
     - Setpoint −/+ through the EXISTING Sensi write path (POST /api/sensi/set {kind:"temp", mode, temp}, same key + proxy
       as house-sensi-ctl.js). Single-degree steps, no arm/confirm; debounced: one request per settled side.
       No key -> zero requests. Off / Travel / offline / no live reading -> no steps.
     - Kasa toggles: the EXISTING HouseLights.setLight, roster from HouseLights.effectiveLights() (Dining, Harris's Room, Kitchen).
     - House timer: ONE timer object, per device, persisted in localStorage so a reload keeps the countdown.
       Ends on the board only (caller shows a 2 s on-screen flash), then clears. Never touches lights, never a phone.
   Every side effect is injected so tests can count requests. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseWallPanel = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var MIN_F = 50, MAX_F = 90, DEADBAND = 3, DEBOUNCE_MS = 1200; /* = house-sensi-ctl.js */

  function isTravel(th) { return !!(th && th.heatSetpoint === 55 && th.coolSetpoint === 85); }

  /* Setpoint stepper */
  function createSetpoint(deps) {
    deps = deps || {};
    var later = deps.setTimeout || function (fn, ms) { return setTimeout(fn, ms); };
    var cancel = deps.clearTimeout || function (h) { clearTimeout(h); };
    var getToken = deps.getToken || function () { return ""; };
    var getBase = deps.getBase || function () { return ""; };
    var getReading = deps.getReading || function () { return null; };
    var onChange = deps.onChange || function () {};
    var debounce = deps.debounceMs || DEBOUNCE_MS;
    var pending = {}, timer = null, busy = false, msg = "";
    function hasKey() { return !!getToken() && !!getBase(); }
    function th() { return deps.override || getReading(); }
    function sides(t) {
      if (!t || typeof t.mode !== "string") return [];
      var m = t.mode.toLowerCase();
      if (m === "heat") return ["heat"]; if (m === "cool") return ["cool"]; if (m === "auto") return ["heat", "cool"];
      return [];
    }
    function view() {
      var t = th(), out = { hasKey: hasKey(), ambient: t && typeof t.ambient === "number" ? t.ambient : null, rows: [], reason: "", busy: busy, msg: msg };
      if (!hasKey()) { out.reason = "NEED KEY"; return out; }
      if (!t) { out.reason = "no live reading"; return out; }
      if (t.online === false) { out.reason = "Thermostat offline"; return out; }
      if (isTravel(t)) { out.reason = "Travel is on"; return out; }
      var s = sides(t);
      if (!s.length) { out.reason = "System off"; return out; }
      out.rows = s.map(function (k) {
        var cur = k === "heat" ? t.heatSetpoint : t.coolSetpoint;
        var v = pending[k] != null ? pending[k] : cur;
        return { side: k, label: k === "heat" ? "Heat" : "Cool", value: typeof v === "number" ? v : null, pending: pending[k] != null && pending[k] !== cur };
      });
      return out;
    }
    function bump(k, d) {
      var t = th(), v = view();
      if (!v.rows.length || busy) return { ok: false, reason: v.reason || "busy" };
      var row = v.rows.filter(function (r) { return r.side === k; })[0];
      if (!row || row.value == null) return { ok: false, reason: "no setpoint" };
      var n = Math.max(MIN_F, Math.min(MAX_F, row.value + (d > 0 ? 1 : -1)));
      if (String(t.mode).toLowerCase() === "auto") {
        var other = v.rows.filter(function (r) { return r.side !== k; })[0];
        if (other && other.value != null && (k === "heat" ? n > other.value - DEADBAND : n < other.value + DEADBAND)) {
          msg = "Keep " + DEADBAND + "\u00b0 between heat and cool"; onChange(); return { ok: false, reason: "deadband" };
        }
      }
      pending[k] = n; msg = "";
      if (timer) cancel(timer);
      timer = later(flush, debounce);
      onChange();
      return { ok: true, value: n };
    }
    function flush() {
      timer = null;
      var t = th(); if (!t || !hasKey() || !deps.fetch) { pending = {}; onChange(); return Promise.resolve({ sent: 0 }); }
      var jobs = Object.keys(pending).filter(function (k) {
        var cur = k === "heat" ? t.heatSetpoint : t.coolSetpoint; return pending[k] !== cur;
      }).map(function (k) { return { kind: "temp", mode: k, temp: pending[k] }; });
      if (!jobs.length) { pending = {}; onChange(); return Promise.resolve({ sent: 0 }); }
      busy = true; onChange();
      var sent = 0, chain = Promise.resolve();
      jobs.forEach(function (b) {
        chain = chain.then(function () {
          sent++;
          var tok = getToken();
          return deps.fetch(getBase() + "/api/sensi/set", { method: "POST", cache: "no-store",
            headers: { "Content-Type": "application/json", Accept: "application/json", "X-Lights-Proxy-Token": tok, Authorization: "Bearer " + tok },
            body: JSON.stringify(b) })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || "HTTP " + r.status); return j; }); })
            .then(function (j) { if (j.thermostat && deps.onReading) deps.onReading(j.thermostat, j.ts); });
        });
      });
      return chain.then(function () { busy = false; pending = {}; msg = ""; onChange(); return { sent: sent }; },
        function () { busy = false; pending = {}; msg = "not sent \u00b7 showing the thermostat's setting"; onChange(); return { sent: sent, error: true }; });
    }
    return { view: view, bump: bump, flush: flush, hasKey: hasKey, _pending: function () { return pending; } };
  }

  /* Kasa toggles (existing roster only). */
  function lightToggles(eff, hasKey) {
    var list = eff && Array.isArray(eff.lights) ? eff.lights : [];
    return list.map(function (l) {
      return { id: l.id, name: l.name || l.id, on: typeof l.on === "boolean" ? l.on : null,
        disabled: !hasKey || !(eff && eff.canWrite) || typeof l.on !== "boolean", sub: !hasKey ? "NEED KEY" : (typeof l.on !== "boolean" ? "unknown" : (l.on ? "On" : "Off")) };
    });
  }
  function toggleLight(L, eff, id, hasKey) {
    if (!hasKey || !L || typeof L.setLight !== "function") return { sent: 0, reason: "NEED KEY" };
    var t = lightToggles(eff, hasKey).filter(function (x) { return x.id === id; })[0];
    if (!t || t.disabled) return { sent: 0, reason: "unavailable" };
    L.setLight(id, { on: !t.on });
    return { sent: 1, on: !t.on };
  }

  /* House timer */
  var TIMER_KEY = "wardos-wall-timer";
  var TIMER_MINUTES = [5, 10, 15, 20, 30, 60];
  var TIMER_LABELS = ["Oven", "Laundry", "Bath"];
  function nowMs(n) { return n == null ? Date.now() : Number(n); }
  function readTimer(store) {
    var j = null; try { j = JSON.parse(store.get(TIMER_KEY) || "null"); } catch (e) { j = null; }
    if (!j || typeof j.endsAt !== "number" || TIMER_LABELS.concat(["Timer"]).indexOf(j.label) < 0) return null;
    return j;
  }
  function setTimer(store, minutes, label, now) {
    if (TIMER_MINUTES.indexOf(minutes) < 0) return null;
    var l = TIMER_LABELS.indexOf(label) >= 0 ? label : "Timer", t = nowMs(now);
    var j = { label: l, minutes: minutes, setAt: t, endsAt: t + minutes * 60000 };
    store.set(TIMER_KEY, JSON.stringify(j)); return j;
  }
  function clearTimer(store) { store.set(TIMER_KEY, ""); }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return m + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  /* -> null (none) | {running, label, text:"Oven 12:00"} | {ended:true, label, text:"Oven 0:00"} (caller shows the end on screen for 2 s, then clearTimer) */
  function timerView(store, now) {
    var j = readTimer(store); if (!j) return null;
    var left = j.endsAt - nowMs(now);
    if (left <= 0) return { ended: true, label: j.label, text: j.label + " 0:00", overdueMs: -left };
    return { running: true, label: j.label, text: j.label + " " + mmss(left), leftMs: left };
  }

  return { MIN_F: MIN_F, MAX_F: MAX_F, DEADBAND: DEADBAND, DEBOUNCE_MS: DEBOUNCE_MS, isTravel: isTravel, createSetpoint: createSetpoint,
    lightToggles: lightToggles, toggleLight: toggleLight,
    TIMER_KEY: TIMER_KEY, TIMER_MINUTES: TIMER_MINUTES, TIMER_LABELS: TIMER_LABELS, readTimer: readTimer, setTimer: setTimer, clearTimer: clearTimer, timerView: timerView, mmss: mmss };
});
