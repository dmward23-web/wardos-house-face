/* Prism · behaviors the shared stylesheet cannot do alone. */
(function (global) {
  "use strict";
  function titleCase(s) {
    s = String(s || "").trim().toLowerCase();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }
  function clockFace(s) {
    return String(s || "").replace(/\b(\d{1,2}:\d{2})\s*([ap])\.?m\.?\b/ig, function (_, hm, ap) {
      return hm + " " + ap.toUpperCase() + "M";
    });
  }
  function snapMusts() {
    var list = document.querySelector("#sec-musts .chore-list, #sec-musts [data-mount-quests]");
    if (!list) return;
    var rows = Array.prototype.filter.call(list.children, function (el) { return el.classList && el.classList.contains("chore"); });
    var n = Math.max(1, Math.floor(list.clientHeight / 128));
    rows.forEach(function (row, i) {
      if (i >= n) row.style.setProperty("display", "none", "important");
      else row.style.removeProperty("display");
    });
  }
  function run() {
    snapMusts();
    var deck = document.getElementById("hub-cam-deck");
    if (deck) {
      var cams = deck.querySelectorAll(".hub-cam");
      var resting = cams.length > 0 && Array.prototype.every.call(cams, function (cam) {
        return /rest|unavailable/i.test((cam.className || "") + " " + (cam.textContent || ""));
      });
      deck.classList.toggle("cams-resting", resting);
      if (resting) {
        var label = deck.querySelector(".hub-cam-label");
        if (label) label.textContent = "Cameras resting";
      }
    }
    document.querySelectorAll(".kw-name, .col-name, .roster-full, .tile-label").forEach(function (el) {
      var next = titleCase(el.textContent);
      if (next && next !== el.textContent) el.textContent = next;
    });
    document.querySelectorAll(".kw-clock, .live-clock, .consume-hero-when, .roster-time, .hub-next-time").forEach(function (el) {
      var next = clockFace(el.textContent);
      if (next !== el.textContent) el.textContent = next;
    });
    if (document.body && document.body.getAttribute("data-kid") === "ainsley") {
      document.querySelectorAll("#sec-days .consume-hero-when, #sec-days .when, #sec-days .consume-hero-meta").forEach(function (el) {
        if (/\d/.test(el.textContent || "")) el.textContent = "";
      });
    }
    var cheer = document.querySelector(".cheer-title");
    if (cheer && /vibe|dad checks|3 kids|on this screen/i.test(document.body.innerText || "")) {
      cheer.textContent = "Tap your day when it's done";
    }
    document.querySelectorAll(".cheer-badge, .cheer-label").forEach(function (el) { el.hidden = true; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  document.addEventListener("house:kids-data-ready", run);
  setTimeout(run, 400);
  setTimeout(run, 1200);
})(typeof window !== "undefined" ? window : globalThis);
