/* CONSEQ1 · Chores MUSTS consequences block + PARK on/off · kids-safe · localStorage taps only
   Week = Sun→Sat. Counts closed days (before today) with Dad, from RULES_SINCE. No dollars, no fines. */
(function () {
  "use strict";
  var RULES_SINCE = "2026-09-30";
  var GAME_ONLY = { "hay-postgame": 1, "har-postgame": 1 }; /* miss only on practice/game days · Dad calls it */

  function isoAdd(iso, n) {
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2], 12);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dow(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12).getDay(); }
  function sunOf(iso) { return isoAdd(iso, -dow(iso)); }

  function tapped(W, data, id, iso) {
    try { return !!W.loadKeyState(W.checkKeyFor(id, data, iso))[id]; } catch (e) { return false; }
  }

  function kidState(kidId) {
    var W = window.WardKids, data = W && W._data;
    if (!data || !data.kids || !data.kids[kidId]) return null;
    var today = W.DAY_ISO;
    var hw = data.homeWeek || {};
    var withDad = String(hw.with || "") === "Dad";
    var dadDays = {};
    (W.weekDayIsos(today) || []).forEach(function (d) { dadDays[d] = 1; });
    var qs = (data.kids[kidId].quests || []).filter(function (q) { return !q.optional && q.cadence !== "addon"; });
    var daily = qs.filter(function (q) { return q.cadence === "daily" && !GAME_ONLY[q.id]; });
    var weekly = qs.filter(function (q) { return q.cadence === "weekly"; });

    function runWeek(sun, carryPark) {
      var counts = {}, total = 0, park = !!carryPark, lock = false, everPark = !!carryPark, lastDay = null;
      for (var i = 0; i < 7; i++) {
        var d = isoAdd(sun, i);
        if (d >= today || d < RULES_SINCE || !withDad || !dadDays[d]) continue;
        var missed = daily.filter(function (q) { return !(q.since && d < q.since) && !tapped(W, data, q.id, d); });
        lastDay = { iso: d, misses: missed.length };
        if (!missed.length) { if (park && !lock) park = false; continue; }
        missed.forEach(function (q) {
          counts[q.id] = (counts[q.id] || 0) + 1;
          if (counts[q.id] >= 2) { park = true; everPark = true; }
        });
        total += missed.length;
        if (total >= 3) { lock = true; park = true; everPark = true; }
      }
      return { total: total, park: park, lock: lock, everPark: everPark, lastDay: lastDay };
    }
    var sun = sunOf(today);
    var prevSat = isoAdd(sun, -1);
    var prev = runWeek(isoAdd(sun, -7), false);
    var weekliesDone = weekly.every(function (q) { return tapped(W, data, q.id, prevSat); });
    var carry = prev.lock && !weekliesDone;
    var cur = runWeek(sun, carry);
    return { kid: kidId, total: cur.total, park: cur.park, lock: cur.lock, sitOff: cur.everPark, lastDay: cur.lastDay };
  }

  var CSS = ".csq{margin-top:14px;padding:14px 16px;border-radius:14px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);font-size:15px;line-height:1.35}" +
    ".csq h4{margin:0 0 6px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.8}" +
    ".csq .csq-rules{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0 0 12px}" +
    ".csq .csq-rules b{letter-spacing:.08em;font-size:12px;text-transform:uppercase;opacity:.75;padding-top:2px}" +
    ".csq .csq-pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}" +
    ".csq-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;font-weight:800;font-size:15px;letter-spacing:.04em}" +
    ".csq-pill.on{background:#1f9d55;color:#fff}.csq-pill.off{background:#c0392b;color:#fff}" +
    ".csq-pill .dot{width:10px;height:10px;border-radius:50%;background:#fff}" +
    ".csq .csq-meta{font-size:13px;opacity:.85}" +
    ".csq-strip{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 14px;margin:8px 0;border-radius:12px;background:rgba(0,0,0,.35);font-size:14px}" +
    ".csq-strip .csq-name{font-weight:800;margin-left:6px}.csq-strip .csq-pill{padding:5px 10px;font-size:13px}.csq-strip .csq-rule{opacity:.85}";

  function pill(label, on) {
    return '<span class="csq-pill ' + (on ? "on" : "off") + '"><span class="dot"></span>' + label + " " + (on ? "ON" : "OFF") + "</span>";
  }
  function pillsFor(s) {
    if (s.kid === "ainsley") return pill("Sit jobs", !s.sitOff) + pill("Later-out", !s.park);
    return pill("After-dinner extra", !s.park);
  }
  function parkLine(s) {
    var p = s.kid === "ainsley" ? (s.park || s.sitOff) : s.park;
    return '<span class="csq-pill ' + (p ? "off" : "on") + '"><span class="dot"></span>PARK ' + (p ? "ON" : "OFF") + "</span>";
  }
  function metaFor(s) {
    var t = "Misses this week: " + Math.min(s.total, 3) + " of 3";
    if (s.lock) t += " · PARK through Saturday";
    else if (s.park) t += " · unlock: next full daily grid by close";
    if (s.kid === "ainsley" && s.sitOff) t += " · sit jobs back next week";
    if (s.lastDay && s.lastDay.misses) t += " · yesterday = no jar mark";
    return t;
  }

  function rulesHtml(kidId) {
    var park = kidId === "ainsley"
      ? "<b>Park</b><span>Sit jobs OFF this week · Later-out OFF</span>"
      : "<b>Park</b><span>After-dinner extra OFF (friends / trampoline / one-more)</span>";
    var unlock = kidId === "ainsley"
      ? "<b>Unlock</b><span>Later-out: next full daily grid by close. Sit: next week, musts current, Dad books.</span>"
      : "<b>Unlock</b><span>Next full daily grid by close.</span>";
    return '<div class="csq-rules">' +
      "<b>Musts</b><span>Done or not. No almost.</span>" +
      "<b>Close</b><span>Out the door or in bed. Not after.</span>" +
      "<b>Miss</b><span>That day = no jar mark.<br>2nd time same must this week = PARK.<br>3 misses this week = PARK through Saturday.</span>" +
      park + unlock + "</div>";
  }

  function render() {
    var W = window.WardKids;
    if (!W || !W._data) return;
    var kidId = document.body.getAttribute("data-kid");
    var mount = document.querySelector("[data-consequences]");
    if (!mount) return;
    if (mount.getAttribute("data-consequences") === "all") {
      mount.innerHTML = '<span class="csq-rule"><b>MUSTS</b> done or not · <b>CLOSE</b> out the door or in bed · 2nd same miss or 3 misses = <b>PARK</b></span>' +
        ["hayes", "harris", "ainsley"].map(function (k) {
          var s = kidState(k); if (!s) return "";
          var n = W._data.kids[k].name;
          return '<span class="csq-name">' + n + "</span>" + pillsFor(s);
        }).join("");
      return;
    }
    var s = kidState(kidId);
    if (!s) return;
    mount.innerHTML = "<h4>Rules · Sun–Sat week</h4>" + rulesHtml(kidId) +
      '<div class="csq-pills">' + parkLine(s) + pillsFor(s) + "</div>" +
      '<div class="csq-meta">' + metaFor(s) + "</div>";
  }

  function boot() {
    if (!document.getElementById("csq-css")) {
      var st = document.createElement("style"); st.id = "csq-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    render();
  }
  ["house:kids-data-ready", "house:kid-rendered", "house:cleared", "house:earn"].forEach(function (ev) {
    document.addEventListener(ev, function () { setTimeout(render, 50); });
  });
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-check]")) setTimeout(render, 150); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  setTimeout(render, 1200);
  window.HouseConsequences = { kidState: kidState, render: render, RULES_SINCE: RULES_SINCE };
})();
