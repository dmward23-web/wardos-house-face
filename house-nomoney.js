/* NOMONEY1 · kid dollar figures never reach the glass, at any viewport, live or cached.
   Render-time only: data files and the private feed are untouched. Every dollar figure in visible text (a whole-dollar amount, an hourly rate, a per-week chip)
   becomes a star, and the bank line reads "Stars · payday". house-ori-world.js has the same scrub, but it
   only runs where the ori world boots; this file runs on every kid-money page regardless of layout or viewport.
   The grown-ups desk gate never shows dollars either (WALL-STATION.md). */
(function (g) {
  "use strict";
  if (g.HouseNoMoney) return;
  var MONEY = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s*\/\s*hr)?/g;
  var BANK = /Balance\s*★\s*·\s*Week\s*★\s*·\s*Jar\s*★\s*\/\s*★/i;
  function text(s) {
    if (!s || s.indexOf("$") < 0 || !/\$\s?\d/.test(s)) return s;
    return s.replace(MONEY, "\u2605").replace(BANK, "Stars · payday");
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CODE: 1, NOSCRIPT: 1 };
  function scrub(node) {
    if (!node) return;
    if (node.nodeType === 3) { var n = text(node.nodeValue); if (n !== node.nodeValue) node.nodeValue = n; return; }
    if (node.nodeType !== 1 || SKIP[node.tagName]) return;
    ["title", "aria-label", "data-tip"].forEach(function (a) {
      var v = node.getAttribute && node.getAttribute(a);
      if (v) { var n2 = text(v); if (n2 !== v) node.setAttribute(a, n2); }
    });
    for (var c = node.firstChild; c; c = c.nextSibling) scrub(c);
  }
  function all() { try { scrub(document.body); } catch (e) {} }
  var pending = 0;
  function soon() { if (pending) return; pending = setTimeout(function () { pending = 0; all(); }, 0); }
  function boot() {
    all();
    try {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (m.type === "characterData") { var n = text(m.target.nodeValue); if (n !== m.target.nodeValue) m.target.nodeValue = n; continue; }
          for (var j = 0; j < (m.addedNodes || []).length; j++) scrub(m.addedNodes[j]);
          if (m.type === "attributes") soon();
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "data-tip"] });
    } catch (e) {}
    var s = g.HouseSfx;
    if (s && typeof s.floatDollar === "function" && !s._noMoney) { s._noMoney = true; s.floatDollar = function (el) { if (s.floatPopup) s.floatPopup(el, "\u2605"); }; }
  }
  g.HouseNoMoney = { text: text, scrub: scrub };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  g.addEventListener && g.addEventListener("load", function () { all(); boot.sfx || setTimeout(function () { var s = g.HouseSfx; if (s && typeof s.floatDollar === "function" && !s._noMoney) { s._noMoney = true; s.floatDollar = function (el) { if (s.floatPopup) s.floatPopup(el, "\u2605"); }; } }, 400); });
})(typeof window !== "undefined" ? window : globalThis);
