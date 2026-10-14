/* HAYESLOOT1 · Hayes-only drop-zone layer over the Ori world.
   Loot beams with rarity glow on open chores, a storm-circle sky edge, a glider that
   drifts in on load, a loot pop + punchy synth sting when a chore drops in the jar, and
   a #1 VICTORY moment when the jar fills. Original art/sound only. Pointer-events: none,
   so it can never block a tap. Loaded only by kid-hayes.html. */
(function (global) {
  "use strict";
  if (!document.body || document.body.getAttribute("data-kid") !== "hayes") return;
  var reduced = false;
  try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var TIERS = {
    common:    { name: "COMMON",    rgb: "196, 206, 214" },
    uncommon:  { name: "UNCOMMON",  rgb: "96, 224, 120" },
    rare:      { name: "RARE",      rgb: "80, 170, 255" },
    epic:      { name: "EPIC",      rgb: "196, 110, 255" },
    legendary: { name: "LEGENDARY", rgb: "255, 184, 60" }
  };
  var CYCLE = ["uncommon", "rare", "common", "rare", "uncommon", "epic", "common"];
  function tierFor(q, i) {
    var l = String((q && q.label) || "").toLowerCase();
    if (/room reset/.test(l)) return "legendary";
    if (/weekly must|cubby/.test(l)) return "epic";
    if (/sports bag|cubby/.test(l)) return "epic";
    return CYCLE[i % CYCLE.length];
  }

  var cv = document.createElement("canvas");
  cv.className = "hl-layer";
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:2;pointer-events:none";
  var ctx = cv.getContext("2d");
  var dpr = 1, W = 0, H = 0;
  function resize() {
    dpr = Math.min(2, global.devicePixelRatio || 1);
    W = global.innerWidth || 440; H = global.innerHeight || 800;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  /* Painted layers + sprites (Prism, art/hayes-loot/1x|2x). Missing art just skips its layer. */
  var ART = {}, DIR = "art/hayes-loot/" + ((global.devicePixelRatio || 1) > 1.4 ? "2x/" : "1x/");
  ["glider", "card-common", "card-uncommon", "card-rare", "card-epic", "card-legendary",
   "beam-common", "beam-uncommon", "beam-rare", "beam-epic", "beam-legendary",
   "particles-far", "particles-mid", "particles-near", "fog-mid", "fog-low", "light-shafts",
   "fg-left", "fg-right", "fg-bottom", "victory-rays", "victory-burst", "victory-confetti-strip"
  ].forEach(function (n) {
    var im = new Image();
    im.onload = function () { ART[n] = im; };
    /* 3x phones get the 3x cards (tiny); everything else uses 2x (or 1x on 1x screens) */
    var dir = /^card-/.test(n) && (global.devicePixelRatio || 1) >= 2.6 ? "art/hayes-loot/3x/" : DIR;
    im.onerror = function () { if (!im._png) { im._png = 1; im.src = dir + n + ".png"; } };   /* WebP first, PNG fallback */
    im.src = dir + n + ".webp";
  });
  /* 1x design sizes from Prism's README */
  var SZ = { glider: [240, 192, 120, 131], card: [240, 84], beam: [112, 176, 56, 160] };
  function cover(name, alpha, blend, ox, oy, extra) {
    var im = ART[name]; if (!im) return;
    var k = Math.max(W / 1280, H / 800) * (extra || 1.06), w = 1280 * k, h = 800 * k;
    ctx.save(); ctx.globalAlpha = alpha; if (blend) ctx.globalCompositeOperation = blend;
    ctx.drawImage(im, (W - w) / 2 + (ox || 0), (H - h) / 2 + (oy || 0), w, h);
    ctx.restore();
  }
  var t0 = performance.now();
  function now() { return (performance.now() - t0) / 1000; }
  var pops = [];          /* loot moments */
  var victoryAt = -1, victoryCy = null, victoryScale = 1, victoryCx = null;
  var lastFill = null;

  /* ---------- sound (own WebAudio, unlocked on first touch) ---------- */
  var ac = null, master = null;
  function audio() {
    if (ac) return ac;
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination);
    } catch (e) { ac = null; }
    return ac;
  }
  function muted() {
    try { if (localStorage.getItem("house-sfx:mute") === "1") return true; } catch (e) {}
    return document.documentElement.getAttribute("data-sound") === "off";
  }
  function note(f, at, dur, type, vol, slideTo) {
    var a = audio(); if (!a || muted()) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "triangle"; o.frequency.setValueAtTime(f, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + dur + 0.05);
  }
  function whoosh(at, dur) {
    var a = audio(); if (!a || muted()) return;
    var n = Math.round(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / n);
    var s = a.createBufferSource(); s.buffer = b;
    var f = a.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(500, at); f.frequency.exponentialRampToValueAtTime(3800, at + dur);
    var g = a.createGain(); g.gain.value = 0.22;
    s.connect(f); f.connect(g); g.connect(master); s.start(at);
  }
  var STEPS = { common: 2, uncommon: 3, rare: 4, epic: 5, legendary: 6 };
  function lootSting(tier) {
    var a = audio(); if (!a || muted()) return;
    if (a.state === "suspended") a.resume();
    var t = a.currentTime + 0.01;
    whoosh(t, 0.28);
    note(110, t, 0.18, "square", 0.18, 70);              /* lid thunk */
    var scale = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    for (var i = 0; i < STEPS[tier]; i++) note(scale[i], t + 0.12 + i * 0.065, 0.32, "triangle", 0.2);
    note(scale[STEPS[tier] - 1] * 2, t + 0.14 + STEPS[tier] * 0.065, 0.6, "sine", 0.12);
  }
  function victorySting() {
    var a = audio(); if (!a || muted()) return;
    var t = a.currentTime + 0.05;
    [[392, 0], [523.25, 0.16], [659.25, 0.32], [783.99, 0.48]].forEach(function (n) { note(n[0], t + n[1], 0.3, "square", 0.12); note(n[0] / 2, t + n[1], 0.3, "triangle", 0.18); });
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f) { note(f, t + 0.7, 1.4, "sawtooth", 0.07); note(f, t + 0.7, 1.6, "triangle", 0.12); });
    whoosh(t + 0.6, 0.5);
  }
  document.addEventListener("pointerdown", function () { var a = audio(); if (a && a.state === "suspended") a.resume(); }, true);

  /* ---------- painters ---------- */
  function stormEdge(t) {
    var cx = W * 0.5, cy = H * 0.66, R = Math.hypot(W, H) * 0.5 * (0.98 + 0.012 * Math.sin(t * 0.25));
    var g = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.25);
    g.addColorStop(0, "rgba(120, 60, 230, 0)");
    g.addColorStop(0.35, "rgba(132, 70, 240, 0.16)");
    g.addColorStop(1, "rgba(70, 20, 150, 0.42)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* soft storm wall rim, slowly rotating shimmer */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 6;
    for (var k = 0; k < 3; k++) {
      var a0 = -Math.PI * 0.98 + k * 0.7 + t * 0.05;
      ctx.strokeStyle = "rgba(190, 150, 255," + (0.10 + 0.05 * Math.sin(t * 0.6 + k)).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.97, a0, a0 + 0.55); ctx.stroke();
    }
    ctx.restore();
  }
  function beam(x, y, tier, t, i) {
    var im = ART["beam-" + tier]; if (!im) return;
    var k = 0.62, a = 0.82 + 0.18 * Math.sin(t * 1.1 + i * 1.7);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
    ctx.drawImage(im, x - SZ.beam[2] * k, y - SZ.beam[3] * k, SZ.beam[0] * k, SZ.beam[1] * k);
    ctx.restore();
  }
  function glider(t) {
    var T = 9;                      /* drift-in on load, lands by the jar */
    if (t > T) return;
    var p = t / T, e = 1 - Math.pow(1 - p, 2);
    var x = W * (0.86 - 0.5 * e) + Math.sin(t * 0.9) * 14;
    var y = H * (0.04 + 0.7 * e);
    var alpha = Math.min(1, t / 0.8) * (p > 0.8 ? (1 - p) / 0.2 : 1);
    var tilt = Math.sin(t * 0.9) * 0.12 - 0.08;
    var sc = 0.75 + 0.35 * e;      /* comes toward camera as it falls */
    /* soft contrail */
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var k = 1; k < 8; k++) {
      var tt = Math.max(0, t - k * 0.16), pp = tt / T, ee = 1 - Math.pow(1 - pp, 2);
      ctx.fillStyle = "rgba(255,230,200," + (0.08 * (1 - k / 8) * alpha).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(W * (0.86 - 0.5 * ee) + Math.sin(tt * 0.9) * 14, H * (0.04 + 0.7 * ee) - 34 * sc, (12 - k) * sc, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    var im = ART.glider;
    if (!im) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(sc, sc);
    var gk = 0.62;   /* 240px art -> ~150px on a phone, then grows as it nears */
    ctx.drawImage(im, -SZ.glider[2] * gk, -SZ.glider[3] * gk, SZ.glider[0] * gk, SZ.glider[1] * gk);
    ctx.restore();
  }

  function drawPop(p, t) {
    var age = t - p.t0; if (age < 0 || age > 2.6) return false;
    var rgb = TIERS[p.tier].rgb;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    /* column flash */
    var ca = Math.max(0, 1 - age / 0.9);
    var cg = ctx.createLinearGradient(0, p.y - 260, 0, p.y);
    cg.addColorStop(0, "rgba(" + rgb + ",0)"); cg.addColorStop(1, "rgba(" + rgb + "," + (0.55 * ca).toFixed(3) + ")");
    ctx.fillStyle = cg; ctx.fillRect(p.x - 22 * (1 + age), p.y - 260, 44 * (1 + age), 260);
    /* shockwave ring */
    var r = 20 + age * 120, ra = Math.max(0, 0.75 - age * 0.55);
    ctx.strokeStyle = "rgba(" + rgb + "," + ra.toFixed(3) + ")"; ctx.lineWidth = 5 * (1 - age / 2.6) + 1;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
    /* shards */
    p.sh.forEach(function (s) {
      var a = s.a, d = s.v * age, gx = p.x + Math.cos(a) * d, gy = p.y - Math.abs(Math.sin(a)) * d + 60 * age * age;
      var sa = Math.max(0, 1 - age / 1.6);
      ctx.fillStyle = "rgba(" + rgb + "," + sa.toFixed(3) + ")";
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(a + age * 3); ctx.fillRect(-s.s, -s.s * 0.35, s.s * 2, s.s * 0.7); ctx.restore();
    });
    ctx.restore();
    return true;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function lootCard(p, t) {
    var age = t - p.t0; if (age < 0.15 || age > 2.4) return;
    var a = Math.min(1, (age - 0.15) / 0.2) * Math.min(1, (2.4 - age) / 0.4);
    var rise = (1 - Math.min(1, (age - 0.15) / 0.3)) * 14;
    var w = 240, h = 84, cxc = Math.min(W - w / 2 - 2, W * 0.68), x = cxc - w / 2, y = H * 0.755 + rise;
    var im = ART["card-" + p.tier];
    ctx.save(); ctx.globalAlpha = a;
    if (im) ctx.drawImage(im, x, y, w, h);
    else { ctx.fillStyle = "rgba(16,32,42,.9)"; roundRect(x + 21, y + 21, 198, 42, 10); ctx.fill(); }
    var tx = x + 21 + 99;
    ctx.textAlign = "center"; ctx.shadowColor = "rgba(0,0,0,.75)"; ctx.shadowBlur = 5;
    ctx.font = "900 11px system-ui, sans-serif"; ctx.fillStyle = "rgba(" + TIERS[p.tier].rgb + ",1)";
    ctx.fillText(TIERS[p.tier].name + " LOOT", tx, y + 21 + 14);
    ctx.font = "800 16px system-ui, sans-serif"; ctx.fillStyle = "#fffaf0";
    ctx.fillText(p.label, tx, y + 21 + 34);
    ctx.restore();
  }
  function victory(t) {
    if (victoryAt < 0) return;
    var age = t - victoryAt; if (age < 0) return;
    if (age > 5.6) { victoryAt = -1; victoryCy = null; return; }
    if (victoryCy == null) victoryCy = victoryY();
    var a = Math.min(1, age / 0.35) * Math.min(1, (5.6 - age) / 0.7);
    var cx = victoryCx != null ? victoryCx : W / 2, cy = victoryCy;
    ctx.save();
    ctx.fillStyle = "rgba(20, 10, 40," + (0.18 * a).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
    var R = ART["victory-rays"], B = ART["victory-burst"], C = ART["victory-confetti-strip"];
    ctx.globalCompositeOperation = "screen";
    if (R) { ctx.save(); ctx.globalAlpha = (0.6 + 0.2 * Math.sin(age * 1.4)) * a; ctx.translate(cx, cy); ctx.rotate(age * 0.12);
      var rs = Math.max(W, H) * 1.3; ctx.drawImage(R, -rs / 2, -rs / 2, rs, rs); ctx.restore(); }
    if (B) { var bp = Math.min(1, age / 0.5), bs = 300 * victoryScale * (0.6 + 0.4 * bp) * (1 + 0.04 * Math.sin(age * 3));
      ctx.globalAlpha = a * (age < 0.5 ? 1 : 0.85); ctx.drawImage(B, cx - bs / 2, cy - bs / 2, bs, bs); }
    ctx.globalCompositeOperation = "source-over";
    if (C) { var fr = Math.floor(age * 8) % 8;
      for (var c = 0; c < 9; c++) {
        var cxp = (c % 3) * W / 3 + (c * 37 % 50), cyp = ((age * (60 + c * 9) + c * 140) % (H + 200)) - 160;
        ctx.globalAlpha = a; ctx.drawImage(C, fr * 256, 0, 256, 256, cxp - 40, cyp, 170, 170);
      } }
    ctx.restore();
    ctx.save();
    var s = 0.8 + 0.2 * Math.min(1, age / 0.4) + (age < 0.6 ? Math.sin(age / 0.6 * Math.PI) * 0.08 : 0);
    ctx.translate(cx, cy); s *= victoryScale; ctx.scale(s, s); ctx.globalAlpha = a; ctx.textAlign = "center";
    /* frosted glass panel behind the words so they read without a full-screen dim */
    ctx.save(); ctx.globalAlpha = a * 0.78; ctx.fillStyle = "rgba(24, 16, 48, 0.72)"; roundRect(-170, -70, 340, 120, 22); ctx.fill();
    ctx.strokeStyle = "rgba(255, 214, 140, 0.55)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    ctx.font = "900 24px system-ui, sans-serif"; ctx.fillStyle = "#fff4d6";
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 10;
    ctx.fillText("#1", 0, -40);
    var g = ctx.createLinearGradient(0, -30, 0, 12);
    g.addColorStop(0, "#fff3b0"); g.addColorStop(0.5, "#ffc23a"); g.addColorStop(1, "#e07a10");
    ctx.font = "900 italic 52px system-ui, sans-serif"; ctx.fillStyle = g;
    ctx.lineWidth = 6; ctx.strokeStyle = "#3a1a60"; ctx.strokeText("VICTORY!", 0, 8); ctx.fillText("VICTORY!", 0, 8);
    ctx.font = "800 16px system-ui, sans-serif"; ctx.fillStyle = "#fff"; ctx.shadowBlur = 8;
    ctx.fillText("All loot secured · jar full", 0, 36);
    ctx.restore();
  }
  function victoryY() {
    /* glass panel beside the jar creature (never over it, never over a chest or label):
       right of the creature, below the lowest chest/label in that column, above the Farther/Path buttons */
    var jar = document.querySelector("[data-kw-jar]"), jr = jar && jar.getBoundingClientRect();
    var left = jr && jr.width ? jr.right + 8 : W * 0.5;
    var btn = document.querySelector("[data-kw-more]"), br = btn && btn.getBoundingClientRect();
    var bottom = br && br.height ? br.top - 8 : H * 0.88;
    var info = global.KidWorld && KidWorld.hits && KidWorld.hits(), top = H * 0.6;
    if (info && info.hits) info.hits.forEach(function (q) {
      var ms = q.ms || 72, lx = q.labelX != null ? q.labelX : q.x, cy = q.chipY != null ? q.chipY : q.y;
      if (q.x + ms * 0.5 > left) top = Math.max(top, (q.seat || q.y) + ms * 0.45);
      if (lx + (q.hw || 80) / 2 > left) top = Math.max(top, cy + (q.hh || 36) / 2);
    });
    top += 8;
    var availW = W - 6 - left, availH = Math.max(40, bottom - top);
    victoryScale = Math.max(0.5, Math.min(1, availW / 344, availH / 124));
    victoryCx = left + availW / 2;
    return top + availH / 2 + 10 * victoryScale;
  }
  /* ---------- immersion: depth, air, light, sound ---------- */
  var tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  global.addEventListener("deviceorientation", function (e) {
    if (e.gamma == null) return;
    tilt.tx = Math.max(-1, Math.min(1, (e.gamma || 0) / 25));
    tilt.ty = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 25));
  });
  /* Prism depth stack, back -> front. Each depth drifts and tilts at its own rate. */
  function back(t) {
    var ox = tilt.x * 6, oy = tilt.y * 4;
    cover("particles-far", 0.8, "screen", ((t * 4) % 60) - 30 + ox, Math.sin(t * 0.1) * 6 + oy);
    cover("fog-mid", 0.6, null, Math.sin(t * 0.05) * 24 + ox * 1.5, oy);
    cover("light-shafts", 0.5 + 0.1 * Math.sin(t * 2 * Math.PI / 8), "screen", ox * 0.5, 0);
  }
  function middle(t) {
    var ox = tilt.x * 12, oy = tilt.y * 7;
    cover("fog-low", 0.5, null, Math.sin(t * 0.07 + 1) * 34 + ox, oy);
    cover("particles-mid", 1, "screen", ((t * 9) % 80) - 40 + ox, -((t * 5) % 60) + 30 + oy);
  }
  function frond(x, y, len, ang, sway) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang + sway);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.08, len, -len * 0.02);
    ctx.strokeStyle = "rgba(6, 14, 14, 0.9)"; ctx.lineWidth = 4; ctx.stroke();
    for (var i = 1; i < 12; i++) {
      var u = i / 12, px = len * u, py = -len * 0.06 * Math.sin(u * 3), lw = len * 0.2 * (1 - u * 0.7);
      ctx.fillStyle = "rgba(6, 14, 14, 0.92)";
      [-1, 1].forEach(function (sd) {
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + lw * 0.4, py + sd * lw * 0.55, px + lw * 0.75, py + sd * lw);
        ctx.quadraticCurveTo(px + lw * 0.2, py + sd * lw * 0.35, px, py); ctx.fill();
      });
    }
    ctx.restore();
  }
  function nearLayer(t) {
    /* foreground plants close to camera: sit at the edges below the chores, sway, slide with tilt */
    var ox = tilt.x * 24, oy = tilt.y * 12, sw = Math.sin(t * 2 * Math.PI / 11);
    var L = ART["fg-left"], R = ART["fg-right"], B = ART["fg-bottom"];
    ctx.save(); ctx.globalAlpha = 0.9;
    var fw = W * 0.34, fh = fw * 800 / 426;          /* scaled to a third of the phone width */
    var breathIn = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI / 26);
    if (L) ctx.drawImage(L, -fw * 0.18 - 10 * (1 - breathIn) + ox + sw * 3, H - fh * 0.92 + oy, fw, fh);
    if (R) ctx.drawImage(R, W - fw * 0.82 + 10 * (1 - breathIn) + ox - sw * 3, H - fh * 0.92 + oy, fw, fh);
    if (B) { var bw = W * 1.15, bh = bw * 170 / 1280; ctx.drawImage(B, (W - bw) / 2 + ox * 1.2, H - bh + 6 + oy, bw, bh); }
    ctx.restore();
    cover("particles-near", 0.7, "screen", ((t * 16) % 120) - 60 + tilt.x * 40, Math.sin(t * 0.2) * 14 + tilt.y * 20, 1.15);
  }
  function grounding(info, r, sx) {
    /* contact shadow + warm bounce under each chest so it sits on its island */
    info.hits.forEach(function (q) {
      if (q.x == null) return;
      var ms = q.ms || 72, x = r.left + q.x * sx, y = r.top + ((q.seat || q.y) + ms * 0.36) * sx;
      var g = ctx.createRadialGradient(x, y, 2, x, y, ms * 0.62);
      g.addColorStop(0, "rgba(6, 10, 12, 0.42)"); g.addColorStop(1, "rgba(6, 10, 12, 0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, ms * 0.62, ms * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    });
  }
  function clearLabels(info, r, sx) {
    /* keep chore labels crisp: nothing from this layer paints over them */
    ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "#000";
    info.hits.forEach(function (q) {
      if (q.x == null) return;
      var hw = (q.hw || 80) / 2 + 4, hh = (q.hh || 36) / 2 + 4, cy = q.chipY != null ? q.chipY : q.y;
      roundRect(r.left + ((q.labelX != null ? q.labelX : q.x) - hw) * sx, r.top + (cy - hh) * sx, hw * 2 * sx, hh * 2 * sx, 10); ctx.fill();
    });
    ctx.restore();
  }
  function sceneLight(p, t) {
    /* the loot lights up the world around it, then settles */
    var age = t - p.t0; if (age < 0 || age > 2) return;
    var a = age < 0.15 ? age / 0.15 : Math.max(0, 1 - (age - 0.15) / 1.85);
    var rgb = TIERS[p.tier].rgb;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    var g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 300);
    g.addColorStop(0, "rgba(" + rgb + "," + (0.42 * a).toFixed(3) + ")");
    g.addColorStop(0.4, "rgba(" + rgb + "," + (0.14 * a).toFixed(3) + ")");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  /* ambient bed: wind + far-off storm rumble, very low, starts on first touch */
  var ambOn = false;
  function startAmbient() {
    var a = audio(); if (!a || ambOn) return; ambOn = true;
    var n = a.sampleRate * 4, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.06; d[i] = last; }
    var src = a.createBufferSource(); src.buffer = b; src.loop = true;
    var f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 520;
    var g = a.createGain(); g.gain.value = 0.0;
    var lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.10;
    lfo.connect(lg); lg.connect(g.gain);
    var base = a.createConstantSource ? a.createConstantSource() : null;
    if (base) { base.offset.value = 0.16; base.connect(g.gain); base.start(); }
    src.connect(f); f.connect(g); g.connect(master); src.start(); lfo.start();
    (function rumble() {
      setTimeout(function () {
        if (muted() || !ac) return rumble();
        var t = ac.currentTime; note(48, t, 2.6, "sine", 0.10, 34); whoosh(t, 1.8); rumble();
      }, 18000 + Math.random() * 16000);
    })();
  }
  document.addEventListener("pointerdown", function () { if (!muted()) startAmbient(); }, true);
  function shortName(l) {
    var co = global.KidCallouts, info = global.KidWorld && KidWorld.hits && KidWorld.hits();
    if (co && info) for (var i = 0; i < info.hits.length; i++) if (info.hits[i].label === l && co[info.hits[i].chip]) return co[info.hits[i].chip][0];
    return String(l || "").replace(/^[^A-Za-z]+/, "").split(/[—·(]/)[0].trim().slice(0, 20) || "Chore";
  }

  function addPop(x, y, tier, label) {
    var sh = [];
    for (var i = 0; i < 18; i++) sh.push({ a: Math.PI * (0.1 + 0.8 * (i / 17)) + (Math.random() - 0.5) * 0.2, v: 70 + Math.random() * 120, s: 3 + Math.random() * 4 });
    pops.push({ t0: now(), x: x, y: y, tier: tier, label: shortName(label), sh: sh });
    if (pops.length > 4) pops.shift();
  }

  function fill() {
    try { return global.JarEngine ? (JarEngine.choreState("hayes").fill || 0) : 0; } catch (e) { return 0; }
  }
  function checkVictory() {
    var f = fill();
    if (lastFill !== null && lastFill < 0.999 && f >= 0.999) { victoryAt = now() + 0.9; setTimeout(victorySting, 900); }
    lastFill = f;
  }

  document.addEventListener("kw:feed", function (ev) {
    var d = ev.detail || {};
    var info = global.KidWorld && KidWorld.hits && KidWorld.hits();
    var q = info && info.hits[d.index];
    var tier = tierFor(q, d.index || 0);
    var x = d.x, y = d.y;
    if (q && info.cv) {
      var r = info.cv.getBoundingClientRect(), sx = r.width / Math.max(1, info.cv.width / Math.min(2, global.devicePixelRatio || 1));
      x = r.left + q.x * (sx || 1); y = r.top + (q.seat || q.y) * (sx || 1);
    }
    addPop(x, y, tier, d.label);
    lootSting(tier);
    setTimeout(checkVictory, 60);
  });

  function frame() {
    var t = reduced ? 2.4 : now();
    tilt.x += (tilt.tx - tilt.x) * 0.04; tilt.y += (tilt.ty - tilt.y) * 0.04;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    try {
      if (!reduced) breathe(t);
      var info = global.KidWorld && KidWorld.hits && KidWorld.hits();
      var r = info && info.cv ? info.cv.getBoundingClientRect() : null;
      var sx = r ? r.width / Math.max(1, W) : 1;
      if (!reduced) back(t);
      if (info && info.hits) grounding(info, r, sx);
      stormEdge(t);
      if (info && info.hits) {
        info.hits.forEach(function (q, i) {
          if (q.done || q.x == null) return;
          var ms = q.ms || 72;
          beam(r.left + q.x * sx, r.top + ((q.seat || q.y) - ms * 0.3) * sx, tierFor(q, i), t, i);
        });
      }
      pops.forEach(function (p) { sceneLight(p, t); });
      if (!reduced) glider(t);
      if (!reduced) middle(t);
      pops = pops.filter(function (p) { return drawPop(p, t); });
      if (!reduced) nearLayer(t);
      if (info && info.hits) clearLabels(info, r, sx);
      pops.forEach(function (p) { lootCard(p, t); });
      victory(t);
    } catch (e) { /* overlay must never break the board */ }
    if (lastFill === null) lastFill = fill();
    requestAnimationFrame(frame);
  }
  /* slow camera breathing: the world canvas scales ~1% on a 14s cycle; taps map through its rect */
  function breathe(t) {
    var wc = document.querySelector(".kw-canvas");
    if (!wc) return;
    var s = 1.012 + 0.008 * Math.sin(t * 2 * Math.PI / 14);
    var dx = Math.sin(t * 2 * Math.PI / 23) * 3;
    wc.style.transformOrigin = "50% 60%";
    wc.style.transform = "translate(" + dx.toFixed(2) + "px,0) scale(" + s.toFixed(4) + ")";
  }
  function boot() {
    resize();
    document.body.appendChild(cv);
    global.addEventListener("resize", resize);
    requestAnimationFrame(frame);
  }
  global.HayesLoot = { tierFor: tierFor, previewVictory: function () { victoryAt = now(); victorySting(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(window);
