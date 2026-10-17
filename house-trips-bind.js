/* PRIVFEED1 · Trips (sheet-win) + Us calendar rows (sheet-us) from the private cal-months feed.
 * No trip, flight, name or place is written into the public HTML any more. Upcoming 'flight' class rows only,
 * day >= today (America/Chicago). Feed offline → list stays empty and private-feed.js shows the offline chip. */
(function () {
  "use strict";
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function face(s) { return String(s || "").replace(/\s*\u2014\s*/g, " \u00b7 ").replace(/\s*[\u2192]\s*/g, " to ").trim(); }
  function todayCT() {
    var p = {}; new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + "-" + p.month + "-" + p.day;
  }
  function dayLab(iso) { var d = new Date(iso + "T12:00:00"); return DOW[d.getDay()] + " " + MON[d.getMonth()] + " " + d.getDate(); }
  function rows(months, max) {
    var out = [], t = todayCT(), days = (months && months.days) || {};
    Object.keys(days).sort().forEach(function (iso) {
      if (iso < t) return;
      (days[iso].items || []).forEach(function (it) { if (it && it.c === "flight" && it.l) out.push({ iso: iso, l: face(it.l) }); });
    });
    return out.slice(0, max || 6);
  }
  function paint(months, offline) {
    var hero = document.querySelector("[data-trips-hero]");
    var list = document.querySelector("[data-trips-list]");
    var us = document.querySelector("[data-us-cal]");
    var r = months ? rows(months, 6) : [];
    if (hero) {
      var t = hero.querySelector(".hero-title"), s = hero.querySelector(".hero-sub");
      if (r[0]) { t.textContent = dayLab(r[0].iso) + " \u00b7 " + r[0].l; s.textContent = ""; }
      else { t.textContent = offline ? "Calendar offline" : "No trips on the calendar"; s.textContent = ""; }
    }
    if (list) {
      list.innerHTML = r.map(function (x, i) {
        return '<article class="trip' + (i === 0 ? " is-next" : "") + '"><div class="trip-when">' + esc(dayLab(x.iso)) +
          '</div><div><div class="trip-title">' + esc(x.l) + '</div></div>' + (i === 0 ? '<div class="trip-badge">NEXT</div>' : "") + "</article>";
      }).join("");
    }
    if (us) {
      us.innerHTML = r.slice(0, 3).map(function (x) {
        return '<a class="cal-row" href="month.html"><div class="cal-when">' + esc(dayLab(x.iso)) + '</div><div class="cal-what">' + esc(x.l) +
          '</div><span class="cal-tag known">Known</span></a>';
      }).join("");
    }
  }
  function go() {
    fetch("data/cal-months.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (j) { paint(j && j.days ? j : null, !(j && j.days)); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
