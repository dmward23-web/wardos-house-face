/* ACERFIX · one fail-closed display adapter for calendar glass.
   Child rows render an allowlisted title only. Provider, clinical, and therapy items are always omitted. There is no opt-in.
   Titles never come from description, hint, location, notes, or a sliced raw sentence.
   Ainsley's own audience keeps the no-digit rule. The shared hub reads canonical startIso instead. */
(function (global) {
  "use strict";
  var TZ = "America/Chicago";
  /* Stems stay open at the end: "therapy" / "psychology" / "psychiatry" are denied, not only the bare stem.
     A clinical word anywhere in the source drops the whole item. It is never renamed to Homework. */
  /* Hard clinical words drop an item for every audience. Appointment and session
     are a boys-only ban so Ainsley's and Dan's own sessions can stay. */
  var HARD = /(?:\b(?:ot|speech|drs?|doctors?|telehealth|counsel(?:or|ing|ling)?|anxiety|provider|clinical)\b|\btherap|\bpsycholog|\bpsychiatr)/i;
  var SOFT = /\b(?:appointments?|sessions?)\b/i;
  var APPT_WORD = /\b(?:appointments?|sessions?|dentists?)\b/i;
  var BOY_NAME = /\b(?:hayes|harris)\b/i;
  var CLINICAL = new RegExp(HARD.source + "|" + SOFT.source, "i");
  var SKIP_KEY = /^(id|icdId|href|url|link|htmlLink|source|tz|status|tone|cadence|theme|color|colour|cls|class|kid|owner|audience|kidId|providerOptIn|allDay|leaveBy|timeRole)$/i;
  var CANCEL = /(?:^|\b)(?:cancel+ed|cxl)\b/i;
  var RANGE = /\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\s*[-–—to]{1,3}\s*\d{1,2}(?::\d{2})?/i;
  var LISTS = ["today", "school", "sports", "appointments", "week", "events", "ahead", "upcoming", "hottest"];

  function textOf(v) {
    return typeof v === "string" ? v : "";
  }
  function nfkc(s) {
    try { return String(s == null ? "" : s).normalize("NFKC"); }
    catch (e) { return String(s == null ? "" : s); }
  }
  /* Look-alikes that can spell hayes or harris, mapped to Latin. */
  var LOOK = {
    "\u0410": "a", "\u0430": "a", "\u0415": "e", "\u0435": "e", "\u041E": "o", "\u043E": "o",
    "\u0420": "p", "\u0440": "p", "\u0421": "c", "\u0441": "c", "\u0423": "y", "\u0443": "y",
    "\u0425": "x", "\u0445": "x", "\u0406": "i", "\u0456": "i", "\u0408": "j", "\u0458": "j",
    "\u0405": "s", "\u0455": "s", "\u041D": "h", "\u043D": "h", "\u0412": "b", "\u0432": "b",
    "\u041A": "k", "\u043A": "k", "\u041C": "m", "\u043C": "m", "\u0422": "t", "\u0442": "t",
    "\u0391": "a", "\u03B1": "a", "\u0392": "b", "\u03B2": "b", "\u0395": "e", "\u03B5": "e",
    "\u0397": "h", "\u03B7": "h", "\u0399": "i", "\u03B9": "i", "\u039A": "k", "\u03BA": "k",
    "\u039C": "m", "\u03BC": "m", "\u039D": "n", "\u03BD": "n", "\u039F": "o", "\u03BF": "o",
    "\u03A1": "p", "\u03C1": "p", "\u03A4": "t", "\u03C4": "t", "\u03A5": "y", "\u03C5": "y",
    "\u03A7": "x", "\u03C7": "x", "\u0396": "z", "\u03B6": "z"
  };
  function nfkd(s) {
    try { return String(s == null ? "" : s).normalize("NFKD"); }
    catch (e) { return String(s == null ? "" : s); }
  }
  var ENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", shy: "\u00AD" };
  /* One ingest normalize, before any name match. Display strings are not rewritten. */
  function normalizeIngest(s) {
    var t = String(s == null ? "" : s);
    var prev, n = 0;
    do {
      prev = t;
      t = t.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, function (all, body) {
        if (body.charAt(0) === "#") {
          var hex = body.charAt(1) === "x" || body.charAt(1) === "X";
          var cp = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
          if (!isFinite(cp) || cp < 0 || cp > 0x10FFFF) return all;
          try { return String.fromCodePoint(cp); } catch (e) { return all; }
        }
        var v = ENT[body.toLowerCase()];
        return v == null ? all : v;
      });
    } while (t !== prev && ++n < 8);
    t = t.replace(/<[^>]*>/g, "");
    n = 0;
    do {
      prev = t;
      t = t.replace(/%([0-9A-Fa-f]{2})/g, function (_, h) {
        var c = parseInt(h, 16);
        return (c >= 0 && c <= 255) ? String.fromCharCode(c) : _;
      });
    } while (t !== prev && ++n < 6);
    t = nfkd(t);
    try { t = t.replace(/\p{M}/gu, ""); }
    catch (e) { t = t.replace(/[\u0300-\u036F]/g, ""); }
    try { t = t.replace(/\p{Cf}/gu, ""); }
    catch (e2) { t = t.replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, ""); }
    t = t.replace(/\u00AD/g, "");
    return t;
  }
  function enclosedLetter(cp) {
    if (cp >= 0x1F1E6 && cp <= 0x1F1FF) return String.fromCharCode(97 + (cp - 0x1F1E6));
    if (cp >= 0x1F130 && cp <= 0x1F149) return String.fromCharCode(97 + (cp - 0x1F130));
    if (cp >= 0x1F170 && cp <= 0x1F189) return String.fromCharCode(97 + (cp - 0x1F170));
    if (cp >= 0x24B6 && cp <= 0x24CF) return String.fromCharCode(97 + (cp - 0x24B6));
    if (cp >= 0x24D0 && cp <= 0x24E9) return String.fromCharCode(97 + (cp - 0x24D0));
    if (cp >= 0x1F110 && cp <= 0x1F129) return String.fromCharCode(97 + (cp - 0x1F110));
    return "";
  }
  /* Normalize, map enclosed letters and look-alikes, then case-fold. */
  function prepText(s) {
    var t = normalizeIngest(s);
    var out = "";
    var i = 0;
    while (i < t.length) {
      var cp = t.codePointAt(i);
      var ch = String.fromCodePoint(cp);
      i += cp > 0xFFFF ? 2 : 1;
      out += enclosedLetter(cp) || LOOK[ch] || ch;
    }
    try { out = out.toLowerCase(); } catch (e2) { /* already folded */ }
    return out;
  }
  /* Digit-for-letter is only for the name comparison, never for displayed text. */
  function foldDigits(s, one) {
    return s.replace(/[013457]/g, function (d) {
      return d === "0" ? "o" : d === "1" ? one : d === "3" ? "e" : d === "4" ? "a" : d === "5" ? "s" : "t";
    });
  }
  function nameHit(text) {
    var raw = String(text || "").replace(/[^a-z0-9]/g, "");
    var forms = [raw.replace(/[0-9]/g, ""), foldDigits(raw, "i"), foldDigits(raw, "l")];
    for (var i = 0; i < forms.length; i++) {
      if (/hayes|harris/.test(forms[i].replace(/[^a-z]/g, ""))) return true;
    }
    return false;
  }
  function skeletonOf(s) { return prepText(s).replace(/[^a-z]/g, ""); }
  function foreignLetter(s) {
    var t = prepText(s).replace(/[a-z]/g, "");
    try { return /\p{L}/u.test(t); }
    catch (e) { return /[^\u0000-\u007F]/.test(t); }
  }
  function walkRow(v, bag, seen) {
    if (typeof v === "string") { bag.push(v); return; }
    if (!v || typeof v !== "object") return;
    if (seen) { if (seen.has(v)) return; seen.add(v); }
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) walkRow(v[i], bag, seen); return; }
    var keys = Object.keys(v);
    for (var k = 0; k < keys.length; k++) { bag.push(keys[k]); walkRow(v[keys[k]], bag, seen); }
  }
  /* Appointment rows only. A boy-name skeleton, or any letter still outside Latin a-z, drops the row. */
  function boyAppt(ev) {
    var bag = [];
    walkRow(ev, bag, typeof WeakSet === "function" ? new WeakSet() : null);
    var preps = [], skels = [], raws = [], foreign = false, appt = false;
    for (var i = 0; i < bag.length; i++) {
      var p = prepText(bag[i]);
      preps.push(p);
      skels.push(p.replace(/[^a-z]/g, ""));
      raws.push(p.replace(/[^a-z0-9]/g, ""));
      if (!foreign && foreignLetter(bag[i])) foreign = true;
      if (!appt && APPT_WORD.test(p)) appt = true;
    }
    if (!appt && /appointment|session|dentist/.test(skels.join(""))) appt = true;
    if (!appt) return false;
    if (foreign) return true;
    if (nameHit(raws.join(""))) return true;
    for (var j = 0; j < raws.length; j++) if (nameHit(raws[j])) return true;
    return false;
  }
  function titleBlob(ev) {
    if (!ev || typeof ev !== "object") return nfkc(textOf(ev));
    return nfkc([ev.summary, ev.title, ev.what, ev.label, ev.text, ev.l].map(textOf).filter(Boolean).join("\n"));
  }
  function kindBlob(ev) {
    if (!ev || typeof ev !== "object") return "";
    return nfkc([ev.kind, ev.category, ev.safeCategory, ev.type].map(textOf).filter(Boolean).join("\n"));
  }
  /* Every prose field, before any title is rewritten or cleared. */
  function sourceBlob(ev) {
    if (ev == null) return "";
    if (typeof ev !== "object") return nfkc(textOf(ev));
    var parts = [];
    Object.keys(ev).forEach(function (k) {
      if (SKIP_KEY.test(k) || /iso$/i.test(k)) return;
      var v = ev[k];
      if (typeof v === "string") parts.push(v);
    });
    return nfkc(parts.join("\n"));
  }
  function isBoy(audience) {
    var a = String(audience || "").toLowerCase();
    return a === "hayes" || a === "harris";
  }
  function isDenied(ev, audience) {
    if (!ev) return false;
    if (typeof ev === "string") {
      var s = prepText(ev);
      if (CANCEL.test(s)) return true;
      if (boyAppt(ev)) return true;
      if (isBoy(audience)) return HARD.test(s) || SOFT.test(s);
      return HARD.test(s);
    }
    if (ev.status === "cancelled" || ev.status === "canceled") return true;
    var blob = sourceBlob(ev);
    if (CANCEL.test(titleBlob(ev))) return true;
    var who = audience != null ? String(audience) : "";
    var boy = isBoy(who) || isBoy(ev.kid) || isBoy(ev.owner) || isBoy(ev.kidId);
    var trusted = /^(ainsley|adult|dan|dad|shared|hub)$/i.test(who);
    if (HARD.test(blob)) return true;
    if (boy || !trusted) return SOFT.test(blob);
    if (boyAppt(ev)) return true;
    return false;
  }

  function audienceOf(audience) {
    var a = String(audience || "child").toLowerCase();
    if (a === "adult" || a === "dad" || a === "dan") return "adult";
    if (a === "ainsley") return "ainsley";
    if (a === "shared" || a === "hub") return "shared";
    return "child";
  }

  function ctParts(date) {
    var map = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).formatToParts(date).forEach(function (p) {
      if (p.type !== "literal") map[p.type] = p.value;
    });
    return map;
  }

  function clockFromIso(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(+d)) return "";
    try {
      var p = ctParts(d);
      if (!p.hour || !p.minute) return "";
      var ap = String(p.dayPeriod || "").toUpperCase();
      if (ap !== "AM" && ap !== "PM") ap = "";
      return p.hour + ":" + p.minute + (ap ? " " + ap : "");
    } catch (e) {
      return "";
    }
  }

  function minutesOfClock(h, m, ap) {
    var hh = Number(h);
    var mm = m == null || m === "" ? 0 : Number(m);
    if (!isFinite(hh) || !isFinite(mm)) return null;
    if (ap) {
      var pm = /^p/i.test(ap);
      if (hh === 12) hh = pm ? 12 : 0;
      else if (pm) hh += 12;
    }
    return hh * 60 + mm;
  }

  function rangeStart(text) {
    var m = String(text || "").match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?/i);
    if (!m) return null;
    return minutesOfClock(m[1], m[2], m[3]);
  }

  function isoMinutes(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(+d)) return null;
    try {
      var p = ctParts(d);
      return minutesOfClock(p.hour, p.minute, p.dayPeriod);
    } catch (e) {
      return null;
    }
  }

  function isLeave(ev, text) {
    var kind = textOf(ev && ev.kind) + " " + textOf(ev && ev.category);
    if (ev && (ev.leaveBy === true || ev.timeRole === "leave")) return true;
    if (/\bleave\b/i.test(kind) || kind.indexOf("school_pickup") >= 0 || kind.indexOf("school_drop") >= 0) return true;
    if (/\bleave\b/i.test(text)) return true;
    var rs = rangeStart(text);
    var sm = isoMinutes(ev && (ev.startIso || ev.start));
    return rs != null && sm != null && rs !== sm;
  }

  function allowTitle(ev, audience) {
    if (isDenied(ev, audience)) return null;
    var text = titleBlob(ev);
    var kind = kindBlob(ev);
    if (CANCEL.test(text)) return null;
    var leave = isLeave(ev, text);
    if (/school[_\s-]*pickup|\bpick\s*-?\s*up\b/i.test(text) || /school_pickup/.test(kind)) return "School pickup";
    if (/school[_\s-]*drop|\bdrop(?:\s*-?\s*off)?\b/i.test(text) || /school_drop/.test(kind)) return "School drop";
    if (/\bswim\b/i.test(text) || /\bswim\b/i.test(kind)) return leave ? "Leave for swim" : "Swim";
    if (/\bsoccer\b/i.test(text) || /\bsoccer\b/i.test(kind)) return leave ? "Leave for soccer" : "Soccer";
    if (/\bbaseball\b/i.test(text)) return leave ? "Leave for baseball" : "Baseball";
    if (/\bflag\b/i.test(text)) return leave ? "Leave for flag" : "Flag";
    if (/\bspecials?\b/i.test(text)) return "School specials";
    if (/\bno school\b/i.test(text)) return "No school";
    if (/\bfield trip\b/i.test(text)) return "Field trip";
    if (/\bart club\b/i.test(text)) return "Art club";
    if (/\bconference\b/i.test(text)) return "Conference";
    if (/\bpicture day\b/i.test(text)) return "Picture day";
    if (/\bhomework\b/i.test(text)) return "Homework";
    if (/\bchoir\b/i.test(text)) return "Choir";
    if (/\braffle\b/i.test(text)) return "Raffle";
    if (/\bbook order\b/i.test(text)) return "Book order";
    if (/\bdonation\b/i.test(text)) return "Donation";
    if (/\bHOA\b/.test(text)) return "HOA";
    /* Ainsley, Dan, and the shared hub. Boys stay on the soft ban above. */
    if (audienceOf(audience) !== "child" && /\b(?:appointments?|sessions?|dentists?)\b/i.test(text)) return "Appointment";
    if (/^Nothing else on the calendar today$/i.test(text.trim())) return "Nothing else today";
    if (/^More on the month calendar$/i.test(text.trim())) return "More on the month calendar";
    return null;
  }

  function allDay(ev) {
    if (!ev || typeof ev !== "object") return false;
    if (ev.allDay === true) return true;
    return /\ball day\b/i.test(textOf(ev.when) + " " + textOf(ev.time));
  }

  function timeLabel(ev, audience) {
    audienceOf(audience); /* Dan, Nov 10 2026, 6:08 PM CT: Ainsley gets the same clock time as every other board. */
    if (allDay(ev)) return "All day";
    var iso = ev && (ev.startIso || (typeof ev.start === "string" && /T\d{2}:/.test(ev.start) ? ev.start : ""));
    var fromIso = clockFromIso(iso);
    if (fromIso) return fromIso;
    var when = textOf(ev && (ev.time || ev.when));
    if (!when || RANGE.test(when)) return "";
    var m = when.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    if (!m) return "";
    var clock = m[1].replace(/\s+/g, " ").trim();
    if (/[ap]m/i.test(clock)) return clock.replace(/\s*([ap])m/i, function (_, ap) { return " " + ap.toUpperCase() + "M"; });
    return clock;
  }

  function summarize(ev, audience) {
    var who = audienceOf(audience);
    if (typeof ev === "string") ev = { summary: ev, what: ev };
    if (!ev || typeof ev !== "object") return null;
    if (isDenied(ev, audience)) return null;
    var title = allowTitle(ev, audience);
    if (!title) {
      if (who === "adult") title = "Calendar item";
      else return null;
    }
    var time = timeLabel(ev, who);
    return {
      id: ev.id || "",
      title: title,
      time: time,
      allDay: time === "All day",
      startIso: textOf(ev.startIso || (typeof ev.start === "string" ? ev.start : "")),
      endIso: textOf(ev.endIso || ""),
      audience: who
    };
  }

  function clearProse(row) {
    ["hint", "where", "description", "location", "notes", "place", "detail", "blurb"].forEach(function (k) {
      if (typeof row[k] === "string") row[k] = "";
    });
  }

  function applyRow(row, audience) {
    var view = summarize(row, audience);
    if (!view) return null;
    row.what = view.title;
    row.title = view.title;
    row.summary = view.title;
    row.label = view.title;
    row.text = view.title;
    if (typeof row.l === "string") row.l = view.title;
    clearProse(row);
    if (view.time) {
      row.when = view.time;
      row.time = view.time;
    }
    return row;
  }

  function scrubList(list, audience) {
    if (!Array.isArray(list)) return list;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (!row || typeof row !== "object") continue;
      if (applyRow(row, audience)) out.push(row);
    }
    return out;
  }

  function scrubKid(kid, audience) {
    if (!kid || typeof kid !== "object") return kid;
    LISTS.forEach(function (k) {
      if (Array.isArray(kid[k])) kid[k] = scrubList(kid[k], audience);
      else if (kid[k] && typeof kid[k] === "object") {
        if (!applyRow(kid[k], audience)) kid[k] = null;
      }
    });
    if (kid.hottest && typeof kid.hottest === "object") {
      if (!applyRow(kid.hottest, audience)) kid.hottest = null;
    }
    return kid;
  }

  function scrubPayload(data) {
    if (!data || typeof data !== "object") return data;
    var kids = data.kids || {};
    Object.keys(kids).forEach(function (id) {
      var who = id === "dan" || id === "dad" ? "adult" : id;
      scrubKid(kids[id], who);
    });
    if (Array.isArray(data.leaveBys)) data.leaveBys = scrubList(data.leaveBys, "adult");
    if (data.boardStrip && typeof data.boardStrip === "object") {
      if (Array.isArray(data.boardStrip.queue)) data.boardStrip.queue = scrubList(data.boardStrip.queue, "shared");
      if (data.boardStrip.nextLeave && typeof data.boardStrip.nextLeave === "object") {
        if (!applyRow(data.boardStrip.nextLeave, "shared")) data.boardStrip.nextLeave = null;
      }
    }
    return data;
  }

  function escapeText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  global.HouseEventDisplay = {
    CLINICAL: CLINICAL,
    isDenied: isDenied,
    allowTitle: allowTitle,
    timeLabel: timeLabel,
    summarize: summarize,
    scrubPayload: scrubPayload,
    scrubKid: scrubKid,
    escapeText: escapeText,
    clockFromIso: clockFromIso
  };
})(typeof window !== "undefined" ? window : globalThis);
