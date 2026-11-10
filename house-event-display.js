/* ACERFIX · one fail-closed display adapter for calendar glass.
   Child rows render an allowlisted title only. Provider, clinical, and therapy items are always omitted. There is no opt-in.
   Titles never come from description, hint, location, notes, or a sliced raw sentence.
   Ainsley's own audience keeps the no-digit rule. The shared hub reads canonical startIso instead. */
(function (global) {
  "use strict";
  var TZ = "America/Chicago";
  var CLINICAL = /\b(?:therap|counsel(?:or|ing|ling)?|psycholog|psychiatr|anxiety|provider|clinical)\b/i;
  var CANCEL = /(?:^|\b)(?:cancel+ed|cxl)\b/i;
  var RANGE = /\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\s*[-–—to]{1,3}\s*\d{1,2}(?::\d{2})?/i;
  var LISTS = ["today", "school", "sports", "appointments", "week", "events", "ahead", "upcoming", "hottest"];

  function textOf(v) {
    return typeof v === "string" ? v : "";
  }
  function titleBlob(ev) {
    if (!ev || typeof ev !== "object") return textOf(ev);
    return [ev.summary, ev.title, ev.what, ev.label, ev.text, ev.l].map(textOf).filter(Boolean).join("\n");
  }
  function kindBlob(ev) {
    if (!ev || typeof ev !== "object") return "";
    return [ev.kind, ev.category, ev.safeCategory, ev.type].map(textOf).filter(Boolean).join("\n");
  }
  function isDenied(ev) {
    if (!ev) return false;
    if (typeof ev === "string") return CLINICAL.test(ev) || CANCEL.test(ev);
    if (ev.status === "cancelled" || ev.status === "canceled") return true;
    var title = titleBlob(ev);
    var kind = kindBlob(ev);
    return CLINICAL.test(title) || CLINICAL.test(kind) || CANCEL.test(title);
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

  function allowTitle(ev) {
    var text = titleBlob(ev);
    var kind = kindBlob(ev);
    if (CLINICAL.test(text) || CLINICAL.test(kind) || CANCEL.test(text)) return null;
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
    var who = audienceOf(audience);
    if (who === "ainsley") return "";
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
    if (isDenied(ev)) return null;
    var title = allowTitle(ev);
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
    if (audienceOf(audience) === "ainsley") {
      if (typeof row.when === "string") row.when = row.when.replace(/[0-9$%]/g, " ").replace(/\s+/g, " ").trim();
      if (typeof row.time === "string") row.time = "";
    } else if (view.time) {
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
