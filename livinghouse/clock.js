/* LIVING HOUSE · clock.js · the ONE place that reads the current time. Every date and time decision on the page (moon arc and
   phase, candle, fog by days out, the away state from cal-months, season and date gates, morning sequence,
   kid hours vs Dan-only hours, past-event filtering) asks LHClock.now(). ?now=<ISO> shifts the clock only (it keeps ticking
   from that instant; with ?freeze=1 or ?rec=1 it holds that instant); feeds are never faked or rewritten. Absent = real time. When active, a corner tag says CLOCK OVERRIDE. */
(function (g) {
  var q = new URLSearchParams(location.search), raw = q.get("now"), t0 = performance.now(), base = null;
  if (raw) { var d = new Date(raw); if (!isNaN(d)) base = d.getTime(); }
  var freeze = base !== null && (q.get("freeze") === "1" || q.get("rec") === "1");   /* stills: ?now holds the given instant (no drift during slow renders) */
  function ms() { return base === null ? Date.now() : freeze ? base : base + (performance.now() - t0); }
  g.LHClock = {
    now: function () { return new Date(ms()); },          /* the shifted (or real) now */
    ms: ms,
    at: function (v) { return new Date(v); },              /* parse a feed value; never the current time */
    realMs: function () { return Date.now(); },            /* wall time for cache busting only, never for decisions */
    override: base === null ? null : raw,
    frozen: freeze
  };
  if (base !== null) document.addEventListener("DOMContentLoaded", function () {
    var t = document.createElement("div"); t.className = "lh-clocktag"; t.textContent = "CLOCK OVERRIDE " + raw; document.body.appendChild(t);
  });
})(window);
