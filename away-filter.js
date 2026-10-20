/* AWAYLAW1 · away-filter.js · one shared away-day filter (standalone; no page code, no other house script needed).
 *
 * Law: in the away state no kid time or kid logistics renders on any surface. The state comes ONLY from the per-day
 * flag in data/cal-months.json days[iso] (an external feed; no hard-coded dates or hours, no kids-week.json).
 * The feed is valid only when days{} holds at least one day whose withDan is a real boolean; a missing, empty or junk feed
 * is UNKNOWN (hasMonths() false): never away, the normal board. A day whose flag is not a boolean is an unknown day.
 * The change minute comes from the feed too: changeMin (CT minutes after midnight, 0..1439, never shown). With it, on a
 * change day:
 *   - a day flagged away is away all day;
 *   - a home day after an away day stays away until changeMin;
 *   - a home day before an away day is away from changeMin on.
 * Without it (or junk) there is no intra-day switch: the day flag alone decides the state, midnight to midnight, and on a
 * switch day (a day whose flag differs from the day before or after it in the feed; no weekday is assumed) kid items are
 * simply not shown (Atlas 2026-10-17). Nothing on any surface says why; the rest of the board is normal.
 * A kid item is one named for a kid (Ainsley, Hayes, Harris, Boys, Kids) or off a kid school calendar (LKMS, or the school token loaded at runtime by LHRules from the private names file),
 * or a cal-months item whose colour key is a kid key. "Hayes <private surname>" is never our Hayes (LHRules.stripNamesakes, names read at run time; no names in git).
 *
 * API (window.AwayFilter, or module.exports under Node):
 *   setMonths(json) / hasMonths() / ready() -> Promise (loads data/cal-months.json once)
 *   now()                     ?now=<ISO> on the page URL (test fixture) else Date.now()
 *   isAwayAt(ms) / isAwayDay(iso) / isAwayNow() / awayUntil(ms) -> ms when this away window ends (the feed's changeMin on the
 *                             first home day, or that day's midnight when the feed gives none), or 0
 *   isKidText(s) / isKidItem(obj)
 *   keepItem(obj, nowMs)      false when a kid item's own time (or its explicit day) falls in an away window
 *   filterCalLive(json) / filterCalMonths(json) / filterKidsWeek(json)   pure, return the same object filtered
 *   glass(s)                  NOCUSTODY: a ' · ' segment that carries a NOCUSTODY1 phrase (house-face-law.js) is DROPPED (nothing is put in
 *                             its place)
 *   dadText(s) / dadDeep(json)  SHAREDLAW2: Dad-only page drops the 'Dad: ' prefix the writers put on Dan's trips
 *   scrubDom(root)            [data-away-day=YYYY-MM-DD] hides its [data-away-kid] children on away time;
 *                             [data-away-hide] hides on away now; [data-away-show] shows only on away now
 *   install()                 wraps fetch so cal-live / cal-months / kids-week reach every renderer already filtered,
 *                             then scrubs the DOM. A <script src="away-filter.js" data-away-install> self-installs.
 */
(function (g) {
  "use strict";
  var TZ = "America/Chicago";
  var CHANGE_MIN = null;   /* from the feed (changeMin); null = no intra-day switch */
  var MONTHS = null, readyP = null, origFetch = null;
  var KID_RE = /\b(Ainsley|Hayes|Harris|Boys|Kids)\b|\bLKMS\b|\bschool\b|\b(No School|Early Release|Half Day|1\/2 Day)\b/i;   /* TEXTLAW3 (main): school-day words mark a kid item */   /* privacy-scan:allow calendar_string */
  function notOurs(s) { /* someone else who shares a kid's first name: matched in livinghouse/lh-rules.js against names read at run time, never by a name in git.
     Without lh-rules the text stays kid text, so the item stays hidden on away days (the safe side). */
    var R = lhr(); return R && R.stripNamesakes ? R.stripNamesakes(s) : s; }
  function lhr() { var R = g.LHRules; if (!R && typeof require === "function") { try { R = require("./livinghouse/lh-rules.js"); } catch (e) { R = null; } } return R || null; }
  function isSchool(s) { var R = lhr(); if (R && R.isSchoolText && R.isSchoolText(s)) return true; return !!(g.SchoolNames && g.SchoolNames.isSchoolText && g.SchoolNames.isSchoolText(s)); }   /* SCHOOLNAMES1 (main) as a second source */
  var KID_KEYS = { hay: 1, har: 1, ain: 1, shr: 1, kids: 1, boys: 1, hand: 1 };
  var DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  function now() {
    try {
      var q = g.location && g.location.search ? new URLSearchParams(g.location.search).get("now") : null;
      if (q) { var t = Date.parse(q); if (!isNaN(t)) return t; }
    } catch (e) { /* no URL */ }
    return Date.now();
  }
  function ct(ms) {
    var p = {};
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", hourCycle: "h23", weekday: "short" })
        .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
      return { iso: p.year + "-" + p.month + "-" + p.day, min: (+p.hour % 24) * 60 + (+p.minute), dow: DOW.indexOf(p.weekday.slice(0, 3).toLowerCase()) };
    } catch (e) {
      var d = new Date(ms - 5 * 3600e3);
      return { iso: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() };
    }
  }
  function addDays(iso, n) {
    var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
  }
  function day(iso) { return MONTHS && MONTHS.days ? MONTHS.days[iso] : null; }
  function withDan(iso) { var d = day(iso); return d ? !!d.withDan : null; }

  function setMonths(j) {   /* every call replaces the state: a missing, empty or junk feed resets to UNKNOWN */
    MONTHS = null; CHANGE_MIN = null; api.CHANGE_MIN = null;
    if (!j || typeof j !== "object" || !j.days || typeof j.days !== "object" || Array.isArray(j.days)) return;
    var days = {}, n = 0;
    Object.keys(j.days).forEach(function (k) { var d = j.days[k];
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && d && typeof d === "object" && typeof d.withDan === "boolean") { days[k] = { withDan: d.withDan }; n++; } });
    if (!n) return;
    MONTHS = { days: days };
    var cm = j.changeMin; if (typeof cm === "number" && isFinite(cm) && cm === Math.floor(cm) && cm >= 0 && cm < 1440) CHANGE_MIN = cm;
    api.CHANGE_MIN = CHANGE_MIN;
  }
  function hasMonths() { return !!MONTHS; }

  /* away at a clock moment; an unknown state (no calendar or day out of range) is not away */
  function isAwayAt(ms) {
    if (!MONTHS || !ms) return false;
    var c = ct(ms), w = withDan(c.iso);
    if (w === null) return false;
    if (!w) return true;
    if (CHANGE_MIN === null) return false;   /* the feed gave no change minute: no intra-day switch */
    if (c.min < CHANGE_MIN && withDan(addDays(c.iso, -1)) === false) return true;
    if (c.min >= CHANGE_MIN && withDan(addDays(c.iso, 1)) === false) return true;
    return false;
  }
  /* a switch day: its flag differs from the previous or next day's flag in the feed (both must be known) */
  function isSwitchDay(iso) {
    var w = withDan(iso); if (w === null) return false;
    var a = withDan(addDays(iso, -1)), b = withDan(addDays(iso, 1));
    return (a !== null && a !== w) || (b !== null && b !== w);
  }
  /* no change minute in the feed: kid items on a switch day are hidden all day (Atlas); with it, isAwayAt decides */
  function hiddenSwitch(iso) { return !!MONTHS && CHANGE_MIN === null && isSwitchDay(iso); }
  /* an untimed (all-day) item on this date: away only when the whole day is away */
  function isAwayDay(iso) { return withDan(iso) === false; }
  function isAwayNow() { return isAwayAt(now()); }
  /* AWAYONE1 · when the away window that holds ms ends: the feed's change minute on the first home day after it (or that
     day's midnight when the feed gives none), or 0 when ms is not away or the calendar does not reach the end of the window.
     The hub reads it only as "away now". No hour is assumed here. */
  function awayUntil(ms) {
    if (!isAwayAt(ms)) return 0;
    var c = ct(ms), at = CHANGE_MIN === null ? 0 : CHANGE_MIN;
    if (withDan(c.iso) === true && CHANGE_MIN !== null && c.min < CHANGE_MIN) return msAt(c.iso, CHANGE_MIN);
    for (var i = 1; i <= 62; i++) {
      var d = addDays(c.iso, i), w = withDan(d);
      if (w === null) return 0;
      if (w) return msAt(d, at);
    }
    return 0;
  }

  function textOf(o) {
    if (o == null) return "";
    if (typeof o === "string") return o;
    return [o.summary, o.title, o.what, o.place, o.label && /\w/.test(o.label) && !/^Next up/i.test(o.label) ? o.label : "", o.l].filter(Boolean).join(" ");
  }
  function isKidText(s) { s = String(s || ""); s = notOurs(s); return KID_RE.test(s) || isSchool(s); }
  function isKidItem(o) { return !!(o && ((o.c && KID_KEYS[o.c]) || isKidText(textOf(o)))); }

  /* ---- clock parsing for items that carry no ISO time ---- */
  function toMin(h, m, ap) {
    h = +h; m = +(m || 0);
    var hh = h % 12;
    if (ap) { if (/p/i.test(ap)) hh += 12; }
    else if (h === 12 || h <= 6) hh += 12;          /* kid-schedule hours: bare 12 and 1-6 read pm */
    return hh * 60 + m;
  }
  function clockIn(s) {
    var m = String(s || "").match(/(?:^|[^\d:])(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?|a|p)?(?![\d])/i) ||
            String(s || "").match(/~\s*(\d{1,2})()(?!\s*[\d:])\s*(am|pm|a|p)?/i) ||
            String(s || "").match(/\b(\d{1,2})()\s*(am|pm)\b/i);
    return m ? toMin(m[1], m[2], m[3]) : null;
  }
  /* explicit day in a "when" string ("MON · 7:00", "Mon 19 · 7:00", "Today", "Tomorrow") -> iso, else null */
  function dayIn(s, nowMs) {
    s = String(s || "");
    var c = ct(nowMs);
    if (/\btoday\b|\btonight\b/i.test(s)) return c.iso;
    if (/\btomorrow\b/i.test(s)) return addDays(c.iso, 1);
    var m = s.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?(?:\s+(?:[a-z]{3}\s+)?(\d{1,2})\b(?!:))?/i);
    if (!m) return null;
    var want = DOW.indexOf(m[1].toLowerCase());
    if (m[2]) { /* a day-of-month: nearest date within -7..+31 days with that number */
      for (var i = -7; i <= 31; i++) { var iso = addDays(c.iso, i); if (+iso.slice(8) === +m[2]) return iso; }
    }
    var diff = (want - c.dow + 7) % 7;
    return addDays(c.iso, diff);
  }
  function msAt(iso, min) {
    /* CT wall time -> ms (CT is UTC-5 or UTC-6; pick the offset that round-trips) */
    for (var off = 5; off <= 6; off++) {
      var t = Date.parse(iso + "T00:00:00Z") + (min + off * 60) * 60000;
      var c = ct(t); if (c.iso === iso && c.min === min) return t;
    }
    return Date.parse(iso + "T00:00:00Z") + (min + 300) * 60000;
  }
  /* -> { ms } timed, { iso } all-day on a day, or null (no day/time: never dropped) */
  function whenOf(o, nowMs) {
    if (!o || typeof o !== "object") return null;
    var iso = o.startIso || o.start;
    if (iso && /T\d/.test(iso)) { var t = Date.parse(iso); if (!isNaN(t)) return o.allDay ? { iso: ct(t).iso } : { ms: t }; }
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return { iso: iso };
    var w = String(o.when || o.whenLabel || o.time || "");
    var d = dayIn(w, nowMs) || (o._day || null);
    var clock = /all\s*day/i.test(w) ? null : (clockIn(w) != null ? clockIn(w) : (o._day ? clockIn(textOf(o)) : null));
    if (d && clock != null) return { ms: msAt(d, clock) };
    if (d) return { iso: d };
    return null;
  }
  function keepItem(o, nowMs) {
    if (!MONTHS || !isKidItem(o)) return true;
    var w = whenOf(o, nowMs || now());
    if (!w) return true;
    if (hiddenSwitch(w.ms != null ? ct(w.ms).iso : w.iso)) return false;
    return w.ms != null ? !isAwayAt(w.ms) : !isAwayDay(w.iso);
  }

  /* ---- data filters (pure on the passed object; return it) ---- */
  function filterCalLive(j) {
    if (!j || !MONTHS) return j;
    var n = now();
    if (Array.isArray(j.upcomingLeaves)) j.upcomingLeaves = j.upcomingLeaves.filter(function (e) { return keepItem(e, n); });
    if (j.nextLeave && !keepItem(j.nextLeave, n)) {
      j.nextLeave = (j.upcomingLeaves || []).filter(function (e) { return !e.allDay && Date.parse(e.start) > n; })[0] || null;
    }
    if (j.boardStrip) filterStrip(j.boardStrip, n);
    return j;
  }
  function filterCalMonths(j) {
    if (!j || !j.days) return j;
    setMonths(j);
    var n = now();
    Object.keys(j.days).forEach(function (iso) {
      var d = j.days[iso];
      if (d && Array.isArray(d.items)) d.items = d.items.filter(function (it) { return keepItem({ c: it.c, l: it.l, _day: iso, when: "" }, n); });
    });
    return j;
  }
  function filterStrip(bs, n) {
    if (!bs || typeof bs !== "object") return;
    if (Array.isArray(bs.queue)) bs.queue = bs.queue.filter(function (e) { return keepItem(e, n); });
    if ((bs.place || bs.summary) && !keepItem(bs, n)) {
      var nx = (bs.queue || [])[0];
      ["label", "time", "place", "summary", "badge", "startIso", "endIso", "kind", "whenLabel", "detailHtml"].forEach(function (k) {
        if (nx && nx[k] != null) bs[k] = nx[k]; else delete bs[k];
      });
      if (!nx) bs.nextLeave = null;
    }
  }
  function filterKidsWeek(j) {
    if (!j || !MONTHS) return j;
    var n = now();
    if (Array.isArray(j.leaveBys)) j.leaveBys = j.leaveBys.filter(function (e) { return keepItem(e, n); });
    if (j.boardStrip) filterStrip(j.boardStrip, n);
    var kids = j.kids || {};
    Object.keys(kids).forEach(function (id) {
      var k = kids[id]; if (!k || typeof k !== "object") return;
      var name = k.name || id;
      if (!isKidText(name)) return; /* a grown-up entry (Dan) keeps its own times */
      function keep(r) { /* every row on a kid is that kid's: tag it with the name so keepItem sees a kid item */
        if (!r || typeof r !== "object" || r.kind === "note") return true;
        var probe = {}; for (var x in r) probe[x] = r[x];
        probe.summary = name + " " + textOf(r);
        return keepItem(probe, n);
      }
      Object.keys(k).forEach(function (key) {
        var v = k[key];
        if (Array.isArray(v) && v.length && v[0] && typeof v[0] === "object" && ("when" in v[0])) k[key] = v.filter(keep);
      });
      if (k.hottest && k.hottest.what && !keep(k.hottest)) delete k.hottest;
    });
    return j;
  }

  /* ---- NOCUSTODY (Atlas law): those phrases are dropped from shared glass, never replaced ---- */
  /* the phrase list lives once, in house-face-law.js (HouseFaceLaw.isCustody, NOCUSTODY1); every page loads it first */
  function isCust(s) {
    var FL = g.HouseFaceLaw;
    if (!FL && typeof require === "function") { try { require("./house-face-law.js"); FL = g.HouseFaceLaw || globalThis.HouseFaceLaw; } catch (e) { FL = null; } }
    return !!(FL && FL.isCustody(s));
  }
  function glass(s) {
    var t = String(s == null ? "" : s);
    var cut = false;   /* a dropped segment takes its own tail with it ("back <day>", a bare date or time), so nothing is left computed */
    t = t.split(/\s+\u00b7\s+/).filter(function (seg) {
      if (isCust(seg)) { cut = true; return false; }
      if (cut && /^(?:back\b.*|(?:[a-z]{3}\s+)?[a-z]{3}\s+\d{1,2}|\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)$/i.test(seg.trim())) return false;
      cut = false; return true;
    }).join(" \u00b7 ");
    return t.replace(/\s{2,}/g, " ").replace(/(\s*\u00b7\s*){2,}/g, " \u00b7 ").replace(/^\s*[\u00b7,]\s*|\s*[\u00b7,]\s*$/g, "").trim();
  }

  /* ---- DOM: annotated static content ---- */
  function hide(el) { el.style.setProperty("display", "none", "important"); el.setAttribute("data-away-hidden", ""); }
  function scrubDom(root) {
    root = root || (g.document && g.document.documentElement);
    if (!root || !root.querySelectorAll) return;
    var awayNow = isAwayNow();
    if (g.document && g.document.documentElement) g.document.documentElement.classList.toggle("kids-away", awayNow);
    Array.prototype.forEach.call(root.querySelectorAll("[data-away-day]"), function (cell) {
      var iso = cell.getAttribute("data-away-day");
      Array.prototype.forEach.call(cell.querySelectorAll("[data-away-kid]"), function (el) {
        var w = whenOf({ c: "kids", l: el.textContent, _day: iso, when: "" }, now());
        var away = w && (hiddenSwitch(w.ms != null ? ct(w.ms).iso : w.iso) || (w.ms != null ? isAwayAt(w.ms) : isAwayDay(w.iso)));
        if (away) hide(el);
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-away-hide]"), function (el) { if (awayNow) hide(el); });
    Array.prototype.forEach.call(root.querySelectorAll("[data-away-show]"), function (el) {
      if (awayNow) el.style.removeProperty("display"); else hide(el);
    });
  }

  function ready() {
    if (readyP) return readyP;
    var f = origFetch || g.fetch;
    if (!f) return (readyP = Promise.resolve(false));
    readyP = f.call(g, "data/cal-months.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { setMonths(j); return hasMonths(); })
      .catch(function () { return false; });
    return readyP;
  }
  /* SHAREDLAW2 (Atlas ruling) · the data writers (scripts/text-law.json) already write a Dan trip with the partner as
     'Dad: <plan>', with no partner name, so shared glass needs nothing here and no name lives in this file.
     The Dad-only page (sheet-dan.html, install tag carries data-dad-only) drops the redundant 'Dad: ' prefix. */
  var SKIP_KEY = /^(id|icdId|href|url|link|htmlLink|sourceCalendar|source|tz|status|kind|tone|cadence|theme|c|.*Iso|start|end|fetchedAt|refreshedAt|updatedAt|windowStart|windowEnd|withDan)$/;
  function dadText(s) { return typeof s === "string" ? s.replace(/^(<strong>[^<]*<\/strong>\s*)?Dad:\s+/, "$1") : s; }
  function dadDeep(o, key) {
    if (Array.isArray(o)) return o.map(function (v) { return dadDeep(v, key); });
    if (o && typeof o === "object") { var r = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = dadDeep(o[k], k); return r; }
    if (typeof o === "string" && !(key && SKIP_KEY.test(key))) return dadText(o);
    return o;
  }
  function isDadOnly() {
    try { return !!(g.document && g.document.querySelector("script[data-away-install][data-dad-only]")); } catch (e) { return false; }
  }
  function kindOf(url) {
    url = String(url || "");
    if (/(^|\/)cal-months\.json/.test(url)) return "months";
    if (/(^|\/)cal-live\.json/.test(url)) return "live";
    if (/(^|\/)kids-week\.json/.test(url)) return "kids";
    return null;
  }
  function install() {
    if (!g.fetch || g.fetch.__awayFilter) return;
    origFetch = g.fetch;
    var wrapped = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var kind = kindOf(url), p = origFetch.apply(g, arguments);
      if (!kind) return p;
      return p.then(function (r) {
        if (!r || !r.ok) return r;
        return r.clone().json().then(function (j) {
          return ready().then(function () {
            j = kind === "months" ? filterCalMonths(j) : kind === "live" ? filterCalLive(j) : filterKidsWeek(j);
            if (isDadOnly()) j = dadDeep(j);   /* SHAREDLAW2 */
            return new Response(JSON.stringify(j), { status: r.status, statusText: r.statusText, headers: { "Content-Type": "application/json" } });
          });
        }).catch(function () { return r; });
      });
    };
    wrapped.__awayFilter = true;
    g.fetch = wrapped;
    ready().then(function () {
      if (!g.document) return;
      if (g.document.readyState === "loading") g.document.addEventListener("DOMContentLoaded", function () { scrubDom(); });
      else scrubDom();
    });
  }

  var api = {
    CHANGE_MIN: CHANGE_MIN, setMonths: setMonths, hasMonths: hasMonths, ready: ready, now: now,
    isAwayAt: isAwayAt, isAwayDay: isAwayDay, isSwitchDay: isSwitchDay, isAwayNow: isAwayNow, awayUntil: awayUntil, isKidText: isKidText, isKidItem: isKidItem,
    whenOf: whenOf, keepItem: keepItem, filterCalLive: filterCalLive, filterCalMonths: filterCalMonths,
    filterKidsWeek: filterKidsWeek, glass: glass, scrubDom: scrubDom, install: install,
    dadText: dadText, dadDeep: dadDeep, isDadOnly: isDadOnly
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof g === "object" && g) g.AwayFilter = api;
  try {
    var cs = g.document && g.document.currentScript;
    if (cs && cs.hasAttribute("data-away-install")) install();
  } catch (e) { /* not a browser */ }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
