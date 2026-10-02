/* house-us-erupt.js · JARHERO1 / Alfred 6:19 PM. The Us together board erupts ONLY on Atlas's existing Us together rule:
   the same signal that lights Weekend fun (3 kids, Mon-Thu closes, 10 of 12), computed in scripts/house/kid-layer-lib.mjs
   usTogetherFor() and published as data/kid-seats.json usTogether.lit. It never reads a jar, a jar state, Ainsley's
   trusted-with, or Ledger's book. Rule not met -> nothing at all (no callout, no partial version). */
(function (g) {
  "use strict";
  function shouldErupt(kidSeats) {
    var u = kidSeats && kidSeats.usTogether;
    return !!(u && u.lit === true);
  }
  var api = { shouldErupt: shouldErupt };
  if (typeof module === "object" && module.exports) module.exports = api;
  g.HouseUsErupt = api;
  var doc = g.document;
  if (!doc || !g.fetch) return;
  function run() {
    var tile = doc.getElementById("us-board");
    if (!tile) return;
    g.fetch("data/kid-seats.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (d) {
        if (!shouldErupt(d)) return;
        if (g.JarMercury && typeof g.JarMercury.eruptUsTogether === "function") g.JarMercury.eruptUsTogether(tile);
      });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", run); else run();
})(typeof window !== "undefined" ? window : globalThis);
