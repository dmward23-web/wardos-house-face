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

  function resize() {
    var dpr = Math.min(1.35, devicePixelRatio || 1);
    var w = innerWidth, h = innerHeight;
    if (w * dpr > 1400) dpr = 1400 / w;
    cv.width = off.width = Math.round(w * dpr);
    cv.height = off.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
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
      var s = 80 + Math.random() * 260;
      drops.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, a: 1, r: 2 + Math.random() * 5, c: color });
    }
    rings.push({ x: x, y: y, r: 6, a: 0.85 });
  }
  function gather(b) {
    if (b.inv > 0) return;
    burst(b.x, b.y, 22, THEME.metal);
    tone("splash");
    shake = 8;
    b.x = b.cp.x; b.y = b.cp.y; b.vx = 0; b.vy = 0; b.inv = 0.45; b.alive = true;
  }

  function stepBlob(b, dt, t, input) {
    if (won) return;
    b.inv = Math.max(0, b.inv - dt);
    var accel = 0;
    if (input) {
      var worldX = cam + input.x;
      accel = clamp(worldX - b.x, -160, 160);
      b.vx += accel * 8 * dt;
      if (input.jump) { b.want = 0.12; input.jump = false; }
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
    if (b.grounded) b.coyote = 0.12; else b.coyote -= dt;
    if (b.want > 0 && (b.grounded || b.coyote > 0)) {
      b.vy = -720; b.grounded = false; b.coyote = 0; b.want = 0; b.squash = 0.72;
      tone("jump");
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
            if (b.vy > 220) { burst(b.x, top, 8, THEME.metal); tone("land"); b.squash = 1.35; shake = Math.min(6, b.vy / 200); }
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
      if (Math.hypot(b.x - dr.x, b.y - dy) < b.r + dr.r * 0.45) gather(b);
    }
    if (was && !b.grounded) { /* stepped off */ }
  }

  function stepDrops(dt) {
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      d.age = (d.age || 0) + dt;
    if (d.age > 0.22) {
      var tx = A.x, ty = A.y;
      if (Math.hypot(B.x - d.x, B.y - d.y) < Math.hypot(tx - d.x, ty - d.y)) { tx = B.x; ty = B.y; }
      d.vx += (tx - d.x) * 8 * dt;
      d.vy += (ty - d.y) * 8 * dt;
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

  function livingPlat(g, x, y, w, t, i, grove) {
    var img = grove ? (runPlates.mid || runPlates.near) : (i % 3 === 0 ? runPlates.mid : i % 3 === 1 ? runPlates.fg : runPlates.near);
    var sway = Math.sin(t * 1.1 + i) * 2;
    g.save();
    g.beginPath();
    g.roundRect(x, y + sway, w, 26, 10);
    g.clip();
    if (img) g.drawImage(img, -((i * 90) % 400), y - 80, w + 220, 160);
    else {
      g.fillStyle = "#3c4638";
      g.fillRect(x, y, w, 26);
    }
    g.restore();
    g.fillStyle = "rgba(12, 18, 14, 0.35)";
    g.fillRect(x, y + sway, w, 4);
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
    frame.l = now;
    var W = view.w, H = view.h;
    var ids = Object.keys(pointers);
    var inA = null, inB = null;
    ids.forEach(function (id) {
      if (pointers[id].blob === 0) inA = pointers[id];
      else inB = pointers[id];
    });
    B.echo = !inB;
    stepBlob(A, dt, t, inA);
    stepBlob(B, dt, t, inB);
    stepDrops(dt);
    if (!won && A.x > goalX + 20 && B.x > goalX + 20 && A.grounded && B.grounded) {
      won = true; tone("grove"); burst((A.x + B.x) / 2, A.y, 30, "#fff");
    }
    var mid = (A.x + B.x) / 2;
    var aim = mid - W * 0.38;
    cam += (aim - cam) * (reduced ? 1 : 0.08);
    cam = Math.max(0, cam);
    shake *= 0.86;
    ox.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ox.clearRect(0, 0, W, H);
    paintWorld(ox, t, W, H);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!reduced && shake > 0.4) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    else shake = 0;
    ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, W, H);
    paintBlob(ctx, A, t);
    paintBlob(ctx, B, t);
    paintBridge(ctx, t);
    drops.forEach(function (d) {
      ctx.globalAlpha = Math.max(0, d.a);
      ctx.fillStyle = d.c;
      ctx.beginPath(); ctx.ellipse(d.x - cam, d.y, d.r, d.r * 1.4, 0, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (playing && !document.hidden) requestAnimationFrame(frame);
  }

  function assignPointer(e) {
    var rec = cv.getBoundingClientRect();
    var x = e.clientX - rec.left, y = e.clientY - rec.top;
    var blob = 0;
    var used = {};
    Object.keys(pointers).forEach(function (id) { used[pointers[id].blob] = 1; });
    if (used[0] && !used[1]) blob = 1;
    else if (!used[0]) blob = 0;
    else blob = x > view.w * 0.5 ? 1 : 0;
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
      var b = p.blob === 0 ? A : B;
      if (p.jump) b.want = 0.14;
    }
    delete pointers[e.pointerId];
  }
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "d") A.vx += 40;
    if (e.key === "ArrowLeft" || e.key === "a") A.vx -= 40;
    if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") A.want = 0.12;
    if (e.key === "l") B.vx += 40;
    if (e.key === "j") B.vx -= 40;
    if (e.key === "i") { B.echo = false; B.want = 0.12; }
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
    ui.innerHTML = '<div class="hud"><a href="' + THEME.back + '">Back</a><span></span></div><div class="hint">One hand to roll and flick upward. A second hand wakes the other drop.</div>';
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
    note.innerHTML = '<p style="font-size:28px;font-weight:700;text-shadow:0 0 18px #fff">The grove holds both.</p><a href="' + THEME.back + '">Back</a>';
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
    exportFrame: exportFrame,
    platesReady: function () { return runPlatesReady && !!runPlates.sky; }
  };
})();
