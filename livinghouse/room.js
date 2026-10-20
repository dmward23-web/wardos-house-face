/* LIVING HOUSE · room.js · a kid room or the garage, photoreal plate, empty when art or a feed is missing.
   Time comes only from clock.js. Feeds only when LHRules.feedsAllowed. Nothing here is a cartoon world. */
(function (g) {
  "use strict";
  var SPORT = /\b(soccer|football|basketball|baseball|softball|volleyball|swim|swimming|track|tennis|golf|hockey|wrestling|lacrosse|gymnastics|cheer|practice|game|match|meet)\b/i;
  var KIDS = { ainsley: 1, hayes: 1, harris: 1 };

  function snapPath(nest) {
    var cams = nest && nest.cameras, u = nest && nest.snapshotUrl;
    if (!u && cams && cams.length) u = cams[0].snapshotUrl;
    return typeof u === "string" && /^data\/nest-snaps\/[A-Za-z0-9._-]+$/.test(u) ? "../" + u : "";
  }

  /* Visible lines for a room. away is word-free: the list is empty, the plate stays. A missing events array is a missing feed. */
  function visibleItems(kid, events, nowMs, away, face) {
    if (!events) return { feed: "missing", items: [] };
    if (away || !KIDS[kid] || kid === "ainsley") return { feed: "live", items: [] };
    var out = [];
    for (var i = 0; i < events.length; i++) {
      var e = events[i]; if (!e) continue;
      var raw = String(e.summary || "");
      if (kid === "harris" && !/\bfootball\b/i.test(raw)) continue;
      if (kid === "hayes" && !SPORT.test(raw)) continue;
      var end = Date.parse(e.end || e.start);
      if (isFinite(end) && end <= nowMs) continue;
      var text = face ? face(raw) : raw;
      if (!text) continue;
      out.push({ id: e.id || "", text: text });
    }
    return { feed: "live", items: out };
  }

  var api = { snapPath: snapPath, visibleItems: visibleItems, KIDS: KIDS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  g.LHRooms = api;
  if (typeof document === "undefined") return;

  var q = new URLSearchParams(location.search);
  var C = g.LHClock;
  var kid = q.get("kid") || "";
  var door = q.get("door") || "";
  if (!KIDS[kid]) kid = "";
  var root = document.getElementById("room");
  var title = document.querySelector("[data-room=title]");
  var plate = document.querySelector("[data-room=plate-text]");
  var list = document.querySelector("[data-room=list]");
  var listTitle = document.querySelector("[data-room=list-title]");
  var items = document.querySelector("[data-room=items]");
  var empty = document.querySelector("[data-room=empty]");
  var earn = document.querySelector("[data-room=earn]");
  var cam = document.querySelector("[data-room=cam-still]");

  function face(t) {
    var L = g.HouseFaceLaw, R = g.LHRules;
    try { t = L && L.faceText ? L.faceText(String(t || "")) : String(t || ""); } catch (e) { t = String(t || ""); }
    if (R) { t = R.stripSchool(t); t = R.seatsResidue(t); if (!t || R.orphan(t) || R.money(t) || R.stateText(t) || (L && L.isCustody && L.isCustody(t))) return ""; }
    return t;
  }
  function awayNow() {
    var A = g.AwayFilter;
    if (!A || !A.hasMonths || !A.hasMonths()) return false;
    return !!A.isAwayAt(C.now().getTime());
  }
  function paintList(away) {
    if (!list) return;
    var show = (kid === "hayes" || kid === "harris") && !away;
    list.hidden = !show;
    if (away) list.setAttribute("data-feed", "rest");
    if (!show) return;
    listTitle.textContent = kid === "harris" ? "Football" : "Sports";
    var ev = root._events;
    var vis = visibleItems(kid, ev, C.now().getTime(), away, function (raw) {
      if (!g.LHRules || !g.LHRules.kidName(kid, raw)) return "";
      if (g.LHRules.money(raw) || g.LHRules.stateText(raw)) return "";
      if (g.HouseFaceLaw && g.HouseFaceLaw.isDressDay && g.HouseFaceLaw.isDressDay(raw)) return "";
      var A = g.AwayFilter;
      if (A && A.hasMonths && A.hasMonths() && A.keepItem && !A.keepItem({ summary: raw, start: root._bySummary[raw] }, C.now().getTime())) return "";
      return face(raw);
    });
    /* visibleItems already dropped non-matching text. Re-apply the kid filter above via face wrapper.
       When the feed is missing, ev is null. */
    if (ev == null) vis = { feed: "missing", items: [] };
    items.innerHTML = "";
    vis.items.forEach(function (it) {
      var li = document.createElement("li");
      li.textContent = it.text;
      if (q.get("next") && it.id && q.get("next") === String(it.id)) li.className = "on";
      items.appendChild(li);
    });
    var none = !vis.items.length;
    empty.hidden = !none;
    empty.textContent = vis.feed === "missing" ? (kid === "harris" ? "No football feed yet" : "No sports feed yet") : "Nothing on the list";
    list.setAttribute("data-feed", vis.feed);
  }
  function paintEarn(away) {
    if (!earn) return;
    var on = kid === "ainsley" && !away;
    earn.hidden = !on;
    if (!on) return;
    var ul = earn.querySelector("ul");
    ul.innerHTML = "";
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem("lh-room-earned-ainsley") || "[]"); } catch (e) { saved = []; }
    if (!Array.isArray(saved)) saved = [];
    saved.forEach(function (t, i) {
      var li = document.createElement("li");
      var s = document.createElement("span"); s.textContent = String(t || "");
      var b = document.createElement("button"); b.type = "button"; b.textContent = "Remove"; b.setAttribute("aria-label", "Remove earned item");
      b.addEventListener("click", function () { saved.splice(i, 1); try { localStorage.setItem("lh-room-earned-ainsley", JSON.stringify(saved)); } catch (e) {} paintEarn(awayNow()); });
      li.appendChild(s); li.appendChild(b); ul.appendChild(li);
    });
    earn.querySelector("[data-room=earn-empty]").hidden = saved.length > 0;
  }
  function paint() {
    var away = awayNow();
    document.documentElement.classList.toggle("lh-room-away", away);
    root.setAttribute("data-state", away ? "away" : "home");
    if (!kid) {
      var garage = door === "garage";
      title.textContent = garage ? "Garage" : "Room";
      document.title = title.textContent;
      plate.textContent = garage ? (cam && cam.getAttribute("src") ? "" : "No cam feed yet") : "Room art is not in yet";
      if (list) list.hidden = true;
      if (earn) earn.hidden = true;
      return;
    }
    var name = kid.charAt(0).toUpperCase() + kid.slice(1);
    title.textContent = name;
    document.title = name;
    plate.textContent = "Room art is not in yet";
    paintList(away);
    paintEarn(away);
  }
  function load() {
    var ok = g.LHRules && g.LHRules.feedsAllowed(location);
    function J(u) {
      if (!ok) return Promise.resolve(null);
      return fetch(u + "?t=" + Math.floor(C.realMs() / 6e4)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    return Promise.all([J("../data/cal-live.json"), J("../data/cal-months.json"), J("../data/nest-live.json")]).then(function (a) {
      var L = g.HouseFaceLaw;
      function lw(n, d) { try { return L && L.cleanFeed && d ? L.cleanFeed(n, d) : d; } catch (e) { return d; } }
      var cal = lw("cal-live", a[0]);
      try { if (g.AwayFilter) g.AwayFilter.setMonths(lw("cal-months", a[1])); } catch (e) {}
      root._events = cal && cal.upcomingLeaves ? cal.upcomingLeaves : (cal ? [] : null);
      root._bySummary = {};
      (root._events || []).forEach(function (e) { if (e && e.summary) root._bySummary[e.summary] = e.start; });
      var src = snapPath(a[2]);
      if (door === "garage") {
        root.removeAttribute("data-art");
        root.setAttribute("data-feed", src ? "live" : "missing");
        root.setAttribute("data-why", src ? "" : "no cam still");
        if (src && cam) { cam.hidden = false; cam.src = src; }
      } else {
        root.setAttribute("data-art", "missing");
        root.setAttribute("data-feed", "missing");
        root.setAttribute("data-why", "no room art");
      }
      paint();
      document.documentElement.classList.add("lh-ready");
    });
  }
  var form = document.querySelector("[data-room=earn-form]");
  if (form) form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var input = form.querySelector("input");
    var t = face(input.value).slice(0, 48);
    input.value = "";
    if (!t) return;
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem("lh-room-earned-ainsley") || "[]"); } catch (e) { saved = []; }
    if (!Array.isArray(saved)) saved = [];
    saved.push(t);
    try { localStorage.setItem("lh-room-earned-ainsley", JSON.stringify(saved)); } catch (e) {}
    paintEarn(awayNow());
  });
  var back = document.querySelector("[data-room=back]");
  if (back) {
    var keep = new URLSearchParams();
    ["now", "freeze", "rec", "probe", "halloween", "state"].forEach(function (k) { if (q.get(k)) keep.set(k, q.get(k)); });
    var ks = keep.toString(); if (ks) back.href = "index.html?" + ks;
  }
  if (q.get("probe") === "1") { var ps = document.createElement("script"); ps.src = "probe.js?v=LH1"; document.body.appendChild(ps); }
  load();
  setInterval(paint, 20000);
})(typeof window !== "undefined" ? window : globalThis);
