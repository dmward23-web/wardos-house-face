/* kid-world.js · the painted world IS the board.
   Four-plus parallax layers, light, fog, motes, and living motion.
   Musts are things in that world: islands, ore, lanterns.
   The week is a compact strip. The jar is the creature.
   Original drawing only. Theme notes stay in comments. */
(function (global) {
  "use strict";

  var LOOT = ["#c5ccd4", "#5dffa0", "#59b7ff", "#c98bff", "#ffd56a"];
  var reduced = false;
  try { reduced = !!(global.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function kid() { return (document.body && document.body.getAttribute("data-kid")) || "hayes"; }
  function rnd(i) { var x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function chicagoHour() {
    try {
      return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date()), 10) || 0;
    } catch (e) { return new Date().getHours(); }
  }
  function clockLine() {
    try {
      if (global.HouseClock && HouseClock.now) {
        var s = HouseClock.now();
        if (s && s.time) return (s.dow || "") + " · " + s.time;
      }
      var p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true
      }).formatToParts(new Date()).forEach(function (x) { if (x.type !== "literal") p[x.type] = x.value; });
      return (p.weekday || "") + " · " + (p.hour || "") + ":" + (p.minute || "") + (p.dayPeriod ? " " + p.dayPeriod : "");
    } catch (e2) { return ""; }
  }

  var dayIso = "";
  var burstAt = -1;
  var capMode = false;

  function weekMeta() {
    var q = document.querySelector(".quest.daily-week");
    if (!q) return [];
    return Array.prototype.map.call(q.querySelectorAll(".day-tap"), function (b) {
      var iso = b.getAttribute("data-day-iso") || "";
      return {
        iso: iso,
        letter: (b.textContent || "").trim().slice(0, 1) || "·",
        num: iso.slice(-2).replace(/^0/, ""),
        today: b.classList.contains("is-today")
      };
    });
  }

  function readQuests(iso) {
    var out = [];
    document.querySelectorAll(".quest[data-kid-quest]").forEach(function (q) {
      if (q.getAttribute("data-optional") === "1") return;
      var whatEl = q.querySelector(".what");
      var label = ((whatEl && whatEl.textContent) || "Must").replace(/\s+/g, " ").trim();
      var cadence = q.getAttribute("data-cadence") || "daily";
      var btn = cadence === "daily" ? q.querySelector('.day-tap[data-day-iso="' + iso + '"]') : q.querySelector("[data-check]");
      if (!btn) return;
      out.push({ label: label.slice(0, 18), done: btn.classList.contains("done"), btn: btn });
    });
    return out.slice(0, 9);
  }

  function placeQuests(list, W, H) {
    var n = list.length || 1;
    var cols = n > 6 ? 3 : 2;
    list.forEach(function (q, i) {
      var c = i % cols;
      var r = Math.floor(i / cols);
      var rows = Math.ceil(n / cols);
      q.x = W * (cols === 2 ? 0.3 + c * 0.4 : 0.22 + c * 0.28);
      q.y = H * (0.3 + r * (0.36 / Math.max(1, rows)));
      q.r = 58;
    });
    return list;
  }

  /* ---------- painters ---------- */
  function sky(ctx, W, H, stops) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  function shafts(ctx, W, H, t, col) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = col;
      ctx.save();
      ctx.translate(W * (0.12 + i * 0.24) + Math.sin(t * 0.15 + i) * 8, 0);
      ctx.rotate(-0.22 + Math.sin(t * 0.2 + i) * 0.02);
      ctx.fillRect(0, 0, 28 + i * 6, H * 0.72);
      ctx.restore();
    }
    ctx.restore();
  }
  function motes(ctx, W, H, t, px, tint, n) {
    for (var i = 0; i < n; i++) {
      var x = (rnd(i) * W + Math.sin(t * (0.3 + rnd(i + 2)) + i) * 18 + px * (0.2 + rnd(i + 4))) % W;
      if (x < 0) x += W;
      var y = (rnd(i + 9) * H * 0.85 - t * (8 + rnd(i + 3) * 16)) % H;
      if (y < 0) y += H;
      ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      ctx.fillStyle = tint || LOOT[i % 5];
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + rnd(i + 6) * 2.2, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function fog(ctx, W, H, t, y0, col) {
    for (var i = 0; i < 4; i++) {
      var x = ((i * 0.28 + 0.1) * W + Math.sin(t * 0.25 + i) * 30) % (W + 80) - 40;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(x, y0 + i * 14, 90 + i * 20, 18, 0, 0, 7);
      ctx.fill();
    }
  }
  function burst(ctx, t, t0, x, y, color) {
    var age = t - t0;
    if (!(age >= 0 && age < 2.4)) return;
    var u = age / 2.4;
    for (var i = 0; i < 20; i++) {
      var a = rnd(i + 2) * 6.283;
      var sp = 30 + rnd(i + 5) * 140;
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * sp * age, y + Math.sin(a) * sp * age + 70 * age * age, 2 + rnd(i) * 2.5, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintHayes(ctx, W, H, t, px, quests, fill) {
    sky(ctx, W, H, [[0, "#071826"], [0.35, "#1c5f86"], [0.62, "#e7b56a"], [0.82, "#1f6a4a"], [1, "#071610"]]);
    /* far: storm ring on the horizon */
    ctx.save();
    ctx.translate(W * 0.72 + px * 0.08, H * 0.22);
    ctx.strokeStyle = "rgba(210, 245, 255, 0.28)";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 78 + Math.sin(t * 0.5) * 6, t * 0.15, t * 0.15 + 4.6);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 214, 120, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 52, -t * 0.35, -t * 0.35 + 3.4);
    ctx.stroke();
    ctx.restore();
    /* far islands */
    for (var i = 0; i < 6; i++) {
      var ix = ((i * 0.22 * W - t * 10 + px * 0.25) % (W + 220)) - 80;
      var iy = H * (0.2 + (i % 3) * 0.045);
      island(ctx, ix, iy, 0.45 + (i % 3) * 0.12, i, false, t);
    }
    /* mid clouds */
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (var c = 0; c < 5; c++) {
      var cx = ((c * 180 - t * 22 + px * 0.45) % (W + 160)) - 40;
      ctx.beginPath();
      ctx.ellipse(cx, H * 0.16 + c * 8, 50, 12, 0, 0, 7);
      ctx.fill();
    }
    /* water */
    var wy = H * 0.78;
    var wg = ctx.createLinearGradient(0, wy - 20, 0, H);
    wg.addColorStop(0, "rgba(20, 90, 110, 0.2)");
    wg.addColorStop(1, "#062018");
    ctx.fillStyle = wg;
    ctx.fillRect(0, wy, W, H - wy);
    ctx.strokeStyle = "rgba(180, 240, 255, 0.28)";
    ctx.lineWidth = 1.5;
    for (var s = 0; s < 4; s++) {
      ctx.beginPath();
      var yy = wy + 10 + s * 12;
      for (var x = 0; x <= W; x += 10) {
        var y2 = yy + Math.sin(x * 0.04 + t * 1.6 + s) * 2.2;
        if (x) ctx.lineTo(x, y2); else ctx.moveTo(x, y2);
      }
      ctx.stroke();
    }
    shafts(ctx, W, H, t, "rgba(190, 240, 255, 0.045)");
    motes(ctx, W, H, t, px, null, 48);
    fog(ctx, W, H, t, H * 0.7, "rgba(180, 230, 220, 0.08)");
    /* must islands */
    quests.forEach(function (q, i) {
      island(ctx, q.x + px * 0.15, q.y, 1.15, i, q.done, t);
      label(ctx, q.x, q.y + 28, q.label, q.done);
      if (q.done) {
        ctx.fillStyle = "rgba(255, 220, 140, 0.9)";
        ctx.beginPath();
        ctx.arc(q.x, q.y - 36, 4 + Math.sin(t * 3 + i) * 1.2, 0, 7);
        ctx.fill();
      }
    });
    /* spirit */
    var sx = W * (0.2 + (0.5 + 0.5 * Math.sin(t * 0.35)) * 0.6);
    spirit(ctx, sx, H * 0.34 + Math.sin(t * 2) * 8, t, "#bff");
    /* foreground reeds */
    ctx.strokeStyle = "rgba(20, 70, 48, 0.85)";
    ctx.lineWidth = 2;
    for (var g = 0; g < 14; g++) {
      var gx = (g * W) / 13;
      ctx.beginPath();
      ctx.moveTo(gx, H);
      ctx.quadraticCurveTo(gx + Math.sin(t * 1.4 + g) * 8, H - 30, gx + Math.sin(t + g) * 10, H - 54);
      ctx.stroke();
    }
    if (burstAt >= 0) burst(ctx, t, burstAt, W * 0.5, H * 0.5, "#ffe7a8");
    warmth(ctx, W, H, fill, "rgba(255, 210, 120, 0.05)");
  }

  function island(ctx, x, y, s, i, lit, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(8, 30, 44, 0.9)";
    ctx.beginPath(); ctx.ellipse(0, 18 * s, 78 * s, 22 * s, 0, 0, 7); ctx.fill();
    var top = ctx.createLinearGradient(0, -10 * s, 0, 16 * s);
    top.addColorStop(0, lit ? "#7dffa8" : (i % 2 ? "#2f8f62" : "#3aa37a"));
    top.addColorStop(1, lit ? "#1d6b40" : "#1a5a38");
    ctx.fillStyle = top;
    ctx.beginPath(); ctx.ellipse(0, 4 * s, 64 * s, 16 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(30, 50, 30, 0.8)";
    ctx.lineWidth = 2;
    var sway = Math.sin(t * 1.3 + i) * 3 * s;
    ctx.beginPath();
    ctx.moveTo(-4 * s, 4 * s);
    ctx.quadraticCurveTo(sway, -26 * s, 6 * s, 4 * s);
    ctx.stroke();
    if (lit) {
      ctx.fillStyle = LOOT[i % 5];
      ctx.globalAlpha = 0.9;
      ctx.fillRect(-8 * s, -6 * s, 10 * s, 8 * s);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(-6 * s, -4 * s, 3 * s, 3 * s);
      ctx.globalAlpha = 1;
      var gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 50 * s);
      gl.addColorStop(0, "rgba(255, 230, 160, 0.45)");
      gl.addColorStop(1, "rgba(255, 230, 160, 0)");
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(0, 0, 50 * s, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function paintHarris(ctx, W, H, t, px, quests, fill) {
    var hour = chicagoHour();
    var night = hour < 6 || hour >= 19;
    sky(ctx, W, H, night
      ? [[0, "#070b16"], [0.45, "#1a2744"], [0.75, "#243628"], [1, "#101810"]]
      : [[0, "#8fd0ee"], [0.5, "#d7ecb0"], [1, "#3d7a32"]]);
    if (!night) {
      ctx.fillStyle = "rgba(255, 244, 200, 0.95)";
      ctx.beginPath(); ctx.arc(W * 0.8 + px * 0.1, H * 0.14, 26, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = "rgba(230, 236, 255, 0.9)";
      ctx.beginPath(); ctx.arc(W * 0.18 + px * 0.08, H * 0.12, 14, 0, 7); ctx.fill();
    }
    /* far voxel hills */
    var bs = Math.max(12, Math.round(W / 42));
    for (var c = 0; c < 28; c++) {
      var hgt = 2 + Math.round(rnd(c + 3) * 4);
      var x = c * bs - (px * 0.2 % bs) - t * 0;
      var shade = night ? "#1e3a28" : "#4e8a3e";
      for (var r = 0; r < hgt; r++) {
        ctx.fillStyle = r === hgt - 1 ? shade : (night ? "#3a3228" : "#6d5640");
        ctx.fillRect(x, H * 0.34 - r * bs * 0.7, bs - 1, bs * 0.7);
      }
    }
    /* mid trunks */
    for (var n = 0; n < 7; n++) {
      var tx = (n * W / 6 + px * 0.35) % W;
      ctx.fillStyle = night ? "#1a140e" : "#3a2a18";
      ctx.fillRect(tx, H * 0.28, 8, H * 0.22);
      ctx.fillStyle = night ? "#14301c" : "#2f6a32";
      ctx.fillRect(tx - 10, H * 0.26, 28, 12);
    }
    /* glade floor */
    var base = H * 0.72;
    ctx.fillStyle = night ? "#142016" : "#3d7a32";
    ctx.fillRect(0, base, W, H - base);
    for (var k = 0; k < 16; k++) {
      ctx.fillStyle = (k + Math.floor(px)) % 2 ? (night ? "#1c3a24" : "#4e9a40") : (night ? "#243828" : "#3d7a32");
      ctx.fillRect((k * bs * 1.4 - px * 0.3) % W, base, bs * 1.3, bs);
    }
    shafts(ctx, W, H, t, night ? "rgba(180, 200, 255, 0.04)" : "rgba(210, 255, 190, 0.05)");
    motes(ctx, W, H, t, px, night ? "#d8e6ff" : "#e8ffe4", 36);
    fog(ctx, W, H, t, base - 10, "rgba(200,255,210,0.06)");
    quests.forEach(function (q, i) {
      ore(ctx, q.x, q.y, q.done, i, t, night);
      label(ctx, q.x, q.y + 36, q.label, q.done);
    });
    /* torches along the glade */
    for (var u = 0; u < 4; u++) {
      torch(ctx, W * (0.12 + u * 0.25) + px * 0.1, base - 8, t, u);
    }
    spirit(ctx, W * (0.3 + (0.5 + 0.5 * Math.sin(t * 0.4)) * 0.4), base - 36 + Math.sin(t * 3) * 3, t, "#cfc");
    if (burstAt >= 0) burst(ctx, t, burstAt, W * 0.5, base - 40, "#e2b84a");
    warmth(ctx, W, H, fill, "rgba(255, 180, 80, 0.04)");
  }

  function ore(ctx, x, y, done, i, t, night) {
    var s = 30;
    ctx.fillStyle = night ? "#2a241c" : "#6a5438";
    ctx.fillRect(x - s, y - s * 0.2, s * 2, s);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x - s, y - s * 0.2, s * 2, 3);
    var oreC = LOOT[i % 5];
    if (!done) {
      ctx.fillStyle = oreC;
      ctx.fillRect(x - 8, y - 2, 10, 8);
      ctx.fillRect(x + 2, y + 4, 7, 6);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 14, y + 2);
      ctx.lineTo(x - 2, y + 10);
      ctx.moveTo(x + 2, y - 2);
      ctx.lineTo(x + 16, y + 8);
      ctx.stroke();
      var gl = ctx.createRadialGradient(x, y, 2, x, y, 36);
      gl.addColorStop(0, oreC);
      gl.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.55 + Math.sin(t * 4 + i) * 0.15;
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(x, y, 36, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function torch(ctx, x, y, t, i) {
    ctx.fillStyle = "#3a2a18";
    ctx.fillRect(x, y - 28, 4, 30);
    var flick = 0.65 + Math.sin(t * 11 + i) * 0.35;
    var g = ctx.createRadialGradient(x + 2, y - 32, 1, x + 2, y - 32, 22);
    g.addColorStop(0, "rgba(255,230,170," + flick + ")");
    g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x + 2, y - 32, 22, 0, 7); ctx.fill();
  }

  function paintAinsley(ctx, W, H, t, px, quests, fill) {
    sky(ctx, W, H, [[0, "#140e1c"], [0.32, "#6a3848"], [0.55, "#e09a68"], [0.72, "#1a333c"], [1, "#07141a"]]);
    /* far mountains */
    ctx.fillStyle = "rgba(42, 36, 58, 0.9)";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.58);
    for (var i = 0; i <= 8; i++) {
      ctx.lineTo(i * W / 8 + px * 0.12, H * (0.24 + (i % 2) * 0.07));
      ctx.lineTo(i * W / 8 + W / 16, H * 0.58);
    }
    ctx.lineTo(W, H * 0.58); ctx.closePath(); ctx.fill();
    /* mist band */
    fog(ctx, W, H, t, H * 0.5, "rgba(255, 210, 180, 0.07)");
    /* lake */
    var lake = H * 0.62;
    var lg = ctx.createLinearGradient(0, lake, 0, H);
    lg.addColorStop(0, "rgba(90, 50, 48, 0.35)");
    lg.addColorStop(0.35, "#16303a");
    lg.addColorStop(1, "#07141a");
    ctx.fillStyle = lg;
    ctx.fillRect(0, lake, W, H - lake);
    /* reflection of sky */
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#e09a68";
    ctx.fillRect(0, lake, W, 18);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255, 200, 160, 0.28)";
    ctx.lineWidth = 1.4;
    for (var s = 0; s < 5; s++) {
      ctx.beginPath();
      var yy = lake + 16 + s * 16;
      for (var x = 0; x <= W; x += 8) {
        var y2 = yy + Math.sin(x * 0.03 + t * 1.15 + s) * 2.4;
        if (x) ctx.lineTo(x, y2); else ctx.moveTo(x, y2);
      }
      ctx.stroke();
    }
    /* bare trees, swaying */
    ctx.strokeStyle = "rgba(28, 16, 14, 0.9)";
    ctx.lineWidth = 2;
    for (var n = 0; n < 8; n++) {
      var tx = (n * W / 7.2 + px * 0.4) % W;
      var th = 80 + (n % 3) * 26;
      var lean = Math.sin(t * 0.6 + n) * 5;
      ctx.beginPath();
      ctx.moveTo(tx, lake);
      ctx.quadraticCurveTo(tx + lean, lake - th * 0.5, tx + lean * 1.4, lake - th);
      ctx.moveTo(tx + lean * 0.4, lake - th * 0.55);
      ctx.lineTo(tx - 18 + lean, lake - th * 0.72);
      ctx.moveTo(tx + lean * 0.5, lake - th * 0.42);
      ctx.lineTo(tx + 16 + lean, lake - th * 0.6);
      ctx.stroke();
    }
    /* cabin, warmer as the jar fills */
    var cx = W * 0.78 + px * 0.2;
    var warm = 0.35 + fill * 0.65;
    ctx.fillStyle = "#3a241c";
    ctx.fillRect(cx, lake - 78, 84, 64);
    ctx.fillStyle = "#5a3024";
    ctx.beginPath();
    ctx.moveTo(cx - 10, lake - 78);
    ctx.lineTo(cx + 42, lake - 118);
    ctx.lineTo(cx + 94, lake - 78);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 186, 96," + (0.35 + warm * 0.6 + Math.sin(t * 2) * 0.06) + ")";
    ctx.fillRect(cx + 18, lake - 54, 18, 18);
    ctx.fillRect(cx + 48, lake - 54, 18, 18);
    var cg = ctx.createRadialGradient(cx + 40, lake - 40, 4, cx + 40, lake - 40, 90 + fill * 40);
    cg.addColorStop(0, "rgba(255, 170, 80," + (0.18 + fill * 0.35) + ")");
    cg.addColorStop(1, "rgba(255, 170, 80, 0)");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx + 40, lake - 40, 100, 0, 7); ctx.fill();
    /* string lights */
    ctx.strokeStyle = "rgba(50, 28, 20, 0.75)";
    ctx.beginPath();
    ctx.moveTo(cx - 40, lake - 90);
    ctx.quadraticCurveTo(cx + 20, lake - 40, cx + 130, lake - 96);
    ctx.stroke();
    for (var L = 0; L < 9; L++) {
      var u = L / 8;
      var lx = cx - 40 + u * 170;
      var ly = lake - 90 + Math.sin(u * Math.PI) * 36;
      ctx.fillStyle = L % 2 ? "rgba(255, 214, 150, 0.95)" : "rgba(255, 150, 110, 0.9)";
      ctx.beginPath();
      ctx.arc(lx, ly + Math.sin(t * 2.2 + L) * 1.6, 3.1, 0, 7);
      ctx.fill();
    }
    shafts(ctx, W, H, t, "rgba(255, 186, 140, 0.04)");
    motes(ctx, W, H, t, px, "#ffc89a", 40);
    /* lantern musts along the near shore */
    quests.forEach(function (q, i) {
      lantern(ctx, q.x, Math.min(q.y, lake - 8), q.done, t, i);
      label(ctx, q.x, Math.min(q.y, lake - 8) + 28, q.label, q.done);
    });
    spirit(ctx, W * (0.25 + (0.5 + 0.5 * Math.sin(t * 0.28)) * 0.35), lake - 24 + Math.sin(t * 1.6) * 4, t, "#ffd0b0");
    /* grain */
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    for (var g = 0; g < 50; g++) ctx.fillRect((g * 97) % W, (g * 53) % H, 1.5, 1.5);
    if (burstAt >= 0) burst(ctx, t, burstAt, W * 0.45, lake - 20, "#ffd2a8");
  }

  function lantern(ctx, x, y, lit, t, i) {
    ctx.fillStyle = "#2a1a14";
    ctx.fillRect(x - 2, y, 4, 26);
    ctx.fillStyle = lit ? "rgba(255, 196, 120, 0.95)" : "rgba(80, 60, 50, 0.8)";
    ctx.fillRect(x - 11, y - 22, 22, 22);
    if (lit) {
      var g = ctx.createRadialGradient(x, y - 8, 2, x, y - 8, 28 + Math.sin(t * 3 + i) * 3);
      g.addColorStop(0, "rgba(255, 220, 160, 0.7)");
      g.addColorStop(1, "rgba(255, 160, 80, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y - 8, 30, 0, 7); ctx.fill();
    }
  }

  function spirit(ctx, x, y, t, col) {
    ctx.save();
    ctx.translate(x, y);
    var g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.4, col);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
    ctx.fillStyle = "#102028";
    var blink = Math.sin(t * 1.7) > 0.97 ? 0.5 : 2;
    ctx.beginPath(); ctx.ellipse(-4, -1, 1.4, blink, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -1, 1.4, blink, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  function label(ctx, x, y, text, done) {
    ctx.save();
    ctx.font = "700 16px Palatino, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var w = Math.min(150, ctx.measureText(text).width + 18);
    ctx.fillStyle = "rgba(4, 12, 18, 0.62)";
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 13, w, 26, 13);
    ctx.fill();
    ctx.fillStyle = done ? "#e9fff0" : "#f4fbff";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function warmth(ctx, W, H, fill) {
    if (fill <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.04 + fill * 0.14;
    ctx.fillStyle = "#ffd278";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function paintWorld(ctx, W, H, t, which, quests, fill, px) {
    var list = placeQuests(quests || [], W, H);
    if (which === "harris") paintHarris(ctx, W, H, t, px || 0, list, fill || 0);
    else if (which === "ainsley") paintAinsley(ctx, W, H, t, px || 0, list, fill || 0);
    else paintHayes(ctx, W, H, t, px || 0, list, fill || 0);
    return list;
  }

  /* ---------- live canvas ---------- */
  function World(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.t0 = performance.now();
    this.ptr = 0;
    this.hits = [];
    this.dpr = 1;
    this.resize();
  }
  World.prototype.resize = function () {
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var w = global.innerWidth || 440;
    var h = global.innerHeight || 800;
    if (Math.max(w, h) * dpr > 1800) dpr = 1800 / Math.max(w, h);
    this.dpr = dpr;
    this.cv.width = Math.max(2, Math.round(w * dpr));
    this.cv.height = Math.max(2, Math.round(h * dpr));
    this.cv.style.width = w + "px";
    this.cv.style.height = h + "px";
  };
  World.prototype.frame = function (which) {
    var t = reduced ? 2.4 : (performance.now() - this.t0) / 1000;
    var W = this.cv.width / this.dpr;
    var H = this.cv.height / this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    var iso = dayIso || todayIso();
    var quests = readQuests(iso);
    var st = global.JarEngine ? JarEngine.choreState(kid()) : { fill: 0 };
    this.hits = paintWorld(this.ctx, W, H, t, which || kid(), quests, st.fill || 0, (this.ptr - 0.5) * 40);
    if (global.JarEngine && JarEngine.setVirtual) JarEngine.setVirtual(null);
  };

  function todayIso() {
    if (global.WardKids && WardKids.DAY_ISO) return WardKids.DAY_ISO;
    if (global.HouseClock && HouseClock.iso) return HouseClock.iso();
    return "";
  }

  /* ---------- scenes (calendar and doors still open here) ---------- */
  var stack = [];
  var sceneEl = null;
  var sceneCv = null;
  var sceneWorld = null;

  function ensureScene() {
    if (sceneEl) return;
    sceneEl = document.createElement("div");
    sceneEl.className = "kw-scene";
    sceneEl.innerHTML = '<canvas class="kw-scene-cv" aria-hidden="true"></canvas><div class="kw-scene-ui"><div class="kw-kicker" data-kicker></div><h2 class="kw-scene-title" data-title></h2><div class="kw-scene-body" data-body></div><div class="kw-scene-actions"><button type="button" class="kw-back" data-back>Back</button></div></div>';
    document.body.appendChild(sceneEl);
    sceneCv = sceneEl.querySelector("canvas");
    sceneEl.querySelector("[data-back]").addEventListener("click", function () { back(); });
  }
  function show(opts) {
    ensureScene();
    var r = opts.from && opts.from.getBoundingClientRect ? opts.from.getBoundingClientRect() : null;
    var x = r ? ((r.left + r.width / 2) / Math.max(1, innerWidth) * 100) : 50;
    var y = r ? ((r.top + r.height / 2) / Math.max(1, innerHeight) * 100) : 40;
    sceneEl.style.setProperty("--kx", x + "%");
    sceneEl.style.setProperty("--ky", y + "%");
    sceneEl.querySelector("[data-kicker]").textContent = opts.kicker || "";
    sceneEl.querySelector("[data-title]").textContent = opts.title || "";
    var body = sceneEl.querySelector("[data-body]");
    body.innerHTML = opts.html || "";
    var actions = sceneEl.querySelector(".kw-scene-actions");
    Array.prototype.forEach.call(actions.querySelectorAll("[data-extra]"), function (n) { n.remove(); });
    if (opts.go) {
      var go = document.createElement("a");
      go.className = "kw-go";
      go.setAttribute("data-extra", "1");
      go.href = opts.go;
      go.textContent = opts.goLabel || "Continue";
      actions.appendChild(go);
    }
    if (opts.onMount) opts.onMount(body, actions);
    sceneEl.classList.add("is-on");
    if (!sceneWorld) sceneWorld = new World(sceneCv);
    sceneWorld.kid = kid();
    sceneWorld.resize();
    sceneWorld.custom = opts.paint || null;
    if (global.HouseSfx && HouseSfx.unlockAudio) HouseSfx.unlockAudio();
    if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap();
    tickScene();
  }
  function tickScene() {
    if (!sceneEl || !sceneEl.classList.contains("is-on") || !sceneWorld) return;
    sceneWorld.frame(kid());
    if (sceneWorld.custom) {
      var ctx = sceneWorld.ctx;
      var t = reduced ? 1 : (performance.now() - sceneWorld.t0) / 1000;
      var W = sceneCv.width / sceneWorld.dpr, H = sceneCv.height / sceneWorld.dpr;
      sceneWorld.custom(ctx, W, H, t, kid());
    }
    if (!reduced) requestAnimationFrame(tickScene);
  }
  function openScene(opts) { stack.push(opts || {}); show(opts || {}); }
  function back() {
    stack.pop();
    if (!stack.length) {
      if (sceneEl) sceneEl.classList.remove("is-on");
      if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap();
      return;
    }
    show(stack[stack.length - 1]);
  }
  function closeAll() {
    stack.length = 0;
    if (sceneEl) sceneEl.classList.remove("is-on");
  }
  function vignette(kind) {
    return function (ctx, W, H, t) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(255,230,200,0.45)";
      ctx.lineWidth = 2;
      if (kind === "water") {
        for (var i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(W * 0.5, H * 0.62, 24 + i * 26, 0, 7);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.arc(W * 0.5, H * 0.58, 16 + Math.sin(t * 3) * 3, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    };
  }
  function kindFor(text) {
    var s = String(text || "").toLowerCase();
    if (/bed/.test(s)) return "bed";
    if (/dish|swim|bath|shower/.test(s)) return "water";
    if (/toy|block|room/.test(s)) return "blocks";
    return "glow";
  }

  /* ---------- hud ---------- */
  var bg = null;
  function paintClock() {
    var el = document.querySelector("[data-kw-clock]");
    if (el) el.textContent = clockLine();
  }
  function paintWeek() {
    var host = document.querySelector("[data-kw-week]");
    if (!host) return;
    var days = weekMeta();
    if (!dayIso) {
      for (var i = 0; i < days.length; i++) if (days[i].today) dayIso = days[i].iso;
      if (!dayIso && days[0]) dayIso = days[0].iso;
    }
    host.innerHTML = "";
    days.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kw-day" + (d.iso === dayIso ? " is-on" : "") + (d.today ? " is-today" : "");
      b.innerHTML = "<b>" + d.letter + "</b><small>" + d.num + "</small>";
      b.addEventListener("click", function () {
        dayIso = d.iso;
        paintWeek();
        if (bg) bg.frame(kid());
      });
      host.appendChild(b);
    });
  }
  function mountJar() {
    var host = document.querySelector("[data-kw-jar]");
    if (!host || host.getAttribute("data-mounted") === "1" || !global.JarEngine) return;
    host.setAttribute("data-mounted", "1");
    var jar = JarEngine.mount(host, {
      kid: kid(),
      onTap: function () {
        var st = JarEngine.choreState(kid());
        openScene({
          kicker: st.asleep ? "resting" : "the jar",
          title: st.full ? "It spills into a run" : "Gathering",
          html: "<p>The metal rises with the things that got done.</p>",
          paint: vignette("glow"),
          onMount: function (body, actions) {
            if (!st.full) return;
            var a = document.createElement("a");
            a.className = "kw-go";
            a.setAttribute("data-extra", "1");
            a.href = "mercury-run.html?kid=" + encodeURIComponent(kid());
            a.textContent = "Step into the run";
            actions.appendChild(a);
          }
        });
      }
    });
    host._jar = jar;
    if (capMode && jar) jar.alive = false;
  }
  function hitQuest(ev) {
    if (!bg || !bg.hits) return null;
    var rect = bg.cv.getBoundingClientRect();
    var x = (ev.clientX - rect.left) * ((bg.cv.width / bg.dpr) / Math.max(1, rect.width));
    var y = (ev.clientY - rect.top) * ((bg.cv.height / bg.dpr) / Math.max(1, rect.height));
    for (var i = 0; i < bg.hits.length; i++) {
      var q = bg.hits[i];
      if (Math.hypot(q.x - x, q.y - y) < q.r + 8) return q;
    }
    return null;
  }
  function onWorldDown(ev) {
    if (!ev.isTrusted) return;
    var q = hitQuest(ev);
    if (!q || !q.btn) return;
    var was = q.btn.classList.contains("done");
    q.btn.click();
    burstAt = (performance.now() - bg.t0) / 1000;
    if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap();
    if (!was && global.JarEngine && JarEngine.tone) JarEngine.tone("gulp");
    setTimeout(function () {
      openScene({
        from: q.btn,
        kicker: "in the world",
        title: q.label,
        html: "<p>" + (!was ? "It settles into the jar." : (q.btn.classList.contains("done") ? "The light keeps that." : "The jar eases back.")) + "</p>",
        paint: vignette(kindFor(q.label))
      });
    }, 30);
  }

  function goHome(x, y) {
    var fx = (x / Math.max(1, innerWidth)).toFixed(3);
    var fy = (y / Math.max(1, innerHeight)).toFixed(3);
    try { sessionStorage.setItem("ori-from", JSON.stringify({ x: +fx, y: +fy, t: Date.now() })); } catch (e) {}
    var iris = document.createElement("div");
    iris.className = "kw-iris";
    iris.style.setProperty("--x", x + "px");
    iris.style.setProperty("--y", y + "px");
    document.body.appendChild(iris);
    if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap();
    var href = "index.html#from=" + fx + "," + fy;
    if (reduced) { location.href = href; return; }
    setTimeout(function () { location.href = href; }, 680);
  }

  function soften() {
    var badge = document.getElementById("tapsync-badge");
    if (badge) badge.remove();
    document.querySelectorAll(".vfx-dollar").forEach(function (n) { n.remove(); });
    document.querySelectorAll("[data-bank-meta], .xp-glass-lab, .xp-glass-meta").forEach(function (n) {
      if (/\$|locked|streak|balance/i.test(n.textContent || "")) n.textContent = "";
    });
  }

  function loop() {
    if (capMode || !bg) return;
    if (!document.hidden && !(sceneEl && sceneEl.classList.contains("is-on"))) bg.frame(kid());
    if (reduced) return;
    requestAnimationFrame(loop);
  }

  function boot() {
    if (!document.body || !document.body.getAttribute("data-kid")) return;
    capMode = /(?:\?|&)kwcap=1(?:&|$)/.test(location.search);
    document.documentElement.classList.add("kw-root");
    if (reduced) document.documentElement.classList.add("kw-reduce");
    document.body.classList.add("kw-on");
    var name = (document.querySelector(".name-accent") || {}).textContent || kid();
    var stage = document.createElement("div");
    stage.className = "kw-stage";
    stage.innerHTML =
      '<header class="kw-hud"><button type="button" class="kw-home" data-kw-home>' + name + '</button><div class="kw-clock" data-kw-clock></div></header>' +
      '<div class="kw-jar-host" data-kw-jar></div>' +
      '<div class="kw-week" data-kw-week></div>' +
      '<button type="button" class="kw-path kw-more" data-kw-more>Farther</button>' +
      '<button type="button" class="kw-path" data-kw-path>Path</button>' +
      '<div class="kw-drawer" id="kw-cal" hidden></div>';
    document.body.appendChild(stage);
    var cv = document.createElement("canvas");
    cv.className = "kw-canvas";
    cv.setAttribute("aria-hidden", "true");
    document.body.insertBefore(cv, document.body.firstChild);
    bg = new World(cv);
    stage.querySelector("[data-kw-home]").addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      goHome(ev.clientX || innerWidth * 0.2, ev.clientY || 40);
    });
    stage.querySelector("[data-kw-path]").addEventListener("click", function () {
      var d = document.getElementById("kw-cal");
      if (!d) return;
      d.hidden = !d.hidden;
    });
    stage.querySelector("[data-kw-more]").addEventListener("click", function () {
      var d = document.getElementById("kw-cal");
      if (!d) return;
      d.hidden = false;
      d.classList.toggle("is-more");
      this.textContent = d.classList.contains("is-more") ? "Closer" : "Farther";
    });
    cv.addEventListener("pointerdown", onWorldDown);
    cv.addEventListener("pointermove", function (e) {
      bg.ptr = e.clientX / Math.max(1, innerWidth);
    }, { passive: true });
    global.addEventListener("resize", function () { if (bg) bg.resize(); });
    document.addEventListener("house:kid-rendered", function () {
      paintWeek();
      mountJar();
      soften();
      if (global.JarEngine && JarEngine.choreState(kid()).asleep) document.body.classList.add("kw-asleep");
    });
    paintClock();
    setInterval(paintClock, 1000);
    paintWeek();
    mountJar();
    soften();
    var mo = new MutationObserver(function () { soften(); });
    mo.observe(document.body, { childList: true, subtree: true });
    if (!capMode) {
      loop();
      if (reduced && bg) bg.frame(kid());
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  function exportFrame(t, cssW, cssH, dpr) {
    cssW = cssW || 440;
    cssH = cssH || 956;
    dpr = dpr || 2;
    var canvas = exportFrame.cv || (exportFrame.cv = document.createElement("canvas"));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var iso = dayIso || todayIso();
    var quests = readQuests(iso);
    if (t < 8) exportFrame.tapped = false;
    if (t >= 8 && !exportFrame.tapped && quests[0] && quests[0].btn && !quests[0].done) {
      exportFrame.tapped = true;
      quests[0].btn.click();
      quests = readQuests(iso);
    }
    burstAt = t >= 8 ? 8 : -1;
    var st = global.JarEngine ? JarEngine.choreState(kid()) : { fill: 0 };
    if (global.JarEngine && JarEngine.setVirtual) JarEngine.setVirtual(t * 1000);
    paintWorld(ctx, cssW, cssH, t, kid(), quests, st.fill || 0, Math.sin(t * 0.3) * 16);
    var host = document.querySelector("[data-kw-jar]");
    if (host && host._jar) {
      host._jar.frame();
      if (host._jar.cv && host._jar.cv.width) {
        ctx.drawImage(host._jar.cv, cssW * 0.5 - 78, cssH - 268, 156, 176);
      }
    }
    ctx.textAlign = "left";
    ctx.font = "800 22px Palatino, Georgia, serif";
    ctx.fillStyle = "#f7fbff";
    ctx.fillText((document.querySelector(".name-accent") || {}).textContent || kid(), 16, 34);
    ctx.textAlign = "right";
    ctx.font = "600 15px Palatino, Georgia, serif";
    ctx.fillText(clockLine(), cssW - 16, 32);
    if (global.JarEngine && JarEngine.setVirtual) JarEngine.setVirtual(null);
    return canvas;
  }

  global.KidWorld = {
    openScene: openScene,
    back: back,
    close: closeAll,
    vignette: vignette,
    kindFor: kindFor,
    reduced: function () { return reduced; },
    exportFrame: exportFrame,
    paintWorld: paintWorld
  };
})(window);
