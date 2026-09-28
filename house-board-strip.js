/* House Face · live leave-by / Schedule strip (HUBNEXT2).
   Date labels ALWAYS from HouseClock (America/Chicago).
   Authority: data/cal-live.json (dmward23 → cal-from-events.mjs).
   Panel paints today's remaining + tomorrow peek (dense list, hub-scale type).
   Never paint a past boardStrip.time/place. Never silent day-lagged kids-week.
   Glass law: never CUSTODY — WITH DAD / Dad week.
   CAL_FRESH_MS = 6 hours — past that, or asOfIso ≠ clock day → fail-closed CAL STALE. */
(function (global) {
  "use strict";

  var CAL_FRESH_MS = 6 * 60 * 60 * 1000;
  var MAX_TODAY = 8;
  var MAX_TOMORROW = 6;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** Kids-safe: never surface CUSTODY on glass. */
  function kidsSafe(s) {
    var t = String(s == null ? "" : s);
    t = t.replace(/\bCUSTODY\b/gi, "WITH DAD");
    t = t.replace(/\bcustody\b/gi, "Dad week");
    return t;
  }

  function parseMs(iso) {
    if (!iso) return 0;
    var t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function ageMs(data) {
    if (!data) return Infinity;
    var t = parseMs(data.fetchedAt || data.updatedAt);
    if (!t) return Infinity;
    return Date.now() - t;
  }

  function clockTimeFromIso(iso) {
    if (!iso) return "";
    try {
      var p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).formatToParts(new Date(iso)).forEach(function (x) {
        if (x.type !== "literal") p[x.type] = x.value;
      });
      return (p.hour || "") + ":" + (p.minute || "");
    } catch (e) {
      return "";
    }
  }

  function shortPlace(summary) {
    var s = kidsSafe(String(summary || "").trim());
    s = s.replace(/^Leave\s*[·•\-–—]\s*/i, "");
    s = s.replace(/\(\s*Mom[^)]*\)/gi, "");
    s = s.replace(/\bMom\b[^·]*/gi, "");
    s = s.replace(/\s{2,}/g, " ").replace(/\s·\s*$/g, "").trim();
    if (s.length > 64) s = s.slice(0, 61) + "…";
    return s;
  }

  function eventStartMs(ev) {
    if (!ev) return 0;
    if (ev.startMs && Number.isFinite(ev.startMs)) return ev.startMs;
    return parseMs(ev.start || ev.startDateTime || ev.dateTime);
  }

  /** Chicago calendar day for timed events; date-only for all-day (Z midnight = that UTC date). */
  function eventDayIso(ev) {
    if (!ev) return "";
    var start = ev.start || ev.startDateTime || ev.dateTime || "";
    if (ev.allDay) {
      var m = String(start).match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : "";
    }
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date(eventStartMs(ev)));
    } catch (e) {
      var m2 = String(start).match(/^(\d{4}-\d{2}-\d{2})/);
      return m2 ? m2[1] : "";
    }
  }

  function addDaysIso(iso, days) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return "";
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function dowShortFromIso(iso) {
    try {
      var parts = String(iso).split("-");
      var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0));
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago", weekday: "short"
      }).format(d);
    } catch (e) {
      return "";
    }
  }

  function listEvents(cal) {
    return (cal && (cal.upcomingLeaves || cal.events)) || [];
  }

  /** First future event by start (> now). */
  function pickNextFuture(cal, nowMs) {
    nowMs = nowMs || Date.now();
    var list = listEvents(cal);
    var future = [];
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (ev.allDay) continue; /* next hero prefers timed leave */
      var ms = eventStartMs(ev);
      if (ms > nowMs) future.push(ev);
    }
    future.sort(function (a, b) { return eventStartMs(a) - eventStartMs(b); });
    if (!future.length) {
      /* fall back: any future including all-day tomorrow */
      for (var j = 0; j < list.length; j++) {
        var ms2 = eventStartMs(list[j]);
        if (ms2 > nowMs) future.push(list[j]);
      }
      future.sort(function (a, b) { return eventStartMs(a) - eventStartMs(b); });
    }
    if (!future.length) return null;
    var first = future[0];
    var firstMs = eventStartMs(first);
    for (var k = 0; k < future.length; k++) {
      if (eventStartMs(future[k]) !== firstMs) break;
      if (future[k].busy) return future[k];
    }
    return first;
  }

  function remainingToday(cal, clock, nowMs) {
    nowMs = nowMs || Date.now();
    var today = clock.iso;
    var out = [];
    var list = listEvents(cal);
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (eventDayIso(ev) !== today) continue;
      if (ev.allDay) {
        /* all-day today: show while day is current */
        out.push(ev);
        continue;
      }
      if (eventStartMs(ev) > nowMs) out.push(ev);
    }
    out.sort(function (a, b) {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return eventStartMs(a) - eventStartMs(b);
    });
    return out.slice(0, MAX_TODAY);
  }

  function tomorrowPeek(cal, clock) {
    var tmr = addDaysIso(clock.iso, 1);
    var list = listEvents(cal);
    var busy = [];
    var allday = [];
    var other = [];
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (eventDayIso(ev) !== tmr) continue;
      if (ev.allDay) allday.push(ev);
      else if (ev.busy) busy.push(ev);
      else other.push(ev);
    }
    busy.sort(function (a, b) { return eventStartMs(a) - eventStartMs(b); });
    other.sort(function (a, b) { return eventStartMs(a) - eventStartMs(b); });
    var merged = allday.concat(busy).concat(other);
    return { day: tmr, dow: dowShortFromIso(tmr), items: merged.slice(0, MAX_TOMORROW) };
  }

  function stripFromEvent(ev, clock) {
    if (!ev) {
      return {
        label: "Schedule · today",
        time: "",
        place: "Clear · no future on glass",
        detailHtml: "Calendar window empty · America/Chicago",
        badge: clock.dow
      };
    }
    var startMs = eventStartMs(ev);
    var startIsoDay = eventDayIso(ev) || clock.iso;
    var isToday = startIsoDay === clock.iso;
    var dow = clock.dow;
    try {
      dow = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago", weekday: "short"
      }).format(new Date(startMs));
    } catch (e2) { /* keep */ }
    var place = shortPlace(ev.summary || ev.place || "");
    var time = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "");
    return {
      label: isToday ? "Schedule · today" : ("Schedule · " + dow),
      time: time === "day" ? "" : time,
      place: place,
      detailHtml: "<strong>" + esc(time) + "</strong> " +
        esc(place) +
        (ev.location ? (" · " + esc(String(ev.location).split(",")[0])) : ""),
      badge: isToday ? clock.dow : dow
    };
  }

  function staleStrip(clock, reason) {
    return {
      label: "Schedule · today",
      time: "",
      place: "CAL STALE",
      detailHtml: esc(reason || "cal-live missing"),
      badge: clock.dow,
      _stale: true,
      _reason: reason || "cal-live missing",
      today: [],
      tomorrow: { day: "", dow: "", items: [] }
    };
  }

  function calIsFresh(cal, clock) {
    if (!cal) return { ok: false, reason: "cal-live missing" };
    if (cal.status === "error") {
      return { ok: false, reason: "cal error: " + (cal.error || "unknown") };
    }
    if (cal.status === "stale") {
      return { ok: false, reason: "cal-live status stale" };
    }
    if (cal.status !== "live") {
      return { ok: false, reason: "cal-live status " + (cal.status || "unknown") };
    }
    if (ageMs(cal) >= CAL_FRESH_MS) {
      return { ok: false, reason: "cal-live aged out · >6h" };
    }
    if (cal.asOfIso && clock && cal.asOfIso !== clock.iso) {
      return {
        ok: false,
        reason: "facts as-of " + cal.asOfIso + " · clock " + clock.iso
      };
    }
    return { ok: true, reason: null };
  }

  function pickStripFromCal(cal, clock) {
    var next = pickNextFuture(cal, Date.now());
    var strip = next
      ? stripFromEvent(next, clock)
      : {
          label: "Schedule · today",
          time: "",
          place: "Clear · no future on glass",
          detailHtml: "No upcoming events in cal-live window",
          badge: clock.dow
        };
    strip.today = remainingToday(cal, clock, Date.now());
    strip.tomorrow = tomorrowPeek(cal, clock);
    return strip;
  }

  function rowHtml(ev, isNext) {
    var title = shortPlace(ev.summary || ev.place || "");
    var timeLab = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
    var cls = "leaveby-row" + (isNext ? " is-next" : "") + (ev.allDay ? " is-allday" : "");
    return '<li class="' + cls + '">' +
      '<span class="leaveby-row-time">' + esc(timeLab) + "</span>" +
      '<span class="leaveby-row-title">' + esc(title) + "</span>" +
      "</li>";
  }

  function paintLists(strip) {
    var todayEl = document.querySelector("[data-live='leaveby-today']");
    var tmrEl = document.querySelector("[data-live='leaveby-tomorrow']");
    var tmrLab = document.querySelector("[data-live='leaveby-tmr-label']");

    var today = (strip && strip.today) || [];
    var tmr = (strip && strip.tomorrow) || { items: [], dow: "" };

    if (todayEl) {
      if (strip && strip._stale) {
        todayEl.innerHTML = '<li class="leaveby-empty">CAL STALE</li>';
      } else if (!today.length) {
        todayEl.innerHTML = '<li class="leaveby-empty">Clear · nothing left today</li>';
      } else {
        var html = "";
        for (var i = 0; i < today.length; i++) {
          html += rowHtml(today[i], i === 0 && !today[i].allDay);
        }
        todayEl.innerHTML = html;
      }
    }

    if (tmrLab) {
      tmrLab.textContent = tmr.dow
        ? ("Tomorrow · " + tmr.dow)
        : "Tomorrow";
    }
    if (tmrEl) {
      if (strip && strip._stale) {
        tmrEl.innerHTML = '<li class="leaveby-empty">—</li>';
      } else if (!tmr.items || !tmr.items.length) {
        tmrEl.innerHTML = '<li class="leaveby-empty">Clear on glass</li>';
      } else {
        var th = "";
        for (var j = 0; j < tmr.items.length; j++) {
          th += rowHtml(tmr.items[j], false);
        }
        tmrEl.innerHTML = th;
      }
    }
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
    var warn = document.querySelector("[data-live='asof-warn']");

    dateNodes.forEach(function (n) { n.textContent = clock.short; });
    longNodes.forEach(function (n) { n.textContent = clock.long; });
    dowNodes.forEach(function (n) { n.textContent = clock.dow; });

    if (label && strip.label) label.textContent = strip.label;
    if (badge) badge.textContent = strip.badge || clock.dow;
    if (todaySub) todaySub.textContent = clock.short + " · " + clock.daypart;

    var hotEv = document.querySelector("[data-live='hot-pill-event']");
    if (hotEv) {
      if (strip._stale) hotEv.textContent = "CAL STALE";
      else if (strip.time && strip.place) hotEv.textContent = strip.time + " · " + strip.place;
      else if (strip.place) hotEv.textContent = strip.place;
      else hotEv.textContent = "Loading…";
    }

    if (main) {
      if (strip._stale) {
        main.innerHTML = esc(clock.short) + " · CAL STALE";
      } else if (strip.time && strip.place) {
        main.innerHTML = "Next" +
          ' <span class="time">' + esc(strip.time) + "</span> " +
          esc(strip.place);
      } else if (strip.place) {
        main.innerHTML = esc(strip.place);
      } else {
        main.innerHTML = esc(clock.short) + " · House day";
      }
    }
    if (detail && strip.detailHtml) {
      detail.innerHTML = strip.detailHtml;
    }

    paintLists(strip);

    if (warn) {
      if (strip._stale) {
        warn.hidden = false;
        warn.textContent = strip._reason || "CAL STALE";
      } else {
        warn.hidden = true;
        warn.textContent = "";
      }
    }
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }

  function loadCal(cb) {
    var urls = [
      "data/cal-live.json?v=" + Date.now(),
      "data/cal-live.json"
    ];
    var i = 0;
    function next() {
      if (i >= urls.length) { cb(new Error("cal-live missing"), null); return; }
      var u = urls[i++];
      fetchJson(u).then(function (d) { cb(null, d); })
        .catch(function () { next(); });
    }
    if (typeof fetch !== "function") { cb(new Error("no fetch"), null); return; }
    next();
  }

  function loadWeek(cb) {
    var urls = ["kids-week.json?v=" + Date.now(), "data/kids-week.json", "kids-week.json"];
    var i = 0;
    function next() {
      if (i >= urls.length) { cb(new Error("no week"), null); return; }
      var u = urls[i++];
      fetchJson(u).then(function (d) { cb(null, d); })
        .catch(function () { next(); });
    }
    if (typeof fetch !== "function") { cb(new Error("no fetch"), null); return; }
    next();
  }

  function boot() {
    if (!global.HouseClock) return;
    var clock = HouseClock.now();
    applyStrip({
      label: "Schedule · today",
      time: "",
      place: "Loading…",
      detailHtml: "America/Chicago · live clock",
      badge: clock.dow,
      today: [],
      tomorrow: { day: "", dow: "", items: [] }
    }, clock);

    loadCal(function (err, cal) {
      var gate = calIsFresh(cal, clock);
      if (!err && gate.ok) {
        applyStrip(pickStripFromCal(cal, clock), clock);
        return;
      }
      var reason = gate.reason || (err && err.message) || "cal-live missing";
      applyStrip(staleStrip(clock, reason), clock);
      loadWeek(function () { /* no-op for strip */ });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* Re-advance Next Up ~ every 60s so past items drop without full reload */
  setInterval(function () {
    if (!global.HouseClock) return;
    loadCal(function (err, cal) {
      var clock = HouseClock.now();
      var gate = calIsFresh(cal, clock);
      if (!err && gate.ok) applyStrip(pickStripFromCal(cal, clock), clock);
    });
  }, 60 * 1000);

  global.HouseBoardStrip = {
    boot: boot,
    pickNextFuture: pickNextFuture,
    pickStripFromCal: pickStripFromCal,
    remainingToday: remainingToday,
    tomorrowPeek: tomorrowPeek,
    calIsFresh: calIsFresh,
    staleStrip: staleStrip,
    stripFromEvent: stripFromEvent,
    applyStrip: applyStrip,
    CAL_FRESH_MS: CAL_FRESH_MS
  };
})(typeof window !== "undefined" ? window : globalThis);
