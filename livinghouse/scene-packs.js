/* LIVING HOUSE · scene-packs.js · the season date gate. forDate() reads only the Date it is given
   (the page passes LHClock.now()). It never reads the wall clock and never fetches a feed.
   October night is the plate we have. The Halloween count turns on Oct 24. Oct 31 is street mode.
   HCOUNT1 (H1 P2D3) · the count runs to Dan's show night, Thu Oct 29 (whole CT calendar days, Oct 24 = 5), not Oct 31.
   forDate(d, cal) may also be handed the board's already-loaded cal-live feed (it still fetches nothing): the real calendar
   event "Halloween night with the kids" (id first, exact title second, never an all-day row, never the broad halloween
   regex) gives the start, shown only as 5:00 PM style text from the event itself, and ends the count at the event's end.
   No event in the feed = the date-only count to Oct 29: days, then "Tonight" on the day, never a clock time.
   November harvest and December snow have no art in this repo: those packs are missing plates. */
(function (root) {
  "use strict";
  var TZ = "America/Chicago";
  var PACKS = {
    october: { id: "october", plate: "october-night", art: "present", leaves: true, countdown: false, days: 0, street: false, glow: false, streetArt: "", why: "" },
    "october-count": { id: "october-count", plate: "october-night", art: "present", leaves: true, countdown: true, days: 0, street: false, glow: false, streetArt: "", why: "" },
    "october-street": { id: "october-street", plate: "october-night", art: "present", leaves: true, countdown: false, days: 0, street: true, glow: true, streetArt: "missing", why: "no street art yet" },
    november: { id: "november", plate: "november-harvest", art: "missing", leaves: false, countdown: false, days: 0, street: false, glow: false, streetArt: "", why: "no november harvest art" },
    december: { id: "december", plate: "december-snow", art: "missing", leaves: false, countdown: false, days: 0, street: false, glow: false, streetArt: "", why: "no december snow art" },
    base: { id: "base", plate: "october-night", art: "present", leaves: false, countdown: false, days: 0, street: false, glow: false, streetArt: "", why: "" }
  };
  function copy(id, extra) {
    var o = {}, src = PACKS[id];
    for (var k in src) o[k] = src[k];
    if (extra) for (var e in extra) o[e] = extra[e];
    return o;
  }
  /* H1P2D4 · the calendar event id is not kept in this public file: idH is the first 16 hex of its SHA-256, and feed ids are
     hashed here at run time (sync, no crypto.subtle) to match. Order stays id-hash, then exact title, then the date alone. */
  function sha16(str) {
    var K = [], H = [], i, j, p = 2;
    for (i = 0; i < 64; p++) { for (j = 2; j * j <= p && p % j; j++); if (j * j > p) { if (i < 8) H[i] = (Math.pow(p, 1 / 2) * 4294967296) | 0; K[i++] = (Math.pow(p, 1 / 3) * 4294967296) | 0; } }
    var b = unescape(encodeURIComponent(String(str))), n = b.length, W = [], w = [];
    for (i = 0; i < n; i++) W[i >> 2] |= (b.charCodeAt(i) & 255) << (24 - (i % 4) * 8);
    W[n >> 2] |= 0x80 << (24 - (n % 4) * 8); var L = (((n + 8) >> 6) + 1) * 16; W[L - 1] = n * 8;
    for (i = 0; i < L; i++) W[i] |= 0;
    var r = function (x, c) { return (x >>> c) | (x << (32 - c)); };
    for (j = 0; j < L; j += 16) {
      var a = H.slice(0, 8);
      for (i = 0; i < 64; i++) {
        if (i < 16) w[i] = W[j + i];
        else { var x = w[i - 15], y = w[i - 2]; w[i] = (w[i - 16] + (r(x, 7) ^ r(x, 18) ^ (x >>> 3)) + w[i - 7] + (r(y, 17) ^ r(y, 19) ^ (y >>> 10))) | 0; }
        var t1 = (a[7] + (r(a[4], 6) ^ r(a[4], 11) ^ r(a[4], 25)) + ((a[4] & a[5]) ^ (~a[4] & a[6])) + K[i] + w[i]) | 0;
        var t2 = ((r(a[0], 2) ^ r(a[0], 13) ^ r(a[0], 22)) + ((a[0] & a[1]) ^ (a[0] & a[2]) ^ (a[1] & a[2]))) | 0;
        a = [(t1 + t2) | 0].concat(a.slice(0, 7)); a[4] = (a[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) H[i] = (H[i] + a[i]) | 0;
    }
    var o = ""; for (i = 0; i < 2; i++) o += ("0000000" + (H[i] >>> 0).toString(16)).slice(-8);
    return o;
  }
  var SHOW = { civil: "2026-10-29", idH: "c9af6a68179fc01a", title: /^\s*halloween night with the kids\s*$/i };
  var fK = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  var fT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  function ms(v) { if (v && typeof v === "object") v = v.dateTime || ""; return typeof v === "number" ? v : Date.parse(String(v == null ? "" : v)); }
  function showTarget(cal) {   /* {start, end, via} or null; never returns the title or location */
    var rows = !cal ? [] : Array.isArray(cal.upcomingLeaves) ? cal.upcomingLeaves : Array.isArray(cal.events) ? cal.events : [], byId = null, byTitle = null;
    rows.forEach(function (e) {
      if (!e || e.allDay === true || e.allDay === "True") return;
      var s = typeof e.startMs === "number" ? e.startMs : ms(e.start); if (!isFinite(s) || fK.format(new Date(s)) !== SHOW.civil) return;
      var i = String(e.id || ""); if (i && sha16(i.split("_")[0]) === SHOW.idH) { if (!byId) byId = { e: e, s: s }; return; }   /* a recurring instance id is base_YYYYMMDD... */
      if (SHOW.title.test(String(e.summary || e.title || "")) && (!byTitle || s < byTitle.s)) byTitle = { e: e, s: s };
    });
    var h = byId || byTitle; if (!h) return null;
    var en = typeof h.e.endMs === "number" ? h.e.endMs : ms(h.e.end);
    return { start: new Date(h.s), end: isFinite(en) ? new Date(en) : null, via: byId ? "id" : "title" };
  }
  function shown(d) { return fT.format(d).replace(/[\u202f ]/g, "\u00a0"); }   /* "5:00 PM" (no-break space), from the event itself */
  function civilDays(d, civil) { var a = fK.format(d).split("-"), b = civil.split("-"); return Math.round((Date.UTC(+b[0], b[1] - 1, +b[2]) - Date.UTC(+a[0], a[1] - 1, +a[2])) / 864e5); }
  function parts(d) {
    var y = 0, m = 0, day = 0;
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d).forEach(function (p) {
      if (p.type === "year") y = +p.value;
      if (p.type === "month") m = +p.value;
      if (p.type === "day") day = +p.value;
    });
    return { y: y, m: m, d: day };
  }
  function forDate(d, cal) {
    if (!(d instanceof Date) || isNaN(+d)) return copy("base");
    var x = parts(d), left = civilDays(d, SHOW.civil);
    if (x.m === 10 && x.d >= 24 && left >= 0) {
      var t = showTarget(cal), at = t ? shown(t.start) : "";
      if (left > 0) return copy("october-count", { days: left, at: at, via: t ? t.via : "date" });
      if (t && t.end && +d >= +t.end) return copy("october");   /* after the show: the quiet October night, no "Tonight" */
      return copy("october-count", { days: 0, tonight: true, go: !!(t && +d >= +t.start), at: at, via: t ? t.via : "date" });
    }
    if (x.m === 10 && x.d === 31) return copy("october-street");
    if (x.m === 10) return copy("october");
    if (x.m === 11) return copy("november");
    if (x.m === 12) return copy("december");
    return copy("base");
  }
  var api = { forDate: forDate, parts: parts, showTarget: showTarget, shown: shown, sha16: sha16, SHOW: SHOW, PACKS: PACKS, TZ: TZ };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LHScenePacks = api;
})(typeof window !== "undefined" ? window : globalThis);
