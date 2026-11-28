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
      if (el.getAttribute("data-house-injected") === "1") return;
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
  /* R53AR · one build token in version.json. The same 30 s loop asks for it every 5 min.
     A new token reloads only while the wall is idle, and only once for that token. */
  var VER_KEY = "house-fresh:build";
  var VER_STEPS = [5, 10, 20, 30];
  var verFails = 0, verBusy = false, nextVerAt = 0, pendingTok = "", lastInput = Date.now();
  function markInput() { lastInput = Date.now(); }
  try {
    ["pointerdown", "touchstart", "keydown"].forEach(function (ev) {
      document.addEventListener(ev, markInput, true);
    });
  } catch (_) {}
  function overlayOpen() {
    try {
      if (document.getElementById && document.getElementById("hub-key-entry")) return true;
      if (!document.querySelector) return false;
      var q = document.querySelector("[role='dialog']:not([hidden]), .ori-iris, [data-ori-veil='1']");
      if (!q) return false;
      if (typeof getComputedStyle !== "function") return true;
      var s = getComputedStyle(q);
      return s.display !== "none" && s.visibility !== "hidden";
    } catch (e) { return false; }
  }
  function wallIdle() { return Date.now() - lastInput >= 60000 && !overlayOpen(); }
  function runningToken() {
    try {
      var meta = document.querySelector && document.querySelector('meta[name="wardos-build"]');
      return meta ? String(meta.getAttribute("content") || "") : "";
    } catch (e) { return ""; }
  }
  function reloadForToken(live) {
    var seen = "";
    try { seen = sessionStorage.getItem(VER_KEY) || ""; } catch (e) {}
    if (!live || seen === live) return;
    var last = 0;
    try { last = Number(sessionStorage.getItem(GUARD)) || 0; } catch (e2) {}
    if (Date.now() - last < 45000) return;
    try {
      sessionStorage.setItem(VER_KEY, live);
      sessionStorage.setItem(GUARD, String(Date.now()));
    } catch (e3) {}
    pendingTok = "";
    var q = location.search.replace(/[?&]fresh=\d+/, "").replace(/^\?/, "");
    location.replace(location.pathname + "?" + (q ? q + "&" : "") + "fresh=" + Date.now() + location.hash);
  }
  function pollVersion() {
    if (!document.querySelector) return;
    if (pendingTok) { if (wallIdle()) reloadForToken(pendingTok); return; }
    if (verBusy || Date.now() < nextVerAt) return;
    var mine = runningToken();
    if (!mine) return;
    verBusy = true;
    nextVerAt = Date.now() + 5 * 60 * 1000;
    fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("ver " + r.status);
      return r.json();
    }).then(function (j) {
      verBusy = false;
      verFails = 0;
      nextVerAt = Date.now() + 5 * 60 * 1000;
      var live = j && j.token ? String(j.token) : "";
      if (!live || live === mine) { pendingTok = ""; return; }
      var seen = "";
      try { seen = sessionStorage.getItem(VER_KEY) || ""; } catch (e) {}
      if (seen === live) return;
      pendingTok = live;
      if (wallIdle()) reloadForToken(live);
    }).catch(function () {
      verBusy = false;
      verFails += 1;
      var mins = VER_STEPS[Math.min(verFails - 1, VER_STEPS.length - 1)];
      nextVerAt = Date.now() + mins * 60 * 1000;
    });
  }
  function auditOn() {
    try { return /(?:\?|&)audit=1(?:&|$)/.test(location.search || ""); } catch (e) { return false; }
  }
  function check() {
    if (auditOn()) return;
    var d = today();
    if (loadDay && d && d !== loadDay) { reloadFresh(); return; }
    pollVersion();
    if (running === null) running = mine();
    if (!running) return;
    var url = location.pathname + "?freshcheck=" + Date.now();
    fetch(url, { cache: "no-store" }).then(function (r) {
      return r.ok ? r.text() : "";
    }).then(function (html) {
      if (!html) return;
      var live = stamps(html);
      if (!live || live === running) return;
      /* A token only the live DOM has (an injected sheet) is not a new build. Reload only when the file has a token the DOM lacks. */
      var have = {};
      String(running).split(",").forEach(function (t) { if (t) have[t] = 1; });
      var newer = String(live).split(",").some(function (t) { return t && !have[t]; });
      if (newer) reloadFresh();
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
    var at = n.getTime();
    var ms = target - at;
    if (ms < 1000) ms = ctMidnightMs(addCivil(addCivil(iso))) + 1000 - at;
    return Math.max(1000, Math.min(ms, 25 * 3600 * 1000));
  }
  function nextMidnightMs(now) {
    var n = now || new Date();
    var iso = ctCivil(n) || "1970-01-01";
    var target = ctMidnightMs(addCivil(iso)) + 1000;
    if (target - n.getTime() < 1000) target = ctMidnightMs(addCivil(addCivil(iso))) + 1000;
    return target;
  }
  function armMidnight() {
    if (auditOn()) return;
    if (midT) clearTimeout(midT);
    var target = nextMidnightMs(new Date());
    var wait = Math.max(1000, target - Date.now());
    midT = setTimeout(function () {
      midT = 0;
      /* A throttled timer can fire early. Re-check the wall clock and arm again. */
      if (Date.now() + 250 < target) { armMidnight(); return; }
      check();
      armMidnight();
    }, wait);
  }
  armMidnight();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) armMidnight(); });
  window.addEventListener("pageshow", function () { armMidnight(); });
  if (!auditOn()) setInterval(check, 30 * 1000); /* DAYROLL1 · 30 s so the day flips inside a minute of Chicago midnight */
  var root = typeof globalThis !== "undefined" ? globalThis : window;
  root.HouseFresh = { msToMidnight: msToMidnight, ctMidnightMs: ctMidnightMs };
})();
