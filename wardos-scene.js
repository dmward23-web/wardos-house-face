/* WardOS Cinema Look, Phase 1.
   WardosScene.mount(el, {plate:{webm,mp4,poster}, lut:url, q, fps}) -> {setQuality, stop}.
   Ground is Prism's plate when those files are on disk, otherwise a procedural
   Christmas still painted here (no camo). The grade pass runs only for an
   ungraded plate or the three.js layer. The loop and the fallback already
   carry the grade, so the pass is bypassed for those sources.
   HTML cards stay outside this layer. */
(function (global) {
  "use strict";

  var DIR = "art/cinema/xmas-2026/";
  var FILES = {
    loop: DIR + "xmas-hero-loop-1920x1080-25s.mp4",
    ungraded: DIR + "xmas-hero-plate-1920x1080-ungraded.png",
    fallback: DIR + "xmas-hero-fallback-1920x1080-graded.png",
    lut: DIR + "wardos-xmas.cube",
    palette: DIR + "palette.json",
    glass: DIR + "glass-card-9slice-192.png"
  };
  var KID_LEGEND = {
    Ainsley: "#8a6394",
    Hayes: "#3f8b71",
    Harris: "#42679a",
    Shared: "#c4b49a"
  };
  var RANK = { still: 0, low: 1, high: 2 };

  function gradeBypassed(source) {
    return source === "loop" || source === "fallback";
  }

  function choosePlate(flags, quality) {
    var has = flags || {};
    if (quality === "still") {
      return has.fallback
        ? { source: "fallback", grade: false }
        : { source: "procedural", grade: false };
    }
    if (quality === "low") {
      if (has.loop) return { source: "loop", grade: false };
      if (has.fallback) return { source: "fallback", grade: false };
      return { source: "procedural", grade: false };
    }
    if (has.ungraded) return { source: "ungraded", grade: true };
    if (has.loop) return { source: "loop", grade: false };
    if (has.fallback) return { source: "fallback", grade: false };
    return { source: "procedural", grade: true };
  }

  function clampQuality(current, next) {
    if (!Object.prototype.hasOwnProperty.call(RANK, next)) return current;
    if (RANK[next] > RANK[current]) return current;
    return next;
  }

  function createWatchdog(start) {
    var q = start && Object.prototype.hasOwnProperty.call(RANK, start) ? start : "high";
    var streak = 0;
    return {
      quality: function () { return q; },
      lock: function (next) {
        if (Object.prototype.hasOwnProperty.call(RANK, next) && RANK[next] <= RANK[q]) {
          q = next;
          streak = 0;
        }
        return q;
      },
      note: function (p95) {
        if (q === "still") return null;
        if (p95 > 20) streak += 1;
        else streak = 0;
        if (streak < 2) return null;
        var from = q;
        q = q === "high" ? "low" : "still";
        streak = 0;
        return "WARDOSFPS drop " + from + " to " + q;
      }
    };
  }

  function summarize(samples) {
    var list = samples || [];
    if (!list.length) return { p50ms: 0, p95ms: 0, worstms: 0, over33: 0, frames: 0 };
    var a = list.slice().sort(function (x, y) { return x - y; });
    function pct(p) {
      var i = Math.ceil(p * a.length) - 1;
      if (i < 0) i = 0;
      if (i >= a.length) i = a.length - 1;
      return a[i];
    }
    var over = 0;
    for (var i = 0; i < list.length; i++) if (list[i] > 33) over += 1;
    return { p50ms: pct(0.5), p95ms: pct(0.95), worstms: a[a.length - 1], over33: over, frames: list.length };
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function channel(c) {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function relLum(rgb) {
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  }

  function contrastRatio(fg, bg) {
    var a = relLum(fg);
    var b = relLum(bg);
    var hi = a > b ? a : b;
    var lo = a > b ? b : a;
    return (hi + 0.05) / (lo + 0.05);
  }

  function parseHex(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function parseCube(text) {
    var size = 0;
    var vals = [];
    var lines = String(text || "").split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === "#") continue;
      if (line.indexOf("LUT_3D_SIZE") === 0) {
        size = parseInt(line.split(/\s+/)[1], 10);
        continue;
      }
      if (/^[A-Za-z]/.test(line)) continue;
      var p = line.split(/\s+/);
      if (p.length < 3) continue;
      var r = parseFloat(p[0]);
      var g = parseFloat(p[1]);
      var b = parseFloat(p[2]);
      if (isFinite(r) && isFinite(g) && isFinite(b)) vals.push(r, g, b);
    }
    if (!size || vals.length < size * size * size * 3) return null;
    return { size: size, rgb: vals };
  }

  function paintProcedural(ctx, w, h) {
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#1c3358");
    sky.addColorStop(0.45, "#14243f");
    sky.addColorStop(1, "#10141c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    var glow = ctx.createRadialGradient(220, 210, 20, 220, 230, 280);
    glow.addColorStop(0, "rgba(255, 176, 78, 0.85)");
    glow.addColorStop(0.45, "rgba(186, 92, 36, 0.28)");
    glow.addColorStop(1, "rgba(20, 24, 36, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#241910";
    ctx.fillRect(0, Math.round(h * 0.72), w, Math.round(h * 0.28));
    var floor = ctx.createLinearGradient(0, h * 0.7, 0, h);
    floor.addColorStop(0, "rgba(92, 48, 22, 0.0)");
    floor.addColorStop(0.4, "rgba(72, 36, 18, 0.45)");
    floor.addColorStop(1, "rgba(28, 16, 10, 0.2)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, Math.round(h * 0.68), w, Math.round(h * 0.32));
    function tree(x, base, scale, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, base - 260 * scale);
      ctx.lineTo(x - 90 * scale, base);
      ctx.lineTo(x + 90 * scale, base);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, base - 340 * scale);
      ctx.lineTo(x - 70 * scale, base - 120 * scale);
      ctx.lineTo(x + 70 * scale, base - 120 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#3a2416";
      ctx.fillRect(x - 12 * scale, base, 24 * scale, 36 * scale);
    }
    tree(1500, h * 0.78, 1.15, "#1d3a2c");
    tree(1680, h * 0.8, 0.85, "#163226");
    tree(1320, h * 0.8, 0.7, "#1a3328");
    ctx.fillStyle = "#f2d7a2";
    var i;
    for (i = 0; i < 80; i++) {
      var sx = (i * 97) % w;
      var sy = (i * 53) % Math.round(h * 0.7);
      ctx.globalAlpha = 0.35 + (i % 5) * 0.1;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#6a2e22";
    ctx.fillRect(w - 280, h * 0.42, 70, 90);
    ctx.fillStyle = "#f0c27a";
    ctx.fillRect(w - 262, h * 0.46, 34, 40);
  }

  function probe(url) {
    return fetch(url, { method: "HEAD" }).then(function (r) {
      if (r.ok) return true;
      if (r.status === 405 || r.status === 501) {
        return fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } }).then(function (g) {
          return g.ok;
        });
      }
      return false;
    }).catch(function () { return false; });
  }

  function loadImage(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  function mount(el, opts) {
    opts = opts || {};
    var plate = opts.plate || {};
    var urls = {
      loop: plate.mp4 || plate.webm || FILES.loop,
      ungraded: FILES.ungraded,
      fallback: plate.poster || FILES.fallback,
      lut: opts.lut || FILES.lut
    };
    var reduced = false;
    try { reduced = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e0) { reduced = false; }
    var asked = opts.q === "low" || opts.q === "high" || opts.q === "still" ? opts.q : "high";
    var q = reduced ? "still" : asked;
    var source = "procedural";
    var grade = q === "high";
    var stopped = false;
    var rendererName = "poster";
    var raf = 0;
    var lastT = 0;
    var sec = [];
    var win = [];
    var winT = 0;
    var flags = { loop: false, ungraded: false, fallback: false };
    var images = {};
    var lutPack = null;
    var glState = null;
    var watchdog = createWatchdog(q);
    var fpsEl = null;

    el.id = el.id || "wardos-scene";
    el.setAttribute("data-layer", "ground");
    var poster = document.createElement("canvas");
    poster.id = "wardos-poster";
    poster.width = 1920;
    poster.height = 1080;
    var video = document.createElement("video");
    video.id = "wardos-plate";
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.preload = "auto";
    var glCanvas = document.createElement("canvas");
    glCanvas.id = "wardos-gl";
    el.appendChild(poster);
    el.appendChild(video);
    el.appendChild(glCanvas);
    paintProcedural(poster.getContext("2d"), 1920, 1080);
    reflect();

    if (!document.getElementById("wardos-mark")) {
      var mark = document.createElement("img");
      mark.id = "wardos-mark";
      mark.alt = "WardOS";
      mark.width = 320;
      mark.height = 80;
      mark.src = "wardos-mark.png";
      document.body.appendChild(mark);
    }
    if (opts.fps && !document.getElementById("wardos-fps")) {
      fpsEl = document.createElement("p");
      fpsEl.id = "wardos-fps";
      document.body.appendChild(fpsEl);
    } else {
      fpsEl = document.getElementById("wardos-fps");
    }

    function reflect() {
      el.setAttribute("data-q", q);
      el.setAttribute("data-source", source);
      el.setAttribute("data-grade", grade && !gradeBypassed(source) ? "on" : "off");
      el.setAttribute("data-renderer", q === "still" ? "poster" : rendererName);
      video.style.display = source === "loop" && q !== "still" ? "block" : "none";
      glCanvas.style.display = q === "still" ? "none" : "block";
      poster.style.display = "block";
    }

    function drawPoster() {
      var ctx = poster.getContext("2d");
      var img = null;
      if ((source === "fallback" || q === "still") && images.fallback) img = images.fallback;
      else if (source === "ungraded" && images.ungraded) img = images.ungraded;
      if (img) {
        var s = Math.max(1920 / img.width, 1080 / img.height);
        var dw = img.width * s;
        var dh = img.height * s;
        ctx.drawImage(img, (1920 - dw) / 2, (1080 - dh) / 2, dw, dh);
      } else {
        paintProcedural(ctx, 1920, 1080);
      }
      if (glState && glState.plateTex) glState.plateTex.needsUpdate = true;
    }

    function publish(partial) {
      var stats = summarize(partial || sec);
      global.__wardosFps = {
        p50ms: round1(stats.p50ms),
        p95ms: round1(stats.p95ms),
        worstms: round1(stats.worstms),
        over33: stats.over33,
        frames: stats.frames,
        q: q,
        renderer: q === "still" ? "poster" : rendererName
      };
      if (fpsEl) fpsEl.textContent = "q " + q + "  p95 " + global.__wardosFps.p95ms + " ms";
    }
    publish([]);

    function goStill(why) {
      q = "still";
      watchdog.lock("still");
      grade = false;
      if (source === "loop") source = images.fallback ? "fallback" : "procedural";
      rendererName = "poster";
      try { video.pause(); } catch (e1) { /* already quiet */ }
      video.removeAttribute("src");
      try { video.load(); } catch (e2) { /* no media */ }
      if (glState && glState.renderer) {
        try { glState.renderer.dispose(); } catch (e3) { /* context already gone */ }
      }
      glState = null;
      drawPoster();
      reflect();
      if (why) el.setAttribute("data-fallback", why);
      publish(sec);
    }

    function applyPick() {
      var pick = choosePlate(flags, q);
      source = pick.source;
      grade = pick.grade && !gradeBypassed(pick.source);
      if (source === "loop" && q !== "still") {
        if (video.getAttribute("src") !== urls.loop) {
          video.src = urls.loop;
          video.poster = "";
        }
        var play = video.play();
        if (play && play.catch) play.catch(function () { /* autoplay can wait for a gesture */ });
      } else {
        try { video.pause(); } catch (e4) { /* quiet */ }
      }
      drawPoster();
      reflect();
      if (q !== "still") bootGL();
      else if (glState && glState.renderer) {
        try { glState.renderer.dispose(); } catch (e5) { /* gone */ }
        glState = null;
        rendererName = "poster";
        reflect();
      }
    }

    function setQuality(next) {
      var want = clampQuality(q, next);
      if (want === q) return q;
      q = want;
      watchdog.lock(q);
      grade = q === "high";
      applyPick();
      return q;
    }

    /* Parallax lives inside the GL frame (camera-space shift of a 16px-overscanned plate), so the canvas
       stays exactly 1920x1080 and #wardos-scene never has a scroll box larger than its client box. */
    var par = { x: 0, y: 0 };
    function onMove(ev) {
      if (reduced || q === "still" || stopped) {
        par.x = 0;
        par.y = 0;
        return;
      }
      var cx = (global.innerWidth || 1920) / 2;
      var cy = (global.innerHeight || 1080) / 2;
      var dx = cx ? (ev.clientX - cx) / cx : 0;
      var dy = cy ? (ev.clientY - cy) / cy : 0;
      var x = Math.max(-8, Math.min(8, dx * 8));
      var y = Math.max(-8, Math.min(8, dy * 8));
      par.x = x;
      par.y = y;
    }

    video.addEventListener("error", function () {
      if (source === "loop") goStill("video-error");
    });

    function bootGL() {
      if (q === "still" || stopped) return;
      import("./vendor/three/three.module.js").then(function (T) {
        if (stopped || q === "still") return;
        startGL(T);
      }).catch(function () { goStill("no-webgl"); });
    }

    function makeGrade(T) {
      var vs = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
      var fs = [
        "precision highp float;",
        "uniform sampler2D tDiffuse;",
        "uniform sampler2D tLut;",
        "uniform float hasLut;",
        "uniform float lutSize;",
        "uniform float time;",
        "varying vec2 vUv;",
        "vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }",
        "vec3 sampleLut(vec3 c){",
        "  float n = lutSize;",
        "  float z = clamp(c.b, 0.0, 1.0) * (n - 1.0);",
        "  float z0 = floor(z);",
        "  float z1 = min(z0 + 1.0, n - 1.0);",
        "  float ft = z - z0;",
        "  vec2 size = vec2(n * n, n);",
        "  vec2 uv0 = (vec2(z0 * n + c.r * (n - 1.0), c.g * (n - 1.0)) + 0.5) / size;",
        "  vec2 uv1 = (vec2(z1 * n + c.r * (n - 1.0), c.g * (n - 1.0)) + 0.5) / size;",
        "  return mix(texture2D(tLut, uv0).rgb, texture2D(tLut, uv1).rgb, ft);",
        "}",
        "void main(){",
        "  vec4 src = texture2D(tDiffuse, vUv);",
        "  vec3 c = src.rgb;",
        "  if (hasLut > 0.5) c = sampleLut(c);",
        "  else { c = aces(max(c, 0.0)); c.r += 0.035; c.g += 0.012; c.b -= 0.03; }",
        "  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));",
        "  c += vec3(1.0, 0.72, 0.4) * smoothstep(0.62, 1.0, luma) * 0.08;",
        "  float g = fract(sin(dot(gl_FragCoord.xy + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;",
        "  c += g * 0.025;",
        "  gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);",
        "}"
      ].join("\n");
      var lutTex = whiteLut(T);
      if (lutPack) lutTex = buildLut(T, lutPack);
      return new T.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          tLut: { value: lutTex },
          hasLut: { value: lutPack ? 1 : 0 },
          lutSize: { value: lutPack ? lutPack.size : 2 },
          time: { value: 0 }
        },
        vertexShader: vs,
        fragmentShader: fs,
        glslVersion: T.GLSL1,
        depthTest: false,
        depthWrite: false,
        transparent: true
      });
    }

    function whiteLut(T) {
      var data = new Uint8Array([255, 255, 255, 255]);
      var tex = new T.DataTexture(data, 1, 1, T.RGBAFormat);
      tex.needsUpdate = true;
      return tex;
    }

    function buildLut(T, pack) {
      var size = pack.size;
      var w = size * size;
      var h = size;
      var data = new Uint8Array(w * h * 4);
      var z, y, x, si, di;
      for (z = 0; z < size; z++) {
        for (y = 0; y < size; y++) {
          for (x = 0; x < size; x++) {
            si = (z * size * size + y * size + x) * 3;
            di = ((y * w) + (z * size + x)) * 4;
            data[di] = Math.max(0, Math.min(255, Math.round(pack.rgb[si] * 255)));
            data[di + 1] = Math.max(0, Math.min(255, Math.round(pack.rgb[si + 1] * 255)));
            data[di + 2] = Math.max(0, Math.min(255, Math.round(pack.rgb[si + 2] * 255)));
            data[di + 3] = 255;
          }
        }
      }
      var tex = new T.DataTexture(data, w, h, T.RGBAFormat);
      tex.magFilter = T.LinearFilter;
      tex.minFilter = T.LinearFilter;
      tex.flipY = false;
      tex.needsUpdate = true;
      return tex;
    }

    function startGL(T) {
      if (glState && glState.renderer) {
        try { glState.renderer.dispose(); } catch (e6) { /* replace */ }
      }
      var renderer;
      try {
        renderer = new T.WebGLRenderer({
          canvas: glCanvas,
          alpha: true,
          antialias: false,
          powerPreference: "high-performance"
        });
      } catch (err) {
        goStill("no-webgl");
        return;
      }
      if (!renderer.getContext()) {
        goStill("no-webgl");
        return;
      }
      renderer.setClearColor(0x000000, 0);
      var scene = new T.Scene();
      var camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 2;
      var plateTex = new T.CanvasTexture(poster);
      /* Plate bytes stay sRGB end to end: the grade pass samples them raw for the LUT and writes them straight out. Tagging the map SRGB linearised it with no re-encode and halved scene luminance. */
      var plateMesh = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: plateTex, depthWrite: false }));
      plateMesh.position.z = 0;
      plateMesh.visible = source !== "loop";
      scene.add(plateMesh);
      var n = q === "low" ? 300 : 1200;
      var arr = new Float32Array(n * 3);
      var sp = new Float32Array(n);
      var i;
      /* P2-5 (Prism, Nov 23): snow lives ONLY in the window panes, behind the glass.
         WIN is the pane box in plate pixels (x 500..765, y 0..690 of 1920x1080), as NDC. */
      var WIN = { x0: 500 / 960 - 1, x1: 765 / 960 - 1, y0: 1 - 690 / 540, y1: 1 };
      for (i = 0; i < n; i++) {
        arr[i * 3] = WIN.x0 + Math.random() * (WIN.x1 - WIN.x0);
        arr[i * 3 + 1] = WIN.y0 + Math.random() * (WIN.y1 - WIN.y0);
        arr[i * 3 + 2] = 0.2;
        sp[i] = 0.12 + Math.random() * 0.4;
      }
      var geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(arr, 3));
      var pts = new T.Points(geo, new T.PointsMaterial({
        color: 0xfff6ee,
        size: 3,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        sizeAttenuation: false
      }));
      pts.position.z = 0.3;
      scene.add(pts);
      var beam = document.createElement("canvas");
      beam.width = 64;
      beam.height = 256;
      var bctx = beam.getContext("2d");
      var beamGrad = bctx.createLinearGradient(0, 0, 64, 0);
      beamGrad.addColorStop(0, "rgba(255, 214, 160, 0)");
      beamGrad.addColorStop(0.5, "rgba(255, 196, 120, 0.9)");
      beamGrad.addColorStop(1, "rgba(255, 214, 160, 0)");
      bctx.fillStyle = beamGrad;
      bctx.fillRect(0, 0, 64, 256);
      var beamFade = bctx.createLinearGradient(0, 0, 0, 256);
      beamFade.addColorStop(0, "rgba(0, 0, 0, 0)");
      beamFade.addColorStop(0.15, "rgba(0, 0, 0, 1)");
      beamFade.addColorStop(0.75, "rgba(0, 0, 0, 0.35)");
      beamFade.addColorStop(1, "rgba(0, 0, 0, 0)");
      bctx.globalCompositeOperation = "destination-in";
      bctx.fillStyle = beamFade;
      bctx.fillRect(0, 0, 64, 256);
      var shaftMat = new T.MeshBasicMaterial({
        map: new T.CanvasTexture(beam),
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: T.AdditiveBlending
      });
      for (i = 0; i < 3; i++) {
        var shaft = new T.Mesh(new T.PlaneGeometry(0.22, 1.15), shaftMat);
        shaft.position.set(-0.62 + i * 0.16, 0.22, 0.4);
        shaft.rotation.z = -0.22;
        scene.add(shaft);
      }
      var gradeMat = null;
      var gradeScene = null;
      var rt = null;
      if (grade && !gradeBypassed(source)) {
        gradeMat = makeGrade(T);
        gradeScene = new T.Scene();
        gradeScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), gradeMat));
        rt = new T.WebGLRenderTarget(32, 32);
      }
      glCanvas.addEventListener("webglcontextlost", function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        goStill("context-lost");
      });
      rendererName = "webgl";
      glState = {
        T: T,
        renderer: renderer,
        scene: scene,
        camera: camera,
        plateTex: plateTex,
        plateMesh: plateMesh,
        pts: pts,
        arr: arr,
        sp: sp,
        win: WIN,
        n: n,
        gradeMat: gradeMat,
        gradeScene: gradeScene,
        rt: rt
      };
      reflect();
    }

    function renderFrame(dt, now) {
      if (!glState || q === "still") return;
      var arr = glState.arr;
      var sp = glState.sp;
      var n = glState.n;
      var i;
      for (i = 0; i < n; i++) {
        arr[i * 3 + 1] -= sp[i] * dt * 0.00012;
        if (arr[i * 3 + 1] < glState.win.y0) arr[i * 3 + 1] = glState.win.y1;
      }
      glState.pts.geometry.attributes.position.needsUpdate = true;
      glState.plateMesh.visible = source !== "loop";
      glState.plateTex.needsUpdate = true;
      var w = glCanvas.clientWidth || el.clientWidth || 1920;
      var h = glCanvas.clientHeight || el.clientHeight || 1080;
      var pr = q === "low" ? 0.5 : 1;
      glState.plateMesh.scale.set(1 + 16 / w, 1 + 16 / h, 1);
      glState.plateMesh.position.x = (par.x * 2) / w;
      glState.plateMesh.position.y = (-par.y * 2) / h;
      glState.pts.position.x = glState.plateMesh.position.x;
      glState.pts.position.y = glState.plateMesh.position.y;
      glState.renderer.setPixelRatio(pr);
      glState.renderer.setSize(w, h, false);
      if (glState.rt && grade && !gradeBypassed(source)) {
        var pw = Math.max(2, (w * pr) | 0);
        var ph = Math.max(2, (h * pr) | 0);
        glState.rt.setSize(pw, ph);
        glState.renderer.setRenderTarget(glState.rt);
        glState.renderer.setClearColor(0x000000, 1);
        glState.renderer.render(glState.scene, glState.camera);
        glState.renderer.setRenderTarget(null);
        glState.gradeMat.uniforms.tDiffuse.value = glState.rt.texture;
        glState.gradeMat.uniforms.time.value = now * 0.001;
        glState.renderer.render(glState.gradeScene, glState.camera);
      } else {
        glState.renderer.setRenderTarget(null);
        glState.renderer.setClearColor(0x000000, source === "loop" ? 0 : 1);
        glState.renderer.render(glState.scene, glState.camera);
      }
    }

    function loop(now) {
      if (stopped || document.hidden) return;
      var dt = lastT ? now - lastT : 16;
      lastT = now;
      if (dt > 0 && dt < 500) {
        sec.push(dt);
        win.push(dt);
      }
      if (q !== "still") {
        try { renderFrame(dt, now); }
        catch (err) { goStill("webgl-error"); }
      }
      raf = global.requestAnimationFrame(loop);
    }

    function kick() {
      if (raf || stopped || document.hidden) return;
      lastT = 0;
      raf = global.requestAnimationFrame(loop);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
        try { video.pause(); } catch (e7) { /* quiet */ }
      } else {
        if (source === "loop" && q !== "still") {
          var play = video.play();
          if (play && play.catch) play.catch(function () { /* resume */ });
        }
        kick();
      }
    });
    global.addEventListener("pointermove", onMove, { passive: true });

    var clock = setInterval(function () {
      if (stopped) return;
      var now = global.performance ? performance.now() : Date.now();
      if (!winT) winT = now;
      if (now - winT >= 10000) {
        var windowStats = summarize(win);
        win = [];
        winT = now;
        if (q === "high" || q === "low") {
          var line = watchdog.note(windowStats.p95ms);
          if (line) {
            console.log(line);
            setQuality(watchdog.quality());
          }
        }
      }
      publish(sec);
      sec = [];
    }, 1000);

    function stop() {
      stopped = true;
      clearInterval(clock);
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      try { video.pause(); } catch (e8) { /* quiet */ }
      if (glState && glState.renderer) {
        try { glState.renderer.dispose(); } catch (e9) { /* gone */ }
      }
      global.removeEventListener("pointermove", onMove);
    }

    function debugForce(kind) {
      if (kind === "video" || kind === "video-error") goStill("video-error");
      else if (kind === "context" || kind === "context-lost") goStill("context-lost");
      else goStill("no-webgl");
    }

    Promise.all([
      probe(urls.loop),
      probe(urls.ungraded),
      probe(urls.fallback),
      probe(urls.lut)
    ]).then(function (got) {
      if (stopped) return;
      flags.loop = !!got[0];
      flags.ungraded = !!got[1];
      flags.fallback = !!got[2];
      var jobs = [];
      if (flags.ungraded) jobs.push(loadImage(urls.ungraded).then(function (img) { images.ungraded = img; }));
      if (flags.fallback) jobs.push(loadImage(urls.fallback).then(function (img) { images.fallback = img; }));
      if (got[3]) {
        jobs.push(fetch(urls.lut).then(function (r) { return r.ok ? r.text() : ""; }).then(function (text) {
          lutPack = parseCube(text);
        }).catch(function () { lutPack = null; }));
      }
      return Promise.all(jobs);
    }).then(function () {
      if (stopped) return;
      applyPick();
      kick();
    }).catch(function () {
      if (!stopped) { applyPick(); kick(); }
    });

    kick();

    return {
      setQuality: setQuality,
      stop: stop,
      debugForce: debugForce,
      quality: function () { return q; },
      snowBox: function () {
        if (!glState) return null;
        var g = glState, out = 0, k;
        for (k = 0; k < g.n; k++) {
          var x = g.arr[k * 3], y = g.arr[k * 3 + 1];
          if (x < g.win.x0 || x > g.win.x1 || y < g.win.y0 || y > g.win.y1) out++;
        }
        return { n: g.n, out: out, px: { x0: (g.win.x0 + 1) * 960, x1: (g.win.x1 + 1) * 960, y0: (1 - g.win.y1) * 540, y1: (1 - g.win.y0) * 540 } };
      },
      source: function () { return source; },
      gradeOn: function () { return !!(grade && !gradeBypassed(source)); }
    };
  }

  function bootPage() {
    if (!document.body || document.getElementById("wardos-scene")) return;
    if (document.documentElement.getAttribute("data-look") !== "cinema") return;
    var params = new URLSearchParams(location.search);
    var q = params.get("q");
    var root = document.createElement("div");
    root.id = "wardos-scene";
    var ui = document.getElementById("ui");
    if (ui && ui.parentNode) ui.parentNode.insertBefore(root, ui);
    else document.body.appendChild(root);
    var handle = mount(root, {
      plate: { webm: "", mp4: FILES.loop, poster: FILES.fallback },
      lut: FILES.lut,
      q: q === "low" || q === "high" || q === "still" ? q : "high",
      fps: params.get("fps") === "1"
    });
    global.__wardosScene = handle;
  }

  var api = {
    mount: mount,
    FILES: FILES,
    KID_LEGEND: KID_LEGEND,
    gradeBypassed: gradeBypassed,
    choosePlate: choosePlate,
    clampQuality: clampQuality,
    createWatchdog: createWatchdog,
    summarize: summarize,
    contrastRatio: contrastRatio,
    parseHex: parseHex,
    parseCube: parseCube,
    paintProcedural: paintProcedural
  };
  global.WardosScene = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPage);
    else bootPage();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
