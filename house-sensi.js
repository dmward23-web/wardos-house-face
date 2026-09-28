/* House Face · Sensi thermostat local UI state.
   DEMO/STUB controls only — no live Emerson API.
   Keys: house-sensi-connected, house-sensi-state */
(function (global) {
  "use strict";

  var CONNECTED_KEY = "house-sensi-connected";
  var STATE_KEY = "house-sensi-state";
  var WEB_LOGIN = "https://mythermostat.sensicomfort.com/";
  var WEB_PRODUCT = "https://sensi.copeland.com/en-us";
  var APP_IOS = "https://apps.apple.com/us/app/sensi/id792612452";
  var APP_ANDROID = "https://play.google.com/store/apps/details?id=com.asynchrony.emerson.sensi";
  /* Undocumented deep link — try then fall back to web */
  var APP_SCHEME = "sensi://";

  var MODES = ["Heat", "Cool", "Auto", "Off"];
  var FANS = ["Auto", "On"];

  function chicagoDayKey() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
    } catch (e) {
      var d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
  }

  function defaults() {
    return {
      day: chicagoDayKey(),
      ambient: 72,
      setpoint: 70,
      mode: "Heat",
      fan: "Auto",
      hold: false
    };
  }

  function isConnected() {
    try { return localStorage.getItem(CONNECTED_KEY) === "1"; } catch (e) { return false; }
  }

  function setConnected(on) {
    try {
      if (on) localStorage.setItem(CONNECTED_KEY, "1");
      else localStorage.removeItem(CONNECTED_KEY);
    } catch (e) { /* */ }
  }

  function loadState() {
    var base = defaults();
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (!raw) return base;
      var o = JSON.parse(raw);
      if (!o || typeof o !== "object") return base;
      var day = chicagoDayKey();
      /* Keep mode/fan/setpoint across days; refresh ambient stub per Chicago day if missing */
      return {
        day: day,
        ambient: (o.day === day && typeof o.ambient === "number") ? o.ambient : base.ambient,
        setpoint: typeof o.setpoint === "number" ? clampSet(o.setpoint) : base.setpoint,
        mode: MODES.indexOf(o.mode) >= 0 ? o.mode : base.mode,
        fan: FANS.indexOf(o.fan) >= 0 ? o.fan : base.fan,
        hold: !!o.hold
      };
    } catch (e) { return base; }
  }

  function saveState(st) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        day: chicagoDayKey(),
        ambient: st.ambient,
        setpoint: clampSet(st.setpoint),
        mode: st.mode,
        fan: st.fan,
        hold: !!st.hold
      }));
    } catch (e) { /* */ }
  }

  function clampSet(n) {
    n = Math.round(Number(n) || 70);
    if (n < 50) n = 50;
    if (n > 90) n = 90;
    return n;
  }

  function modeColor(mode) {
    if (mode === "Heat") return { accent: "#c87810", soft: "#fff0d0", label: "HEAT" };
    if (mode === "Cool") return { accent: "#2868a0", soft: "#d8ecff", label: "COOL" };
    if (mode === "Auto") return { accent: "#287838", soft: "#d8f0d8", label: "AUTO" };
    return { accent: "#5a5e66", soft: "#e8ebf0", label: "OFF" };
  }

  function openUrl(url) {
    try { window.open(url, "_blank", "noopener,noreferrer"); } catch (e) {
      try { location.href = url; } catch (e2) { /* */ }
    }
  }

  function connectOpenWeb() { openUrl(WEB_LOGIN); }
  function connectOpenProduct() { openUrl(WEB_PRODUCT); }
  function connectOpenIos() { openUrl(APP_IOS); }
  function connectOpenAndroid() { openUrl(APP_ANDROID); }
  function connectTryApp() {
    /* Attempt scheme; always also surface web as honest fallback */
    try {
      var iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = APP_SCHEME;
      document.body.appendChild(iframe);
      setTimeout(function () {
        try { document.body.removeChild(iframe); } catch (e) { /* */ }
        openUrl(WEB_LOGIN);
      }, 700);
    } catch (e) {
      openUrl(WEB_LOGIN);
    }
  }

  /** Paint a compact glance chip (Home header). */
  function paintChip(el) {
    if (!el) return;
    var st = loadState();
    var connected = isConnected();
    var mc = modeColor(st.mode);
    var status = connected ? "CONNECTED · DEMO" : "CONNECT · STUB";
    el.classList.add("sensi-chip");
    el.setAttribute("href", el.getAttribute("href") || "sheet-sensi.html");
    el.innerHTML =
      '<div class="sensi-chip-ico" aria-hidden="true">🌡</div>'
      + '<div class="sensi-chip-text">'
      + '<div class="sensi-chip-kicker">Sensi · indoors</div>'
      + '<div class="sensi-chip-line">'
      + '<span class="sensi-chip-temp">' + st.ambient + "°</span>"
      + '<span class="sensi-chip-set">set ' + st.setpoint + "°</span>"
      + '<span class="sensi-chip-mode" style="--sensi-accent:' + mc.accent + '">' + mc.label + "</span>"
      + "</div>"
      + '<div class="sensi-chip-sub">' + status + " · fan " + st.fan + "</div>"
      + "</div>";
  }

  function mountChip(selector) {
    var el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) return;
    paintChip(el);
  }

  global.HouseSensi = {
    CONNECTED_KEY: CONNECTED_KEY,
    STATE_KEY: STATE_KEY,
    WEB_LOGIN: WEB_LOGIN,
    WEB_PRODUCT: WEB_PRODUCT,
    APP_IOS: APP_IOS,
    APP_ANDROID: APP_ANDROID,
    MODES: MODES,
    FANS: FANS,
    isConnected: isConnected,
    setConnected: setConnected,
    loadState: loadState,
    saveState: saveState,
    clampSet: clampSet,
    modeColor: modeColor,
    chicagoDayKey: chicagoDayKey,
    connectOpenWeb: connectOpenWeb,
    connectOpenProduct: connectOpenProduct,
    connectOpenIos: connectOpenIos,
    connectOpenAndroid: connectOpenAndroid,
    connectTryApp: connectTryApp,
    paintChip: paintChip,
    mountChip: mountChip
  };
})(typeof window !== "undefined" ? window : globalThis);
