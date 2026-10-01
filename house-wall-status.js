/* WALLKIT1 · house-wall-status.js · branch wall-redesign-1 · NOT WIRED.
   No live page loads this file. Pure rules for the 27" wall status lights + open loops.
   No DOM, no fetch, no timers, no writes. Every light returns null (= hidden) or {id, ok, text, href}.
   Stale or missing data -> null. Never a placeholder. Never invents a scene, device, band, or cadence.
   Plan: docs/wall-redesign/STATUS-LIGHTS.md + OPEN-LOOPS.md. Tests: scripts/wall/house-wall-status.test.mjs */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseWallStatus = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TZ = "America/Chicago";
  /* Fresh windows mirror constants that already ship (no new numbers). */
  var FRESH = {
    nest: 30 * 60 * 1000,        /* house-nest.js LIVE_FRESH_MS */
    sensi: 30 * 60 * 1000,       /* house-sensi.js LIVE_FRESH_MS */
    lights: 24 * 60 * 60 * 1000, /* house-lights.js LIVE_FRESH_MS */
    cal: 6 * 60 * 60 * 1000      /* house-board-strip.js CAL_FRESH_MS */
  };
  var HUB = "sheet-google-home.html";
  var LOAD = "sheet-load-day.html";
  var TRAVEL_MODE = "Nashville week";

  function nowMs(now) { return now == null ? Date.now() : (now instanceof Date ? now.getTime() : Number(now)); }
  function parse(iso) { if (!iso) return 0; var t = Date.parse(iso); return isFinite(t) ? t : 0; }
  function fresh(iso, maxMs, now) {
    var t = parse(iso);
    if (!t || !(maxMs > 0)) return false;
    var age = nowMs(now) - t;
    return age >= -5 * 60 * 1000 && age <= maxMs;
  }
  function ctIso(ms) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  }
  function addDaysIso(iso, n) {
    var p = iso.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n, 12));
    return d.toISOString().slice(0, 10);
  }
  function shortCam(name) { return String(name || "").replace(/\s+camera$/i, "").trim(); }
  function nameList(names) {
    if (names.length <= 2) return names.join(", ");
    return names[0] + " +" + (names.length - 1);
  }

  /* 1 · Doors / cams. Label says "Cams" until a real door source exists. */
  function camsLight(nest, opts) {
    opts = opts || {};
    var now = opts.now;
    if (!nest || nest.status !== "live" || nest.error) return null;
    if (!fresh(nest.fetchedAt || nest.updatedAt, FRESH.nest, now)) return null;
    var cams = Array.isArray(nest.cameras) ? nest.cameras : [];
    if (!cams.length) return null;
    var byName = {};
    cams.forEach(function (c) { byName[String(c.name || "")] = c; });
    var roster = Array.isArray(opts.roster) && opts.roster.length ? opts.roster : cams.map(function (c) { return c.name; });
    var bad = [], unknown = false;
    roster.forEach(function (n) {
      var c = byName[n];
      if (!c || c.online === false) bad.push(shortCam(n));
      else if (c.online !== true) unknown = true;
    });
    var doors = opts.doors; /* {ok:boolean, bad:[names], asOf, freshMs} or undefined (no source today) */
    var doorsOk = null;
    if (doors && fresh(doors.asOf, doors.freshMs, now)) {
      if (Array.isArray(doors.bad) && doors.bad.length) bad = doors.bad.concat(bad);
      else if (doors.ok === true) doorsOk = true;
    }
    if (bad.length) return { id: "cams", ok: false, text: nameList(bad) + " offline", href: HUB };
    if (unknown) return null; /* can't claim OK on online:null */
    return { id: "cams", ok: true, text: doorsOk ? "Doors + cams OK" : "Cams OK", href: HUB };
  }

  /* 2 · Thermostat vs house mode. bands come from Dan; none ship. */
  function inRange(v, r) { return !Array.isArray(r) || (typeof v === "number" && v >= r[0] && v <= r[1]); }
  function thermoLight(sensi, opts) {
    opts = opts || {};
    if (!sensi || sensi.status !== "live" || sensi.error || !sensi.thermostat) return null;
    if (!fresh(sensi.updatedAt, FRESH.sensi, opts.now)) return null;
    var th = sensi.thermostat;
    if (th.online === false) return { id: "thermo", ok: false, text: "Thermostat offline", href: HUB };
    if (typeof th.ambient !== "number") return null;
    var mode = opts.mode && opts.mode.label ? opts.mode : null;
    var text = th.ambient + "\u00b0" + (mode ? ", " + mode.label : "");
    var band = mode && opts.bands ? opts.bands[mode.id || mode.label] : null;
    if (band) {
      var hvacOk = !Array.isArray(band.mode) || band.mode.indexOf(th.mode) >= 0;
      var spOk = inRange(th.heatSetpoint, band.heatSetpoint) && inRange(th.coolSetpoint, band.coolSetpoint);
      if (!hvacOk || !spOk) {
        var set = (th.heatSetpoint != null && th.coolSetpoint != null && /^auto$/i.test(th.mode))
          ? th.heatSetpoint + "\u2013" + th.coolSetpoint : String(th.setpoint != null ? th.setpoint : "");
        return { id: "thermo", ok: false, text: text + " \u00b7 check set " + set + "\u00b0", href: HUB };
      }
    }
    return { id: "thermo", ok: true, text: text, href: HUB };
  }

  /* 3 · Load day, only today or tomorrow. src = {loadDay:{isoDate,label}, asOfIso} from an Atlas feed (none exists yet). */
  function loadDayLight(src, opts) {
    opts = opts || {};
    if (!src || !src.loadDay || !src.loadDay.isoDate) return null;
    var today = ctIso(nowMs(opts.now));
    if (src.asOfIso !== today) return null;
    var d = src.loadDay.isoDate;
    if (d === today) return { id: "loadday", ok: true, text: "Load day today", href: LOAD };
    if (d === addDaysIso(today, 1)) return { id: "loadday", ok: true, text: "Load day tomorrow", href: LOAD };
    return null;
  }

  /* 4 · Dragon + pond, travel-week mode only. care = {dragon:{fed:boolean, asOf}, pond:{filterOk:boolean, asOf}}.
     fresh = {dragon: ms, pond: ms} must be given by Dan/Atlas; cadence is UNKNOWN so absent window -> hidden. */
  function travelLights(mode, care, opts) {
    opts = opts || {};
    var out = [];
    if (!mode || mode.label !== TRAVEL_MODE || !care) return out;
    var fw = opts.fresh || {};
    var dg = care.dragon, pd = care.pond;
    if (dg && typeof dg.fed === "boolean" && fresh(dg.asOf, fw.dragon, opts.now)) {
      out.push({ id: "dragon", ok: dg.fed, text: dg.fed ? "Dragon fed" : "Dragon not fed", href: null });
    }
    if (pd && typeof pd.filterOk === "boolean" && fresh(pd.asOf, fw.pond, opts.now)) {
      out.push({ id: "pond", ok: pd.filterOk, text: pd.filterOk ? "Pond filter OK" : "Pond filter not OK", href: null });
    }
    return out;
  }

  function statusStrip(feeds, opts) {
    feeds = feeds || {}; opts = opts || {};
    var lights = [
      camsLight(feeds.nest, { now: opts.now, roster: opts.roster, doors: feeds.doors }),
      thermoLight(feeds.sensi, { now: opts.now, mode: opts.mode, bands: opts.bands }),
      loadDayLight(feeds.loadDay, { now: opts.now })
    ].concat(travelLights(opts.mode, feeds.care, { now: opts.now, fresh: opts.careFresh }));
    return lights.filter(Boolean);
  }

  /* ---------- open loops: max 3, house objects only ---------- */
  var MONEY_RE = /\$|\b(bills?|balances?|autopay|wells|cards?|pay|paid|payment|owed?|cost|price|buy|bought|bids?|quotes?|invoice|refund|ledger|cash|budget|dollars?|usd)\b/i;
  var KID_DOLLAR_RE = /\b(jars?|gems?|stars?|allowance|payday|rewards?)\b/i;
  var PEOPLE_RE = /\b(hayes|ainsley|harris|erin|kristin|dan|daniel|mom|dad|coach|riley|casey|text|email|call|reply|legal|court|therap\w*)\b/i;
  var SEVERITY = { safety: 0, device: 1, task: 2 };

  function isHouseLoop(item) {
    if (!item || item.kind !== "house-object" || !item.object || !item.text) return false;
    var obj = String(item.object);
    var rest = String(item.text).split(obj).join(" ");
    if (MONEY_RE.test(obj) || MONEY_RE.test(rest)) return false;
    if (KID_DOLLAR_RE.test(obj) || KID_DOLLAR_RE.test(rest)) return false;
    if (item.rosterName !== true && PEOPLE_RE.test(obj)) return false; /* device names only via live roster */
    if (PEOPLE_RE.test(rest)) return false;
    return SEVERITY.hasOwnProperty(item.severity);
  }

  function openLoops(items, opts) {
    opts = opts || {};
    var list = (Array.isArray(items) ? items : []).filter(function (it) {
      return isHouseLoop(it) && fresh(it.asOf, it.freshMs, opts.now);
    });
    list.sort(function (a, b) {
      var s = SEVERITY[a.severity] - SEVERITY[b.severity];
      if (s) return s;
      var da = parse(a.due), db = parse(b.due);
      if (da && db && da !== db) return da - db;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return String(a.object).localeCompare(String(b.object));
    });
    return list.slice(0, 3); /* [] -> strip hidden */
  }

  /* Loops derivable from feeds that exist today: Kasa light offline. */
  function lightLoops(lightsLive) {
    if (!lightsLive || lightsLive.status !== "live" || !Array.isArray(lightsLive.lights)) return [];
    return lightsLive.lights.filter(function (l) { return l && l.online === false && l.name; }).map(function (l) {
      var obj = l.name + " light";
      return { kind: "house-object", object: obj, rosterName: true, text: obj + " offline", severity: "device",
        asOf: lightsLive.fetchedAt, freshMs: FRESH.lights, href: HUB };
    });
  }

  return {
    FRESH: FRESH, TRAVEL_MODE: TRAVEL_MODE,
    camsLight: camsLight, thermoLight: thermoLight, loadDayLight: loadDayLight,
    travelLights: travelLights, statusStrip: statusStrip,
    isHouseLoop: isHouseLoop, openLoops: openLoops, lightLoops: lightLoops,
    _ctIso: ctIso
  };
});
