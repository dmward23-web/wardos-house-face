/* HOME17 · the header is not a Home control. One .wardos-home button
   (house icon, top-left, 96px stage) is the only way back to the hub.
   This file stays so existing script tags still resolve. It does not
   wire the header and it does not remove the Home button. */
(function () {
  "use strict";
  return;
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
      /* MUTEHIT1 · a canvas/HUD drawn over a header control (mute) must not swallow it: hit-test real controls by rect */
      var hit = null;
      h.querySelectorAll(CONTROL).forEach(function (c) {
        if (hit) return; var r = c.getBoundingClientRect();
        if (r.width && r.height && ev.clientX >= r.left - 6 && ev.clientX <= r.right + 6 && ev.clientY >= r.top - 6 && ev.clientY <= r.bottom + 6) hit = c;
      });
      if (hit) { ev.preventDefault(); ev.stopPropagation(); hit.click(); return; }
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
