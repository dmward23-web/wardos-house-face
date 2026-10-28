/* House Face · FRESH1 · the phone keeps a copy of the page for up to 10 min
 * (GitHub Pages max-age=600) and iOS home-screen apps hold it even longer.
 * On open, on return to the app, and every 3 min: fetch this page fresh and
 * compare its ?v= build stamps with the ones running now. If a newer build is
 * live, reload onto it. Loop-guarded (max once per 45s). */
(function () {
  "use strict";
  if (typeof fetch !== "function") return;
  var GUARD = "house-fresh:last";
  function stamps(html) {
    var out = [], re = /\.(?:js|css)\?v=([A-Za-z0-9_.-]+)/g, m;
    while ((m = re.exec(html))) out.push(m[1]);
    return out.sort().join(",");
  }
  function mine() {
    var bits = [];
    document.querySelectorAll("script[src],link[rel=stylesheet][href]").forEach(function (el) {
      bits.push(el.getAttribute("src") || el.getAttribute("href") || "");
    });
    return stamps(bits.join(" "));
  }
  var running = null;
  /* SWEEP1 DAYROLL1 · a board left open overnight (the desk PC) kept the day it loaded: the kid pages read the day once, so
     Monday morning still showed Sunday and a tap landed on Sunday. When the Chicago date has changed since load, reload
     (same 45s loop guard) so the board, the jar and the taps all move to the new day. */
  function today() {
    try {
      if (typeof HouseClock !== "undefined" && HouseClock.iso) return HouseClock.iso();
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (_) { return ""; }
  }
  var loadDay = today();
  function reloadFresh() {
    var last = 0;
    try { last = Number(sessionStorage.getItem(GUARD)) || 0; } catch (_) {}
    if (Date.now() - last < 45000) return;
    try { sessionStorage.setItem(GUARD, String(Date.now())); } catch (_) {}
    var q = location.search.replace(/[?&]fresh=\d+/, "").replace(/^\?/, "");
    location.replace(location.pathname + "?" + (q ? q + "&" : "") + "fresh=" + Date.now() + location.hash);
  }
  function check() {
    var d = today();
    if (loadDay && d && d !== loadDay) { reloadFresh(); return; }
    if (running === null) running = mine();
    if (!running) return;
    var url = location.pathname + "?freshcheck=" + Date.now();
    fetch(url, { cache: "no-store" }).then(function (r) {
      return r.ok ? r.text() : "";
    }).then(function (html) {
      if (!html) return;
      var live = stamps(html);
      if (!live || live === running) return;
      reloadFresh();
    }).catch(function () {});
  }
  if (document.readyState === "complete") setTimeout(check, 1500);
  else window.addEventListener("load", function () { setTimeout(check, 1500); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) check(); });
  /* JARTAP1-DELTA1 MIDNIGHT1 · the 30 s poll alone let a crossing slip to ~48 s (timer drift/throttle). Also fire once at the
     next local midnight + 1 s (DST-safe: new Date(y, m, d + 1, 0, 0, 1)), re-armed after each fire and on return to the page.
     It runs the same check(): the day compare plus the 45 s reloadFresh guard keep it idempotent with the poll. */
  var midT = 0;
  function msToMidnight(now) {
    var n = now || new Date();
    var ms = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1).getTime() - n.getTime();
    return Math.max(1000, Math.min(ms, 25 * 3600 * 1000));
  }
  function armMidnight() {
    if (midT) clearTimeout(midT);
    midT = setTimeout(function () { midT = 0; check(); armMidnight(); }, msToMidnight());
  }
  armMidnight();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) armMidnight(); });
  window.addEventListener("pageshow", function () { armMidnight(); });
  setInterval(check, 30 * 1000); /* DAYROLL1 · 30 s (JARTAP1, Atlas 11:51 PM) so the day flips well inside a minute of midnight; the stamp fetch is one no-store GET */
})();
