/* QARELAY1 · sheet-today runtime bind: homeWeek + per-kid today rows from kids-week.json.
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
    var hw = week.homeWeek || {};
    var away = hw.with === "away" || hw.with === "Mom"; /* AWAY2 · never name her house */
    var badge = document.querySelector("[data-today-bind='badge-days']"); /* BADGE1 · live week end, hidden on her days */
    if (badge) {
      var endDay = String(hw.through || "").split("·")[0].trim();
      if (away || !endDay) { badge.hidden = true; badge.textContent = ""; }
      else { badge.textContent = "Dad week · → " + endDay; badge.hidden = false; }
    }
    if (away) {
      show(document.querySelector("[data-today-bind='homeweek']"), "Kids away" + (hw.through && !/next Dad week/i.test(hw.through) ? " · back " + hw.through : ""));
      show(document.querySelector("[data-today-bind='through']"), "Kids away");
      var lbl = document.querySelector("[data-today-bind='homeweek-lbl']"); if (lbl) lbl.textContent = "KIDS AWAY";
      var big = document.querySelector("[data-today-bind='homeweek-big']"); if (big) big.textContent = "Kids away";
    } else {
      var lbl2 = document.querySelector("[data-today-bind='homeweek-lbl']"); if (lbl2 && hw.with) lbl2.textContent = "WITH " + String(hw.with).toUpperCase();
      var big2 = document.querySelector("[data-today-bind='homeweek-big']"); if (big2 && hw.with) big2.textContent = "With " + hw.with + (hw.place ? " · @ " + hw.place : "");
      if (hw.with && hw.place) {
        show(document.querySelector("[data-today-bind='homeweek']"),
          "Kids with " + hw.with + " @ " + hw.place + (hw.through ? " through " + hw.through : ""));
      }
      if (hw.through) show(document.querySelector("[data-today-bind='through']"), "Through " + hw.through);
    }
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
