/* jar-engine.js · shared chore-jar creature
   Glossy liquid metal in the kid's color. Simmers when low, boils as it fills,
   boils over when the week's musts are complete. Hungry (a due chore, Dad week
   only) drops the boil, wobbles the glass, and rattles the lid.
   No dollars, scores, or shame language. Mom weeks: the creature rests.
   Original drawing only. Theme notes live in comments. */
(function (global) {
  "use strict";

  var COLORS = {
    hayes: { metal: [198, 206, 216], deep: [8, 10, 14], lip: [230, 236, 242], name: "Hayes" },
    harris: { metal: [196, 208, 202], deep: [8, 12, 10], lip: [228, 236, 230], name: "Harris" },
    ainsley: { metal: [210, 204, 198], deep: [12, 10, 10], lip: [236, 230, 224], name: "Ainsley" }
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

  function lowTier() {
    try {
      if (/(?:\?|&)tier=low(?:&|$)/.test(location.search)) return true;
      var ua = navigator.userAgent || "";
      var phone = /iPhone|iPod|Android.+Mobile/i.test(ua);
      if (!phone) return false;
      if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    } catch (e) {}
    return false;
  }

  var VERT = "attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}";
  var FRAG = [
    "precision mediump float;",
    "uniform vec2 uRes;uniform float uTime;uniform float uFill;uniform float uEnergy;",
    "uniform float uPoke;uniform vec2 uLook;uniform vec3 uMetal;uniform float uAsleep;",
    "uniform sampler2D uEnv;",
    "float sdEll(vec2 p,vec2 r){return (length(p/r)-1.0)*min(r.x,r.y);}",
    "float smin(float a,float b,float k){float h=max(k-abs(a-b),0.0)/k;return min(a,b)-h*h*k*0.25;}",
    "float field(vec2 q){",
    "  float t=uTime*(uAsleep>0.5?0.35:1.0);",
    "  float breathe=1.0+sin(t*1.15)*0.028;",
    "  float d=sdEll(q-vec2(0.0,-0.04),vec2(0.42,0.50)*breathe);",
    "  d=smin(d,sdEll(q-vec2(sin(t*0.7)*0.012,0.30),vec2(0.22,0.20)),0.16);",
    "  vec2 boil=vec2(sin(t*1.35)*0.14,cos(t*0.9)*0.08-0.06);",
    "  d=smin(d,length(q-boil)-(0.055+uEnergy*0.012),0.11);",
    "  vec2 drop=vec2(sin(t)*0.04,mix(0.78,0.18,clamp(uPoke,0.0,1.0)));",
    "  d=smin(d,length(q-drop)-mix(0.02,0.11,clamp(uPoke,0.0,1.0)),0.02+0.14*clamp(uPoke,0.0,1.0));",
    "  return d;",
    "}",
    "void main(){",
    "  vec2 q=(gl_FragCoord.xy/uRes)*2.0-1.0;",
    "  q.x*=uRes.x/max(uRes.y,1.0);",
    "  q.y=-q.y;",
    "  q*=0.82;",
    "  float d=field(q);",
    "  if(d>0.012) discard;",
    "  vec2 e=vec2(0.004,0.0);",
    "  float dx=field(q+e.xy)-field(q-e.xy);",
    "  float dy=field(q+e.yx)-field(q-e.yx);",
    "  vec3 N=normalize(vec3(dx,dy,0.055));",
    "  vec3 V=vec3(0.0,0.0,1.0);",
    "  vec3 R=reflect(vec3(-N.xy,0.15),N);",
    "  vec2 uv=clamp(0.5+R.xy*vec2(0.48,0.36),0.0,1.0);",
    "  vec3 world=texture2D(uEnv,uv).rgb;",
    "  float luma=dot(world,vec3(0.299,0.587,0.114));",
    "  vec3 refl=mix(world,vec3(luma),0.62);",
    "  refl=mix(vec3(0.03,0.035,0.045),refl*0.62,0.82);",
    "  float hy=uv.y;",
    "  float lineA=smoothstep(0.47,0.488,hy)*(1.0-smoothstep(0.50,0.518,hy));",
    "  vec3 L=normalize(vec3(-0.28,0.74,0.58));",
    "  float spec=pow(max(dot(reflect(-L,N),V),0.0),80.0);",
    "  float fres=pow(clamp(1.0-max(N.z,0.0),0.0,1.0),5.5);",
    "  vec3 metal=vec3(0.74,0.77,0.82);",
    "  vec3 col=mix(refl,metal,0.18);",
    "  col+=vec3(1.0)*lineA*0.55;",
    "  col=min(col,vec3(0.78));",
    "  col+=vec3(1.0)*spec;",
    "  col+=fres*vec3(0.72,0.82,0.96)*0.38;",
    "  col=clamp(col,0.0,1.0);",
    "  float edge=smoothstep(0.012,-0.02,d);",
    "  float shut=uAsleep>0.5?2.4:1.0;",
    "  vec2 eyeL=vec2(-0.07,0.33)+uLook*0.012;",
    "  vec2 eyeR=vec2(0.07,0.33)+uLook*0.012;",
    "  float el=length((q-eyeL)*vec2(1.5,shut*1.35));",
    "  float er=length((q-eyeR)*vec2(1.5,shut*1.35));",
    "  float eyes=smoothstep(0.034,0.02,min(el,er))*edge;",
    "  col=mix(col,vec3(0.03,0.04,0.06),eyes);",
    "  float catch=smoothstep(0.012,0.004,min(el,er));",
    "  col=mix(col,vec3(0.95,0.97,0.98),catch*0.85);",
    "  float a=smoothstep(0.012,-0.008,d);",
    "  gl_FragColor=vec4(col,a);",
    "}"
  ].join("\n");

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      compile.err = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
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
    this.gl = null;
    this.useGL = false;
    this.glReason = "";
    this.envCv = document.createElement("canvas");
    this.envCv.width = 256;
    this.envCv.height = 256;
    this.envCtx = this.envCv.getContext("2d", { alpha: false });
    var glAttr = { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true };
    if (!lowTier()) {
      try {
        this.gl = this.cv.getContext("webgl", glAttr) || this.cv.getContext("experimental-webgl", glAttr);
      } catch (eGl) {
        this.gl = null;
        this.glReason = String(eGl && eGl.message || eGl);
      }
      if (!this.gl && !this.glReason) this.glReason = "no-context";
    } else this.glReason = "low-tier";
    if (this.gl && this.initGL()) this.useGL = true;
    else {
      if (this.gl && !this.useGL) this.glReason = compile.err || this.linkErr || "shader";
      this.gl = null;
      this.cv = document.createElement("canvas");
      this.cv.className = "je-jar-cv";
      this.cv.setAttribute("role", "img");
      this.cv.setAttribute("aria-label", this.col.name + " jar");
      this.ctx = this.cv.getContext("2d", { alpha: true });
      this.cssFallback = true;
      host.classList.add("je-css");
    }
    host.appendChild(this.cv);
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

  Jar.prototype.initGL = function () {
    var gl = this.gl;
    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.linkErr = gl.getProgramInfoLog(prog) || "link";
      return false;
    }
    this.prog = prog;
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 40, 50, 255]));
    this.loc = {
      aPos: gl.getAttribLocation(prog, "aPos"),
      uRes: gl.getUniformLocation(prog, "uRes"),
      uTime: gl.getUniformLocation(prog, "uTime"),
      uFill: gl.getUniformLocation(prog, "uFill"),
      uEnergy: gl.getUniformLocation(prog, "uEnergy"),
      uPoke: gl.getUniformLocation(prog, "uPoke"),
      uLook: gl.getUniformLocation(prog, "uLook"),
      uMetal: gl.getUniformLocation(prog, "uMetal"),
      uAsleep: gl.getUniformLocation(prog, "uAsleep"),
      uEnv: gl.getUniformLocation(prog, "uEnv")
    };
    return true;
  };

  Jar.prototype.setEnv = function (source) {
    if (!source || !this.envCtx) return;
    try {
      this.envCtx.drawImage(source, 0, 0, 256, 256);
      this.envDirty = true;
    } catch (e) {}
  };

  Jar.prototype.glFrame = function (st, t, energy) {
    var gl = this.gl;
    if (!gl) return;
    var poke = this.pokeT ? Math.max(0, 1 - (nowMs() - this.pokeT) / 980) : 0;
    gl.viewport(0, 0, this.cv.width, this.cv.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(this.loc.aPos);
    gl.vertexAttribPointer(this.loc.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (this.envDirty) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.envCv);
      this.envDirty = false;
    }
    gl.uniform1i(this.loc.uEnv, 0);
    gl.uniform2f(this.loc.uRes, this.cv.width, this.cv.height);
    gl.uniform1f(this.loc.uTime, t * (st.asleep ? 0.35 : 1));
    gl.uniform1f(this.loc.uFill, this.display);
    gl.uniform1f(this.loc.uEnergy, energy);
    gl.uniform1f(this.loc.uPoke, poke);
    gl.uniform2f(this.loc.uLook, this.look.x, this.look.y);
    gl.uniform3f(this.loc.uMetal, this.col.metal[0], this.col.metal[1], this.col.metal[2]);
    gl.uniform1f(this.loc.uAsleep, st.asleep ? 1 : 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  Jar.prototype.resize = function () {
    var r = this.host.getBoundingClientRect();
    var w = Math.max(80, r.width || 220);
    var h = Math.max(120, r.height || 280);
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var nw = Math.round(w * dpr);
    var nh = Math.round(h * dpr);
    if (this.cv.width !== nw || this.cv.height !== nh) {
      this.cv.width = nw;
      this.cv.height = nh;
      if (this.useGL) this.initGL();
    }
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

  Jar.prototype.paintFallback = function (st, t, energy) {
    var ctx = this.ctx;
    if (!ctx) return;
    var w = this.cv.width, h = this.cv.height;
    var dpr = this.dpr || 1;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(dpr, dpr);
    var W = w / dpr, H = h / dpr;
    var cx = W * 0.5, cy = H * 0.56;
    var poke = this.pokeT ? Math.max(0, 1 - (nowMs() - this.pokeT) / 980) : 0;
    var k = st.asleep ? 0.35 : 1;
    var s = (0.92 + this.display * 0.2) * (1 + poke * 0.08);
    ctx.translate(cx, cy);
    ctx.scale(1 + poke * 0.12, 1 - poke * 0.16);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(0, 54, 40 * s, 8, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 8, 36 * s, 48 * s, 0, 0, 7);
    ctx.ellipse(Math.sin(t * 0.7 * k) * 2, -34, 20 * s, 18 * s, 0, 0, 7);
    var g = ctx.createRadialGradient(-12, -20, 4, 0, 6, 52 * s);
    g.addColorStop(0, "rgba(186,196,208,0.95)");
    g.addColorStop(0.45, "rgba(28,32,38,0.96)");
    g.addColorStop(1, "rgba(6,8,12,0.98)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.ellipse(-10, -28, 7, 3, -0.6, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(176, 198, 220, 0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 8, 35 * s, 47 * s, 0, 0, 7);
    ctx.stroke();
    ctx.fillStyle = st.asleep ? "rgba(8,10,14,0.9)" : "rgba(12,14,18,0.92)";
    ctx.beginPath();
    ctx.ellipse(-8, -36, 4, st.asleep ? 1.2 : 3.2, 0, 0, 7);
    ctx.ellipse(8, -36, 4, st.asleep ? 1.2 : 3.2, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  };

  Jar.prototype.frame = function () {
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
    var energy = st.asleep ? 0.08 : (st.hungry ? 0.1 : (0.22 + this.display * 0.85));
    if (st.full && !st.asleep) energy = 1.35;
    if (this.useGL) {
      this.glFrame(st, t, energy);
      return;
    }
    this.paintFallback(st, t, energy);
    return;
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
