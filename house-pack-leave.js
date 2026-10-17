/* PACKLEAVE1 · Pack board leave line. Shows the next real leave from the live calendar feed (kids-week.json
   boardStrip.nextLeave, the generator's leave-by flag, same source as the hub Dad card). No leave event, a past
   one, or no feed: the slot stays empty. Never a default day or time. */
(function (global) {
  "use strict";
  var TZ = "America/Chicago";

  function startMs(it) {
    var t = it && Date.parse(it.startIso || "");
    return isFinite(t) ? t : NaN;
  }
  function ctParts(ms) {
    try {
      var f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" });
      var o = {};
      f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
      return { day: o.year + "-" + o.month + "-" + o.day, dow: o.weekday, time: o.hour + ":" + o.minute + (o.dayPeriod ? " " + o.dayPeriod : "") };
    } catch (e) { return null; }
  }

  /* week: kids-week.json; returns null or { day, time, what } from a real future leave event */
  function pick(week, nowMs) {
    var bs = week && week.boardStrip;
    if (!bs) return null;
    var cands = [];
    if (bs.nextLeave) cands.push(bs.nextLeave);
    (bs.queue || []).forEach(function (q) { if (q && q.leaveBy === true) cands.push(q); });
    var now = nowMs == null ? Date.now() : nowMs;
    var best = null;
    cands.forEach(function (it) {
      if (!it || it.allDay || it.leaveBy !== true) return;
      var ms = startMs(it);
      if (!(ms > now)) return;
      if (!best || ms < startMs(best)) best = it;
    });
    if (!best) return null;
    var p = ctParts(startMs(best)), n = ctParts(now);
    if (!p || !n) return null;
    return { day: p.day === n.day ? "Today" : p.dow, time: p.time, what: String(best.place || "").trim() };
  }

  function show(el, on) {
    if (!el) return;
    if (on) { el.removeAttribute("hidden"); el.style.display = ""; }
    else { el.textContent = ""; el.setAttribute("hidden", ""); el.style.display = "none"; }
  }
  function paint(doc, week, nowMs) {
    var t = doc.querySelector("[data-pack-leave]");
    var w = doc.querySelector("[data-pack-leave-what]");
    var r = pick(week, nowMs);
    if (!r) { show(t, false); show(w, false); return r; }
    if (t) { t.textContent = "Next leave · " + r.day + " " + r.time; show(t, true); }
    if (w) { w.textContent = r.what; show(w, !!r.what); }
    return r;
  }

  global.HousePackLeave = { pick: pick, paint: paint };
  if (typeof document === "undefined" || typeof fetch !== "function") return;
  function load() {
    fetch("kids-week.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (wk) { paint(document, wk); })
      .catch(function () { paint(document, null); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
  setInterval(load, 5 * 60 * 1000);
})(typeof window !== "undefined" ? window : globalThis);
