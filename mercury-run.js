/* mercury-run.js · chrome-liquid run, unlocked when the week's jar is full.
   One hand rolls a blob. A second hand wakes the sibling blob; until then
   an echo sibling runs along. A fall or a drip gathers the metal back at
   the last lantern. No tally, no clock, no shame word.
   Kid look comes from ?kid= on the query. Original geometry only. */
(function () {
  "use strict";

  var q = new URLSearchParams(location.search);
  var kid = q.get("kid") || "hayes";
  if (kid !== "harris" && kid !== "ainsley") kid = "hayes";
  var THEME = {
    hayes: { sky: ["#123044", "#3d8eaa", "#e7c48a"], ground: "#164a34", metal: "#d7dde6", accent: "#ffd56a", back: "kid-hayes.html" },
    harris: { sky: ["#102018", "#67a85a", "#d7e8b0"], ground: "#1c3a22", metal: "#d5ddd8", accent: "#e2c56a", back: "kid-harris.html" },
    ainsley: { sky: ["#1a1424", "#8a4a48", "#e0a070"], ground: "#241610", metal: "#e4ddd6", accent: "#ffd8b0", back: "kid-ainsley.html" }
  }[kid];

  var LIQUID = q.get("liquid") !== "0";
  var reduced = false;
  try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var cv = document.getElementById("run");
  var ctx = cv.getContext("2d", { alpha: false });
  var ui = document.getElementById("run-ui");
  var off = document.createElement("canvas");
  var ox = off.getContext("2d", { alpha: false });
  var runPlates = {};
  var runPlatesReady = false;
  function loadRunPlates() {
    var book = window.HousePlates;
    var man = book && book.mercury;
    if (!man) { runPlatesReady = true; return; }
    var jobs = (man.layers || []).map(function (layer) {
      var urls = book.urlFor(kid, layer.id, "landscape", layer.standin).concat(book.urlFor("mercury", layer.id, "landscape", layer.standin));
      return new Promise(function (res) {
        var i = 0;
        function next() {
          if (i >= urls.length) { res(); return; }
          var im = new Image();
          var src = urls[i++];
          im.onload = function () { runPlates[layer.id] = im; res(); };
          im.onerror = function () { next(); };
          im.src = src;
        }
        next();
      });
    });
    Promise.all(jobs).then(function () { runPlatesReady = true; });
  }
  loadRunPlates();
  function drawRunPlate(g, img, W, H, oxOff, parallax) {
    if (!img) return;
    var scale = Math.max(W / img.width, H / img.height) * 1.08;
    var dw = img.width * scale, dh = img.height * scale;
    g.drawImage(img, (W - dw) / 2 - cam * parallax + (oxOff || 0), (H - dh) / 2, dw, dh);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function tone(kind) {
    try {
      if (!window.HouseSfx || (HouseSfx.isMuted && HouseSfx.isMuted())) return;
      var ac = HouseSfx.ensureCtx && HouseSfx.ensureCtx();
      var master = HouseSfx.masterGain && HouseSfx.masterGain();
      if (!ac || !master) return;
      var t0 = ac.currentTime;
      var o = ac.createOscillator();
      var g = ac.createGain();
      o.type = kind === "splash" ? "triangle" : "sine";
      var f0 = kind === "jump" ? 320 : kind === "land" ? 140 : kind === "grove" ? 520 : 220;
      var f1 = kind === "jump" ? 640 : kind === "land" ? 70 : kind === "grove" ? 880 : 90;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + 0.18);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(kind === "splash" ? 0.09 : 0.06, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.32);
      if (kind === "splash" || kind === "land") {
        var n = ac.createBuffer(1, 4000, ac.sampleRate);
        var d = n.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        var s = ac.createBufferSource();
        var bp = ac.createBiquadFilter();
        bp.type = "lowpass"; bp.frequency.value = kind === "splash" ? 1800 : 400;
        var ng = ac.createGain();
        ng.gain.setValueAtTime(0.08, t0);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        s.buffer = n; s.connect(bp); bp.connect(ng); ng.connect(master); s.start(t0);
      }
    } catch (err) {}
  }

  /* SHARP1 · devicePixelRatio-aware backing: up to 2x, capped at 2560x1440 total pixels (a 1440p wall at 1:1).
     Floor = the old 1400px-wide cap. If frames run slow (avg > 20 ms over 2 s) the scale steps down toward the floor;
     if they run fast (< 13 ms over 4 s) it steps back up. ?adapt=0 pins the full target for measuring. */
  var MAX_PX = 2560 * 1440;
  var dprScale = 1, adaptT = 0, adaptN = 0, adaptSum = 0;
  var ADAPT = q.get("adapt") !== "0";
  function targetDpr(w, h) {
    var d = Math.min(2, devicePixelRatio || 1);
    if (w * h * d * d > MAX_PX) d = Math.sqrt(MAX_PX / (w * h));
    return d;
  }
  function floorDpr(w) { return Math.min(1.35, devicePixelRatio || 1, 1400 / w); }
  function adapt(dtMs) {
    if (!ADAPT) return;
    adaptT += dtMs; adaptN++; adaptSum += dtMs;
    var avg = adaptSum / adaptN, w = innerWidth, h = innerHeight;
    var lo = floorDpr(w) / targetDpr(w, h);
    if (adaptT > 2000 && avg > 20 && dprScale > lo + 0.001) { dprScale = Math.max(lo, dprScale * 0.85); resize(); }
    else if (adaptT > 4000 && avg < 13 && dprScale < 1) { dprScale = Math.min(1, dprScale / 0.85); resize(); }
    else if (adaptT <= 4000) return;
    adaptT = 0; adaptN = 0; adaptSum = 0;
  }
  function resize() {
    var w = innerWidth, h = innerHeight;
    var dpr = Math.max(floorDpr(w), targetDpr(w, h) * dprScale);
    cv.width = off.width = Math.round(w * dpr);
    cv.height = off.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    if (view.dpr !== dpr) platCache = {};
    view.dpr = dpr;
    view.w = w; view.h = h;
  }

  /* course */
  var plats = [];
  var drips = [];
  var goalX = 0;
  (function build() {
    var x = 40;
    var y = 420;
    for (var i = 0; i < 16; i++) {
      var w = 150 + (i % 3) * 40;
      var gap = 70 + (i % 4) * 28;
      if (i === 0) gap = 0;
      x += gap;
      y = 280 + Math.sin(i * 0.7) * 70 + (i % 5 === 4 ? -50 : 0);
      plats.push({ x: x, y: y, w: w, h: 22, cp: i % 3 === 0, vx: i % 5 === 2 ? 36 : 0, phase: i });
      if (i % 4 === 3) drips.push({ x: x + w * 0.5, y: y - 160, r: 16, p: i });
      x += w;
    }
    goalX = x + 40;
    plats.push({ x: goalX, y: 300, w: 180, h: 26, cp: true, vx: 0, phase: 0, grove: true });
  })();

  function platX(p, t) { return p.x + (p.vx ? Math.sin(t * 0.8 + p.phase) * 46 : 0); }
  function GY(y) { return y - 340 + view.h * 0.62; }

  function Blob(x, y, echo) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.r = 22; this.grounded = false; this.coyote = 0; this.squash = 1;
    this.cp = { x: x, y: y }; this.alive = true; this.echo = echo; this.hold = null;
    this.inv = 0;
  }
  var spawn = { x: plats[0].x + 40, y: plats[0].y - 30 };
  var A = new Blob(spawn.x, spawn.y, false);
  var B = new Blob(spawn.x + 28, spawn.y, true);
  /* POWERUPS1 · closed chores become power-ups. READ-ONLY: JarEngine.choreState(kid), the same read the gate uses.
     double jump = that kid's musts for today are all closed; drop magnet = that kid's week jar is at least half full.
     ?fixture=1 swaps in FIXTURE values (badge on screen) for proof captures only. */
  var KIDS = ["hayes", "harris", "ainsley"];
  var NAMES = { hayes: "Hayes", harris: "Harris", ainsley: "Ainsley" };
  var SIBS = KIDS.filter(function (k) { return k !== kid; });
  var FIXTURE = q.get("fixture") === "1";
  var FIX_PW = {}; FIX_PW[kid] = { dbl: true, magnet: true }; FIX_PW[SIBS[0]] = { dbl: true, magnet: false }; FIX_PW[SIBS[1]] = { dbl: false, magnet: false };
  /* COOP1 · up to three kids on one wall: host + siblings. The wall splits into one touch zone per kid
     (left to right); a zone with no hand runs its blob as a calm echo. ?coop=2 keeps it to two. */
  var C = new Blob(spawn.x + 56, spawn.y, true);
  A.kid = kid; B.kid = SIBS[0]; C.kid = SIBS[1];
  var blobs = q.get("coop") === "2" ? [A, B] : [A, B, C];
  function powersFor(k) {
    if (FIXTURE) return FIX_PW[k];
    try {
      var st = window.JarEngine && JarEngine.choreState(k);
      if (!st) return { dbl: false, magnet: false };
      return { dbl: st.todayNeed > 0 && st.todayDone >= st.todayNeed, magnet: (st.fill || 0) >= 0.5 };
    } catch (e) { return { dbl: false, magnet: false }; }
  }
  function refreshPowers() { allBlobs().forEach(function (b) { b.pw = powersFor(b.kid); }); paintPowerHud(); }
  function allBlobs() { return blobs; }
  function paintPowerHud() {
    var el = ui.querySelector(".hud span"); if (!el) return;
    el.innerHTML = (FIXTURE ? '<b class="fixture">FIXTURE</b> ' : "") + allBlobs().map(function (b) {
      var pw = b.pw || {};
      return '<i class="pw">' + NAMES[b.kid] + ' <em class="' + (pw.dbl ? "on" : "off") + '">double jump</em> <em class="' + (pw.magnet ? "on" : "off") + '">drop magnet</em></i>';
    }).join(" ");
  }
  var drops = [];
  var rings = [];
  var cam = 0;
  var shake = 0;
  var won = false;
  var playing = false;
  var t0 = performance.now();
  var view = { w: 800, h: 600, dpr: 1 };
  var pointers = {};

  function burst(x, y, n, color) {
    if (reduced) n = Math.min(n, 6);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 60 + Math.random() * 150;
      drops.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, a: 1, r: 2 + Math.random() * 5, c: color });
    }
    rings.push({ x: x, y: y, r: 6, a: 0.85 });
  }
  function gather(b, why) {
    if (b.inv > 0) return;
    if (why === "drip" && b.pw && b.pw.magnet) { /* drop magnet: the splash pulls straight back in, no trip to the lantern */
      burst(b.x, b.y, 10, THEME.metal); tone("splash");
      b.vy = Math.min(b.vy, -260); b.inv = 0.6; b.magnetT = 0.6; return;
    }
    burst(b.x, b.y, 12, THEME.metal);
    tone("splash");
    shake = 0;
    b.x = b.cp.x; b.y = b.cp.y; b.vx = 0; b.vy = 0; b.inv = 0.45; b.alive = true;
  }

  function stepBlob(b, dt, t, input) {
    if (won) return;
    b.inv = Math.max(0, b.inv - dt);
    b.magnetT = Math.max(0, (b.magnetT || 0) - dt);
    var accel = 0;
    if (input) {
      var worldX = cam + input.x;
      accel = clamp(worldX - b.x, -160, 160);
      b.vx += accel * 8 * dt;
      if (input.jump) { b.want = 0.12; b.press = true; input.jump = false; }
    } else if (b.echo) {
      var here = null, next = null;
      for (var i = 0; i < plats.length; i++) {
        var px = platX(plats[i], t);
        var top = GY(plats[i].y);
        if (!here && b.x > px - 8 && b.x < px + plats[i].w + 8 && Math.abs(b.y + b.r - top) < 36) here = plats[i];
        if (!next && px > b.x + 24) next = plats[i];
      }
      var aim = next || here || plats[0];
      if (aim) {
        var tx = platX(aim, t) + Math.min(48, aim.w * 0.45);
        b.vx += clamp(tx - b.x, -140, 160) * 7 * dt;
      }
      if (b.grounded && here && next) {
        var edge = platX(here, t) + here.w;
        var rise = GY(here.y) - GY(next.y);
        if (b.x > edge - 42 || rise > 24) b.want = 0.14;
      }
    }
    b.want = (b.want || 0) - dt;
    if (b.want <= 0) b.press = false;
    if (b.grounded) b.coyote = 0.12; else b.coyote -= dt;
    if (b.grounded) b.air2 = false;
    if (b.want > 0 && (b.grounded || b.coyote > 0)) {
      b.vy = -720; b.grounded = false; b.coyote = 0; b.want = 0; b.squash = 0.72;
      tone("jump");
    } else if (b.want > 0 && b.press && b.pw && b.pw.dbl && !b.air2 && b.coyote <= 0) {
      b.vy = -600; b.air2 = true; b.want = 0; b.squash = 0.8; /* double jump: a soft second push, a quiet ring */
      rings.push({ x: b.x, y: b.y + b.r, r: 8, a: 0.5 });
      tone("jump");
    } else if (b.echo && b.pw && b.pw.dbl && !b.air2 && b.vy > 260 && b.y > view.h * 0.62) {
      b.vy = -600; b.air2 = true; rings.push({ x: b.x, y: b.y + b.r, r: 8, a: 0.4 });
    }
    b.vy += 1700 * dt;
    b.vx = clamp(b.vx, -380, 380);
    b.x += b.vx * dt;
    var nextY = b.y + b.vy * dt;
    var was = b.grounded;
    b.grounded = false;
    if (b.vy >= 0) {
      for (var p = 0; p < plats.length; p++) {
        var pl = plats[p];
        var left = platX(pl, t);
        if (b.x > left - b.r * 0.4 && b.x < left + pl.w + b.r * 0.4) {
          var top = GY(pl.y);
          if (b.y + b.r <= top + 12 && nextY + b.r >= top) {
            nextY = top - b.r;
            if (b.vy > 220) { burst(b.x, top, 8, THEME.metal); tone("land"); b.squash = 1.35; }
            b.vy = 0; b.grounded = true;
            if (pl.cp) b.cp = { x: b.x, y: nextY };
          }
        }
      }
    }
    b.y = nextY;
    if (b.grounded) b.vx *= Math.pow(0.15, dt);
    else b.vx *= Math.pow(0.55, dt);
    b.squash += (1 - b.squash) * Math.min(1, dt * 8);
    if (b.y > view.h + 120) gather(b);
    for (var d = 0; d < drips.length; d++) {
      var dr = drips[d];
      var dy = GY(dr.y) + ((t * 90 + dr.p * 40) % 180);
      if (Math.hypot(b.x - dr.x, b.y - dy) < b.r + dr.r * 0.45) gather(b, "drip");
    }
    if (was && !b.grounded) { /* stepped off */ }
  }

  function stepDrops(dt) {
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      d.age = (d.age || 0) + dt;
    if (d.age > 0.22) {
      var near = blobs[0];
      blobs.forEach(function (b) { if (Math.hypot(b.x - d.x, b.y - d.y) < Math.hypot(near.x - d.x, near.y - d.y)) near = b; });
      var tx = near.x, ty = near.y;
      var pull = near.magnetT > 0 ? 22 : 8;
      d.vx += (tx - d.x) * pull * dt;
      d.vy += (ty - d.y) * pull * dt;
      d.r *= Math.max(0.2, 1 - dt * 1.4);
      if (Math.hypot(tx - d.x, ty - d.y) < 10 || d.r < 0.7) { drops.splice(i, 1); continue; }
    }
    d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a -= dt * 0.35;
      if (d.a <= 0) drops.splice(i, 1);
    }
    for (var r = rings.length - 1; r >= 0; r--) {
      rings[r].r += 140 * dt;
      rings[r].a -= dt * 1.35;
      if (rings[r].a <= 0) rings.splice(r, 1);
    }
  }

  function paintWorld(g, t, W, H) {
    if (runPlates.sky) drawRunPlate(g, runPlates.sky, W, H, Math.sin(t * 0.1) * 8, 0.05);
    else {
      var sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, THEME.sky[0]);
      sky.addColorStop(0.55, THEME.sky[1]);
      sky.addColorStop(1, THEME.sky[2]);
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
    }
    drawRunPlate(g, runPlates.far, W, H, 0, 0.12);
    drawRunPlate(g, runPlates.mid, W, H, 0, 0.28);
    drawRunPlate(g, runPlates.near, W, H, 0, 0.46);
    var fog = g.createLinearGradient(0, H * 0.35, 0, H);
    fog.addColorStop(0, "rgba(8,12,16,0)");
    fog.addColorStop(1, "rgba(8,12,16,0.45)");
    g.fillStyle = fog;
    g.fillRect(0, H * 0.35, W, H * 0.65);
    g.fillStyle = "rgba(255,255,255,0.05)";
    for (var f = 0; f < 3; f++) {
      g.beginPath();
      g.ellipse((f * 280 - cam * 0.2) % (W + 100), H * 0.62, 120, 16, 0, 0, 7);
      g.fill();
    }
    g.save();
    g.translate(-cam, 0);
    for (var p = 0; p < plats.length; p++) {
      var pl = plats[p];
      var x = platX(pl, t);
      var py = GY(pl.y);
      livingPlat(g, x, py, pl.w, t, p, pl.grove);
      if (pl.cp) {
        var lx = x + 18, ly = py - 18;
        var lg = g.createRadialGradient(lx, ly, 1, lx, ly, 22);
        lg.addColorStop(0, "#fff");
        lg.addColorStop(0.4, THEME.accent);
        lg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = lg;
        g.beginPath(); g.arc(lx, ly, 22, 0, 7); g.fill();
      }
    }
    for (var d = 0; d < drips.length; d++) {
      var dr = drips[d];
      var dy = GY(dr.y) + ((t * 90 + dr.p * 40) % 180);
      g.fillStyle = "rgba(12, 16, 22, 0.88)";
      g.beginPath(); g.arc(dr.x, dy, dr.r, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.beginPath(); g.arc(dr.x - 4, dy - 4, dr.r * 0.35, 0, 7); g.fill();
    }
    rings.forEach(function (ring) {
      g.globalAlpha = Math.max(0, ring.a);
      g.strokeStyle = THEME.metal;
      g.lineWidth = 2;
      g.beginPath(); g.arc(ring.x, ring.y, ring.r, 0, 7); g.stroke();
      g.globalAlpha = 1;
    });
    var grove = plats[plats.length - 1];
    var gy = GY(grove.y) - 36;
    var glow = g.createRadialGradient(goalX + 90, gy, 8, goalX + 90, gy, 130);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.35, THEME.accent);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.beginPath(); g.arc(goalX + 90, gy, 130, 0, 7); g.fill();
    g.restore();
  }

  /* PLATFORMS1 · painted root + stone platforms, Ori-style (layered, soft-lit, organic; never flat watercolor).
     ASSET SWAP: Prism's plates drop in as art/mercury/platforms/stone.png and art/mercury/platforms/root.png
     (transparent PNG, walkable top edge at PLAT_ART[type].top of the image height, end caps PLAT_ART[type].cap
     of the width each side; the middle stretches). If a file is missing the procedural placeholder below draws.
     Each platform is painted once into a cached sprite (per width/type/seed/dpr), so a frame is one drawImage. */
  /* Prism plates (2026-10-13/mercury-platforms, 2x set): <type>-<a..d>-{capL,mid,capR} 80x112 / 256x112 and matching
     -shadow-* 48px strips. Drawn at half size: caps 40 css px, mid tiles every 128 css px, 56 tall, walk line 12 px down. */
  var PLAT_ART = { dir: "art/mercury/platforms/", variants: ["a", "b", "c", "d"], parts: ["capL", "mid", "capR", "shadow-capL", "shadow-mid", "shadow-capR"], walk: 10, shY: 14, h: 56, sh: 24 }; /* Prism README: tile at y-10 (moss lip = walk line), shadow at y+14 */
  var platImg = {};
  if (q.get("platart") !== "0") ["stone", "root"].forEach(function (t) {
    PLAT_ART.variants.forEach(function (v) {
      var set = {}, left = PLAT_ART.parts.length;
      PLAT_ART.parts.forEach(function (part) {
        var im = new Image();
        im.onload = function () { set[part] = im; if (--left === 0) { platImg[t + "-" + v] = set; platCache = {}; } };
        im.onerror = function () { left = -99; };
        im.src = PLAT_ART.dir + ((devicePixelRatio || 1) > 1 || innerWidth >= 2400 ? "2x/" : "1x/") + t + "-" + v + "-" + part + ".png?v=PLATFORMS3";
      });
    });
  });
  var platCache = {};
  function platType(i, grove) { return grove ? "stone" : (i % 3 === 1 ? "root" : "stone"); }
  function rnd(seed) { var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  var PAD = 40, DEPTH = 120; /* sprite margin around the slab; how far the body hangs below the walk line */
  function platSprite(type, w, i, grove) {
    var dpr = view.dpr || 1;
    var vr = type === "root" ? (i % 2 ? "c" : "a") : PLAT_ART.variants[i % 4]; /* Prism: prefer root-a / root-c */
    var art = platImg[type + "-" + vr];
    var key = type + "|" + Math.round(w) + "|" + i + "|" + dpr.toFixed(2) + "|" + (art ? "art" : "proc");
    if (platCache[key]) return platCache[key];
    var cw = w + PAD * 2, chh = DEPTH + PAD * 2;
    var c = document.createElement("canvas");
    c.width = Math.ceil(cw * dpr); c.height = Math.ceil(chh * dpr);
    var g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.translate(PAD, PAD);
    if (art) paintPlatArt(g, art, w, grove);
    else if (type === "root") paintRoot(g, w, i);
    else paintStone(g, w, i, grove);
    platCache[key] = c;
    return c;
  }
  function paintPlatArt(g, set, w, grove) {
    var cap = 40, tile = 128, y0 = -PLAT_ART.walk;
    function strip(pre, y, h) {
      var mw = Math.max(0, w - cap * 2);
      for (var x = 0; x < mw; x += tile) { var tw = Math.min(tile, mw - x); var im = set[pre + "mid"]; g.drawImage(im, 0, 0, im.width * (tw / tile), im.height, cap + x, y, tw, h); }
      g.drawImage(set[pre + "capL"], 0, y, cap, h);
      g.drawImage(set[pre + "capR"], w - cap, y, cap, h);
    }
    strip("shadow-", PLAT_ART.shY, PLAT_ART.sh);
    strip("", y0, PLAT_ART.h);
    if (grove) { var gg = g.createRadialGradient(w / 2, 0, 4, w / 2, 0, w * 0.7); gg.addColorStop(0, "rgba(255,240,200,0.24)"); gg.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = gg; g.fillRect(-PAD, -PAD, w + PAD * 2, PAD + 60); }
  }
  function stonePath(g, w, i, inset) {
    var n = 9, depth = 46 + rnd(i + 3) * 30;
    g.beginPath();
    g.moveTo(-6 + inset, 4);
    for (var k = 1; k < n; k++) { var x = (k / n) * w; g.lineTo(x, -2 + rnd(i * 13 + k) * 4 + inset * 0.3); }
    g.quadraticCurveTo(w + 12 - inset, 2, w + 4 - inset, 16);
    for (var k2 = n; k2 >= 0; k2--) {
      var u = k2 / n, bulge = Math.sin(u * Math.PI);
      var y = 16 + bulge * depth * (0.75 + rnd(i * 7 + k2) * 0.35) - inset;
      g.lineTo(u * w + (rnd(i * 5 + k2) - 0.5) * 10, y);
    }
    g.quadraticCurveTo(-14 + inset, 20, -6 + inset, 4);
    g.closePath();
  }
  function paintStone(g, w, i, grove) {
    /* 1 depth layer: a cooler, softer silhouette behind (atmosphere) */
    g.save(); g.translate(10, 10); g.globalAlpha = 0.35; g.filter = "blur(6px)";
    stonePath(g, w, i + 50, 0); g.fillStyle = "#0b1a1c"; g.fill();
    g.restore();
    /* 2 body: lit top to deep underside, soft mottling (no hard lines) */
    stonePath(g, w, i, 0);
    var body = g.createLinearGradient(0, -4, 0, 90);
    body.addColorStop(0, "#5f7468"); body.addColorStop(0.18, "#3a4c48"); body.addColorStop(0.55, "#1b2a2b"); body.addColorStop(1, "#0a1214");
    g.fillStyle = body; g.fill();
    g.save(); g.clip();
    for (var m = 0; m < 7; m++) {
      var mx = rnd(i * 31 + m) * w, my = 10 + rnd(i * 17 + m) * 50, mr = 18 + rnd(i * 3 + m) * 34;
      var mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, m % 2 ? "rgba(140,170,150,0.16)" : "rgba(10,18,20,0.30)"); mg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = mg; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    /* 3 cool bounce light along the underside, warm key from the upper left */
    var bounce = g.createLinearGradient(0, 40, 0, 100); bounce.addColorStop(0, "rgba(90,160,170,0)"); bounce.addColorStop(1, "rgba(90,160,170,0.18)");
    g.fillStyle = bounce; g.fillRect(-20, 40, w + 40, 80);
    var key = g.createRadialGradient(w * 0.2, -10, 4, w * 0.2, -10, w * 0.9); key.addColorStop(0, "rgba(255,226,170,0.22)"); key.addColorStop(1, "rgba(255,226,170,0)");
    g.fillStyle = key; g.fillRect(-20, -20, w + 40, 80);
    /* lichen specks */
    for (var l = 0; l < Math.round(w / 14); l++) {
      g.fillStyle = "rgba(170,200,120," + (0.12 + rnd(i * 41 + l) * 0.18).toFixed(2) + ")";
      g.beginPath(); g.ellipse(rnd(i * 23 + l) * w, 8 + rnd(i * 29 + l) * 28, 2 + rnd(l + i) * 4, 1.4 + rnd(l * 3 + i) * 2, 0, 0, 7); g.fill();
    }
    g.restore();
    /* 4 rim light on the walk edge + moss tufts */
    rimAndMoss(g, w, i, grove ? "rgba(255,236,190,0.9)" : "rgba(255,226,170,0.65)");
    if (grove) { var gg = g.createRadialGradient(w / 2, 0, 4, w / 2, 0, w * 0.7); gg.addColorStop(0, "rgba(255,240,200,0.28)"); gg.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = gg; g.fillRect(-PAD, -PAD, w + PAD * 2, PAD + 60); }
  }
  function paintRoot(g, w, i) {
    /* a gnarled root bridge: a tapering trunk with knots and hanging rootlets, glowing tips (Ori lanterns) */
    var th = 20;
    function trunk(off, inset) {
      g.beginPath();
      g.moveTo(-10, 2 + off);
      g.bezierCurveTo(w * 0.3, -3 + off, w * 0.7, 3 + off, w + 10, 0 + off);
      g.bezierCurveTo(w + 16, th * 0.6 + off, w + 6, th + 4 + off, w - 10, th + 6 + off - inset);
      g.bezierCurveTo(w * 0.65, th + 14 + off - inset, w * 0.35, th + 4 + off - inset, 6, th + 10 + off - inset);
      g.bezierCurveTo(-8, th + 6 + off, -16, th * 0.4 + off, -10, 2 + off);
      g.closePath();
    }
    g.save(); g.translate(8, 12); g.globalAlpha = 0.32; g.filter = "blur(5px)"; trunk(0, 0); g.fillStyle = "#120d0a"; g.fill(); g.restore();
    /* hanging rootlets behind the trunk */
    for (var r = 0; r < Math.round(w / 34); r++) {
      var rx = 10 + rnd(i * 11 + r) * (w - 20), len = 30 + rnd(i * 7 + r) * 60, sway = (rnd(r + i) - 0.5) * 24;
      g.strokeStyle = "rgba(38,28,22,0.9)"; g.lineWidth = 2.6 - rnd(r) * 1.2; g.lineCap = "round";
      g.beginPath(); g.moveTo(rx, th); g.bezierCurveTo(rx + sway * 0.3, th + len * 0.4, rx + sway, th + len * 0.7, rx + sway * 0.8, th + len); g.stroke();
      if (r % 2 === 0) {
        var tx = rx + sway * 0.8, ty = th + len, gl = g.createRadialGradient(tx, ty, 0, tx, ty, 9);
        gl.addColorStop(0, "rgba(190,240,255,0.85)"); gl.addColorStop(1, "rgba(120,200,255,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(tx, ty, 9, 0, 7); g.fill();
      }
    }
    trunk(0, 0);
    var bark = g.createLinearGradient(0, -2, 0, th + 12);
    bark.addColorStop(0, "#7a5a3e"); bark.addColorStop(0.3, "#4a3424"); bark.addColorStop(1, "#160e0a");
    g.fillStyle = bark; g.fill();
    g.save(); g.clip();
    for (var k = 0; k < Math.round(w / 40); k++) { /* knots and soft bark grain */
      var kx = rnd(i * 19 + k) * w, ky = 8 + rnd(i * 37 + k) * 10;
      var kg = g.createRadialGradient(kx, ky, 0, kx, ky, 10); kg.addColorStop(0, "rgba(20,12,8,0.55)"); kg.addColorStop(1, "rgba(20,12,8,0)");
      g.fillStyle = kg; g.fillRect(kx - 10, ky - 10, 20, 20);
    }
    g.strokeStyle = "rgba(255,210,160,0.08)"; g.lineWidth = 1;
    for (var s2 = 0; s2 < 4; s2++) { g.beginPath(); g.moveTo(-10, 6 + s2 * 4); g.bezierCurveTo(w * 0.3, 2 + s2 * 4, w * 0.7, 8 + s2 * 4, w + 10, 4 + s2 * 4); g.stroke(); }
    g.restore();
    rimAndMoss(g, w, i, "rgba(255,214,150,0.7)");
  }
  function rimAndMoss(g, w, i, rim) {
    var rl = g.createLinearGradient(0, -4, 0, 6);
    rl.addColorStop(0, "rgba(0,0,0,0)"); rl.addColorStop(0.5, rim); rl.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rl; g.beginPath(); g.ellipse(w / 2, 1, w / 2 + 4, 3.2, 0, 0, 7); g.fill();
    for (var m = 0; m < Math.round(w / 9); m++) {
      var mx = rnd(i * 53 + m) * w, mh = 3 + rnd(i * 59 + m) * 6;
      var mg = g.createLinearGradient(0, -mh, 0, 3); mg.addColorStop(0, "rgba(170,210,120,0.75)"); mg.addColorStop(1, "rgba(60,96,52,0.0)");
      g.fillStyle = mg; g.beginPath(); g.ellipse(mx, 0, 3 + rnd(m + i * 2) * 5, mh, 0, 0, 7); g.fill();
    }
  }
  function livingPlat(g, x, y, w, t, i, grove) {
    var sway = reduced ? 0 : Math.sin(t * 0.9 + i) * 1.5; /* calm: a slow breath, no bob */
    var spr = platSprite(platType(i, grove), w, i, grove);
    g.drawImage(spr, 0, 0, spr.width, spr.height, x - PAD, y + sway - PAD, w + PAD * 2, DEPTH + PAD * 2);
  }

  function blobPath(g, rad, t, squash) {
    g.beginPath();
    var n = 22;
    var sq = Math.max(0.55, squash);
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      var wob = 1 + 0.09 * Math.sin(a * 3 + t * 5) + 0.045 * Math.sin(a * 6 - t * 4);
      var x = Math.cos(a) * rad * wob * sq;
      var y = Math.sin(a) * rad * wob / sq;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  }

  function paintBlob(g, b, t) {
    if (b.inv > 0 && Math.floor(t * 18) % 2 === 0) return;
    var sx = b.x - cam, sy = b.y;
    var squash = b.squash;
    var rad = b.r;
    g.save();
    g.translate(sx, sy);
    if (b.echo) g.globalAlpha = 0.9;
    blobPath(g, rad, t + (b.echo ? 1.2 : 0), squash);
    g.save();
    g.clip();
    g.fillStyle = "#0a0c10";
    g.fillRect(-rad * 2, -rad * 2, rad * 4, rad * 4);
    g.fillStyle = "#8e96a0";
    g.fillRect(-rad * 2, -rad * 2, rad * 4, rad * 1.02);
    g.fillStyle = "rgba(248,250,252,0.95)";
    g.fillRect(-rad * 2, -rad * 0.06, rad * 4, Math.max(1.5, rad * 0.055));
    g.save();
    g.scale(1, -1);
    g.globalAlpha = 0.22;
    var src = rad * 2.4 * view.dpr;
    try {
      g.filter = "grayscale(1) contrast(1.8) brightness(0.22)";
      g.drawImage(off, (sx - rad) * view.dpr, (sy - rad) * view.dpr, src, src, -rad * 1.2, -rad * 1.2, rad * 2.4, rad * 2.4);
    } catch (err) {}
    g.restore();
    g.globalAlpha = 1;
    var rg = g.createLinearGradient(-rad, -rad * 0.2, rad * 0.4, rad);
    rg.addColorStop(0, "rgba(90,98,108,0.28)");
    rg.addColorStop(0.42, "rgba(12,14,18,0.15)");
    rg.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = rg;
    g.fillRect(-rad * 2, -rad * 2, rad * 4, rad * 4);
    g.fillStyle = "rgba(255,255,255,0.96)";
    g.beginPath();
    g.ellipse(-rad * 0.2, -rad * 0.32, rad * 0.11, rad * 0.045, -0.6, 0, 7);
    g.fill();
    g.restore();
    blobPath(g, rad * 0.98, t + (b.echo ? 1.2 : 0), squash);
    g.strokeStyle = "rgba(186, 204, 222, 0.72)";
    g.lineWidth = 1.1;
    g.stroke();
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.beginPath();
    g.ellipse(0, rad * 0.95, rad * 0.72, rad * 0.14, 0, 0, 7);
    g.fill();
    g.fillStyle = "rgba(180, 190, 200, 0.16)";
    g.beginPath();
    g.ellipse(0, rad * 1.08, rad * 0.55, rad * 0.08, 0, 0, 7);
    g.fill();
    g.restore();
  }


  /* Liquid chrome: one metaball field for both blobs + every splash drop,
     shaded per cell with fresnel, the painted world reflected, and a soft key light. */
  var liq = document.createElement("canvas"), lq = liq.getContext("2d");
  var env = document.createElement("canvas"), eq = env.getContext("2d", { willReadFrequently: true });
  function paintLiquid(g, t, src, dpr) {
    var balls = [];
    blobs.forEach(function (b, k) {
      if (b.inv > 0 && Math.floor(t * 6) % 2 === 0) return;
      balls.push({ x: b.x - cam, y: b.y, r: b.r * 1.05, sq: Math.max(0.6, b.squash), w: t * 2.2 + k * 1.7, fade: b.echo ? 0.82 : 1 });
    });
    drops.forEach(function (d) { if (d.a > 0.05) balls.push({ x: d.x - cam, y: d.y, r: d.r * 1.6 * Math.min(1, d.a * 1.6), sq: 1, w: 0, fade: 1 }); });
    if (!balls.length) return;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    balls.forEach(function (b) { var m = b.r * 2.2; x0 = Math.min(x0, b.x - m); y0 = Math.min(y0, b.y - m); x1 = Math.max(x1, b.x + m); y1 = Math.max(y1, b.y + m); });
    x0 = Math.max(-40, x0); y0 = Math.max(-40, y0); x1 = Math.min(view.w + 40, x1); y1 = Math.min(view.h + 40, y1);
    var C = Math.max(1.5, Math.sqrt((x1 - x0) * (y1 - y0) / 40000)); /* css px per cell, capped work */
    var cw = Math.ceil((x1 - x0) / C), ch = Math.ceil((y1 - y0) / C);
    if (cw < 2 || ch < 2) return;
    var M = 24; /* env margin so reflections can look past the edge */
    var ew = cw + 2 * Math.ceil(M / C), eh = ch + 2 * Math.ceil(M / C);
    env.width = ew; env.height = eh;
    try { eq.drawImage(src, (x0 - M) * dpr, (y0 - M) * dpr, ew * C * dpr, eh * C * dpr, 0, 0, ew, eh); } catch (e) {}
    var ed = eq.getImageData(0, 0, ew, eh).data;
    liq.width = cw; liq.height = ch;
    var img = lq.createImageData(cw, ch), o = img.data;
    var em = Math.ceil(M / C);
    var lx = -0.45, ly = -0.7, lz = 0.55, ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    var tint = THEME.metal, tr = parseInt(tint.substr(1, 2), 16), tg = parseInt(tint.substr(3, 2), 16), tb = parseInt(tint.substr(5, 2), 16);
    var FA = 1; /* SHARP1 perf: no per-call array; balls beyond 4r add < 0.07 and are skipped */
    balls.forEach(function (b) { b.cut = b.r * b.r * 16; });
    function field(px, py) {
      var f = 0, fa = 0;
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i], dx = (px - b.x) / b.sq, dy = (py - b.y) * b.sq;
        if (dx * dx + dy * dy > b.cut) continue;
        if (b.w) { var a = Math.atan2(dy, dx); var wob = 1 + 0.05 * Math.sin(a * 3 + b.w) + 0.025 * Math.sin(a * 5 - b.w * 1.3); dx /= wob; dy /= wob; }
        var v = (b.r * b.r) / (dx * dx + dy * dy + 1);
        f += v; fa += v * b.fade;
      }
      FA = fa / (f || 1);
      return f;
    }
    for (var j = 0; j < ch; j++) {
      for (var i = 0; i < cw; i++) {
        var px = x0 + (i + 0.5) * C, py = y0 + (j + 0.5) * C;
        var f = field(px, py), fade = FA;
        var k = (j * cw + i) * 4;
        if (f < 0.85) { o[k + 3] = 0; continue; }
        var fx = field(px + C, py) - field(px - C, py);
        var fy = field(px, py + C) - field(px, py - C);
        var gl = Math.hypot(fx, fy) + 1e-6;
        var edge = Math.min(1, (f - 0.85) / 0.9); /* 0 at rim, 1 deep inside */
        var nz = Math.sqrt(edge) ;
        var s2 = Math.sqrt(Math.max(0, 1 - nz * nz));
        var nx = -fx / gl * s2, ny = -fy / gl * s2;
        /* reflection: look along the bent normal into the painted world */
        var rx = Math.round(i + em + nx * 16 / C * 1.6), ry = Math.round(j + em + ny * 16 / C * 1.6 - (1 - nz) * 6);
        rx = rx < 0 ? 0 : rx >= ew ? ew - 1 : rx; ry = ry < 0 ? 0 : ry >= eh ? eh - 1 : ry;
        var e = (ry * ew + rx) * 4;
        var lum = (ed[e] * 0.3 + ed[e + 1] * 0.55 + ed[e + 2] * 0.15) / 255;
        /* chrome = mostly a contrasty mirror of the world + sky band above the horizon of the normal */
        var sky = ny < -0.15 ? Math.min(1, (-ny - 0.15) * 1.6) : 0;
        var band = Math.exp(-Math.pow((ny + 0.05) / 0.08, 2)) * 0.45; /* chrome horizon line */
        var base = Math.pow(lum, 1.1) * 0.9 + sky * 0.7 + band;
        var fres = Math.pow(1 - nz, 3);
        var spec = Math.pow(Math.max(0, nx * lx + ny * ly + nz * lz), 48) * 1.4;
        var dark = ny > 0.35 ? (ny - 0.35) * 0.6 : 0;
        var v = Math.min(1.2, base * (1 - dark) + fres * 0.65 + spec);
        var cr = ed[e] / 255 * 0.25 + v * 0.75, cg = ed[e + 1] / 255 * 0.25 + v * 0.75, cb = ed[e + 2] / 255 * 0.25 + v * 0.75;
        o[k] = Math.min(255, cr * tr * 1.05);
        o[k + 1] = Math.min(255, cg * tg * 1.05);
        o[k + 2] = Math.min(255, cb * tb * 1.08);
        o[k + 3] = Math.round(255 * Math.min(1, (f - 0.85) / 0.12) * fade);
      }
    }
    lq.putImageData(img, 0, 0);
    g.save();
    g.imageSmoothingEnabled = true;
    /* contact shadows under grounded blobs */
    blobs.forEach(function (b) { if (!b.grounded) return; g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(b.x - cam, b.y + b.r * 0.95, b.r * 0.8, b.r * 0.16, 0, 0, 7); g.fill(); });
    g.drawImage(liq, 0, 0, cw, ch, x0, y0, cw * C, ch * C);
    g.restore();
  }

  function paintBridge(g, t) {
    var dx = (A.x - B.x), dy = (A.y - B.y);
    var dist = Math.hypot(dx, dy);
    if (dist > 78 || dist < 8) return;
    g.save();
    g.strokeStyle = THEME.metal;
    g.globalAlpha = 1 - dist / 78;
    g.lineWidth = 8 * (1 - dist / 78);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(A.x - cam, A.y);
    g.quadraticCurveTo((A.x + B.x) / 2 - cam, (A.y + B.y) / 2 - 10, B.x - cam, B.y);
    g.stroke();
    g.restore();
  }

  function frame() {
    var now = performance.now();
    var t = (now - t0) / 1000;
    var dt = reduced ? 1 / 60 : Math.min(0.033, (frame.l ? (now - frame.l) / 1000 : 1 / 60));
    if (frame.l && playing) adapt(now - frame.l);
    frame.l = now;
    var W = view.w, H = view.h;
    var ids = Object.keys(pointers);
    var ins = blobs.map(function () { return null; });
    ids.forEach(function (id) { var k = Math.min(blobs.length - 1, pointers[id].blob); ins[k] = pointers[id]; });
    blobs.forEach(function (b, k) { if (k > 0) b.echo = !ins[k]; stepBlob(b, dt, t, ins[k]); });
    stepDrops(dt);
    var mid = 0, home = !won;
    blobs.forEach(function (b) { mid += b.x / blobs.length; if (!(b.x > goalX + 20 && b.grounded)) home = false; });
    if (home) { won = true; tone("grove"); burst(mid, A.y, 30, "#fff"); }
    var aim = mid - W * 0.38;
    cam += (aim - cam) * (reduced ? 1 : 0.05);
    cam = Math.max(0, cam);
    shake *= 0.86;
    ox.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ox.clearRect(0, 0, W, H);
    paintWorld(ox, t, W, H);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    shake = 0; /* calm: no camera jitter (Dan 10/12 rejected aggressive motion) */
    ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, W, H);
    if (LIQUID) paintLiquid(ctx, t, off, view.dpr);
    else {
      blobs.forEach(function (b) { paintBlob(ctx, b, t); });
      paintBridge(ctx, t);
      drops.forEach(function (d) {
        ctx.globalAlpha = Math.max(0, d.a);
        ctx.fillStyle = d.c;
        ctx.beginPath(); ctx.ellipse(d.x - cam, d.y, d.r, d.r * 1.4, 0, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    if (playing && !document.hidden) requestAnimationFrame(frame);
  }

  function assignPointer(e) {
    var rec = cv.getBoundingClientRect();
    var x = e.clientX - rec.left, y = e.clientY - rec.top;
    var blob = Math.max(0, Math.min(blobs.length - 1, Math.floor(x / (view.w / blobs.length)))); /* the kid's own zone */
    pointers[e.pointerId] = { x: x, y: y, blob: blob, ly: y, jump: false };
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    if (window.HouseSfx && HouseSfx.unlockAudio) HouseSfx.unlockAudio();
  }

  cv.addEventListener("pointerdown", function (e) {
    if (won) return;
    assignPointer(e);
  });
  cv.addEventListener("pointermove", function (e) {
    var p = pointers[e.pointerId];
    if (!p) return;
    var rec = cv.getBoundingClientRect();
    var y = e.clientY - rec.top;
    if (p.ly - y > 28) p.jump = true;
    p.ly = y;
    p.x = e.clientX - rec.left;
    p.y = y;
  });
  function up(e) {
    var p = pointers[e.pointerId];
    if (p) {
      var rec = cv.getBoundingClientRect();
      if (p.ly - (e.clientY - rec.top) > 18) p.jump = true;
      var b = blobs[Math.min(blobs.length - 1, p.blob)];
      if (p.jump) { b.want = 0.14; b.press = true; }
    }
    delete pointers[e.pointerId];
  }
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "d") A.vx += 40;
    if (e.key === "ArrowLeft" || e.key === "a") A.vx -= 40;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") { A.want = 0.12; A.press = true; }
    if (e.key === "l") B.vx += 40;
    if (e.key === "j") B.vx -= 40;
    if (e.key === "i") { B.echo = false; B.want = 0.12; B.press = true; }
  });

  function ambience() {
    if (playing || document.hidden) return;
    var t = performance.now() / 1000;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    paintWorld(ctx, t, view.w, view.h);
    if (!reduced) requestAnimationFrame(ambience);
  }

  function showGather() {
    ui.innerHTML = '<div class="gather"><div class="je-host" id="je"></div><a href="' + THEME.back + '">Back to the woods</a></div>';
    if (window.JarEngine) {
      JarEngine.mount(document.getElementById("je"), { kid: kid, getState: function () { return JarEngine.choreState(kid); } });
    }
    ambience();
  }

  function showPlay() {
    playing = true;
    setTimeout(refreshPowers, 0);
    setInterval(refreshPowers, 30000); /* a chore closed mid-run lights its power-up within half a minute */
    ui.innerHTML = '<div class="hud"><a href="' + THEME.back + '">Back</a><span></span></div><div class="hint">Each of you has a part of the wall. Roll in your part, flick up to jump.</div><div class="zones">' + blobs.map(function (b) { return '<div class="zone"><span>' + NAMES[b.kid] + '</span></div>'; }).join("") + '</div>';
    resize();
    frame();
    setTimeout(function () {
      var h = ui.querySelector(".hint");
      if (h) h.style.opacity = "0";
    }, 4200);
  }

  function winWatch() {
    var note = document.createElement("div");
    note.className = "gather";
    note.innerHTML = '<p style="font-size:28px;font-weight:700;text-shadow:0 0 18px #fff">The grove holds everyone.</p><a href="' + THEME.back + '">Back</a>';
    ui.appendChild(note);
  }

  var winShown = false;
  var orig = frame;
  frame = function () {
    orig();
    if (won && !winShown) { winShown = true; winWatch(); }
  };

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    if (playing) requestAnimationFrame(frame);
    else requestAnimationFrame(ambience);
  });

  function start() {
    var st = window.JarEngine ? JarEngine.choreState(kid) : { full: false };
    resize();
    window.addEventListener("resize", resize);
    A.x = spawn.x; A.y = GY(plats[0].y) - 40; A.cp = { x: A.x, y: A.y };
    B.x = spawn.x + 36; B.y = A.y; B.cp = { x: B.x, y: B.y };
    C.x = spawn.x + 72; C.y = A.y; C.cp = { x: C.x, y: C.y };
    if (!st.full) {
      showGather();
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      paintWorld(ctx, 0, view.w, view.h);
      return;
    }
    showPlay();
  }

  var capMode = /(?:\?|&)mrcap=1(?:&|$)/.test(location.search);
  if (!capMode) {
    if (window.WardKids && WardKids.boot) {
      document.addEventListener("house:kids-data-ready", start);
      WardKids.boot(kid);
    } else start();
  }

  var capCv = null;
  function exportFrame(t, cssW, cssH, dpr) {
    cssW = cssW || 1920;
    cssH = cssH || 1080;
    dpr = dpr || 1;
    if (!capCv) capCv = document.createElement("canvas");
    capCv.width = Math.round(cssW * dpr);
    capCv.height = Math.round(cssH * dpr);
    view.w = cssW;
    view.h = cssH;
    view.dpr = dpr;
    off.width = capCv.width;
    off.height = capCv.height;
    var close = t >= 4.2 && t < 6.4;
    var falling = t >= 11.2 && t < 12.6;
    var gathered = t >= 8.2 && t < 11.0;
    var splashOn = (t >= 6.4 && t < 8.2) || gathered;
    var travel = Math.min(goalX - 120, 90 + t * 95);
    var idx = 0;
    for (var i = 0; i < plats.length; i++) {
      if (plats[i].x + plats[i].w * 0.25 < travel) idx = i;
    }
    var pl = plats[idx];
    var gx = platX(pl, t) + 42;
    var gy = GY(pl.y) - 28;
    if (falling) gy = view.h * (0.55 + (t - 12) * 0.28);
    if (gathered) {
      var back = plats[Math.max(0, idx - 1)];
      gx = platX(back, t) + 30;
      gy = GY(back.y) - 28;
    }
    A.x = gx;
    A.y = gy;
    A.r = 26;
    A.squash = falling ? 0.7 : (splashOn ? 1.28 : 1);
    A.echo = false;
    A.inv = 0;
    B.x = gx - 62;
    B.y = gy + (falling ? -8 : 2);
    B.r = 22;
    B.squash = 1;
    B.echo = true;
    B.inv = 0;
    cam = Math.max(0, (A.x + B.x) / 2 - cssW * 0.42);
    var gctx = capCv.getContext("2d", { alpha: false });
    ox.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintWorld(ox, t, cssW, cssH);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, cssW, cssH);
    paintBlob(gctx, A, t);
    paintBlob(gctx, B, t);
    paintBridge(gctx, t);
    if (falling) {
      gctx.strokeStyle = "rgba(255,255,255,0.45)";
      gctx.lineWidth = 3;
      gctx.beginPath();
      gctx.moveTo(A.x - cam, A.y - 80);
      gctx.lineTo(A.x - cam, A.y - 10);
      gctx.stroke();
    }
    if (splashOn) {
      var age = gathered ? (t - 8.2) : (t - 6.4);
      var sx = A.x - cam;
      var sy = gathered ? A.y : (GY(pl.y) - 10);
      gctx.strokeStyle = THEME.metal;
      gctx.globalAlpha = Math.max(0, 1 - age / 1.6);
      gctx.lineWidth = 4;
      gctx.beginPath();
      gctx.arc(sx, sy, 18 + age * 90, 0, 7);
      gctx.stroke();
      var outU = Math.min(1, age / 0.42);
      var backU = Math.max(0, (age - 0.38) / 0.75);
      var travel = outU * (1 - backU);
      for (var s = 0; s < 14; s++) {
        var ang = -Math.PI * 0.15 - (s / 13) * Math.PI * 0.7;
        var sp = 40 + (s % 5) * 22;
        var px = sx + Math.cos(ang) * sp * travel;
        var py = sy + Math.sin(ang) * sp * 0.55 * travel - Math.sin(travel * Math.PI) * 28;
        var rad = (4 + (s % 3) * 2) * (1 - backU * 0.9);
        if (backU > 0.12) {
          gctx.strokeStyle = "rgba(220,226,232,0.75)";
          gctx.globalAlpha = 0.8 * (1 - backU);
          gctx.lineWidth = Math.max(1, rad);
          gctx.beginPath();
          gctx.moveTo(sx, sy);
          gctx.lineTo(px, py);
          gctx.stroke();
        }
        gctx.globalAlpha = Math.max(0, 1 - backU);
        gctx.fillStyle = "#d5dbe3";
        gctx.beginPath();
        gctx.arc(px, py, Math.max(0.4, rad), 0, 7);
        gctx.fill();
      }
      gctx.globalAlpha = 1;
    }
    if (close) {
      var zoom = 1.85;
      var src = document.createElement("canvas");
      src.width = capCv.width;
      src.height = capCv.height;
      src.getContext("2d").drawImage(capCv, 0, 0);
      var cx = (A.x - cam) * dpr;
      var cy = (A.y + 70) * dpr;
      var cw = capCv.width / zoom;
      var ch = capCv.height / zoom;
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.drawImage(src, cx - cw / 2, cy - ch / 2, cw, ch, 0, 0, capCv.width, capCv.height);
    }
    return capCv;
  }

  window.MercuryRun = {
    debug: function () { return { A: [A.x, A.y, A.r], B: [B.x, B.y], cam: cam, drops: drops.length, view: view, pw: allBlobs().map(function (b) { return [b.kid, b.pw]; }), air2: allBlobs().map(function (b) { return !!b.air2; }) }; },
    exportFrame: exportFrame,
    platesReady: function () { return runPlatesReady && !!runPlates.sky; }
  };
})();
