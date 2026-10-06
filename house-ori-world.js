/* House Face · ORIHOME8 · mount the living world and fly into a scene on every board tap.
   Original code. The forest is ori/ori-scene.js (painted plates + motes). No Ori assets.
   HouseSfx owns the tap. This file adds the level-enter whoosh on the same mixer, so mute still wins.
   A key-less screen is left alone: no key modal from here. */
(function () {
  "use strict";
  if (window.HouseOri && window.HouseOri.booted) return;
  var PAGE = (location.pathname.split("/").pop() || "sheet-index.html").toLowerCase();
  var HOME = PAGE === "sheet-index.html" || PAGE === "index.html";
  var REDUCED = false;
  try { REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
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
  if (!FORCE_CSS && O && O.World) {
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
        config: {
          dprMax: small ? 1.5 : 1.6,
          renderScale: small ? 0.85 : 1,
          fpsCap: 120,
          bloom: small ? 0.45 : 0.55,
          vig: 1.15,
          ion: { acc: theme.acc, acc2: theme.key, ink: "#eaf6ff", ground: "#041018" },
          sound: { muted: true, ambient: false, volume: 0 }
        },
        theme: function (wd) { return O.oriTheme(wd, { acc: theme.acc, key: theme.key, rays: theme.rays, night: 0.15, fog: 0.85 }); }
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
    document.documentElement.classList.add("ori-enter");
    var veil = document.createElement("div");
    veil.className = "ori-arrive";
    veil.style.setProperty("--x", (fx * 100) + "%");
    veil.style.setProperty("--y", (fy * 100) + "%");
    document.body.appendChild(veil);
    setTimeout(function () { if (veil.parentNode) veil.remove(); }, 1300);
  }

  var from = readFrom();
  var fx0 = from ? Math.min(1, Math.max(0, from.x)) : 0.72;
  var fy0 = from ? Math.min(1, Math.max(0, from.y)) : 0.1;
  arrive(fx0, fy0);

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
    world.exposure = 1.45;
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
      world.exposure = 1.45;
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

  /* Zone names on the map. Absolute, so they don't shove the live layout. */
  if (HOME) {
    function zone(sel, name) {
      var el = document.querySelector(sel);
      if (!el || el.querySelector(":scope > .ori-place")) return;
      var p = document.createElement("div");
      p.className = "ori-place";
      p.setAttribute("aria-hidden", "true");
      p.textContent = name;
      el.appendChild(p);
    }
    zone("#hub-cam-deck", "Scrying pool");
    zone(".leaveby", "Waystones");
    zone("#hub-lights-panel", "Lantern grove");
    zone(".who-up", "Who walks");
    zone("#hub-spotify-strip", "Song tree");
    var title = document.querySelector(".grid-title");
    if (title) title.textContent = "Places";
    if (phoneLayout) mountMap();
  }

  function mountMap() {
    var panel = document.querySelector("body > .panel");
    if (!panel || panel.querySelector(":scope > .ori-path")) return;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ori-path");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M30 4 C70 12 24 28 68 44 C22 62 74 78 36 96");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "rgba(150, 220, 255, 0.45)");
    path.setAttribute("stroke-width", "7");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    var core = document.createElementNS("http://www.w3.org/2000/svg", "path");
    core.setAttribute("fill", "none");
    core.setAttribute("stroke", "rgba(236, 252, 255, 0.92)");
    core.setAttribute("stroke-width", "2");
    core.setAttribute("stroke-linecap", "round");
    core.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(path);
    svg.appendChild(core);
    panel.insertBefore(svg, panel.firstChild);
    var spirit = document.createElement("div");
    spirit.className = "ori-spirit";
    spirit.setAttribute("aria-hidden", "true");
    spirit.innerHTML = "<i></i><b></b>";
    document.body.appendChild(spirit);
    function placeSpirit(x, y, instant) {
      if (instant) spirit.classList.add("ori-spirit-snap");
      spirit.style.left = Math.round(x) + "px";
      spirit.style.top = Math.round(y) + "px";
      if (instant) requestAnimationFrame(function () { spirit.classList.remove("ori-spirit-snap"); });
    }
    placeSpirit(innerWidth * 0.62, 72, true);
    function redrawPath() {
      var sels = ["header.hdr", "#hub-cam-deck", ".leaveby", "#hub-lights-panel", "#hub-spotify-strip", ".who-up"];
      var pts = [];
      var pr = panel.getBoundingClientRect();
      if (pr.width < 8 || pr.height < 8) return;
      function add(el) {
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        pts.push([((r.left + r.width * 0.5 - pr.left) / pr.width) * 100, ((r.top + r.height * 0.45 - pr.top) / pr.height) * 100]);
      }
      for (var s = 0; s < sels.length; s++) add(document.querySelector(sels[s]));
      var tiles = document.querySelectorAll(".tile-grid > .tile");
      for (var n = 0; n < tiles.length; n++) add(tiles[n]);
      if (pts.length < 2) return;
      var d = "M " + pts[0][0].toFixed(2) + " " + pts[0][1].toFixed(2);
      for (var k = 1; k < pts.length; k++) {
        var a = pts[k - 1], b = pts[k];
        var cx = (a[0] + b[0]) / 2;
        d += " Q " + cx.toFixed(2) + " " + a[1].toFixed(2) + " " + b[0].toFixed(2) + " " + b[1].toFixed(2);
      }
      path.setAttribute("d", d);
      core.setAttribute("d", d);
    }
    window.addEventListener("resize", redrawPath);
    setTimeout(redrawPath, 80);
    setTimeout(redrawPath, 700);
    setTimeout(redrawPath, 2200);
    document.addEventListener("pointerdown", function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest("a, button, .tile, .hub-cam, .leaveby, #hub-lights-panel, .sp-tile, .who-up, header.hdr") : null;
      var x = ev.clientX, y = ev.clientY;
      if (t && t.getBoundingClientRect) {
        var r = t.getBoundingClientRect();
        x = r.left + Math.min(r.width * 0.72, r.width - 16);
        y = r.top + Math.min(22, r.height * 0.4);
      }
      placeSpirit(x, y, false);
    }, true);
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
    document.documentElement.classList.add("ori-diving");
    var iris = document.createElement("div");
    iris.className = "ori-iris";
    iris.style.setProperty("--x", x + "px");
    iris.style.setProperty("--y", y + "px");
    document.body.appendChild(iris);
    if (world && world.exit) {
      try { world.camPush(1.26, 0.6, x / Math.max(1, innerWidth), y / Math.max(1, innerHeight), 0.25); } catch (e) {}
      try { world.exit({ to: [x, y], dur: 0.6 }).then(go); } catch (e) {}
    }
    setTimeout(go, 680);
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

  window.addEventListener("pageshow", function (ev) {
    diving = false;
    document.documentElement.classList.remove("ori-diving");
    if (ev.persisted && world) { world.trans = null; try { world.kick(true); } catch (e) {} }
  });

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
