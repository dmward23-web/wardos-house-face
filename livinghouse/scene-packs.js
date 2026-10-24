/* LIVING HOUSE · scene-packs.js · the season date gate. forDate() reads only the Date it is given
   (the page passes LHClock.now()). It never reads the wall clock and never fetches a feed.
   October night is the plate we have. The Halloween count turns on Oct 24. Oct 31 is street mode.
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
  function parts(d) {
    var y = 0, m = 0, day = 0;
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d).forEach(function (p) {
      if (p.type === "year") y = +p.value;
      if (p.type === "month") m = +p.value;
      if (p.type === "day") day = +p.value;
    });
    return { y: y, m: m, d: day };
  }
  function forDate(d) {
    if (!(d instanceof Date) || isNaN(+d)) return copy("base");
    var x = parts(d);
    if (x.m === 10 && x.d >= 24 && x.d <= 30) return copy("october-count", { days: 31 - x.d });
    if (x.m === 10 && x.d === 31) return copy("october-street");
    if (x.m === 10) return copy("october");
    if (x.m === 11) return copy("november");
    if (x.m === 12) return copy("december");
    return copy("base");
  }
  var api = { forDate: forDate, parts: parts, PACKS: PACKS, TZ: TZ };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LHScenePacks = api;
})(typeof window !== "undefined" ? window : globalThis);
