/* QARELAY1 · sheet-today runtime bind: per-kid today rows from kids-week.json (NOCUSTODY1: no week state painted).
   Static HTML fallback stays empty/hidden — never day-locked facts. Day-lagged data paints nothing. */
(function () {
  "use strict";
  function ctIso() {
    try {
      if (window.HouseClock && typeof HouseClock.iso === "function") return HouseClock.iso();
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (e) { return ""; }
  }
  function faceDash(s) { return String(s == null ? "" : s).replace(/\bMOVED\s*[\u2192\u21d2\u27a1]\s*/gi, "moved to ").replace(/\s*[\u2192\u21d2\u27a1]\s*/g, " to ").replace(/\s*\u2014\s*/g, " \u00b7 ").replace(/(\s*\u00b7\s*){2,}/g, " \u00b7 ").replace(/^\s*\u00b7\s*|\s*\u00b7\s*$/g, ""); } /* NODATA3 · no em dashes or arrows on the face */
  function showLines(el, lines) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!lines || !lines.length) { el.setAttribute("hidden", ""); return; }
    el.removeAttribute("hidden");
    lines.forEach(function (line) {
      var row = document.createElement("div");
      row.className = "kid-what-line";
      row.textContent = line;
      el.appendChild(row);
    });
  }
  function show(el, text) {
    if (!el) return;
    text = faceDash((typeof window !== "undefined" && window.AwayFilter ? window.AwayFilter.glass(text || "") : text || "")); /* AWAYLAW1 glass */
    el.textContent = text;
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
      var times = rows.map(function (r) { return timeOf(r.when); }).filter(Boolean)
        .filter(function (t, i, a) { return a.indexOf(t) === i; }); /* P1FIX B74 · "All day · All day" reads once */
      var whats = rows.map(function (r) { return String(r.what || "").trim(); }).filter(Boolean)
        .filter(function (t, i, a) { return a.indexOf(t) === i; });
      show(document.querySelector("[data-today-kid-when='" + id + "']"), times.join(" · "));
      showLines(document.querySelector("[data-today-kid-what='" + id + "']"), whats);
    });
    fitKidLines();
    setTimeout(fitKidLines, 60);
    setTimeout(fitKidLines, 400);
  }
  function fitKidLines() {
    document.querySelectorAll(".kid-card").forEach(function (card) {
      var host = card.querySelector(".kid-what");
      if (!host) return;
      var old = host.querySelector(".kid-more");
      if (old) old.remove();
      var lines = [].slice.call(host.querySelectorAll(".kid-what-line"));
      lines.forEach(function (line) { line.style.removeProperty("display"); });
      var limit = card.getBoundingClientRect().bottom - 4;
      function past(el) {
        var r = el.getBoundingClientRect();
        return r.height > 1 && r.bottom > limit + 0.5;
      }
      var hidden = 0;
      var guard = 0;
      while (guard < 40) {
        guard += 1;
        var bad = null;
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].style.display === "none") continue;
          if (past(lines[i])) bad = lines[i];
        }
        if (!bad) break;
        bad.style.setProperty("display", "none", "important");
        hidden += 1;
      }
      if (!hidden) return;
      var cue = document.createElement("div");
      cue.className = "kid-what-line kid-more";
      cue.textContent = "+" + hidden + " more";
      host.appendChild(cue);
      guard = 0;
      while (past(cue) && guard < 20) {
        guard += 1;
        var last = null;
        for (var j = lines.length - 1; j >= 0; j--) {
          if (lines[j].style.display !== "none") { last = lines[j]; break; }
        }
        if (!last) { cue.style.setProperty("display", "none", "important"); break; }
        last.style.setProperty("display", "none", "important");
        hidden += 1;
        cue.textContent = "+" + hidden + " more";
        cue.style.removeProperty("display");
      }
    });
  }
  function load() {
    if (typeof fetch !== "function") return;
    fetch("kids-week.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (w) { var law = typeof window !== "undefined" && window.HouseFaceLaw; if (w && law) law.cleanKidsWeek(w); paint(w); }) /* LIVELAW1 */
      .catch(function () { /* stay empty */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
  setInterval(load, 10 * 60 * 1000);
})();
