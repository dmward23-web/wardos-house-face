/* jar-engine.js · shared chore-jar creature
   Glossy liquid metal in the kid's color. Simmers when low, boils as it fills,
   boils over when the week's musts are complete. Hungry (a due chore, Dad week
   only) drops the boil, wobbles the glass, and rattles the lid.
   No dollars, scores, or shame language. Mom weeks: the creature rests.
   Original drawing only. Theme notes live in comments. */
(function (global) {
  "use strict";

  var COLORS = {
    hayes: { metal: [126, 232, 255], deep: [10, 36, 52], lip: [232, 248, 255], name: "Hayes" },
    harris: { metal: [150, 236, 164], deep: [12, 40, 26], lip: [236, 255, 232], name: "Harris" },
    ainsley: { metal: [236, 176, 132], deep: [46, 26, 22], lip: [255, 228, 206], name: "Ainsley" }
  };

  var virtualNow = null;
  function nowMs() { return virtualNow == null ? performance.now() : virtualNow; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")"; }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function reduced() {
    try { return !!(global.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }
  function kidIdOf(id) {
    id = id || (document.body && document.body.getAttribute("data-kid")) || "hayes";
    return COLORS[id] ? id : "hayes";
  }
  function asleepWeek(data) {
    var hw = data && data.homeWeek;
    if (!hw) return false;
    return /mom/i.test(String(hw.with || "") + " " + String(hw.place || ""));
  }

  function choreState(kidId) {
    kidId = kidIdOf(kidId);
    var WK = global.WardKids;
    var data = WK && WK._data;
    var out = { kid: kidId, fill: 0, hungry: false, asleep: false, full: false, done: 0, total: 0, todayDone: 0, todayNeed: 0 };
    if (!WK || !data || !data.kids || !data.kids[kidId]) return out;
    out.asleep = asleepWeek(data);
    var quests = typeof WK.mustQuests === "function" ? (WK.mustQuests(kidId, data) || []) : [];
    var days = typeof WK.weekDayIsos === "function" ? WK.weekDayIsos(WK.DAY_ISO) : [];
    var today = WK.DAY_ISO;
    quests.forEach(function (q) {
      if (!q || q.optional || q.cadence === "addon") return;
      if ((q.cadence || "daily") === "daily") {
        days.forEach(function (iso) {
          out.total += 1;
          var on = typeof WK.getCheck === "function" && WK.getCheck(q.id, data, iso);
          if (on) out.done += 1;
          if (iso === today) {
            out.todayNeed += 1;
            if (on) out.todayDone += 1;
          }
        });
      } else {
        out.total += 1;
        if (typeof WK.getCheck === "function" && WK.getCheck(q.id, data)) out.done += 1;
      }
    });
    out.fill = out.total ? clamp(out.done / out.total, 0, 1) : 0;
    out.full = out.total > 0 && out.done >= out.total;
    out.hungry = !out.asleep && out.todayNeed > 0 && out.todayDone < out.todayNeed;
    return out;
  }

  function audioOut() {
    try {
      if (global.HouseSfx && HouseSfx.isMuted && HouseSfx.isMuted()) return null;
      if (global.HouseSfx && HouseSfx.ensureCtx) {
        var ctx = HouseSfx.ensureCtx();
        var master = HouseSfx.masterGain && HouseSfx.masterGain();
        if (ctx && master) return { ctx: ctx, out: master };
      }
    } catch (e) {}
    return null;
  }

  function tone(kind) {
    var a = audioOut();
    if (!a) return;
    var ctx = a.ctx, t0 = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    var f = kind === "rattle" ? 180 : kind === "over" ? 520 : kind === "gulp" ? 340 : 260;
    o.type = kind === "rattle" ? "square" : "sine";
    o.frequency.setValueAtTime(f, t0);
    if (kind === "gulp") o.frequency.exponentialRampToValueAtTime(520, t0 + 0.12);
    if (kind === "over") o.frequency.exponentialRampToValueAtTime(880, t0 + 0.28);
    var peak = kind === "rattle" ? 0.03 : kind === "over" ? 0.08 : 0.06;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (kind === "over" ? 0.45 : 0.16));
    o.connect(g); g.connect(a.out);
    o.start(t0); o.stop(t0 + 0.5);
    if (kind === "rattle") {
      try {
        var n = ctx.createBuffer(1, 2200, ctx.sampleRate);
        var d = n.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        var s = ctx.createBufferSource();
        var bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.7;
        var ng = ctx.createGain();
        ng.gain.setValueAtTime(0.04, t0);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
        s.buffer = n; s.connect(bp); bp.connect(ng); ng.connect(a.out); s.start(t0);
      } catch (e2) {}
    }
  }

  function Jar(host, opts) {
    opts = opts || {};
    this.kid = kidIdOf(opts.kid);
    this.col = COLORS[this.kid];
    this.getState = opts.getState || function () { return choreState(this.kid); }.bind(this);
    this.onTap = opts.onTap || null;
    this.host = host;
    this.cv = document.createElement("canvas");
    this.cv.className = "je-jar-cv";
    this.cv.setAttribute("role", "img");
    this.cv.setAttribute("aria-label", this.col.name + " jar");
    host.appendChild(this.cv);
    this.ctx = this.cv.getContext("2d", { alpha: true });
    this.t0 = nowMs();
    this.look = { x: 0, y: 0 };
    this.bubbles = [];
    for (var i = 0; i < 16; i++) this.bubbles.push({ u: Math.random(), x: 0.15 + Math.random() * 0.7, r: 1.5 + Math.random() * 3.2, sp: 0.12 + Math.random() * 0.45 });
    this.drips = [];
    this.blink = 0;
    this.nextBlink = 2.4;
    this.display = 0;
    this.lastFill = -1;
    this.rattleAt = 0;
    this.alive = true;
    this.reduced = reduced();
    var self = this;
    this._move = function (e) {
      var r = self.cv.getBoundingClientRect();
      self.look.x = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
      self.look.y = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
    };
    this._tap = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      self.poke();
      if (self.onTap) self.onTap(self, e);
    };
    global.addEventListener("pointermove", this._move, { passive: true });
    this.cv.addEventListener("click", this._tap);
    this._ro = global.ResizeObserver ? new ResizeObserver(function () { self.resize(); }) : null;
    if (this._ro) this._ro.observe(host);
    this.resize();
    this.loop();
  }

  Jar.prototype.resize = function () {
    var r = this.host.getBoundingClientRect();
    var w = Math.max(80, r.width || 220);
    var h = Math.max(120, r.height || 280);
    var dpr = Math.min(1.5, global.devicePixelRatio || 1);
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + "px";
    this.cv.style.height = h + "px";
    this.dpr = dpr;
  };

  Jar.prototype.poke = function () {
    this.pokeT = performance.now();
    tone("gulp");
  };

  Jar.prototype.destroy = function () {
    this.alive = false;
    global.removeEventListener("pointermove", this._move);
    if (this._ro) this._ro.disconnect();
    if (this.cv && this.cv.parentNode) this.cv.parentNode.removeChild(this.cv);
  };

  Jar.prototype.loop = function () {
    var self = this;
    if (!this.alive) return;
    this.frame();
    if (this.reduced) return;
    if (document.hidden) {
      this._raf = setTimeout(function () { self.loop(); }, 240);
      return;
    }
    this._raf = requestAnimationFrame(function () { self.loop(); });
  };

  Jar.prototype.frame = function () {
    var ctx = this.ctx;
    if (!ctx) return;
    var w = this.cv.width, h = this.cv.height;
    var t = (nowMs() - this.t0) / 1000;
    var st = this.getState() || choreState(this.kid);
    var target = st.fill || 0;
    if (this.reduced) this.display = target;
    else this.display = lerp(this.display, target, 0.08);
    if (this.lastFill >= 0 && target > this.lastFill + 0.001) {
      if (virtualNow == null) {
        tone("gulp");
        if (st.full) tone("over");
      }
      this.pokeT = nowMs();
    }
    this.lastFill = target;
    if (st.hungry && !this.reduced && virtualNow == null && t - this.rattleAt > 2.6) {
      this.rattleAt = t;
      tone("rattle");
    }
    this.blink -= 1 / 60;
    if (this.blink < -this.nextBlink) { this.blink = 0.14; this.nextBlink = 2.2 + Math.random() * 3; }

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    var W = w / this.dpr, H = h / this.dpr;
    var wob = st.hungry && !this.reduced ? Math.sin(t * 22) * 2.4 : Math.sin(t * 1.3) * 0.6;
    if (st.asleep) wob *= 0.25;
    ctx.translate(wob, 0);

    var cx = W * 0.5;
    var top = H * 0.16;
    var bot = H * 0.86;
    var jw = W * 0.34;
    var neck = jw * 0.62;
    var energy = st.asleep ? 0.08 : (st.hungry ? 0.1 : (0.22 + this.display * 0.85));
    if (st.full && !st.asleep) energy = 1.35;
    var amp = (st.hungry ? 1.2 : 2.2 + energy * 7) * (this.reduced ? 0.2 : 1);

    /* halo */
    var halo = ctx.createRadialGradient(cx, (top + bot) / 2, 10, cx, (top + bot) / 2, jw * 2.1);
    halo.addColorStop(0, rgba(this.col.metal, 0.28 + energy * 0.12));
    halo.addColorStop(1, rgba(this.col.metal, 0));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, (top + bot) / 2, jw * 2.1, 0, Math.PI * 2); ctx.fill();

    function jarPath(inset) {
      var hw = jw - inset, nh = neck - inset * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx - nh, top);
      ctx.lineTo(cx + nh, top);
      ctx.quadraticCurveTo(cx + hw * 0.72, top + 18, cx + hw, top + 48);
      ctx.lineTo(cx + hw * 0.96, bot - 36);
      ctx.quadraticCurveTo(cx + hw * 0.92, bot, cx, bot);
      ctx.quadraticCurveTo(cx - hw * 0.92, bot, cx - hw * 0.96, bot - 36);
      ctx.lineTo(cx - hw, top + 48);
      ctx.quadraticCurveTo(cx - hw * 0.72, top + 18, cx - nh, top);
      ctx.closePath();
    }

    /* contact shadow */
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(cx, bot + 10, jw * 0.72, 8, 0, 0, Math.PI * 2); ctx.fill();

    /* glass back */
    jarPath(0);
    var glass = ctx.createLinearGradient(cx - jw, top, cx + jw, bot);
    glass.addColorStop(0, "rgba(255,255,255,0.16)");
    glass.addColorStop(0.4, "rgba(180,210,230,0.05)");
    glass.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = glass;
    ctx.fill();

    /* mercury */
    ctx.save();
    jarPath(3);
    ctx.clip();
    var level = bot - (bot - (top + 36)) * this.display;
    var surfAmp = amp;
    ctx.beginPath();
    ctx.moveTo(cx - jw - 4, bot + 8);
    ctx.lineTo(cx + jw + 4, bot + 8);
    var steps = 28;
    for (var i = steps; i >= 0; i--) {
      var x = cx - jw + (2 * jw) * (i / steps);
      var y = level + Math.sin(x * 0.09 + t * (2 + energy * 3)) * surfAmp + Math.sin(x * 0.17 - t * 2.2) * surfAmp * 0.45;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    var mg = ctx.createLinearGradient(cx, level, cx, bot);
    var deep = mix(this.col.deep, this.col.metal, 0.25 + this.display * 0.35);
    var hot = mix(this.col.metal, [255, 255, 255], 0.35 + energy * 0.15);
    mg.addColorStop(0, rgba(hot, 0.95));
    mg.addColorStop(0.18, rgba(this.col.metal, 0.92));
    mg.addColorStop(1, rgba(deep, 1));
    ctx.fillStyle = mg;
    ctx.fill();

    /* moving chrome band */
    var bandX = cx + Math.sin(t * 0.8) * jw * 0.35;
    var band = ctx.createLinearGradient(bandX - 18, level, bandX + 22, bot);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.5, "rgba(255,255,255," + (0.28 + energy * 0.12) + ")");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = band;
    ctx.fillRect(cx - jw, level - 8, jw * 2, bot - level + 12);

    /* bubbles */
    var boil = energy * (this.reduced ? 0 : 1);
    for (var b = 0; b < this.bubbles.length; b++) {
      var bb = this.bubbles[b];
      bb.u += bb.sp * (0.15 + boil) * 0.016;
      if (bb.u > 1) bb.u = 0;
      if (this.display < 0.04) continue;
      var bx = cx - jw * 0.7 + bb.x * jw * 1.4;
      var by = bot - 8 - bb.u * (bot - level - 6);
      if (by > level + 4) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255," + (0.25 + boil * 0.35) + ")";
        ctx.lineWidth = 1.2;
        ctx.arc(bx, by, bb.r * (0.6 + boil), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    /* glass rim + highlight */
    jarPath(0);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 3;
    ctx.moveTo(cx - jw * 0.55, top + 50);
    ctx.quadraticCurveTo(cx - jw * 0.72, (top + bot) / 2, cx - jw * 0.42, bot - 30);
    ctx.stroke();

    /* boil-over drips */
    if (st.full && !st.asleep && !this.reduced) {
      if (Math.random() < 0.25 && this.drips.length < 8) {
        this.drips.push({ x: cx + (Math.random() - 0.5) * neck, y: top + 8, v: 30 + Math.random() * 40, a: 1 });
      }
    }
    for (var d = this.drips.length - 1; d >= 0; d--) {
      var dp = this.drips[d];
      dp.y += dp.v * 0.016;
      dp.a -= 0.01;
      ctx.fillStyle = rgba(this.col.metal, Math.max(0, dp.a));
      ctx.beginPath(); ctx.ellipse(dp.x, dp.y, 3.2, 6, 0, 0, Math.PI * 2); ctx.fill();
      if (dp.a <= 0 || dp.y > bot) this.drips.splice(d, 1);
    }

    /* lid */
    var lidW = neck * 1.35, lidH = 14;
    var shake = st.hungry && !this.reduced ? Math.sin(t * 28) * 0.14 : 0;
    ctx.save();
    ctx.translate(cx, top - 2);
    ctx.rotate(shake);
    var poke = this.pokeT ? Math.max(0, 1 - (nowMs() - this.pokeT) / 280) : 0;
    ctx.translate(0, -poke * 6);
    var lg = ctx.createLinearGradient(0, -lidH, 0, 4);
    lg.addColorStop(0, rgba(this.col.lip, 0.95));
    lg.addColorStop(1, rgba(this.col.deep, 0.95));
    ctx.fillStyle = lg;
    roundRect(ctx, -lidW / 2, -lidH, lidW, lidH, 4);
    ctx.fill();
    ctx.fillStyle = rgba(this.col.metal, 0.85);
    roundRect(ctx, -lidW * 0.28, -lidH - 7, lidW * 0.56, 8, 3);
    ctx.fill();
    ctx.restore();

    /* eyes — creature on the glass */
    var eyeY = top + 62;
    var eyeDX = 16;
    var shut = st.asleep || (this.blink > 0 && this.blink < 0.12);
    var lookX = clamp(this.look.x, -1, 1) * 3.2;
    var lookY = clamp(this.look.y, -1, 1) * 2.2;
    if (st.hungry) lookY += 1.5;
    function eye(ex) {
      ctx.save();
      ctx.translate(ex, eyeY);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      if (shut) {
        ctx.strokeStyle = rgba(this.col.lip, 0.9);
        ctx.lineWidth = 2;
        ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, st.asleep ? 3 : -2, 7, 0); ctx.stroke();
      } else {
        ctx.ellipse(0, 0, 7.5, st.hungry ? 8.5 : 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(this.col.deep, 0.95);
        ctx.beginPath(); ctx.arc(lookX, lookY, 3.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath(); ctx.arc(lookX - 1.2, lookY - 1.3, 1.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    eye.call(this, cx - eyeDX);
    eye.call(this, cx + eyeDX);
    /* mouth */
    ctx.strokeStyle = rgba(this.col.lip, 0.75);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (st.full && !st.hungry) {
      ctx.moveTo(cx - 6, eyeY + 16); ctx.quadraticCurveTo(cx, eyeY + 22, cx + 6, eyeY + 16);
    } else if (st.hungry) {
      ctx.moveTo(cx - 5, eyeY + 18); ctx.quadraticCurveTo(cx, eyeY + 15, cx + 5, eyeY + 18);
    } else {
      ctx.moveTo(cx - 4, eyeY + 16); ctx.lineTo(cx + 4, eyeY + 16);
    }
    ctx.stroke();

    ctx.restore();
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function mount(host, opts) {
    if (!host) return null;
    host.setAttribute("data-jar-engine", "1");
    return new Jar(host, opts);
  }

  global.JarEngine = {
    version: "1.0.0",
    COLORS: COLORS,
    choreState: choreState,
    asleepWeek: asleepWeek,
    mount: mount,
    tone: tone,
    setVirtual: function (ms) { virtualNow = ms == null ? null : ms; },
    now: nowMs
  };
})(window);
