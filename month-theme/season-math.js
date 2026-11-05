/* SUNHOME1 · Chicago season coat. The Date passed in is the only clock.
   November starts as late harvest and grows colder, with the first flakes after the 12th.
   December keeps that cold, deepens living snow, and lights one more window each day through the 25th. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MonthSeason = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  var TZ = "America/Chicago";
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function parts(d) {
    if (!(d instanceof Date) || isNaN(+d)) return null;
    var y = 0, m = 0, day = 0;
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d).forEach(function (p) {
      if (p.type === "year") y = +p.value;
      if (p.type === "month") m = +p.value;
      if (p.type === "day") day = +p.value;
    });
    return { y: y, m: m, d: day };
  }
  function decide(d) {
    var x = parts(d);
    if (!x) return { id: "other", cold: 0, flakes: 0, snow: 0, lit: 0, windows: 0 };
    if (x.m === 11) {
      var cold = clamp((x.d - 1) / 29, 0, 1);
      var flakes = clamp((x.d - 12) / 18, 0, 1);
      return {
        id: "november",
        cold: +cold.toFixed(3),
        flakes: +flakes.toFixed(3),
        snow: +flakes.toFixed(3),
        lit: 0,
        windows: 2
      };
    }
    if (x.m === 12) {
      var depth = clamp(0.35 + (x.d - 1) / 40, 0.35, 1);
      return {
        id: "december",
        cold: 1,
        flakes: 1,
        snow: +depth.toFixed(3),
        lit: Math.min(25, x.d),
        windows: 25
      };
    }
    return { id: "other", cold: 0, flakes: 0, snow: 0, lit: 0, windows: 0 };
  }
  return { TZ: TZ, parts: parts, decide: decide, clamp: clamp };
});
