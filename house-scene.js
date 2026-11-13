/* ACERFIX · one solar scene for the house boards.
   Kansas City, America/Chicago. Day is sun elevation >= -0.833 deg (NOAA low-precision, same formula as house-weather.js).
   Dusk is civil twilight only: -6 deg <= elevation < -0.833. Below that is night.
   No hour literals. ?now=<ISO> pins the display clock (freeze=1 is the same pin). Credential and cache clocks stay on Date.now().
   The fallback cell is the public one-decimal city cell, stored as integer tenths so this file carries no precise home location. */
(function (global) {
  "use strict";
  var TZ = "America/Chicago";
  var DAY_ELEV = -0.833;
  var DUSK_ELEV = -6;
  var subs = [];
  var timer = 0;
  var started = false;

  function readPin() {
    try {
      var q = new URLSearchParams(global.location.search);
      var raw = q.get("now");
      if (!raw) return null;
      var d = new Date(raw);
      return isNaN(+d) ? null : d;
    } catch (e) {
      return null;
    }
  }
  var pinned = readPin();

  function now() {
    if (pinned) return new Date(+pinned);
    var L = global.LHClock;
    if (L && typeof L.now === "function") {
      try {
        var d = L.now();
        if (d && !isNaN(+d)) return new Date(+d);
      } catch (e1) { /* live clock */ }
    }
    return new Date();
  }

  function cell() {
    try {
      var s = JSON.parse(global.localStorage.getItem("wxsky") || "null");
      if (s && isFinite(s.lat) && isFinite(s.lon)) {
        return { lat: Math.round(Number(s.lat) * 10) / 10, lon: Math.round(Number(s.lon) * 10) / 10 };
      }
    } catch (e) { /* no sky cell yet */ }
    return { lat: 391 / 10, lon: -946 / 10 };
  }

  function elevation(date, at) {
    var when = date ? new Date(date) : now();
    if (isNaN(+when)) return null;
    var c = at || cell();
    if (!c || !isFinite(c.lat) || !isFinite(c.lon)) return null;
    var rad = Math.PI / 180;
    var n = when.getTime() / 86400000 + 2440587.5 - 2451545.0;
    var L = (280.460 + 0.9856474 * n) % 360;
    if (L < 0) L += 360;
    var g = ((357.528 + 0.9856003 * n) % 360);
    if (g < 0) g += 360;
    g *= rad;
    var lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    var eps = (23.439 - 0.0000004 * n) * rad;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    var gmst = (18.697374558 + 24.06570982441908 * n) % 24;
    if (gmst < 0) gmst += 24;
    var lst = (gmst * 15 + Number(c.lon)) * rad;
    var ha = lst - ra;
    var lat = Number(c.lat) * rad;
    return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) / rad;
  }

  function phase(date, at) {
    var el = elevation(date, at);
    if (el == null) return "night";
    if (el >= DAY_ELEV) return "day";
    if (el >= DUSK_ELEV) return "dusk";
    return "night";
  }

  function sunDown(date, at) {
    var el = elevation(date, at);
    if (el == null) return null;
    return el < DAY_ELEV;
  }

  function plates(date) {
    var p = phase(date);
    var wall = p === "day" ? "morning" : p;
    var hub = p === "day" ? "day" : p;
    return {
      phase: p,
      wall: "month-theme/november/wall-" + wall + ".webp",
      phone: "month-theme/november/phone-" + wall + ".webp",
      hub: "month-theme/november/hub-window-" + hub + "-900x864.webp"
    };
  }

  function ctStamp(date) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZoneName: "short"
      }).format(date || now());
    } catch (e) {
      return "";
    }
  }

  function ctKey(date) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
      }).format(date || now());
    } catch (e2) {
      return "";
    }
  }

  function predecode(url, done) {
    var im = new Image();
    im.onload = function () { done(url); };
    im.onerror = function () { done(url); };
    im.src = url;
    if (im.decode) im.decode().then(function () { done(url); }, function () { done(url); });
  }

  function apply() {
    if (typeof document === "undefined") return plates(now());
    var pack = plates(now());
    var root = document.documentElement;
    var narrow = root.getAttribute("data-wardos-stage") !== "1" && (global.innerWidth || 0) < 700;
    var bg = narrow ? pack.phone : pack.wall;
    root.setAttribute("data-scene-phase", pack.phase);
    root.setAttribute("data-nov-phase", pack.phase);
    var url = "url(\"" + bg + "\")";
    root.style.setProperty("--km-bg", url);
    root.style.setProperty("--wg-hubbg", url);
    var img = document.querySelector(".hub-window img");
    if (img && img.getAttribute("src") !== pack.hub) {
      predecode(pack.hub, function (src) {
        if (img.getAttribute("src") !== src) img.setAttribute("src", src);
      });
    }
    return pack;
  }

  function notify() {
    var pack = apply();
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](pack); } catch (e) { /* a consumer must not stop the clock */ }
    }
    return pack;
  }

  function subscribe(fn) {
    if (typeof fn === "function") subs.push(fn);
    return function () {
      var i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  function start() {
    if (started || typeof document === "undefined") return;
    started = true;
    notify();
    if (typeof setInterval === "function") timer = setInterval(notify, 60000);
    global.addEventListener("pageshow", notify);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) notify();
    });
  }

  global.HouseScene = {
    TZ: TZ,
    DAY_ELEV: DAY_ELEV,
    DUSK_ELEV: DUSK_ELEV,
    now: now,
    cell: cell,
    elevation: elevation,
    phase: phase,
    sunDown: sunDown,
    plates: plates,
    ctStamp: ctStamp,
    ctKey: ctKey,
    apply: apply,
    subscribe: subscribe,
    start: start,
    pinned: function () { return !!pinned; }
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(typeof window !== "undefined" ? window : globalThis);
