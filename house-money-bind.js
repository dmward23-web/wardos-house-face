/* PRIVFEED2 · allowance money labels come from the PRIVATE kids-week (via private-feed.js), never from markup.
 * Markup carries only structure:
 *   <span data-stars="7" data-money-suffix=" wk"></span>   -> "$N wk"   (stars x the private star value)
 *   <span data-money="babysit"></span>                       -> the private hire rate label
 *   <div data-jar-goal="tour-jar">Tour Jar</div>             -> "Tour Jar · $N" (private weekly allowance for that jar)
 * Offline (no feed, no cache): labels stay EMPTY and html.money-offline is set. Never demo numbers. */
(function (g) {
  "use strict";
  var state = { starValue: null, babysit: "", jars: {}, ready: false, offline: false };
  function starValueOf(kids) {
    for (var k in kids) {
      var gl = kids[k] && kids[k].bankGoal || {};
      if (typeof gl.starDollar === "number") return gl.starDollar;
      var m = /1\s*★\s*=\s*\$(\d+(?:\.\d+)?)/.exec(String(gl.blurb || ""));
      if (m) return Number(m[1]);
    }
    return null;
  }
  function read(data) {
    var kids = (data && data.kids) || {};
    state.starValue = starValueOf(kids);
    for (var k in kids) {
      var kid = kids[k] || {}, gl = kid.bankGoal || {};
      if (gl.id && typeof gl.weeklyAllowance === "number") state.jars[gl.id] = gl.weeklyAllowance;
      (kid.quests || []).forEach(function (q) { if (q && q.rateLabel && !state.babysit) state.babysit = String(q.rateLabel); });
    }
    state.ready = true;
  }
  /* DAYPKG1 v2g (Alfred v2f P2) · '$' paints ONLY on a Dad money sheet: a page that declares <meta name="ward-money" content="dad">
     and is not a kid page. Every other page that loads this file is kid-reachable (recursive crawl from the kid boards,
     daypkg1v2g.test.mjs), so a guard by kid page name was not enough: one family sheet took 20 transient '$' writes.
     Allowlist, not denylist: an unknown page paints no money, and does not even fetch the money feed */
  var KID_RE = /\/(?:kid-[a-z]+|mercury-run)(\.html)?$/;
  function moneyOk() {
    if (KID_RE.test((g.location && g.location.pathname) || "")) return false;
    try { var m = document.querySelector('meta[name="ward-money"]'); return !!(m && m.getAttribute("content") === "dad"); } catch (e) { return false; }
  }
  function paint() {
    var root = document.documentElement;
    root.classList.toggle("money-offline", !state.ready);
    [].forEach.call(document.querySelectorAll("[data-money-suffix][data-stars]"), function (el) {
      var n = parseInt(el.getAttribute("data-stars"), 10);
      el.textContent = !moneyOk() ? "" : (state.ready && state.starValue != null && !isNaN(n) ? "$" + (n * state.starValue) + el.getAttribute("data-money-suffix") : ""); /* DAYPKG1 kid guard: no money sign on a kid page (hidden nodes too) */
    });
    [].forEach.call(document.querySelectorAll("[data-money='babysit']"), function (el) { el.textContent = !moneyOk() ? "Hire job" : (state.ready ? state.babysit : ""); }); /* DELTA2 · kid page: no rate */
    [].forEach.call(document.querySelectorAll("[data-jar-goal]"), function (el) {
      if (!el.hasAttribute("data-jar-name")) el.setAttribute("data-jar-name", el.textContent.trim());
      var v = state.jars[el.getAttribute("data-jar-goal")];
      el.textContent = el.getAttribute("data-jar-name") + (moneyOk() && state.ready && v != null ? " · $" + v : ""); /* DAYPKG1 kid guard: jar name only on a kid page */
    });
  }
  g.HouseMoney = {
    starValue: function () { return state.starValue; },
    babysit: function () { return state.babysit; },
    ready: function () { return state.ready; },
    paint: paint,
    moneyOk: moneyOk
  };
  function load() {
    if (!moneyOk() || typeof fetch !== "function") { paint(); return; } /* DAYPKG1 v2g · no money fetch off a Dad money sheet */
    fetch("kids-week.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) { read(d); paint(); })
      .catch(function () { state.offline = true; paint(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true }); else load();
})(window);
