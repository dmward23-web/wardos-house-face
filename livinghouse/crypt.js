/* LIVING HOUSE · crypt.js · monthly jars of calendar moments the page already cleaned.
   The photo slot is an empty hook. This file never fetches, and it has no photo or Drive URL. */
(function (root) {
  "use strict";
  var MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function photoHook() {
    return { feed: "missing", why: "photo index not approved", src: "" };
  }
  function jars(items) {
    var map = {}, order = [];
    (items || []).forEach(function (it) {
      var t = String(it && it.t || "").replace(/\s+/g, " ").trim();
      var key = String(it && it.month || "");
      if (!t || !/^\d{4}-\d{2}$/.test(key)) return;
      if (!map[key]) { map[key] = []; order.push(key); }
      if (map[key].length >= 8) return;
      if (map[key].some(function (x) { return x.t === t; })) return;
      map[key].push({ t: t });
    });
    order.sort();
    return order.map(function (k) {
      var m = +k.slice(5, 7);
      return { key: k, label: MONTHS[m] || "", items: map[k] };
    });
  }
  var api = { photoHook: photoHook, jars: jars };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LHCrypt = api;
})(typeof window !== "undefined" ? window : globalThis);
