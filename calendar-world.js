/* calendar-world.js · Calendar World inside each kid board.
   C1 is the path itself (lanterns, walker, fog, now-line, time ring, briefing).
   C2–C9 open painted sub-scenes. Sentences are Atlas's Oct 2 wording.
   Numbers missing from that transcript are named plainly for their phase.
   No scores, money, shame, or red marks. Off weeks: look, don't keep. */
(function (global) {
  "use strict";

  function kid() { return (document.body && document.body.getAttribute("data-kid")) || "hayes"; }
  function data() { return (global.WardKids && WardKids._data) || null; }
  function asleep() { return global.JarEngine ? JarEngine.asleepWeek(data()) : false; }
  function age() { return kid() === "harris" ? "small" : kid() === "ainsley" ? "teen" : "mid"; }
  function say(small, mid, teen) { return age() === "small" ? small : age() === "teen" ? teen : mid; }
  function reduced() { return global.KidWorld && KidWorld.reduced && KidWorld.reduced(); }

  function chicagoParts() {
    try {
      var p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return p;
    } catch (e) { return { hour: "12", minute: "00", weekday: "" }; }
  }

  function dayDiff(a, b) {
    if (!a || !b) return 0;
    var pa = a.split("-"), pb = b.split("-");
    var da = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]);
    var db = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }

  function sleeps(n) {
    if (n <= 0) return say("today", "today", "today");
    if (age() === "small") {
      if (n > 7) return n + "☾";
      var moons = "";
      for (var i = 0; i < n; i++) moons += "☾";
      return moons;
    }
    if (n === 1) return "1 sleep";
    return age() === "teen" ? (n + " nights") : (n + " sleeps");
  }
  function chicagoMonth() {
    try {
      return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "numeric" }).format(new Date()), 10) || 1;
    } catch (e) { return new Date().getMonth() + 1; }
  }
  function monthName() {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "long" }).format(new Date());
    } catch (e2) { return ""; }
  }
  var litDays = {};
  function lightLantern(iso) {
    if (!iso) return;
    litDays[iso] = 1;
    keep("lantern-" + iso, "1");
  }
  function lanternOn(iso) {
    return !!(litDays[iso] || kept("lantern-" + iso) === "1");
  }

  function canKeep() { return !asleep(); }
  function keep(key, val) {
    if (!canKeep()) return false;
    try { localStorage.setItem("cw:" + kid() + ":" + key, String(val)); } catch (e) {}
    return true;
  }
  function kept(key) {
    try { return localStorage.getItem("cw:" + kid() + ":" + key) || ""; } catch (e) { return ""; }
  }

  function open(opts) {
    if (global.KidWorld && KidWorld.openScene) KidWorld.openScene(opts);
  }

  function nextText() {
    var el = document.querySelector("[data-mount-consume-next]");
    if (!el) return { title: "Nothing timed", when: "" };
    var title = el.querySelector(".consume-hero-title");
    var when = el.querySelector(".consume-hero-when");
    return {
      title: title ? title.textContent.trim() : "Quiet",
      when: when ? when.textContent.trim() : ""
    };
  }

  function routineText() {
    var el = document.querySelector("[data-mount-consume-routine]");
    if (!el || el.hidden) return "";
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function specialLine() {
    var d = data();
    var k = kid();
    if (!d || !d.kids || !d.kids[k]) return "";
    var rows = d.kids[k].school || [];
    for (var i = 0; i < rows.length; i++) {
      if (/special|art|music|spanish|pe/i.test(rows[i].what || "")) return rows[i].what;
    }
    return "";
  }

  /* ---------- DAYPICK1 · Path drawer: plain week + the picked day's items ---------- */
  function selIso() {
    return (global.KidWorld && KidWorld.day && KidWorld.day()) || (global.WardKids && WardKids.DAY_ISO) || "";
  }
  function pickDay(iso) {
    if (global.KidWorld && KidWorld.setDay) KidWorld.setDay(iso);
    else refresh();
  }
  function stripDays() {
    var out = [];
    var q = document.querySelector(".quest.daily-week");
    if (q) q.querySelectorAll(".day-tap").forEach(function (b) {
      var iso = b.getAttribute("data-day-iso");
      if (iso) out.push(iso);
    });
    return out;
  }
  var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function wdOf(iso) { var p = iso.split("-"); return WD[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()]; }

  function paintPath(root) {
    var today = global.WardKids && WardKids.DAY_ISO;
    var sel = selIso();
    var path = root.querySelector("[data-cw-path]");
    if (!path) return;
    path.innerHTML = "";
    var days = stripDays();
    if (!days.length) { path.innerHTML = "<p>No days yet.</p>"; return; }
    days.forEach(function (iso) {
      var diff = dayDiff(today, iso);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cw-lantern" + (diff < 0 ? " is-past" : diff > 0 ? " is-fog" : " is-now") + (iso === sel ? " is-sel" : "");
      b.setAttribute("aria-pressed", iso === sel ? "true" : "false");
      b.style.setProperty("--orb", kid() === "ainsley" ? "#e7b089" : kid() === "harris" ? "#8ee7a0" : "#8fd8ff");
      b.innerHTML = '<span class="cw-orb"></span><small>' + wdOf(iso) + '</small><small>' + (diff > 0 ? sleeps(diff) : String(+iso.slice(-2))) + "</small>";
      b.addEventListener("click", function () { pickDay(iso); });
      path.appendChild(b);
    });
  }

  function paintDay(root) {
    var sel = selIso();
    var today = global.WardKids && WardKids.DAY_ISO;
    var head = root.querySelector("[data-cw-title]");
    var diff = dayDiff(today, sel);
    if (head) head.textContent = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : wdOf(sel) + " " + (+sel.slice(-2));
    var list = root.querySelector("[data-cw-day]");
    if (!list) return;
    var rows = (global.WardKids && WardKids.eventsForIso && WardKids.eventsForIso(kid(), data(), sel)) || [];
    if (asleep()) { list.innerHTML = ""; return; } /* AWAYWK1 · resting week: dark windows, no sentence */
    if (!rows.length) { list.innerHTML = "<li>Nothing on the schedule.</li>"; return; }
    list.innerHTML = "";
    rows.forEach(function (r) {
      var li = document.createElement("li");
      var b = document.createElement("b"); b.textContent = r.time || "";
      var t = document.createElement("span"); t.textContent = r.what;
      li.appendChild(b); li.appendChild(t);
      list.appendChild(li);
    });
  }

  function shell() {
    var host = document.querySelector("#kw-cal") || document.querySelector("#sec-days, .sec-schedule");
    if (!host || host.querySelector("[data-cw]")) return host && host.querySelector("[data-cw]");
    var el = document.createElement("div");
    el.className = "cw";
    el.setAttribute("data-cw", "1");
    el.innerHTML =
      '<div class="cw-top"><strong class="cw-brief" data-cw-title>Today</strong>' +
      (host.id === "kw-cal" ? '<button type="button" class="cw-x" data-cw-close aria-label="Close">×</button>' : "") + "</div>" +
      '<div class="cw-path" data-cw-path></div>' +
      '<ul class="cw-day" data-cw-day></ul>';
    var hdr = host.querySelector(".sec-hdr");
    if (hdr && hdr.nextSibling) host.insertBefore(el, hdr.nextSibling);
    else host.insertBefore(el, host.firstChild);
    var x = el.querySelector("[data-cw-close]");
    if (x) x.addEventListener("click", function () { host.hidden = true; });
    return el;
  }

  function refresh() {
    if (!document.body || !document.body.getAttribute("data-kid")) return;
    var root = shell();
    if (!root) return;
    document.body.classList.toggle("kw-asleep", asleep());
    paintPath(root);
    paintDay(root);
  }

  document.addEventListener("house:kid-rendered", refresh);
  document.addEventListener("kw:day", refresh);
  if (document.readyState !== "loading") setTimeout(refresh, 400);
  else document.addEventListener("DOMContentLoaded", function () { setTimeout(refresh, 400); });
})(window);
