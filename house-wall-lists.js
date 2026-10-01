/* LISTS1 · house-wall-lists.js · branch wall-redesign-1 · loaded only by wall.html (not deployed).
   FIVE UPGRADES readers for data the wall HOSTS but does not own. Every reader is strict: file missing, not today's,
   stale, or off-shape -> null -> the tile is hidden. Nothing here sends anything to a person or a phone.
     - Atlas (ATLASLANE6, NOT on origin as of Oct 1 6:30 PM CT): data/next-up.json (leave-by line), data/logistics-taps.json
       (I'm home / Leaving / kid check-in / Running late + minutes), data/school-night.json (3-7 PM strip).
       Shapes below are PROVISIONAL (the wall's reading); re-check when ATLASLANE6 lands.
     Grocery is Ledger's own module (house-grocery-list.js), not read here. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HouseWallLists = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var TZ = "America/Chicago";
  var KIDS = ["Ainsley", "Hayes", "Harris"];
  function nowMs(n) { return n == null ? Date.now() : Number(n); }
  function parse(iso) { var t = Date.parse(iso || ""); return isFinite(t) ? t : 0; }
  function ctIso(ms) { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)); }
  function ctHour(ms) { return Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date(ms))); }
  function fresh(j, now, maxMs) {
    var g = parse(j && j.generatedAt), t = nowMs(now);
    return !!g && t - g >= -5 * 60 * 1000 && t - g <= maxMs;
  }
  function today(j, now) { return !!j && typeof j === "object" && j.asOfIso === ctIso(nowMs(now)); }
  var H6 = 6 * 60 * 60 * 1000;
  function str(s, max) { return typeof s === "string" && s.trim() && s.length <= (max || 60) ? s.trim() : null; }

  /* next-up.json (Atlas) -> leave-by line. Provisional: {asOfIso, generatedAt, leaveBy:{copy:"Leave 5:10.", atIso}} */
  function leaveLine(j, now) {
    if (!today(j, now) || !fresh(j, now, H6) || !j.leaveBy) return null;
    var c = str(j.leaveBy.copy, 40), at = parse(j.leaveBy.atIso);
    if (!c || !at || at <= nowMs(now)) return null;
    return { copy: c, atMs: at };
  }

  /* logistics-taps.json (Atlas). Provisional: {asOfIso, generatedAt, taps:[{id, label, minutes?:[n...]}]}
     ids: im-home | leaving | check-in | running-late. Unknown ids are not drawn. Running late carries a minute chip. */
  var TAP_IDS = ["im-home", "leaving", "check-in", "running-late"];
  function logisticsTaps(j, now) {
    if (!today(j, now) || !fresh(j, now, 24 * 3600 * 1000) || !Array.isArray(j.taps)) return null;
    var taps = j.taps.filter(function (t) { return t && TAP_IDS.indexOf(t.id) >= 0 && str(t.label, 24); }).map(function (t) {
      var mins = t.id === "running-late" && Array.isArray(t.minutes) ? t.minutes.filter(function (m) { return Number.isInteger(m) && m > 0 && m <= 120; }) : [];
      return { id: t.id, label: t.label.trim(), minutes: mins, kids: t.id === "check-in" ? KIDS.slice() : [] };
    }).filter(function (t) { return t.id !== "running-late" || t.minutes.length; });
    return taps.length ? { taps: taps } : null;
  }
  /* per-device tap log (nothing is sent): wardos-wall-logistics:<CT date> -> [{tap, kid?, minutes?, at}] */
  var LOG_PREFIX = "wardos-wall-logistics:";
  function logTap(store, tap, extra, now) {
    if (TAP_IDS.indexOf(tap) < 0) return null;
    var t = nowMs(now), k = LOG_PREFIX + ctIso(t), list = [];
    try { list = JSON.parse(store.get(k) || "[]"); } catch (e) { list = []; }
    var rec = { tap: tap, at: new Date(t).toISOString() };
    if (extra && KIDS.indexOf(extra.kid) >= 0) rec.kid = extra.kid;
    if (extra && Number.isInteger(extra.minutes)) rec.minutes = extra.minutes;
    list.push(rec); store.set(k, JSON.stringify(list)); return rec;
  }
  function lastTaps(store, now) {
    var list = []; try { list = JSON.parse(store.get(LOG_PREFIX + ctIso(nowMs(now))) || "[]"); } catch (e) { list = []; }
    var last = {}; list.forEach(function (r) { last[r.tap + (r.kid ? ":" + r.kid : "")] = r; }); return last;
  }

  /* school-night.json (Atlas). Shown only 3:00-6:59 PM CT. Provisional: {asOfIso, generatedAt, schoolNight:true,
     pickup?:string, gear?:[string], formDue?:string, fieldWeather?:string}. All present lines are the file's words. */
  function schoolNight(j, now) {
    var t = nowMs(now), h = ctHour(t);
    if (h < 15 || h >= 19) return null;
    if (!today(j, now) || !fresh(j, now, H6) || j.schoolNight !== true) return null;
    var lines = [];
    if (str(j.pickup)) lines.push({ k: "Pickup", v: j.pickup.trim() });
    if (Array.isArray(j.gear)) { var g = j.gear.filter(function (x) { return str(x, 30); }); if (g.length) lines.push({ k: "Gear", v: g.join(", ") }); }
    if (str(j.formDue)) lines.push({ k: "Form due", v: j.formDue.trim() });
    if (str(j.fieldWeather)) lines.push({ k: "Field", v: j.fieldWeather.trim() });
    return lines.length ? { lines: lines } : null;
  }

  /* Grocery: NOT here. The wall hosts Ledger's house-grocery-list.js (window.HouseGroceryList) as-is; see GROCERY-CONTRACT.md. */

  return { TAP_IDS: TAP_IDS, LOG_PREFIX: LOG_PREFIX, leaveLine: leaveLine, logisticsTaps: logisticsTaps, logTap: logTap, lastTaps: lastTaps,
    schoolNight: schoolNight };
});
