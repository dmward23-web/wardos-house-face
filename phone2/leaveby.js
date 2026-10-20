/* PHONE2 · LeaveBy: the real leave-by time for a calendar event, read from the RAW calendar text (before any display cleaning).
   Shared helper (LIVING HOUSE can reuse it): window.LeaveBy, or module.exports under Node.
   Source of truth is the event's own words, never a guess:
     1. the event's raw summary/description says "leave H:MM" -> that time (source "self")
     2. else an all-day parent (trip) whose date range covers the event carries legs like "AAA 3:30p→BBB · leave 2:10";
        the leg whose departure equals the event start gives the leave-by (source "parent"). "ET" after a leave marks both
        leg times as Eastern; they are converted to the board zone (America/Chicago, ET = CT + 1h).
     3. else null (callers then label the start truthfully, e.g. "Departs 3:30").
   AM/PM: a bare "leave 2:10" is taken as the latest reading at or before the departure, within 6 hours of it.
   API: LeaveBy.find(rawEvent, rawEvents) -> { leave: Date, depart: Date, source: "self"|"parent", parentId } | null
        LeaveBy.fmt(date) -> "2:10" */
(function (root) {
  "use strict";
  var LEAVE = /\bleave\s+(\d{1,2}):(\d\d)\s*([ap])?\.?m?\b(\s*ET\b)?/i;
  var LEG = /(\d{1,2}):(\d\d)\s*([ap])\b[^·]*?(?:→|->)[^·]*?·\s*leave\s+(\d{1,2}):(\d\d)\s*([ap])?\.?m?\b(\s*ET\b)?/gi;
  function at(base, h, m, ap) { var d = new Date(base); if (ap) { h = h % 12 + (/p/i.test(ap) ? 12 : 0); } d.setHours(h, m, 0, 0); return d; }
  function bestBefore(base, h, m, ap, ref) {
    if (ap) return at(base, h, m, ap);
    var a = at(base, h % 12, m), b = at(base, h % 12 + 12, m), win = 6 * 36e5;
    var ok = [b, a].filter(function (d) { return d <= ref && ref - d <= win; });
    return ok[0] || null;
  }
  function text(e) { return String((e && e.summary) || "") + " " + String((e && e.description) || ""); }
  function fmt(d) { var h = d.getHours() % 12 || 12, m = d.getMinutes(); return h + ":" + (m < 10 ? "0" : "") + m; }
  function find(ev, all) {
    if (!ev || ev.allDay) return null;
    var start = new Date(ev.start); if (isNaN(start)) return null;
    var m = text(ev).match(LEAVE);
    if (m) {
      var l = bestBefore(start, +m[1], +m[2], m[3], start);
      if (m[4] && l) l = new Date(l.getTime() - 36e5);
      /* the event's own departure, if its raw text names one ("6:00p–7:35p", "3:30p→BBB"); else its start */
      var fm = text(ev).match(/(\d{1,2}):(\d\d)\s*([ap])\s*(?:[\u2013-]|→|->)/i), dep = fm ? at(start, +fm[1], +fm[2], fm[3]) : start;
      if (l) return { leave: l, depart: dep, source: "self", parentId: null };
    }
    var pars = (all || []).filter(function (p) {
      if (!p || !p.allDay || p.id === ev.id) return false;
      var a = new Date(p.start), b = new Date(p.end || p.start); return a <= start && start < b;
    });
    for (var i = 0; i < pars.length; i++) {
      var t = text(pars[i]), g; LEG.lastIndex = 0;
      while ((g = LEG.exec(t))) {
        var et = !!g[7], shift = et ? 36e5 : 0;
        var dep = new Date(at(start, +g[1], +g[2], g[3]).getTime() - shift);
        if (Math.abs(dep - start) > 60e3) continue;
        var lv = bestBefore(new Date(start.getTime() + shift), +g[4], +g[5], g[6], new Date(start.getTime() + shift));
        if (!lv) continue;
        return { leave: new Date(lv.getTime() - shift), depart: start, source: "parent", parentId: pars[i].id };
      }
    }
    return null;
  }
  var api = { find: find, fmt: fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LeaveBy = api;
})(typeof window !== "undefined" ? window : this);
