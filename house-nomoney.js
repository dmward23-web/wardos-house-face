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
  /* JARTAP1 NODOLLAR1 · on a kid board no '$' survives at all, hidden nodes included (a lone '$' before an empty span) */
  var KIDPAGE = !!(g.location && /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/.test(g.location.pathname || ""));
  /* DAYPKG1 v2i · Alfred v2h defect 2 (P1): the ONE Dad money sheet declares <meta name="ward-money" content="dad"> (the allowance sheet,
     URL-only, no kid board links it). There this file does nothing, so Dad's weekly dollar figure stays a dollar figure (it was swept to
     a star). Only that meta exempts; a kid board path never does, whatever it declares. */
  function dadMoneyPage() {
    if (KIDPAGE) return false;
    try { var m = g.document && g.document.querySelector('meta[name="ward-money"]'); return !!m && String(m.getAttribute("content") || "").trim() === "dad"; } catch (e) { return false; }
  }
  if (dadMoneyPage()) { g.HouseNoMoney = { text: function (s) { return s; }, scrub: function () {}, exempt: "ward-money=dad" }; return; }
  function text(s) {
    if (!s || s.indexOf("$") < 0) return s;
    if (/\$\s?\d/.test(s)) s = s.replace(MONEY, "\u2605").replace(BANK, "Stars · payday");
    return KIDPAGE ? s.replace(/\$/g, "") : s;
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CODE: 1, NOSCRIPT: 1 };
  function scrub(node) {
    if (!node) return;
    if (node.nodeType === 3) { var n = text(node.nodeValue); if (n !== node.nodeValue) node.nodeValue = n; return; }
    if (node.nodeType !== 1 || SKIP[node.tagName]) return;
    /* SWEEP1 NOSTAR1 · house-sfx floatDollar drops a "+★N" fly-up on every chore tap (hidden under kw-on, but still a star
       and a digit in the DOM). It is removed as it lands, so no star, digit or cash node ever sits on a kid page. */
    if (node.classList && node.classList.contains("vfx-dollar")) { if (node.parentNode) node.parentNode.removeChild(node); return; }
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
