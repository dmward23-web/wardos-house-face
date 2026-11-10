/* ACERFIX · shared hub roster, next leave, and the lights row.
   Plates are text nodes from HouseEventDisplay. No flip dots, no raw descriptions. */
(function (global) {
  "use strict";
  var NAMES = {
    ainsley: ["Ainsley", "AIN", "kid-ainsley.html"],
    hayes: ["Hayes", "HAY", "kid-hayes.html"],
    harris: ["Harris", "HAR", "kid-harris.html"],
    dan: ["Dad", "DAD", "sheet-today.html"]
  };
  var LEAVE = {
    "School pickup": 1,
    "School drop": 1,
    "Leave for swim": 1,
    "Leave for soccer": 1,
    "Leave for baseball": 1,
    "Leave for flag": 1
  };

  function nowMs() {
    try {
      if (global.HouseScene && HouseScene.now) return HouseScene.now().getTime();
    } catch (e) { /* wall clock */ }
    return Date.now();
  }

  function data() {
    var W = global.WardKids;
    return (W && W._data) || null;
  }

  function rowsOf(kid) {
    if (!kid) return [];
    var out = [];
    ["today", "upcoming", "school", "sports", "week", "appointments"].forEach(function (k) {
      var list = kid[k];
      if (Array.isArray(list)) out = out.concat(list);
    });
    if (kid.hottest && typeof kid.hottest === "object") out.push(kid.hottest);
    return out;
  }

  function viewOf(row, audience) {
    var D = global.HouseEventDisplay;
    if (!D) return null;
    return D.summarize(row, audience);
  }

  function soonest(kid, audience, leaveOnly) {
    var best = null;
    var now = nowMs();
    rowsOf(kid).forEach(function (row) {
      var view = viewOf(row, audience);
      if (!view || !view.title) return;
      if (leaveOnly && !LEAVE[view.title]) return;
      var ms = Date.parse(row.startIso || row.start || "");
      if (!isFinite(ms) || ms < now - 60 * 1000) return;
      if (!best || ms < best.ms) best = { ms: ms, view: view };
    });
    return best ? best.view : null;
  }

  function setText(parent, cls, text) {
    var el = parent.querySelector("." + cls);
    if (el) el.textContent = text || "";
    return el;
  }

  function paintCard(anchor, id) {
    var spec = NAMES[id];
    if (!anchor || !spec) return;
    var kid = data() && data().kids ? data().kids[id] || data().kids[id === "dan" ? "dad" : id] : null;
    var audience = id === "ainsley" || id === "dan" ? "shared" : id;
    var view = soonest(kid, audience, false);
    while (anchor.firstChild) anchor.removeChild(anchor.firstChild);
    var name = document.createElement("span");
    name.className = "roster-name";
    var full = document.createElement("span");
    full.className = "tile-label roster-full";
    full.textContent = spec[0];
    var abbr = document.createElement("span");
    abbr.className = "roster-abbr";
    abbr.textContent = spec[1];
    name.appendChild(full);
    name.appendChild(abbr);
    var plate = document.createElement("span");
    plate.className = "roster-plate";
    if (id === "dan") plate.setAttribute("data-dad-stage", "");
    var time = document.createElement("span");
    time.className = "roster-time";
    time.textContent = view && view.time ? String(view.time).replace(/\b([ap])m\b/i, function (_, ap) { return ap.toUpperCase() + "M"; }) : "";
    var title = document.createElement("span");
    title.className = "roster-title";
    if (view && view.title) {
      title.textContent = view.title;
      plate.classList.remove("roster-empty");
    } else if (data()) {
      title.textContent = "All done";
      plate.classList.add("roster-empty");
    } else {
      title.textContent = "Calendar unavailable";
      plate.classList.remove("roster-empty");
    }
    plate.appendChild(time);
    plate.appendChild(title);
    anchor.appendChild(name);
    anchor.appendChild(plate);
    if (id !== "dan") {
      var keep = document.createElement("span");
      keep.className = "kf-stage";
      keep.hidden = true;
      anchor.appendChild(keep);
    }
    if (id !== "dan") anchor.classList.add("kid-flip");
    anchor.setAttribute("href", spec[2]);
    var label = spec[0] + " " + spec[1];
    if (view && view.title) label += " " + (view.time ? view.time + " " : "") + view.title;
    anchor.setAttribute("aria-label", label);
  }

  function paintRoster() {
    Object.keys(NAMES).forEach(function (id) {
      paintCard(document.querySelector("a.tile." + id), id);
    });
  }

  function paintNext() {
    var card = document.getElementById("hub-next-leave");
    if (!card) return;
    var week = data();
    var best = null;
    var now = nowMs();
    if (week && week.kids) {
      Object.keys(NAMES).forEach(function (id) {
        var kid = week.kids[id];
        rowsOf(kid).forEach(function (row) {
          var view = viewOf(row, "shared");
          if (!view || !LEAVE[view.title]) return;
          var ms = Date.parse(row.startIso || row.start || "");
          if (!isFinite(ms) || ms < now - 60 * 1000) return;
          if (!best || ms < best.ms) best = view;
        });
      });
    }
    var time = card.querySelector(".hub-next-time");
    var title = card.querySelector(".hub-next-title");
    if (!week) {
      card.hidden = false;
      if (time) time.textContent = "";
      if (title) title.textContent = "Calendar unavailable";
      return;
    }
    var shown = false;
    if (best) {
      Object.keys(NAMES).forEach(function (id) {
        var kid = week.kids[id] || week.kids[id === "dan" ? "dad" : id];
        var view = soonest(kid, id === "ainsley" || id === "dan" ? "shared" : id, false);
        if (view && view.title === best.title) shown = true;
      });
    }
    if (!best || shown) {
      card.hidden = true;
      if (time) time.textContent = "";
      if (title) title.textContent = "";
      return;
    }
    card.hidden = false;
    if (time) time.textContent = best.time || "All day";
    if (title) title.textContent = best.title;
  }

  function trimLights() {
    var grid = document.getElementById("hub-lights-grid");
    if (!grid) return;
    var items = grid.querySelectorAll(".hub-sw");
    var extra = 0;
    for (var i = 0; i < items.length; i++) {
      if (i < 3) items[i].removeAttribute("hidden");
      else { items[i].setAttribute("hidden", ""); extra += 1; }
    }
    var note = document.getElementById("hub-lights-more-count");
    if (note) note.textContent = extra ? extra + " more on the full board" : "";
  }

  function boot() {
    paintRoster();
    paintNext();
    trimLights();
    document.addEventListener("house:kids-data-ready", function () { paintRoster(); paintNext(); });
    document.addEventListener("house:kids-data-missing", function () { paintRoster(); paintNext(); });
    var grid = document.getElementById("hub-lights-grid");
    if (grid && global.MutationObserver) {
      new MutationObserver(trimLights).observe(grid, { childList: true });
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
