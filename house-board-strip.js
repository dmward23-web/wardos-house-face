/* House Face · live leave-by / Schedule strip (HUBGLASS1).
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

  function futureLeaves(cal, nowMs, limit) {
    nowMs = nowMs || Date.now();
    limit = limit || 10;
    var list = listEvents(cal);
    var future = [];
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (ev.allDay) continue;
      var ms = eventStartMs(ev);
      if (ms > nowMs) future.push(ev);
    }
    future.sort(function (a, b) { return eventStartMs(a) - eventStartMs(b); });
    return future.slice(0, limit);
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
    strip.future = futureLeaves(cal, Date.now(), 10);
    return strip;
  }

  var LAYOUT_KEY = "wardos.leaveby.layout";
  var LAYOUTS = ["rail", "who", "peek", "radar", "list"];
  var LAYOUT_LABELS = {
    rail: "Rail",
    who: "Who",
    peek: "Peek",
    radar: "Radar",
    list: "List"
  };
  var _lastStrip = null;
  var _lastClock = null;
  var _layoutBound = false;

  function getLayout() {
    try {
      var v = localStorage.getItem(LAYOUT_KEY) || "list";
      if (LAYOUTS.indexOf(v) >= 0) return v;
    } catch (e) { /* private mode */ }
    return "list";
  }

  function syncChipUI(id) {
    var root = document.querySelector(".leaveby");
    if (root) root.setAttribute("data-layout", id);
    var canvas = document.querySelector("[data-live='leaveby-layouts']");
    if (canvas) canvas.setAttribute("data-layout", id);
    document.querySelectorAll("[data-live='leaveby-switch'] [data-layout]").forEach(function (btn) {
      var on = btn.getAttribute("data-layout") === id;
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.classList.toggle("is-on", on);
    });
    var modeEl = document.querySelector("[data-live='leaveby-mode']");
    if (modeEl) modeEl.textContent = LAYOUT_LABELS[id] || id;
  }

  function setLayout(id) {
    if (LAYOUTS.indexOf(id) < 0) id = "list";
    try { localStorage.setItem(LAYOUT_KEY, id); } catch (e2) { /* ignore */ }
    syncChipUI(id);
    if (_lastStrip && _lastClock) paintLayouts(_lastStrip, _lastClock, id);
  }

  function cycleLayout(dir) {
    var cur = getLayout();
    var i = LAYOUTS.indexOf(cur);
    if (i < 0) i = LAYOUTS.indexOf("list");
    if (i < 0) i = 0;
    var next = LAYOUTS[(i + dir + LAYOUTS.length) % LAYOUTS.length];
    setLayout(next);
  }

  function bindSwipeCycle(root) {
    if (!root || root.getAttribute("data-swipe-bound") === "1") return;
    root.setAttribute("data-swipe-bound", "1");
    var startX = 0;
    var startY = 0;
    var startT = 0;
    var tracking = false;
    var pid = null;

    function onDown(ev) {
      /* chips handle their own picks · don't steal */
      if (ev.target && ev.target.closest && ev.target.closest(".leaveby-chip")) return;
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      tracking = true;
      pid = ev.pointerId;
      startX = ev.clientX;
      startY = ev.clientY;
      startT = Date.now();
      try { root.setPointerCapture && root.setPointerCapture(ev.pointerId); } catch (eCap) { /* ok */ }
    }
    function onUp(ev) {
      if (!tracking) return;
      if (pid != null && ev.pointerId !== pid) return;
      tracking = false;
      var dx = ev.clientX - startX;
      var dy = ev.clientY - startY;
      var dt = Date.now() - startT;
      pid = null;
      if (dt > 900) return;
      if (Math.abs(dx) < 48) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.15) return; /* vertical scroll wins */
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e3) { /* ok */ }
      /* swipe left → next · swipe right → prev */
      cycleLayout(dx < 0 ? 1 : -1);
    }
    function onCancel() {
      tracking = false;
      pid = null;
    }
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onCancel);
  }

  function bindLayoutSwitcher() {
    if (_layoutBound) return;
    var bar = document.querySelector("[data-live='leaveby-switch']");
    if (!bar) return;
    _layoutBound = true;
    var lastPickAt = 0;
    function onPick(ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-layout]") : null;
      if (!btn || !bar.contains(btn)) return;
      var id = btn.getAttribute("data-layout");
      if (!id) return;
      var now = Date.now();
      if (now - lastPickAt < 350) return; /* pointerdown+click debounce */
      lastPickAt = now;
      try { if (ev.cancelable) ev.preventDefault(); } catch (ePrev) { /* ok */ }
      try { if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e3) { /* ok */ }
      setLayout(id);
    }
    /* pointerdown first on Elo/touch · click as fallback */
    bar.addEventListener("pointerdown", onPick);
    bar.addEventListener("click", onPick);

    /* one swipe surface only · nested binds would triple-cycle on bubble */
    var leaveby = document.querySelector(".leaveby.leaveby--hot, .leaveby.leaveby--cmd, .leaveby");
    var canvas = document.querySelector("[data-live='leaveby-layouts']");
    bindSwipeCycle(leaveby || canvas);

    setLayout(getLayout());
  }

  function whoNames(ev) {
    var s = String((ev && (ev.summary || ev.place)) || "");
    var out = [];
    if (/\bAinsley\b/i.test(s)) out.push("Ainsley");
    if (/\bHayes\b/i.test(s)) out.push("Hayes");
    if (/\bHarris\b/i.test(s)) out.push("Harris");
    if (/\b(?:Dan|Dad|Hank)\b/i.test(s)) out.push("Dan");
    if (!out.length) out.push("Dan");
    return out;
  }

  function upcomingFlat(strip, limit) {
    limit = limit || 8;
    var out = [];
    var today = (strip && strip.today) || [];
    var tmr = (strip && strip.tomorrow && strip.tomorrow.items) || [];
    var future = (strip && strip.future) || [];
    var i;
    for (i = 0; i < today.length; i++) out.push({ ev: today[i], when: "today" });
    for (i = 0; i < tmr.length; i++) out.push({ ev: tmr[i], when: "tmr" });
    /* Evening / empty today+tmr window: still paint real next leaves from cal-live */
    if (!out.length && future.length) {
      for (i = 0; i < future.length; i++) out.push({ ev: future[i], when: "soon" });
    } else if (today.length < 2 && future.length) {
      /* thin today: append near-term future not already listed */
      var seen = {};
      for (i = 0; i < out.length; i++) {
        seen[(out[i].ev.start || "") + "|" + (out[i].ev.summary || "")] = 1;
      }
      for (i = 0; i < future.length && out.length < limit; i++) {
        var key = (future[i].start || "") + "|" + (future[i].summary || "");
        if (seen[key]) continue;
        out.push({ ev: future[i], when: "soon" });
      }
    }
    return out.slice(0, limit);
  }

  function minsUntil(ev) {
    if (!ev || ev.allDay) return null;
    var ms = eventStartMs(ev) - Date.now();
    if (!Number.isFinite(ms)) return null;
    return Math.max(0, Math.round(ms / 60000));
  }

  function fmtMins(m) {
    if (m == null) return "—";
    if (m < 60) return m + "m";
    var h = Math.floor(m / 60);
    var r = m % 60;
    return r ? (h + "h " + r + "m") : (h + "h");
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

  function layoutRail(strip) {
    var items = upcomingFlat(strip, 7);
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-rail"><div class="lb-empty">CAL STALE</div></div>';
    }
    if (!items.length) {
      return '<div class="lb-layout lb-rail"><div class="lb-empty">Clear on glass</div></div>';
    }
    var html = '<div class="lb-layout lb-rail" aria-label="Timeline rail"><div class="lb-rail-spine">';
    for (var i = 0; i < items.length; i++) {
      var ev = items[i].ev;
      var timeLab = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
      var title = shortPlace(ev.summary || ev.place || "");
      var cls = "lb-rail-item" + (i === 0 ? " is-next" : "") +
        (items[i].when === "tmr" ? " is-tmr" : "");
      html += '<div class="' + cls + '">' +
        '<span class="lb-rail-dot" aria-hidden="true"></span>' +
        '<span class="lb-rail-time">' + esc(timeLab) + "</span>" +
        '<span class="lb-rail-pill">' + esc(title) + "</span>" +
        "</div>";
    }
    html += "</div></div>";
    return html;
  }

  function layoutWho(strip) {
    var order = ["Hayes", "Ainsley", "Harris", "Dan"];
    var buckets = { Hayes: [], Ainsley: [], Harris: [], Dan: [] };
    var items = upcomingFlat(strip, 12);
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-who"><div class="lb-empty">CAL STALE</div></div>';
    }
    for (var i = 0; i < items.length; i++) {
      var names = whoNames(items[i].ev);
      for (var n = 0; n < names.length; n++) {
        if (buckets[names[n]] && buckets[names[n]].length < 3) {
          buckets[names[n]].push(items[i]);
        }
      }
    }
    var html = '<div class="lb-layout lb-who" aria-label="Who is next">';
    var any = false;
    for (var o = 0; o < order.length; o++) {
      var person = order[o];
      var list = buckets[person];
      if (!list.length) continue;
      any = true;
      html += '<div class="lb-who-group" data-who="' + esc(person) + '">' +
        '<div class="lb-who-name">' + esc(person) + "</div>" +
        '<div class="lb-who-rows">';
      for (var j = 0; j < list.length; j++) {
        var ev2 = list[j].ev;
        var t2 = ev2.allDay ? "day" : (clockTimeFromIso(ev2.start) || "—");
        var title2 = shortPlace(ev2.summary || ev2.place || "");
        html += '<div class="lb-who-row' + (j === 0 ? " is-next" : "") + '">' +
          '<span class="lb-who-time">' + esc(t2) + "</span>" +
          '<span class="lb-who-title">' + esc(title2) + "</span>" +
          "</div>";
      }
      html += "</div></div>";
    }
    if (!any) html += '<div class="lb-empty">Clear on glass</div>';
    html += "</div>";
    return html;
  }

  function layoutPeek(strip) {
    var items = upcomingFlat(strip, 3);
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-peek"><div class="lb-empty">CAL STALE</div></div>';
    }
    if (!items.length) {
      return '<div class="lb-layout lb-peek"><div class="lb-empty">Clear on glass</div></div>';
    }
    var first = items[0].ev;
    var t0 = first.allDay ? "day" : (clockTimeFromIso(first.start) || "—");
    var html = '<div class="lb-layout lb-peek" aria-label="Next plus peek">' +
      '<div class="lb-peek-hero">' +
      '<span class="lb-peek-kicker">Next</span>' +
      '<span class="lb-peek-time">' + esc(t0) + "</span>" +
      '<span class="lb-peek-title">' + esc(shortPlace(first.summary || first.place || "")) + "</span>" +
      "</div>";
    if (items.length > 1) {
      html += '<div class="lb-peek-quiet">';
      for (var i = 1; i < items.length; i++) {
        var ev = items[i].ev;
        var t = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
        html += '<div class="lb-peek-row">' +
          '<span class="lb-peek-row-time">' + esc(t) + "</span>" +
          '<span class="lb-peek-row-title">' + esc(shortPlace(ev.summary || ev.place || "")) + "</span>" +
          "</div>";
      }
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function layoutRadar(strip) {
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-radar"><div class="lb-empty">CAL STALE</div></div>';
    }
    var items = upcomingFlat(strip, 1);
    if (!items.length) {
      return '<div class="lb-layout lb-radar"><div class="lb-empty">Clear on glass</div></div>';
    }
    var ev = items[0].ev;
    var mins = minsUntil(ev);
    var title = shortPlace(ev.summary || ev.place || "");
    var timeLab = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
    var windowM = 180;
    var pct = mins == null ? 0 : Math.max(0, Math.min(1, 1 - (mins / windowM)));
    var r = 42;
    var c = 2 * Math.PI * r;
    var dash = (pct * c).toFixed(1);
    var gap = (c - pct * c).toFixed(1);
    var html = '<div class="lb-layout lb-radar" aria-label="Countdown radar">' +
      '<div class="lb-radar-ring" aria-hidden="true">' +
      '<svg viewBox="0 0 100 100" width="96" height="96">' +
      '<circle class="lb-radar-track" cx="50" cy="50" r="' + r + '" fill="none" stroke-width="8"/>' +
      '<circle class="lb-radar-prog" cx="50" cy="50" r="' + r + '" fill="none" stroke-width="8" ' +
      'stroke-dasharray="' + dash + " " + gap + '" transform="rotate(-90 50 50)"/>' +
      '<text class="lb-radar-mins" x="50" y="54" text-anchor="middle">' + esc(fmtMins(mins)) + "</text>" +
      "</svg></div>" +
      '<div class="lb-radar-line">' +
      '<span class="lb-radar-time">' + esc(timeLab) + "</span>" +
      '<span class="lb-radar-title">' + esc(title) + "</span>" +
      "</div></div>";
    return html;
  }

  function layoutList(strip) {
    /* REFINE CURRENT · tighter remaining + tomorrow peek */
    var today = (strip && strip.today) || [];
    var tmr = (strip && strip.tomorrow) || { items: [], dow: "" };
    if (strip && strip._stale) {
      return '<div class="lb-layout lb-list"><div class="lb-empty">CAL STALE</div></div>';
    }
    var html = '<div class="lb-layout lb-list" aria-label="Schedule list">';
    html += '<div class="lb-list-sec"><div class="lb-list-hdr">Remaining</div><ul class="lb-list-ul">';
    if (!today.length) {
      html += '<li class="lb-empty">Clear · nothing left today</li>';
    } else {
      for (var i = 0; i < today.length; i++) {
        var ev = today[i];
        var t = ev.allDay ? "day" : (clockTimeFromIso(ev.start) || "—");
        html += '<li class="lb-list-row' + (i === 0 && !ev.allDay ? " is-next" : "") + '">' +
          '<span class="lb-list-time">' + esc(t) + "</span>" +
          '<span class="lb-list-title">' + esc(shortPlace(ev.summary || ev.place || "")) + "</span>" +
          "</li>";
      }
    }
    html += "</ul></div>";
    html += '<div class="lb-list-sec lb-list-sec--tmr"><div class="lb-list-hdr">' +
      esc(tmr.dow ? ("Tmr · " + tmr.dow) : "Tomorrow") +
      '</div><ul class="lb-list-ul">';
    if (!tmr.items || !tmr.items.length) {
      html += '<li class="lb-empty">Clear on glass</li>';
    } else {
      var maxT = Math.min(tmr.items.length, 4);
      for (var j = 0; j < maxT; j++) {
        var ev2 = tmr.items[j];
        var t2 = ev2.allDay ? "day" : (clockTimeFromIso(ev2.start) || "—");
        html += '<li class="lb-list-row">' +
          '<span class="lb-list-time">' + esc(t2) + "</span>" +
          '<span class="lb-list-title">' + esc(shortPlace(ev2.summary || ev2.place || "")) + "</span>" +
          "</li>";
      }
    }
    html += "</ul></div></div>";
    return html;
  }

  function paintLayouts(strip, clock, mode) {
    var el = document.querySelector("[data-live='leaveby-layouts']");
    if (!el) {
      paintLists(strip);
      return;
    }
    mode = mode || getLayout();
    var html;
    if (mode === "rail") html = layoutRail(strip);
    else if (mode === "who") html = layoutWho(strip);
    else if (mode === "peek") html = layoutPeek(strip);
    else if (mode === "radar") html = layoutRadar(strip);
    else html = layoutList(strip);
    var banner = '<div class="lb-mode-banner" aria-live="polite">Layout · <strong>' +
      esc(LAYOUT_LABELS[mode] || mode) + "</strong></div>";
    el.innerHTML = banner + html;
    el.setAttribute("data-layout", mode);
    syncChipUI(mode);
    paintLists(strip); /* keep legacy nodes in sync if present */
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

    if (label) label.textContent = "";
    if (badge) badge.textContent = "";
    if (todaySub) todaySub.textContent = clock.short + " · " + clock.daypart;

    var hotEv = document.querySelector("[data-live='hot-pill-event']");
    if (hotEv) {
      if (strip._stale) hotEv.textContent = "CAL STALE";
      else if (strip.time && strip.place) hotEv.textContent = strip.time + " · " + strip.place;
      else if (strip.place) hotEv.textContent = strip.place;
      else hotEv.textContent = "Loading…";
    }

    if (main) {
      /* HUBCMD2 · pass-by hero = huge time + destination only · no Next/label chrome */
      if (strip._stale) {
        main.innerHTML = '<span class="leaveby-dest">CAL STALE</span>';
      } else if (strip.time && strip.place) {
        main.innerHTML =
          '<span class="time">' + esc(strip.time) + "</span>" +
          '<span class="leaveby-dest">' + esc(strip.place) + "</span>";
      } else if (strip.place) {
        main.innerHTML = '<span class="leaveby-dest">' + esc(strip.place) + "</span>";
      } else {
        main.innerHTML = '<span class="leaveby-dest">House day</span>';
      }
    }
    if (detail && strip.detailHtml) {
      detail.innerHTML = strip.detailHtml;
    }

    _lastStrip = strip;
    _lastClock = clock;
    bindLayoutSwitcher();
    paintLayouts(strip, clock, getLayout());

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
    getLayout: getLayout,
    setLayout: setLayout,
    cycleLayout: cycleLayout,
    LAYOUTS: LAYOUTS,
    CAL_FRESH_MS: CAL_FRESH_MS
  };
})(typeof window !== "undefined" ? window : globalThis);
