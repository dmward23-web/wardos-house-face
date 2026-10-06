/* kid-world.js · three living worlds on the kid boards.
   Hayes: bright islands, build-pieces, a breathing storm ring, loot-glow motes.
   Harris: voxel ground, ores, torches, a slow day/night.
   Ainsley: dusk woods, lake, cabin, string lights, paper grain. Teen-quiet.
   Original canvas only. Every in-board tap opens a painted sub-scene.
   prefers-reduced-motion draws a calm still frame. */
(function (global) {
  "use strict";

  var LOOT = ["#b7bcc4", "#5dffa0", "#59b7ff", "#c98bff", "#ffd56a"];
  var reduced = false;
  try { reduced = !!(global.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function kid() { return (document.body && document.body.getAttribute("data-kid")) || "hayes"; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function chicagoHour() {
    try {
      var h = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date());
      return parseInt(h, 10) || 12;
    } catch (e) { return new Date().getHours(); }
  }

  function World(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.t0 = performance.now();
    this.ptr = { x: 0.5, y: 0.35 };
    this.scroll = 0;
    this.motes = [];
    this.kid = kid();
    var seed = this.kid === "harris" ? 7 : this.kid === "ainsley" ? 21 : 3;
    for (var i = 0; i < 70; i++) {
      this.motes.push({
        x: Math.random(), y: Math.random(), z: Math.random(),
        r: 1 + Math.random() * 2.4, p: Math.random() * 6.28,
        c: this.kid === "hayes" ? LOOT[i % 5] : null,
        s: 0.15 + Math.random() * 0.45
      });
    }
    this.cols = [];
    for (var c = 0; c < 42; c++) {
      var n = Math.abs(Math.sin(c * 1.7 + seed) * 0.55 + Math.sin(c * 0.33) * 0.3);
      this.cols.push({ h: 0.18 + n * 0.28, ore: (c * 5 + seed) % 7 === 0 });
    }
    this.alive = true;
    this.resize();
  }

  World.prototype.resize = function () {
    var dpr = Math.min(1.35, global.devicePixelRatio || 1);
    var w = global.innerWidth || 440, h = global.innerHeight || 800;
    var cap = 1280;
    if (w * dpr > cap) dpr = cap / w;
    this.dpr = dpr;
    this.cv.width = Math.max(2, Math.round(w * dpr));
    this.cv.height = Math.max(2, Math.round(h * dpr));
    this.cv.style.width = w + "px";
    this.cv.style.height = h + "px";
  };

  World.prototype.frame = function (paintKid) {
    var ctx = this.ctx;
    if (!ctx) return;
    var t = reduced ? 2.2 : (performance.now() - this.t0) / 1000;
    var w = this.cv.width, h = this.cv.height;
    var k = paintKid || this.kid;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    var W = w / this.dpr, H = h / this.dpr;
    var px = (this.ptr.x - 0.5) * 28;
    var py = this.scroll * 0.08 + (this.ptr.y - 0.4) * 12;
    if (k === "ainsley") paintAinsley(ctx, W, H, t, px, py, this);
    else if (k === "harris") paintHarris(ctx, W, H, t, px, py, this);
    else paintHayes(ctx, W, H, t, px, py, this);
    if (!reduced) paintMotes(ctx, W, H, t, px, this, k);
    paintShafts(ctx, W, H, t, k);
  };

  function sky(ctx, W, H, stops) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function paintHayes(ctx, W, H, t, px, py) {
    sky(ctx, W, H, [[0, "#16324a"], [0.45, "#3c8ea8"], [0.78, "#f2c98a"], [1, "#1c4a3a"]]);
    /* storm ring */
    ctx.save();
    ctx.translate(W * 0.72 + px * 0.2, H * 0.2 + py * 0.1);
    ctx.strokeStyle = "rgba(210, 245, 255, 0.35)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 70 + Math.sin(t * 0.6) * 8, t * 0.2, t * 0.2 + 5.2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 220, 140, 0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 48, -t * 0.4, -t * 0.4 + 4);
    ctx.stroke();
    ctx.restore();
    /* far islands */
    for (var i = 0; i < 5; i++) {
      var ix = ((i * 0.22 * W + t * 8 + px * (0.3 + i * 0.05)) % (W + 200)) - 100;
      var iy = H * (0.28 + (i % 3) * 0.06) + Math.sin(t * 0.7 + i) * 8 + py * 0.2;
      island(ctx, ix, iy, 0.7 + (i % 3) * 0.18, i);
    }
    /* build pieces on the near ground */
    ctx.save();
    ctx.translate(0, py * 0.5);
    var groundY = H * 0.78;
    var gg = ctx.createLinearGradient(0, groundY - 40, 0, H);
    gg.addColorStop(0, "#1d6b45");
    gg.addColorStop(1, "#0c2418");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (var x = 0; x <= W; x += 28) ctx.lineTo(x, groundY - 10 + Math.sin(x * 0.02 + t) * 6);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    for (var b = 0; b < 7; b++) {
      var bw = 36 + (b % 3) * 14;
      var bh = 28 + (b % 4) * 16;
      var bx = (b * 140 + px * 0.8) % (W + 80) - 20;
      var by = groundY - bh + 6;
      ctx.fillStyle = b % 2 ? "rgba(90, 200, 255, 0.35)" : "rgba(255, 210, 120, 0.32)";
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);
    }
    ctx.restore();
  }

  function island(ctx, x, y, s, i) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(12, 40, 58, 0.9)";
    ctx.beginPath(); ctx.ellipse(0, 18 * s, 78 * s, 22 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = i % 2 ? "#2f8f62" : "#3aa37a";
    ctx.beginPath(); ctx.ellipse(0, 8 * s, 64 * s, 16 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(190, 255, 220, 0.85)";
    ctx.beginPath();
    ctx.moveTo(-6 * s, 8 * s); ctx.lineTo(0, -28 * s); ctx.lineTo(8 * s, 8 * s); ctx.fill();
    ctx.restore();
  }

  function paintHarris(ctx, W, H, t, px, py, world) {
    var hour = chicagoHour();
    var night = hour < 6 || hour >= 19 ? 1 : hour >= 17 ? 0.45 : 0;
    var top = night ? "#0c1424" : "#8fd0ee";
    var mid = night ? "#1a2740" : "#d7ecb0";
    var bot = night ? "#101810" : "#6aaa58";
    sky(ctx, W, H, [[0, top], [0.55, mid], [1, bot]]);
    if (!night) {
      ctx.fillStyle = "rgba(255, 244, 200, 0.9)";
      ctx.beginPath(); ctx.arc(W * 0.78 + px * 0.15, H * 0.16, 28, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = "rgba(230, 236, 255, 0.85)";
      ctx.beginPath(); ctx.arc(W * 0.2 + px * 0.1, H * 0.14, 16, 0, 7); ctx.fill();
    }
    var bs = Math.max(14, Math.round(W / 36));
    var base = H * 0.62 + py * 0.25;
    for (var c = 0; c < world.cols.length; c++) {
      var col = world.cols[c];
      var x = c * bs - (px * 0.4 % bs);
      var rows = Math.round(col.h * 8);
      for (var r = 0; r < rows; r++) {
        var y = base - r * bs + Math.sin(t * 0.4 + c) * 0.4;
        var shade = r === rows - 1 ? (night ? "#2a6a3a" : "#63b84a") : (r < 2 ? "#6d5640" : "#8a7358");
        if (col.ore && r === 2) shade = (c % 2) ? "#49d07a" : "#e2b84a";
        ctx.fillStyle = shade;
        ctx.fillRect(x, y, bs - 1, bs - 1);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(x, y, bs - 1, 2);
      }
      if (c % 9 === 3) {
        var ty = base - rows * bs - bs;
        ctx.fillStyle = "#3a2a18";
        ctx.fillRect(x + bs * 0.35, ty, 4, bs);
        var flick = 0.65 + Math.sin(t * 9 + c) * 0.35;
        var tg = ctx.createRadialGradient(x + bs * 0.45, ty, 1, x + bs * 0.45, ty, 22);
        tg.addColorStop(0, "rgba(255,220,140," + flick + ")");
        tg.addColorStop(1, "rgba(255,160,40,0)");
        ctx.fillStyle = tg;
        ctx.beginPath(); ctx.arc(x + bs * 0.45, ty, 22, 0, 7); ctx.fill();
      }
    }
    ctx.fillStyle = night ? "#142016" : "#3d7a32";
    ctx.fillRect(0, base + bs, W, H);
  }

  function paintAinsley(ctx, W, H, t, px, py) {
    sky(ctx, W, H, [[0, "#1a1428"], [0.35, "#6a3a48"], [0.62, "#c47a52"], [0.8, "#1d3a40"], [1, "#0e1c22"]]);
    /* mountains */
    ctx.fillStyle = "rgba(48, 42, 64, 0.85)";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.62);
    for (var i = 0; i <= 8; i++) {
      var mx = i * W / 8 + px * 0.15;
      var my = H * (0.28 + (i % 2) * 0.08);
      ctx.lineTo(mx, my);
      ctx.lineTo(mx + W / 16, H * 0.62);
    }
    ctx.lineTo(W, H * 0.62); ctx.lineTo(0, H * 0.62); ctx.fill();
    /* lake */
    var lake = H * 0.7 + py * 0.1;
    var lg = ctx.createLinearGradient(0, lake, 0, H);
    lg.addColorStop(0, "rgba(18, 36, 48, 0.2)");
    lg.addColorStop(1, "#0a1a22");
    ctx.fillStyle = lg;
    ctx.fillRect(0, lake, W, H - lake);
    ctx.strokeStyle = "rgba(255, 190, 150, 0.25)";
    ctx.lineWidth = 2;
    for (var s = 0; s < 5; s++) {
      ctx.beginPath();
      var yy = lake + 16 + s * 14;
      for (var x = 0; x <= W; x += 12) {
        var yy2 = yy + Math.sin(x * 0.03 + t * 1.2 + s) * 2;
        if (x) ctx.lineTo(x, yy2); else ctx.moveTo(x, yy2);
      }
      ctx.stroke();
    }
    /* bare trees */
    ctx.strokeStyle = "rgba(40, 22, 18, 0.85)";
    ctx.lineWidth = 2;
    for (var n = 0; n < 9; n++) {
      var tx = (n * W / 8 + px * 0.5) % W;
      var th = 70 + (n % 3) * 24;
      ctx.beginPath();
      ctx.moveTo(tx, lake);
      ctx.lineTo(tx + Math.sin(t * 0.4 + n) * 4, lake - th);
      ctx.moveTo(tx, lake - th * 0.55);
      ctx.lineTo(tx - 16, lake - th * 0.75);
      ctx.moveTo(tx, lake - th * 0.4);
      ctx.lineTo(tx + 14, lake - th * 0.62);
      ctx.stroke();
    }
    /* cabin */
    var cx = W * 0.78 + px * 0.3;
    ctx.fillStyle = "#3a241c";
    ctx.fillRect(cx, lake - 70, 78, 58);
    ctx.fillStyle = "#5a3024";
    ctx.beginPath(); ctx.moveTo(cx - 8, lake - 70); ctx.lineTo(cx + 39, lake - 104); ctx.lineTo(cx + 86, lake - 70); ctx.fill();
    var glow = 0.55 + Math.sin(t * 2) * 0.15;
    ctx.fillStyle = "rgba(255, 186, 96," + glow + ")";
    ctx.fillRect(cx + 18, lake - 48, 16, 16);
    ctx.fillRect(cx + 46, lake - 48, 16, 16);
    /* string lights */
    ctx.strokeStyle = "rgba(60, 30, 20, 0.7)";
    ctx.beginPath();
    ctx.moveTo(cx - 30, lake - 78);
    ctx.quadraticCurveTo(cx + 40, lake - 40, cx + 120, lake - 86);
    ctx.stroke();
    for (var L = 0; L < 8; L++) {
      var u = L / 7;
      var lx = cx - 30 + u * 150;
      var ly = lake - 78 + Math.sin(u * Math.PI) * 28;
      ctx.fillStyle = L % 2 ? "rgba(255, 214, 140, 0.95)" : "rgba(255, 160, 120, 0.9)";
      ctx.beginPath(); ctx.arc(lx, ly + Math.sin(t * 2 + L) * 1.5, 3.2, 0, 7); ctx.fill();
    }
    /* grain */
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (var g = 0; g < 40; g++) {
      ctx.fillRect((g * 97) % W, (g * 53 + t * 8) % H, 2, 2);
    }
  }

  function paintMotes(ctx, W, H, t, px, world, k) {
    for (var i = 0; i < world.motes.length; i++) {
      var m = world.motes[i];
      var x = (m.x * W + Math.sin(t * m.s + m.p) * 16 + px * m.z) % W;
      if (x < 0) x += W;
      var y = (m.y * H - t * 12 * m.s) % H;
      if (y < 0) y += H;
      ctx.globalAlpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2 + m.p));
      ctx.fillStyle = m.c || (k === "ainsley" ? "#ffc89a" : "#d8fff0");
      ctx.beginPath();
      ctx.arc(x, y, m.r * (0.8 + m.z), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintShafts(ctx, W, H, t, k) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var col = k === "ainsley" ? "rgba(255, 186, 140, 0.05)" : k === "harris" ? "rgba(210, 255, 190, 0.05)" : "rgba(190, 240, 255, 0.06)";
    for (var i = 0; i < 3; i++) {
      ctx.fillStyle = col;
      ctx.save();
      ctx.translate(W * (0.2 + i * 0.28), 0);
      ctx.rotate(-0.18 + Math.sin(t * 0.2 + i) * 0.03);
      ctx.fillRect(0, 0, 36 + i * 8, H * 0.85);
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- sub-scenes ---------- */
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
    sceneEl.addEventListener("click", function (e) {
      if (e.target === sceneEl || e.target === sceneCv) back();
    });
  }

  function show(opts) {
    ensureScene();
    var r = opts.from && opts.from.getBoundingClientRect ? opts.from.getBoundingClientRect() : null;
    var x = r ? ((r.left + r.width / 2) / global.innerWidth * 100) : 50;
    var y = r ? ((r.top + r.height / 2) / global.innerHeight * 100) : 40;
    sceneEl.style.setProperty("--kx", x + "%");
    sceneEl.style.setProperty("--ky", y + "%");
    sceneEl.querySelector("[data-kicker]").textContent = opts.kicker || "";
    sceneEl.querySelector("[data-title]").textContent = opts.title || "";
    var body = sceneEl.querySelector("[data-body]");
    body.innerHTML = opts.html || "";
    var actions = sceneEl.querySelector(".kw-scene-actions");
    var extra = actions.querySelectorAll("[data-extra]");
    for (var i = 0; i < extra.length; i++) extra[i].remove();
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
    document.documentElement.style.overflow = "hidden";
    if (!sceneWorld) sceneWorld = new World(sceneCv);
    sceneWorld.kid = opts.paintKid || kid();
    sceneWorld.resize();
    sceneWorld.custom = opts.paint || null;
    if (global.HouseSfx && HouseSfx.unlockAudio) HouseSfx.unlockAudio();
    if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap();
    tickScene();
  }

  var sceneRaf = 0;
  function tickScene() {
    if (!sceneEl || !sceneEl.classList.contains("is-on") || !sceneWorld) return;
    if (sceneWorld.custom) {
      var ctx = sceneWorld.ctx;
      var t = reduced ? 1 : (performance.now() - sceneWorld.t0) / 1000;
      ctx.setTransform(sceneWorld.dpr, 0, 0, sceneWorld.dpr, 0, 0);
      var W = sceneCv.width / sceneWorld.dpr, H = sceneCv.height / sceneWorld.dpr;
      sceneWorld.frame(sceneWorld.kid);
      sceneWorld.custom(ctx, W, H, t, sceneWorld.kid);
    } else sceneWorld.frame(sceneWorld.kid);
    if (!reduced) sceneRaf = requestAnimationFrame(tickScene);
  }

  function openScene(opts) {
    opts = opts || {};
    stack.push(opts);
    show(opts);
  }

  function back() {
    stack.pop();
    if (!stack.length) {
      sceneEl.classList.remove("is-on");
      document.documentElement.style.overflow = "";
      if (global.HouseSfx && HouseSfx.tap) HouseSfx.tap();
      return;
    }
    show(stack[stack.length - 1]);
  }

  function closeAll() {
    stack.length = 0;
    if (sceneEl) sceneEl.classList.remove("is-on");
    document.documentElement.style.overflow = "";
  }

  function vignette(kind) {
    return function (ctx, W, H, t) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      if (kind === "bed") {
        ctx.fillStyle = "rgba(255, 220, 170, 0.18)";
        ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.62, 120, 36, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 3;
        ctx.strokeRect(W * 0.5 - 90, H * 0.5, 180, 50);
      } else if (kind === "water") {
        ctx.strokeStyle = "rgba(180, 230, 255, 0.45)";
        for (var i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(W * 0.5, H * 0.58, 20 + i * 28 + Math.sin(t * 2) * 4, 0, 7);
          ctx.stroke();
        }
      } else if (kind === "blocks") {
        for (var b = 0; b < 5; b++) {
          ctx.fillStyle = LOOT[b];
          ctx.globalAlpha = 0.85;
          ctx.fillRect(W * 0.38 + b * 28, H * 0.58 - (b % 3) * 22, 24, 24);
        }
      } else if (kind === "bag") {
        ctx.strokeStyle = "rgba(255,230,180,0.8)";
        ctx.lineWidth = 3;
        ctx.strokeRect(W * 0.42, H * 0.48, 90, 80);
        ctx.beginPath(); ctx.arc(W * 0.5, H * 0.48, 28, Math.PI, 0); ctx.stroke();
      } else if (kind === "woods") {
        ctx.strokeStyle = "rgba(255, 200, 160, 0.55)";
        ctx.beginPath(); ctx.moveTo(W * 0.2, H * 0.75); ctx.quadraticCurveTo(W * 0.5, H * 0.4, W * 0.8, H * 0.72); ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath(); ctx.arc(W * 0.5, H * 0.5, 18 + Math.sin(t * 3) * 4, 0, 7); ctx.fill();
      }
      ctx.restore();
    };
  }

  function kindFor(text) {
    var s = String(text || "").toLowerCase();
    if (/bed/.test(s)) return "bed";
    if (/dish|empty|washer/.test(s)) return "water";
    if (/toy|room|cubby|block/.test(s)) return "blocks";
    if (/pack|shoe|bag|laundry/.test(s)) return "bag";
    if (/swim|bath|shower/.test(s)) return "water";
    if (/school|special|sre|spanish|music|art/.test(s)) return "woods";
    return "glow";
  }

  function textOf(el) {
    if (!el) return "";
    var w = el.querySelector && el.querySelector(".what, .consume-hero-title, .consume-ahead-what");
    return (w && w.textContent) || el.getAttribute("aria-label") || el.textContent || "";
  }

  function openFor(el) {
    if (!el) return;
    var label = textOf(el).replace(/\s+/g, " ").trim().slice(0, 80);
    var day = el.classList && el.classList.contains("day-tap");
    var done = el.classList && el.classList.contains("done");
    openScene({
      from: el,
      kicker: day ? "a tap in the week" : "in the world",
      title: label || "Here",
      html: done ? "<p>The light keeps that.</p>" : "<p>It settles into the jar.</p>",
      paint: vignette(kindFor(label))
    });
  }

  function soften() {
    document.querySelectorAll(".vfx-dollar").forEach(function (n) { n.remove(); });
    document.querySelectorAll("[data-streak-label]").forEach(function (n) {
      if (n.textContent) n.textContent = "";
    });
    document.querySelectorAll(".xp-glass-lab, .xp-glass-meta").forEach(function (n) {
      if (/xp|streak|locked|\$/i.test(n.textContent || "")) n.textContent = "today";
    });
    document.querySelectorAll(".money-row, .grow-meter, .bars, .xp-glass, [data-streak-label], [data-got-it], .paid-stamp, [data-bank-meta]").forEach(function (n) {
      if (n.getAttribute("aria-hidden") !== "true") n.setAttribute("aria-hidden", "true");
    });
    document.querySelectorAll("[data-bank-meta]").forEach(function (n) {
      if (/\$|locked|balance|streak/i.test(n.textContent || "")) n.textContent = "this week";
    });
  }

  function mountJar() {
    var host = document.querySelector(".kw-jar-host");
    if (!host) {
      var bank = document.querySelector("#sec-jar, .sec-bank");
      if (!bank) return;
      host = document.createElement("div");
      host.className = "kw-jar-host";
      host.setAttribute("data-kw-jar", "1");
      bank.insertBefore(host, bank.firstChild);
    }
    if (host.getAttribute("data-mounted") === "1" || !global.JarEngine) return;
    host.setAttribute("data-mounted", "1");
    JarEngine.mount(host, {
      kid: kid(),
      onTap: function () { openJarScene(host); }
    });
  }

  function openJarScene(from) {
    var st = global.JarEngine ? JarEngine.choreState(kid()) : { fill: 0, full: false };
    var html = "<p>The metal rises with the things that got done.</p>";
    openScene({
      from: from,
      kicker: st.asleep ? "the woods are resting" : "the jar",
      title: st.full ? "It spills into a run" : "Gathering",
      html: html,
      paint: vignette("glow"),
      onMount: function (body, actions) {
        if (st.full) {
          var a = document.createElement("a");
          a.className = "kw-go";
          a.setAttribute("data-extra", "1");
          a.href = "mercury-run.html?kid=" + encodeURIComponent(kid());
          a.textContent = "Step into the run";
          actions.appendChild(a);
        }
        var note = document.createElement("p");
        note.textContent = st.asleep ? "Nothing new is kept while the week is away." : (st.hungry ? "The lid is loose. Something is still waiting today." : "It is quiet and bright.");
        body.appendChild(note);
      }
    });
  }

  function juice(el) {
    if (!el || reduced || !el.animate) return;
    el.animate(
      [{ transform: "scale(1)", filter: "brightness(1)" }, { transform: "scale(1.04)", filter: "brightness(1.5)" }, { transform: "scale(1)", filter: "brightness(1)" }],
      { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  }

  function onClick(ev) {
    if (!ev.isTrusted) return;
    if (!document.body.classList.contains("kw-on")) return;
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest(".kw-scene")) return;
    if (t.closest("[data-mute-toggle]")) return;
    var jar = t.closest("[data-kw-jar]");
    if (jar) return; /* jar handles itself */
    var a = t.closest("a[href]");
    if (a && sceneEl && sceneEl.contains(a)) return;
    if (a) {
      var href = a.getAttribute("href") || "";
      if (href.charAt(0) === "#") {
        ev.preventDefault();
        var sec = document.querySelector(href);
        openScene({
          from: a,
          kicker: "along the path",
          title: a.getAttribute("aria-label") || "There",
          html: "",
          paint: vignette("woods"),
          onMount: function (body, actions) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "kw-chip";
            b.textContent = "Show it";
            b.addEventListener("click", function () {
              closeAll();
              if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
            });
            actions.appendChild(b);
          }
        });
        return;
      }
      if (/^https?:|^sheet-|^kid-|^index\.|^month\./.test(href) || href.indexOf(".html") > 0) {
        ev.preventDefault();
        ev.stopPropagation();
        openScene({
          from: a,
          kicker: "a door",
          title: (a.textContent || "Onward").trim().slice(0, 42) || "Onward",
          html: "<p>The path keeps going.</p>",
          go: href,
          goLabel: "Go",
          paint: vignette("woods")
        });
        return;
      }
    }
    var hit = t.closest(".day-tap, .quest[data-check], .quest, .consume-hero, .consume-ahead-row, .consume-day, .consume-punch-card, .hot-banner, .card");
    if (!hit) return;
    juice(hit);
    /* let the checkoff click finish, then open */
    setTimeout(function () { openFor(hit); }, 30);
  }

  var bg = null;
  function loop() {
    if (!bg) return;
    if (!document.hidden && !(sceneEl && sceneEl.classList.contains("is-on"))) bg.frame();
    if (reduced) return;
    requestAnimationFrame(loop);
  }

  function boot() {
    if (!document.body || !document.body.getAttribute("data-kid")) return;
    document.documentElement.classList.add("kw-root");
    if (reduced) document.documentElement.classList.add("kw-reduce");
    document.body.classList.add("kw-on");
    if (global.JarEngine && JarEngine.choreState(kid()).asleep) document.body.classList.add("kw-asleep");
    var cv = document.querySelector(".kw-canvas");
    if (!cv) {
      cv = document.createElement("canvas");
      cv.className = "kw-canvas";
      cv.setAttribute("aria-hidden", "true");
      document.body.insertBefore(cv, document.body.firstChild);
    }
    bg = new World(cv);
    global.addEventListener("pointermove", function (e) {
      bg.ptr.x = e.clientX / Math.max(1, innerWidth);
      bg.ptr.y = e.clientY / Math.max(1, innerHeight);
    }, { passive: true });
    global.addEventListener("scroll", function () { bg.scroll = global.scrollY || 0; }, { passive: true });
    global.addEventListener("resize", function () { bg.resize(); if (sceneWorld) sceneWorld.resize(); });
    document.addEventListener("click", onClick, true);
    document.addEventListener("house:kid-rendered", function () {
      mountJar();
      soften();
      if (global.JarEngine && JarEngine.choreState(kid()).asleep) document.body.classList.add("kw-asleep");
    });
    mountJar();
    soften();
    var mo = new MutationObserver(function () { soften(); });
    mo.observe(document.body, { childList: true, subtree: true });
    loop();
    if (reduced) bg.frame();
    /* jump pills get readable names; the old art is hidden */
    var names = ["Musts", "Jar", "Days"];
    document.querySelectorAll(".jump-rail a.row").forEach(function (a, i) {
      if (!a.textContent.trim()) a.textContent = a.getAttribute("aria-label") || names[i] || "Go";
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  global.KidWorld = {
    openScene: openScene,
    back: back,
    close: closeAll,
    vignette: vignette,
    kindFor: kindFor,
    reduced: function () { return reduced; }
  };
})(window);
