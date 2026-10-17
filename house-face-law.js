/* LIVELAW1 · Dan's face laws applied at render time to calendar-fed rows (never by editing data/*-live.json or kids-week.json).
 *  1. SRE colour days ("SRE Orange Day", "Red Day") and dress-up / spirit / pajama / costume days never show as kid rows or
 *     clothing prompts. The colour still drives the quiet SRE specials indicator (kids-data.js SPECIALS-COLOR1) through
 *     kid._lawColorRows, which no renderer prints.
 *  2. Rows that already ended today (device clock, CT) drop out of kid cards and TODAY / NEXT slots; the next real item
 *     takes the slot, or the slot is left out. Nothing is invented and no placeholder is written.
 *  3. Face text has no em dashes or arrows (same filter as NODATA3).
 * Loaded before kids-data.js / house-board-strip.js / house-today-bind.js / house-hub-tiles-bind.js; every caller is
 * defensive (window.HouseFaceLaw may be missing on an old cached page). */
(function (g) {
  var COLORS = "orange|red|yellow|green|blue|purple|pink|white|black|gold|silver|maroon|rainbow|neon|tie[- ]?dye|camo|pastel|teal|navy";
  var DRESS = new RegExp(
    "\\b(?:" + COLORS + ")\\s+(?:day|out)\\b" +                       /* SRE Orange Day · Red Day · white out */
    "|\\bcolou?r\\s+day\\b" +
    "|\\bdress[- ]?up\\b|\\bdress\\s+(?:as|like)\\b" +
    "|\\bspirit\\s+(?:day|week|wear)\\b" +
    "|\\bpajama|\\bpyjama|\\bpj'?s?\\s+day\\b" +
    "|\\bcostume" +
    "|\\b(?:hat|socks?|crazy\\s+\\w+|tropical|twin|twins|jersey|workout|decade|character|superhero|western|beach|mismatch|wacky|tacky|flannel|hawaiian|sports?\\s+team|team\\s+jersey|favorite\\s+team|book\\s+character)\\s+day\\b" +
    "|\\boutsiders\\s+day\\b|\\bgreaser\\b|\\bwear\\s+(?:your|a|an|their)\\b" +
    /* AWAYONE1 · the ONE dress-up law: LIVELAW1 above plus LAW8C1's data filter (any "wear", "<colour> day"), so render
       and data (scripts/calendar-refresh.mjs, scripts/cal-from-events.mjs load this file) can never disagree */
    "|\\b(?:orange|red|blue|green|pink|purple|yellow|black|white|gold|maroon|colou?r|crazy hair|pajamas?|pj|twin|hat|jersey|spirit|outsiders)\\s+day\\b|dress[- ]?up|spirit\\s+week|\\bwear\\b",
    "i");
  function isDressDay(s) { return DRESS.test(String(s == null ? "" : s)); }

  function faceDash(s) {
    return String(s == null ? "" : s)
      .replace(/\bMOVED\s*[\u2192\u21d2\u27a1]\s*/gi, "moved to ")
      .replace(/\s*[\u2192\u21d2\u27a1]\s*/g, " to ")
      .replace(/\s*\u2014\s*/g, " \u00b7 ")
      .replace(/(\s*\u00b7\s*){2,}/g, " \u00b7 ").replace(/^\s*\u00b7\s*|\s*\u00b7\s*$/g, "");
  }

  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function ctNow() {
    var d = new Date(), p = {};
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", hourCycle: "h23", weekday: "short" })
        .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return { iso: p.year + "-" + p.month + "-" + p.day, day: +p.day, dow: p.weekday.slice(0, 3), min: (+p.hour % 24) * 60 + (+p.minute) };
    } catch (e) {
      return { iso: d.toISOString().slice(0, 10), day: d.getDate(), dow: DOW[d.getDay()], min: d.getHours() * 60 + d.getMinutes() };
    }
  }
  /* "4:55" / "7:00am" / "3:00 PM" -> minutes; bare 12 and 1-6 read as pm (kid-schedule hours, same rule as kids-data AUDIT1) */
  function toMin(h, m, ap) {
    h = +h; m = +m;
    var hh = h % 12;
    if (ap) { if (/p/i.test(ap)) hh += 12; }
    else if (h === 12 || h <= 6) hh += 12;
    return hh * 60 + m;
  }
  /* A row's day relative to today: 0 today, <0 past, >0 future, null unknown */
  function dayOffset(when, now) {
    var s = String(when || "");
    if (/\btoday\b/i.test(s)) return 0;
    if (/\btomorrow\b/i.test(s)) return 1;
    var m = s.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b\.?(?:\s+(?:\w{3}\s+)?(\d{1,2})\b(?!:))?/i);
    if (!m) return null;
    var dow = m[1].slice(0, 1).toUpperCase() + m[1].slice(1, 3).toLowerCase();
    if (m[2]) {
      var dn = +m[2], diff = dn - now.day;
      if (diff < -20) diff += 30; else if (diff > 20) diff -= 30; /* month wrap */
      return diff;
    }
    var di = DOW.indexOf(dow), ti = DOW.indexOf(now.dow);
    if (di < 0 || ti < 0) return null;
    return (di - ti + 7) % 7; /* weekday only: this or the coming week */
  }
  /* End minute of a timed row today: "5:15–6:15" range end, else start + 90 min (SRE specials run the school day) */
  function endMin(when, what) {
    var txt = String(when || "") + " · " + String(what || "");
    if (/\bAll day\b/i.test(String(when || ""))) return null;
    var r = txt.match(/(\d{1,2}):(\d{2})\s*(am|pm|a|p)?\s*[\u2013\-]\s*(\d{1,2}):(\d{2})\s*(am|pm|a|p)?/i);
    var t = String(when || "").match(/(\d{1,2}):(\d{2})\s*(am|pm|a\b|p\b)?/i) || (r ? [0, r[1], r[2], r[3]] : null);
    if (!t) return null;
    var start = toMin(t[1], t[2], t[3]);
    if (r) { var e = toMin(r[4], r[5], r[6] || r[3]); if (e > start) return e; }
    if (/\bspecials?\b/i.test(String(what || ""))) return Math.max(start + 90, 15 * 60);
    return start + 90;
  }
  function rowText(r) { return r ? String(r.what || r.summary || r.title || r.place || "") + " " + String(r.hint || "") : ""; }
  function rowEnded(r, now) {
    if (!r) return false;
    now = now || ctNow();
    var iso = r.startIso || r.start || "";
    if (iso && /T\d{2}:/.test(String(iso))) {
      var end = Date.parse(r.endIso || r.end || "") || (Date.parse(iso) + 90 * 60000);
      return Number.isFinite(end) && end < Date.now();
    }
    var off = dayOffset(r.when, now);
    if (off === null) return false;
    if (off < 0) return true;
    if (off > 0) return false;
    var e2 = endMin(r.when, r.what);
    return e2 !== null && e2 <= now.min;
  }
  function keepRow(r, now) { return !!r && !isDressDay(rowText(r)) && !rowEnded(r, now); }

  /* Sort key for picking the next real item */
  function rowKey(r, now) {
    var off = dayOffset(r.when, now); if (off === null) off = 99;
    var t = String(r.when || "").match(/(\d{1,2}):(\d{2})\s*(am|pm|a\b|p\b)?/i);
    return off * 1440 + (/\bAll day\b/i.test(String(r.when || "")) ? -1 : (t ? toMin(t[1], t[2], t[3]) : 720));
  }
  var ROW_LISTS = ["today", "school", "sports", "appointments", "week", "events", "ahead", "upcoming"];
  function cleanKid(kid, now) {
    if (!kid || typeof kid !== "object") return;
    var colorRows = kid._lawColorRows || [];
    ROW_LISTS.forEach(function (k) {
      if (!Array.isArray(kid[k])) return;
      kid[k] = kid[k].filter(function (r) {
        if (r && isDressDay(rowText(r))) { if (/\b(orange|yellow|green|red)\s+day\b/i.test(rowText(r))) colorRows.push(r); return false; }
        return !rowEnded(r, now);
      });
    });
    kid._lawColorRows = colorRows;
    var hot = kid.hottest;
    if (hot && (isDressDay(rowText(hot)) || rowEnded(hot, now))) {
      var pool = [];
      ["today", "appointments", "sports", "school", "week"].forEach(function (k) { (kid[k] || []).forEach(function (r) { if (r && r.what && keepRow(r, now) && r.kind !== "note" && !/\bwith Dad\b|\bDad week\b|\bat home\b/i.test(r.what) && !(dayOffset(r.when, now) === 0 && /\bAll day\b/i.test(String(r.when || "")))) pool.push(r); /* NEXT = the next thing coming up; today's all-day notes stay in their own rows */ }); });
      pool.sort(function (a, b) { return rowKey(a, now) - rowKey(b, now); });
      var nx = pool[0];
      if (nx) {
        var parts = String(nx.when || "").split("\u00b7").map(function (x) { return x.trim(); }).filter(Boolean);
        var head = (parts[0] || "").split(/\s+/)[0].toUpperCase();
        var caps = String(hot.what || "") === String(hot.what || "").toUpperCase();
        kid.hottest = { when: head ? (head + (parts[1] ? " \u00b7 " + parts[1] : "")) : (nx.when || ""), what: caps ? String(nx.what).toUpperCase() : nx.what, where: nx.hint || "", badges: [head, parts[1] || ""].filter(Boolean), _law: "next" };
      } else {
        delete kid.hottest;
      }
    }
  }
  /* Whole kids-week payload (EMBEDDED or fetched). Idempotent; mutates in place and returns it. */
  function cleanKidsWeek(data) {
    if (!data || typeof data !== "object") return data;
    var now = ctNow();
    try {
      var kids = data.kids || {};
      Object.keys(kids).forEach(function (id) { cleanKid(kids[id], now); });
      var q = data.boardStrip && data.boardStrip.queue;
      if (Array.isArray(q)) data.boardStrip.queue = q.filter(function (it) { return !isDressDay(rowText(it)); });
    } catch (e) { /* never break a board over a filter */ }
    return data;
  }
  /* cal-live / cal-months events: drop colour + dress-up days (they are never rows on the face) */
  function keepEvent(ev) { return !(ev && isDressDay(String(ev.summary || ev.title || ev.what || ""))); }

  /* PRIVFEED3 · one pass over a private-feed payload (cal-live / cal-months / kids-week) before any page sees it:
     colour-day and dress-up rows drop out, face text loses em dashes, arrows and booking codes ('#...').
     Words only: ids, times, urls, colours and custody fields are never touched. Data files are never edited. */
  var SKIP_KEY = /^(id|icdId|href|url|link|htmlLink|sourceCalendar|source|tz|status|kind|tone|cadence|theme|color|colour|c|cls|class|.*Iso|start|end|at|fetchedAt|refreshedAt|updatedAt|windowStart|windowEnd|with|withDan)$/;
  /* SEATLAW1 + SCHOOLWORD1 (TEXTLAW5) · same regexes as scripts/text-law.json (scripts/qa/seatlaw.test.mjs keeps them equal):
     ticket section / row / seat never shows, at any viewport, live or cached; 'LKMS' reads 'school'. */
  var RENDER_RULES = [
    [new RegExp("\\s*\\([^()]*\\b(?:Sec(?:tion)?|Row|Seats?)\\b\\.?\\s*[A-Za-z0-9][^()]*\\)", "gi"), ""],
    [new RegExp("\\s*,?\\s*\\b(?:(?:Sec(?:tion)?\\.?\\s*[A-Z]?\\d{1,4}[A-Z]?)(?:\\s*,?\\s*Row\\s*[A-Z0-9]{1,3})?|Row\\s*[A-Z0-9]{1,3}(?=\\s*,?\\s*Seats?\\b))(?:\\s*,?\\s*(?:Seats?\\s*)?\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?(?![:\\d]))?(?:\\s*,?\\s*Seats?\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)?", "g"), ""],
    [new RegExp("\\s*,?\\s*\\b(?:Seats\\s*\\d{1,3}(?:\\s*[-–,&]\\s*\\d{1,3})*|Seat\\s*\\d{1,3}\\s*[-–]\\s*\\d{1,3})\\b", "gi"), ""],
    [new RegExp("\\bLKMS\\b", "g"), "school"]
  ];
  function renderRules(t) { for (var i = 0; i < RENDER_RULES.length; i++) t = t.replace(RENDER_RULES[i][0], RENDER_RULES[i][1]); return t; }
  function faceText(s) {
    if (typeof s !== "string" || !s || /^(https?:|data:|\d{4}-\d\d-\d\d|#[0-9a-f]{3,8}$)/i.test(s)) return s;
    var t = faceDash(renderRules(s)).replace(/\s*#[A-Za-z0-9_]+(\/#[A-Za-z0-9_]+)*/g, "")
      .replace(/\s*\((?:tennis shoes|sneakers|wear [^)]*)\)/gi, "") /* LAW8C1 · no what-to-wear hints on glass */.replace(/\s{2,}/g, " ").replace(/\s*,\s*(?=,|$)/g, "").replace(/(\s\u00b7\s*)+$/, "").trim();
    return t || s.replace(/[\u2014\u2192]/g, " ").trim();
  }
  function rowDress(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return false;
    return isDressDay([o.summary, o.title, o.what, o.l, o.label, o.text, o.hint].filter(function (x) { return typeof x === "string"; }).join(" "));
  }
  function cleanFeed(name, data) {
    function walk(v, key) {
      if (Array.isArray(v)) { var out = []; for (var i = 0; i < v.length; i++) { if (!rowDress(v[i])) out.push(walk(v[i], key)); } return out; }
      if (v && typeof v === "object") { var r = {}; for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) { if (rowDress(v[k]) && k !== "kids") continue; r[k] = walk(v[k], k); } return r; }
      if (typeof v === "string" && !(key && SKIP_KEY.test(key))) return faceText(v);
      return v;
    }
    try { return data && typeof data === "object" ? walk(data, "") : data; } catch (e) { return data; }
  }

  g.HouseFaceLaw = { cleanFeed: cleanFeed, faceText: faceText, isDressDay: isDressDay, faceDash: faceDash, rowEnded: rowEnded, keepRow: keepRow, keepEvent: keepEvent, cleanKidsWeek: cleanKidsWeek, cleanKid: cleanKid, ctNow: ctNow, DRESS: DRESS, RENDER_RULES: RENDER_RULES };
})(typeof window !== "undefined" ? window : globalThis);
