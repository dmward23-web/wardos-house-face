/* House Face · CTRLPANEL1 · kid flip · who’s up denser · daily quest · claim · streak · SFX
   LIVE only · WardKids · HUBTOK1 atoms. No leaveby/cam/nest/sensi JSON. */
(function (global) {
  "use strict";

  var KIDS = ["ainsley", "hayes", "harris"];
  var FACES = ["day", "stars", "chores", "leave"];
  var FACE_LABEL = { day: "Day", stars: "Stars", chores: "Chores", leave: "Leave" };
  var HREF = {
    ainsley: "kid-ainsley.html",
    hayes: "kid-hayes.html",
    harris: "kid-harris.html"
  };
  var ACCENT = {
    ainsley: { rail: "#f098d4", ink: "#e8a0d0", name: "Ainsley" },
    hayes: { rail: "#5ec8e8", ink: "#7dd3e8", name: "Hayes" },
    harris: { rail: "#7ed492", ink: "#8ad49a", name: "Harris" }
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function kidsSafe(s) {
    var t = String(s == null ? "" : s);
    t = t.replace(/\bCUSTODY\b/gi, "WITH DAD");
    t = t.replace(/\bcustody\b/gi, "Dad week");
    return t;
  }

  function sfxTap() {
    try {
      if (global.HouseSfx && typeof HouseSfx.unlockAudio === "function") HouseSfx.unlockAudio();
      if (global.HouseSfx && typeof HouseSfx.tap === "function") HouseSfx.tap();
    } catch (e) { /* */ }
  }

  function sfxQuest(el) {
    try {
      if (global.HouseSfx && typeof HouseSfx.unlockAudio === "function") HouseSfx.unlockAudio();
      if (global.HouseSfx && typeof HouseSfx.quest === "function") {
        /* questPop path via boom + quest tone */
        if (typeof HouseSfx.boomAt === "function" && el) HouseSfx.boomAt(el);
        HouseSfx.quest();
      } else if (global.HouseSfx && typeof HouseSfx.tap === "function") {
        HouseSfx.tap();
      }
    } catch (e) { /* */ }
  }

  function sfxFlip() {
    sfxTap();
  }

  function WK() {
    return global.WardKids || null;
  }

  function data() {
    var w = WK();
    return (w && w._data) || null;
  }

  function dayIso() {
    var w = WK();
    return (w && w.DAY_ISO) || "";
  }

  function addDaysIso(iso, days) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return "";
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    d.setDate(d.getDate() + days);
    function pad(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function kidObj(kidId) {
    var d = data();
    return (d && d.kids && d.kids[kidId]) || null;
  }

  function mustQuests(kidId) {
    var w = WK();
    if (w && typeof w.mustQuests === "function") return w.mustQuests(kidId, data()) || [];
    var kid = kidObj(kidId);
    if (!kid || !kid.quests) return [];
    return kid.quests.filter(function (q) {
      return !(q.optional || q.cadence === "addon");
    });
  }

  function getCheck(id, iso) {
    var w = WK();
    if (!w || typeof w.getCheck !== "function") return false;
    return !!w.getCheck(id, data(), iso || dayIso());
  }

  function setCheck(id, done, iso) {
    var w = WK();
    if (!w || typeof w.setCheck !== "function") return null;
    return w.setCheck(id, !!done, data(), iso || dayIso());
  }

  function mustProgress(kidId) {
    var w = WK();
    if (w && typeof w.mustProgress === "function") return w.mustProgress(kidId, data());
    return { done: 0, need: 0, complete: false };
  }

  function bankView(kidId) {
    var w = WK();
    if (w && typeof w.getBankView === "function") return w.getBankView(kidId, data());
    return null;
  }

  /** Honest LIVE streak: consecutive Chicago days where ALL daily musts were tapped. */
  function streakDays(kidId) {
    var qs = mustQuests(kidId).filter(function (q) {
      return (q.cadence || "daily") === "daily";
    });
    if (!qs.length) return 0;
    var today = dayIso();
    if (!today) return 0;

    function dayHit(iso) {
      for (var i = 0; i < qs.length; i++) {
        if (!getCheck(qs[i].id, iso)) return false;
      }
      return true;
    }

    var start = today;
    if (!dayHit(today)) start = addDaysIso(today, -1);
    var n = 0;
    var cur = start;
    for (var i = 0; i < 28; i++) {
      if (!dayHit(cur)) break;
      n += 1;
      cur = addDaysIso(cur, -1);
      if (!cur) break;
    }
    return n;
  }

  function todayMustProgress(kidId) {
    var qs = mustQuests(kidId).filter(function (q) {
      return (q.cadence || "daily") === "daily";
    });
    var weekly = mustQuests(kidId).filter(function (q) {
      return (q.cadence || "") === "weekly";
    });
    var done = 0;
    var need = qs.length + weekly.length;
    var iso = dayIso();
    qs.forEach(function (q) { if (getCheck(q.id, iso)) done += 1; });
    weekly.forEach(function (q) { if (getCheck(q.id)) done += 1; });
    return { done: done, need: need, complete: need > 0 && done >= need };
  }

  function whoInSummary(summary) {
    var s = String(summary || "");
    var out = [];
    if (/\bAinsley\b/i.test(s)) out.push("ainsley");
    if (/\bHayes\b/i.test(s)) out.push("hayes");
    if (/\bHarris\b/i.test(s)) out.push("harris");
    return out;
  }

  function shortTitle(summary) {
    var s = kidsSafe(String(summary || "").trim());
    s = s.replace(/^Leave\s*[·•\-–—]\s*/i, "");
    s = s.replace(/\(\s*Mom[^)]*\)/gi, "");
    s = s.replace(/\s{2,}/g, " ").trim();
    if (s.length > 48) s = s.slice(0, 45) + "…";
    return s;
  }

  /** Clean CT wall time · "8:10 AM" (HUBFMT1). */
  function clockFromIso(iso) {
    if (!iso) return "";
    try {
      if (global.HouseClock && HouseClock.timeLabel) {
        return HouseClock.timeLabel(new Date(iso));
      }
      var p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).formatToParts(new Date(iso)).forEach(function (x) {
        if (x.type !== "literal") p[x.type] = x.value;
      });
      var ap = p.dayPeriod ? (" " + p.dayPeriod) : "";
      return (p.hour || "") + ":" + (p.minute || "") + ap;
    } catch (e) {
      return "";
    }
  }

  /** Prefer ISO→CT; if bare "8:10" only, keep it (no invent AM/PM without ISO). */
  function cleanWallTime(time, iso) {
    var fromIso = clockFromIso(iso);
    if (fromIso) return fromIso;
    var s = String(time || "").trim();
    if (!s) return "";
    /* Already has AM/PM */
    if (/[ap]\.?m\.?/i.test(s)) return s.replace(/\s+/g, " ");
    /* Reject ISO / 24h junk on glass */
    if (/T\d{2}:|\d{4}-\d{2}-\d{2}/.test(s)) return clockFromIso(s) || "";
    return s;
  }

  function minsUntilIso(iso) {
    var t = Date.parse(iso || "");
    if (!Number.isFinite(t)) return null;
    return Math.round((t - Date.now()) / 60000);
  }

  function fmtLeave(mins) {
    if (mins == null) return "NEXT";
    if (mins <= 5) return "LEAVE · NOW";
    if (mins <= 45) return "LEAVE · " + mins + "m";
    if (mins <= 120) return "LEAVE · " + Math.round(mins / 5) * 5 + "m";
    return "UPCOMING";
  }

  /** Next leave/event for a kid from embedded boardStrip.queue or kid hottest. */
  function nextLeaveFor(kidId) {
    var d = data();
    var name = ACCENT[kidId] && ACCENT[kidId].name;
    var now = Date.now();
    var best = null;

    function consider(item) {
      if (!item) return;
      var start = Date.parse(item.startIso || item.start || "") || 0;
      var end = Date.parse(item.endIso || item.end || "") || 0;
      if (end && end < now) return;
      if (!end && start && start + 90 * 60 * 1000 < now) return;
      if (start && best && best.start && start >= best.start) return;
      if (start && best && !best.start) { /* prefer timed */ }
      else if (best && best.start && !start) return;
      best = {
        start: start || 0,
        startIso: item.startIso || item.start || "",
        time: cleanWallTime(item.time, item.startIso || item.start),
        badge: item.badge || "",
        title: shortTitle(item.place || item.summary || item.what || item.title || "Next up"),
        summary: shortTitle(item.summary || item.hint || "")
      };
    }

    var queue = (d && d.boardStrip && d.boardStrip.queue) || [];
    for (var i = 0; i < queue.length; i++) {
      var it = queue[i];
      var who = whoInSummary(it.summary || it.place || "");
      if (who.indexOf(kidId) >= 0 || (name && new RegExp("\\b" + name + "\\b", "i").test(it.summary || it.place || ""))) {
        consider(it);
      }
    }

    /* cal-live cache if board strip already painted it onto window */
    try {
      var calQ = global.__wardosCalLeaves;
      if (Array.isArray(calQ)) {
        for (var c = 0; c < calQ.length; c++) {
          var ev = calQ[c];
          var wh2 = whoInSummary(ev.summary || "");
          if (wh2.indexOf(kidId) < 0) continue;
          consider({
            startIso: ev.start,
            endIso: ev.end,
            summary: ev.summary,
            place: ev.summary,
            time: cleanWallTime("", ev.start)
          });
        }
      }
    } catch (e) { /* */ }

    if (!best) {
      var kid = kidObj(kidId);
      if (kid && kid.hottest) {
        return {
          start: 0,
          startIso: "",
          time: String(kid.hottest.when || "").split("·").pop().trim(),
          badge: String(kid.hottest.when || "").split("·")[0].trim(),
          title: shortTitle(kid.hottest.what || "Next up"),
          summary: shortTitle(kid.hottest.where || ""),
          source: "hottest"
        };
      }
    }
    return best;
  }

  function soonestWhoUp() {
    var best = null;
    for (var i = 0; i < KIDS.length; i++) {
      var id = KIDS[i];
      var leave = nextLeaveFor(id);
      if (!leave) continue;
      var score = leave.start || Number.MAX_SAFE_INTEGER;
      if (!best || score < best.score) {
        best = { kidId: id, leave: leave, score: score };
      }
    }
    return best;
  }

  function faceIndex(face) {
    var i = FACES.indexOf(face);
    return i < 0 ? 0 : i;
  }

  function paintFace(kidId, face) {
    var kid = kidObj(kidId) || { name: ACCENT[kidId].name };
    var accent = ACCENT[kidId];
    var html = "";

    if (face === "day") {
      var hot = kid.hottest || {};
      var todayBits = (kid.today || []).slice(0, 2);
      html += '<div class="kf-face kf-day">';
      html += '<div class="kf-kicker">Today</div>';
      html += '<div class="kf-loud">' + esc(hot.when || "Dad week") + "</div>";
      html += '<div class="kf-title">' + esc(shortTitle(hot.what || "On deck")) + "</div>";
      if (todayBits.length) {
        html += '<div class="kf-rows">';
        todayBits.forEach(function (row) {
          html += '<div class="kf-row"><span class="kf-mt">' + esc(row.when || "") +
            '</span><span class="kf-md">' + esc(shortTitle(row.what || "")) + "</span></div>";
        });
        html += "</div>";
      }
      html += "</div>";
      return html;
    }

    if (face === "stars") {
      var bank = bankView(kidId);
      var gate = mustProgress(kidId);
      var streak = streakDays(kidId);
      var sym = (bank && bank.currency && bank.currency.symbol) || "★";
      var week = bank ? bank.week : 0;
      var need = bank ? bank.need : 0;
      var pct = bank ? bank.pct : 0;
      var locked = bank && !bank.mustComplete;
      html += '<div class="kf-face kf-stars">';
      html += '<div class="kf-kicker">Stars · jar</div>';
      html += '<div class="kf-loud">' + esc(sym) + " " + esc(String(week)) +
        (need ? (" / " + esc(String(need))) : "") + "</div>";
      html += '<div class="kf-xp" aria-label="Must progress">';
      html += '<div class="kf-xp-fill" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></div>';
      html += "</div>";
      html += '<div class="kf-meta">' +
        (locked
          ? ("Musts " + gate.done + "/" + gate.need + " · jar locked")
          : ("Jar open · " + (bank && bank.weekEarn != null ? ("$" + bank.weekEarn) : "LIVE"))) +
        "</div>";
      html += '<div class="kf-streak streak-sparks" data-streak>' +
        (streak > 0 ? ("🔥 " + streak + "-day streak") : "🔥 Streak · tap musts") +
        "</div>";
      html += "</div>";
      return html;
    }

    if (face === "chores") {
      var qs = mustQuests(kidId);
      var iso = dayIso();
      var tp = todayMustProgress(kidId);
      html += '<div class="kf-face kf-chores">';
      html += '<div class="kf-kicker">Chores · claim <span class="kf-chip">' +
        tp.done + "/" + tp.need + "</span></div>";
      html += '<div class="kf-claim-list" role="list">';
      var shown = 0;
      for (var i = 0; i < qs.length && shown < 5; i++) {
        var q = qs[i];
        var cadence = q.cadence || "daily";
        var done = cadence === "daily" ? getCheck(q.id, iso) : getCheck(q.id);
        var label = String(q.what || "").replace(/^[^A-Za-z0-9]+/, "").trim();
        if (label.length > 28) label = label.slice(0, 26) + "…";
        html += '<button type="button" class="kf-claim' + (done ? " is-done" : "") +
          '" data-claim="' + esc(q.id) + '" data-cadence="' + esc(cadence) +
          '" data-kid="' + esc(kidId) + '" aria-pressed="' + (done ? "true" : "false") + '">' +
          '<span class="kf-claim-ring">' + (done ? "✓" : "·") + "</span>" +
          '<span class="kf-claim-what">' + esc(label || q.what) + "</span>" +
          "</button>";
        shown += 1;
      }
      if (!shown) html += '<div class="kf-empty">No musts on board</div>';
      html += "</div></div>";
      return html;
    }

    /* leave */
    var leave = nextLeaveFor(kidId);
    html += '<div class="kf-face kf-leave">';
    html += '<div class="kf-kicker">Next leave</div>';
    if (!leave) {
      html += '<div class="kf-loud">Clear</div><div class="kf-title">Nothing queued</div>';
    } else {
      var mins = minsUntilIso(leave.startIso);
      html += '<div class="kf-loud">' + esc(leave.time || leave.badge || "—") + "</div>";
      html += '<div class="kf-title">' + esc(leave.title) + "</div>";
      html += '<div class="kf-chip kf-chip--hot">' + esc(fmtLeave(mins)) + "</div>";
      if (leave.summary && leave.summary !== leave.title) {
        html += '<div class="kf-meta">' + esc(leave.summary) + "</div>";
      }
    }
    html += "</div>";
    return html;
  }

  function paintTile(root) {
    var kidId = root.getAttribute("data-kid-flip");
    if (KIDS.indexOf(kidId) < 0) return;
    var face = root.getAttribute("data-face") || "day";
    if (FACES.indexOf(face) < 0) face = "day";
    var stage = root.querySelector("[data-kf-stage]");
    var dots = root.querySelector("[data-kf-dots]");
    var streakEl = root.querySelector("[data-kf-streak]");
    var sub = root.querySelector("[data-kf-sub]");
    if (stage) stage.innerHTML = paintFace(kidId, face);
    if (dots) {
      dots.innerHTML = FACES.map(function (f) {
        return '<i class="' + (f === face ? "is-on" : "") + '" data-face-dot="' + f + '"></i>';
      }).join("");
    }
    var streak = streakDays(kidId);
    var tp = todayMustProgress(kidId);
    if (streakEl) {
      streakEl.textContent = streak > 0
        ? ("🔥 " + streak + "d · " + tp.done + "/" + tp.need)
        : ("XP " + tp.done + "/" + tp.need);
    }
    if (sub) {
      var leave = nextLeaveFor(kidId);
      if (face === "day" && leave) sub.textContent = (leave.time || "") + " · " + leave.title;
      else if (kidObj(kidId) && kidObj(kidId).themeLabel) sub.textContent = kidObj(kidId).themeLabel;
    }
    root.setAttribute("data-face", face);
    root.setAttribute("aria-label", (ACCENT[kidId].name) + " · " + (FACE_LABEL[face] || face) + " · swipe for more");
  }

  function setFace(root, face, playSound) {
    if (FACES.indexOf(face) < 0) return;
    var prev = root.getAttribute("data-face");
    root.setAttribute("data-face", face);
    paintTile(root);
    if (playSound && face !== prev) sfxFlip();
    root.classList.remove("kf-bump");
    void root.offsetWidth;
    root.classList.add("kf-bump");
  }

  function cycleFace(root, dir) {
    var face = root.getAttribute("data-face") || "day";
    var i = faceIndex(face);
    var next = FACES[(i + dir + FACES.length) % FACES.length];
    setFace(root, next, true);
  }

  function bindSwipe(root) {
    if (root.getAttribute("data-kf-swipe") === "1") return;
    root.setAttribute("data-kf-swipe", "1");
    var sx = 0, sy = 0, armed = false, moved = false;
    root.addEventListener("pointerdown", function (ev) {
      if (ev.target && ev.target.closest && (
        ev.target.closest(".kf-claim") ||
        ev.target.closest(".kid-flip-go") ||
        ev.target.closest("[data-face-dot]")
      )) return;
      armed = true;
      moved = false;
      sx = ev.clientX;
      sy = ev.clientY;
      try { root.setPointerCapture(ev.pointerId); } catch (e) { /* */ }
    });
    root.addEventListener("pointermove", function (ev) {
      if (!armed) return;
      var dx = ev.clientX - sx;
      var dy = ev.clientY - sy;
      if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.2) moved = true;
    });
    function end(ev) {
      if (!armed) return;
      armed = false;
      var dx = (ev.clientX || 0) - sx;
      var dy = (ev.clientY || 0) - sy;
      try { root.releasePointerCapture(ev.pointerId); } catch (e) { /* */ }
      if (moved && Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy)) {
        ev.preventDefault();
        cycleFace(root, dx < 0 ? 1 : -1);
      }
    }
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", function () { armed = false; });
  }

  function bindClaims(root) {
    root.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest(".kf-claim");
      if (!btn || !root.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      var id = btn.getAttribute("data-claim");
      var cadence = btn.getAttribute("data-cadence") || "daily";
      var kidId = btn.getAttribute("data-kid") || root.getAttribute("data-kid-flip");
      if (!id) return;
      var iso = cadence === "daily" ? dayIso() : undefined;
      var was = getCheck(id, iso);
      var next = !was;
      setCheck(id, next, iso);
      if (next) {
        sfxQuest(btn);
        try {
          if (global.HouseSfx && typeof HouseSfx.floatPopup === "function") {
            HouseSfx.floatPopup(btn, "CLAIMED");
          }
          if (global.HouseSfx && typeof HouseSfx.streakSparks === "function") {
            HouseSfx.streakSparks(root);
          }
        } catch (e) { /* */ }
      } else {
        sfxTap();
      }
      paintTile(root);
      paintWhoUp();
      paintBoardStreak(kidId);
    });
  }

  function bindDots(root) {
    root.addEventListener("click", function (ev) {
      var dot = ev.target && ev.target.closest && ev.target.closest("[data-face-dot]");
      if (!dot || !root.contains(dot)) return;
      ev.preventDefault();
      ev.stopPropagation();
      setFace(root, dot.getAttribute("data-face-dot"), true);
    });
  }

  function enhanceTile(anchor) {
    var kidId = null;
    if (anchor.classList.contains("ainsley")) kidId = "ainsley";
    else if (anchor.classList.contains("hayes")) kidId = "hayes";
    else if (anchor.classList.contains("harris")) kidId = "harris";
    if (!kidId) return null;
    if (anchor.getAttribute("data-kid-flip")) {
      paintTile(anchor);
      return anchor;
    }

    var href = anchor.getAttribute("href") || HREF[kidId];
    var label = (ACCENT[kidId] && ACCENT[kidId].name) || kidId;
    var iconHTML = "";
    var icon = anchor.querySelector(".tile-icon");
    if (icon) iconHTML = icon.outerHTML;

    var wrap = document.createElement("div");
    wrap.className = anchor.className + " kid-flip";
    wrap.setAttribute("data-kid-flip", kidId);
    wrap.setAttribute("data-face", "day");
    wrap.setAttribute("role", "group");
    wrap.tabIndex = 0;

    wrap.innerHTML =
      '<div class="tile-top">' +
      iconHTML +
      '<div class="tile-titles">' +
      '<div class="tile-label">' + esc(label) + "</div>" +
      '<div class="tile-sub" data-kf-sub>Live board</div>' +
      "</div>" +
      '<div class="kf-dots" data-kf-dots aria-hidden="true"></div>' +
      "</div>" +
      '<div class="kf-stage" data-kf-stage></div>' +
      '<div class="tile-foot">' +
      '<span class="tile-fact kf-streak-chip" data-kf-streak>XP</span>' +
      '<a class="tile-tap kid-flip-go" href="' + esc(href) + '">OPEN</a>' +
      "</div>";

    anchor.parentNode.replaceChild(wrap, anchor);
    paintTile(wrap);
    bindSwipe(wrap);
    bindClaims(wrap);
    bindDots(wrap);
    wrap.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight") { ev.preventDefault(); cycleFace(wrap, 1); }
      if (ev.key === "ArrowLeft") { ev.preventDefault(); cycleFace(wrap, -1); }
    });
    var go = wrap.querySelector(".kid-flip-go");
    if (go) {
      go.addEventListener("pointerdown", function () { sfxTap(); }, { passive: true });
    }
    return wrap;
  }

  function ensureWhoUpHost() {
    var existing = document.querySelector("[data-who-up]");
    if (existing) return existing;
    var grid = document.querySelector(".grid-wrap");
    if (!grid || !grid.parentNode) return null;
    var sec = document.createElement("section");
    sec.className = "who-up";
    sec.setAttribute("data-who-up", "1");
    sec.setAttribute("aria-label", "Who's up next");
    sec.innerHTML =
      '<div class="who-up-accent" aria-hidden="true"></div>' +
      '<div class="who-up-body">' +
      '<div class="who-up-kicker">Who\'s up</div>' +
      '<div class="who-up-main" data-who-main>…</div>' +
      '<div class="who-up-meta" data-who-meta></div>' +
      '</div>' +
      '<a class="who-up-go" data-who-go href="#">OPEN</a>';
    grid.parentNode.insertBefore(sec, grid);
    return sec;
  }

  function pickQuestKid() {
    var who = soonestWhoUp();
    if (who && who.kidId) return who.kidId;
    for (var i = 0; i < KIDS.length; i++) {
      var tp = todayMustProgress(KIDS[i]);
      if (tp.need && tp.done < tp.need) return KIDS[i];
    }
    return KIDS[0];
  }

  function ensureQuestHost() {
    var existing = document.querySelector("[data-hub-quest]");
    if (existing) return existing;
    var who = document.querySelector("[data-who-up]");
    var grid = document.querySelector(".tile-grid, .grid-wrap");
    if (!who && !grid) return null;
    var sec = document.createElement("section");
    sec.className = "hub-quest";
    sec.setAttribute("data-hub-quest", "1");
    sec.setAttribute("aria-label", "Daily quest");
    sec.innerHTML =
      '<div class="hub-quest-accent" aria-hidden="true"></div>' +
      '<div class="hub-quest-body">' +
      '<div class="hub-quest-kicker">Daily quest</div>' +
      '<div class="hub-quest-main">' +
      '<span class="hub-quest-title" data-hq-title>…</span>' +
      '<span class="hub-quest-musts" data-hq-musts></span>' +
      '<span class="hub-quest-streak" data-hq-streak></span>' +
      "</div>" +
      '<div class="hub-quest-claims" data-hq-claims></div>' +
      "</div>" +
      '<a class="hub-quest-go" data-hq-go href="#">OPEN</a>';
    if (who && who.parentNode) who.parentNode.insertBefore(sec, who.nextSibling);
    else if (grid && grid.parentNode) grid.parentNode.insertBefore(sec, grid);
    return sec;
  }

  function paintDailyQuest() {
    var host = ensureQuestHost();
    if (!host) return;
    var kidId = pickQuestKid();
    var accent = ACCENT[kidId] || ACCENT.hayes;
    var tp = todayMustProgress(kidId);
    var streak = streakDays(kidId);
    var qs = mustQuests(kidId).filter(function (q) {
      return (q.cadence || "daily") === "daily";
    }).slice(0, 4);
    host.setAttribute("data-kid", kidId);
    host.classList.toggle("is-empty", !tp.need);
    var title = host.querySelector("[data-hq-title]");
    var musts = host.querySelector("[data-hq-musts]");
    var streakEl = host.querySelector("[data-hq-streak]");
    var claims = host.querySelector("[data-hq-claims]");
    var go = host.querySelector("[data-hq-go]");
    if (title) title.textContent = accent.name + " · musts";
    if (musts) musts.textContent = tp.need ? (tp.done + "/" + tp.need) : "—";
    if (streakEl) streakEl.textContent = streak > 0 ? ("🔥 " + streak + "-day streak") : "🔥 Start streak";
    if (go) {
      go.setAttribute("href", HREF[kidId]);
      go.textContent = "CLAIM · " + accent.name.toUpperCase();
      if (go.getAttribute("data-sfx") !== "1") {
        go.setAttribute("data-sfx", "1");
        go.addEventListener("pointerdown", function () { sfxTap(); }, { passive: true });
      }
    }
    if (claims) {
      if (!qs.length) {
        claims.innerHTML = '<span class="hub-quest-streak">No daily musts queued</span>';
      } else {
        var html = "";
        qs.forEach(function (q) {
          var done = getCheck(q.id);
          html +=
            '<button type="button" class="hub-quest-claim' + (done ? " is-done" : "") + '" data-hq-claim="' + esc(q.id) + '">' +
            '<span class="kf-claim-ring">' + (done ? "✓" : "○") + "</span>" +
            "<span>" + esc(kidsSafe(q.title || q.what || q.id)) + "</span></button>";
        });
        claims.innerHTML = html;
        if (claims.getAttribute("data-bound") !== "1") {
          claims.setAttribute("data-bound", "1");
          claims.addEventListener("click", function (ev) {
            var btn = ev.target && ev.target.closest ? ev.target.closest("[data-hq-claim]") : null;
            if (!btn) return;
            var id = btn.getAttribute("data-hq-claim");
            if (!id) return;
            var next = !getCheck(id);
            setCheck(id, next);
            sfxQuest(btn);
            try { if (next && global.HouseSfx && HouseSfx.questPop) HouseSfx.questPop(btn); } catch (e) {}
            paintDailyQuest();
            refreshAll();
            try { document.dispatchEvent(new CustomEvent("house:earn", { detail: { id: id, done: next } })); } catch (e2) {}
          });
        }
      }
    }
  }

  function paintWhoUp() {
    var host = ensureWhoUpHost();
    if (!host) return;
    var pick = soonestWhoUp();
    var main = host.querySelector("[data-who-main]");
    var meta = host.querySelector("[data-who-meta]");
    var go = host.querySelector("[data-who-go]");
    if (!pick) {
      host.setAttribute("data-kid", "");
      if (main) main.innerHTML = '<span class="who-up-name">Clear</span><span class="who-up-what">No kid leave queued</span>';
      if (meta) meta.textContent = "LIVE cal";
      if (go) { go.setAttribute("href", "#"); go.hidden = true; }
      return;
    }
    var id = pick.kidId;
    var leave = pick.leave;
    var mins = minsUntilIso(leave.startIso);
    host.setAttribute("data-kid", id);
    if (main) {
      main.innerHTML =
        '<span class="who-up-name">' + esc(ACCENT[id].name) + "</span>" +
        '<span class="who-up-time">' + esc(leave.time || leave.badge || "") + "</span>" +
        '<span class="who-up-what">' + esc(leave.title) + "</span>";
    }
    if (meta) meta.textContent = fmtLeave(mins) + " · LIVE";
    if (go) {
      go.hidden = false;
      go.setAttribute("href", HREF[id]);
      go.textContent = "OPEN · " + ACCENT[id].name.toUpperCase();
    }
  }

  function paintBoardStreak(kidId) {
    var bodyKid = document.body && document.body.getAttribute("data-kid");
    if (!bodyKid) return;
    if (kidId && kidId !== bodyKid) return;
    kidId = bodyKid;
    var streak = streakDays(kidId);
    var tp = todayMustProgress(kidId);
    var gate = mustProgress(kidId);
    var label = document.querySelector("[data-streak-label]");
    if (label) {
      label.classList.add("streak-sparks");
      label.setAttribute("data-streak", "1");
      label.textContent = streak > 0
        ? ("🔥 " + streak + "-day streak · today " + tp.done + "/" + tp.need)
        : ("🔥 Start streak · today " + tp.done + "/" + tp.need);
    }
    var glass = document.querySelector("[data-xp-glass]");
    if (!glass) {
      var hdr = document.querySelector(".sec-chores .sec-hdr");
      if (hdr) {
        glass = document.createElement("div");
        glass.className = "xp-glass";
        glass.setAttribute("data-xp-glass", "1");
        hdr.appendChild(glass);
      }
    }
    if (glass) {
      var pct = tp.need ? Math.round((tp.done / tp.need) * 100) : 0;
      glass.innerHTML =
        '<div class="xp-glass-lab">XP · musts</div>' +
        '<div class="xp-glass-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="xp-glass-meta">' + tp.done + "/" + tp.need +
        (gate.complete ? " · jar unlocked" : " · jar locked") + "</div>";
    }
  }

  function prefetchCalLeaves(cb) {
    var urls = ["data/cal-live.json?v=" + Date.now(), "data/cal-live.json"];
    var i = 0;
    function next() {
      if (i >= urls.length) { if (cb) cb(null); return; }
      var url = urls[i++];
      fetch(url, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("bad");
        return r.json();
      }).then(function (cal) {
        if (cal && Array.isArray(cal.upcomingLeaves)) {
          global.__wardosCalLeaves = cal.upcomingLeaves;
        }
        if (cb) cb(cal);
      }).catch(function () { next(); });
    }
    next();
  }

  function enhanceHub() {
    if (!document.querySelector(".tile.ainsley, .tile.hayes, .tile.harris, [data-kid-flip]")) return;
    document.querySelectorAll("a.tile.ainsley, a.tile.hayes, a.tile.harris").forEach(enhanceTile);
    document.querySelectorAll("[data-kid-flip]").forEach(function (el) {
      bindSwipe(el);
      bindClaims(el);
      bindDots(el);
      paintTile(el);
    });
    paintWhoUp();
    paintDailyQuest();
    var go = document.querySelector("[data-who-go]");
    if (go && go.getAttribute("data-sfx") !== "1") {
      go.setAttribute("data-sfx", "1");
      go.addEventListener("pointerdown", function () { sfxTap(); }, { passive: true });
    }
  }

  function enhanceBoard() {
    var kidId = document.body && document.body.getAttribute("data-kid");
    if (!kidId || KIDS.indexOf(kidId) < 0) return;
    paintBoardStreak(kidId);
  }

  function refreshAll() {
    document.querySelectorAll("[data-kid-flip]").forEach(paintTile);
    paintWhoUp();
    paintDailyQuest();
    enhanceBoard();
  }

  function onDataReady() {
    prefetchCalLeaves(function () {
      enhanceHub();
      enhanceBoard();
    });
  }

  function boot() {
    enhanceBoard();
    var w = WK();
    if (w && w._data) {
      onDataReady();
    } else if (w && typeof w.loadJSON === "function") {
      w.loadJSON(function (err, d) {
        if (!err && d) {
          try { w._data = d; } catch (e) { /* */ }
        }
        onDataReady();
      });
    } else if (w && typeof w.boot === "function") {
      /* kid pages call boot themselves; hub just waits for event */
      document.addEventListener("house:kids-data-ready", onDataReady, { once: true });
      /* hub: load without kid id */
      w.loadJSON(function (err, d) {
        if (!err && d) {
          try { w._data = d; } catch (e) { /* */ }
          try {
            document.dispatchEvent(new CustomEvent("house:kids-data-ready", { detail: { data: d } }));
          } catch (e2) { /* */ }
        }
        onDataReady();
      });
    } else {
      onDataReady();
    }

    document.addEventListener("house:kids-data-ready", function () {
      refreshAll();
    });
    document.addEventListener("house:kid-rendered", function () {
      enhanceBoard();
    });
    document.addEventListener("house:earn", function () {
      refreshAll();
    });
    document.addEventListener("house:cleared", function () {
      refreshAll();
    });

    /* Re-paint who’s up on the minute so leave countdown stays honest */
    setInterval(function () {
      paintWhoUp();
      paintDailyQuest();
      document.querySelectorAll('[data-kid-flip][data-face="leave"], [data-kid-flip][data-face="stars"]').forEach(paintTile);
      enhanceBoard();
    }, 60 * 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  global.HouseKidEngage = {
    refresh: refreshAll,
    streakDays: streakDays,
    nextLeaveFor: nextLeaveFor,
    soonestWhoUp: soonestWhoUp,
    paintDailyQuest: paintDailyQuest,
    FACES: FACES
  };
})(window);
