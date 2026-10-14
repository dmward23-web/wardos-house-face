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
  var t0 = performance.now();
  function now() { return (performance.now() - t0) / 1000; }
  var pops = [];          /* loot moments */
  var victoryAt = -1;
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
  function beam(x, y, tier, t, i, boost) {
    var rgb = TIERS[tier].rgb;
    var h = 70 + (tier === "legendary" ? 26 : tier === "epic" ? 14 : 0);
    var a = (0.5 + 0.12 * Math.sin(t * 1.1 + i * 1.7)) * (boost || 1);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, "rgba(" + rgb + ",0)");
    g.addColorStop(0.7, "rgba(" + rgb + "," + (a * 0.8).toFixed(3) + ")");
    g.addColorStop(1, "rgba(" + rgb + "," + a.toFixed(3) + ")");
    ctx.fillStyle = g;
    var w = 12;
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * 0.4, y - h); ctx.lineTo(x + w * 0.4, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
    var e = ctx.createRadialGradient(x, y + 2, 2, x, y + 2, 42);
    e.addColorStop(0, "rgba(" + rgb + "," + (a * 1.3).toFixed(3) + ")");
    e.addColorStop(1, "rgba(" + rgb + ",0)");
    ctx.fillStyle = e; ctx.beginPath(); ctx.ellipse(x, y + 4, 44, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255," + (a * 0.35).toFixed(3) + ")";
    ctx.beginPath(); ctx.moveTo(x - 2.5, y); ctx.lineTo(x - 1, y - h * 0.9); ctx.lineTo(x + 1, y - h * 0.9); ctx.lineTo(x + 2.5, y); ctx.closePath(); ctx.fill();
    /* two lazy rising sparks */
    for (var s = 0; s < 2; s++) {
      var p = ((t * 0.35 + i * 0.37 + s * 0.5) % 1);
      ctx.fillStyle = "rgba(" + rgb + "," + ((1 - p) * 0.7).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(x + Math.sin(p * 6 + i + s) * 5, y - p * h, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function glider(t) {
    var T = 9;                      /* drift-in on load */
    if (t > T) return;
    var p = t / T, e = 1 - Math.pow(1 - p, 2);
    var x = W * (0.86 - 0.5 * e) + Math.sin(t * 0.9) * 14;
    var y = H * (0.04 + 0.7 * e);
    var alpha = Math.min(1, t / 0.8) * (p > 0.8 ? (1 - p) / 0.2 : 1);
    var tilt = Math.sin(t * 0.9) * 0.12 - 0.08;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(tilt);
    /* canopy */
    var cg = ctx.createLinearGradient(-46, -40, 46, -20);
    cg.addColorStop(0, "#ffb347"); cg.addColorStop(0.5, "#ff6fa8"); cg.addColorStop(1, "#5fd4ff");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(-48, -22); ctx.quadraticCurveTo(0, -66, 48, -22); ctx.quadraticCurveTo(0, -40, -48, -22); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = "rgba(230,240,255,.6)"; ctx.lineWidth = 1;
    [-44, -16, 16, 44].forEach(function (sx) { ctx.beginPath(); ctx.moveTo(sx, -24); ctx.lineTo(0, 4); ctx.stroke(); });
    /* little chrome rider */
    var rg = ctx.createRadialGradient(-3, 6, 1, 0, 10, 11);
    rg.addColorStop(0, "#ffffff"); rg.addColorStop(0.5, "#9aa6b8"); rg.addColorStop(1, "#2a3240");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(0, 10, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    /* soft contrail */
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var k = 1; k < 7; k++) {
      var tt = Math.max(0, t - k * 0.18), pp = tt / T, ee = 1 - Math.pow(1 - pp, 2);
      ctx.fillStyle = "rgba(255,230,200," + (0.09 * (1 - k / 7) * alpha).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(W * (0.86 - 0.5 * ee) + Math.sin(tt * 0.9) * 14, H * (0.04 + 0.7 * ee) - 30, 10 - k, 0, Math.PI * 2); ctx.fill();
    }
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
    var rgb = TIERS[p.tier].rgb;
    var w = 220, h = 62, cxc = Math.min(W - w / 2 - 12, W * 0.68), x = cxc - w / 2, y = H * 0.765 + rise;
    ctx.save(); ctx.globalAlpha = a;
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "rgba(" + rgb + ",0.92)"); g.addColorStop(1, "rgba(18, 14, 40, 0.92)");
    ctx.fillStyle = g; roundRect(x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = "center"; ctx.fillStyle = "#fff";
    ctx.font = "900 13px system-ui, sans-serif";
    ctx.fillText(TIERS[p.tier].name + " LOOT", cxc, y + 22);
    ctx.font = "800 20px system-ui, sans-serif";
    ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 6;
    ctx.fillText(p.label, cxc, y + 47);
    ctx.restore();
  }
  function victory(t) {
    if (victoryAt < 0) return;
    var age = t - victoryAt; if (age > 5.2) { victoryAt = -1; return; }
    var a = Math.min(1, age / 0.35) * Math.min(1, (5.2 - age) / 0.6);
    ctx.save();
    ctx.fillStyle = "rgba(20, 10, 40," + (0.35 * a).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H);
    var cx = W / 2, cy = H * 0.46;
    ctx.globalCompositeOperation = "lighter";
    for (var k = 0; k < 14; k++) {
      var ang = k / 14 * Math.PI * 2 + age * 0.12;
      ctx.fillStyle = "rgba(255, 200, 90," + (0.12 * a).toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, Math.max(W, H), ang, ang + 0.12); ctx.closePath(); ctx.fill();
    }
    for (var c = 0; c < 46; c++) {
      var cxp = (c * 97.3 % W), fall = ((age * (70 + c % 7 * 18)) + c * 31) % (H + 40) - 20;
      var hue = ["255,184,60", "196,110,255", "80,170,255", "96,224,120"][c % 4];
      ctx.fillStyle = "rgba(" + hue + "," + (0.85 * a).toFixed(3) + ")";
      ctx.save(); ctx.translate(cxp + Math.sin(age * 2 + c) * 12, fall); ctx.rotate(age * 3 + c); ctx.fillRect(-4, -2, 8, 4); ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    var s = 0.8 + 0.2 * Math.min(1, age / 0.4) + (age < 0.6 ? Math.sin(age / 0.6 * Math.PI) * 0.08 : 0);
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.font = "900 26px system-ui, sans-serif"; ctx.fillStyle = "#fff4d6";
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 10;
    ctx.fillText("#1", 0, -44);
    var g = ctx.createLinearGradient(0, -34, 0, 14);
    g.addColorStop(0, "#fff3b0"); g.addColorStop(0.5, "#ffc23a"); g.addColorStop(1, "#e07a10");
    ctx.font = "900 italic 58px system-ui, sans-serif"; ctx.fillStyle = g;
    ctx.lineWidth = 6; ctx.strokeStyle = "#3a1a60"; ctx.strokeText("VICTORY!", 0, 8); ctx.fillText("VICTORY!", 0, 8);
    ctx.font = "800 18px system-ui, sans-serif"; ctx.fillStyle = "#fff"; ctx.shadowBlur = 8;
    ctx.fillText("All loot secured · jar full", 0, 42);
    ctx.restore();
  }

  function shortName(l) {
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    try {
      stormEdge(t);
      var info = global.KidWorld && KidWorld.hits && KidWorld.hits();
      if (info && info.hits) {
        var r = info.cv.getBoundingClientRect();
        var sx = r.width / Math.max(1, W);
        info.hits.forEach(function (q, i) {
          if (q.done || q.x == null) return;
          var ms = q.ms || 72;
          beam(r.left + q.x * sx, r.top + ((q.seat || q.y) - ms * 0.42) * sx, tierFor(q, i), t, i);
        });
      }
      if (!reduced) glider(t);
      pops = pops.filter(function (p) { return drawPop(p, t); });
      pops.forEach(function (p) { lootCard(p, t); });
      victory(t);
    } catch (e) { /* overlay must never break the board */ }
    if (lastFill === null) lastFill = fill();
    requestAnimationFrame(frame);
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
