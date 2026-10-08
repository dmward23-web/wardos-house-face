/* House Face · ORIHOME11 · mount the living world and fly into a scene on every board tap.
   Original code. The forest is ori/ori-scene.js (painted plates + motes). No Ori assets.
   HouseSfx owns the tap. This file adds the level-enter whoosh on the same mixer, so mute still wins.
   A key-less screen is left alone: no key modal from here. */
(function () {
  "use strict";
  if (window.HouseOri && window.HouseOri.booted) return;
  var PAGE = (location.pathname.split("/").pop() || "sheet-index.html").toLowerCase();
  var HOME = PAGE === "sheet-index.html" || PAGE === "index.html";
  /* These boards are a living world. A reduced-motion capture was shipping a still map and a skipped veil. */
  var REDUCED = false;
  document.documentElement.classList.add("ori-on");
  if (HOME) document.documentElement.classList.add("ori-home");

  /* Spotify already is a full scene. Never stack a second WebGL world on it. */
  if (document.getElementById("spw-world")) {
    window.HouseOri = { booted: true, skip: "spotify" };
    return;
  }

  var THEMES = {
    "sheet-index.html": { acc: "#8ee7ff", key: "#d5f6a8", rays: 1.15 },
    "index.html": { acc: "#8ee7ff", key: "#d5f6a8", rays: 1.15 },
    "month.html": { acc: "#f0c56a", key: "#9fd4ff", rays: 1.05 },
    "month-chat.html": { acc: "#e7c4ff", key: "#f0c56a", rays: 0.95 },
    "sheet-lights.html": { acc: "#ffe08a", key: "#8ee7ff", rays: 1.2 },
    "sheet-google-home.html": { acc: "#9ad7ff", key: "#8dffc8", rays: 1.1 },
    "nest-webrtc.html": { acc: "#b9e4ff", key: "#e7f6ff", rays: 0.85 },
    "sheet-today.html": { acc: "#ffe9a8", key: "#8ee7ff", rays: 1.25 },
    "sheet-chores.html": { acc: "#b6f0c0", key: "#ffe08a", rays: 1 },
    "sheet-groceries.html": { acc: "#c6f59a", key: "#8ee7ff", rays: 1 },
    "sheet-allowance.html": { acc: "#ffe08a", key: "#f0c8ff", rays: 1 },
    "sheet-weekend.html": { acc: "#f0b4e8", key: "#8ee7ff", rays: 1.1 },
    "sheet-win.html": { acc: "#9fd4ff", key: "#ffe08a", rays: 1.15 },
    "sheet-dan.html": { acc: "#ffe08a", key: "#8ee7ff", rays: 1 },
    "sheet-dinner.html": { acc: "#ffc8a0", key: "#ffe08a", rays: 1.05 },
    "sheet-countdowns.html": { acc: "#f0c8ff", key: "#8ee7ff", rays: 1 },
    "sheet-pack.html": { acc: "#c6e4ff", key: "#ffe08a", rays: 0.95 },
    "sheet-us.html": { acc: "#f0c0d4", key: "#8ee7ff", rays: 1 },
    "sheet-load-day.html": { acc: "#ffd0a8", key: "#8ee7ff", rays: 1.1 },
    "sheet-status.html": { acc: "#b8d4e8", key: "#8ee7ff", rays: 0.8 },
    "sheet-gallery.html": { acc: "#d0e8ff", key: "#f0c8ff", rays: 1 },
    "sheet-gallery-hero.html": { acc: "#d0e8ff", key: "#ffe08a", rays: 1 },
    "sheet-desk-gate.html": { acc: "#c8d8e8", key: "#8ee7ff", rays: 0.75 }
  };
  var theme = THEMES[PAGE] || { acc: "#8ee7ff", key: "#d5f6a8", rays: 1 };

  function phone() {
    try { return Math.min(screen.width, screen.height) <= 700; } catch (e) { return false; }
  }
  var small = phone();
  var phoneLayout = false;
  try { phoneLayout = document.documentElement.classList.contains("ori-phone"); } catch (e) {}
  var CAPTURE = false, FORCE_CSS = false;
  try {
    CAPTURE = /(?:\?|&)ori-capture=1(?:&|$)/.test(location.search);
    FORCE_CSS = /(?:\?|&)ori-css=1(?:&|$)/.test(location.search);
  } catch (e) {}
  if (CAPTURE) document.documentElement.classList.add("ori-capture");

  var host = document.createElement("div");
  host.id = "ori-world";
  host.className = "ori-world";
  host.setAttribute("aria-hidden", "true");
  var fallback = document.createElement("div");
  fallback.className = "ori-fallback ori-painted";
  fallback.setAttribute("aria-hidden", "true");
  function fbLayer(cls) {
    var d = document.createElement("div");
    d.className = cls;
    fallback.appendChild(d);
    return d;
  }
  /* Painted plates (sky, soft grade, ray glint, mountains, island, near branches, foreground). Motion, shafts, fog, and motes stay in code. */
  fbLayer("ori-sky");
  fbLayer("ori-soft");
  fbLayer("ori-rays");
  fbLayer("ori-far");
  fbLayer("ori-mid");
  var light = fbLayer("ori-light");
  fbLayer("ori-near");
  fbLayer("ori-fore");
  fbLayer("ori-fog");
  var motes = fbLayer("ori-motes");
  var shaft = document.createElement("div"); shaft.className = "ori-shaft"; light.appendChild(shaft);
  var shaft2 = document.createElement("div"); shaft2.className = "ori-shaft ori-shaft-b"; light.appendChild(shaft2);
  for (var i = 0; i < 18; i++) motes.appendChild(document.createElement("i"));
  document.body.insertBefore(fallback, document.body.firstChild);
  document.body.insertBefore(host, document.body.firstChild);

  var world = null;
  var O = window.OriScene;
  /* The phone shows cover-fit painted plates. WebGL's tall crop left a black edge. */
  if (!phoneLayout && !FORCE_CSS && O && O.World) {
    try {
      world = new O.World(host, {
        plates: "ori/plates/",
        layouts: {
          phone: { W: 1280, H: 720, light: [0.83, 0.4], plates: "grove" },
          single: { W: 1280, H: 720, light: [0.83, 0.4], plates: "grove" }
        },
        pickLayout: function (a) { return a < 0.8 ? "phone" : "single"; },
        motes: small ? 64 : 120,
        fonts: false,
        hotLight: 1.35,
        preserve: true,
        reduced: false,
        config: {
          dprMax: small ? 1.5 : 1.6,
          renderScale: small ? 0.85 : 1,
          fpsCap: 120,
          bloom: small ? 0.45 : 0.55,
          vig: HOME ? 0.22 : 0.7,
          ion: { acc: theme.acc, acc2: theme.key, ink: "#eaf6ff", ground: "#041018" },
          sound: { muted: true, ambient: false, volume: 0 }
        },
        theme: function (wd) {
          var t = O.oriTheme(wd, { acc: theme.acc, key: theme.key, rays: theme.rays, night: 0.12, fog: 0.62 });
          /* Full-bleed plates. An edge mask left a dark gap down the side of the phone. */
          if (HOME && t && t.fore) t.fore.edge = 0;
          if (HOME && t && t.ground) t.ground.edge = 0;
          return t;
        }
      });
    } catch (err) {
      try { console.info("[house-ori] world failed", err); } catch (e2) {}
      world = null;
    }
  }

  function readFrom() {
    var o = null;
    try { o = JSON.parse(sessionStorage.getItem("ori-from") || "null"); } catch (e) {}
    try { sessionStorage.removeItem("ori-from"); } catch (e) {}
    var m = /from=([\d.]+),([\d.]+)/.exec(location.hash || "");
    if (m) o = { x: +m[1], y: +m[2], t: Date.now() };
    if (m) {
      var next = (location.hash || "").replace(/[&?]?from=[\d.]+,[\d.]+/, "").replace(/^#$/, "");
      try { history.replaceState(null, "", location.pathname + location.search + (next && next !== "#" ? next : "")); } catch (e) {}
    }
    if (!o || o.x == null || !isFinite(o.x)) return null;
    if (o.t && Date.now() - o.t > 12000) return null;
    return o;
  }

  function arrive(fx, fy) {
    if (REDUCED) return;
    var veil = document.createElement("div");
    veil.className = "ori-arrive";
    veil.setAttribute("data-ori-veil", "1");
    veil.style.setProperty("--x", (fx * 100) + "%");
    veil.style.setProperty("--y", (fy * 100) + "%");
    document.documentElement.setAttribute("data-ori-veil", "1");
    document.body.appendChild(veil);
    setTimeout(function () {
      document.documentElement.classList.remove("ori-arriving");
      document.documentElement.classList.remove("ori-held");
      if (veil.parentNode) veil.remove();
    }, 620);
  }

  var from = readFrom();
  var fx0 = from ? Math.min(1, Math.max(0, from.x)) : 0.72;
  var fy0 = from ? Math.min(1, Math.max(0, from.y)) : 0.1;
  if ((from || document.documentElement.classList.contains("ori-arriving")) && !document.querySelector(".ori-iris")) arrive(fx0, fy0);

  /* Quality governor. First ~2s measures render cost (not the rAF gap), then steps
     dpr, scale, layers, and bloom until a frame fits in 15ms (~60fps).
     ProMotion (rAF gap under 10ms and cost under 8ms) may climb to 120.
     The floor tier has to hold ~50fps or the painted world comes down and the CSS forest stays. */
  var TIERS = [
    { id: "promo", dprMax: 2, renderScale: 1, bloom: 0.62, bloomLevels: 6, layers: 5, fog: true, shafts: 5, wisps: true, moteStep: 1 },
    { id: "high", dprMax: 1.5, renderScale: 0.85, bloom: 0.45, bloomLevels: 5, layers: 5, fog: true, shafts: 5, wisps: true, moteStep: 1 },
    { id: "mid", dprMax: 1.25, renderScale: 0.75, bloom: 0.28, bloomLevels: 4, layers: 4, fog: true, shafts: 3, wisps: true, moteStep: 2 },
    { id: "low", dprMax: 1, renderScale: 0.6, bloom: 0.12, bloomLevels: 3, layers: 4, fog: false, shafts: 2, wisps: false, moteStep: 2 },
    { id: "floor", dprMax: 1, renderScale: 0.45, bloom: 0, bloomLevels: 0, layers: 3, fog: false, shafts: 0, wisps: false, moteStep: 3 }
  ];
  var WALL = { id: "wall", dprMax: 1.6, renderScale: 1, bloom: 0.55, bloomLevels: 6, layers: 5, fog: true, shafts: 5, wisps: true, moteStep: 1 };
  var budgetLog = [];
  function applyTier(w, tier) {
    w.cfg.dprMax = tier.dprMax;
    w.cfg.renderScale = tier.renderScale;
    w.cfg.bloom = tier.bloom;
    w.tierBloom = tier.bloom;
    w.bloomLevels = tier.bloomLevels;
    w.tierLayers = tier.layers;
    w.tierFog = tier.fog;
    w.shaftN = tier.shafts;
    w.tierWisps = tier.wisps;
    w.moteStep = tier.moteStep;
    w.tierId = tier.id;
    if (w.S) w.S.bloomLevels = tier.bloomLevels;
    try { w.resize(); } catch (e) {}
  }
  function logBudget(tier, avg, p95, px) {
    var present = tier.gap > 0 ? 1000 / tier.gap : 0;
    var row = { tier: tier.id, draw: +avg.toFixed(2), p95: +p95.toFixed(2), present: Math.round(present), gap: tier.gap || 0, px: px, dpr: tier.dprMax, scale: tier.renderScale, bloom: tier.bloom, layers: tier.layers, bloomLevels: tier.bloomLevels };
    budgetLog.push(row);
    try { console.info("[house-ori] budget " + tier.id + " draw " + avg.toFixed(1) + "ms present " + (tier.gap || 0) + "ms fps " + present.toFixed(1) + " px " + px); } catch (e) {}
    return row;
  }
  function govern(w0) {
    if (!w0 || !w0.S) return;
    var steps = small ? [TIERS[1], TIERS[2], TIERS[3], TIERS[4]] : [WALL, TIERS[1], TIERS[2], TIERS[3], TIERS[4]];
    var idx = 0;
    var costs = [];
    var gaps = [];
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var mode = "sample";
    applyTier(w0, steps[0]);
    w0.cfg.fpsCap = 120;
    w0.costSync = true;
    function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function pack(arr) {
      if (!arr.length) return { avg: 999, p95: 999 };
      var s = arr.slice().sort(function (a, b) { return a - b; });
      var sum = 0, i;
      for (i = 0; i < s.length; i++) sum += s[i];
      return { avg: sum / s.length, p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] };
    }
    function pxOf(w) { try { var st = w.stats(); return (st.w || 0) + "x" + (st.h || 0); } catch (e) { return "0x0"; } }
    function gapMed() {
      if (!gaps.length) return 16;
      var g = gaps.slice().sort(function (a, b) { return a - b; });
      return g[g.length >> 1];
    }
    function publish(tierName, cap) {
      if (!window.HouseOri) return;
      window.HouseOri.tier = tierName;
      window.HouseOri.budget = budgetLog;
      window.HouseOri.fpsCap = cap;
      window.HouseOri.world = world;
    }
    w0.onFrameCost = function (ms) {
      if (!world || mode === "lock" || document.hidden) return;
      var elapsed = nowMs() - t0;
      if (elapsed < 380) return;
      costs.push(ms);
      if (world.frameGap) gaps.push(world.frameGap * 1000);
      var need = (mode === "promo" || idx > 0) ? 900 : 1600;
      var ready = elapsed >= 380 + need && (costs.length >= 8 || elapsed >= 380 + need + 2200);
      if (!ready) return;
      if (!costs.length) {
        mode = "lock";
        try { world.destroy(); } catch (e) {}
        world = null;
        document.documentElement.classList.remove("ori-gl");
        document.documentElement.classList.add("ori-nogl");
        try { console.info("[house-ori] css-forest no frames"); } catch (e2) {}
        publish("css", 0);
        return;
      }
      var sample = costs.length > 4 ? costs.slice(2) : costs;
      var st = pack(sample);
      var tier = mode === "promo" ? TIERS[0] : steps[idx];
      var gm = gapMed();
      tier.gap = Math.round(gm);
      logBudget(tier, st.avg, st.p95, pxOf(world));
      try { console.info("[house-ori] gap " + tier.id + " " + gm.toFixed(1) + "ms"); } catch (eGap) {}
      /* The present interval is the number that matters. WebGL records the draw
         in well under a millisecond and the GPU bill shows up as a stretched frame. */
      var hold60 = gm > 0 && gm <= 18.5;
      if (mode === "promo") {
        world.costSync = false;
        if (st.avg < 8 && gm < 10) {
          world.cfg.fpsCap = 120;
          mode = "lock";
          try { console.info("[house-ori] lock promo 120 gap " + gm.toFixed(1) + "ms"); } catch (e) {}
          publish("promo", 120);
        } else {
          applyTier(world, steps[0]);
          world.cfg.fpsCap = 60;
          mode = "lock";
          try { console.info("[house-ori] lock " + steps[0].id + " 60"); } catch (e) {}
          publish(steps[0].id, 60);
        }
        return;
      }
      if (hold60) {
        if (small && idx === 0 && st.avg < 8 && gm < 10) {
          mode = "promo";
          costs = []; gaps = []; t0 = nowMs();
          applyTier(world, TIERS[0]);
          return;
        }
        world.costSync = false;
        world.cfg.fpsCap = (st.avg < 8 && gm < 10) ? 120 : 60;
        mode = "lock";
        try { console.info("[house-ori] lock " + tier.id + " " + world.cfg.fpsCap); } catch (e) {}
        publish(tier.id, world.cfg.fpsCap);
        return;
      }
      if (idx >= steps.length - 1) {
        world.costSync = false;
        if (gm > 20 || st.avg > 20) {
          try { world.destroy(); } catch (e) {}
          world = null;
          document.documentElement.classList.remove("ori-gl");
          document.documentElement.classList.add("ori-nogl");
          try { console.info("[house-ori] css-forest floor present " + gm.toFixed(0) + "ms"); } catch (e2) {}
          publish("css", 0);
        } else {
          world.costSync = false;
          world.cfg.fpsCap = 60;
          mode = "lock";
          try { console.info("[house-ori] lock floor " + st.avg.toFixed(1) + "ms"); } catch (e) {}
          publish("floor", 60);
        }
        return;
      }
      idx += 1;
      costs = []; gaps = []; t0 = nowMs();
      applyTier(world, steps[idx]);
    };
  }

  if (world && world.S) {
    document.documentElement.classList.add("ori-gl");
    world.exposure = HOME ? 2.05 : 1.45;
    if (O.Orb) {
      [[0.14, 0.24, 0.011], [0.86, 0.2, 0.009], [0.22, 0.62, 0.008], [0.76, 0.66, 0.01], [0.48, 0.38, 0.007], [0.34, 0.84, 0.008], [0.66, 0.86, 0.009]].forEach(function (s, n) {
        world.add(new O.Orb({
          layer: n % 2 ? "mid" : "far",
          pass: n % 2 ? "mid" : "far",
          fx: s[0], fy: s[1], r: s[2], glow: 1.3, bob: 1.5,
          color: n % 2 ? theme.key : theme.acc
        }));
      });
    }
    var depthEls = [];
    if (HOME && !REDUCED && !phoneLayout) {
      [["header.hdr", 0.05], ["#hub-cam-deck", 0.1], [".hub-upper", 0.16], [".who-up", 0.22], [".grid-wrap", 0.3]].forEach(function (pair) {
        var el = document.querySelector(pair[0]);
        if (el) depthEls.push([el, pair[1]]);
      });
    }
    var lx = 0, ly = 0;
    world.afterRender = function () {
      if (!depthEls.length) return;
      var x = this.cam.x.v, y = this.cam.y.v;
      if (Math.abs(x - lx) < 0.2 && Math.abs(y - ly) < 0.2) return;
      lx = x; ly = y;
      for (var d = 0; d < depthEls.length; d++) {
        depthEls[d][0].style.transform = "translate3d(" + (x * depthEls[d][1]).toFixed(2) + "px," + (y * depthEls[d][1]).toFixed(2) + "px,0)";
      }
    };
    if (HOME) {
      /* Landscape plates. scrollMax stays inside the cover crop so the fastest layer does not run off the painting. */
      world.scrollMax = 0.2;
      world.applyScrollCam = function () {
        var doc = document.documentElement;
        var max = Math.max(1, (doc.scrollHeight || 0) - (window.innerHeight || 1));
        var y = window.scrollY || doc.scrollTop || 0;
        var f = Math.max(0, Math.min(1, y / max));
        this.scroll.t = f * this.scrollMax;
        if (CAPTURE) { this.scroll.v = this.scroll.t; this.scroll.vel = 0; }
        this.cam.y.v += (0.42 - f) * 28;
        this.cam.x.v += Math.sin(f * Math.PI) * 18;
        doc.style.setProperty("--ori-scroll", f.toFixed(4));
      };
      window.addEventListener("scroll", function () { if (world && world.kick) world.kick(); }, { passive: true });
    }
    var entered = false;
    function openEye() {
      if (entered) return;
      entered = true;
      if (CAPTURE) {
        try { world.pause(true); } catch (e) {}
        document.documentElement.classList.add("ori-capture-ready");
        return;
      }
      var wpx = (world.cssW || window.innerWidth || 1);
      var hpx = (world.cssH || window.innerHeight || 1);
      try { world.enter({ from: [fx0 * wpx, fy0 * hpx], dur: REDUCED ? 0.35 : 1.2 }); } catch (e) {}
    }
    world.onReady = openEye;
    if (CAPTURE) {
      applyTier(world, { id: "high", dprMax: 2, renderScale: 1, bloom: 0.55, bloomLevels: 5, layers: 5, fog: true, shafts: 5, wisps: true, moteStep: 1 });
      world.cfg.fpsCap = 60;
      world.costSync = false;
      world.exposure = HOME ? 2.05 : 1.45;
    }
    try { world.start(); } catch (e) { document.documentElement.classList.remove("ori-gl"); }
    if (!CAPTURE) {
      setTimeout(openEye, 2400);
      govern(world);
    } else {
      setTimeout(function () {
        if (!entered) openEye();
      }, 8000);
    }
    document.addEventListener("visibilitychange", function () {
      if (!world || !world.pause) return;
      world.pause(document.hidden);
    });
    window.addEventListener("pointermove", function (ev) {
      if (!world || REDUCED || !O.util) return;
      world.ptr = { x: ev.clientX / Math.max(1, innerWidth) * 2 - 1, y: ev.clientY / Math.max(1, innerHeight) * 2 - 1, t: O.util.now() };
      world.kick();
    }, { passive: true });
  } else {
    document.documentElement.classList.add("ori-nogl");
  }

  /* CSS forest travels with the page even when the painted world is down. */
  if (HOME) {
    function cssTravel() {
      var doc = document.documentElement;
      var max = Math.max(1, (doc.scrollHeight || 0) - (window.innerHeight || 1));
      var y = window.scrollY || doc.scrollTop || 0;
      doc.style.setProperty("--ori-scroll", Math.max(0, Math.min(1, y / max)).toFixed(4));
    }
    window.addEventListener("scroll", cssTravel, { passive: true });
    cssTravel();
  }

  /* Phone home is the painted map. Names live as glowing text on the landmarks, not as pills. */
  if (HOME && phoneLayout) mountMap();

  function mountMap() {
    var panel = document.querySelector("body > .panel");
    if (!panel || panel.querySelector(":scope > .ori-path")) return;
    var canvas = document.createElement("canvas");
    canvas.className = "ori-path";
    canvas.setAttribute("aria-hidden", "true");
    panel.insertBefore(canvas, panel.firstChild);
    var spirit = document.createElement("div");
    spirit.className = "ori-spirit";
    spirit.setAttribute("aria-hidden", "true");
    spirit.innerHTML = "<i></i><b></b>";
    document.body.appendChild(spirit);
    var spiritXY = [36, 36];
    var spiritToken = 0;
    var spiritHeld = false;
    var SPIRIT_R = 36;
    function cardBoxes() {
      var out = [];
      document.querySelectorAll("header.hdr .hdr-date, header.hdr .hdr-ovals, header.hdr .wx-card, #hub-cam-deck, .leaveby, #hub-lights-panel, #hub-spotify-strip, .who-up, .tile-grid > .tile, .ori-peek.is-open").forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width < 12 || r.height < 12 || r.bottom < 0 || r.top > innerHeight) return;
        out.push(r);
      });
      return out;
    }
    function spiritHits(x, y, boxes) {
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (x > b.left - SPIRIT_R && x < b.right + SPIRIT_R && y > b.top - SPIRIT_R && y < b.bottom + SPIRIT_R) return true;
      }
      return false;
    }
    function clampSpirit(x, y) {
      var m = SPIRIT_R;
      return [Math.max(m, Math.min(innerWidth - m, x)), Math.max(m, Math.min(innerHeight - m, y))];
    }
    function parkSpirit(x, y) {
      var boxes = cardBoxes();
      var c = clampSpirit(x, y);
      x = c[0];
      y = c[1];
      if (!spiritHits(x, y, boxes)) return [x, y];
      for (var rad = 18; rad <= 340; rad += 16) {
        for (var k = 0; k < 18; k++) {
          var ang = (k / 18) * Math.PI * 2;
          var n = clampSpirit(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
          if (!spiritHits(n[0], n[1], boxes)) return n;
        }
      }
      return clampSpirit(innerWidth * 0.18, innerHeight * 0.5);
    }
    function segmentClear(x0, y0, x1, y1, boxes) {
      var dist = Math.hypot(x1 - x0, y1 - y0);
      var n = Math.max(1, Math.ceil(dist / 8));
      for (var i = 1; i < n; i++) {
        var t = i / n;
        if (spiritHits(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, boxes)) return false;
      }
      return true;
    }
    function routeSpirit(x0, y0, x1, y1) {
      var boxes = cardBoxes();
      var pts = [[x0, y0]];
      var x = x0, y = y0, guard = 0;
      while (Math.hypot(x1 - x, y1 - y) > 12 && guard < 70) {
        guard++;
        var dx = x1 - x, dy = y1 - y, dist = Math.hypot(dx, dy) || 1;
        var step = Math.min(16, dist);
        var nx = x + dx / dist * step, ny = y + dy / dist * step;
        if (!spiritHits(nx, ny, boxes)) { x = nx; y = ny; pts.push([x, y]); continue; }
        var slid = false;
        for (var dir = -1; dir <= 1; dir += 2) {
          var s = clampSpirit(x + (-dy / dist) * 28 * dir, y + (dx / dist) * 28 * dir);
          if (!spiritHits(s[0], s[1], boxes)) { x = s[0]; y = s[1]; pts.push([x, y]); slid = true; break; }
        }
        if (!slid) { var p = parkSpirit(nx, ny); x = p[0]; y = p[1]; pts.push([x, y]); }
      }
      pts.push(parkSpirit(x1, y1));
      return pts;
    }
    function idleSpiritPoint() {
      var hdr = document.querySelector("header.hdr");
      var y = hdr ? hdr.getBoundingClientRect().bottom + 52 : 168;
      return [innerWidth * 0.16, y];
    }
    function placeSpirit(x, y, instant) {
      var dest = parkSpirit(x, y);
      x = dest[0];
      y = dest[1];
      var token = ++spiritToken;
      spirit.classList.add("ori-spirit-snap");
      if (instant || Math.hypot(x - spiritXY[0], y - spiritXY[1]) < 3) {
        spirit.style.left = Math.round(x) + "px";
        spirit.style.top = Math.round(y) + "px";
        spiritXY = [x, y];
        requestAnimationFrame(function () { if (token === spiritToken) spirit.classList.remove("ori-spirit-snap"); });
        return;
      }
      var pts = routeSpirit(spiritXY[0], spiritXY[1], x, y);
      var lens = [];
      var total = 0;
      for (var i = 1; i < pts.length; i++) {
        var len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        lens.push(len);
        total += len;
      }
      var start = 0;
      function step(now) {
        if (token !== spiritToken) return;
        if (!start) start = now;
        var u = Math.min(1, (now - start) / 700);
        var eased = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        var dist = eased * Math.max(total, 1);
        var acc = 0, px = pts[0][0], py = pts[0][1];
        for (var s = 0; s < lens.length; s++) {
          if (acc + lens[s] >= dist || s === lens.length - 1) {
            var f = lens[s] ? Math.max(0, Math.min(1, (dist - acc) / lens[s])) : 1;
            px = pts[s][0] + (pts[s + 1][0] - pts[s][0]) * f;
            py = pts[s][1] + (pts[s + 1][1] - pts[s][1]) * f;
            break;
          }
          acc += lens[s];
        }
        spirit.style.left = Math.round(px) + "px";
        spirit.style.top = Math.round(py) + "px";
        spiritXY = [px, py];
        if (u < 1) requestAnimationFrame(step);
        else spirit.classList.remove("ori-spirit-snap");
      }
      requestAnimationFrame(step);
    }
    (function sit() {
      var p = idleSpiritPoint();
      placeSpirit(p[0], p[1], true);
    })();
    var pathPts = [];
    var pathBlocks = [];
    function catmull(p0, p1, p2, p3, t) {
      var t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    function redrawPath() {
      var pr = panel.getBoundingClientRect();
      var w = Math.max(1, Math.round(panel.clientWidth));
      var h = Math.max(1, Math.round(panel.scrollHeight));
      if (pr.width < 8 || h < 8) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      var blocks = [];
      function remember(el) {
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        blocks.push({ l: r.left - pr.left, t: r.top - pr.top, r: r.right - pr.left, b: r.bottom - pr.top });
      }
      function gutterX(ypx) {
        var gaps = [{ l: 22, r: w - 22 }];
        for (var i = 0; i < blocks.length; i++) {
          var c = blocks[i];
          if (ypx < c.t - 20 || ypx > c.b + 20) continue;
          var next = [];
          for (var g = 0; g < gaps.length; g++) {
            var gap = gaps[g];
            var left = gap.l;
            var right = Math.min(gap.r, c.l - 16);
            if (right - left >= 16) next.push({ l: left, r: right });
            left = Math.max(gap.l, c.r + 16);
            right = gap.r;
            if (right - left >= 16) next.push({ l: left, r: right });
          }
          gaps = next;
          if (!gaps.length) break;
        }
        if (!gaps.length) return w * 0.5;
        var best = gaps[0];
        for (var k = 1; k < gaps.length; k++) {
          if (gaps[k].r - gaps[k].l > best.r - best.l) best = gaps[k];
        }
        return (best.l + best.r) / 2;
      }
      ["header.hdr", "#hub-cam-deck", ".leaveby", "#hub-lights-panel", "#hub-spotify-strip", ".who-up"].forEach(function (sel) {
        remember(document.querySelector(sel));
      });
      document.querySelectorAll(".hdr-date, .hdr-ovals, .wx-card, .tile-grid > .tile").forEach(remember);
      var y0 = 90;
      var header = document.querySelector("header.hdr");
      if (header) y0 = Math.max(y0, header.getBoundingClientRect().bottom - pr.top + 28);
      var raw = [];
      for (var y = y0; y <= h - 36; y += 18) raw.push([gutterX(y), y]);
      var sm = raw.map(function (p) { return [p[0], p[1]]; });
      for (var pass = 0; pass < 7; pass++) {
        var nxt = sm.map(function (p) { return [p[0], p[1]]; });
        for (var i = 1; i < sm.length - 1; i++) nxt[i][0] = sm[i - 1][0] * 0.25 + sm[i][0] * 0.5 + sm[i + 1][0] * 0.25;
        sm = nxt;
      }
      for (var j = 0; j < sm.length; j++) {
        sm[j][0] += Math.sin(sm[j][1] * 0.016) * 26 + Math.sin(sm[j][1] * 0.041 + 1.4) * 10;
        sm[j][1] += Math.sin(sm[j][0] * 0.02) * 4;
      }
      pathPts = sm;
      pathBlocks = blocks;
      trailReady = null;
      paintPath(0);
    }
    var trailReady = null;
    function ensureTrail() {
      if (trailReady && trailReady.width === canvas.width && trailReady.height === canvas.height) return trailReady;
      var off = document.createElement("canvas");
      off.width = canvas.width;
      off.height = canvas.height;
      var octx = off.getContext("2d");
      function trace() {
        octx.beginPath();
        octx.moveTo(pathPts[0][0], pathPts[0][1]);
        var last = pathPts.length - 1;
        for (var i = 0; i < last; i++) {
          var p0 = pathPts[Math.max(0, i - 1)];
          var p1 = pathPts[i];
          var p2 = pathPts[Math.min(last, i + 1)];
          var p3 = pathPts[Math.min(last, i + 2)];
          for (var s = 1; s <= 6; s++) {
            var u = s / 6;
            octx.lineTo(catmull(p0[0], p1[0], p2[0], p3[0], u), catmull(p0[1], p1[1], p2[1], p3[1], u));
          }
        }
      }
      function stroke(width, color) {
        octx.save();
        octx.lineCap = "round";
        octx.lineJoin = "round";
        octx.strokeStyle = color;
        octx.lineWidth = width;
        trace();
        octx.stroke();
        octx.restore();
      }
      stroke(54, "rgba(70, 160, 230, 0.13)");
      stroke(26, "rgba(130, 210, 255, 0.20)");
      stroke(9, "rgba(186, 242, 255, 0.55)");
      stroke(2.4, "rgba(248, 255, 255, 0.96)");
      trailReady = off;
      return off;
    }
    function paintPath(t) {
      var w = canvas.width, h = canvas.height;
      if (!w || !h || pathPts.length < 2) return;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(ensureTrail(), 0, 0);
      var n = pathPts.length;
      var phase = ((t || 0) * 0.00012) % 1;
      for (var k = 0; k < 12; k++) {
        var idx = ((phase + k / 12) % 1) * (n - 1);
        var i0 = Math.floor(idx);
        var f = idx - i0;
        var a = pathPts[i0], b = pathPts[Math.min(n - 1, i0 + 1)];
        var x = a[0] + (b[0] - a[0]) * f;
        var y = a[1] + (b[1] - a[1]) * f;
        var rad = 11 + (k % 3) * 4;
        ctx.fillStyle = "rgba(220, 250, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(140, 220, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(x, y, rad * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      for (var c = 0; c < pathBlocks.length; c++) {
        var box = pathBlocks[c];
        ctx.fillRect(box.l - 10, box.t - 10, (box.r - box.l) + 20, (box.b - box.t) + 20);
      }
      ctx.restore();
    }
    var life = document.createElement("div");
    life.className = "ori-life";
    life.setAttribute("aria-hidden", "true");
    var moteHtml = '<b class="ori-shaft-sweep"></b>';
    for (var mi = 0; mi < 22; mi++) {
      var left = 2 + ((mi * 41) % 92);
      var delay = (mi * 0.17).toFixed(2);
      var dur = (2.1 + (mi % 5) * 0.28).toFixed(2);
      var size = 26 + (mi % 5) * 8;
      var top = 6 + ((mi * 17) % 86);
      moteHtml += '<i style="left:' + left + '%;top:' + top + '%;width:' + size + 'px;height:' + size + 'px;animation-delay:-' + delay + 's;animation-duration:' + dur + 's"></i>';
    }
    life.innerHTML = moteHtml;
    document.body.insertBefore(life, document.body.firstChild);
    /* Dim only the orb sprites whose glow reaches a card. Opacity follows the
       distance from the sprite center to the card edge, so the falloff stays
       radial on the sprite. No mask, clip, or rectangle is painted on the art. */
    var motes = [].slice.call(life.querySelectorAll("i"));
    var orbCards = [];
    var orbCardAt = 0;
    function refreshOrbCards(ts) {
      if (orbCards.length && ts - orbCardAt < 180) return;
      orbCardAt = ts || 0;
      orbCards = cardBoxes();
    }
    function orbClearance(x, y) {
      var best = 1e9;
      for (var i = 0; i < orbCards.length; i++) {
        var b = orbCards[i];
        var dx = Math.max(b.left - x, 0, x - b.right);
        var dy = Math.max(b.top - y, 0, y - b.bottom);
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < best) best = d;
      }
      return best;
    }
    function dimOrbs(ts) {
      refreshOrbCards(ts);
      var reach = 118;
      for (var i = 0; i < motes.length; i++) {
        var el = motes[i];
        var r = el.getBoundingClientRect();
        if (r.width < 2) continue;
        var d = orbClearance(r.left + r.width * 0.5, r.top + r.height * 0.5);
        if (d >= reach) {
          if (el.style.getPropertyPriority("opacity") === "important") el.style.removeProperty("opacity");
          continue;
        }
        var t = d / reach;
        var s = t * t * (3 - 2 * t);
        el.style.setProperty("opacity", (0.05 + 0.95 * s).toFixed(3), "important");
      }
    }
    var lastSpark = 0;
    function lifeLoop(ts) {
      if (!lastSpark || ts - lastSpark > 48) {
        lastSpark = ts;
        paintPath(ts);
        dimOrbs(ts);
      }
      requestAnimationFrame(lifeLoop);
    }
    requestAnimationFrame(lifeLoop);
    function tidyWx() {
      var temp = document.querySelector("header.hdr .wx-temp");
      var sub = document.querySelector("header.hdr .wx-sub");
      if (!temp || !sub) return;
      var now = (String(temp.textContent || "").match(/(\d+)/) || [])[1];
      var hi = (String(sub.getAttribute("data-ori-hi") || sub.textContent || "").match(/(\d+)/) || [])[1];
      if (!sub.getAttribute("data-ori-hi") && /H\s*\d/.test(sub.textContent || "")) sub.setAttribute("data-ori-hi", sub.textContent);
      hi = (String(sub.getAttribute("data-ori-hi") || "").match(/H\s*(\d+)/) || [])[1] || hi;
      if (!now || !hi) return;
      var nextTemp = now + "°";
      var nextSub = "high " + hi + "°";
      if (temp.textContent !== nextTemp) temp.textContent = nextTemp;
      if (sub.textContent !== nextSub) sub.textContent = nextSub;
    }
    tidyWx();
    setTimeout(tidyWx, 600);
    setTimeout(tidyWx, 1800);
    var wx = document.querySelector("#house-wx");
    if (wx && window.MutationObserver) new MutationObserver(tidyWx).observe(wx, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", redrawPath);
    setTimeout(redrawPath, 80);
    setTimeout(redrawPath, 700);
    setTimeout(redrawPath, 2200);
    function cleanTitle(s) {
      s = String(s || "");
      s = s.replace(/\[[^\]]*\]/g, " ");
      s = s.replace(/\([^)]*\)/g, " ");
      s = s.replace(/#[A-Za-z0-9_-]+/g, " ");
      s = s.replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,}\b/g, " ");
      var cut = s.indexOf(" · ");
      if (cut >= 0) s = s.slice(0, cut);
      return s.replace(/\s+/g, " ").replace(/^[\s·—–\-|]+|[\s·—–\-|]+$/g, "").trim();
    }
    function isJohnson(s) { return /johnson\s+kids/i.test(String(s || "")); }
    function isAwareness(s) { return /no school|\ball day\b|awareness/i.test(String(s || "")); }
    function upcoming() {
      var out = [];
      var stops = document.querySelectorAll(".lb-day-stop");
      for (var i = 0; i < stops.length; i++) {
        var timeNode = stops[i].querySelector(".lb-day-t");
        var whatNode = stops[i].querySelector(".lb-day-what");
        var time = timeNode ? timeNode.textContent.replace(/\s+/g, " ").trim() : "";
        var raw = whatNode ? whatNode.textContent : "";
        if (/^all day$/i.test(time) || isAwareness(raw) || isJohnson(raw)) continue;
        var title = cleanTitle(raw);
        if (!title || isJohnson(title) || isAwareness(title)) continue;
        out.push({ time: time, title: title });
        if (out.length === 3) break;
      }
      return out;
    }
    var heroQuiet = false;
    function setText(el, value) {
      if (el && el.textContent !== value) el.textContent = value;
    }
    function tidyHero() {
      if (heroQuiet) return;
      var main = document.querySelector("[data-live='leaveby-main']");
      if (!main) return;
      var dest = main.querySelector(".leaveby-dest");
      if (!dest) return;
      heroQuiet = true;
      var raw = dest.getAttribute("data-ori-raw") || dest.textContent;
      if (!dest.getAttribute("data-ori-raw")) dest.setAttribute("data-ori-raw", raw);
      var timeEl = main.querySelector(".time");
      var items = upcoming();
      var awareness = !timeEl || isAwareness(raw) || isJohnson(raw) || /^all day$/i.test(timeEl ? timeEl.textContent : "");
      if (awareness) {
        if (items.length) {
          if (!timeEl) {
            timeEl = document.createElement("span");
            timeEl.className = "time";
            main.insertBefore(timeEl, dest);
          }
          setText(timeEl, items[0].time);
          setText(dest, items[0].title);
        } else {
          if (timeEl) setText(timeEl, "");
          setText(dest, "Clear");
        }
      } else {
        var title = cleanTitle(raw);
        if (title) setText(dest, title);
      }
      setTimeout(function () { heroQuiet = false; }, 0);
    }
    function fillPeek() {
      var card = document.querySelector(".ori-peek-card");
      if (!card) return;
      var items = upcoming();
      card.innerHTML = items.length ? items.map(function (it) {
        return "<p><b>" + it.time.replace(/</g, "") + "</b> " + it.title.replace(/</g, "") + "</p>";
      }).join("") : "<p>Nothing else coming up</p>";
    }
    var deck = document.querySelector("#hub-cam-deck");
    if (deck && !deck.querySelector(".ori-pool-hit")) {
      var peek = document.createElement("div");
      peek.className = "ori-peek";
      peek.innerHTML = '<div class="ori-peek-card"></div>';
      document.body.appendChild(peek);
      var hit = document.createElement("button");
      hit.type = "button";
      hit.className = "ori-pool-hit";
      hit.setAttribute("aria-label", "Show the next three leaves");
      deck.appendChild(hit);
      var peekOpen = false;
      hit.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        peekOpen = !peekOpen;
        if (peekOpen) {
          fillPeek();
          var floor = 0;
          deck.querySelectorAll(".hub-cam, .hub-cam-label, .hub-cam-media-wrap").forEach(function (el) {
            floor = Math.max(floor, el.getBoundingClientRect().bottom);
          });
          if (!floor) floor = deck.getBoundingClientRect().bottom;
          var pool = deck.getBoundingClientRect();
          peek.style.top = Math.round(floor + 16) + "px";
          peek.style.transformOrigin = "50% " + Math.round((pool.top + 48) - (floor + 16)) + "px";
          deck.classList.add("ori-pool-live");
          requestAnimationFrame(function () {
            requestAnimationFrame(function () { if (peekOpen) peek.classList.add("is-open"); });
          });
        } else {
          peek.classList.remove("is-open");
          deck.classList.remove("ori-pool-live");
        }
        setTimeout(redrawPath, 360);
      });
    }
    tidyHero();
    setTimeout(tidyHero, 500);
    setTimeout(tidyHero, 1700);
    var leaveHost = document.querySelector(".leaveby");
    if (leaveHost && window.MutationObserver) {
      new MutationObserver(function () { tidyHero(); }).observe(leaveHost, { childList: true, subtree: true });
    }
    document.addEventListener("pointerdown", function (ev) {
      spiritHeld = true;
      var t = ev.target && ev.target.closest ? ev.target.closest("a, button, .tile, .hub-cam, .leaveby, #hub-lights-panel, .sp-tile, .who-up, header.hdr") : null;
      var x = ev.clientX, y = ev.clientY;
      if (t && t.getBoundingClientRect) {
        var r = t.getBoundingClientRect();
        x = r.left + Math.min(r.width * 0.72, r.width - 16);
        y = r.top + Math.min(22, r.height * 0.4);
      }
      placeSpirit(x, y, false);
    }, true);
    [400, 1200].forEach(function (ms) {
      setTimeout(function () { if (!spiritHeld) { var p = idleSpiritPoint(); placeSpirit(p[0], p[1], true); } }, ms);
    });
    window.HouseOri = window.HouseOri || {};
    window.__oriSpirit = placeSpirit;
  }

  /* House Face never shows money. Stars stay. Kid boards are not this script. */
  var MONEY = /\$\s?[\d,]+(?:\.\d+)?(?:\s*\/\s*hr)?(?:\s*ea\s*wk)?/gi;
  function scrub(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      if (node.nodeValue && node.nodeValue.indexOf("$") !== -1 && /\$\s?\d/.test(node.nodeValue)) {
        var next = node.nodeValue.replace(MONEY, "\u2605");
        next = next.replace(/Balance\s*★\s*·\s*Week\s*★\s*·\s*Jar\s*★\s*\/\s*★/i, "Stars · payday with Dad");
        if (next !== node.nodeValue) node.nodeValue = next;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT" || tag === "CODE") return;
    for (var c = node.firstChild; c; c = c.nextSibling) scrub(c);
  }
  function scrubTree(root) { try { scrub(root); } catch (e) {} }
  function disarmDollar() {
    var s = window.HouseSfx;
    if (!s || s._oriStars) return;
    s._oriStars = true;
    if (typeof s.floatDollar === "function") {
      s.floatDollar = function (el) { if (s.floatPopup) s.floatPopup(el, "\u2605"); };
    }
  }
  scrubTree(document.body);
  disarmDollar();
  var scrubT = 0;
  try {
    new MutationObserver(function (list) {
      var hit = false;
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === "characterData" && m.target && String(m.target.nodeValue || "").indexOf("$") >= 0) hit = true;
        else if (m.addedNodes) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var tx = m.addedNodes[j].textContent;
            if (tx && tx.indexOf("$") >= 0) hit = true;
          }
        }
      }
      if (!hit) return;
      clearTimeout(scrubT);
      scrubT = setTimeout(function () { scrubTree(document.body); }, 40);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  } catch (e) {}
  setTimeout(disarmDollar, 400);

  function whoosh() {
    var c = window.__houseAudioCtx, master = window.__houseMasterGain;
    if (!c || !master) return;
    try {
      if (c.state === "suspended" && c.resume) c.resume();
      var t = c.currentTime;
      var o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.32);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.6);
      var o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = "triangle";
      o2.frequency.setValueAtTime(660, t + 0.05);
      o2.frequency.exponentialRampToValueAtTime(1320, t + 0.4);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.035, t + 0.08);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o2.connect(g2); g2.connect(master);
      o2.start(t); o2.stop(t + 0.75);
    } catch (e) {}
  }

  function ripple(x, y) {
    if (REDUCED) return;
    var dot = document.createElement("div");
    dot.className = "ori-ripple";
    dot.style.left = x + "px";
    dot.style.top = y + "px";
    document.body.appendChild(dot);
    setTimeout(function () { if (dot.parentNode) dot.remove(); }, 600);
  }

  var diving = false;
  function isPage(href) {
    if (!href) return false;
    if (href.charAt(0) === "#") return false;
    if (/^(mailto:|tel:|javascript:|grokbot:|sms:|blob:)/i.test(href)) return false;
    if (/^https?:\/\//i.test(href)) {
      try { if (href.indexOf(location.host) < 0) return false; } catch (e) { return false; }
    }
    return true;
  }
  function samePage(href) {
    var path = String(href).split("#")[0].split("?")[0];
    if (!path || path === "." || path === "./") return true;
    return path.split("/").pop().toLowerCase() === PAGE;
  }
  function withFrom(href, x, y) {
    var fx = (x / Math.max(1, innerWidth)).toFixed(3);
    var fy = (y / Math.max(1, innerHeight)).toFixed(3);
    try { sessionStorage.setItem("ori-from", JSON.stringify({ x: +fx, y: +fy, t: Date.now() })); } catch (e) {}
    try { sessionStorage.setItem("ori-veil-next", String(Date.now())); } catch (e2) {}
    var hash = "from=" + fx + "," + fy;
    var i = href.indexOf("#");
    if (i < 0) return href + "#" + hash;
    if (/from=/.test(href)) return href;
    return href + (href.charAt(href.length - 1) === "#" ? "" : "&") + hash;
  }
  function flyTo(href, x, y, el, alsoTap) {
    if (diving) return;
    diving = true;
    var url = withFrom(href, x, y);
    if (alsoTap) { try { if (window.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {} }
    whoosh();
    ripple(x, y);
    if (el) el.classList.add("ori-portal-hot");
    var gone = false;
    function go() { if (gone) return; gone = true; location.href = url; }
    if (REDUCED) { go(); return; }
    try {
      var pre = document.createElement("link");
      pre.rel = "prefetch";
      pre.href = href.split("#")[0];
      document.head.appendChild(pre);
    } catch (ePre) {}
    document.documentElement.classList.add("ori-diving");
    document.querySelectorAll(".ori-iris, .ori-arrive").forEach(function (old) { old.remove(); });
    var iris = makeVeil();
    iris.style.setProperty("--x", x + "px");
    iris.style.setProperty("--y", y + "px");
    document.body.appendChild(iris);
    if (world && world.exit) {
      try { world.camPush(1.26, 0.6, x / Math.max(1, innerWidth), y / Math.max(1, innerHeight), 0.25); } catch (e) {}
      try { world.exit({ to: [x, y], dur: 0.6 }).then(go); } catch (e) {}
    }
    fadeCover(iris, 0, 1, 420, go);
    setTimeout(go, 800);
  }

  var SKIP = "button,input,select,textarea,label,summary,[data-sp-act],[data-sp-tile],[data-layout],.leaveby-chip,[data-check],.hub-sw,.hub-sw-rocker,.hub-sw-track,.hub-sw-dim,[data-hub-key-entry],[data-mute-toggle],.sctl,.quest,.chore,[contenteditable=true]";
  function portalOf(target) {
    if (!target || !target.closest) return null;
    if (target.closest(SKIP)) return null;
    var who = target.closest("[data-who-up]");
    if (who) {
      var go = who.querySelector("[data-who-go]");
      var href = go && go.getAttribute("href");
      return href ? { href: href, el: who } : null;
    }
    var a = target.closest("a[href], [data-go]");
    if (!a || a.closest("[data-sp-tile]")) return null;
    if (a.getAttribute("target") === "_blank" || a.hasAttribute("download")) return null;
    var dg = a.getAttribute("data-go");
    if (dg && dg.indexOf("mnav:") === 0) return null;
    var href2 = a.getAttribute("href") || dg;
    return href2 ? { href: href2, el: a } : null;
  }
  function onActivate(ev, fromKey) {
    if (diving) return;
    /* Earlier capture listeners own this tap (NEED KEY opens the paste box, never a modal from us). */
    if (ev.defaultPrevented) return;
    if (!fromKey && (ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return;
    var hit = portalOf(ev.target);
    if (!hit || !isPage(hit.href) || samePage(hit.href)) return;
    var rect = hit.el.getBoundingClientRect();
    var x = fromKey ? rect.left + rect.width / 2 : (ev.clientX || rect.left + rect.width / 2);
    var y = fromKey ? rect.top + rect.height / 2 : (ev.clientY || rect.top + rect.height / 2);
    ev.preventDefault();
    ev.stopPropagation();
    flyTo(hit.href, x, y, hit.el, fromKey);
  }
  document.addEventListener("click", function (ev) { onActivate(ev, false); }, true);
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    onActivate(ev, true);
  }, true);
  document.addEventListener("pointerdown", function (ev) {
    var el = ev.target && ev.target.closest && ev.target.closest("a,button,[role=button],[data-go],.tile,.hub-cam,.wx-card,.sensi-hdr");
    if (!el) return;
    if (el.closest("[data-sp-tile], a.tile")) {
      el.classList.add("ori-pressed");
      setTimeout(function () { el.classList.remove("ori-pressed"); }, 460);
      return;
    }
    el.classList.add("ori-pressed");
    setTimeout(function () { el.classList.remove("ori-pressed"); }, 460);
    try { if (window.HouseSfx && HouseSfx.tap) HouseSfx.tap(); } catch (e) {}
  }, true);

  function makeVeil() {
    var el = document.createElement("div");
    el.className = "ori-iris";
    el.setAttribute("data-ori-veil", "1");
    el.style.setProperty("animation", "none", "important");
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.zIndex = "2147483647";
    /* Solid, same as the html background. A photo veil flashes one flat frame
       while the next document decodes the image, and the clip reads that as a cut. */
    el.style.background = "#062018";
    el.style.opacity = "0";
    return el;
  }
  function fadeCover(el, from, to, dur, done) {
    el.style.setProperty("animation", "none", "important");
    var start = 0;
    function step(now) {
      if (!start) start = now;
      var t = Math.min(1, (now - start) / dur);
      el.style.opacity = String(from + (to - from) * t);
      /* A bare opacity change stays on a compositor layer that the capture
         never flattens. Nudging the transform and reading layout pushes
         every step into the screen buffer. */
      el.style.transform = "translate3d(0," + (t * 0.4).toFixed(3) + "px,0)";
      void el.offsetWidth;
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }
  function stampVeil() {
    try { sessionStorage.setItem("ori-veil-next", String(Date.now())); } catch (e) {}
  }
  function holdVeil() {
    if (document.querySelector(".ori-iris, .ori-arrive")) return;
    var veil = document.createElement("div");
    veil.className = "ori-iris";
    veil.setAttribute("data-ori-veil", "1");
    veil.style.setProperty("animation", "none", "important");
    veil.style.background = "#062018";
    veil.style.position = "fixed";
    veil.style.inset = "0";
    veil.style.zIndex = "2147483647";
    veil.style.opacity = "1";
    document.documentElement.classList.add("ori-held");
    document.documentElement.setAttribute("data-ori-veil", "1");
    if (document.body) document.body.appendChild(veil);
    void veil.offsetWidth;
  }
  /* One extra history entry so the first Back stays on this page long enough to veil, then leaves. */
  if (!HOME) {
    try {
      if (!history.state || !history.state.oriHold) history.pushState({ oriHold: 1 }, "", location.href);
    } catch (e) {}
    window.addEventListener("popstate", function () {
      if (diving) return;
      diving = true;
      stampVeil();
      document.querySelectorAll(".ori-iris, .ori-arrive").forEach(function (old) { old.remove(); });
      var iris = makeVeil();
      document.documentElement.classList.add("ori-diving");
      document.documentElement.setAttribute("data-ori-veil", "1");
      document.body.appendChild(iris);
      void iris.offsetWidth;
      /* Step the fade on painted frames, then load home fresh so the next
         document's first frame is the same veil. */
      fadeCover(iris, 0, 1, 420, function () {
        try { location.replace("sheet-index.html"); }
        catch (e) { location.href = "sheet-index.html"; }
      });
    });
  }
  window.addEventListener("pagehide", function () {
    stampVeil();
    var iris = document.querySelector(".ori-iris");
    if (iris) {
      iris.style.animation = "none";
      iris.style.opacity = "1";
      return;
    }
    holdVeil();
  });
  window.addEventListener("beforeunload", function () {});
  window.addEventListener("unload", function () {});
  window.addEventListener("pageshow", function (ev) {
    diving = false;
    document.documentElement.classList.remove("ori-diving");
    var back = false;
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      back = !!(nav && nav.type === "back_forward");
    } catch (e) {}
    if (ev.persisted || back || document.documentElement.classList.contains("ori-held")) {
      arrive(0.5, 0.32);
      document.documentElement.classList.remove("ori-held");
    }
    if (ev.persisted && world) { world.trans = null; try { world.kick(true); } catch (e) {} }
  });

  function mountMonthAgenda() {
    if (PAGE !== "month.html") return;
    var narrow = phoneLayout;
    try { if (window.matchMedia && matchMedia("(max-width: 700px)").matches) narrow = true; } catch (e) {}
    if (!narrow) return;
    var grid = document.querySelector(".month-grid");
    if (!grid) return;
    var range = document.querySelector("[data-month-range]");
    if (range) { range.textContent = ""; range.hidden = true; }
    var foot = document.querySelector(".ftr");
    if (foot) foot.hidden = true;
    var dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    function stripShown(s, keepTime) {
      s = String(s || "");
      s = s.replace(/\[[^\]]*\]/g, " ");
      s = s.replace(/#[A-Za-z0-9_-]+/g, " ");
      s = s.replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,}\b/g, " ");
      s = s.replace(/\(\s*\)/g, " ");
      if (!keepTime) {
        s = s.replace(/\([^)]*\)/g, " ");
        var cut = s.indexOf(" · ");
        if (cut >= 0) s = s.slice(0, cut);
      }
      return s.replace(/\s+/g, " ").replace(/\s+·/g, " ·").replace(/^[\s·—–\-|]+|[\s·—–\-|]+$/g, "").trim();
    }
    function build() {
      var days = grid.querySelectorAll(":scope > .day");
      if (!days.length) return;
      var y = +(grid.getAttribute("data-year") || 0);
      var m = +(grid.getAttribute("data-month") || 0);
      var html = "";
      for (var i = 0; i < days.length; i++) {
        var day = days[i];
        if (day.classList.contains("out")) continue;
        var dom = day.querySelector(".dom");
        var n = dom ? parseInt(dom.textContent, 10) : 0;
        if (!n) continue;
        var blks = day.querySelectorAll(".blk");
        var mom = day.querySelector(".mom");
        if (!blks.length && !mom && !day.classList.contains("today")) continue;
        var dt = new Date(y, m - 1, n);
        html += '<a class="ori-day' + (day.classList.contains("today") ? " is-today" : "") + '" href="sheet-today.html">';
        html += '<span class="ori-dom">' + dows[dt.getDay()] + " " + n + "</span>";
        if (mom) html += '<span class="ori-ev dan">' + mom.textContent.replace(/</g, "") + "</span>";
        for (var b = 0; b < blks.length; b++) {
          var title = stripShown(blks[b].getAttribute("title") || blks[b].textContent || "", true);
          var tone = (blks[b].className || "").replace(/\bblk\b/, "").trim();
          html += '<span class="ori-ev ' + tone + '">' + String(title).replace(/</g, "") + "</span>";
        }
        html += "</a>";
      }
      grid.innerHTML = html || '<p class="ori-day-empty">Nothing on the calendar this month</p>';
    }
    build();
    if (window.MutationObserver) new MutationObserver(function () { build(); }).observe(grid, { childList: true });
    function once() {
      var detail = document.querySelector("[data-live='leaveby-detail']");
      if (detail) { detail.hidden = true; detail.textContent = ""; }
      var dest = document.querySelector("[data-live='leaveby-main'] .leaveby-dest");
      if (!dest) return;
      var raw = dest.getAttribute("data-ori-raw") || dest.textContent;
      if (!dest.getAttribute("data-ori-raw")) dest.setAttribute("data-ori-raw", raw);
      var title = stripShown(raw, false);
      if (title && dest.textContent !== title) dest.textContent = title;
    }
    once();
    setTimeout(once, 400);
    setTimeout(once, 1600);
    var hero = document.querySelector("[data-live='leaveby-main']");
    if (hero && window.MutationObserver) new MutationObserver(function () { once(); }).observe(hero, { childList: true, subtree: true });
  }
  mountMonthAgenda();

  window.HouseOri = {
    booted: true,
    world: world,
    flyTo: flyTo,
    page: PAGE,
    theme: theme,
    tier: CAPTURE ? "high" : (world ? "probing" : "css"),
    budget: budgetLog,
    fpsCap: world && world.cfg ? world.cfg.fpsCap : 0,
    capture: CAPTURE,
    spiritTo: function (x, y, instant) { if (window.__oriSpirit) window.__oriSpirit(x, y, !!instant); },
    captureFrame: function (dt) {
      if (!world || !world.captureFrame) return false;
      world.captureFrame(dt);
      if (world.applyScrollCam) world.applyScrollCam();
      return true;
    }
  };
  if (CAPTURE && world) window.HouseOri.tier = "high";
})();
