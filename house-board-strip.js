/* House Face · live leave-by / today strip.
   Date labels ALWAYS from HouseClock (America/Chicago).
   Fact copy from kids-week.json boardStrip (or dan.today fallback).
   Never restamp HTML dates by hand. */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function pickStrip(data, clock) {
    var strip = (data && data.boardStrip) || null;
    if (strip && (strip.time || strip.place || strip.main)) {
      return {
        label: strip.label || ("Next up · " + clock.daypart),
        time: strip.time || "",
        place: strip.place || strip.main || "",
        detailHtml: strip.detailHtml || strip.detail || "",
        badge: strip.badge || clock.dow
      };
    }
    /* Fallback: first non-custody dan.today row */
    var dan = data && data.kids && data.kids.dan;
    var rows = (dan && dan.today) || [];
    var row = null;
    for (var i = 0; i < rows.length; i++) {
      if (/custody/i.test(rows[i].when || "")) continue;
      row = rows[i]; break;
    }
    if (!row) row = rows[0] || { when: clock.daypart, what: "House day @ 147th" };
    var custody = (data && data.custody && data.custody.throughLabel)
      || "kids with Dad @ 147th";
    return {
      label: "Next up · today",
      time: "",
      place: row.what || "",
      detailHtml: esc(row.when || "") + " · " + esc(custody),
      badge: clock.dow
    };
  }

  function applyStrip(strip, clock) {
    var main = document.querySelector("[data-live='leaveby-main']");
    var detail = document.querySelector("[data-live='leaveby-detail']");
    var badge = document.querySelector("[data-live='leaveby-badge']");
    var label = document.querySelector("[data-live='leaveby-label']");
    var todaySub = document.querySelector("[data-live='today-sub']");
    var dateNodes = document.querySelectorAll("[data-live='date-short']");
    var longNodes = document.querySelectorAll("[data-live='date-long']");
    var dowNodes = document.querySelectorAll("[data-live='dow']");

    dateNodes.forEach(function (n) { n.textContent = clock.short; });
    longNodes.forEach(function (n) { n.textContent = clock.long; });
    dowNodes.forEach(function (n) { n.textContent = clock.dow; });

    if (label && strip.label) label.textContent = strip.label;
    if (badge) badge.textContent = strip.badge || clock.dow;
    if (todaySub) todaySub.textContent = clock.short + " · " + clock.daypart;

    if (main) {
      var timeHtml = strip.time
        ? ' <span class="time">' + esc(strip.time) + "</span> "
        : " · ";
      main.innerHTML = esc(clock.short) + " ·" + timeHtml + esc(strip.place || "House day");
    }
    if (detail && strip.detailHtml) {
      /* detailHtml may include trusted <strong> from our JSON */
      detail.innerHTML = strip.detailHtml;
    }
  }

  function loadWeek(cb) {
    var urls = ["kids-week.json?v=" + Date.now(), "data/kids-week.json", "kids-week.json"];
    var i = 0;
    function next() {
      if (i >= urls.length) { cb(new Error("no week"), null); return; }
      var u = urls[i++];
      fetch(u, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("http");
        return r.json();
      }).then(function (d) { cb(null, d); })
        .catch(function () { next(); });
    }
    if (typeof fetch !== "function") { cb(new Error("no fetch"), null); return; }
    next();
  }

  function boot() {
    if (!global.HouseClock) return;
    var clock = HouseClock.now();
    /* Paint dates immediately so stale HTML never shows overnight */
    applyStrip({
      label: "Next up · today",
      time: "",
      place: "Loading…",
      detailHtml: "America/Chicago · live clock",
      badge: clock.dow
    }, clock);

    loadWeek(function (err, data) {
      var strip = pickStrip(data || {}, clock);
      applyStrip(strip, clock);
      /* If JSON asOfIso lags clock by >0 days, keep clock dates (already applied) */
      if (data && data.asOfIso && data.asOfIso !== clock.iso) {
        var warn = document.querySelector("[data-live='asof-warn']");
        if (warn) {
          warn.hidden = false;
          warn.textContent = "Facts as-of " + data.asOfIso + " · clock " + clock.iso;
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.HouseBoardStrip = { boot: boot, pickStrip: pickStrip, applyStrip: applyStrip };
})(typeof window !== "undefined" ? window : globalThis);
