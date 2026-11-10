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
  function auditOn() {
    try { return /(?:\?|&)audit=1(?:&|$)/.test(location.search || ""); } catch (e) { return false; }
  }
  function check() {
    if (auditOn()) return;
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
  function ctCivil(d) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    } catch (e) { return ""; }
  }
  function addCivil(iso) {
    var p = String(iso).split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  function ctMidnightMs(civil) {
    var guess = new Date(civil + "T12:00:00Z");
    var name = "GMT-6";
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "shortOffset" }).formatToParts(guess);
      for (var i = 0; i < parts.length; i++) if (parts[i].type === "timeZoneName") name = parts[i].value;
    } catch (e) { /* CST */ }
    var m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
    var mins = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : -360;
    return new Date(civil + "T00:00:00Z").getTime() - mins * 60000;
  }
  /* Next America/Chicago midnight, not the machine's local midnight. */
  function msToMidnight(now) {
    var n = now || new Date();
    var iso = ctCivil(n) || "1970-01-01";
    var target = ctMidnightMs(addCivil(iso)) + 1000;
    var ms = target - Date.now();
    if (ms < 1000) ms = ctMidnightMs(addCivil(addCivil(iso))) + 1000 - Date.now();
    return Math.max(1000, Math.min(ms, 25 * 3600 * 1000));
  }
  function armMidnight() {
    if (auditOn()) return;
    if (midT) clearTimeout(midT);
    midT = setTimeout(function () { midT = 0; check(); armMidnight(); }, msToMidnight());
  }
  armMidnight();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) armMidnight(); });
  window.addEventListener("pageshow", function () { armMidnight(); });
  if (!auditOn()) setInterval(check, 30 * 1000); /* DAYROLL1 · 30 s so the day flips inside a minute of Chicago midnight */
  var root = typeof globalThis !== "undefined" ? globalThis : window;
  root.HouseFresh = { msToMidnight: msToMidnight, ctMidnightMs: ctMidnightMs };
})();
