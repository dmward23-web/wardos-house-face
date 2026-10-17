/* QARELAY1 · sheet-today runtime bind: per-kid today rows from kids-week.json (NOCUSTODY1: no week state painted).
   Static HTML fallback stays empty/hidden — never day-locked facts. Day-lagged data paints nothing. */
(function () {
  "use strict";
  function ctIso() {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (e) { return ""; }
  }
  function show(el, text) {
    if (!el) return;
    el.textContent = text || "";
    if (text) el.removeAttribute("hidden"); else el.setAttribute("hidden", "");
  }
  function timeOf(when) {
    var parts = String(when || "").split("·");
    return parts.length > 1 ? parts[parts.length - 1].trim() : "";
  }
  function paint(week) {
    if (!week || !week.kids) return;
    var today = ctIso();
    if (today && week.asOfIso && week.asOfIso !== today) return; /* day-lagged: stay empty */
    /* NOCUSTODY1 · glass law: the week badge and the HOME card are not painted from homeWeek */
    var badge = document.querySelector("[data-today-bind='badge-days']");
    if (badge) { badge.hidden = true; badge.textContent = ""; }
    ["harris", "hayes", "ainsley"].forEach(function (id) {
      var kid = week.kids[id];
      var rows = ((kid && kid.today) || []).filter(function (r) {
        if (!r || r.kind === "note") return false;
        if (r.kind === "leave" || r.kind === "ride") return false;
        return !/^(Pick\s*-?\s*up|Drop)\b/i.test(String(r.what || ""));
      });
      var times = rows.map(function (r) { return timeOf(r.when); }).filter(Boolean);
      var whats = rows.map(function (r) { return String(r.what || "").trim(); }).filter(Boolean);
      show(document.querySelector("[data-today-kid-when='" + id + "']"), times.join(" · "));
      show(document.querySelector("[data-today-kid-what='" + id + "']"), whats.join(" · "));
    });
  }
  function load() {
    if (typeof fetch !== "function") return;
    fetch("kids-week.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(paint)
      .catch(function () { /* stay empty */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
  setInterval(load, 10 * 60 * 1000);
})();
