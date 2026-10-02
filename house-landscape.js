/* LANDFILL1 · House Face boards · landscape fill (Dan, Oct 1 9:3x PM CT: "the board is LANDSCAPE"; his Chrome
   on a ~1024x576 laptop window showed the hub as a narrow portrait column with black on both sides).
   On a landscape window (>= 960 wide, >= 1.25x wider than tall, not a phone screen) the board's .panel is drawn
   at a fluid type scale z = clamp(0.8, width / 1600, 1.6) and sized to the WHOLE viewport at that scale; its
   sections flow into as many columns as fit (CSS columns, about 500 design px each). Long lists scroll down the
   page; nothing is a fixed-width center column. Portrait (the 1080x1920 wall, phones) is untouched.
   Pure layout: no data, no writes, no network. Linked in <head> (sets html[data-landscape] before first paint). */
(function (g) {
  "use strict";
  var BASIS = 1600, ZMIN = 0.8, ZMAX = 1.6, COLW = 500;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function phone() { try { return Math.min(screen.width, screen.height) <= 600; } catch (e) { return false; } }
  function width() { return document.documentElement.clientWidth || g.innerWidth || 0; }
  function isLandscape() { var w = g.innerWidth || width(), h = g.innerHeight || 1; return w >= 960 && w >= h * 1.25 && !phone(); }
  function sections(panel) {
    return Array.prototype.filter.call(panel.children, function (e) {
      if (e.hasAttribute("hidden") || e.tagName === "SCRIPT" || e.tagName === "STYLE" || e.tagName === "TEMPLATE") return false;
      if (e.hasAttribute("data-ls-span")) return false;
      var cs = g.getComputedStyle(e); return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
    });
  }
  function apply() {
    var root = document.documentElement, on = isLandscape();
    if (on) root.setAttribute("data-landscape", ""); else root.removeAttribute("data-landscape");
    var panel = document.querySelector(".panel"); if (!panel) return;
    if (!on) { if (panel.hasAttribute("data-ls-zoom")) { panel.style.zoom = ""; panel.removeAttribute("data-ls-zoom"); } return; }
    var w = width(), h = g.innerHeight || 1, z = clamp(w / BASIS, ZMIN, ZMAX);
    ["transform", "transform-origin", "margin-left", "margin-top", "margin-bottom"].forEach(function (p) { panel.style.removeProperty(p); });
    document.body.style.removeProperty("height");
    panel.style.zoom = String(z); panel.setAttribute("data-ls-zoom", String(Math.round(z * 1000) / 1000));
    root.style.setProperty("--ls-z", String(z));
    root.style.setProperty("--ls-w", (w / z).toFixed(2) + "px");
    root.style.setProperty("--ls-h", (h / z).toFixed(2) + "px");
    flatten(panel, h / z);
    var n = flow(panel).length;
    var cols = clamp(Math.floor((w / z) / COLW), 1, Math.max(1, n));
    var force = parseInt(panel.getAttribute("data-ls-cols") || "", 10); if (force > 0) cols = Math.min(cols, force);
    /* a short board (few sections) gets one row of equal columns that run the full window height (no empty column) */
    var row = !panel.hasAttribute("data-ls-grid") && n >= 2 && n <= Math.min(4, cols + 1) && (w / z) / n >= 360;
    if (row) cols = n;
    if (row) root.setAttribute("data-ls-row", ""); else root.removeAttribute("data-ls-row");
    root.style.setProperty("--ls-cols", String(cols)); root.setAttribute("data-ls-cols", String(cols));
  }
  var LEAD = "header, .hdr, [data-ls-lead], [data-ls-span]";
  /* one wrapper holding most of the board (main.ds, div.body) is flattened (display: contents) so its sections
     flow into the columns; a section taller than ~70% of the window is a long list and may continue in the next
     column (its rows never split). Recomputed on every apply (resize). */
  function flatten(panel, vh) {
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-flat]"), function (e) { e.removeAttribute("data-ls-flat"); });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-ls-long]"), function (e) { e.removeAttribute("data-ls-long"); });
    if (panel.hasAttribute("data-ls-grid")) return; /* the board brings its own landscape grid */
    sections(panel).forEach(function (e) {
      if (e.matches(LEAD) || e.matches("footer, .ftr") || e.hasAttribute("data-ls-keep")) return;
      var kids = sections(e); if (kids.length < 2) return;
      var tag = e.tagName; if (tag === "MAIN" || e.classList.contains("body") || e.hasAttribute("data-ls-wrapper")) e.setAttribute("data-ls-flat", "");
    });
    flow(panel).forEach(function (e) { if (e.getBoundingClientRect().height / (parseFloat(panel.style.zoom) || 1) > vh * 0.7) e.setAttribute("data-ls-long", ""); });
  }
  function flow(panel) {
    var out = [];
    sections(panel).forEach(function (e) {
      if (e.matches(LEAD)) return;
      if (e.hasAttribute("data-ls-flat")) sections(e).forEach(function (k) { out.push(k); }); else out.push(e);
    });
    return out;
  }
  var api = { apply: apply, active: function () { return document.documentElement.hasAttribute("data-landscape"); }, isLandscape: isLandscape };
  g.HouseLandscape = api;
  if (isLandscape()) document.documentElement.setAttribute("data-landscape", "");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
  /* PRESSMAP1: a press from the wall lands on page#anchor; the landscape reflow moves it, so bring it back into view once */
  var landed = false;
  function land() {
    if (landed || !location.hash || location.hash.length < 2) return;
    var t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (!t) return;
    landed = true; try { t.scrollIntoView({ block: "start" }); } catch (e) { t.scrollIntoView(); }
  }
  g.addEventListener("load", function () { apply(); setTimeout(land, 60); setTimeout(function () { landed = false; land(); }, 900); });
  g.addEventListener("resize", apply, { passive: true });
  g.addEventListener("orientationchange", function () { setTimeout(apply, 60); });
})(window);
