/* SWAY1 · see wg-sway.css. Out-of-phase swing per sign, an occasional gust on one sign; reduced motion = near-still, no gusts. */
(function () {
  "use strict";
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
  var BG = ["backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat", "backgroundColor", "borderRadius"];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function skin(el, i) {
    if (el.querySelector(":scope > .wg-sw")) return;
    var cs = getComputedStyle(el), sw = document.createElement("span"), gu = document.createElement("span");
    sw.className = "wg-sw"; gu.className = "wg-gu"; sw.setAttribute("aria-hidden", "true");
    var hasBg = cs.backgroundImage !== "none" || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
    if (hasBg) BG.forEach(function (k) { gu.style[k] = cs[k]; });
    ["flexDirection","alignItems","justifyContent","padding","textAlign","lineHeight","borderWidth","borderStyle"].forEach(function (k) { gu.style[k] = cs[k]; }); gu.style.borderColor = "transparent";
    gu.style.color = cs.color; gu.style.font = cs.font; gu.style.letterSpacing = cs.letterSpacing; gu.style.textShadow = cs.textShadow;
    Array.prototype.forEach.call(el.childNodes, function (n) { gu.appendChild(n.cloneNode(true)); });
    Array.prototype.forEach.call(gu.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
    Array.prototype.forEach.call(el.childNodes, function (n) { if (n.nodeType === 3 && n.textContent.trim()) { var s = document.createElement("span"); s.textContent = n.textContent; el.replaceChild(s, n); } });
    sw.appendChild(gu); el.appendChild(sw);
    if (hasBg) el.classList.add("wg-sway-bg");
    el.classList.add("wg-sway-on");
    sw.style.setProperty("--sw-amp", rnd(1.5, 3).toFixed(2) + "deg");
    sw.style.setProperty("--sw-dur", rnd(3, 6).toFixed(2) + "s");
    sw.style.setProperty("--sw-del", (-rnd(0, 6) - i * 1.3).toFixed(2) + "s");
  }
  function refresh(el) { var sw = el.querySelector(":scope > .wg-sw"); if (sw) { sw.remove(); el.classList.remove("wg-sway-bg", "wg-sway-on"); }
    skin(el, 0); }
  function gust() {
    if (!(RM && RM.matches) && !document.hidden) {
      var all = document.querySelectorAll("[data-sway]:not([data-sway=post]) .wg-gu");
      if (all.length) { var g = all[Math.floor(Math.random() * all.length)];
        g.style.setProperty("--gu-amp", (rnd(4, 6.5) * (Math.random() < .5 ? -1 : 1)).toFixed(2) + "deg");
        g.classList.remove("gust"); void g.offsetWidth; g.classList.add("gust"); }
    }
    setTimeout(gust, rnd(9000, 20000));
  }
  function init() {
    var els = document.querySelectorAll("[data-sway]");
    Array.prototype.forEach.call(els, skin);
    if ("MutationObserver" in window) {
      /* Watch the sign and its subtree (art loads on a child, live text changes); skip changes inside our own skin. */
      var due = new Set(), t = 0, mo = new MutationObserver(function (ms) {
        ms.forEach(function (m) { var n = m.target.nodeType === 1 ? m.target : m.target.parentNode;
          if (!n || (n.closest && n.closest(".wg-sw")) || (m.type === "attributes" && m.attributeName === "class" && n.hasAttribute("data-sway"))) return;
          var host = n.closest && n.closest("[data-sway]"); if (host) due.add(host); });
        if (due.size && !t) t = setTimeout(function () { t = 0; due.forEach(refresh); due.clear(); mo.takeRecords(); }, 120);
      });
      Array.prototype.forEach.call(els, function (el) { mo.observe(el, { attributes: true, subtree: true, childList: true, characterData: true,
        attributeFilter: ["data-asset-on", "data-asset-baked", "style", "class"] }); });
    }
    setTimeout(gust, rnd(4000, 9000));
  }
  /* SWAY1+ · a tap or click nudges that sign (the static parent keeps the hit area and still navigates); reduced motion: no nudge */
  function nudge(el) { if (RM && RM.matches) return; var g = el && el.querySelector(":scope > .wg-sw .wg-gu"); if (!g) return;
    g.style.setProperty("--gu-amp", (rnd(3, 4.5) * (Math.random() < .5 ? -1 : 1)).toFixed(2) + "deg"); g.classList.remove("gust"); void g.offsetWidth; g.classList.add("gust"); }
  addEventListener("pointerdown", function (e) { var el = e.target.closest && e.target.closest("[data-sway]:not([data-sway=post])"); if (el) nudge(el); }, { passive: true });
  window.WGSway = { init: init, refresh: refresh, nudge: nudge, gustOne: function () { var a = document.querySelectorAll("[data-sway]:not([data-sway=post])"); if (a.length) nudge(a[Math.floor(Math.random() * a.length)]); } };
  if (document.readyState !== "loading") setTimeout(init, 600); else addEventListener("DOMContentLoaded", function () { setTimeout(init, 600); });
})();
