/* House Face · HDRHOME1 · the page header IS the Home button (Dan 10/1).
 * Tap / click anywhere in the top title bar → sheet-index.html (main board).
 * Real controls inside the header (sound toggle, Us, weather/thermostat ovals,
 * Cams, cam start/stop) keep doing their own job. Live bits (clock, pills)
 * are plain text, so tapping them goes home too.
 * Also strips any leftover header link to sheet-index.html (old Home button).
 * Works with touch: header gets touch-action:manipulation (no 300ms delay,
 * page pan still allowed) and we listen to plain click, which taps fire. */
(function () {
  "use strict";
  var HOME = "sheet-index.html";
  var HOME_RE = /(^|\/)sheet-index\.html(?:[?#]|$)/;
  var CONTROL = "a[href],button,input,select,textarea,label,summary,[role=button],[data-mute-toggle],[contenteditable=true]";

  function injectStyle() {
    if (document.getElementById("hdr-home-css")) return;
    var s = document.createElement("style");
    s.id = "hdr-home-css";
    s.textContent =
      "header.hdr-home-tap{cursor:pointer!important;touch-action:manipulation!important;" +
      "-webkit-tap-highlight-color:rgba(255,255,255,0.08);pointer-events:auto!important;" +
      "-webkit-user-select:none;user-select:none}" +
      "header.hdr-home-tap *{cursor:pointer}" +
      "header.hdr-home-tap a[href],header.hdr-home-tap button{cursor:pointer}" +
      "header.hdr-home-tap:active{filter:brightness(1.12)}" +
      "header.hdr-home-tap:focus-visible{outline:3px solid rgba(255,220,140,0.8);outline-offset:2px}";
    (document.head || document.documentElement).appendChild(s);
  }

  function goHome() {
    try { if (window.HouseSfx && window.HouseSfx.tap) window.HouseSfx.tap(); } catch (e) {}
    try { window.location.assign(HOME); } catch (e2) { window.location.href = HOME; }
  }

  function pickHeader() {
    return document.querySelector("header.hdr") || document.querySelector("body > .shell > header, body header");
  }

  function wire() {
    var h = pickHeader();
    if (!h || h.getAttribute("data-hdr-home") === "1") return;
    h.setAttribute("data-hdr-home", "1");
    h.classList.add("hdr-home-tap");
    h.setAttribute("tabindex", "0");
    h.setAttribute("title", "Back to the House board");
    /* old Home buttons → gone (header replaces them) */
    h.querySelectorAll("a[href]").forEach(function (a) {
      if (HOME_RE.test(a.getAttribute("href") || "")) {
        var row = a.parentElement;
        a.remove();
        if (row && row.classList.contains("nav-row") && !row.children.length) row.remove();
      }
    });
    function inHeader(ev) {
      if (h.contains(ev.target)) return true;
      /* decorative overlays (pointer-events:auto floats) drawn over the bar */
      var r = h.getBoundingClientRect();
      return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    }
    document.addEventListener("click", function (ev) {
      if (ev.defaultPrevented || ev.button > 0) return;
      if (!inHeader(ev)) return;
      var t = ev.target && ev.target.closest ? ev.target.closest(CONTROL) : null;
      if (t && t !== h) return; /* a real control inside/over the header */
      ev.preventDefault();
      goHome();
    });
    h.addEventListener("keydown", function (ev) {
      if (ev.target !== h) return;
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); goHome(); }
    });
  }

  injectStyle();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
