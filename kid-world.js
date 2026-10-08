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
      var dow = "";
      var time = "";
      if (global.HouseClock && HouseClock.now) {
        var s = HouseClock.now();
        if (s) { dow = s.dow || ""; time = s.time || ""; }
      }
      if (!time) {
        var p = {};
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true
        }).formatToParts(new Date()).forEach(function (x) { if (x.type !== "literal") p[x.type] = x.value; });
        dow = p.weekday || "";
        time = (p.hour || "") + ":" + (p.minute || "00") + (p.dayPeriod ? " " + p.dayPeriod : "");
      }
      dow = String(dow).replace(/\./g, "");
      if (dow) dow = dow.charAt(0).toUpperCase() + dow.slice(1, 3).toLowerCase();
      return dow && time ? dow + " · " + time : time;
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
      out.push({ label: label, done: btn.classList.contains("done"), btn: btn });
    });
    return out;
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

  var plates = {};
  var platesReady = false;
  var feed = null;
  var gyro = { gamma: 0, beta: 48, on: false };
  var oriCreature = {};
  var PLATE_ZOOM = 1.22;

  function parallaxNow(t, drift) {
    if (drift) return { x: Math.sin(t * 0.28) * 26, y: Math.sin(t * 0.16) * 8 };
    if (reduced) return { x: 0, y: 0 };
    var wall = Math.max(global.innerWidth || 0, global.innerHeight || 0) >= 1000;
    if (wall) return { x: Math.sin(t * 0.12) * 26, y: Math.sin(t * 0.08) * 8 };
    var tx = ((bg && bg.ptr != null ? bg.ptr : 0.5) - 0.5);
    var gx = gyro.on ? clamp(gyro.gamma / 30, -1, 1) : 0;
    var gy = gyro.on ? clamp(((gyro.beta || 48) - 48) / 36, -1, 1) : 0;
    return { x: clamp(gx * 22 + tx * 36, -26, 26), y: clamp(gy * 14, -12, 12) };
  }
  function markJarVisual() {
    var host = document.querySelector("[data-kw-jar]");
    if (oriCreature.idle) {
      document.body.classList.add("kw-sprite");
      document.body.classList.remove("kw-jar-gl");
      if (host && host._jar) host._jar.hideVisual = true;
    } else if (platesReady) {
      document.body.classList.add("kw-jar-gl");
    }
  }

  function loadImg(src) {
    return new Promise(function (res) {
      if (!src) { res(null); return; }
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = src;
    });
  }
  function loadFirst(urls) {
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.resolve(null);
      var src = urls[i++];
      return loadImg(src).then(function (im) { return im || next(); });
    }
    return next();
  }
  function orientFor(w, h) {
    return w > h * 1.15 ? "landscape" : "portrait";
  }
  function loadPlates() {
    var book = global.HousePlates || {};
    var worlds = ["hayes", "harris", "ainsley"];
    var jobs = [];
    [
      ["idle", "assets/ori/creature/idle.webp"],
      ["happy", "assets/ori/creature/happy_squish.webp"],
      ["fed", "assets/ori/creature/fed_splash.webp"],
      ["idleShadow", "assets/ori/creature/idle_shadow.webp"],
      ["happyShadow", "assets/ori/creature/happy_squish_shadow.webp"],
      ["fedShadow", "assets/ori/creature/fed_splash_shadow.webp"]
    ].forEach(function (row) {
      jobs.push(loadImg(row[1]).then(function (im) { oriCreature[row[0]] = im; }));
    });
    worlds.forEach(function (world) {
      var man = book[world];
      if (!man) return;
      plates[world] = plates[world] || { portrait: {}, landscape: {} };
      plates[world].portrait = plates[world].portrait || {};
      plates[world].landscape = plates[world].landscape || {};
      (man.layers || []).forEach(function (layer) {
        ["portrait", "landscape"].forEach(function (orient) {
          var urls = book.urlFor ? book.urlFor(world, layer.id, orient, layer.standin) : [layer.standin];
          jobs.push(loadFirst(urls).then(function (im) {
            plates[world][orient][layer.id] = im;
            if (orient === "portrait") plates[world][layer.id] = im;
          }));
        });
      });
    });
    return Promise.all(jobs).then(function () {
      platesReady = true;
      markJarVisual();
    });
  }
  function drawPlate(ctx, img, W, H, ox, oy, zoom, alpha, blur) {
    if (!img) return;
    var z = zoom || 1;
    var scale = Math.max(W / img.width, H / img.height) * z;
    var dw = img.width * scale;
    var dh = img.height * scale;
    ctx.save();
    if (blur) ctx.filter = "blur(" + blur + "px)";
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(img, (W - dw) / 2 + (ox || 0), (H - dh) / 2 + (oy || 0), dw, dh);
    ctx.restore();
  }
  function shortLabel(full) {
    var s = String(full || "").replace(/\s+/g, " ").trim();
    s = s.replace(/^\s*\p{Extended_Pictographic}\s*/u, "");
    var head = s.split(/\s+[—–]\s+|\s+-\s+/)[0];
    var bit = head.split(/\s+·\s+/)[0].trim();
    return bit || head || s;
  }
  function wrapLines(ctx, text, maxW) {
    var words = String(text || "").split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = "";
    for (var i = 0; i < words.length; i++) {
      var next = cur ? cur + " " + words[i] : words[i];
      if (cur && ctx.measureText(next).width > maxW) {
        lines.push(cur);
        cur = words[i];
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function ledgeFor(world, i, n) {
    var man = (global.HousePlates && HousePlates[world]) || {};
    var list = man.landmarks || [];
    if (list[i]) return list[i];
    var col = i % 2;
    var row = Math.floor(i / 2);
    var rows = Math.max(1, Math.ceil(n / 2));
    var top = 0.22;
    var bot = Math.min(0.64, 0.22 + (rows - 1) * 0.08);
    var y = rows <= 1 ? 0.4 : top + row * ((bot - top) / Math.max(1, rows - 1));
    if (col) y = Math.min(0.64, y + 0.03);
    return { x: col ? 0.76 : 0.24, y: y, depth: 0.2 + i * 0.05, scale: 0.75 + (i % 3) * 0.08 };
  }
  function creatureAnchor(W, H) {
    var draw = clamp(Math.round(Math.min(W, H) * 0.424), 186, 300);
    var bodyH = draw * (616 / 1024);
    var bodyW = draw * (615 / 1024);
    var cx = W * 0.46;
    var foot = H - 100;
    return {
      draw: draw,
      jw: bodyW,
      jh: bodyH,
      jx: cx - bodyW / 2,
      jy: foot - bodyH,
      cx: cx,
      foot: foot
    };
  }
  function layoutLedges(quests, W, H, world, px) {
    var n = quests.length;
    var chipLift = 22;
    var box = creatureAnchor(W, H);
    var floorY = H - 108;
    quests.forEach(function (q, i) {
      var ledge = ledgeFor(world, i, n);
      var depth = ledge.depth || 0.3;
      q.depth = depth;
      q.kind = ledge.kind || "";
      q.x = ledge.x * W + (px || 0) * depth;
      q.seat = ledge.y * H;
      q.scale = ledge.scale || 0.8;
      q.chip = shortLabel(q.label);
      q.maxW = Math.min(128, W * 0.34);
      q.hw = q.maxW;
      q.hh = 36;
      q.r = 26;
      q.y = q.seat - chipLift;
      if (q.y > floorY) q.y = floorY;
      if (q.y < 168) q.y = 168;
      if (Math.abs(q.x - box.cx) < box.jw * 0.65 + 20 && q.y + 24 > box.jy) q.y = box.jy - 32;
    });
    separateChips(quests, 12, 160, W - 12, floorY);
    quests.forEach(function (q) {
      if (Math.abs(q.x - box.cx) < box.jw * 0.65 + 20 && q.y + 20 > box.jy) {
        q.x = Math.min(q.x, box.jx - 16);
      }
      q.chipY = q.y;
      q.seat = q.y + chipLift;
      q.ledY = q.seat;
    });
  }
  function separateChips(quests, minX, minY, maxX, maxY) {
    var pass, i, j, a, b, dx, dy, needX, needY, push, s;
    for (pass = 0; pass < 10; pass++) {
      for (i = 0; i < quests.length; i++) {
        for (j = i + 1; j < quests.length; j++) {
          a = quests[i]; b = quests[j];
          dx = b.x - a.x; dy = b.y - a.y;
          needX = (a.hw + b.hw) / 2 + 10;
          needY = (a.hh + b.hh) / 2 + 8;
          if (Math.abs(dx) < needX && Math.abs(dy) < needY) {
            if ((needX - Math.abs(dx)) <= (needY - Math.abs(dy))) {
              push = (needX - Math.abs(dx)) / 2 + 0.5;
              s = dx < 0 ? -1 : 1;
              a.x -= s * push; b.x += s * push;
            } else {
              push = (needY - Math.abs(dy)) / 2 + 0.5;
              s = dy < 0 ? -1 : 1;
              a.y -= s * push; b.y += s * push;
            }
          }
        }
        a = quests[i];
        a.x = Math.max(minX + a.hw / 2, Math.min(maxX - a.hw / 2, a.x));
        a.y = Math.max(minY + a.hh / 2, Math.min(maxY - a.hh / 2, a.y));
      }
    }
  }
  function drawLight(ctx, q, world) {
    ctx.save();
    var size = 15;
    var maxW = q.maxW || 140;
    ctx.font = "600 " + size + "px Palatino, Georgia, serif";
    var lines = wrapLines(ctx, q.chip || q.label, maxW);
    while (lines.length > 2 && size > 12) {
      size -= 1;
      ctx.font = "600 " + size + "px Palatino, Georgia, serif";
      lines = wrapLines(ctx, q.chip || q.label, maxW);
    }
    ctx.font = "600 " + size + "px Palatino, Georgia, serif";
    var tw = 0;
    for (var j = 0; j < lines.length; j++) tw = Math.max(tw, ctx.measureText(lines[j]).width);
    q.hw = Math.max(44, tw + 8);
    q.hh = lines.length * (size + 3) + 6;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(10, 8, 6, 0.82)";
    ctx.shadowColor = "rgba(6, 4, 2, 0.9)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = q.done ? "rgba(255, 226, 168, 0.98)" : "rgba(255, 248, 236, 0.96)";
    var y0 = q.y - ((lines.length - 1) * (size + 3)) / 2;
    for (var k = 0; k < lines.length; k++) {
      var ly = y0 + k * (size + 3);
      ctx.strokeText(lines[k], q.x, ly);
      ctx.shadowBlur = 0;
      ctx.fillText(lines[k], q.x, ly);
      ctx.shadowBlur = 14;
    }
    ctx.restore();
  }
  function fullCard(ctx, text, W, H, world) {
    var maxW = W - 56;
    var size = 16;
    ctx.save();
    ctx.font = "600 " + size + "px Palatino, Georgia, serif";
    var lines = wrapLines(ctx, text, maxW);
    while (lines.length > 4 && size > 13) {
      size -= 1;
      ctx.font = "600 " + size + "px Palatino, Georgia, serif";
      lines = wrapLines(ctx, text, maxW);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(10, 8, 6, 0.82)";
    ctx.shadowColor = "rgba(6, 4, 2, 0.9)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = "rgba(255, 248, 236, 0.98)";
    var y0 = 78;
    for (var i = 0; i < lines.length; i++) {
      var ly = y0 + i * (size + 6);
      ctx.strokeText(lines[i], W / 2, ly);
      ctx.shadowBlur = 0;
      ctx.fillText(lines[i], W / 2, ly);
      ctx.shadowBlur = 14;
    }
    ctx.restore();
  }
  function feedDrops(ctx, t, t0, x, y, jx, jy) {
    var age = t - t0;
    if (!(age >= 0 && age < 1.35)) return;
    var u = Math.min(1, age / 1.05);
    var ease = u * u * (3 - 2 * u);
    for (var i = 0; i < 6; i++) {
      var lag = i * 0.07;
      var uu = Math.max(0, Math.min(1, (age - lag) / 1.05));
      var e = uu * uu * (3 - 2 * uu);
      var px = x + (jx - x) * e + Math.sin(i * 2.1) * (1 - e) * 10;
      var py = y + (jy - y) * e - Math.sin(e * Math.PI) * (36 + i * 6);
      ctx.fillStyle = "rgba(210, 236, 255, " + (0.95 - e * 0.2) + ")";
      ctx.beginPath();
      ctx.arc(px, py, 3.2 + (1 - e) * 2, 0, 7);
      ctx.fill();
    }
    if (ease > 0.92) {
      ctx.globalAlpha = (1 - u) * 3;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(jx, jy, 10 + (u - 0.9) * 40, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawIsland(ctx, img, crop, q) {
    if (!img) return;
    var nx = crop && crop.nx != null ? crop.nx : 0;
    var ny = crop && crop.ny != null ? crop.ny : 0;
    var nw = crop && crop.nw != null ? crop.nw : 1;
    var nh = crop && crop.nh != null ? crop.nh : 1;
    var ledge = crop && crop.ledge != null ? crop.ledge : 0.28;
    var sw = Math.max(1, img.width * nw);
    var sh = Math.max(1, img.height * nh);
    var sx = clamp(nx * img.width, 0, Math.max(0, img.width - sw));
    var sy = clamp(ny * img.height, 0, Math.max(0, img.height - sh));
    var iw = Math.min(q.maxW ? q.maxW + 36 : 190, 112 + 78 * (q.scale || 0.8));
    var ih = iw * (sh / sw);
    var top = q.seat - ih * ledge;
    ctx.save();
    ctx.globalAlpha = 0.78 + Math.min(0.22, (q.scale || 0.8) * 0.22);
    ctx.drawImage(img, sx, sy, sw, sh, q.x - iw / 2, top, iw, ih);
    ctx.restore();
    q.ledY = q.seat;
  }
  function drawChest(ctx, q, open, t) {
    ctx.save();
    ctx.translate(q.x, q.seat - 6);
    var pop = open ? 1 + Math.sin(t * 3) * 0.04 : 1;
    ctx.scale(pop, pop);
    var glowR = open ? 86 : 48;
    var glow = ctx.createRadialGradient(0, -10, 4, 0, -8, glowR);
    glow.addColorStop(0, open ? "rgba(255, 246, 214, 0.96)" : "rgba(255, 214, 150, 0.42)");
    glow.addColorStop(0.42, open ? "rgba(255, 176, 70, 0.5)" : "rgba(255, 170, 70, 0.1)");
    glow.addColorStop(1, "rgba(255, 140, 40, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -10, glowR, 0, 7);
    ctx.fill();
    ctx.fillStyle = open ? "#7a4e22" : "#3a2612";
    ctx.fillRect(-34, -6, 68, 40);
    ctx.strokeStyle = "rgba(255, 232, 190, 0.82)";
    ctx.lineWidth = 1.7;
    ctx.strokeRect(-33, -5, 66, 38);
    ctx.fillStyle = "rgba(255, 244, 214, 0.75)";
    ctx.fillRect(-32, -5, 64, 3);
    ctx.save();
    ctx.translate(0, -6);
    ctx.rotate(open ? -0.9 : -0.05);
    ctx.fillStyle = open ? "#f2d39a" : "#b08048";
    ctx.fillRect(-36, -18, 72, 18);
    ctx.strokeStyle = "rgba(255, 246, 220, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-36, -18, 72, 18);
    ctx.restore();
    ctx.fillStyle = open ? "#fff8dc" : "#e8c888";
    ctx.fillRect(-5, 6, 10, 10);
    ctx.strokeStyle = "rgba(255, 250, 230, 0.8)";
    ctx.strokeRect(-5, 6, 10, 10);
    ctx.restore();
  }
  function islandImage(P, man, si) {
    var bit = P.bits && P.bits[si];
    if (bit) return { img: bit, crop: { nx: 0, ny: 0, nw: 1, nh: 1 } };
    var stamps = man.stamps || [];
    return { img: P.stamp || P.mid, crop: stamps[si] || { nx: 0, ny: 0, nw: 1, nh: 1 } };
  }
  function drawPlacedIsland(ctx, img, crop, x, y, scale, haze, flip) {
    if (!img) return;
    var nw = crop && crop.nw != null ? crop.nw : 1;
    var nh = crop && crop.nh != null ? crop.nh : 1;
    var sw = Math.max(1, img.width * nw);
    var sh = Math.max(1, img.height * nh);
    var sx = clamp((crop && crop.nx || 0) * img.width, 0, Math.max(0, img.width - sw));
    var sy = clamp((crop && crop.ny || 0) * img.height, 0, Math.max(0, img.height - sh));
    var iw = 210 * (scale || 1);
    var ih = iw * (sh / sw);
    ctx.save();
    ctx.globalAlpha = 1 - (haze || 0) * 0.45;
    if (haze > 0.25) ctx.filter = "blur(" + (haze * 1.4).toFixed(2) + "px)";
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -iw / 2, -ih * 0.78, iw, ih);
    ctx.restore();
  }
  function drawSpan(ctx, x0, y0, x1, y1, bow) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + (bow || 26), x1, y1);
    ctx.strokeStyle = "rgba(42, 28, 16, 0.92)";
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.strokeStyle = "rgba(214, 176, 120, 0.42)";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }
  function drawHayesScene(ctx, P, man, W, H, px, t) {
    var scene = (man && man.scene) || [];
    var order = scene.map(function (isl, i) { return { isl: isl, i: i }; });
    order.sort(function (a, b) { return (a.isl.depth || 0) - (b.isl.depth || 0); });
    var placed = [];
    order.forEach(function (row) {
      var isl = row.isl;
      var depth = isl.depth || 0.3;
      var drift = Math.sin(t * 0.16 + row.i * 1.4) * (4 + (1 - depth) * 8);
      var x = isl.x * W + (px || 0) * depth + drift;
      var y = isl.y * H + Math.sin(t * 0.1 + row.i) * 3;
      var pack = islandImage(P, man, isl.stamp || 0);
      drawPlacedIsland(ctx, pack.img, pack.crop, x, y, isl.scale || 1, isl.haze || 0, !!isl.flip);
      placed[row.i] = { x: x, y: y };
    });
    if (placed[2] && placed[3]) drawSpan(ctx, placed[2].x - 10, placed[2].y + 18, placed[3].x + 16, placed[3].y + 8, 34);
    if (placed[1] && placed[3]) drawSpan(ctx, placed[1].x + 8, placed[1].y + 24, placed[3].x - 30, placed[3].y - 6, 18);
    if (placed[3]) {
      ctx.save();
      ctx.strokeStyle = "rgba(54, 36, 20, 0.88)";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(placed[3].x - 20, placed[3].y + 10);
      ctx.quadraticCurveTo(placed[3].x - 46, placed[3].y + 36, placed[3].x - 18, placed[3].y + 58);
      ctx.stroke();
      ctx.strokeStyle = "rgba(196, 160, 110, 0.35)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
  }
  function paintKid(ctx, W, H, t, px, quests, fill, world) {
    var man = (global.HousePlates && HousePlates[world]) || HousePlates.hayes;
    var P = plates[world] || {};
    var layers = man.layers || [];
    if (!P.sky) sky(ctx, W, H, [[0, "#102028"], [0.5, "#3a6a55"], [1, "#142018"]]);
    var stampIsMid = man.stamp && layers.some(function (layer) { return layer.id === "mid" && layer.standin === man.stamp; });
    layers.forEach(function (layer) {
      if (layer.id === "fg" || layer.id === "near") return;
      if (layer.id === "mid" && stampIsMid) return;
      var drift = Math.sin(t * 0.12 + layer.parallax) * 8;
      drawPlate(ctx, P[layer.id], W, H, px * layer.parallax + drift, Math.sin(t * 0.08) * 4, 1.04, layer.id === "mid" ? 0.88 : 1, 0);
    });
    if (P.rays) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      drawPlate(ctx, P.rays, W, H, px * 0.1 + Math.sin(t * 0.18) * 20, -H * 0.02, 1.12, world === "hayes" ? 0.26 : 0.16, 0);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      drawPlate(ctx, P.rays, W, H, px * 0.16 + Math.sin(t * 0.1) * 12, 0, 1.2, 0.12, 16);
      ctx.restore();
    }
    if (world === "hayes") drawHayesScene(ctx, P, man, W, H, px, t);
    else shafts(ctx, W, H, t, world === "ainsley" ? "rgba(255, 186, 140, 0.04)" : "rgba(210, 255, 200, 0.035)");
    var fogG = ctx.createLinearGradient(0, H * 0.72, 0, H);
    fogG.addColorStop(0, "rgba(10, 14, 16, 0)");
    fogG.addColorStop(1, "rgba(8, 10, 12, 0.42)");
    ctx.fillStyle = fogG;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
    motes(ctx, W, H, t, px, world === "ainsley" ? "#ffd8c0" : "#fff1d0", 32);
    if (world === "harris") {
      ctx.fillStyle = "rgba(30, 70, 40, 0.14)";
      ctx.fillRect(0, 0, W, H);
    } else if (world === "ainsley") {
      var dusk = ctx.createLinearGradient(0, 0, 0, H);
      dusk.addColorStop(0, "rgba(40, 16, 28, 0.18)");
      dusk.addColorStop(0.55, "rgba(120, 50, 30, 0.08)");
      dusk.addColorStop(1, "rgba(20, 10, 12, 0.28)");
      ctx.fillStyle = dusk;
      ctx.fillRect(0, 0, W, H);
    }
    var cap = (man.landmarks && man.landmarks.length) || quests.length;
    var shown = quests.slice(0, cap);
    layoutLedges(shown, W, H, world, px);
    shown.forEach(function (q, i) {
      var open = q.done || (feed && feed.index === i && t < feed.t0 + 2.4);
      var glowY = q.seat - 8;
      var restG = ctx.createRadialGradient(q.x, glowY, 2, q.x, glowY, 36);
      restG.addColorStop(0, "rgba(255, 236, 200, 0.22)");
      restG.addColorStop(1, "rgba(255, 236, 200, 0)");
      ctx.fillStyle = restG;
      ctx.beginPath();
      ctx.arc(q.x, glowY, 36, 0, 7);
      ctx.fill();
      if (world === "hayes") drawChest(ctx, q, open, t);
      else {
        var col = world === "ainsley" ? "rgba(255, 186, 120, 0.95)" : "rgba(170, 255, 190, 0.9)";
        var rad = open ? 48 : 20;
        var g = ctx.createRadialGradient(q.x, q.seat - 6, 2, q.x, q.seat - 4, rad);
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.seat - 4, rad, 0, 7);
        ctx.fill();
      }
      var hold = q.y;
      q.y = q.chipY != null ? q.chipY : q.seat - 28;
      drawLight(ctx, q, world);
      q.chipY = q.y;
      q.y = hold;
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, H * 0.82, W, H * 0.18);
    ctx.clip();
    var fgLayer = null;
    layers.forEach(function (layer) { if (layer.id === "fg") fgLayer = layer; });
    drawPlate(ctx, P.near, W, H, px * 0.7, H * 0.28, 1.15, 0.9, 0);
    if (fgLayer) drawPlate(ctx, P.fg, W, H, px * fgLayer.parallax, H * 0.34, 1.08, 0.85, fgLayer.blur || 2);
    ctx.restore();
    var anchor = creatureAnchor(W, H);
    var jx = anchor.cx;
    var jy = anchor.jy + anchor.jh * 0.42;
    if (feed && shown[feed.index]) {
      var fq = shown[feed.index];
      var fromY = fq.ledY != null ? fq.ledY : fq.y;
      feedDrops(ctx, t, feed.t0, fq.x, fromY, jx, jy);
      if (t < feed.t0 + 4.2) fullCard(ctx, feed.label || fq.label, W, H, world);
      burst(ctx, t, feed.t0, fq.x, fromY, "#ffe7a8");
    }
    warmth(ctx, W, H, fill);
    return shown;
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

  function arrived(img) {
    return !!(img && /ori-layers/i.test(img.src || ""));
  }
  function stoneHill(ctx, x, y, w, h, lit) {
    ctx.fillStyle = lit ? "#6e7a62" : "#3e4a3c";
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w * 0.18, y + h * 0.35);
    ctx.lineTo(x + w * 0.46, y);
    ctx.lineTo(x + w * 0.72, y + h * 0.28);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(x + w * 0.4, y + 4, w * 0.18, 5);
  }
  function drawOre(ctx, q, i, open, t) {
    var kinds = ["slab", "crystal", "cluster", "geode", "block", "shard", "node"];
    var kind = q.kind || kinds[i % kinds.length];
    var hues = [150, 188, 48, 272, 118, 28, 200];
    var hue = hues[i % hues.length];
    ctx.save();
    ctx.translate(q.x, q.seat);
    var s = 0.85 + (q.scale || 0.8) * 0.35;
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(20, 16, 12, 0.45)";
    ctx.beginPath();
    ctx.ellipse(0, 16, 28, 7, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#5c5144";
    ctx.fillRect(-22, 4, 44, 12);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(-22, 4, 44, 3);
    var glow = open ? 0.95 : 0.35;
    if (open) {
      var g = ctx.createRadialGradient(0, 0, 2, 0, 0, 36);
      g.addColorStop(0, "hsla(" + hue + ",80%,70%,0.95)");
      g.addColorStop(1, "hsla(" + hue + ",80%,70%,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = "hsl(" + hue + ",45%," + (open ? "62%" : "38%") + ")";
    var crack = open ? 5 : 0;
    if (kind === "crystal") {
      ctx.beginPath();
      ctx.moveTo(-8 - crack, 6);
      ctx.lineTo(0, -22);
      ctx.lineTo(8 + crack, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "hsl(" + hue + ",70%,72%)";
      ctx.beginPath();
      ctx.moveTo(6, 4);
      ctx.lineTo(14, -12);
      ctx.lineTo(16, 6);
      ctx.fill();
    } else if (kind === "cluster") {
      for (var c = 0; c < 4; c++) {
        ctx.fillRect(-16 + c * 9 + (open ? (c - 1.5) * crack : 0), -8 - (c % 2) * 8, 8, 14);
      }
    } else if (kind === "geode") {
      ctx.beginPath();
      ctx.arc(-crack, 0, 12, 0, 7);
      ctx.fill();
      ctx.fillStyle = "hsl(" + hue + ",80%,78%)";
      ctx.beginPath();
      ctx.arc(crack * 0.4, -1, 5, 0, 7);
      ctx.fill();
    } else if (kind === "shard") {
      ctx.beginPath();
      ctx.moveTo(-14, 8);
      ctx.lineTo(-2 - crack, -16);
      ctx.lineTo(4, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 6);
      ctx.lineTo(10 + crack, -8);
      ctx.lineTo(16, 8);
      ctx.fill();
    } else if (kind === "node") {
      ctx.beginPath();
      ctx.arc(-6 - crack, 0, 9, 0, 7);
      ctx.arc(8 + crack, 2, 7, 0, 7);
      ctx.fill();
    } else if (kind === "block") {
      ctx.fillRect(-14 - crack, -10, 16, 16);
      ctx.fillRect(2 + crack, -6, 12, 12);
    } else {
      ctx.fillRect(-16 - crack, -4, 18, 10);
      ctx.fillRect(2 + crack, -8, 14, 14);
    }
    ctx.globalAlpha = glow;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(-4, -6, 3, 3);
    ctx.restore();
  }
  function paintGrove(ctx, W, H, t, px, quests, fill) {
    var P = plates.harris || {};
    if (arrived(P.sky)) drawPlate(ctx, P.sky, W, H, px * 0.05, 0, 1.02, 1, 0);
    else {
      var skyG = ctx.createLinearGradient(0, 0, 0, H);
      skyG.addColorStop(0, "#d7e7c4");
      skyG.addColorStop(0.45, "#8fbf86");
      skyG.addColorStop(1, "#243428");
      ctx.fillStyle = skyG;
      ctx.fillRect(0, 0, W, H);
    }
    if (arrived(P.far)) drawPlate(ctx, P.far, W, H, px * 0.14, 0, 1.04, 1, 0);
    else {
      for (var h = 0; h < 5; h++) stoneHill(ctx, -20 + h * (W * 0.28) + px * 0.15, H * 0.34, W * 0.34, H * 0.16, h % 2 === 0);
    }
    if (!arrived(P.mid)) {
      for (var n = 0; n < 6; n++) {
        var tx = (n * 0.18 * W + px * 0.3) % (W + 40) - 20;
        var th = 70 + rnd(n + 2) * 90;
        ctx.fillStyle = n % 2 ? "#4a4034" : "#3a342c";
        ctx.fillRect(tx, H * 0.48 - th, 18 + (n % 3) * 8, th);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(tx, H * 0.48 - th, 18 + (n % 3) * 8, 4);
      }
      ctx.fillStyle = "#2c3a2a";
      ctx.fillRect(0, H * 0.72, W, H * 0.28);
      for (var k = 0; k < 8; k++) {
        ctx.fillStyle = k % 2 ? "#3d4e38" : "#314232";
        ctx.fillRect(k * (W / 7) - (px * 0.2 % 40), H * 0.74, W / 7 - 3, 28 + (k % 3) * 10);
      }
    } else drawPlate(ctx, P.mid, W, H, px * 0.3, 0, 1.04, 0.92, 0);
    shafts(ctx, W, H, t, "rgba(210, 255, 190, 0.05)");
    motes(ctx, W, H, t, px, "#e7ffe4", 28);
    var man = (global.HousePlates && HousePlates.harris) || {};
    var cap = (man.landmarks && man.landmarks.length) || quests.length;
    var shown = quests.slice(0, cap);
    layoutLedges(shown, W, H, "harris", px);
    shown.forEach(function (q, i) {
      var open = q.done || (feed && feed.index === i && t < feed.t0 + 2.4);
      drawOre(ctx, q, i, open, t);
      var hold = q.y;
      q.y = q.chipY != null ? q.chipY : q.seat - 28;
      drawLight(ctx, q, "harris");
      q.chipY = q.y;
      q.y = hold;
    });
    var anchor = creatureAnchor(W, H);
    var jx = anchor.cx, jy = anchor.jy + anchor.jh * 0.42;
    if (feed && shown[feed.index]) {
      var fq = shown[feed.index];
      feedDrops(ctx, t, feed.t0, fq.x, fq.ledY || fq.seat, jx, jy);
      if (t < feed.t0 + 4.2) fullCard(ctx, feed.label || fq.label, W, H, "harris");
      burst(ctx, t, feed.t0, fq.x, fq.ledY || fq.seat, "#d8ffc4");
    }
    warmth(ctx, W, H, fill);
    return shown;
  }
  function drawLantern(ctx, q, i, open, t) {
    ctx.save();
    ctx.translate(q.x, q.seat);
    var s = 0.8 + (q.scale || 0.8) * 0.4;
    ctx.scale(s, s);
    var hang = 18 + (i % 3) * 10;
    ctx.strokeStyle = "rgba(80, 48, 28, 0.8)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -hang - 16);
    ctx.lineTo(0, -16);
    ctx.stroke();
    ctx.fillStyle = open ? "#f3c98a" : "#6a5344";
    ctx.beginPath();
    ctx.moveTo(-8, -16);
    ctx.lineTo(8, -16);
    ctx.lineTo(6, 8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(-9, -18, 18, 3);
    ctx.fillRect(-7, 8, 14, 3);
    if (open) {
      var g = ctx.createRadialGradient(0, -2, 1, 0, -2, 34);
      g.addColorStop(0, "rgba(255, 236, 190, 0.95)");
      g.addColorStop(0.4, "rgba(255, 170, 80, 0.55)");
      g.addColorStop(1, "rgba(255, 140, 60, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -2, 34, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#fff6d8";
      ctx.beginPath();
      ctx.ellipse(0, -2, 3, 6 + Math.sin(t * 6 + i) * 1.2, 0, 0, 7);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(255, 140, 60, 0.35)";
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
  function paintLake(ctx, W, H, t, px, quests, fill) {
    var P = plates.ainsley || {};
    if (arrived(P.sky)) drawPlate(ctx, P.sky, W, H, px * 0.04, 0, 1.02, 1, 0);
    else {
      var skyG = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      skyG.addColorStop(0, "#241428");
      skyG.addColorStop(0.55, "#7a3a38");
      skyG.addColorStop(1, "#e7a06a");
      ctx.fillStyle = skyG;
      ctx.fillRect(0, 0, W, H * 0.52);
    }
    if (!arrived(P.mid)) {
      ctx.fillStyle = "#1a120e";
      ctx.fillRect(W * 0.62, H * 0.30, W * 0.22, H * 0.16);
      ctx.beginPath();
      ctx.moveTo(W * 0.58, H * 0.32);
      ctx.lineTo(W * 0.73, H * 0.20);
      ctx.lineTo(W * 0.88, H * 0.32);
      ctx.fill();
      ctx.fillStyle = "#ffd2a4";
      ctx.fillRect(W * 0.70, H * 0.36, 10, 12);
      var water = ctx.createLinearGradient(0, H * 0.46, 0, H);
      water.addColorStop(0, "#3a241c");
      water.addColorStop(0.4, "#1c2438");
      water.addColorStop(1, "#0c1018");
      ctx.fillStyle = water;
      ctx.fillRect(0, H * 0.46, W, H * 0.54);
      ctx.strokeStyle = "rgba(255, 200, 150, 0.18)";
      ctx.lineWidth = 1.5;
      for (var w = 0; w < 5; w++) {
        ctx.beginPath();
        var wy = H * (0.52 + w * 0.07);
        ctx.moveTo(0, wy);
        ctx.quadraticCurveTo(W * 0.5, wy + Math.sin(t * 0.8 + w) * 4, W, wy);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(90, 50, 30, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W * 0.08, H * 0.22);
      ctx.quadraticCurveTo(W * 0.5, H * 0.30, W * 0.92, H * 0.20);
      ctx.stroke();
      for (var L = 0; L < 9; L++) {
        var u = L / 8;
        var lx = W * (0.08 + u * 0.84);
        var ly = H * 0.22 + Math.sin(u * Math.PI) * H * 0.08;
        ctx.fillStyle = "rgba(255, 210, 150, 0.9)";
        ctx.beginPath();
        ctx.arc(lx + px * 0.05, ly, 2.4, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = "#3a2a22";
      ctx.fillRect(0, H * 0.78, W, 10);
      for (var p = 0; p < 8; p++) ctx.fillRect(p * (W / 8), H * 0.78, W / 8 - 4, 22);
    } else {
      drawPlate(ctx, P.mid, W, H, px * 0.28, 0, 1.04, 0.94, 0);
    }
    if (arrived(P.far)) drawPlate(ctx, P.far, W, H, px * 0.12, 0, 1.02, 0.85, 0);
    var dusk = ctx.createLinearGradient(0, 0, 0, H);
    dusk.addColorStop(0, "rgba(40, 12, 24, 0.12)");
    dusk.addColorStop(1, "rgba(12, 8, 16, 0.28)");
    ctx.fillStyle = dusk;
    ctx.fillRect(0, 0, W, H);
    motes(ctx, W, H, t, px, "#ffd2b0", 22);
    var man = (global.HousePlates && HousePlates.ainsley) || {};
    var cap = (man.landmarks && man.landmarks.length) || quests.length;
    var shown = quests.slice(0, cap);
    layoutLedges(shown, W, H, "ainsley", px);
    shown.forEach(function (q, i) {
      var open = q.done || (feed && feed.index === i && t < feed.t0 + 2.4);
      if ((q.kind || "dock") !== "dock") {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "rgba(255, 190, 120, 0.5)";
        ctx.beginPath();
        ctx.ellipse(q.x, H * 0.62 + (q.seat - H * 0.4) * 0.15, 16, 4, 0, 0, 7);
        ctx.fill();
        ctx.restore();
      }
      drawLantern(ctx, q, i, open, t);
      var hold = q.y;
      q.y = q.chipY != null ? q.chipY : q.seat - 28;
      drawLight(ctx, q, "ainsley");
      q.chipY = q.y;
      q.y = hold;
    });
    var anchor = creatureAnchor(W, H);
    var jx = anchor.cx, jy = anchor.jy + anchor.jh * 0.42;
    if (feed && shown[feed.index]) {
      var fq = shown[feed.index];
      feedDrops(ctx, t, feed.t0, fq.x, fq.ledY || fq.seat, jx, jy);
      if (t < feed.t0 + 4.2) fullCard(ctx, feed.label || fq.label, W, H, "ainsley");
      burst(ctx, t, feed.t0, fq.x, fq.ledY || fq.seat, "#ffd0a4");
    }
    warmth(ctx, W, H, fill);
    return shown;
  }
  function oriBook(world, W, H) {
    var pack = plates[world];
    if (!pack) return null;
    var orient = orientFor(W, H);
    var book = pack[orient];
    var skyPlate = book && book.sky;
    if (skyPlate && /assets\/ori\//.test(skyPlate.src || "")) return book;
    return null;
  }
  function layerShift(id, man) {
    var layers = (man && man.layers) || [];
    for (var i = 0; i < layers.length; i++) if (layers[i].id === id) return layers[i].parallax;
    return id === "fg" ? 1 : 0.3;
  }
  function softBloom(ctx, x, y, r, col) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    var g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  function godRays(ctx, W, H, t, world) {
    if (reduced) return;
    var tint = world === "harris" ? "186, 236, 196" : world === "ainsley" ? "255, 198, 154" : "255, 228, 186";
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (var i = 0; i < 4; i++) {
      var pulse = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * 0.45 + i * 1.7));
      var x = W * (0.1 + i * 0.24) + Math.sin(t * 0.15 + i) * 12;
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(-0.18 + Math.sin(t * 0.2 + i) * 0.03);
      var g = ctx.createLinearGradient(0, 0, 18, H * 0.7);
      g.addColorStop(0, "rgba(" + tint + "," + (0.2 * pulse).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + tint + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(-8, 0, 22 + (i % 3) * 10, H * 0.66);
      ctx.restore();
    }
    ctx.restore();
  }
  function waterShimmer(ctx, W, H, t) {
    if (reduced) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 226, 190, 0.9)";
    for (var i = 0; i < 6; i++) {
      var y = H * (0.56 + i * 0.045);
      ctx.globalAlpha = 0.12 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 0.8));
      ctx.beginPath();
      ctx.moveTo(W * 0.08, y);
      for (var s = 1; s <= 8; s++) {
        var x = W * (0.08 + (s / 8) * 0.84);
        ctx.lineTo(x, y + Math.sin(t * 1.7 + s * 0.65 + i) * 3.2);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function creaturePose(t) {
    if (!feed) return { a: "idle", b: "idle", u: 1 };
    var age = t - feed.t0;
    if (age < 0.35) return { a: "idle", b: "happy", u: age / 0.35 };
    if (age < 0.95) return { a: "happy", b: "happy", u: 1 };
    if (age < 1.3) return { a: "happy", b: "fed", u: (age - 0.95) / 0.35 };
    if (age < 2.6) return { a: "fed", b: "fed", u: 1 };
    if (age < 3.0) return { a: "fed", b: "idle", u: (age - 2.6) / 0.4 };
    return { a: "idle", b: "idle", u: 1 };
  }
  function drawOriCreature(ctx, W, H, t) {
    if (!oriCreature.idle) return false;
    var box = creatureAnchor(W, H);
    var pose = creaturePose(t);
    var resting = pose.a === "idle" && pose.b === "idle";
    var breath = Math.sin(t * 1.7);
    var squash = resting ? breath : breath * 0.28;
    var sx = 1 + squash * 0.04;
    var sy = 1 - squash * 0.055;
    var draw = box.draw;
    var bottom = box.foot + draw * 0.04;
    function blit(img, alpha) {
      if (!img || alpha <= 0.02) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(box.cx, bottom);
      ctx.scale(sx, sy);
      ctx.drawImage(img, -draw / 2, -draw, draw, draw);
      ctx.restore();
    }
    var same = pose.a === pose.b;
    var sa = same ? 1 : 1 - pose.u;
    var sb = same ? 0 : pose.u;
    blit(oriCreature[pose.a + "Shadow"] || oriCreature.idleShadow, sa);
    blit(oriCreature[pose.b + "Shadow"] || oriCreature.idleShadow, sb);
    blit(oriCreature[pose.a] || oriCreature.idle, sa);
    blit(oriCreature[pose.b] || oriCreature.idle, sb);
    return true;
  }
  function paintOri(ctx, W, H, t, pan, quests, fill, world) {
    var book = oriBook(world, W, H);
    var man = (global.HousePlates && HousePlates[world]) || {};
    if (!book || !book.sky) sky(ctx, W, H, [[0, "#102028"], [0.55, "#243428"], [1, "#121610"]]);
    ["sky", "far", "mid", "near"].forEach(function (id) {
      var img = book && book[id];
      if (!img || img.width < 64) return;
      var p = layerShift(id, man);
      var drift = reduced ? 0 : Math.sin(t * 0.12 + p * 5) * 3;
      drawPlate(ctx, img, W, H, pan.x * p + drift, pan.y * p * 0.45, PLATE_ZOOM, 1, 0);
      if (id === "sky") godRays(ctx, W, H, t, world);
    });
    if (world === "ainsley") waterShimmer(ctx, W, H, t);
    motes(ctx, W, H, t, pan.x, world === "ainsley" ? "#ffd8c0" : world === "harris" ? "#e7ffe4" : "#fff1d0", reduced ? 8 : 24);
    var cap = (man.landmarks && man.landmarks.length) || quests.length;
    var shown = quests.slice(0, cap);
    layoutLedges(shown, W, H, world, pan.x);
    var bloom = world === "harris" ? "rgba(176, 255, 196, 0.7)" : world === "ainsley" ? "rgba(255, 190, 130, 0.72)" : "rgba(255, 214, 156, 0.75)";
    shown.forEach(function (q, i) {
      var open = q.done || (feed && feed.index === i && t < feed.t0 + 2.4);
      softBloom(ctx, q.x, q.seat - 10, open ? 72 : 46, bloom);
      if (world === "hayes") drawChest(ctx, q, open, t);
      else if (world === "harris") drawOre(ctx, q, i, open, t);
      else {
        if (q.kind === "water") {
          ctx.save();
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = "rgba(255, 196, 140, 0.55)";
          ctx.beginPath();
          ctx.ellipse(q.x, q.seat + 16, 18, 5, 0, 0, 7);
          ctx.fill();
          ctx.restore();
        }
        drawLantern(ctx, q, i, open, t);
      }
      var hold = q.y;
      q.y = q.chipY != null ? q.chipY : q.seat - 28;
      drawLight(ctx, q, world);
      q.chipY = q.y;
      q.y = hold;
    });
    var fg = book && book.fg;
    if (fg && fg.width >= 64) {
      var fp = layerShift("fg", man);
      var sway = reduced ? 0 : Math.sin(t * 0.9) * 0.016;
      ctx.save();
      ctx.translate(W / 2, H);
      ctx.transform(1, 0, sway, 1, 0, 0);
      ctx.translate(-W / 2, -H);
      drawPlate(ctx, fg, W, H, pan.x * fp, pan.y * fp * 0.35, PLATE_ZOOM, 1, 0);
      ctx.restore();
    }
    if (!reduced) motes(ctx, W, H, t * 0.85 + 4, pan.x * 0.4, "#fff6e0", 8);
    drawOriCreature(ctx, W, H, t);
    var anchor = creatureAnchor(W, H);
    if (feed && shown[feed.index]) {
      var fq = shown[feed.index];
      feedDrops(ctx, t, feed.t0, fq.x, fq.ledY || fq.y, anchor.cx, anchor.jy + anchor.jh * 0.45);
      if (t < feed.t0 + 4.2) fullCard(ctx, feed.label || fq.label, W, H, world);
      burst(ctx, t, feed.t0, fq.x, fq.ledY || fq.seat, world === "harris" ? "#d8ffc4" : "#ffe7a8");
    }
    warmth(ctx, W, H, fill);
    return shown;
  }
  function paintWorld(ctx, W, H, t, which, quests, fill, px) {
    var world = which === "harris" || which === "ainsley" ? which : "hayes";
    var pan = px && typeof px === "object" ? px : { x: px || 0, y: 0 };
    if (oriBook(world, W, H)) return paintOri(ctx, W, H, t, pan, quests || [], fill || 0, world) || [];
    if (world === "harris") return paintGrove(ctx, W, H, t, pan.x, quests || [], fill || 0) || [];
    if (world === "ainsley") return paintLake(ctx, W, H, t, pan.x, quests || [], fill || 0) || [];
    return paintKid(ctx, W, H, t, pan.x, quests || [], fill || 0, world) || [];
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
    this.hits = paintWorld(this.ctx, W, H, t, which || kid(), quests, st.fill || 0, parallaxNow(t, false));
    var jhost = document.querySelector("[data-kw-jar]");
    if (jhost && jhost._jar && jhost._jar.setEnv) {
      var skyPlate = plates[which || kid()] && plates[which || kid()].sky;
      jhost._jar.setEnv(skyPlate || this.cv);
    }
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
    markJarVisual();
  }
  function hitQuest(ev) {
    if (!bg || !bg.hits) return null;
    var rect = bg.cv.getBoundingClientRect();
    var x = (ev.clientX - rect.left) * ((bg.cv.width / bg.dpr) / Math.max(1, rect.width));
    var y = (ev.clientY - rect.top) * ((bg.cv.height / bg.dpr) / Math.max(1, rect.height));
    for (var i = 0; i < bg.hits.length; i++) {
      var q = bg.hits[i];
      var hw = (q.hw || q.r || 40) / 2 + 8;
      var hh = (q.hh || q.r || 28) / 2 + 8;
      var cy = q.chipY != null ? q.chipY : q.y;
      if (Math.abs(q.x - x) <= hw && Math.abs(cy - y) <= hh) return q;
    }
    return null;
  }
  function onWorldDown(ev) {
    if (!ev.isTrusted) return;
    var q = hitQuest(ev);
    if (!q || !q.btn) return;
    var was = q.btn.classList.contains("done");
    var idx = 0;
    for (var hi = 0; hi < bg.hits.length; hi++) if (bg.hits[hi] === q) idx = hi;
    feed = { t0: (performance.now() - bg.t0) / 1000, index: idx, label: q.label };
    q.btn.click();
    burstAt = feed.t0;
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
    global.addEventListener("deviceorientation", function (ev) {
      if (ev.gamma == null) return;
      gyro.gamma = ev.gamma;
      if (ev.beta != null) gyro.beta = ev.beta;
      gyro.on = true;
    }, true);
    global.addEventListener("resize", function () { if (bg) bg.resize(); });
    document.addEventListener("house:kid-rendered", function () {
      paintWeek();
      mountJar();
      soften();
      if (global.JarEngine && JarEngine.choreState(kid()).asleep) document.body.classList.add("kw-asleep");
    });
    loadPlates();
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
    if (exportFrame.skipTap) {
      feed = null;
    } else if (t < 4) {
      exportFrame.tapped = false;
      feed = null;
    }
    if (!exportFrame.skipTap && t >= 4 && !exportFrame.tapped && quests[0] && quests[0].btn && !quests[0].done) {
      exportFrame.tapped = true;
      feed = { t0: 4, index: 0, label: quests[0].label };
      quests[0].btn.click();
      quests = readQuests(iso);
    }
    burstAt = !exportFrame.skipTap && t >= 4 ? 4 : -1;
    var st = global.JarEngine ? JarEngine.choreState(kid()) : { fill: 0 };
    if (global.JarEngine && JarEngine.setVirtual) JarEngine.setVirtual(t * 1000);
    paintWorld(ctx, cssW, cssH, t, kid(), quests, st.fill || 0, parallaxNow(t, true));
    var host = document.querySelector("[data-kw-jar]");
    if (!oriCreature.idle && host && host._jar) {
      if (host._jar.cv.width !== 280 || host._jar.cv.height !== 320) {
        host._jar.cv.width = 280;
        host._jar.cv.height = 320;
        if (host._jar.useGL && host._jar.initGL) host._jar.initGL();
      }
      host._jar.dpr = 2;
      if (host._jar.setEnv) {
        var skyPlate = plates[kid()] && plates[kid()].sky;
        host._jar.setEnv(skyPlate || canvas);
      }
      host._jar.frame();
      if (host._jar.cv && host._jar.cv.width) {
        var box = creatureAnchor(cssW, cssH);
        var footY = box.jy + box.jh * 0.88;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(box.cx, footY + 2, box.jw * 0.2, 6, 0, 0, 7);
        ctx.clip();
        ctx.translate(box.cx, footY);
        ctx.scale(1, -0.16);
        ctx.globalAlpha = 0.18;
        ctx.drawImage(host._jar.cv, -box.jw / 2, 0, box.jw, box.jh);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.ellipse(box.cx, footY, box.jw * 0.22, 4.5, 0, 0, 7);
        ctx.fill();
        ctx.drawImage(host._jar.cv, box.jx, box.jy, box.jw, box.jh);
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

  function lanternPoint(i, W, H, t) {
    var u = i / 6;
    var x = W * (0.08 + u * 0.5) + Math.sin(t * 0.2 + i) * 2;
    var y = H * (0.8 + Math.sin(u * Math.PI * 1.35) * 0.045);
    return { x: x, y: y };
  }
  function paintLanternWeek(ctx, W, H, t) {
    var meta = weekMeta();
    var days = meta.length === 7 ? meta : [
      { letter: "S" }, { letter: "M" }, { letter: "T" }, { letter: "W" },
      { letter: "T" }, { letter: "F" }, { letter: "S" }
    ];
    var today = -1;
    for (var n = 0; n < days.length; n++) if (days[n].today) today = n;
    if (today < 0) {
      try {
        var name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short" }).format(new Date());
        var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        today = map[name] != null ? map[name] : 4;
      } catch (e) { today = 4; }
    }
    var pts = [];
    for (var i = 0; i < 7; i++) pts.push(lanternPoint(i, W, H, t));
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach(function (p, i) {
      var gy = p.y + 26;
      if (i === 0) ctx.moveTo(p.x, gy);
      else ctx.quadraticCurveTo((pts[i - 1].x + p.x) / 2, Math.max(pts[i - 1].y, p.y) + 34, p.x, gy);
    });
    ctx.strokeStyle = "rgba(36, 24, 14, 0.78)";
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.strokeStyle = "rgba(196, 156, 98, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    pts.forEach(function (p, i) {
      var state = i < today ? "past" : i === today ? "today" : "later";
      if (state === "later") {
        ctx.save();
        ctx.globalAlpha = 0.55;
        var mist = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 36);
        mist.addColorStop(0, "rgba(210, 214, 220, 0.45)");
        mist.addColorStop(1, "rgba(180, 186, 196, 0)");
        ctx.fillStyle = mist;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 4, 34, 22, 0, 0, 7);
        ctx.fill();
        ctx.restore();
      }
      var glowR = state === "today" ? 34 : state === "past" ? 16 : 12;
      var g = ctx.createRadialGradient(p.x, p.y - 4, 1, p.x, p.y - 2, glowR);
      if (state === "today") {
        g.addColorStop(0, "rgba(255, 246, 214, 0.98)");
        g.addColorStop(0.45, "rgba(255, 176, 70, 0.62)");
        g.addColorStop(1, "rgba(255, 140, 40, 0)");
      } else if (state === "past") {
        g.addColorStop(0, "rgba(255, 150, 70, 0.55)");
        g.addColorStop(1, "rgba(120, 40, 16, 0)");
      } else {
        g.addColorStop(0, "rgba(220, 224, 230, 0.28)");
        g.addColorStop(1, "rgba(200, 206, 214, 0)");
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 2, glowR, 0, 7);
      ctx.fill();
      ctx.fillStyle = state === "later" ? "rgba(90, 86, 80, 0.55)" : "#4a3424";
      ctx.fillRect(p.x - 1.2, p.y + 8, 2.4, 16);
      ctx.fillStyle = state === "today" ? "#f6d7a4" : state === "past" ? "#6a4630" : "rgba(120, 114, 108, 0.45)";
      ctx.beginPath();
      ctx.moveTo(p.x - 8, p.y - 10);
      ctx.lineTo(p.x + 8, p.y - 10);
      ctx.lineTo(p.x + 6, p.y + 8);
      ctx.lineTo(p.x - 6, p.y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = state === "today" ? "rgba(255, 236, 200, 0.9)" : "rgba(80, 60, 40, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (state === "today") {
        ctx.fillStyle = "#fff6d4";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 1, 2.2, 5 + Math.sin(t * 6) * 0.8, 0, 0, 7);
        ctx.fill();
      } else if (state === "past") {
        ctx.fillStyle = "rgba(255, 120, 50, 0.85)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.1, 0, 7);
        ctx.fill();
      }
      ctx.font = "600 12px Palatino, Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(10, 8, 6, 0.8)";
      ctx.shadowColor = "rgba(6, 4, 2, 0.85)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = state === "later" ? "rgba(236, 232, 226, 0.55)" : "rgba(255, 248, 236, 0.96)";
      var letter = days[i].letter || "·";
      ctx.strokeText(letter, p.x, p.y + 36);
      ctx.shadowBlur = 0;
      ctx.fillText(letter, p.x, p.y + 36);
    });
    ctx.restore();
  }
  function exportCalendar(t, cssW, cssH, dpr) {
    cssW = cssW || 440;
    cssH = cssH || 956;
    dpr = dpr || 2;
    exportFrame.skipTap = true;
    var canvas = exportFrame(t, cssW, cssH, dpr);
    exportFrame.skipTap = false;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintLanternWeek(ctx, cssW, cssH, t);
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
    exportCalendar: exportCalendar,
    paintWorld: paintWorld,
    platesReady: function () {
      var id = (document.body && document.body.getAttribute("data-kid")) || "hayes";
      return platesReady && !!(plates[id] && plates[id].sky);
    }
  };
})(window);
