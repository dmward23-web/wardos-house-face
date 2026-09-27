/* House face · Prism zoom · header [ − | 100% | + ] · house-zoom:v1 · ★ no $ */
(function (global) {
  "use strict";

  var KEY = "house-zoom:v1";
  var STEPS = [0.7, 0.8, 0.9, 1];
  var DEFAULT = 1;

  function clampStep(n) {
    n = Number(n);
    if (!isFinite(n)) return DEFAULT;
    var best = STEPS[0];
    var bestD = Math.abs(STEPS[0] - n);
    for (var i = 1; i < STEPS.length; i++) {
      var d = Math.abs(STEPS[i] - n);
      if (d < bestD) { best = STEPS[i]; bestD = d; }
    }
    return best;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw == null || raw === "") return DEFAULT;
      return clampStep(parseFloat(raw));
    } catch (e) {
      return DEFAULT;
    }
  }

  function save(scale) {
    try { localStorage.setItem(KEY, String(scale)); } catch (e) { /* */ }
  }

  function apply(scale) {
    scale = clampStep(scale);
    var panel = document.querySelector(".panel");
    if (!panel) return scale;

    // Prefer CSS zoom (Chromium / kitchen tablets). Fallback: transform.
    var supportsZoom = typeof panel.style.zoom !== "undefined";
    if (supportsZoom) {
      panel.style.zoom = String(scale);
      panel.style.transform = "";
      panel.style.transformOrigin = "";
      panel.style.marginBottom = "";
      document.documentElement.style.setProperty("--house-zoom", String(scale));
    } else {
      panel.style.zoom = "";
      panel.style.transformOrigin = "top center";
      panel.style.transform = "scale(" + scale + ")";
      // reclaim layout gap when scaled down
      var h = panel.offsetHeight || 1200;
      panel.style.marginBottom = Math.round(h * (scale - 1)) + "px";
      document.documentElement.style.setProperty("--house-zoom", String(scale));
    }
    document.documentElement.setAttribute("data-house-zoom", String(scale));
    return scale;
  }

  function label(scale) {
    return Math.round(scale * 100) + "%";
  }

  function syncUI(root, scale) {
    root = root || document;
    root.querySelectorAll("[data-zoom-pct]").forEach(function (el) {
      el.textContent = label(scale);
    });
  }

  function stepIndex(scale) {
    scale = clampStep(scale);
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i] === scale) return i;
    return STEPS.indexOf(DEFAULT);
  }

  function setScale(scale) {
    scale = apply(scale);
    save(scale);
    syncUI(document, scale);
    return scale;
  }

  function bump(dir) {
    var i = stepIndex(load());
    i = Math.max(0, Math.min(STEPS.length - 1, i + dir));
    return setScale(STEPS[i]);
  }

  function controlHTML() {
    return (
      '<div class="house-zoom" data-house-zoom-ctl role="group" aria-label="Board zoom">' +
        '<button type="button" class="hz-btn hz-minus" data-zoom-minus aria-label="Zoom out">−</button>' +
        '<button type="button" class="hz-pct" data-zoom-pct title="Reset to 100%">100%</button>' +
        '<button type="button" class="hz-btn hz-plus" data-zoom-plus aria-label="Zoom in">+</button>' +
      "</div>"
    );
  }

  function ensureControl() {
    var existing = document.querySelector("[data-house-zoom-ctl]");
    if (existing) return existing;

    var html = controlHTML();
    // Prefer after Home/Week nav-row
    var nav = document.querySelector(".hdr .nav-row, header.hdr .nav-row, .hdr-left .nav-row");
    if (nav) {
      nav.insertAdjacentHTML("afterend", html);
      return document.querySelector("[data-house-zoom-ctl]");
    }
    // index.html / sheets with home-btn only
    var home = document.querySelector(".hdr .home-btn, header .home-btn, a.home-btn");
    if (home && home.parentNode) {
      home.insertAdjacentHTML("afterend", html);
      return document.querySelector("[data-house-zoom-ctl]");
    }
    // Week back link on sheet-index
    var back = document.querySelector(".hdr .back, header.hdr a.back");
    if (back && back.parentNode) {
      back.insertAdjacentHTML("afterend", html);
      return document.querySelector("[data-house-zoom-ctl]");
    }
    var left = document.querySelector(".hdr-left, header.hdr .hdr-left, .hdr");
    if (left) {
      left.insertAdjacentHTML("beforeend", html);
      return document.querySelector("[data-house-zoom-ctl]");
    }
    return null;
  }

  function wire(ctl) {
    if (!ctl || ctl._hzWired) return;
    ctl._hzWired = true;
    var minus = ctl.querySelector("[data-zoom-minus]");
    var plus = ctl.querySelector("[data-zoom-plus]");
    var pct = ctl.querySelector("[data-zoom-pct]");
    if (minus) minus.addEventListener("click", function () {
      bump(-1);
      if (window.HouseSfx) try { HouseSfx.tap(); } catch (e) {}
    });
    if (plus) plus.addEventListener("click", function () {
      bump(1);
      if (window.HouseSfx) try { HouseSfx.tap(); } catch (e) {}
    });
    if (pct) pct.addEventListener("click", function () {
      setScale(1);
      if (window.HouseSfx) try { HouseSfx.tap(); } catch (e) {}
    });
  }

  function mount() {
    var scale = load();
    apply(scale);
    var ctl = ensureControl();
    if (ctl) {
      wire(ctl);
      syncUI(ctl, scale);
    }
    return scale;
  }

  global.HouseZoom = {
    KEY: KEY,
    STEPS: STEPS,
    mount: mount,
    setScale: setScale,
    load: load,
    apply: apply
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mount(); });
  } else {
    mount();
  }
})(window);
