/* QARELAY1 · hub tile micro-rows bound to kids-week.json at runtime (Today / Week / Dad Seat / kid tiles).
   Replaces day-locked HTML rows. Day-lagged data → hide the micro rows rather than show stale facts.
   RIDES law: kid tiles never show Dad logistics (kind leave/ride, "Pick up …"/"Drop …"). */
(function () {
  "use strict";
  /* SCHOOLNAMES1 · the school code / name never live in git: "§" = role "school" tokens, "¶" = full names, from school-names.js
     (private runtime source; none known = the school part of the pattern matches nothing). */
  var SCHRX = function (src, flags) {
    var S = (typeof globalThis !== "undefined" ? globalThis : window).SchoolNames;
    return S ? S.rx(src, flags) : new RegExp(String(src).split("§").join("(?!)").split("¶").join("(?!)"), flags || "");
  };
  var TZ = "America/Chicago";
  function ctDate(d) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    } catch (e) { return ""; }
  }
  function faceDash(s) { return String(s == null ? "" : s).replace(/\bMOVED\s*[\u2192\u21d2\u27a1]\s*/gi, "moved to ").replace(/\s*[\u2192\u21d2\u27a1]\s*/g, " to ").replace(/\s*\u2014\s*/g, " \u00b7 ").replace(/(\s*\u00b7\s*){2,}/g, " \u00b7 ").replace(/^\s*\u00b7\s*|\s*\u00b7\s*$/g, ""); } /* NODATA3 · no em dashes or arrows on the face */
  function esc(s) {
    return faceDash(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function row(mt, md, chip, tone) {
    return '<div class="tile-mrow"><span class="mt">' + esc(mt) + '</span><span class="md">' + esc(md) + "</span>" +
      (chip ? '<span class="tile-mchip' + (tone ? " " + tone : "") + '">' + esc(chip) + "</span>" : "") + "</div>";
  }
  function isDadLogistics(it) {
    if (!it) return false;
    if (it.kind === "leave" || it.kind === "ride") return true;
    return /^(Pick\s*-?\s*up|Drop|Leave)\b/i.test(String(it.summary || it.place || it.what || "").trim());
  }
  function stripKid(s) {
    return String(s || "").replace(/^(?:(?:Ainsley|Hayes|Harris|Boys)\s*(?:\+\s*)?)+\s*[—–\-:·]\s*/i, "").trim();
  }
  var KID_RE = {
    hayes: /\bhayes\b|\bboys\b/i,
    harris: /\bharris\b|\bboys\b/i,
    ainsley: /\bainsley\b/i
  };
  /* Hub is a shared house screen: appointments show as "appointment", never provider detail. */
  var APPT_RE = /therap|counsel|doctor|dentist|ortho|pediatric|clinic|\bappt\b/i;
  function isAppt(it) { return it && (it.kind === "appointment" || APPT_RE.test(String(it.summary || it.place || it.what || ""))); }
  function micro(sel) {
    var tile = document.querySelector(sel);
    return tile ? tile.querySelector(".tile-micro") : null;
  }
  function setMicro(el, html) {
    if (!el) return;
    if (html) { el.innerHTML = html; el.removeAttribute("hidden"); el.setAttribute("data-bound", "QARELAY1"); }
    else { el.innerHTML = ""; el.setAttribute("hidden", ""); }
  }

  function paint(week) {
    var now = Date.now();
    var today = ctDate(new Date());
    var lagged = !week || (week.asOfIso && today && week.asOfIso !== today);
    var tiles = [".tile.today", ".tile.week", ".tile.dan", ".tile[data-kid-seed='ainsley']",
      ".tile[data-kid-seed='hayes']", ".tile[data-kid-seed='harris']"];
    if (lagged) { tiles.forEach(function (s) { setMicro(micro(s), ""); }); return; }

    var queue = ((week.boardStrip && week.boardStrip.queue) || []).filter(function (it) {
      var end = Date.parse(it.endIso || "") || 0;
      var start = Date.parse(it.startIso || "") || 0;
      if (it.allDay) return false; /* ALLDAY1: all-day notes are not timed rows */
      if (end && end < now) return false;
      if (!end && start && start + 90 * 60 * 1000 < now) return false;
      return true;
    });
    function isToday(it) { return it.startIso && ctDate(new Date(it.startIso)) === today; }
    function mtFor(it) { return isToday(it) ? (it.time || "") : (String(it.badge || "").toUpperCase() + (it.time ? " " + it.time : "")); }
    function titleOf(it) {
      if (isAppt(it)) {
        var who = (String(it.summary || "").match(/^(Ainsley|Hayes|Harris)\b/) || [])[1];
        return (who ? who + " · " : "") + "appointment";
      }
      return stripKid(it.place || it.summary || "");
    }

    /* LAW8C1 + NOCUSTODY · on away days the kid tiles render nothing. AWAYONE1 (Atlas): away has ONE source of truth,
       away-filter.js on cal-months withDan (AwayFilter.awayUntil); no kids-week path. */
    var AF = typeof window !== "undefined" ? window.AwayFilter : null;
    var awayUntil = AF && AF.hasMonths && AF.hasMonths() ? AF.awayUntil(AF.now()) : 0;
    var away = awayUntil > 0;
    paintAway(away ? awayUntil : 0);

    /* Kid tiles */
    ["ainsley", "hayes", "harris"].forEach(function (id) {
      var re = KID_RE[id];
      var mine = queue.filter(function (it) {
        if (isDadLogistics(it) || isAppt(it)) return false;
        var blob = (it.summary || "") + " " + (it.place || "");
        if (id === "harris" && /\bhayes\b/i.test(blob) && !/\bharris\b|\bboys\b/i.test(blob)) return false;
        if (id === "hayes" && /\bharris\b/i.test(blob) && !/\bhayes\b|\bboys\b/i.test(blob)) return false;
        return re.test(blob) || (id !== "ainsley" && SCHRX(String.raw`\b§\b`, "").test(blob) && /\bhayes \+ harris\b|\bboys\b/i.test(blob)) ||
          /* SCHOOLKEY2 · generator-tagged school run with no boy named = both boys, with or without the private names */
          (id !== "ainsley" && /^school_(drop|pickup)$/.test(String(it.kind || "")) && !/\bhayes\b|\bharris\b/i.test(blob));
      }).slice(0, 3);
      var html = mine.map(function (it, i) {
        return row(mtFor(it), titleOf(it), i === 0 ? (isToday(it) ? "Next" : "Up next") : "", i === 0 ? "amber" : "");
      }).join("");
      setMicro(micro(".tile[data-kid-seed='" + id + "']"), html);
    });

    /* Today tile · remaining today */
    var todayItems = queue.filter(isToday);
    var th = todayItems.slice(0, 3).map(function (it, i) {
      return row(it.time || "", isAppt(it) ? titleOf(it) : (it.place || it.summary || ""), i === 0 ? "Next" : "", i === 0 ? "amber" : "");
    }).join("");
    if (!th) th = row("EVE", "Nothing left today", "Clear", "green");
    else if (todayItems.length > 3) th += row("+" + (todayItems.length - 3), "more today", "", "");
    setMicro(micro(".tile.today"), th);

    /* Week tile · next 4 days from the week list */
    var dan = (week.kids && week.kids.dan) || {};
    var days = [];
    var byDay = {};
    (dan.week || []).forEach(function (r) {
      var key = String(r.when || "").split("·")[0].trim();
      if (!key) return;
      if (!byDay[key]) { byDay[key] = []; days.push(key); }
      byDay[key].push(isAppt(r) ? "appointment" : String(r.what || "").trim());
    });
    var todayDow = "";
    try { todayDow = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date()); } catch (e) { /* */ }
    var wh = days.slice(0, 4).map(function (k) {
      var dow = k.split(" ")[0].toUpperCase();
      var list = byDay[k];
      var md = list.slice(0, 2).map(stripKid).join(" · ") + (list.length > 2 ? " +" + (list.length - 2) : "");
      var isNow = todayDow && k.indexOf(todayDow) === 0;
      return row(dow, md, isNow ? "Now" : "", isNow ? "amber" : "");
    }).join("");
    setMicro(micro(".tile.week"), wh);

    /* SEATS1 · Dad card = kid card face: big next leave-by + next two after it */
    var stage = document.querySelector(".tile.dan [data-dad-stage]");
    if (stage) {
      /* NEXTLEAVE1 · "Next leave" is the first REAL leave/drop (generator flag leaveBy), never queue[0]:
         the 7:00 school specials note and all-day notes are not leaves. Older data without the flag: same rule by kind. */
      var isLeave = function (it) {
        if (!it || it.allDay) return false;
        if (typeof it.leaveBy === "boolean") return it.leaveBy;
        var t = String(it.summary || it.place || "");
        if (SCHRX(String.raw`§ specials?`, "i").test(t)) return false;
        return /^(leave|school_drop|school_pickup|sport|appointment)$/.test(String(it.kind || "")) || /\b(pick\s*-?\s*up|drop(\s*-?\s*off)?|leave)\b/i.test(t);
      };
      var leaves = away ? [] : queue.filter(isLeave); /* LAW8C1 · away days: Dad's card is Dad's own next thing */
      var first = leaves[0];
      var dd = '<div class="kf-face kf-day"><div class="kf-kicker">Next leave</div>';
      if (!first) {
        /* LAW8C1 · never an empty "Clear · Nothing queued" card: Dad's own next calendar stop (cal-live, already kid/away-filtered) */
        var own = dadNext(now);
        if (own) {
          dd = '<div class="kf-face kf-day"><div class="kf-kicker">Up next</div>';
          dd += '<div class="kf-loud">' + esc(own.mt) + "</div>";
          dd += '<div class="kf-title">' + esc(own.title) + "</div>";
        } else {
          dd = '<div class="kf-face kf-day"><div class="kf-kicker">Dad</div><div class="kf-loud">Calendar</div>';
        }
      } else {
        var dow = isToday(first) ? "TODAY" : String(first.badge || "").toUpperCase();
        dd += '<div class="kf-loud">' + esc((dow ? dow + " · " : "") + (first.time || "")) + "</div>";
        dd += '<div class="kf-title">' + esc(titleOf(first)) + "</div>";
        var rest = leaves.slice(1, 3);
        if (rest.length) {
          dd += '<div class="kf-rows">' + rest.map(function (it) {
            return '<div class="kf-row"><span class="kf-mt">' + esc(mtFor(it)) + '</span><span class="kf-md">' + esc(titleOf(it)) + "</span></div>";
          }).join("") + "</div>";
        }
      }
      stage.innerHTML = dd + "</div>";
    } else {
      var dh = queue.slice(0, 2).map(function (it, i) {
        return row(mtFor(it), "Leave-by · " + titleOf(it), i === 0 ? "Next" : "", i === 0 ? "amber" : "");
      }).join("");
      dh += row("WK", "Week command board", "", "");
      setMicro(micro(".tile.dan"), dh);
    }
  }

  /* LAW8C1 helpers */
  var CAL = null;
  function dadNext(now) {
    var l = (CAL && CAL.upcomingLeaves) || [];
    var H = window.HouseBoardStrip || window.HouseStrip || null;
    for (var i = 0; i < l.length; i++) {
      var e = l[i]; if (!e || e.allDay) continue;
      var ms = Date.parse(e.start || "") || 0; if (ms <= now) continue;
      if (/\b(Harris|Hayes|Ainsley|Boys|Kids?)\b/i.test(String(e.summary || ""))) continue;
      var d = new Date(ms), isT = ctDate(d) === ctDate(new Date(now));
      var t = ""; try { t = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d); } catch (e1) { /* */ }
      var dow = ""; try { dow = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d).toUpperCase(); } catch (e2) { /* */ }
      var title = String(e.summary || "");
      if (H && typeof H.dayTitle === "function") title = H.dayTitle({ summary: title });
      return { mt: (isT ? "TODAY" : dow) + " · " + t, title: title };
    }
    return null;
  }
  function paintAway(untilMs) {
    /* NOCUSTODY (Atlas law): on away days the kid tiles render nothing and no line takes their place (no "back <day>"
       computed); the grid hides when nothing is left in it. */
    var grid = document.querySelector(".tile-grid");
    if (!grid) return;
    var kids = grid.querySelectorAll(".tile.ainsley,.tile.hayes,.tile.harris,.tile[data-kid-seed='ainsley'],.tile[data-kid-seed='hayes'],.tile[data-kid-seed='harris']");
    var old = grid.querySelector(".tile.kids-away"); if (old) old.remove();
    if (!untilMs) {
      kids.forEach(function (t) { t.removeAttribute("hidden"); t.style.removeProperty("display"); });
    } else {
      kids.forEach(function (t) { t.setAttribute("hidden", ""); t.style.setProperty("display", "none", "important"); });
    }
    if (!grid.children || !grid.style) return;
    var shown = Array.prototype.some.call(grid.children, function (c) { return !c.hidden && !(c.style && c.style.display === "none"); });
    if (shown) { grid.removeAttribute("hidden"); grid.style.removeProperty("display"); }
    else { grid.setAttribute("hidden", ""); grid.style.setProperty("display", "none", "important"); }
  }

  function load() {
    if (typeof fetch !== "function") return;
    fetch("data/cal-live.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) { if (c) CAL = c; })
      .catch(function () { /* Dad card falls back to its board line */ })
      .then(function () { return 0; })
      .then(function () {
    (typeof window !== "undefined" && window.AwayFilter && window.AwayFilter.ready ? window.AwayFilter.ready() : Promise.resolve()).then(function () {   /* AWAYONE1 · away state known before the first paint */
    fetch("kids-week.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (w) { var law = typeof window !== "undefined" && window.HouseFaceLaw; if (w && law) law.cleanKidsWeek(w); if (w) paint(w); }) /* LIVELAW1 */
      .catch(function () { /* keep static rows */ });
    });
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
  setInterval(load, 5 * 60 * 1000);
})();
