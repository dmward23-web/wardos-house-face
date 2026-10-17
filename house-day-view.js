/* DAYVIEW1 · sheet-today.html?d=YYYY-MM-DD shows that day (from data/cal-months.json + data/cal-live.json).
   No ?d, or ?d = today → the normal Today sheet, untouched. */
(function () {
  "use strict";
  var m = /[?&]d=(\d{4}-\d{2}-\d{2})/.exec(location.search);
  if (!m) return;
  var iso = m[1];
  var today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  if (iso === today) return;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clean(s) {
    s = String(s || "").replace(/\[[^\]]*\]/g, " ").replace(/#[A-Za-z0-9_-]+/g, " ")
      .replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,}\b/g, " ").replace(/\(\s*\)/g, " ");
    /* PRIVFEED1 · the co-parent name is scrubbed on the box (cal-months.py THEIRMOM1); no name lives here */
    return s.replace(/\s+/g, " ").replace(/\s+·/g, " ·").replace(/\s*·\s*$/g, "").trim();
  }
  function shift(d, n) { var t = new Date(d + "T12:00:00"); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); }
  function hm(s) { var x = /T(\d\d):(\d\d)/.exec(s || ""); if (!x) return ""; var h = +x[1]; return (h % 12 || 12) + ":" + x[2] + (h < 12 ? "a" : "p"); }
  var nice = new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  document.title = "House · " + nice;

  function mount(months, live) {
    var panel = document.querySelector(".panel");
    if (!panel) return;
    var st = document.createElement("style");
    st.textContent = "html.day-view-on .panel > .gm, html.day-view-on .panel > .wx-card, html.day-view-on .panel > .body, html.day-view-on .panel > .leaveby, html.day-view-on .panel .leaveby, html.day-view-on .panel > .ftr { display: none !important; }";
    document.head.appendChild(st); document.documentElement.classList.add("day-view-on");
    var chip = document.querySelector("[data-sheet-chip]"); if (chip) chip.textContent = "Day";
    var day = months && months.days && months.days[iso];
    var rows = [];
    var timed = ((live && live.upcomingLeaves) || []).filter(function (x) { return x && x.start && x.start.slice(0, 10) === iso && !x.allDay; });
    timed.forEach(function (x) { rows.push({ t: hm(x.start), l: clean(x.summary), w: clean((x.location || "").split(",")[0]) }); });
    var seen = rows.map(function (r) { return r.l.toLowerCase().slice(0, 18); });
    ((day && day.items) || []).forEach(function (it) {
      var l = clean(it.l); if (!l) return;
      if (seen.indexOf(l.toLowerCase().slice(0, 18)) >= 0) return;
      rows.push({ t: "", l: l, w: "", c: it.c });
    });
    var sec = document.createElement("section");
    sec.className = "sec day-view"; sec.setAttribute("data-day-view", iso); sec.setAttribute("aria-label", nice);
    sec.style.cssText = "margin:12px 0;display:flex;flex-direction:column;gap:10px";
    var html = '<div class="sec-hdr" style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
      '<a class="dv-nav" data-dv="prev" href="sheet-today.html?d=' + shift(iso, -1) + '" aria-label="Previous day" style="min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;text-decoration:none;color:inherit">‹</a>' +
      '<div style="text-align:center"><div class="sec-title" style="font-size:22px">' + esc(nice) + '</div>' +
      '<div class="sec-meta">' + (day && day.withDan ? "Kids with Dad" : "") + '</div></div>' +
      '<a class="dv-nav" data-dv="next" href="sheet-today.html?d=' + shift(iso, 1) + '" aria-label="Next day" style="min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;text-decoration:none;color:inherit">›</a></div>';
    if (!rows.length) html += '<div style="padding:16px;opacity:.75">Nothing on the calendar.</div>';
    rows.forEach(function (r) {
      html += '<div class="dv-row" style="display:flex;gap:12px;align-items:baseline;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.06)">' +
        '<span style="min-width:52px;font-weight:800;font-variant-numeric:tabular-nums">' + esc(r.t || "·") + '</span>' +
        '<span style="flex:1"><span style="display:block;font-weight:650">' + esc(r.l) + '</span>' + (r.w ? '<span style="display:block;opacity:.65;font-size:13px">' + esc(r.w) + '</span>' : "") + '</span></div>';
    });
    html += '<div style="display:flex;gap:10px;justify-content:center;padding-top:4px">' +
      '<a href="month.html#' + iso.slice(0, 7) + '" style="min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border-radius:22px;border:1px solid rgba(255,255,255,.3);color:inherit;text-decoration:none">Month</a>' +
      '<a href="sheet-today.html" style="min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border-radius:22px;border:1px solid rgba(255,255,255,.3);color:inherit;text-decoration:none">Today</a></div>';
    sec.innerHTML = html;
    var hdr = panel.querySelector("header");
    if (hdr && hdr.nextSibling) panel.insertBefore(sec, hdr.nextSibling); else panel.appendChild(sec);
  }
  function get(u) { return fetch(u + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function go() { Promise.all([get("data/cal-months.json"), get("data/cal-live.json")]).then(function (p) { mount(p[0], p[1]); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
