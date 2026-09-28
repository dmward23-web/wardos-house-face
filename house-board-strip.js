/* House Face · live leave-by / Next Up strip (CALFIX1).
   Date labels ALWAYS from HouseClock (America/Chicago).
   Authority: data/cal-live.json (dmward23 → cal-from-events.mjs).
   Next Up = first upcomingLeaves/events with start > clock.now (client-side).
   Never paint a past boardStrip.time/place. Never silent day-lagged kids-week.
   CAL_FRESH_MS = 6 hours — past that, or asOfIso ≠ clock day → fail-closed CAL STALE. */
(function (global) {
  "use strict";

  /* Fresh window for cal-live.json (Atlas standing refresh should beat this). */
  var CAL_FRESH_MS = 6 * 60 * 60 * 1000;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    var s = String(summary || "").trim();
    s = s.replace(/^Leave\s*[·•\-–—]\s*/i, "");
    s = s.replace(/\(\s*Mom[^)]*\)/gi, "");
    s = s.replace(/\bMom\b[^·]*/gi, "");
    s = s.replace(/\s{2,}/g, " ").replace(/\s·\s*$/g, "").trim();
    if (s.length > 56) s = s.slice(0, 53) + "…";
    return s;
  }

  function eventStartMs(ev) {
    if (!ev) return 0;
    if (ev.startMs && Number.isFinite(ev.startMs)) return ev.startMs;
    return parseMs(ev.start || ev.startDateTime || ev.dateTime);
  }

  /** First future event by start (> now). Client advances Next Up inside a fresh window. */
  function pickNextFuture(cal, nowMs) {
    nowMs = nowMs || Date.now();
    var list = (cal && (cal.upcomingLeaves || cal.events)) || [];
    var future = [];
    for (var i = 0; i < list.length; i++) {
      var ms = eventStartMs(list[i]);
      if (ms > nowMs) future.push(list[i]);
    }
    future.sort(function (a, b) { return eventStartMs(a) - eventStartMs(b); });
    if (!future.length) return null;
    /* Same-start tie-break: Busy preferred */
    var first = future[0];
    var firstMs = eventStartMs(first);
    for (var j = 0; j < future.length; j++) {
      if (eventStartMs(future[j]) !== firstMs) break;
      if (future[j].busy) return future[j];
    }
    return first;
  }

  function stripFromEvent(ev, clock) {
    if (!ev) {
      return {
        label: "Next up · today",
        time: "",
        place: "Clear · no future on glass",
        detailHtml: "Calendar window empty · America/Chicago",
        badge: clock.dow
      };
    }
    var startMs = eventStartMs(ev);
    var startIsoDay = "";
    try {
      startIsoDay = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date(startMs));
    } catch (e) {
      startIsoDay = clock.iso;
    }
    var isToday = startIsoDay === clock.iso;
    var dow = clock.dow;
    try {
      dow = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago", weekday: "short"
      }).format(new Date(startMs));
    } catch (e2) { /* keep */ }
    return {
      label: isToday ? "Next up · today" : ("Next up · " + dow),
      time: clockTimeFromIso(ev.start) || "",
      place: shortPlace(ev.summary || ev.place || ""),
      detailHtml: "<strong>" + esc(clockTimeFromIso(ev.start) || "") + "</strong> " +
        esc(shortPlace(ev.summary || "")) +
        (ev.location ? (" · " + esc(String(ev.location).split(",")[0])) : ""),
      badge: isToday ? clock.dow : dow
    };
  }

  function staleStrip(clock, reason) {
    return {
      label: "Next up · today",
      time: "",
      place: "CAL STALE",
      detailHtml: esc(reason || "cal-live missing"),
      badge: clock.dow,
      _stale: true,
      _reason: reason || "cal-live missing"
    };
  }

  /** cal-live is authoritative only when live + fresh + same Chicago day. */
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
    if (next) return stripFromEvent(next, clock);
    /* Live but empty future window — honest empty, not lagged vanity */
    return {
      label: "Next up · today",
      time: "",
      place: "Clear · no future on glass",
      detailHtml: "No upcoming events in cal-live window",
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
    var warn = document.querySelector("[data-live='asof-warn']");

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
      /* detailHtml may include trusted <strong> from our JSON / builder */
      detail.innerHTML = strip.detailHtml;
    }

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
      label: "Next up · today",
      time: "",
      place: "Loading…",
      detailHtml: "America/Chicago · live clock",
      badge: clock.dow
    }, clock);

    loadCal(function (err, cal) {
      var gate = calIsFresh(cal, clock);
      if (!err && gate.ok) {
        applyStrip(pickStripFromCal(cal, clock), clock);
        return;
      }
      /* Fail-closed — do NOT paint day-lagged kids-week boardStrip as truth */
      var reason = gate.reason || (err && err.message) || "cal-live missing";
      applyStrip(staleStrip(clock, reason), clock);

      /* Still warm kids-week in background for other tiles — never for Next Up hero */
      loadWeek(function () { /* no-op for strip */ });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.HouseBoardStrip = {
    boot: boot,
    pickNextFuture: pickNextFuture,
    pickStripFromCal: pickStripFromCal,
    calIsFresh: calIsFresh,
    staleStrip: staleStrip,
    stripFromEvent: stripFromEvent,
    applyStrip: applyStrip,
    CAL_FRESH_MS: CAL_FRESH_MS
  };
})(typeof window !== "undefined" ? window : globalThis);
