/* AINSJAR1 · Ainsley's Tour Jar shows a STATE, never a number, star or tally (Atlas Oct 20).
 * <div data-jar-state="trusted">TRUSTED</div> under the Tour Jar label is a fixed fact in the template (Atlas Oct 20).
 * It reads TRUSTED before data and with a slow, missing, bad or unreadable feed. It reads EMPTY only when kids-week
 * explicitly sets kids.ainsley.jarState to a non-empty string other than "trusted" (a non-string value is a bad feed).
 * Feed path: the same window.fetch("kids-week.json") call house-money-bind.js makes. private-feed.js (loaded first on
 * both pages) and away-filter.js (data-away-install) wrap window.fetch, so the request goes to the paired hub's
 * /api/private/kids-week.json and comes back away-filtered; offline it answers 503 and TRUSTED stands. No digit is written. */
(function (g) {
  "use strict";
  function stateOf(d) {
    var k = d && d.kids && d.kids.ainsley;
    var v = k && typeof k.jarState === "string" ? k.jarState.trim().toLowerCase() : "";
    return v && v !== "trusted" ? "empty" : "trusted";
  }
  function paint(st) {
    [].forEach.call(document.querySelectorAll("[data-jar-state]"), function (el) {
      el.setAttribute("data-jar-state", st);
      el.textContent = st === "trusted" ? "TRUSTED" : "EMPTY";
    });
  }
  g.AinsJarState = { stateOf: stateOf, paint: paint };
  function load() {
    if (typeof fetch !== "function") return;
    fetch("kids-week.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) { paint(stateOf(d)); })
      .catch(function () { /* bad or missing feed: the template's TRUSTED stands */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true }); else load();
})(window);
