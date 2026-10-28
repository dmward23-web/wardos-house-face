/* LIVELAW1 · Dan's face laws applied at render time to calendar-fed rows (never by editing data/*-live.json or kids-week.json).
 *  1. School colour days ("<school> Orange Day", "Red Day") and dress-up / spirit / pajama / costume days never show as kid rows or
 *     clothing prompts. The colour still drives the quiet school specials indicator (kids-data.js SPECIALS-COLOR1) through
 *     kid._lawColorRows, which no renderer prints.
 *  2. Rows that already ended today (device clock, CT) drop out of kid cards and TODAY / NEXT slots; the next real item
 *     takes the slot, or the slot is left out. Nothing is invented and no placeholder is written.
 *  3. Face text has no em dashes or arrows (same filter as NODATA3).
 * Loaded before kids-data.js / house-board-strip.js / house-today-bind.js / house-hub-tiles-bind.js; every caller is
 * defensive (window.HouseFaceLaw may be missing on an old cached page). */
(function (g) {
  var COLORS = "orange|red|yellow|green|blue|purple|pink|white|black|gold|silver|maroon|rainbow|neon|tie[- ]?dye|camo|pastel|teal|navy";
  /* DRESSOK1 (Dan 2026-10-23 18:48): PJ / pajama / costume / spirit / theme days SHOW as rows. Colour days (Red Day) stay a
     schedule marker only; a "wear <x>" prompt never shows (row dropped if it is only a prompt, clause stripped otherwise). */
  var COLORDAY = new RegExp("\\b(?:" + COLORS + ")\\s+(?:day|out)\\b|\\bcolou?r\\s+day\\b", "i");
  var DRESS = new RegExp(COLORDAY.source + "|^\\s*wear\\b", "i");
  function isColorDay(s) { return COLORDAY.test(String(s == null ? "" : s)); }
  function isDressDay(s) { return DRESS.test(String(s == null ? "" : s)); }

  function faceDash(s) {
    return String(s == null ? "" : s)
      .replace(/\bMOVED\s*[\u2192\u21d2\u27a1]\s*/gi, "moved to ")
      .replace(/\s*[\u2192\u21d2\u27a1]\s*/g, " to ")
      .replace(/\s*\u2014\s*/g, " \u00b7 ")
      /* SCHOOLKEY2 · no en dash on glass: number ranges keep a tight hyphen (5:30-6:30), word ranges read "to", spaced ones a hyphen */
      .replace(/(\d)\s*\u2013\s*(?=\d)/g, "$1-").replace(/([A-Za-z])\u2013(?=[A-Za-z])/g, "$1 to ").replace(/\s*\u2013\s*/g, " - ")
      .replace(/(\s*\u00b7\s*){2,}/g, " \u00b7 ").replace(/^\s*\u00b7\s*|\s*\u00b7\s*$/g, "");
  }

  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function ctNow() {
    var d = g.LHClock ? g.LHClock.now() : new Date(), p = {}; /* Living House: follows its ?now test clock when LHClock exists; every other board has none */
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
  /* End minute of a timed row today: "5:15–6:15" range end, else start + 90 min (school specials run the school day) */
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
      return Number.isFinite(end) && end < (g.LHClock ? g.LHClock.ms() : Date.now());
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
  /* LIVEFIX1 · therapy law (every board): a therapy / counseling row never shows. Generic words here; provider and person
     names live only on the box (~/.config/wardos/privacy-block.txt, read by scripts/private-dir.mjs and cal-months.py),
     so the builders drop those rows before any data file is written. */
  var THERAPY = /\btherap|\bcounsel(?:or|ors|ing|ling|ling)?\b|\bpsycholog|\bpsychiatr|\banxiety\b/i;
  function isTherapy(s) { return THERAPY.test(String(s == null ? "" : s)); }
  function rowTherapy(o) {
    if (typeof o === "string") return isTherapy(o);
    if (!o || typeof o !== "object" || Array.isArray(o)) return false;
    return isTherapy([o.summary, o.title, o.what, o.l, o.label, o.text, o.hint, o.place].filter(function (x) { return typeof x === "string"; }).join(" "));
  }
  /* LIVEFIX1 · Ainsley law: her rows carry no digit, time, date, star, $ or %. The time is read for ordering and ended
     rows first (cleanKid), then dropped from every string she sees, so "Mon 26 · 2:20" reads "Mon". */
  var AP = "(?:a\\.?m\\.?|p\\.?m\\.?|a\\b|p\\b)";
  var AIN_RANGE = new RegExp("\\d{1,2}(?::\\d{2})?\\s*" + AP + "?\\s*(?:[-\\u2013]|\\bto\\b)\\s*\\d{1,2}(?::\\d{2})?\\s*" + AP + "?", "gi");
  var AIN_CLOCK = new RegExp("\\d{1,2}:\\d{2}\\s*" + AP + "?|\\b\\d{1,2}\\s*(?:am|pm)\\b", "gi");
  function ainsleyText(s) {
    if (typeof s !== "string") return s;
    var t = s.replace(/\b(?:leave|leaves|at|by|from|until|til|till|@)\s*(?=\$?\d)/gi, "")
      .replace(AIN_RANGE, "").replace(AIN_CLOCK, "")
      .replace(/\b\d+\s*(?:x|times|min|mins|minutes|hr|hrs|hours|pages?)\b/gi, "")   /* LIVEFIX3d · quest counts ("20 min", "3x") */
      .replace(/\$\s*\d[\d,.]*(?:\s*\/\s*[a-z]+)?/gi, "")
      .replace(/\d+(?:\.\d+)?\s*%/g, "")
      .replace(/\b\d+\s*-\s*(?=[a-z])/gi, "")
      .replace(/[\d$%\u2605\u2606\u272a-\u2730\u2b50]/g, "");
    return t.split(/\s*\u00b7\s*/).map(function (x) { return x.replace(/\s{2,}/g, " ").replace(/^[\s,:+/-]+|[\s,:+/-]+$/g, ""); })
      .filter(Boolean).join(" \u00b7 ");
  }
  var AIN_KEYS = { when: 1, what: 1, hint: 1, hours: 1, where: 1, label: 1, whenLabel: 1, place: 1, summary: 1, title: 1, text: 1, time: 1, blurb: 1 };
  function ainsleyRow(r) {
    if (typeof r === "string") return ainsleyText(r);
    if (Array.isArray(r)) return r.map(ainsleyRow).filter(function (x) { return x !== ""; });
    if (!r || typeof r !== "object") return r;
    for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) {
      if (AIN_KEYS[k] && typeof r[k] === "string") r[k] = ainsleyText(r[k]);
      else if (k === "badges" && Array.isArray(r[k])) r[k] = ainsleyRow(r[k]);
    }
    return r;
  }
  function isAinsley(kid, id) { return /^ainsley$/i.test(String(id || "")) || /^ainsley$/i.test(String((kid && (kid.id || kid.name)) || "")); }
  function cleanAinsley(kid) {
    ROW_LISTS.concat(["rides", "missions", "quests"]).forEach(function (k) { if (Array.isArray(kid[k])) kid[k] = kid[k].map(ainsleyRow); });
    ["hottest", "bag"].forEach(function (k) { if (kid[k] && typeof kid[k] === "object") ainsleyRow(kid[k]); });
    if (typeof kid.streakLabel === "string") kid.streakLabel = ainsleyText(kid.streakLabel);
  }
  var ROW_LISTS = ["today", "school", "sports", "appointments", "week", "events", "ahead", "upcoming"];
  function cleanKid(kid, now) {
    if (!kid || typeof kid !== "object") return;
    var colorRows = kid._lawColorRows || [];
    ROW_LISTS.forEach(function (k) {
      if (!Array.isArray(kid[k])) return;
      kid[k] = kid[k].filter(function (r) {
        if (r && rowTherapy(r)) return false;   /* LIVEFIX1 */
        if (r && isDressDay(rowText(r))) { if (/\b(orange|yellow|green|red)\s+day\b/i.test(rowText(r))) colorRows.push(r); return false; }
        return !rowEnded(r, now);
      });
    });
    kid._lawColorRows = colorRows;
    var hot = kid.hottest;
    if (hot && (isDressDay(rowText(hot)) || rowTherapy(hot) || rowEnded(hot, now))) {
      var pool = [];
      ["today", "appointments", "sports", "school", "week"].forEach(function (k) { (kid[k] || []).forEach(function (r) { if (r && r.what && keepRow(r, now) && r.kind !== "note" && !/\bwith Dad\b|\bDad week\b|\bat home\b/i.test(r.what) && !(dayOffset(r.when, now) === 0 && /\bAll day\b/i.test(String(r.when || "")))) pool.push(r); /* NEXT = the next thing coming up; today's all-day notes stay in their own rows */ }); }); /* custody-law:allow (matcher that skips these rows) */
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
      Object.keys(kids).forEach(function (id) { cleanKid(kids[id], now); if (kids[id] && isAinsley(kids[id], id)) cleanAinsley(kids[id]); });
      if (Array.isArray(data.leaveBys)) data.leaveBys = data.leaveBys.filter(function (it) { return !rowTherapy(it); });   /* LIVEFIX1 */
      var q = data.boardStrip && data.boardStrip.queue;
      if (Array.isArray(q)) data.boardStrip.queue = q.filter(function (it) { return !isDressDay(rowText(it)) && !rowTherapy(it); });
    } catch (e) { /* never break a board over a filter */ }
    return data;
  }
  /* cal-live / cal-months events: drop colour + dress-up days (they are never rows on the face) */
  function keepEvent(ev) { return !(ev && (isDressDay(String(ev.summary || ev.title || ev.what || "")) || rowTherapy(ev))); }   /* LIVEFIX1 · therapy out */

  /* PRIVFEED3 · one pass over a private-feed payload (cal-live / cal-months / kids-week) before any page sees it:
     colour-day and dress-up rows drop out, face text loses em dashes, arrows and booking codes ('#...').
     Words only: ids, times, urls, colours and week-state fields are never touched. Data files are never edited. */
  var SKIP_KEY = /^(id|icdId|href|url|link|htmlLink|sourceCalendar|source|tz|status|kind|tone|cadence|theme|color|colour|c|cls|class|.*Iso|start|end|at|fetchedAt|refreshedAt|updatedAt|windowStart|windowEnd|with|withDan)$/;
  /* SEATLAW1 + SCHOOLWORD1 (TEXTLAW5) · same regexes as scripts/text-law.json (scripts/qa/seatlaw.test.mjs keeps them equal):
     ticket section / row / seat never shows, at any viewport, live or cached; 'LKMS' reads 'school'. */
  var RENDER_RULES = [
    [new RegExp("\\s*\\([^()]*\\b(?:Sec(?:tion)?|Row|Seats?)\\b\\.?\\s*[A-Za-z0-9][^()]*\\)", "gi"), ""],
    [new RegExp("\\s*,?\\s*\\b(?:(?:Sec(?:tion)?\\.?\\s*[A-Z]?\\d{1,4}[A-Z]?)(?:\\s*,?\\s*Row\\s*[A-Z0-9]{1,3})?|Row\\s*[A-Z0-9]{1,3}(?=\\s*,?\\s*Seats?\\b))(?:\\s*,?\\s*(?:Seats?\\s*)?\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?(?![:\\d]))?(?:\\s*,?\\s*Seats?\\s*\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)?", "g"), ""],
    [new RegExp("\\s*,?\\s*\\b(?:Seats\\s*\\d{1,3}(?:\\s*[-–,&]\\s*\\d{1,3})*|Seat\\s*\\d{1,3}\\s*[-–]\\s*\\d{1,3})\\b", "gi"), ""],
    [new RegExp("\\bLKMS\\b", "g"), "school"]
  ];
  /* DATA1 P2-8 · ONE school word + ONE "for mom" rule for both feeds (cal-from-events.mjs via text-law.json, calendar-refresh.mjs
     via these): "for mom" / "for their mom's" goes as a whole phrase, so no dangling "for (" is left behind. */
  var SCHOOL_WORD = RENDER_RULES[RENDER_RULES.length - 1];
  function schoolWord(t) { return String(t == null ? "" : t).replace(new RegExp(SCHOOL_WORD[0].source, "g"), SCHOOL_WORD[1]); }
  var MOM_PHRASE = /\s*\b(?:for|with|at|to|from) (?:their )?mom(?:['\u2019]?s)?\b|\s*\bmom(?:['\u2019]?s)?\b/gi;
  function momFree(t) { return String(t == null ? "" : t).replace(MOM_PHRASE, "").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim(); }
  /* FACESTRIP1 r2 (Alfred 10:26 + 10:28 CT FAIL of CALLIVE r3) · money never reaches the face from ANY calendar feed: faceText drops
     the whole amount ('(bring \x2445)' reads '(bring)'), then any sign left. MONEY_SRC and SIGN_SRC are CALLIVE-NODOLLAR r3b's
     shared money / moneysign rules copied byte for byte from scripts/text-law.json r3b (flags "", no \b, no \s), so this reads
     every string exactly as calendar-refresh.mjs, cal-from-events.mjs and cal-months-window.py do (scripts/qa/facestrip1.test.mjs
     keeps them equal and checks the output byte for byte). There is NO separate pre-rule any more: the r2 trailing-sign, USD and
     k/m forms live in the one shared rule. The tidy after the strip is the calendar writers' tidy, step for step.
     Engines without lookbehind (old Safari): every lookbehind sits at the start of a top-level alternative, so each one is
     swapped for a capture of the character(s) before the match and that capture is put back (MONEY_LB_FALLBACK). */
  var MONEY_SRC = "(?:-?[\\x24\\uFF04\\uFE69][\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*(?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9](?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9,]*[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9])?(?:\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)?|\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)(?:[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*[-\\u2013][\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*(?:[\\x24\\uFF04\\uFE69]|(?:[uU][sS][dD]?[\\x24\\uFF04\\uFE69]|[uU][sS][dD](?![A-Za-z0-9_])))?[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*(?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9](?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9,]*[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9])?(?:\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)?|\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)(?![0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9:]))?(?:[kKmM\\u212A](?![A-Za-z0-9_]))?|(?<![A-Za-z0-9_])-?(?:[uU][sS][dD]?[\\x24\\uFF04\\uFE69]|[uU][sS][dD](?![A-Za-z0-9_]))[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*(?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9](?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9,]*[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9])?(?:\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)?|\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)(?:[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*[-\\u2013][\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*(?:[\\x24\\uFF04\\uFE69]|(?:[uU][sS][dD]?[\\x24\\uFF04\\uFE69]|[uU][sS][dD](?![A-Za-z0-9_])))?[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*(?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9](?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9,]*[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9])?(?:\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)?|\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)(?![0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9:]))?(?:[kKmM\\u212A](?![A-Za-z0-9_]))?|(?<![0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9.,])(?<![0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9][:/\\-\\u2013])-?(?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9](?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9,]*[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9])?(?:\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)?|\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)(?:[kKmM\\u212A](?![A-Za-z0-9_]))?[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*(?:[\\x24\\uFF04\\uFE69]|(?:[uU][sS][dD]?[\\x24\\uFF04\\uFE69]|[uU][sS][dD](?![A-Za-z0-9_])))(?:[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*(?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9](?:[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9,]*[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9])?(?:\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)?|\\.[0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9]+)(?:[kKmM\\u212A](?![A-Za-z0-9_]))?)?)(?:(?:[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*/|[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]+[pP][eE][rR](?![A-Za-z0-9_]))[\\t\\n\\x0B\\f\\r \\x1C-\\x1F\\x85\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]*(?:[hH][oO][uU][rR]|[hH][rR]|[hH]|[wW][eE][eE][kK]|[wW][kK]|[dD][aA][yY]|[mM][oO][nN][tT][hH]|[mM][oO])(?![A-Za-z0-9_]))?";
  var SIGN_SRC = "(?<![A-Za-z_])(?:[uU][sS][dD]?[\\x24\\uFF04\\uFE69]|[uU][sS][dD](?![A-Za-z0-9_]))|[\\x24\\uFF04\\uFE69]";
  var MONEY_LB_FALLBACK = [["(?<![A-Za-z0-9_])", "(^|[^A-Za-z0-9_])"], ["(?<![0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9.,])(?<![0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9][:/\\-\\u2013])", "(^|^[:/\\-\\u2013]|[^0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9.,:/\\-\\u2013]|[^0-9\\uFF10-\\uFF19\\u0660-\\u0669\\u06F0-\\u06F9][:/\\-\\u2013])"], ["(?<![A-Za-z_])", "(^|[^A-Za-z_])"]];
  function lbFree(src) { for (var i = 0; i < MONEY_LB_FALLBACK.length; i++) src = src.split(MONEY_LB_FALLBACK[i][0]).join(MONEY_LB_FALLBACK[i][1]); return src; }
  function keepLead(m) { var p = ""; for (var i = 1; i < arguments.length - 2; i++) if (typeof arguments[i] === "string") p += arguments[i]; return p; }
  var MONEY_RE, SIGN_RE, MONEY_LB_OK = true;
  try { MONEY_RE = new RegExp(MONEY_SRC, "g"); SIGN_RE = new RegExp(SIGN_SRC, "g"); } catch (e) { MONEY_LB_OK = false; MONEY_RE = new RegExp(lbFree(MONEY_SRC), "g"); SIGN_RE = new RegExp(lbFree(SIGN_SRC), "g"); }
  function moneyFree(t) {
    if (typeof t !== "string" || !t) return t;
    MONEY_RE.lastIndex = 0; SIGN_RE.lastIndex = 0;
    var hasSign = SIGN_RE.test(t);
    MONEY_RE.lastIndex = 0; SIGN_RE.lastIndex = 0;
    if (!hasSign) return t;   /* same guard as the calendar writers: no sign (sign char, USD, US-sign) = untouched */
    var u = MONEY_LB_OK ? t.replace(MONEY_RE, "") : t.replace(MONEY_RE, keepLead);
    u = MONEY_LB_OK ? u.replace(SIGN_RE, "") : u.replace(SIGN_RE, keepLead);
    return u.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s*\(\)/g, "").replace(/\s{2,}/g, " ").trim();
  }
  function renderRules(t) { for (var i = 0; i < RENDER_RULES.length; i++) t = t.replace(RENDER_RULES[i][0], RENDER_RULES[i][1]); return t; }
  function faceText(s) {
    if (typeof s !== "string" || !s || /^(https?:|data:|\d{4}-\d\d-\d\d|#[0-9a-f]{3,8}$)/i.test(s)) return s;
    s = moneyFree(s); if (!s) return s;   /* FACESTRIP1 */
    var t = faceDash(renderRules(s)).replace(/\s*#[A-Za-z0-9_]+(\/#[A-Za-z0-9_]+)*/g, "")
      .replace(/\s*\((?:tennis shoes|sneakers|wear [^)]*)\)/gi, "").replace(/\s*[-\u2013\u2014\u00b7,:;]?\s*\bwear\b[^()]*$/i, "") /* LAW8C1 · no what-to-wear hints on glass */.replace(/\s{2,}/g, " ").replace(/\s*,\s*(?=,|$)/g, "").replace(/(\s\u00b7\s*)+$/, "").trim();
    return t || s.replace(/[\u2014\u2192]/g, " ").trim();
  }
  /* NOCUSTODY1 · glass law for every board: a feed string that carries one is blanked, and a row whose text carries
     one is dropped. Nothing is put in its place. Same phrase list as scripts/qa/nocustody.test.mjs. */
  var NOCUST_RX = /kids with (?:dad|mom|dan|you)\b|\b(?:dad|mom)(?:['\u2019]?s)? weeks?\b|\bhome week|\baway week|\bcustody\b|\btheir mom['\u2019]?s week|\bkids away\b|\btheir week\b|kids-with-dan|\b(?:your base|base at home|drop zone hq) with dad\b|\bwhose (?:week|weekend|night|turn)\b|\b(?:kids?|boys|weeks?|weekends?|nights?) (?:with|at) (?:mom|mommy|mother|dad|daddy|father)(?:['\u2019]?s)?\b|\bwith (?:mom|mommy|mother)\b|\b(?:mom|mommy|mother|dad|daddy|father)['\u2019]?s (?:kids|weekend|night|house|place)\b|\b(?:mom|mommy|mother)(?:['\u2019]?s)? (?:has|have|had|gets?|got|takes?|keeps?) (?:the )?kids\b|\bhand-?\s?offs?\b|\b(?:chores|payday) with dad\b|who.{1,6}s where|\b(?:kids?|custody) exchange\b|\bexchange (?:day|time|point)\b|(?:^\s*|\b(?!who\b)[a-z]+\s+)(?:has|have|had|gets?|got|keeps?) (?:the )?kids\b(?=\s*(?:$|[\u00b7|]|(?:this|next) (?:week|weekend)\b|(?:until|till|through|thru)\b|all week\b))/i; /* custody-law:allow (Atlas + Alfred: only which parent or household the kids are with; logistics stay) */
  /* a co-parent name joined to kids, week or weekend counts the same; the name is read at run time only (role coparent, never in git) */
  function cpRe() { var w = g.WARDOS_PRIVATE_NAMES, l = w && w.coparent ? [].concat(w.coparent) : []; l = l.map(function (n) { return String(n || "").trim().split(/\s+/)[0]; }).filter(function (n) { return /^[A-Za-z]{2,}$/.test(n); }); if (!l.length) return null; var N = "(?:" + l.join("|") + ")"; return new RegExp("\\b" + N + "(?:['\u2019]?s)? (?:kids|week|weekend|night|house|place)\\b|\\b" + N + " (?:has|have|had|gets?|got|takes?|keeps?) (?:the )?kids\\b|\\b(?:kids?|weeks?|weekends?) (?:with|at) " + N + "\\b", "i"); }
  function isCustody(s) { var t = String(s == null ? "" : s), c; return NOCUST_RX.test(t) || !!((c = cpRe()) && c.test(t)); }
  function rowCustody(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return false;
    return isCustody([o.summary, o.title, o.what, o.l, o.label, o.text].filter(function (x) { return typeof x === "string"; }).join(" "));
  }
  function rowDress(o) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return false;
    return isDressDay([o.summary, o.title, o.what, o.l, o.label, o.text, o.hint].filter(function (x) { return typeof x === "string"; }).join(" "));
  }
  /* LIVEFIX3d · Ainsley's quest rows are scrubbed as the feed arrives too, so every renderer (quests, claims, flight) gets clean text */
  function feedAinsley(name, d) {
    try { if (name === "kids-week" && d && d.kids && d.kids.ainsley) cleanAinsley(d.kids.ainsley); } catch (e) { /* never break a board */ }
    return d;
  }
  function cleanFeed(name, data) {
    function walk(v, key) {
      if (Array.isArray(v)) { var out = []; for (var i = 0; i < v.length; i++) { if (!rowDress(v[i]) && !rowCustody(v[i]) && !rowTherapy(v[i]) && !(typeof v[i] === "string" && isCustody(v[i]))) out.push(walk(v[i], key)); } return out; }
      if (v && typeof v === "object") { var r = {}; for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) { if ((rowDress(v[k]) || rowCustody(v[k]) || (rowTherapy(v[k]) && typeof v[k] === "object")) && k !== "kids") continue; r[k] = walk(v[k], k); } return r; }
      if (typeof v === "string" && !(key && SKIP_KEY.test(key))) return isCustody(v) ? "" : faceText(v);
      return v;
    }
    try { return data && typeof data === "object" ? feedAinsley(name, walk(data, "")) : data; } catch (e) { return data; }
  }

  g.HouseFaceLaw = { moneyFree: moneyFree, MONEY_SRC: MONEY_SRC, SIGN_SRC: SIGN_SRC, MONEY_RE: MONEY_RE, MONEY_LB_OK: MONEY_LB_OK, MONEY_LB_FALLBACK: MONEY_LB_FALLBACK, SIGN_RE: SIGN_RE, isCustody: isCustody, cleanFeed: cleanFeed, faceText: faceText, isDressDay: isDressDay, isColorDay: isColorDay, faceDash: faceDash, rowEnded: rowEnded, keepRow: keepRow, keepEvent: keepEvent, isTherapy: isTherapy, rowTherapy: rowTherapy, ainsleyText: ainsleyText, THERAPY: THERAPY, cleanKidsWeek: cleanKidsWeek, cleanKid: cleanKid, ctNow: ctNow, DRESS: DRESS, RENDER_RULES: RENDER_RULES, schoolWord: schoolWord, momFree: momFree, cleanAinsley: cleanAinsley };
})(typeof window !== "undefined" ? window : globalThis);
