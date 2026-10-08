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
  /* Raymarched liquid chrome. Five-sphere smooth union, gentle displacement,
     finite-difference normals, sky plate as an equirect. Not a flat disc. */
  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uTime;",
    "uniform float uFill;",
    "uniform float uEnergy;",
    "uniform float uPoke;",
    "uniform vec2 uLook;",
    "uniform vec3 uMetal;",
    "uniform float uAsleep;",
    "uniform float uBlink;",
    "uniform sampler2D uEnv;",
    "float smin(float a,float b,float k){",
    "  float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);",
    "  return mix(b,a,h)-k*h*(1.0-h);",
    "}",
    "float map(vec3 p){",
    "  float tm=uTime*(uAsleep>0.5?0.35:1.0);",
    "  float br=1.0+sin(tm*1.15)*0.03;",
    "  vec3 q=p;",
    "  q.y*=1.0-uPoke*0.1;",
    "  float d=length(q-vec3(0.0,-0.20,0.0))-(0.28*br);",
    "  d=smin(d,length(q-vec3(0.0,0.26,0.02))-(0.22*br),0.14);",
    "  d=smin(d,length(q-vec3(-0.48,-0.08,-0.02))-0.15,0.07);",
    "  d=smin(d,length(q-vec3(0.40,-0.02,0.14))-0.13,0.07);",
    "  float boil=0.10+uEnergy*0.02+uPoke*0.06;",
    "  d=smin(d,length(q-vec3(0.10,-0.02,0.38))-boil,0.07);",
    "  float n=sin(q.x*5.2+tm*0.6)*sin(q.y*4.4-tm*0.4)*sin(q.z*4.8+1.1);",
    "  d+=n*0.018;",
    "  return d;",
    "}",
    "vec3 calcN(vec3 p){",
    "  float e=0.007;",
    "  vec2 k=vec2(1.0,-1.0);",
    "  return normalize(k.xyy*map(p+k.xyy*e)+k.yyx*map(p+k.yyx*e)+k.yxy*map(p+k.yxy*e)+k.xxx*map(p+k.xxx*e));",
    "}",
    "float march(vec3 ro,vec3 rd){",
    "  float t=0.2;",
    "  for(int i=0;i<36;i++){",
    "    float d=map(ro+rd*t);",
    "    if(d<0.002) return t;",
    "    t+=max(d*0.82,0.004);",
    "    if(t>4.2) return -1.0;",
    "  }",
    "  return -1.0;",
    "}",
    "void main(){",
    "  vec2 q=(gl_FragCoord.xy/uRes)*2.0-1.0;",
    "  q.x*=uRes.x/max(uRes.y,1.0);",
    "  q.y+=0.16;",
    "  vec3 ro=vec3(1.05,0.42,1.7);",
    "  vec3 ta=vec3(0.0,-0.02,0.04);",
    "  vec3 ww=normalize(ta-ro);",
    "  vec3 uu=normalize(cross(ww,vec3(0.0,1.0,0.0)));",
    "  vec3 vv=cross(uu,ww);",
    "  vec3 rd=normalize(uu*q.x*0.46+vv*q.y*0.5+ww*1.35);",
    "  float dist=march(ro,rd);",
    "  if(dist<0.0) discard;",
    "  vec3 p=ro+rd*dist;",
    "  vec3 N=calcN(p);",
    "  vec3 V=-rd;",
    "  vec3 R=reflect(rd,N);",
    "  float lon=atan(R.z,R.x);",
    "  float lat=asin(clamp(R.y,-1.0,1.0));",
    "  vec2 euv=vec2(lon/6.2831853+0.5,lat/3.1415926+0.5);",
    "  vec3 world=texture2D(uEnv,euv).rgb;",
    "  float luma=dot(world,vec3(0.299,0.587,0.114));",
    "  vec3 refl=mix(world,vec3(luma),0.42);",
    "  refl=(refl-vec3(0.5))*1.45+vec3(0.45);",
    "  refl=clamp(refl,0.0,1.0);",
    "  vec3 silver=mix(vec3(0.62,0.64,0.68),uMetal/255.0,0.35);",
    "  float ao=smoothstep(-0.42,0.02,p.y);",
    "  ao=mix(0.22,1.0,ao);",
    "  ao*=mix(0.55,1.0,smoothstep(-0.65,0.15,N.y));",
    "  vec3 col=mix(silver*0.28,refl,0.78)*ao;",
    "  vec3 L=normalize(vec3(-0.35,0.86,0.28));",
    "  float spec=pow(max(dot(N,normalize(L+V)),0.0),96.0);",
    "  vec3 L2=normalize(vec3(0.72,0.08,0.42));",
    "  float spec2=pow(max(dot(N,normalize(L2+V)),0.0),8.0);",
    "  float fres=pow(1.0-max(dot(N,V),0.0),2.6);",
    "  vec3 key=texture2D(uEnv,vec2(0.48,0.62)).rgb;",
    "  float keyL=dot(key,vec3(0.299,0.587,0.114));",
    "  key=max(mix(key,vec3(keyL*1.15,keyL*0.86,keyL*0.48),0.25),vec3(0.72,0.48,0.22));",
    "  col+=spec*vec3(1.0,0.99,0.96);",
    "  col+=spec2*vec3(0.85,0.88,0.92)*0.28;",
    "  col+=fres*key*0.7;",
    "  float shut=mix(1.0,0.08,clamp(uBlink,0.0,1.0));",
    "  vec3 headC=vec3(0.0,0.26,0.02);",
    "  vec3 toH=headC-ro;",
    "  float hz=dot(toH,ww);",
    "  vec2 hq=vec2(dot(toH,uu)/hz*1.35/0.46, dot(toH,vv)/hz*1.35/0.5);",
    "  vec2 ec1=hq+vec2(-0.11,0.04);",
    "  vec2 ec2=hq+vec2(0.11,0.038);",
    "  vec2 e1=(q-ec1)*vec2(1.15,1.0/max(shut,0.08));",
    "  vec2 e2=(q-ec2)*vec2(1.15,1.0/max(shut,0.08));",
    "  float onHead=smoothstep(-0.02,0.08,p.y);",
    "  float front=smoothstep(0.0,0.35,dot(N,V));",
    "  float eye=smoothstep(0.085,0.05,min(length(e1),length(e2)))*onHead*front;",
    "  col=mix(col,vec3(0.01,0.012,0.016),smoothstep(0.15,0.65,eye));",
    "  float glint1=smoothstep(0.028,0.006,length(e1-vec2(-0.02,0.02)));",
    "  float glint2=smoothstep(0.028,0.006,length(e2-vec2(-0.02,0.02)));",
    "  col=mix(col,vec3(1.0),clamp((glint1+glint2)*eye*(1.0-clamp(uBlink,0.0,1.0)),0.0,1.0));",
    "  col=clamp(col,0.0,1.0);",
    "  gl_FragColor=vec4(col,1.0);",
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
    loadCreatureSprites();
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
      uBlink: gl.getUniformLocation(prog, "uBlink"),
      uEnv: gl.getUniformLocation(prog, "uEnv")
    };
    return true;
  };

  Jar.prototype.setEnv = function (source) {
    if (!source || !this.envCtx) return;
    var c = this.envCtx;
    try {
      c.clearRect(0, 0, 256, 256);
      c.filter = "blur(2px)";
      c.drawImage(source, -18, -18, 292, 292);
      c.filter = "none";
      this.envDirty = true;
    } catch (e) {
      try {
        c.filter = "none";
        c.drawImage(source, 0, 0, 256, 256);
        this.envDirty = true;
      } catch (e2) {}
    }
  };

  function blinkAmt(t, asleep) {
    var phase = ((t % 3.8) + 3.8) % 3.8;
    var d = Math.abs(phase - 2.15);
    var blink = d >= 0.12 ? 0 : Math.cos((d / 0.12) * 1.5707963);
    if (asleep) blink = Math.max(blink, 0.28);
    return blink;
  }

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
    gl.uniform1f(this.loc.uBlink, blinkAmt(t, st.asleep));
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

  var spriteBook = { fallback: null, closed: null };
  function loadSprite(urls, key) {
    var i = 0;
    function next() {
      if (i >= urls.length) return;
      var im = new Image();
      var src = urls[i++];
      im.onload = function () {
        if (im.naturalWidth) spriteBook[key] = im;
        else next();
      };
      im.onerror = function () { next(); };
      im.src = src;
    }
    next();
  }
  function loadCreatureSprites() {
    if (loadCreatureSprites.started) return;
    loadCreatureSprites.started = true;
    var root = "plates/2026-10-05/ori-layers/creature/";
    loadSprite([
      root + "fallback.png",
      root + "body.png",
      root + "chrome.png",
      root + "creature.png",
      root + "open.png",
      root + "idle.png",
      "art/creature/fallback.png"
    ], "fallback");
    loadSprite([
      root + "closed.png",
      root + "blink.png",
      "art/creature/closed.png"
    ], "closed");
  }

  Jar.prototype.paintFallback = function (st, t) {
    var ctx = this.ctx;
    if (!ctx) return;
    var w = this.cv.width, h = this.cv.height;
    ctx.clearRect(0, 0, w, h);
    var shut = blinkAmt(t, st && st.asleep);
    var img = (shut > 0.45 && spriteBook.closed) || spriteBook.fallback;
    if (!img) return;
    var foot = h * 0.9;
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, foot, w * 0.22, Math.max(3, h * 0.028), 0, 0, 7);
    ctx.fill();
    ctx.drawImage(img, w * 0.08, h * 0.02, w * 0.84, h * 0.86);
  };

  Jar.prototype.frame = function () {
    var t = virtualNow == null ? (nowMs() - this.t0) / 1000 : virtualNow / 1000;
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
    this.paintFallback(st, t);
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
