/* LIVING HOUSE · lh-l3.js · layer 3 rules (browser: window.LHLayer3; node: module.exports).
   School-morning sequence for the two boys, long-press text, and audience mode.
   Time is a passed millisecond (the page uses LHClock.now()). This file never reads the current clock.
   Voice stays muted: text only, until the same hook is proven on a Linux Chromium wall and on iOS Safari. */
(function (root) {
  "use strict";
  var TZ = "America/Chicago";
  var BOYS = ["hayes", "harris"];
  var NAME = { hayes: "Hayes", harris: "Harris" };
  var START_MIN = 6 * 60 + 30;
  var END_MIN = 8 * 60 + 30;
  var END_CAP = 10 * 60;
  var NO_SCHOOL = /\bno school\b|\bschool closed\b|\bteacher work day\b/i;
  var DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var MODES = { kids: 1, guest: 1, dan: 1 };

  function parts(ms) {
    var p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return { iso: p.year + "-" + p.month + "-" + p.day, min: (+p.hour % 24) * 60 + (+p.minute), dow: DOW[p.weekday] };
  }
  function t12(ms) {
    return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(ms)).replace(/\u202f/g, " ");
  }
  function at(v) { var t = Date.parse(v); return isNaN(t) ? 0 : t; }
  function dayIso(v) { var m = String(v || "").match(/^(\d{4}-\d{2}-\d{2})$/); return m ? m[1] : parts(at(v)).iso; }
  function isAll(ev) { return !!(ev && (ev.allDay === true || ev.allDay === "True" || ev.all === true)); }
  function rows(cal) { return (cal && cal.upcomingLeaves) || []; }

  function namesKid(R, boy, text) {
    if (R && R.kidName) return R.kidName(boy, text);
    return new RegExp("\\b" + NAME[boy] + "\\b", "i").test(String(text || ""));
  }
  /* a no-school row covers a boy when it names him, names the boys or the kids, or names nobody */
  function coversBoy(summary, boy) {
    var s = String(summary || ""), who = { hayes: "Hayes", harris: "Harris", ainsley: "Ainsley" };
    var named = Object.keys(who).filter(function (k) { return new RegExp("\\b" + who[k] + "\\b", "i").test(s); });
    if (/\b(boys|kids)\b/i.test(s) || !named.length) return true;
    return named.indexOf(boy) >= 0;
  }
  function noSchool(list, boy, iso) {
    return list.some(function (e) {
      return isAll(e) && dayIso(e.start) === iso && NO_SCHOOL.test(String(e.summary || "")) && coversBoy(e.summary, boy);
    });
  }
  function rawOf(ev, raws) {
    var r = (raws || []).filter(function (x) { return x && x.id != null && x.id === ev.id; })[0] || ev;
    var o = {}; for (var k in r) o[k] = r[k];
    o.allDay = isAll(r); o.summary = r.summary || ev.summary || ""; o.start = r.start || ev.start; o.id = r.id != null ? r.id : ev.id;
    if (r.description == null && ev.description) o.description = ev.description;
    return o;
  }
  function showOf(fn, summary) {
    try { return String((fn ? fn(summary) : summary) || "").replace(/\s+/g, " ").trim(); } catch (e) { return ""; }
  }
  function stripName(body, name) {
    return String(body || "").replace(new RegExp("\\b" + name + "\\b(?:['\u2019]s)?", "ig"), " ")
      .replace(/\s*·?\s*\bleave\s+\d{1,2}:\d\d\s*[ap]?\.?m?\.?(?:\s*ET)?/ig, " ")
      .replace(/^[\s·:,-]+|[\s·:,-]+$/g, "").replace(/\s{2,}/g, " ").trim();
  }

  function pack(why, feed, lines, active) {
    return { active: !!active, why: active ? "on" : why, feed: feed, lines: lines || [], moonSet: !!active };
  }

  /* schoolMorning(o): the 6:30 school-morning sequence.
     o: { nowMs, away, cal, raws, keepItem(ev, nowMs), find(raw, raws), show(summary), allow(ev), rules }
     Away (caller, from away-filter.js) returns no lines. A missing cal is empty and feed "missing".
     Leave is spoken only when find() (leaveby.js) returns one. Anything else uses the event's own start. */
  function schoolMorning(o) {
    o = o || {};
    var nowMs = +o.nowMs;
    if (!isFinite(nowMs)) return pack("missing", "missing", [], false);
    var feed = o.cal ? "live" : "missing";
    if (o.away) return pack("away", feed, [], false);
    if (!o.cal) return pack("missing", "missing", [], false);
    var ct = parts(nowMs), list = rows(o.cal), R = o.rules || null;
    if (ct.dow === 0 || ct.dow === 6) return pack("weekend", feed, [], false);
    if (ct.min < START_MIN) return pack("before", feed, [], false);
    if (typeof o.keepItem === "function") {
      var probe = { summary: "Hayes practice", start: new Date(nowMs).toISOString() };
      try { if (o.keepItem(probe, nowMs) === false) return pack("held", feed, [], false); } catch (e) { /* a thrown filter hides logistics */ return pack("held", feed, [], false); }
    }
    var open = BOYS.filter(function (b) { return !noSchool(list, b, ct.iso); });
    if (!open.length) return pack("noschool", feed, [], false);
    var find = typeof o.find === "function" ? o.find : null;
    var raws = o.raws || list;
    var lines = [];
    open.forEach(function (boy) {
      var best = null, bestAt = Infinity;
      list.forEach(function (e) {
        if (!e || isAll(e)) return;
        var s = String(e.summary || "");
        if (!namesKid(R, boy, s)) return;
        if (o.allow && !o.allow(e)) return;
        var sm = at(e.start), em = at(e.end || e.start);
        if (!sm || dayIso(e.start) !== ct.iso || parts(sm).min >= 12 * 60) return;
        if (em && em <= nowMs) return;
        if (typeof o.keepItem === "function" && o.keepItem(e, nowMs) === false) return;
        if (sm < bestAt) { bestAt = sm; best = e; }
      });
      if (!best) return;
      var shown = showOf(o.show, best.summary);
      if (!shown) return;
      var lb = null;
      if (find) { try { lb = find(rawOf(best, raws), raws.map(function (r) { return rawOf(r, raws); })); } catch (e2) { lb = null; } }
      var leaveMs = lb && lb.leave ? +new Date(lb.leave) : 0;
      if (leaveMs > nowMs && parts(leaveMs).iso === ct.iso) {
        lines.push({ kid: boy, leave: true, at: leaveMs, text: NAME[boy] + " \u00b7 Leave " + t12(leaveMs) });
        return;
      }
      var body = stripName(shown, NAME[boy]);
      if (body) body = body.charAt(0).toUpperCase() + body.slice(1);
      var text = body ? (NAME[boy] + " \u00b7 " + body + " " + t12(bestAt)) : (NAME[boy] + " \u00b7 " + t12(bestAt));
      if (/\bleave\b/i.test(text)) return;
      lines.push({ kid: boy, leave: false, at: bestAt, text: text });
    });
    var end = END_MIN;
    lines.forEach(function (ln) { var m = parts(ln.at).min; if (m + 15 > end) end = Math.min(END_CAP, m + 15); });
    if (ct.min >= end) return pack("after", feed, [], false);
    return pack("on", feed, lines, true);
  }

  /* pressCopy: the long-press line. Away days stay word-free for kid, candle and stone lines.
     Guest mode drops a Dan-only candle or stone line. Voice is not part of this string. */
  function pressCopy(key, ctx) {
    ctx = ctx || {};
    if (ctx.away && (key === "window" || key === "candle" || key === "stone" || key === "morning")) return "";
    if (ctx.audience === "guest" && ctx.danOnly && (key === "candle" || key === "stone")) return "";
    if (key === "window" || key === "candle" || key === "stone") return String(ctx.line || "").trim();
    if (key === "cauldron") return String(ctx.line || "Chores").trim() || "Chores";
    if (key === "moon") return "Moon clock";
    if (key === "sign") return "The Ward's";
    if (key === "dad") return "Dad";
    return "";
  }

  function audienceFrom(query, stored) {
    if (MODES[query]) return query;
    if (MODES[stored]) return stored;
    return "kids";
  }
  /* tap: kids -> guest, guest or dan -> kids. hold: dan. Never chosen from the clock. */
  function cycleAudience(current, gesture) {
    if (gesture === "hold") return "dan";
    if (current === "guest" || current === "dan") return "kids";
    return "guest";
  }
  function audienceLabel(mode) { return mode === "kids" ? "Audience" : "Family"; }

  /* A Dad trip that does not name a kid is Dan-only. Kid trips he drives stay on the family glass.
     A partner "with <Name>" stays Dan-only even when a leave note follows the name, which keeps
     the shared-glass title from growing a "Dad:" prefix. */
  function danOnlyText(t) {
    t = String(t || "");
    if (/\b(ainsley|hayes|harris|boys|kids)\b/i.test(t)) return false;
    if (/^Dad:/.test(t)) return true;
    if (/\bDan\s*\+|^\s*Dan\s*\+|\+\s*Dan\b/.test(t)) return true;
    return /\bwith\s+(?!Dad\b|Daddy\b|Family\b|Friends\b|Team\b)[A-Z][a-z]+\b/.test(t);
  }

  var voice = {
    muted: true,
    reason: "text only until the same hook is proven on a Linux Chromium wall and on iOS Safari",
    speak: function () { return false; }
  };

  var api = {
    BOYS: BOYS, START_MIN: START_MIN, schoolMorning: schoolMorning, pressCopy: pressCopy,
    audienceFrom: audienceFrom, cycleAudience: cycleAudience, audienceLabel: audienceLabel,
    danOnlyText: danOnlyText, voice: voice, parts: parts
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LHLayer3 = api;
})(typeof window !== "undefined" ? window : this);
