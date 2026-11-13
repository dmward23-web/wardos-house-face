/* AINSJAR1 · Ainsley's jar stays "Jar is empty"
 * A sentence in public kids-week.json is not a Dad grant. No credential or provenance
 * channel exists, so grantLine ignores its argument. Never a counter, never an invented TRUSTED. */
(function (g) {
  "use strict";
  var PLACE = { trusted: true, empty: true, unset: true, resting: true, paused: true, none: true };
  var EMPTY = "Jar is empty";
  function grantLine(d) {
    /* Public kids-week prose is not a Dad grant. No credential or provenance channel exists, so every state stays untrusted. */
    return "";
  }
  function stateOf(d) {
    return grantLine(d) ? "grant" : "unset";
  }
  function paint(d) {
    var line = grantLine(d);
    [].forEach.call(document.querySelectorAll("[data-jar-state]"), function (el) {
      el.setAttribute("data-jar-state", line ? "grant" : "unset");
      el.textContent = line || EMPTY;
    });
  }
  g.AinsJarState = { stateOf: stateOf, grantLine: grantLine, paint: paint, empty: EMPTY };
  function settled() { var r = document.documentElement; if (r && r.setAttribute) r.setAttribute("data-jar-settled", "settled"); }
  function load() {
    paint(null);
    settled();
    if (typeof fetch !== "function") return;
    fetch("kids-week.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) { paint(d); })
      .catch(function () { paint(null); })
      .then(settled);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true }); else load();
})(window);
