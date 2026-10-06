/* ori-scene.js · shared Ori-style living-scene kit for the Ward House Face (vendored from plates/2026-10-02/jar-engine v0.4.0 for SPOTIFY1, Sat Oct 3 2026)
   window.OriScene. Original art + code, Ori-INSPIRED mood only (no Ori assets, characters or audio).
   What any House Face subpage gets by mounting a World:
     - 5 painted parallax plates (sky / far / mid / ground / fore) tinted per page theme, cover-fit, optional horizontal tiling
     - heavy-spring camera (pointer parallax + breathing drift), optional horizontal SCROLL (timelines, the calendar path)
     - god rays, light shafts, drifting spirit motes + wisps, layered fog, HDR bloom, ACES grade, grain, vignette
     - a placeable in-world object layer (glowing things with step/draw/hit/tap), in 6 depth passes
     - WebAudio synth bed (no samples, no network), mute
     - page transitions: enter() = iris-of-light reveal + dolly from the tap point; exit() reverses
     - reduced-motion = static calm frame; fps cap, battery saver, hidden-tab pause; WebGL2 required (subclass supplies fallback)
   Kid boards (jar-engine.js) and future pages (Calendar World etc.) subclass World. NO network calls anywhere. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api; else root.OriScene = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function bump(t, a, b) { return t <= a || t >= b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)); }
  function now() { return (global.performance && performance.now ? performance.now() : Date.now()) / 1000; }
  function hexRgb(h) {
    var m = /^#?([0-9a-f]{6})/i.exec(String(h || "").trim()); if (m) { var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(String(h || "")); if (m) return [+m[1], +m[2], +m[3]];
    return [160, 180, 200];
  }
  function rgba(c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (a == null ? 1 : +a.toFixed(3)) + ")"; }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rng(seed) { var a = seed >>> 0; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function deepMerge(a, b) {
    var o = Array.isArray(a) ? a.slice() : Object.assign({}, a);
    if (b) Object.keys(b).forEach(function (k) {
      var v = b[k];
      o[k] = (v && typeof v === "object" && !Array.isArray(v) && a && typeof a[k] === "object" && a[k] && !Array.isArray(a[k])) ? deepMerge(a[k], v) : v;
    });
    return o;
  }
  /* damped spring: every motion in the kit eases through one of these (weighty, overshoot-capable, frame-rate independent enough at <=50 ms steps) */
  function Spring(v, k, z) { this.v = v; this.t = v; this.vel = 0; this.k = k || 120; this.z = z == null ? 0.6 : z; }
  Spring.prototype.step = function (dt) { var w = Math.sqrt(this.k); this.vel += (-this.k * (this.v - this.t) - 2 * this.z * w * this.vel) * dt; this.v += this.vel * dt; return this.v; };
  Spring.prototype.kick = function (i) { this.vel += i; };
  Spring.prototype.snap = function () { this.v = this.t; this.vel = 0; };
  var KIT_DEFAULTS = {
    ion: { acc: "#38d6ff", acc2: "#6b98ff", ink: "#eaf6ff", ground: "#02050a" },
    dprMax: 2, fpsCap: 60, batterySaver: true, saverFps: 30, renderScale: 1, bloom: null,
    sound: { muted: false, volume: 0.6, ambient: true }
  };

  /* ===================== WEBGL2 SCENE RENDERER (painted parallax plates, sprites, metaball field, liquid-chrome composite, bloom, grade) =====================
     Frame: HDR scene FBO <- sky / far plate / god rays / fog / mid plate / fog / ground / far motes / in-world UI
            -> scene copy (mipmapped, for glass refraction + metal reflections) -> metaball field splat ->
            jar composite (refractive glass, chrome+inner-glow mercury, SDF eyes + mouth, lid, caustic, halo)
            -> foreground plate (DOF-blurred silhouettes) -> near bokeh motes -> light shafts
            -> bloom (6-level down/up chain) -> filmic tonemap, blue-lifted grade, vignette, grain, fringe. */
  var GLSL_NOISE =
    "float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\n" +
    "float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\n" +
    " return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }\n" +
    "float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }\n";
  var VS_QUAD = "#version 300 es\nlayout(location=0) in vec2 aP; uniform vec4 uRect; uniform vec2 uRes; out vec2 vUV;\n" +
    "void main(){ vUV = aP; vec2 px = uRect.xy + aP * uRect.zw; gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0); }";
  var VS_FS = "#version 300 es\nlayout(location=0) in vec2 aP; out vec2 vUV; void main(){ vUV = aP; gl_Position = vec4(aP * 2.0 - 1.0, 0.0, 1.0); }";
  /* painted plate: R value, G rim, B glow, A coverage -> tinted per theme */
  var FS_PLATE = "#version 300 es\nprecision highp float;\nin vec2 vUV; uniform sampler2D uTex; uniform float uBias, uTime, uRimI, uGlowI, uFogA, uTw, uPaint, uPaintK;\n" +
    "uniform vec3 uDark, uLit, uRim, uGlow, uFog; uniform vec2 uLight; uniform vec2 uRes; uniform vec4 uRect; out vec4 o;\n" + GLSL_NOISE +
    "void main(){ vec4 t = texture(uTex, vUV, uBias); vec2 sp = (uRect.xy + vUV * uRect.zw) / uRes;\n" +
    " float ld = length((sp - uLight) * vec2(uRes.x / uRes.y, 1.0));\n" +
    /* painterly pass: brush-stroke grain in the lit paint, bark striations in the darks, layered leaf/moss tints on the rims */
    " float pk = (1.0 - clamp(uBias / 2.0, 0.0, 1.0)) * step(0.02, t.a); vec2 bu = vUV * uRect.zw / 1100.0;\n" +
    " float ang = vn(bu * 3.0) * 3.0; vec2 bd = vec2(cos(ang), sin(ang)); vec2 bq = vec2(dot(bu, bd), dot(bu, vec2(-bd.y, bd.x)));\n" +
    " float brush = vn(bq * vec2(18.0, 150.0)) * 0.6 + vn(bq * vec2(40.0, 320.0)) * 0.4; float bark = vn(bu * vec2(220.0, 9.0)) * 0.65 + vn(bu * vec2(520.0, 22.0)) * 0.35;\n" +
    " float mass = vn(bu * 4.0 + 7.0); vec3 dk = uDark * mix(0.75, 1.3, mass) * mix(vec3(1.0), vec3(0.8, 1.12, 1.0), smoothstep(0.55, 0.9, mass));\n" +
    " vec3 c = mix(dk, uLit * (1.0 + pk * 0.35 * (brush - 0.5)), t.r) * (1.0 + pk * 0.28 * (bark - 0.5) * (1.0 - t.r));\n" +
    " float moss = smoothstep(0.45, 0.8, vn(bu * 26.0 + 3.0)) * pk; vec3 rimT = mix(uRim, uRim * vec3(0.72, 1.08, 0.82), moss * 0.7);\n" +
    " c += rimT * t.g * uRimI * (0.45 + 1.1 * exp(-ld * 1.8)) * (0.8 + 0.4 * brush * pk);\n" +
    /* painted drop-in plate (straight RGBA colour art from _test/plates): own colour, a touch of the hot light, same fog */
    " if (uPaint > 0.5) { c = pow(t.rgb, vec3(2.2)) * uPaintK; c += pow(max(c - vec3(0.55), vec3(0.0)), vec3(2.0)) * 2.5; c *= 1.0 + 0.5 * exp(-ld * 2.6); }\n" +
    " c = mix(c, uFog, uFogA * smoothstep(0.35, 1.0, sp.y) * (uPaint > 0.5 ? 0.6 : 1.0));\n" +
    " float tw = 0.72 + 0.28 * sin(uTime * 1.6 + vn(vUV * 70.0) * 12.0); tw = mix(1.0, tw, uTw);\n" +
    " o = vec4(c * t.a + (uPaint > 0.5 ? vec3(0.0) : uGlow * t.b * uGlowI * tw), t.a); }";
  var FS_FOG = "#version 300 es\nprecision highp float;\nin vec2 vUV; uniform float uTime, uA, uY0, uY1, uSpeed, uScale; uniform vec3 uC; uniform vec2 uAsp; out vec4 o;\n" + GLSL_NOISE +
    "void main(){ vec2 p = vec2(vUV.x * uAsp.x, 1.0 - vUV.y) * uScale; float y = 1.0 - vUV.y;\n" +
    " float n = fbm(p * vec2(1.0, 2.6) + vec2(uTime * uSpeed, 0.0)); n = smoothstep(0.35, 0.85, n + 0.15 * fbm(p * 3.0 - vec2(uTime * uSpeed * 1.7, 0.0)));\n" +
    " float band = smoothstep(uY0, uY0 + (uY1 - uY0) * 0.45, y) * (1.0 - smoothstep(uY1 - (uY1 - uY0) * 0.35, uY1, y));\n" +
    " float a = n * band * uA; o = vec4(uC * a, a * 0.85); }";
  /* volumetric god rays fanning from the light (additive) */
  var FS_RAYS = "#version 300 es\nprecision highp float;\nin vec2 vUV; uniform vec2 uL; uniform float uTime, uA, uAsp; uniform vec3 uC; out vec4 o;\n" + GLSL_NOISE +
    "void main(){ vec2 p = vec2(vUV.x, 1.0 - vUV.y); vec2 d = (p - uL) * vec2(uAsp, 1.0); float r = length(d); float a = atan(d.x, d.y);\n" +
    " float s = vn(vec2(a * 9.0, uTime * 0.05)) * 0.55 + vn(vec2(a * 23.0 + 3.0, uTime * 0.08)) * 0.3 + vn(vec2(a * 61.0 + 9.0, uTime * 0.11)) * 0.15;\n" +
    " s = pow(smoothstep(0.42, 0.95, s), 1.6);\n" +
    " float down = smoothstep(-0.2, 0.6, d.y / max(r, 1e-3));\n" +
    " float fall = exp(-r * 1.05) * smoothstep(0.0, 0.08, r);\n" +
    " float dust = 0.85 + 0.15 * vn(p * vec2(40.0, 12.0) + vec2(0.0, uTime * 0.3));\n" +
    " float I = uA * s * down * fall * dust + uA * 0.18 * exp(-r * 3.2);\n" +
    " o = vec4(uC * I, 0.0); }";
  /* instanced sprites: glow motes, bokeh, capsules (vines), seed pods with icons, wisps */
  var VS_SPR = "#version 300 es\nlayout(location=0) in vec2 aP; layout(location=1) in vec4 aA; layout(location=2) in vec4 aB; layout(location=3) in vec4 aC;\n" +
    "uniform vec2 uRes; out vec2 vL; out vec4 vA; out vec4 vB; out vec4 vC; out vec2 vPx;\n" +
    "void main(){ vec2 a = aA.xy, b = aA.zw; float r = aB.x * 3.2; vec2 dir = b - a; float L = length(dir); vec2 t = L > 1e-4 ? dir / L : vec2(1.0, 0.0); vec2 n = vec2(-t.y, t.x);\n" +
    " vec2 q = aP * 2.0 - 1.0; vec2 px = a + t * (q.x * 0.5 + 0.5) * L + t * q.x * r + n * q.y * r;\n" +
    " vPx = px; vA = aA; vB = aB; vC = aC; gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0); }";
  var FS_SPR = "#version 300 es\nprecision highp float;\nin vec2 vPx; in vec4 vA; in vec4 vB; in vec4 vC; uniform sampler2D uIcons; uniform float uTime; uniform float uIconN; out vec4 o;\n" + GLSL_NOISE +
    "float segd(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0); return length(pa - ba * h); }\n" +
    "void main(){ float r = vB.x, ty = vB.y; float d = segd(vPx, vA.xy, vA.zw); vec3 c = vC.rgb; float a = vC.a;\n" +
    " if (ty < 0.5) { float k = d / r; float I = exp(-k * k * 2.2) * 0.65 + exp(-k * k * 18.0) * 0.9; o = vec4(c * I * a, 0.0); return; }\n" + /* glow mote */
    " if (ty < 1.5) { float k = d / r; float disc = smoothstep(1.0, 0.86, k); float ring = smoothstep(0.7, 0.98, k) * disc; float I = (disc * 0.32 + ring * 0.4) * a; o = vec4(c * I, 0.0); return; }\n" + /* bokeh */
    " if (ty < 2.5) { float aa = 1.2; float m = smoothstep(r + aa * 0.5, r - aa * 0.5, d); float edge = smoothstep(r - 2.5, r, d) * m;\n" +
    "  o = vec4((c * 0.6 + vec3(0.55, 0.85, 1.0) * edge * vB.z) * m * a, m * a); return; }\n" + /* capsule (vine) with rim */
    " if (ty < 3.5) { vec2 q = (vPx - vA.xy) / r; float k = length(q);\n" + /* seed pod: glass shell + light core + icon + rim */
    "  float shell = smoothstep(1.0, 0.94, k); float core = exp(-k * k * 3.0); float halo = exp(-k * k * 0.55) * (1.0 - shell * 0.6);\n" +
    "  float sw = 0.5 + 0.5 * sin(atan(q.y, q.x) * 3.0 + uTime * 1.7 + k * 6.0);\n" +
    "  vec2 iuv = clamp(q * 0.62 * 0.5 + 0.5, 0.0, 1.0); float ic = texture(uIcons, vec2((vB.z + iuv.x) / max(uIconN, 1.0), iuv.y)).r * smoothstep(0.75, 0.6, k);\n" +
    "  float rim = smoothstep(0.78, 0.97, k) * shell; float spec = exp(-pow(length(q - vec2(-0.38, -0.42)) / 0.16, 2.0));\n" +
    "  vec3 col = c * (core * (0.9 + 0.4 * sw) * vB.w + 0.15) + vec3(0.8, 0.95, 1.0) * rim * 0.9 + vec3(1.0) * spec * 0.9 + vec3(1.0) * ic * 1.1;\n" +
    "  o = vec4(col * shell * a + c * halo * 0.5 * a * vB.w, shell * a * 0.7); return; }\n" +
    " if (ty < 4.5) { float k = d / r; float I = exp(-k * k * 1.2); float tail = 0.0; o = vec4(c * I * a, I * a * 0.25); return; }\n" + /* soft light pool */
    " if (ty > 5.5) { vec2 ab = vA.zw - vA.xy; float h = clamp(dot(vPx - vA.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0); float k = d / r;\n" +
    "  float I = exp(-k * k * 1.8) * smoothstep(0.0, 0.22, h) * (1.0 - smoothstep(0.5, 1.0, h)) * (0.75 + 0.25 * vn(vec2(h * 6.0 - uTime * 0.12, vB.z)));\n" +
    "  o = vec4(c * I * a, 0.0); return; }\n" + /* additive light shaft */
    " { float k = d / r; float m = smoothstep(1.0, 0.8, k); o = vec4(c * m * a, m * a); } }";
  var VS_BLOB2 = "#version 300 es\nlayout(location=0) in vec2 aP; layout(location=1) in vec4 aB; layout(location=2) in vec4 aW; uniform vec2 uRes; out vec2 vP; out vec4 vW;\n" +
    "void main(){ vec2 c = aP * 2.0 - 1.0; vec2 R = aB.zw * 1.9; vec2 px = aB.xy + c * R; vP = c; vW = aW; gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0); }";
  var FS_BLOB2 = "#version 300 es\nprecision mediump float;\nin vec2 vP; in vec4 vW; uniform float uK; out vec4 o;\n" +
    "void main(){ float d2 = dot(vP, vP); if (d2 >= 1.0) discard; float f = 1.0 - d2; f *= f; o = vW * f * uK; }";
  /* ---------------- jar + creature composite ---------------- */
  var FS_JAR = "#version 300 es\nprecision highp float;\n" +
    "uniform sampler2D uScene, uField, uSurf, uProf; uniform vec2 uRes; uniform float uInvK;\n" +
    "uniform vec4 uJar; uniform vec4 uSq; uniform float uRow, uRows, uBody, uGlass; uniform vec2 uSurfX, uProfV; uniform vec4 uGeo;\n" +
    "uniform vec3 uR0[5]; uniform vec3 uR1[5]; uniform vec3 uR2[5]; uniform vec3 uGlowC, uRimC, uIon; uniform vec2 uLightDir;\n" +
    "uniform float uTime, uInner, uCaustic, uGlint, uFill, uHalo, uFrost, uDim;\n" +
    "uniform vec4 uEyeA, uEyeB, uLid, uMouth, uMouth2; uniform vec2 uLook; uniform vec4 uLidT; uniform float uLidKind;\n" +
    "out vec4 o;\n" + GLSL_NOISE +
    "vec3 rampN(vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, float I){ I = clamp(I, 0.0, 1.8);\n" +
    " if (I < 0.2) return mix(c0, c1, I / 0.2); if (I < 0.48) return mix(c1, c2, (I - 0.2) / 0.28);\n" +
    " if (I < 0.8) return mix(c2, c3, (I - 0.48) / 0.32); if (I < 1.12) return mix(c3, c4, (I - 0.8) / 0.32);\n" +
    " return mix(c4, vec3(1.0), clamp((I - 1.12) / 0.55, 0.0, 1.0)); }\n" +
    "float env(vec3 r){ float az = atan(r.x, r.z); float el = asin(clamp(r.y, -1.0, 1.0));\n" +
    " float up = smoothstep(-0.42, -0.08, el) * smoothstep(1.35, 0.75, el);\n" +
    " float I = 0.03 + 0.13 * exp(-az * az * 1.3) * smoothstep(-0.6, 0.25, el);\n" +
    " I += 1.35 * exp(-pow((az + 1.02) / 0.12, 2.0)) * up + 0.75 * exp(-pow((az + 0.66) / 0.045, 2.0)) * up;\n" +
    " I += 0.6 * exp(-pow((az - 1.08) / 0.085, 2.0)) * up + 0.2 * exp(-pow((az - 0.35) / 0.25, 2.0)) * up;\n" +
    " I += 0.2 * smoothstep(0.08, 0.55, el) + 0.42 * smoothstep(0.6, 0.98, el) * (0.75 + 0.25 * cos(az * 2.0)) + 1.1 * exp(-pow((el - 0.66) / 0.045, 2.0)) * (0.6 + 0.4 * cos(az * 1.5));\n" +
    " float fl = smoothstep(0.03, -0.3, el); I = mix(I, 0.04 + 0.08 * exp(el * 3.5), fl * 0.9);\n" +
    " I *= 1.0 - 0.6 * exp(-pow((el - 0.01) / 0.04, 2.0)); return I; }\n" +
    "vec2 prof(float v){ return texture(uProf, vec2((v - uProfV.x) / (uProfV.y - uProfV.x), (uSq.w + 0.5) / 2.0)).rg; }\n" +
    "vec2 srf(float u){ float s = (u - uSurfX.x) / (uSurfX.y - uSurfX.x); return vec2(texture(uSurf, vec2(s, (uRow * 2.0 + 0.5) / uRows)).r, texture(uSurf, vec2(s, (uRow * 2.0 + 1.5) / uRows)).r); }\n" +
    "float bodyF(float u, float v){ if (uBody < 0.5) return 0.0; float hw = prof(v).r; if (hw <= 0.0) return 0.0; vec2 s = srf(u);\n" +
    " return smoothstep(-0.55, 0.45, hw - abs(u - uGeo.x)) / (1.0 + exp(-(v - s.y) / 0.62)); }\n" +
    "vec2 toU(vec2 p){ vec2 d = p - uJar.xy - vec2(0.0, uSq.z); float c = cos(uJar.w), s = sin(uJar.w); vec2 r = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);\n" +
    " return vec2(50.0 + r.x / (uJar.z * uSq.x), 124.0 + r.y / (uJar.z * uSq.y)); }\n" +
    "vec4 fld(vec2 p){ return texture(uField, p / uRes) * uInvK; }\n" +
    "float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }\n" +
    /* one eye: returns rgba (premult) given normalized eye coords */
    "vec4 eye(vec2 q, vec2 c, float rx, float ry, float lidTop, float aaU, vec3 lidCol, float tilt){\n" +
    " vec2 e = (q - c) / vec2(rx, ry); float k = length(e); float aa = aaU / min(rx, ry) * 1.2;\n" +
    " float m = smoothstep(1.0 + aa, 1.0 - aa, k); if (m <= 0.0) return vec4(0.0);\n" +
    " float sq = uLid.w; float bot = uLid.z;\n" +
    " vec2 pc = uLook * vec2(0.34, 0.28); float pr = uEyeB.z; vec2 pe = (e - pc) * vec2(1.0, ry / rx);\n" +
    " float dp = length(pe); float ir = pr * 1.62;\n" +
    " float lidY = -1.0 + 2.0 * lidTop + tilt * e.x;\n" +
    " vec3 scl = vec3(0.9, 0.96, 1.0) * (1.3 - 0.35 * k * k) * (1.0 - 0.35 * smoothstep(0.55, -0.1, e.y - lidY));\n" + /* lid casts soft shade */
    " float irisM = smoothstep(ir + aa, ir - aa, dp); float pupM = smoothstep(pr * (0.92 + 0.08 * sin(uTime * 0.7)) + aa, pr * 0.9 - aa, dp);\n" +
    " float ang = atan(pe.y, pe.x); float fib = 0.65 + 0.35 * vn(vec2(ang * 7.0, dp * 9.0));\n" +
    " vec3 iris = mix(uR0[2], uR0[4], smoothstep(ir, pr, dp) * 0.8) * fib * 1.35; iris *= 0.55 + 0.45 * smoothstep(ir, ir * 0.82, dp);\n" +
    " vec3 col = mix(scl, iris, irisM); col = mix(col, vec3(0.005, 0.012, 0.03) + uR0[2] * 0.06, pupM);\n" +
    " float cl = exp(-pow(length(pe - vec2(-0.30, -0.34) * pr * 1.7) / (pr * 0.36), 2.0)) + 0.55 * exp(-pow(length(pe - vec2(0.32, 0.30) * pr * 1.4) / (pr * 0.15), 2.0));\n" +
    " col += vec3(1.0) * cl * 1.6;\n" +
    " col *= 1.0 - 0.4 * smoothstep(0.72, 1.0, k);\n" +
    " float lid = 1.0 - smoothstep(lidY - aa * 1.5, lidY + aa * 1.5, e.y);\n" +
    " float lidB = smoothstep(1.0 - 2.0 * bot - aa * 1.5, 1.0 - 2.0 * bot + aa * 1.5, e.y);\n" +
    " float cover = clamp(lid + lidB, 0.0, 1.0);\n" +
    " float lidEdge = exp(-pow((e.y - lidY) / (aa * 2.0 + 0.05), 2.0)) * step(0.001, lidTop + abs(tilt));\n" +
    " vec3 lidShade = lidCol * (0.85 + 0.35 * smoothstep(lidY - 0.6, lidY, e.y)) + vec3(0.9, 0.96, 1.0) * exp(-pow((e.y - lidY + 0.12) / 0.06, 2.0)) * 0.35;\n" +
    " col = mix(col, lidShade, cover); col = mix(col, uR0[0] * 0.15, lidEdge * 0.85 * (1.0 - cover * 0.3));\n" +
    " vec4 eyeC = vec4(col, 1.0) * m;\n" +
    " if (sq > 0.01) { float x = e.x; float yc = 0.25 - 0.62 * (1.0 - x * x * 0.9); float dd = abs(e.y - yc) - 0.16; float arc = smoothstep(aa * 2.0, -aa * 2.0, dd) * step(abs(x), 0.95);\n" +
    "  vec4 arcC = vec4(mix(uR0[4], vec3(1.0), 0.6) * 1.4, 1.0) * arc; vec4 lidAll = vec4(lidCol * (0.85 + 0.3 * (-e.y)), 1.0) * m; vec4 sqC = arcC + lidAll * (1.0 - arc);\n" +
    "  eyeC = mix(eyeC, sqC, sq); }\n" +
    " if (lidTop > 0.92 && sq < 0.5) { float yc = 0.08 + 0.22 * (1.0 - e.x * e.x); float dd = abs(e.y - yc) - 0.06; float ln = smoothstep(aa * 2.0, -aa * 2.0, dd) * step(abs(e.x), 0.92); eyeC.rgb = mix(eyeC.rgb, uR0[0] * 0.4, ln * m); }\n" +
    " return eyeC; }\n" +
    "void main(){\n" +
    " vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); vec2 uv = gl_FragCoord.xy / uRes; vec2 q = toU(p); float u = q.x, v = q.y;\n" +
    " float aaU = 1.0 / (uJar.z * min(uSq.x, uSq.y)); float cx = uGeo.x, floorV = uGeo.y, bottom = uGeo.z, rimY = uGeo.w;\n" +
    " vec4 F = fld(gl_FragCoord.xy); float bF = bodyF(u, v); float Ft = F.r + bF;\n" +
    " vec2 pr = uGlass > 0.5 ? prof(v) : vec2(-1.0); float ax = abs(u - cx);\n" +
    " float mO = uGlass > 0.5 ? smoothstep(aaU, -aaU, ax - pr.g) * step(0.0, pr.g) : 0.0;\n" +
    " float mI = uGlass > 0.5 ? smoothstep(aaU, -aaU, ax - pr.r) * step(0.0, pr.r) : 0.0;\n" +
    " vec4 outC = vec4(0.0);\n" +
    /* -- ground: contact shadow, caustic light pool, halo light spill -- */
    " if (uGlass > 0.5) { float hwB = 30.0 * (uSq.w > 0.5 ? 0.62 : 1.0); float dv = v - bottom; float dx = (u - cx) / (hwB * 1.1);\n" +
    "  float sh = 0.7 * exp(-dx * dx * 2.4) * exp(-max(dv, 0.0) / 1.5) * smoothstep(-0.5, 0.3, dv) * (1.0 - mO);\n" +
    "  float e = exp(-pow((u - cx) / (hwB * 1.5), 2.0) - pow((dv - 3.5) / 3.6, 2.0)) * smoothstep(-2.5, 0.5, dv);\n" +
    "  float p1 = sin(u * 1.3 + 2.2 * sin(u * 0.31 + uTime * 0.8) + uTime * 1.1); float p2 = sin(u * 0.77 - uTime * 0.9 + dv * 0.9 + sin(u * 0.2 - uTime * 0.5) * 3.0);\n" +
    "  float pat = 0.35 + 0.65 * pow(0.5 + 0.5 * p1 * p2, 1.6); float ring = exp(-pow((abs(u - cx) - hwB * 0.98) / 2.6, 2.0)) * exp(-pow((dv - 1.2) / 1.6, 2.0)) * (0.6 + 0.4 * sin(u * 0.9 - uTime * 1.6)); float ci = uCaustic * (e * (0.25 + 1.1 * pat) + ring * 1.4) * (1.0 - mO);\n" +
    "  float hd = length(vec2((u - cx) / 70.0, (v - 80.0) / 75.0)); float halo = uHalo * exp(-hd * hd * 2.5) * (1.0 - mO);\n" +
    "  outC = vec4(uGlowC * halo + uR0[3] * ci * 0.55 + uR0[4] * ci * pat * 0.3, sh * (1.0 - min(ci, 1.0))); }\n" +
    /* -- glass body: refracted forest behind, tinted, lit from inside by the creature -- */
    " vec3 base = vec3(0.0); float glassA = 0.0;\n" +
    " if (mO > 0.001) { float xr = clamp((u - cx) / max(pr.g, 1.0), -1.0, 1.0);\n" +
    "  float wall = smoothstep(0.0, 1.2, ax - pr.r) * mO; vec2 off = vec2(-xr * xr * xr * (0.05 + 0.09 * wall), 0.008 * xr * xr) * vec2(uRes.y / uRes.x, 1.0) * uJar.z * 0.32;\n" +
    "  vec3 bg = vec3(textureLod(uScene, uv + off * 1.12, 1.2).r, textureLod(uScene, uv + off, 1.2).g, textureLod(uScene, uv + off * 0.88, 1.2).b);\n" +
    "  float inner = exp(-pow((v - mix(118.0, 50.0, uFill)) / 34.0, 2.0)) * 0.5 + 0.2;\n" +
    "  base = bg * 0.6 + uGlowC * uFill * inner * 0.08 + vec3(0.01, 0.025, 0.04); glassA = mO; }\n" +
    " vec3 col = base;\n" +
    /* -- mercury -- */
    " float alpha = 0.0;\n" +
    " if (Ft > 0.04) {\n" +
    "  float e1 = 1.0; vec4 Fx1 = fld(gl_FragCoord.xy + vec2(e1, 0.0)), Fx0 = fld(gl_FragCoord.xy - vec2(e1, 0.0)), Fy1 = fld(gl_FragCoord.xy + vec2(0.0, e1)), Fy0 = fld(gl_FragCoord.xy - vec2(0.0, e1));\n" +
    "  vec2 qx1 = toU(p + vec2(1.0, 0.0)), qx0 = toU(p - vec2(1.0, 0.0)), qy1 = toU(p + vec2(0.0, -1.0)), qy0 = toU(p - vec2(0.0, -1.0));\n" +
    "  vec2 gT = vec2((Fx1.r + bodyF(qx1.x, qx1.y)) - (Fx0.r + bodyF(qx0.x, qx0.y)), (Fy1.r + bodyF(qy1.x, qy1.y)) - (Fy0.r + bodyF(qy0.x, qy0.y)));\n" +
    "  vec2 gB = vec2(Fx1.a - Fx0.a, Fy1.a - Fy0.a);\n" +
    "  float aw = max(fwidth(Ft), 0.004) * 0.8; alpha = smoothstep(0.5 - aw, 0.5 + aw, Ft);\n" +
    "  float H = sqrt(clamp((Ft - 0.5) * 1.9, 0.0, 1.0)); vec2 gd = length(gT) > 1e-5 ? normalize(gT) : vec2(0.0);\n" +
    "  vec3 nM = normalize(vec3(-gd * sqrt(max(1.0 - H * H, 0.0)), H + 0.02)); float wBlob = clamp(F.r / max(Ft, 1e-4), 0.0, 1.0);\n" +
    "  vec3 n = nM; float core = H; float sx = 0.0;\n" +
    "  if (bF > 0.002) { vec2 pr2 = prof(v); float xr = clamp((u - cx) / max(pr2.r, 1.0), -0.985, 0.985); vec2 s = srf(u); sx = s.x;\n" +
    "   float dd = v - s.x; float ny = 0.30 * exp(-max(dd, 0.0) / 5.0) - 0.07 - 0.32 * smoothstep(floorV - 16.0, floorV, v);\n" +
    "   vec3 nC = normalize(vec3(xr, ny + 0.13, sqrt(1.0 - xr * xr))); float slope = (srf(u + 0.8).x - srf(u - 0.8).x) / 1.6;\n" +
    "   vec3 nF = normalize(vec3(xr * 0.42 - slope * 0.9, 0.86, 0.46)); float face = smoothstep(s.x + 0.9, s.x - 0.5, v);\n" +
    "   vec3 nBody = normalize(mix(nC, nF, face));\n" +
    /* liquid, not a can: slow flowing undulation under the mirror skin, stronger as the boil rises */
    "   float fa = (0.22 + 0.42 * uFill) * (1.0 - face * 0.6); vec2 fq = vec2(u * 0.055, v * 0.045);\n" +
    "   float f1 = vn(fq + vec2(0.0, -uTime * 0.38)) + 0.5 * vn(fq * 2.3 + vec2(1.7, -uTime * 0.71)), f2 = vn(fq + vec2(4.3, 2.1 - uTime * 0.31)) + 0.5 * vn(fq * 2.1 + vec2(7.1, -uTime * 0.64));\n" +
    "   nBody = normalize(nBody + vec3((f1 - 0.75) * 1.1, (f2 - 0.75) * 0.9, 0.0) * fa);\n" +
    "   float bs = smoothstep(0.02, 0.6, F.a); if (bs > 0.0) { vec2 bd = length(gB) > 1e-5 ? normalize(gB) : vec2(0.0); float hb = sqrt(clamp(F.a * 1.6, 0.0, 1.0));\n" +
    "    nBody = normalize(mix(nBody, normalize(vec3(-bd * sqrt(max(1.0 - hb * hb, 0.0)), hb + 0.05)), bs * 0.85)); }\n" +
    "   n = normalize(mix(nBody, nM, smoothstep(0.15, 0.85, wBlob)));\n" +
    "   float dIn = min(min(dd, pr2.r - abs(u - cx)), floorV - v); core = mix(smoothstep(0.5, 18.0, dIn), H, wBlob); }\n" +
    /* LIQUID CHROME: a mirror of the forest + studio silver bands, sky-over-ground horizon split, kid tint, fresnel rim, key-light hotspots */
    "  vec3 r = normalize(reflect(vec3(0.0, -0.06, -1.0), n));\n" +
    "  float E = env(r);\n" +
    /* the whole frame is the environment: reflection direction -> screen (ground below the horizon, canopy above), mirrored for back-facing rays */
    "  vec2 eu = vec2(0.5 + r.x * 0.46 * (r.z < 0.0 ? -1.0 : 1.0) + (uv.x - 0.5) * 0.25, 0.52 - r.y * 0.62);\n" +
    "  vec3 S1 = textureLod(uScene, clamp(eu, 0.002, 0.998), 2.4).rgb, S2 = textureLod(uScene, clamp(eu, 0.002, 0.998), 4.6).rgb;\n" +
    "  vec3 refl = mix(S1, S2, 0.45); refl = refl * refl * 1.25 + refl * 0.15; refl = mix(vec3(dot(refl, vec3(0.3, 0.55, 0.15))), refl, 0.3) * vec3(0.86, 1.0, 1.12); float rl = dot(refl, vec3(0.3, 0.55, 0.15));\n" +
    "  float wt = max(F.r, 1e-4); float w1 = F.g / wt * wBlob, w2 = F.b / wt * wBlob; float w0 = clamp(1.0 - w1 - w2, 0.0, 1.0);\n" +
    "  vec3 kt = uR0[3] * w0 + uR1[3] * w1 + uR2[3] * w2; vec3 tint = mix(vec3(1.0), kt / max(max(kt.r, kt.g), max(kt.b, 1e-3)), 0.3);\n" +
    "  vec3 kd = uR0[0] * w0 + uR1[0] * w1 + uR2[0] * w2;\n" +
    "  float hz = smoothstep(-0.10, 0.05, r.y);\n" +
    "  vec3 metal = (refl * 0.4 + vec3(0.9, 0.95, 1.0) * E * 0.95) * tint; metal = pow(metal, vec3(1.72)) * 1.8;\n" +
    "  metal *= mix(0.38, 1.0, hz); vec3 kdS = mix(vec3(dot(kd, vec3(0.3, 0.55, 0.15))), kd, 0.45); metal += kdS * 0.32 * (1.0 - hz) + vec3(0.03, 0.045, 0.06) * (1.0 - hz);\n" +
    "  metal += vec3(0.95, 0.98, 1.0) * exp(-pow((r.y - 0.02) / 0.025, 2.0)) * 0.4 * mix(vec3(1.0), tint, 0.5);\n" +
    "  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.8);\n" +
    "  vec3 Lk = normalize(vec3(uLightDir.x, -uLightDir.y, 0.75)); float spk = pow(max(dot(r, Lk), 0.0), 70.0); metal += vec3(1.8, 1.9, 2.0) * spk;\n" +
    "  if (bF > 0.002) { metal += vec3(0.9, 0.97, 1.0) * tint * 0.45 * exp(-pow((v - sx) / 0.5, 2.0)) * (1.0 - wBlob); float halo = smoothstep(0.0, 0.25, F.a) * (1.0 - smoothstep(0.25, 0.6, F.a)); metal *= 1.0 - 0.35 * halo; }\n" +
    "  float side = 0.45 + 0.55 * max(dot(normalize(vec2(n.x, -n.y) + 1e-4), uLightDir), 0.0);\n" +
    "  vec3 mc = metal + uRimC * fres * side * 1.2 + uIon * fres * 0.3 + refl * fres * 0.4;\n" +
    /* life inside the metal: slow luminous currents under the mirror skin, bubbles glowing from within */
    "  float cur = vn(vec2(u * 0.13 + 0.6 * sin(v * 0.08 + uTime * 0.5), v * 0.1 - uTime * 0.32)) * vn(vec2(u * 0.31 - uTime * 0.2, v * 0.23 + uTime * 0.15));\n" +
    "  float pulse = 0.85 + 0.15 * sin(uTime * 2.1 + v * 0.15);\n" +
    "  vec3 emis = mix(uR0[2], uR0[3], 0.5) * uInner * core * (0.04 + 0.55 * pow(cur, 2.6)) * pulse * (1.0 - fres);\n" +
    "  emis += mix(uR0[3], uR0[4], 0.5) * smoothstep(0.1, 0.8, F.a) * uInner * 0.6;\n" +
    "  emis = mix(vec3(dot(emis, vec3(0.3, 0.55, 0.15))) * vec3(0.9, 1.0, 1.08), emis, 0.5);\n" +
    "  mc += emis;\n" +
    "  if (uGlass > 0.5) { float outs = max(v < rimY + 0.8 ? 1.0 : smoothstep(pr.r - 0.2, pr.r + 1.4, ax), smoothstep(bottom - 0.6, bottom + 1.2, v));\n" +
    "   float fl = 0.55 + 0.45 * vn(vec2(u * 0.35, v * 0.22 - uTime * 3.4)) + 0.25 * vn(vec2(u * 0.9 + 3.0, v * 0.5 - uTime * 5.0)); vec3 molt = (vec3(1.0, 0.97, 0.9) * 1.9 + uIon * 1.2) * fl * (0.6 + 0.4 * core) + vec3(1.2, 1.25, 1.3) * pow(spk, 0.5);\n" +
    "   mc = mix(mc, mc * 0.25 + molt, outs * 0.92); }\n" +
    "  mc *= uDim;\n" +
    "  col = mix(col, mc, alpha);\n" +
    /* -- eyes + mouth, embedded in the metal -- */
    "  if (uEyeB.w > 0.01) { vec3 lidCol = mc * 0.95;\n" +
    "   float hx = uEyeA.x, ey = uEyeA.y, sp = uEyeA.z, sz = uEyeA.w;\n" +
    "   vec2 cL = vec2(hx - sp, ey), cR = vec2(hx + sp, ey); float rxL = uEyeB.x * sz * (1.0 + uMouth2.z), ryL = uEyeB.y * sz * (1.0 + uMouth2.z), rxR = uEyeB.x * sz * (1.0 - uMouth2.z), ryR = uEyeB.y * sz * (1.0 - uMouth2.z);\n" +
    "   float kL = length((q - cL) / vec2(rxL, ryL)), kR = length((q - cR) / vec2(rxR, ryR)); float sock = max(smoothstep(1.45, 0.98, kL), smoothstep(1.45, 0.98, kR));\n" +
    "   col = mix(col, col * 0.45 + uR0[0] * 0.25, sock * 0.7 * alpha * uEyeB.w); float ring = max(smoothstep(1.75, 1.3, kL) * smoothstep(0.95, 1.25, kL), smoothstep(1.75, 1.3, kR) * smoothstep(0.95, 1.25, kR)); col += uR0[4] * ring * 0.22 * alpha * uEyeB.w;\n" + /* eyes set into the chrome */
    "   vec4 eL = eye(q, cL, rxL, ryL, uLid.x, aaU, lidCol, uMouth2.w);\n" +
    "   vec4 eR = eye(q, cR, rxR, ryR, uLid.y, aaU, lidCol, -uMouth2.w);\n" +
    "   vec4 ee = eL + eR * (1.0 - eL.a); float ea = ee.a * alpha * uEyeB.w; col = mix(col, ee.rgb / max(ee.a, 1e-4), ea);\n" +
    "   vec2 mq = (q - uMouth.xy) / max(uMouth.z, 0.1); float mo = uMouth.w; float am = aaU / max(uMouth.z, 0.1) * 1.6;\n" +
    "   if (mo > 0.03) { vec2 me = mq / vec2(0.42 + 0.12 * mo, 0.08 + 0.42 * mo); float mk = length(me); float mm = smoothstep(1.0 + am * 6.0, 1.0 - am * 6.0, mk);\n" +
    "    vec3 cav = mix(uR0[0] * 0.25, uR0[2] * 0.9, smoothstep(-0.2, 1.0, me.y)) + uR0[3] * 0.25 * smoothstep(0.3, 1.0, me.y); float lip = smoothstep(0.75, 1.0, mk) * mm;\n" +
    "    col = mix(col, cav + uR0[4] * lip * 0.35, mm * alpha * uEyeB.w); }\n" +
    "   else { float sm = uMouth2.x, sk = uMouth2.y; float x = mq.x; float yc = sm * 0.2 * (1.0 - pow(x / 0.5, 2.0)) - sk * 0.16 * x - 0.06;\n" +
    "    float dd = length(vec2(max(abs(x) - 0.5, 0.0), mq.y - yc)) - 0.05; float ln = smoothstep(am, -am, dd);\n" +
    "    float lip = smoothstep(am * 2.0, -am, abs(mq.y - yc - 0.12) - 0.025) * smoothstep(0.5, 0.3, abs(x));\n" +
    "    col = mix(col, uR0[0] * 0.12, ln * alpha * uEyeB.w * 0.95); col += vec3(0.8, 0.9, 1.0) * lip * 0.25 * alpha * uEyeB.w; }\n" +
    "  }\n" +
    " }\n" +
    /* -- glass front: fresnel rims, streak highlights, mouth rim, glint, frost, kid-light rim on the wall -- */
    " vec3 hi = vec3(0.0);\n" +
    " if (mO > 0.001) { float xr = clamp((u - cx) / max(pr.g, 1.0), -1.0, 1.0); float edge = smoothstep(0.82, 1.0, abs(xr)) * smoothstep(1.0 + aaU * 3.0, 0.97, abs(xr));\n" +
    "  float lightSide = 0.55 + 0.45 * smoothstep(-0.2, 0.6, xr * uLightDir.x);\n" +
    "  float vfade = smoothstep(rimY, rimY + 8.0, v) * smoothstep(bottom, bottom - 6.0, v);\n" +
    "  hi += uRimC * edge * lightSide * 0.55;\n" +
    "  float wb = smoothstep(-0.2, 0.6, ax - pr.r) * mO; hi += vec3(0.55, 0.8, 1.0) * wb * 0.10 * vfade;\n" + /* glass wall thickness */
    "  hi += mix(uR0[4], vec3(0.85, 0.95, 1.0), 0.5) * exp(-pow((ax - pr.r) / 0.35, 2.0)) * vfade * (0.25 + 0.35 * lightSide) * (0.7 + 0.3 * sin(v * 0.35 - uTime * 1.3));\n" + /* inner-edge caustic line */
    "  hi += vec3(0.9, 0.97, 1.0) * (0.42 * exp(-pow((xr + 0.64) / 0.07, 2.0)) + 0.85 * exp(-pow((xr + 0.5) / 0.018, 2.0)) * 0.5 + 0.25 * exp(-pow((xr - 0.8) / 0.025, 2.0))) * vfade;\n" +
    "  hi += uGlowC * smoothstep(0.86, 1.0, abs(xr)) * uFill * 0.35;\n" +
    "  if (uGlint >= 0.0) { float gx = -14.0 + uGlint * 128.0; float t = ((u - gx) * 14.0 - (v - 1.0) * 10.0) / 172.0; hi += vec3(0.16) * exp(-t * t * 60.0) * vfade; }\n" +
    "  if (uFrost > 0.0) { float fr = uFrost * (smoothstep(0.6, 1.0, abs(xr)) * 0.8 + smoothstep(bottom - 16.0, bottom, v) * 0.6) * (0.55 + 0.45 * vn(q * 2.2)); col = mix(col, vec3(0.86, 0.95, 1.0), clamp(fr, 0.0, 0.8) * 0.55); }\n" +
    "  float base2 = smoothstep(floorV - 0.5, floorV + 0.5, v) * smoothstep(bottom + 0.3, bottom - 0.8, v);\n" +
    "  hi += mix(uR0[3], vec3(1.0), 0.3) * base2 * (0.25 + 0.6 * uCaustic) * (0.4 + 0.6 * exp(-pow((u - cx + pr.g * 0.45) / 4.0, 2.0)));\n" +
    " }\n" +
    " if (uGlass > 0.5) { float ry = rimY + 0.8; float rimRx = max(prof(ry + 2.0).g, 1.0); vec2 rq = vec2((u - cx) / rimRx, (v - ry) / 1.6); float rd = abs(length(rq) - 1.0);\n" +
    "  hi += vec3(0.85, 0.95, 1.0) * smoothstep(0.16, 0.0, rd) * 0.45 * smoothstep(-0.2, 0.5, rq.y + 0.4); }\n" +
    " col += hi;\n" +
    /* -- lid / cap -- */
    " float lidA = 0.0; vec3 lidC = vec3(0.0);\n" +
    " if (uLidKind > 0.5) { vec2 hg = uLidT.zw; float cr = cos(-uLidT.y), sr = sin(-uLidT.y); vec2 lq = q - hg; lq = vec2(cr * lq.x - sr * lq.y, sr * lq.x + cr * lq.y) + hg + vec2(0.0, uLidT.x);\n" +
    "  if (uLidKind < 1.5) { float d = sdBox(lq - vec2(50.0, 9.6), vec2(25.0, 5.0), 3.2); lidA = smoothstep(aaU, -aaU, d);\n" +
    "   float t = (lq.y - 4.6) / 10.0; lidC = mix(vec3(0.10, 0.16, 0.22), vec3(0.02, 0.035, 0.055), t);\n" +
    "   lidC += vec3(0.6, 0.85, 1.0) * exp(-pow((lq.y - 5.6) / 0.45, 2.0)) * 0.5 * smoothstep(24.0, 30.0, lq.x) * smoothstep(76.0, 70.0, lq.x);\n" +
    "   float inl = exp(-pow((lq.y - 10.4) / 0.38, 2.0)) * smoothstep(27.0, 31.0, lq.x) * smoothstep(73.0, 69.0, lq.x);\n" +
    "   lidC += mix(uR0[3], uR0[4], 0.5) * inl * (0.9 + 0.6 * uFill) * (0.85 + 0.15 * sin(uTime * 2.0 + lq.x * 0.3));\n" +
    "   lidC += uRimC * smoothstep(-1.2, 0.0, d) * lidA * 0.35; }\n" +
    "  else { float d = sdBox(lq - vec2(50.0, 8.8), vec2(17.0, 3.8), 1.4); float d2 = sdBox(lq - vec2(50.0, 13.7), vec2(15.6, 1.3), 0.5); lidA = max(smoothstep(aaU, -aaU, d), smoothstep(aaU, -aaU, d2));\n" +
    "   float gx = (lq.x - 33.0) / 34.0; float g = 0.35 + 0.65 * (exp(-pow((gx - 0.24) / 0.06, 2.0)) + 0.5 * exp(-pow((gx - 0.86) / 0.05, 2.0))) - 0.25 * smoothstep(0.4, 0.68, gx) * smoothstep(0.9, 0.7, gx);\n" +
    "   lidC = d < d2 ? rampN(uR2[0], uR2[1], uR2[2], uR2[3], uR2[4], g * 1.1) : vec3(0.05, 0.04, 0.03); lidC += uRimC * smoothstep(-0.8, 0.0, min(d, d2)) * 0.3; }\n" +
    " }\n" +
    " vec3 fin = mix(col, lidC, lidA);\n" +
    " float aOut = max(glassA, max(alpha * (1.0 - glassA) , lidA));\n" +
    " if (glassA > 0.001 || lidA > 0.001) { vec3 bgp = texture(uScene, uv).rgb; float cov = max(glassA, lidA); vec3 c2 = mix(bgp, fin, cov); o = vec4(c2, 1.0); return; }\n" +
    " o = vec4(fin * alpha, alpha) + outC * (1.0 - alpha); }";
  /* ---------------- bloom + final ---------------- */
  var FS_BRIGHT = "#version 300 es\nprecision highp float;\nin vec2 vUV; uniform sampler2D uT; uniform vec2 uTx; uniform float uTh; out vec4 o;\n" +
    "void main(){ vec3 c = vec3(0.0); c += texture(uT, vUV + uTx * vec2(-1, -1)).rgb; c += texture(uT, vUV + uTx * vec2(1, -1)).rgb; c += texture(uT, vUV + uTx * vec2(-1, 1)).rgb; c += texture(uT, vUV + uTx * vec2(1, 1)).rgb; c *= 0.25;\n" +
    " float l = max(c.r, max(c.g, c.b)); float k = clamp(l - uTh, 0.0, 1.5); k = k * k / (4.0 * 0.5 + 1e-4); float w = max(k, l - uTh) / max(l, 1e-4); o = vec4(c * w, 1.0); }";
  var FS_DOWN = "#version 300 es\nprecision highp float;\nin vec2 vUV; uniform sampler2D uT; uniform vec2 uTx; out vec4 o;\n" +
    "void main(){ vec3 c = texture(uT, vUV).rgb * 4.0; c += texture(uT, vUV + uTx * vec2(-1, -1)).rgb; c += texture(uT, vUV + uTx * vec2(1, -1)).rgb; c += texture(uT, vUV + uTx * vec2(-1, 1)).rgb; c += texture(uT, vUV + uTx * vec2(1, 1)).rgb; o = vec4(c / 8.0, 1.0); }";
  var FS_UP = "#version 300 es\nprecision highp float;\nin vec2 vUV; uniform sampler2D uT; uniform vec2 uTx; uniform float uW; out vec4 o;\n" +
    "void main(){ vec3 c = texture(uT, vUV + uTx * vec2(-2, 0)).rgb + texture(uT, vUV + uTx * vec2(2, 0)).rgb + texture(uT, vUV + uTx * vec2(0, -2)).rgb + texture(uT, vUV + uTx * vec2(0, 2)).rgb;\n" +
    " c += (texture(uT, vUV + uTx * vec2(-1, -1)).rgb + texture(uT, vUV + uTx * vec2(1, -1)).rgb + texture(uT, vUV + uTx * vec2(-1, 1)).rgb + texture(uT, vUV + uTx * vec2(1, 1)).rgb) * 2.0; o = vec4(c / 12.0 * uW, 1.0); }";
  var FS_FINAL = "#version 300 es\nprecision highp float;\nin vec2 vUV; uniform sampler2D uS, uB; uniform float uExp, uBloom, uTime, uVig, uGrain, uDim; uniform vec2 uRes; uniform vec4 uRev; uniform vec3 uRevC; out vec4 o;\n" +
    "vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }\n" +
    "float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n" +
    "void main(){ vec2 d = vUV - 0.5; float r2 = dot(d, d); vec2 ca = d * r2 * 0.006;\n" +
    " vec3 s = vec3(texture(uS, vUV + ca).r, texture(uS, vUV).g, texture(uS, vUV - ca).b);\n" +
    " vec3 c = s + texture(uB, vUV).rgb * uBloom; c *= uExp * uDim;\n" +
    " c = aces(c); c = pow(c, vec3(1.0 / 1.08));\n" +
    " float lum = dot(c, vec3(0.3, 0.59, 0.11)); c = max(mix(vec3(lum), c, 1.14), 0.0); c += vec3(0.004, 0.014, 0.03) * (1.0 - lum);\n" +
    " c *= mix(1.0, smoothstep(1.05, 0.2, length(d * vec2(1.0, 0.82)) * 1.15), uVig);\n" +
    " if (uRev.z < 1e5) { float dd = length(vUV * uRes - uRev.xy); float n2 = h(floor(vUV * uRes / 3.0) + floor(uTime * 20.0)) * 0.0; float rr = uRev.z + 22.0 * sin(atan(vUV.y * uRes.y - uRev.y, vUV.x * uRes.x - uRev.x) * 7.0 + uTime * 3.0) * min(1.0, uRev.z / 300.0);\n" +
    "  float m = smoothstep(rr, rr - uRev.w, dd); float ring = exp(-pow((dd - rr) / (uRev.w * 0.28 + 1.0), 2.0));\n" + /* iris of light opening from the tap point */
    "  c += (h(vUV * uRes + fract(uTime) * 91.0) - 0.5) * uGrain; float ra = max(m, clamp(ring, 0.0, 1.0)); o = vec4(c * m + uRevC * ring, ra); return; }\n" +
    " c += (h(vUV * uRes + fract(uTime) * 91.0) - 0.5) * uGrain; o = vec4(c, 1.0); }";

  function makeProg(gl, vs, fs) {
    var p = gl.createProgram(), sh = [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].map(function (x) {
      var s = gl.createShader(x[0]); gl.shaderSource(s, x[1]); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader compile: " + gl.getShaderInfoLog(s) + "\n" + x[1].split("\n").slice(0, 3).join(" "));
      gl.attachShader(p, s); return s; });
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
    sh.forEach(function (s) { gl.deleteShader(s); });
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }
  function glFlattenPath(d) {
    var t = d.match(/[MCLZ]|-?[\d.]+/g), pts = [], i = 0, cx = 0, cy = 0, cmd = "";
    function num() { return parseFloat(t[i++]); }
    while (i < t.length) {
      if (/[MCLZ]/.test(t[i])) cmd = t[i++];
      if (cmd === "M" || cmd === "L") { cx = num(); cy = num(); pts.push([cx, cy]); }
      else if (cmd === "C") { var x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
        for (var s = 1; s <= 20; s++) { var q = s / 20, a = 1 - q; pts.push([a * a * a * cx + 3 * a * a * q * x1 + 3 * a * q * q * x2 + q * q * q * x, a * a * a * cy + 3 * a * a * q * y1 + 3 * a * q * q * y2 + q * q * q * y]); }
        cx = x; cy = y; }
      else if (cmd === "Z") { if (pts.length) pts.push(pts[0].slice()); }
    }
    return pts;
  }
  function halfWidths(d, v0, v1, n) {
    var pts = glFlattenPath(d), out = new Float32Array(n);
    for (var k = 0; k < n; k++) {
      var v = v0 + (v1 - v0) * k / (n - 1), best = -1;
      for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i];
        if ((a[1] - v) * (b[1] - v) <= 0 && a[1] !== b[1]) { var x = a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]); if (x >= 50) best = Math.max(best, x - 50); } }
      out[k] = best;
    }
    return out;
  }
  var PROF_N = 512, PROF_V0 = -60, PROF_V1 = 140;

  function Scene(canvas, opts) {
    var gl = canvas.getContext("webgl2", { alpha: !!opts.alpha, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: "high-performance", preserveDrawingBuffer: !!opts.preserve });
    if (!gl) throw new Error("no webgl2");
    this.gl = gl; this.cv = canvas; this.opts = opts;
    this.hf = !!gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");
    this.P = {
      plate: makeProg(gl, VS_QUAD, FS_PLATE), fog: makeProg(gl, VS_FS, FS_FOG), rays: makeProg(gl, VS_FS, FS_RAYS),
      spr: makeProg(gl, VS_SPR, FS_SPR), blob: makeProg(gl, VS_BLOB2, FS_BLOB2), jar: makeProg(gl, VS_FS, FS_JAR),
      bright: makeProg(gl, VS_FS, FS_BRIGHT), down: makeProg(gl, VS_FS, FS_DOWN), up: makeProg(gl, VS_FS, FS_UP), fin: makeProg(gl, VS_FS, FS_FINAL)
    };
    var quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.vaoQ = gl.createVertexArray(); gl.bindVertexArray(this.vaoQ); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    /* instanced sprites */
    this.sprMax = 1600; this.sprData = new Float32Array(this.sprMax * 12); this.sprN = 0;
    this.vaoS = gl.createVertexArray(); gl.bindVertexArray(this.vaoS); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.sprBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.sprBuf); gl.bufferData(gl.ARRAY_BUFFER, this.sprData.byteLength, gl.DYNAMIC_DRAW);
    for (var a = 0; a < 3; a++) { gl.enableVertexAttribArray(1 + a); gl.vertexAttribPointer(1 + a, 4, gl.FLOAT, false, 48, a * 16); gl.vertexAttribDivisor(1 + a, 1); }
    /* metaball instances */
    this.blobMax = 2400; this.blobData = new Float32Array(this.blobMax * 8); this.blobN = 0;
    this.vaoB = gl.createVertexArray(); gl.bindVertexArray(this.vaoB); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.blobBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.blobBuf); gl.bufferData(gl.ARRAY_BUFFER, this.blobData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    /* data textures */
    this.rows = 8; this.surf = new Float32Array(128 * this.rows);
    this.tSurf = this.tex(gl.LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 128, this.rows, 0, gl.RED, gl.FLOAT, this.surf);
    this.tProf = this.tex(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, PROF_N, 2, 0, gl.RG, gl.FLOAT, new Float32Array(PROF_N * 4));
    this.tIcons = this.tex(gl.LINEAR);
    this.plates = {}; this.w = 0; this.h = 0; this.fb = {};
    var self = this; this.lost = false;
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); self.lost = true; if (self.onLost) self.onLost(); });
  }
  var SP = Scene.prototype;
  /* vessel silhouettes for the chrome-creature composite: GEO = { jar: {inner, outer}, vessel: {inner, outer} } SVG paths (row 0 / row 1) */
  SP.setProfiles = function (GEO) { var gl = this.gl, pd = new Float32Array(PROF_N * 2 * 2);
    [["jar", 0], ["vessel", 1]].forEach(function (s) { if (!GEO[s[0]]) return; var gi = halfWidths(GEO[s[0]].inner, PROF_V0, PROF_V1, PROF_N), go = halfWidths(GEO[s[0]].outer, PROF_V0, PROF_V1, PROF_N);
      for (var k = 0; k < PROF_N; k++) { pd[(s[1] * PROF_N + k) * 2] = gi[k]; pd[(s[1] * PROF_N + k) * 2 + 1] = go[k]; } });
    gl.bindTexture(gl.TEXTURE_2D, this.tProf); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, PROF_N, 2, 0, gl.RG, gl.FLOAT, pd); };
  SP.tex = function (filter) { var gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
  SP.target = function (name, w, h, mip) {
    var gl = this.gl, f = this.fb[name];
    if (f && f.w === w && f.h === h) return f;
    if (!f) { f = { t: this.tex(mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR), f: gl.createFramebuffer() }; this.fb[name] = f; }
    f.w = w; f.h = h; gl.bindTexture(gl.TEXTURE_2D, f.t);
    if (this.hf) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && this.hf) { this.hf = false; this.fb = {}; return this.target(name, w, h, mip); }
    return f;
  };
  SP.loadPlate = function (key, img, painted) { var gl = this.gl, t = this.tex(gl.LINEAR_MIPMAP_LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
    this.plates[key] = { t: t, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, paint: !!painted }; };
  SP.loadIcons = function (cv) { var gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.tIcons); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv); this.iconN = Math.max(1, Math.round(cv.width / cv.height)); };
  SP.size = function (w, h) { w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); if (w === this.w && h === this.h) return; this.w = w; this.h = h; this.cv.width = w; this.cv.height = h; };
  SP.spr = function (x0, y0, x1, y1, r, type, p1, p2, c, a) {
    if (this.sprN >= this.sprMax) return; var o = this.sprN++ * 12, d = this.sprData;
    d[o] = x0; d[o + 1] = y0; d[o + 2] = x1; d[o + 3] = y1; d[o + 4] = r; d[o + 5] = type; d[o + 6] = p1 || 0; d[o + 7] = p2 || 0;
    d[o + 8] = c[0]; d[o + 9] = c[1]; d[o + 10] = c[2]; d[o + 11] = a == null ? 1 : a; };
  SP.blob = function (x, y, rx, ry, w0, w1, w2, w3) {
    if (this.blobN >= this.blobMax || !(rx > 0.2) || !(ry > 0.2)) return; var o = this.blobN++ * 8, d = this.blobData;
    d[o] = x; d[o + 1] = y; d[o + 2] = rx; d[o + 3] = ry; d[o + 4] = w0; d[o + 5] = w1 || 0; d[o + 6] = w2 || 0; d[o + 7] = w3 || 0; };
  SP.flushSpr = function () { var gl = this.gl, P = this.P.spr; if (!this.sprN) return;
    gl.useProgram(P.p); gl.uniform2f(P.u.uRes, this.w, this.h); gl.uniform1f(P.u.uTime, this.time);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tIcons); gl.uniform1i(P.u.uIcons, 0); if (P.u.uIconN) gl.uniform1f(P.u.uIconN, this.iconN || 8);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vaoS); gl.bindBuffer(gl.ARRAY_BUFFER, this.sprBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sprData, 0, this.sprN * 12);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.sprN); this.sprN = 0; };
  function v3(c, k) { k = k == null ? 1 : k; return [c[0] / 255 * k, c[1] / 255 * k, c[2] / 255 * k]; }
  function lin(c, k) { k = k == null ? 1 : k; return [Math.pow(c[0] / 255, 1.5) * k, Math.pow(c[1] / 255, 1.5) * k, Math.pow(c[2] / 255, 1.5) * k]; } /* display-referred-ish: keeps kid colors true on the HDR path */
  var PAINTK = { sky: 1.35, far: 1.0, mid: 0.9, ground: 0.85, fore: 0.75 };
  SP.drawPlate = function (key, rect, T) {
    var pl = this.plates[key]; if (!pl) return; var gl = this.gl, P = this.P.plate, u = P.u;
    gl.useProgram(P.p); gl.uniform2f(u.uRes, this.w, this.h); gl.uniform4f(u.uRect, rect[0], rect[1], rect[2], rect[3]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pl.t); gl.uniform1i(u.uTex, 0);
    gl.uniform1f(u.uBias, T.bias || 0); gl.uniform1f(u.uTime, this.time); gl.uniform1f(u.uRimI, T.rimI); gl.uniform1f(u.uGlowI, T.glowI); gl.uniform1f(u.uFogA, T.fogA || 0); gl.uniform1f(u.uTw, T.tw == null ? 1 : T.tw); if (u.uPaint) { gl.uniform1f(u.uPaint, pl.paint ? 1 : 0); gl.uniform1f(u.uPaintK, T.paintK || PAINTK[key] || 1); }
    gl.uniform3fv(u.uDark, T.dark); gl.uniform3fv(u.uLit, T.lit); gl.uniform3fv(u.uRim, T.rim); gl.uniform3fv(u.uGlow, T.glow); gl.uniform3fv(u.uFog, T.fog || T.lit);
    gl.uniform2f(u.uLight, T.light[0], T.light[1]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.bindVertexArray(this.vaoQ); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  SP.flushBlobs = function (f, clear) { var gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, f.f); gl.viewport(0, 0, f.w, f.h);
    if (clear !== false) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } if (!this.blobN) return;
    var P = this.P.blob; gl.useProgram(P.p); gl.uniform2f(P.u.uRes, this.w, this.h); gl.uniform1f(P.u.uK, this.hf ? 1 : 0.25);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.bindVertexArray(this.vaoB); gl.bindBuffer(gl.ARRAY_BUFFER, this.blobBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.blobData, 0, this.blobN * 8); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.blobN); this.blobN = 0; };
  SP.uploadSurf = function () { var gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.tSurf); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 128, this.rows, gl.RED, gl.FLOAT, this.surf); };
  SP.copyTo = function (src, dst) { var gl = this.gl; gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.f); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.f);
    gl.blitFramebuffer(0, 0, src.w, src.h, 0, 0, dst.w, dst.h, gl.COLOR_BUFFER_BIT, gl.LINEAR); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, dst.t); gl.generateMipmap(gl.TEXTURE_2D); };
  SP.bindT = function (f) { var gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, f.f); gl.viewport(0, 0, f.w, f.h); };
  SP.full = function (P) { var gl = this.gl; gl.useProgram(P.p); gl.bindVertexArray(this.vaoQ); return P.u; };
  SP.drawFog = function (o) { var gl = this.gl, u = this.full(this.P.fog);
    gl.uniform1f(u.uTime, this.time); gl.uniform1f(u.uA, o.a); gl.uniform1f(u.uY0, o.y0); gl.uniform1f(u.uY1, o.y1); gl.uniform1f(u.uSpeed, o.speed); gl.uniform1f(u.uScale, o.scale);
    gl.uniform3fv(u.uC, o.c); gl.uniform2f(u.uAsp, this.w / this.h, 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  SP.drawRays = function (o) { var gl = this.gl, u = this.full(this.P.rays);
    gl.uniform2f(u.uL, o.L[0], o.L[1]); gl.uniform1f(u.uTime, this.time); gl.uniform1f(u.uA, o.a); gl.uniform1f(u.uAsp, this.w / this.h); gl.uniform3fv(u.uC, o.c);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  /* J: per-jar params (see Engine.renderJars) */
  SP.drawJar = function (J, sceneCopy, field) {
    var gl = this.gl, P = this.P.jar, u = P.u; gl.useProgram(P.p); gl.bindVertexArray(this.vaoQ);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneCopy.t); gl.uniform1i(u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, field.t); gl.uniform1i(u.uField, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tSurf); gl.uniform1i(u.uSurf, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tProf); gl.uniform1i(u.uProf, 3);
    gl.uniform2f(u.uRes, this.w, this.h); gl.uniform1f(u.uInvK, this.hf ? 1 : 4);
    gl.uniform4fv(u.uJar, J.jar); gl.uniform4fv(u.uSq, J.sq); gl.uniform1f(u.uRow, J.row); gl.uniform1f(u.uRows, this.rows);
    gl.uniform1f(u.uBody, J.body ? 1 : 0); gl.uniform1f(u.uGlass, J.glass ? 1 : 0);
    gl.uniform2f(u.uSurfX, J.surfX[0], J.surfX[1]); gl.uniform2f(u.uProfV, PROF_V0, PROF_V1); gl.uniform4fv(u.uGeo, J.geo);
    ["uR0", "uR1", "uR2"].forEach(function (k, i) { if (u[k]) gl.uniform3fv(u[k], J.ramps[i]); });
    gl.uniform3fv(u.uGlowC, J.glowC); gl.uniform3fv(u.uRimC, J.rimC); gl.uniform3fv(u.uIon, J.ion); gl.uniform2fv(u.uLightDir, J.lightDir);
    gl.uniform1f(u.uTime, this.time); gl.uniform1f(u.uInner, J.inner); gl.uniform1f(u.uCaustic, J.caustic); gl.uniform1f(u.uGlint, J.glint);
    gl.uniform1f(u.uFill, J.fill); gl.uniform1f(u.uHalo, J.halo); gl.uniform1f(u.uFrost, J.frost || 0); gl.uniform1f(u.uDim, J.dim == null ? 1 : J.dim);
    gl.uniform4fv(u.uEyeA, J.eyeA); gl.uniform4fv(u.uEyeB, J.eyeB); gl.uniform4fv(u.uLid, J.lid); gl.uniform4fv(u.uMouth, J.mouth); gl.uniform4fv(u.uMouth2, J.mouth2);
    gl.uniform2fv(u.uLook, J.look); gl.uniform4fv(u.uLidT, J.lidT); gl.uniform1f(u.uLidKind, J.lidKind);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(J.bbox[0], this.h - J.bbox[3], J.bbox[2] - J.bbox[0], J.bbox[3] - J.bbox[1]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST); };
  /* 2×2 clear target so final() can sample bloom when the pass is skipped. */
  SP.blankBloom = function () {
    var gl = this.gl, f = this.target("bl0", 2, 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.f); gl.viewport(0, 0, f.w, f.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return f;
  };
  SP.bloom = function (src) {
    var gl = this.gl, w = this.w, h = this.h, levels = [], i, lw = Math.max(2, w >> 1), lh = Math.max(2, h >> 1);
    var n = this.bloomLevels == null ? 6 : (this.bloomLevels | 0);
    if (n < 1) return this.blankBloom();
    gl.disable(gl.BLEND);
    for (i = 0; i < n; i++) { levels.push(this.target("bl" + i, lw, lh)); lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1); }
    var u = this.full(this.P.bright); gl.bindFramebuffer(gl.FRAMEBUFFER, levels[0].f); gl.viewport(0, 0, levels[0].w, levels[0].h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(u.uT, 0); gl.uniform2f(u.uTx, 1 / src.w, 1 / src.h); gl.uniform1f(u.uTh, this.bloomTh || 0.85);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    u = this.full(this.P.down);
    for (i = 1; i < levels.length; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, levels[i].f); gl.viewport(0, 0, levels[i].w, levels[i].h);
      gl.bindTexture(gl.TEXTURE_2D, levels[i - 1].t); gl.uniform1i(u.uT, 0); gl.uniform2f(u.uTx, 1 / levels[i - 1].w, 1 / levels[i - 1].h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    u = this.full(this.P.up); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (i = levels.length - 2; i >= 0; i--) { gl.bindFramebuffer(gl.FRAMEBUFFER, levels[i].f); gl.viewport(0, 0, levels[i].w, levels[i].h);
      gl.bindTexture(gl.TEXTURE_2D, levels[i + 1].t); gl.uniform1i(u.uT, 0); gl.uniform2f(u.uTx, 1 / levels[i + 1].w, 1 / levels[i + 1].h); gl.uniform1f(u.uW, 0.8); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    gl.disable(gl.BLEND); return levels[0];
  };
  SP.final = function (src, bl, o) { var gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.w, this.h); gl.disable(gl.BLEND);
    var u = this.full(this.P.fin); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(u.uS, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bl.t); gl.uniform1i(u.uB, 1);
    gl.uniform1f(u.uExp, o.exposure); gl.uniform1f(u.uBloom, o.bloom); gl.uniform1f(u.uTime, this.time); gl.uniform1f(u.uVig, o.vig); gl.uniform1f(u.uGrain, o.grain); gl.uniform1f(u.uDim, o.dim == null ? 1 : o.dim);
    gl.uniform2f(u.uRes, this.w, this.h); var rv = o.reveal || [0, 0, 1e6, 1]; gl.uniform4f(u.uRev, rv[0], this.h - rv[1], rv[2], rv[3]); var rc = o.revealC || [0, 0, 0]; gl.uniform3f(u.uRevC, rc[0], rc[1], rc[2]); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };

  /* ===================== WORLD: the living scene any page mounts ===================== */
  /* Painted plate sets (tools/paint.html). Each page picks a set + its own theme; kid boards add seats/pods/portal on top. */
  var KIT_LAYOUTS = {
    single:   { W: 2048, H: 1152, light: [0.63, 0.10] },
    family:   { W: 2048, H: 1152, light: [0.52, 0.08] },
    phone:    { W: 1152, H: 2048, light: [0.6, 0.07] },
    phonefam: { W: 1152, H: 2048, light: [0.55, 0.06] }
  };
  var LAYERS = ["sky", "far", "mid", "ground", "fore"];
  var DEPTH = { sky: 0.06, far: 0.16, mid: 0.36, ground: 0.62, fore: 1.25 };   /* camera-drift parallax */
  var SCROLLK = { sky: 0.08, far: 0.28, mid: 0.6, ground: 1.0, fore: 1.4 };   /* horizontal-scroll parallax (ground = 1:1) */
  /* HDR light theme. o: { acc: hex (page accent, default Ion), key: hex (the page's own glow color), night: 0..1, fog: k, rays: k } */
  function oriTheme(W, o) {
    o = o || {}; var acc = lin(hexRgb(o.acc || W.cfg.ion.acc)), kc = lin(hexRgb(o.key || o.acc || W.cfg.ion.acc2));
    var night = W.mode === "night" ? 1 : (o.night || 0), nd = 1 - 0.55 * night, fk = o.fog == null ? 1 : o.fog, rk = o.rays == null ? 1 : o.rays;
    function k(c, m) { return [c[0] * m, c[1] * m, c[2] * m]; }
    return {
      acc: acc, kid: kc, key: kc,
      sky:    { dark: [0.003, 0.011, 0.03], lit: k([0.2, 0.42, 0.6], nd), rim: [0, 0, 0], glow: k([3.6, 3.75, 3.6], nd), rimI: 0, glowI: 1, fogA: 0 },
      far:    { dark: [0.01, 0.035, 0.075], lit: k([0.1, 0.27, 0.42], nd), rim: [0.45, 0.85, 1.1], glow: k([1.2, 1.8, 2.0], nd), rimI: 0.8, glowI: 0.6, fog: k([0.13, 0.3, 0.44], nd), fogA: 0.5 },
      mid:    { dark: [0.004, 0.014, 0.034], lit: k([0.035, 0.12, 0.2], nd), rim: [0.55, 1.05, 1.45], glow: [0.6 * acc[0] + 0.4 * kc[0], 0.6 * acc[1] + 0.4 * kc[1], 0.6 * acc[2] + 0.4 * kc[2]].map(function (v) { return v * 2.4; }), rimI: 1.0, glowI: 1, fog: k([0.06, 0.16, 0.26], nd), fogA: 0.35 },
      ground: { dark: [0.002, 0.007, 0.016], lit: [0.03, 0.09, 0.15], rim: [0.45, 1.0, 1.35], glow: k(kc, 1.7), rimI: 1.0, glowI: 0.9, fog: [0.03, 0.08, 0.13], fogA: 0.2 },
      fore:   { dark: [0.0, 0.001, 0.004], lit: [0.006, 0.018, 0.03], rim: [0.12, 0.32, 0.5], glow: k(acc, 1.2), rimI: 0.6, glowI: 0.5, fogA: 0, bias: 1.2 },
      fog1: k([0.12, 0.27, 0.4], nd * fk), fog2: k([0.05, 0.14, 0.23], nd * fk), mist: k([0.06, 0.15, 0.23], fk),
      rays: k([0.75, 0.95, 1.05], nd * (1 - 0.3 * night) * rk), shafts: k([0.32, 0.6, 0.85], nd * rk),
      mote: [0.75, 1.0, 1.15], rimC: [0.55, 1.0, 1.35], ion: k(acc, 0.6)
    };
  }
  /* o: { config, plates (url base), layouts, pickLayout(aspect, world) -> name, theme(world) -> theme, motes, preserve, reduced,
         scrollWidth (extra world width in ground-plate fractions, for timelines), tile (repeat plates horizontally) } */
  function World(host, o) {
    o = o || {}; var self = this;
    this.o = o; this.cfg = deepMerge(KIT_DEFAULTS, o.config || {}); this.host = host; this.mode = "day"; this.t0 = now();
    this.plateBase = o.plates || "plates/"; this.layouts = o.layouts || KIT_LAYOUTS;
    this.sound = new Sound(this); this.forceReduced = o.reduced == null ? null : !!o.reduced; this.saver = false; this.frame = 0;
    this.mq = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (this.mq && this.mq.addEventListener) this.mq.addEventListener("change", function () { self.applyReduced(); });
    host.classList.add("ori-host", "je-host");
    this.cv = document.createElement("canvas"); this.cv.className = "ori-canvas je-canvas"; this.cv.setAttribute("aria-hidden", "true"); host.appendChild(this.cv);
    this.ui = document.createElement("div"); this.ui.className = "ori-ui je-ui"; host.appendChild(this.ui);
    this.cam = { x: new Spring(0, 7, 0.95), y: new Spring(0, 7, 0.95) }; this.ptr = null;
    this.zoom = new Spring(1, 16, 0.9); this.scroll = new Spring(0, 9, 0.92); this.scrollMax = o.scrollWidth || 0;
    this.objects = []; this.fx = []; this.sparks = []; this.btns = {};
    try { if (this.cfg.renderer === "canvas") throw new Error("canvas requested"); this.S = new Scene(this.cv, { preserve: !!o.preserve, alpha: o.alpha != null ? !!o.alpha : host.getAttribute("data-ori-alpha") === "1" }); }
    catch (e) { this.S = null; this.fallback(String(e && e.message || e)); return; }
    this.S.onLost = function () { self.fallback("context lost"); };
    if (o.icons !== false) this.S.loadIcons(glyphAtlas());
    if (o.fonts !== false) { var fl = document.fonts && document.fonts.load ? Promise.all([document.fonts.load("54px Michroma"), document.fonts.load("600 30px 'Space Grotesk'")]) : Promise.resolve();
      fl.catch(function () {}).then(function () { self.fontsOk = true; if (self.onFonts) self.onFonts(); self.kick(true); }); }
    this.buildMotes(o.motes || 130);
  }
  var WP = World.prototype;
  /* call once the subclass has added its content */
  WP.start = function () {
    var self = this; if (!this.S) return this;
    this.resize(); this.loadPlates();
    this.ro = global.ResizeObserver ? new ResizeObserver(function () { self.resize(); self.kick(); }) : null; if (this.ro) this.ro.observe(this.host);
    global.addEventListener("resize", function () { self.resize(); self.kick(); });
    document.addEventListener("visibilitychange", function () { self.kick(); });
    this.bindInput(); this.watchBattery(); this.raf = 0; this.last = 0; this.kick(); return this;
  };
  WP.fallback = function (why) { try { console.info("[ori-scene] WebGL2 unavailable (" + why + ")"); } catch (e) {} };
  WP.reduced = function () { return this.forceReduced != null ? this.forceReduced : !!(this.mq && this.mq.matches); };
  WP.applyReduced = function () { this.kick(true); };
  WP.setReduced = function (on) { this.forceReduced = on == null ? null : !!on; this.applyReduced(); if (this.onChange) this.onChange(); };
  WP.layoutName = function () { var r = this.host.getBoundingClientRect(), a = r.width / Math.max(1, r.height); return this.o.pickLayout ? this.o.pickLayout(a, this) : (a < 0.8 ? "phone" : "single"); };
  WP.resize = function () {
    if (!this.S) return; var r = this.host.getBoundingClientRect(), dpr = Math.min(this.cfg.dprMax, global.devicePixelRatio || 1);
    var rs = dpr * (this.saver ? 0.7 : 1) * (this.cfg.renderScale || 1);
    this.cssW = Math.max(2, r.width); this.cssH = Math.max(2, r.height); this.rs = rs;
    this.S.size(this.cssW * rs, this.cssH * rs); this.cv.style.width = this.cssW + "px"; this.cv.style.height = this.cssH + "px";
    var ln = this.layoutName(); if (ln !== this.lname) { this.lname = ln; this.B = this.layouts[ln]; if (this.platesReady) this.loadPlates(); if (this.onLayout) this.onLayout(ln); }
  };
  WP.loadPlates = function () {
    var self = this, ln = this.lname, set = (this.B && this.B.plates) || ln, n = 0; this.platesReady = false;
    function done() { if (++n === LAYERS.length) { self.platesReady = true; self.kick(true); if (self.onReady) self.onReady(); } }
    /* painted drop-ins: _test/plates/make_plates.py writes plates/painted/<set>-<layer>.png + plates/painted/manifest.js (window.ORI_PAINTED);
       a painted layer replaces the procedural mask plate, a missing one falls back to it. ?painted=0 forces procedural. */
    var PM = (global.ORI_PAINTED && !/[?&]painted=0/.test(global.location ? global.location.search : "")) ? global.ORI_PAINTED : {};
    var PL = global.ORI_PAINTED_LIGHT || {}; this.lightOverride = PM[set + "-sky"] && PL[set] ? PL[set] : null;
    LAYERS.forEach(function (k) { var img = new Image(), key = set + "-" + k, pv = PM[key];
      img.onload = function () { if (self.lname !== ln || !self.S) return; self.S.loadPlate(k, img, !!pv); done(); };
      img.onerror = done; var ext = global.ORI_PLATE_EXT || "png"; /* SPOTIFY1 vendored copy: plates ship as webp on Pages */
      img.src = pv ? self.plateBase + "painted/" + key + "." + ext + "?v=" + pv : self.plateBase + set + "-" + k + "." + ext; });
  };
  /* layout in render px: cover-fit plates, per-layer camera parallax, scroll parallax, dolly zoom */
  WP.layout = function () {
    var S = this.S, B = this.B, w = S.w, h = S.h, s0 = Math.max(w / B.W, h / B.H) * 1.05, cx = this.cam.x.v * this.rs, cy = this.cam.y.v * this.rs, z = this.zoom.v * (this.pushZ || 1), pf = this.pushF || [0.5, 0.5];
    var R = {}, gW = B.W * s0, sc = this.scroll.v * gW;
    LAYERS.forEach(function (k) { var d = DEPTH[k], zk = 1 + (z - 1) * (0.35 + 0.6 * d), s = s0 * (1 + 0.015 * d) * zk, W = B.W * s, H = B.H * s;
      R[k] = [w / 2 - W / 2 + cx * d - sc * SCROLLK[k] * zk + (pf[0] - 0.5) * w * (1 - zk), h / 2 - H / 2 + cy * d + (pf[1] - 0.5) * h * (1 - zk), W, H]; });
    var L = this.L = { w: w, h: h, vh: h, rect: R, cam: [cx, cy], scrollPx: sc, zoom: z,
      toPx: function (layer, fx, fy) { var r = R[layer]; return [r[0] + fx * r[2], r[1] + fy * r[3]]; },
      plateH: function (layer) { return R[layer][3]; }, k: R.ground[3] / 1100 };
    if (this.afterLayout) this.afterLayout(L);
    return L;
  };
  /* in-world objects: { pass: "far"|"mid"|"ground"|"scene"|"front"|"ui", step(t, dt, world), draw(S, L, T, t, world), hit(x, y) (render px), tap(world), label } */
  WP.add = function (obj) { this.objects.push(obj); if (obj.label) { var self = this; obj.btn = this.mkBtn(obj.label, function () { if (obj.tap) obj.tap(self); }); } this.kick(true); return obj; };
  WP.remove = function (obj) { this.objects = this.objects.filter(function (x) { return x !== obj; }); if (obj.btn) obj.btn.remove(); };
  WP.setScroll = function (f, instant) { this.scroll.t = clamp(f, 0, this.scrollMax); if (instant || this.reduced()) this.scroll.snap(); this.kick(true); };
  WP.buildMotes = function (n) {
    var R = rng(4242); this.motes = [];
    for (var i = 0; i < n; i++) { var z = R(); this.motes.push({ x: R(), y: R(), z: z, ph: R() * TAU, sp: 0.004 + R() * 0.012, fl: 0.6 + R() * 2.2, s: R() }); }
    this.wisps = []; for (var j = 0; j < 7; j++) this.wisps.push({ x: R(), y: 0.25 + R() * 0.55, ph: R() * TAU, sp: 0.01 + R() * 0.012, z: 0.35 + R() * 0.4 });
    this.R = rng(99);
  };
  WP.mkBtn = function (label, fn) { var b = document.createElement("button"); b.className = "ori-hit je-hit"; b.type = "button"; b.setAttribute("aria-label", label); b.addEventListener("click", function (e) { if (e.detail === 0) fn(); }); this.ui.appendChild(b); return b; };
  WP.placeBtn = function (b, x, y, w, h) { if (!b) return; var r = this.rs, k = [x / r - w / r / 2, y / r - h / r / 2, w / r, h / r].map(function (v) { return Math.round(v); }).join(",");
    if (b._k === k) return; b._k = k; var a = k.split(","); b.style.transform = "translate(" + a[0] + "px," + a[1] + "px)"; b.style.width = a[2] + "px"; b.style.height = a[3] + "px"; };
  /* input: pointer drives camera parallax; down/move/up go to the page (onDown/onMove/onUp) then to objects */
  WP.bindInput = function () {
    var self = this, el = this.host, drag = null;
    function P(e) { var r = self.host.getBoundingClientRect(); return [(e.clientX - r.left) * self.rs, (e.clientY - r.top) * self.rs, e.clientX - r.left, e.clientY - r.top]; }
    el.addEventListener("pointermove", function (e) { var p = P(e); self.ptr = { x: p[2] / self.cssW * 2 - 1, y: p[3] / self.cssH * 2 - 1, t: now() };
      if (drag && drag.scroll) { var gW = self.L.rect.ground[2]; self.scroll.t = clamp(drag.s0 - (p[0] - drag.x0) / gW, 0, self.scrollMax); }
      if (self.onMove) self.onMove(p, e); self.kick(); }, { passive: true });
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest(".je-panel, .ori-panel")) return; self.sound.unlock(); var p = P(e);
      if (self.onDown && self.onDown(p, e)) return;
      for (var i = self.objects.length - 1; i >= 0; i--) { var ob = self.objects[i]; if (ob.hit && ob.hit(p[0], p[1], self)) { if (ob.tap) ob.tap(self, p); self.kick(); return; } }
      if (self.scrollMax > 0) { drag = { scroll: true, x0: p[0], s0: self.scroll.t }; try { el.setPointerCapture(e.pointerId); } catch (x) {} }
    });
    el.addEventListener("pointerup", function (e) { drag = null; if (self.onUp) self.onUp(P(e), e); });
    el.addEventListener("pointercancel", function (e) { drag = null; if (self.onCancel) self.onCancel(e); });
    el.addEventListener("pointerleave", function () { self.ptr = null; });
    el.addEventListener("wheel", function (e) { if (self.scrollMax > 0) { self.scroll.t = clamp(self.scroll.t + (e.deltaX || e.deltaY) / (self.L ? self.L.rect.ground[2] : 2000), 0, self.scrollMax); self.kick(); } }, { passive: true });
  };
  WP.watchBattery = function () { var self = this; if (!this.cfg.batterySaver || !navigator.getBattery) return;
    navigator.getBattery().then(function (b) { function upd() { var s = !b.charging && b.level < 0.3; if (s !== self.saver) { self.saver = s; self.resize(); } } upd(); b.addEventListener("chargingchange", upd); b.addEventListener("levelchange", upd); }).catch(function () {}); };
  /* --- loop --- */
  WP.kick = function (force) { var self = this; if (force) this.dirty = true; if (this.raf || !this.S) return; this.raf = global.requestAnimationFrame(function () { self.raf = 0; self.tick(); }); };
  WP.tick = function () {
    if (!this.S || this.S.lost || this.dead || this.paused) return; if (document.hidden) return;
    var t = now(), cap = this.saver ? this.cfg.saverFps : this.cfg.fpsCap, red = this.reduced();
    if (!red && this.last && t - this.last < 1 / cap - 0.004) { this.kick(); return; }
    var dt = this.last ? clamp(t - this.last, 0, 0.05) : 1 / 60; this.frameGap = this.last ? (t - this.last) : 0; this.last = t;
    var busy = red && (this.dirty || this.trans);
    if (!red || busy) { this.step(t, red ? 1 / 60 : dt); if (this.platesReady) this.render(t); this.dirty = false; this.frame++;
      this.fpsN = (this.fpsN || 0) + 1; if (!this.fpsT) this.fpsT = t; if (t - this.fpsT > 1) { this.fps = this.fpsN / (t - this.fpsT); this.fpsN = 0; this.fpsT = t; } }
    if (!red || this.trans) this.kick();
  };
  /* pause while covered by a page scene (the home board sleeps under it) */
  WP.pause = function (on) { this.paused = !!on; if (!on) { this.last = 0; this.kick(true); } };
  /* slow camera push-in toward fx,fy (screen fractions) with a rack focus 0 (background sharp) -> 1 (background soft, subject sharp) */
  WP.camPush = function (z1, dur, fx, fy, k1) { var t = now(); this.camP = { t0: t, dur: dur || 10, z0: this.pushZ || 1, z1: z1 || 1.12, f0: (this.pushF || [0.5, 0.5]).slice(), f1: [fx == null ? 0.5 : fx, fy == null ? 0.5 : fy], k0: this.focusV || 0, k1: k1 == null ? 1 : k1 }; this.kick(true); return this; };
  WP.step = function (t, dt) {
    var self = this, red = this.reduced(), T = t - this.t0;
    var px = this.ptr && now() - this.ptr.t < 4 ? this.ptr.x : 0, py = this.ptr && now() - this.ptr.t < 4 ? this.ptr.y : 0;
    this.cam.x.t = -px * 26 + (red ? 0 : Math.sin(T * 0.11) * 16 + Math.sin(T * 0.047) * 9); this.cam.y.t = -py * 12 + (red ? 0 : Math.sin(T * 0.083 + 1) * 6);
    if (red) { this.cam.x.snap(); this.cam.y.snap(); this.scroll.snap(); } else { this.cam.x.step(dt); this.cam.y.step(dt); this.scroll.step(dt); }
    this.stepTransition(t, dt);
    var cp2 = this.camP; if (cp2) { var cu = red ? 1 : clamp((t - cp2.t0) / cp2.dur, 0, 1), ce = cu * cu * (3 - 2 * cu); this.pushZ = lerp(cp2.z0, cp2.z1, ce); this.pushF = [lerp(cp2.f0[0], cp2.f1[0], ce), lerp(cp2.f0[1], cp2.f1[1], ce)]; this.focusV = lerp(cp2.k0, cp2.k1, ce); }
    this.layout(); this.theme = this.o.theme ? this.o.theme(this) : oriTheme(this, {});
    if (this.lightOverride) { var tm = this.theme.mid; tm.lit = tm.lit.map(function (v) { return v * 0.5; }); tm.rimI = (tm.rimI || 1) * 0.75; tm.bias = (tm.bias || 0) + 0.45; }
    if (this.focusV != null) { var fv = this.focusV, th0 = this.theme; th0.far.bias = (th0.far.bias || 0) + 1.6 * fv; th0.mid.bias = (th0.mid.bias || 0) + 0.9 * fv; th0.fore.bias = (th0.fore.bias || 0) + 1.0 * (1 - fv) + 0.6; }
    if (this.stepWorld) this.stepWorld(t, dt, T);
    this.objects.forEach(function (ob) { if (ob.step) ob.step(t, red ? 0 : dt, self); });
    if (!red) this.motes.forEach(function (m) { m.y -= m.sp * dt * (0.6 + m.z); m.x += Math.sin(T * 0.21 + m.ph) * 0.00025 + 0.00006; if (m.y < -0.05) { m.y = 1.05; m.x = self.R(); } if (m.x > 1.05) m.x = -0.05; });
    if (!red) this.wisps.forEach(function (w) { w.x += w.sp * dt * 0.6; w.y += Math.sin(T * 0.4 + w.ph) * 0.0006; if (w.x > 1.1) { w.x = -0.1; w.y = 0.25 + self.R() * 0.55; } });
    this.sparks = this.sparks.filter(function (s) { var u = (t - s.t0) / s.life; if (u >= 1) return false; s.vx *= Math.pow(0.12, dt); s.vy = s.vy * Math.pow(0.12, dt) + s.g * self.rs * dt; s.x += s.vx * dt; s.y += s.vy * dt; return true; });
    this.fx = this.fx.filter(function (f) { return f.step(t, dt) !== false; });
  };
  /* --- page transitions: the tap should feel like the game --- */
  WP.enter = function (o) { o = o || {}; var rs = this.rs || 1, from = o.from || [this.cssW / 2, this.cssH / 2];
    this.trans = { kind: "in", t0: now(), dur: this.reduced() ? 0.35 : (o.dur || 1.35), from: [from[0] * rs, from[1] * rs], done: o.done };
    if (!this.reduced()) { this.zoom.v = 1.22; this.zoom.t = 1; this.zoom.vel = 0; } this.sound.unlock(); this.sound.whoosh(); this.kick(true); return this; };
  WP.exit = function (o) { o = o || {}; var self = this, rs = this.rs || 1, to = o.to || [this.cssW / 2, this.cssH / 2];
    return new Promise(function (res) { self.trans = { kind: "out", t0: now(), dur: self.reduced() ? 0.3 : (o.dur || 0.9), from: [to[0] * rs, to[1] * rs], done: res };
      if (!self.reduced()) self.zoom.t = 1.18; self.sound.whoosh(); self.kick(true); }); };
  WP.stepTransition = function (t, dt) { var tr = this.trans; if (!tr) { if (!this.reduced()) this.zoom.step(dt); else this.zoom.snap(); return; }
    var u = clamp((t - tr.t0) / tr.dur, 0, 1); tr.u = u; if (this.reduced()) this.zoom.snap(); else this.zoom.step(dt);
    if (u >= 1) { var d = tr.done; this.trans = tr.kind === "out" ? { kind: "closed", u: 1, from: tr.from, t0: t, dur: 1e9 } : null; if (d) d(); } };
  WP.revealParams = function () { var tr = this.trans; if (!tr) return null; var S = this.S, maxR = Math.hypot(S.w, S.h) * 1.05, u = tr.u || 0;
    var e = tr.kind === "in" ? easeInOut(u) : tr.kind === "out" ? 1 - easeInOut(u) : 0, rad = e * maxR, soft = 40 * this.rs + 160 * this.rs * e;
    var T = this.theme, g = (tr.kind === "closed" ? 0 : 0.55 * bump(e, 0, 1) + 0.12); return { reveal: [tr.from[0], tr.from[1], Math.max(0.5, rad), soft], revealC: [T.acc[0] * g, T.acc[1] * g, T.acc[2] * g], flash: 1 + 0.5 * bump(e, 0.05, 0.6) }; };
  /* --- render: 6 passes, page hooks (pass_<name>) + objects by pass --- */
  WP.pass = function (name, S, L, T, t, extra) { var self = this; var fn = this["pass_" + name]; if (fn) fn.call(this, S, L, T, t, extra);
    for (var i = 0; i < this.objects.length; i++) { var ob = this.objects[i]; if ((ob.pass || "ground") === name && ob.draw) ob.draw(S, L, T, t, self); } };
  WP.render = function (t) {
    var cost0 = (global.performance && performance.now) ? performance.now() : 0;
    var S = this.S, gl = S.gl, L = this.L, T = this.theme, B = this.B, w = S.w, h = S.h, red = this.reduced(), Tm = t - this.t0;
    S.time = red ? 12.0 : Tm;
    var sc = S.target("scene", w, h, false); S.bindT(sc);
    var g0 = lin(hexRgb(this.cfg.ion.ground)); gl.clearColor(g0[0], g0[1], g0[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    var BL = this.lightOverride || B.light, Lp = L.toPx("sky", BL[0], BL[1]), Ln = [Lp[0] / w, Lp[1] / h]; this.lightPx = Lp; this.lightN = Ln;
    var tile = !!(this.o.tile || B.tile);
    function plate(k) { var th = T[k]; th.light = Ln; var r = L.rect[k];
      if (!tile) { S.drawPlate(k, r, th); return; } var x0 = r[0] - Math.ceil(r[0] / r[2]) * r[2]; for (var x = x0; x < w; x += r[2]) S.drawPlate(k, [x, r[1], r[2], r[3]], th); }
    var night = this.mode === "night" ? 1 : 0;
    var layers = this.tierLayers == null ? 5 : this.tierLayers;
    plate("sky");
    if (this.tierRays !== false) S.drawRays({ L: Ln, a: 0.6 * (1 - 0.5 * night), c: T.rays });
    var hk = (1 - 0.6 * night) * (this.o.hotLight == null ? 1 : this.o.hotLight), hr = Math.min(w, h);
    if (hk > 0) { S.spr(Lp[0], Lp[1], Lp[0], Lp[1], hr * 0.55, 1, 0, 0, [0.5 * hk, 0.62 * hk, 0.7 * hk], 0.5); S.spr(Lp[0], Lp[1], Lp[0], Lp[1], hr * 0.16, 1, 0, 0, [2.4 * hk, 2.45 * hk, 2.3 * hk], 0.9); S.spr(Lp[0], Lp[1], Lp[0], Lp[1], hr * 0.05, 1, 0, 0, [6.0 * hk, 6.0 * hk, 5.6 * hk], 1); S.flushSpr(); }
    plate("far");
    if (this.tierFog !== false) S.drawFog({ a: 0.55, y0: 0.30, y1: 0.80, speed: 0.012, scale: 2.2, c: T.fog1 });
    this.drawMotes(0, 0.42); this.pass("far", S, L, T, t); S.flushSpr();
    if (layers >= 4) plate("mid");
    this.drawShafts(Lp, Tm); if (this.tierWisps !== false) this.drawWisps(Tm); this.pass("mid", S, L, T, t); S.flushSpr();
    if (this.tierFog !== false) S.drawFog({ a: 0.38, y0: 0.55, y1: 0.98, speed: 0.02, scale: 1.6, c: T.fog2 });
    plate("ground");
    this.drawMotes(0.42, 0.8); this.pass("ground", S, L, T, t); S.flushSpr();
    /* scene copy: refraction / reflection source for glass + liquid chrome, then the page's composite pass */
    if (layers >= 4) {
      var cp = S.target("copy", w, h, true); S.copyTo(sc, cp); S.bindT(sc);
      this.pass("scene", S, L, T, t, { sc: sc, cp: cp });
    } else this.pass("scene", S, L, T, t, { sc: sc, cp: sc });
    S.bindT(sc); S.flushSpr();
    if (this.tierFog !== false) S.drawFog({ a: 0.30, y0: 0.78, y1: 1.02, speed: 0.03, scale: 2.8, c: T.mist });
    this.pass("front", S, L, T, t); this.drawSparks(t); var self = this; this.fx.forEach(function (f) { if (f.draw) f.draw(S, L, T, t, self); }); S.flushSpr();
    if (layers >= 5) plate("fore");
    this.drawMotes(0.8, 1.01); this.pass("ui", S, L, T, t); S.flushSpr();
    var bloomAmt = this.tierBloom != null ? this.tierBloom : (this.cfg.bloom == null ? 0.62 : this.cfg.bloom);
    S.bloomLevels = this.bloomLevels == null ? 6 : this.bloomLevels;
    S.bloomTh = 1.0; var bl = bloomAmt <= 0.001 ? S.blankBloom() : S.bloom(sc), rv = this.revealParams() || {};
    S.final(sc, bl, { exposure: (this.exposure || 1) * (night ? 0.72 : 1) * (rv.flash || 1), bloom: bloomAmt, vig: this.cfg.vig == null ? 1.25 : this.cfg.vig, grain: bloomAmt > 0 ? 0.035 : 0.02, dim: 1, reveal: rv.reveal, revealC: rv.revealC });
    if (cost0 && this.onFrameCost) { try { this.onFrameCost(performance.now() - cost0); } catch (eCost) {} }
    if (this.afterRender) this.afterRender(t);
    var self2 = this; this.objects.forEach(function (ob) { if (ob.btn && ob.box) { var b = ob.box(self2); if (b) self2.placeBtn(ob.btn, b[0], b[1], b[2], b[3]); } });
  };
  WP.drawMotes = function (z0, z1) {
    var S = this.S, L = this.L, T = this.theme, Tm = this.S.time, k = L.k;
    var step = this.moteStep > 1 ? (this.moteStep | 0) : 1;
    for (var i = 0; i < this.motes.length; i += step) { var m = this.motes[i]; if (m.z < z0 || m.z >= z1) continue;
      var d = lerp(DEPTH.far, DEPTH.fore * 1.2, m.z), sk = lerp(SCROLLK.far, SCROLLK.fore, m.z), x = ((m.x * L.w - L.scrollPx * sk) % L.w + L.w) % L.w + L.cam[0] * d, y = m.y * L.h + L.cam[1] * d;
      var fl = 0.55 + 0.45 * Math.sin(Tm * m.fl + m.ph), tint = m.s < 0.22 ? T.key : T.mote;
      if (m.z > 0.8) { var r = (10 + 26 * (m.z - 0.8) / 0.2) * k * (0.6 + m.s); S.spr(x, y, x, y, r, 1, 0, 0, [tint[0] * 0.5, tint[1] * 0.5, tint[2] * 0.5], 0.10 + 0.12 * fl); }
      else { var r2 = (1.0 + 3.2 * m.z) * k * (0.7 + 0.6 * m.s), b = (0.5 + 1.6 * m.z) * fl; S.spr(x, y, x, y + r2 * 0.4, r2, 0, 0, 0, [tint[0] * b, tint[1] * b, tint[2] * b], 1); } }
  };
  WP.drawShafts = function (Lp, Tm) {
    var S = this.S, L = this.L, T = this.theme, w = L.w, h = L.h;
    var sh = [[-0.13, 0.20, 0.035, 0.8], [-0.05, 0.12, 0.05, 1.0], [0.04, 0.03, 0.03, 0.75], [0.12, -0.06, 0.06, 0.6], [0.2, -0.12, 0.028, 0.5]];
    var nSh = this.shaftN == null ? sh.length : this.shaftN;
    for (var i = 0; i < sh.length && i < nSh; i++) { var s = sh[i], x0 = Lp[0] + s[0] * w, x1 = x0 + s[1] * w, a = s[3] * (0.65 + 0.35 * Math.sin(Tm * 0.23 + i * 1.9));
      S.spr(x0, Lp[1] - 0.05 * h, x1, h * 1.02, s[2] * w, 6, 0, i * 3.7, T.shafts, 0.16 * a); }
  };
  WP.drawWisps = function (Tm) {
    var S = this.S, L = this.L, T = this.theme, k = L.k;
    for (var i = 0; i < this.wisps.length; i++) { var q = this.wisps[i], d = lerp(DEPTH.mid, DEPTH.ground, q.z), x = ((q.x * L.w - L.scrollPx * 0.7) % (L.w * 1.2) + L.w * 1.2) % (L.w * 1.2) - L.w * 0.1 + L.cam[0] * d, y = q.y * L.h + L.cam[1] * d + Math.sin(Tm * 0.9 + q.ph) * 8 * k;
      var c = [T.mote[0] * 1.6, T.mote[1] * 1.6, T.mote[2] * 1.6], pul = 0.7 + 0.3 * Math.sin(Tm * 2.1 + q.ph);
      for (var j = 1; j <= 6; j++) { var tx = x - j * 7 * k, ty = y - Math.sin(Tm * 0.9 + q.ph - j * 0.35) * 8 * k; S.spr(tx, ty, tx, ty, (3.4 - j * 0.4) * k, 0, 0, 0, c, 0.35 * (1 - j / 7)); }
      S.spr(x, y, x, y, 3.6 * k * pul, 0, 0, 0, c, 1); S.spr(x, y, x, y, 16 * k, 4, 0, 0, T.mote, 0.05); }
  };
  WP.drawSparks = function (t) { var S = this.S, T = this.theme;
    this.sparks.forEach(function (s) { var u = (t - s.t0) / s.life, c = s.col || T.mote, b = 2.2 * (1 - u) * (1 - u);
      S.spr(s.x, s.y, s.x - s.vx * 0.03, s.y - s.vy * 0.03, s.r, 0, 0, 0, [c[0] * b, c[1] * b, c[2] * b], 1); }); };
  WP.burst = function (p, col, n, o) { o = o || {}; for (var i = 0; i < n; i++) { var a = this.R() * TAU, s = (80 + this.R() * 260) * this.rs * (o.speed || 1);
    this.sparks.push({ x: p[0], y: p[1], vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120 * this.rs, life: 0.6 + this.R() * 0.9, t0: now(), r: (1.4 + this.R() * 2.2) * this.rs, col: col, g: o.g == null ? 220 : o.g }); } };
  WP.stats = function () { return { fps: this.fps || 0, w: this.S ? this.S.w : 0, h: this.S ? this.S.h : 0, gl: !!this.S, hf: this.S ? this.S.hf : false, layout: this.lname, reduced: this.reduced(), saver: this.saver, tier: this.tierId || "", layers: this.tierLayers == null ? 5 : this.tierLayers, bloom: this.tierBloom, dpr: this.cfg ? this.cfg.dprMax : 0, scale: this.cfg ? this.cfg.renderScale : 0, gap: this.frameGap || 0 }; };
  WP.destroy = function () { this.dead = true; if (this.raf) cancelAnimationFrame(this.raf); if (this.ro) this.ro.disconnect(); this.S = null; this.host.innerHTML = ""; };
  /* glowing orb object helper (lanterns, leave-by wisps, what's-next orbs...): place at ground-plate coords (fx may exceed 1 on scrolling worlds) */
  function Orb(o) { this.o = Object.assign({ layer: "ground", fx: 0.5, fy: 0.5, r: 0.02, color: null, pass: "ground", glow: 1.2, icon: null, bob: 1 }, o || {}); this.pass = this.o.pass; this.label = this.o.label; this.ph = Math.random() * 6; this.pop = new Spring(1, 120, 0.4); }
  Orb.prototype.pos = function (W) { var L = W.L, p = L.toPx(this.o.layer, this.o.fx, this.o.fy), T = (W.S ? W.S.time : 0); return [p[0], p[1] + Math.sin(T * 1.2 + this.ph) * 4 * L.k * this.o.bob]; };
  Orb.prototype.step = function (t, dt) { this.pop.step(dt); };
  Orb.prototype.draw = function (S, L, T, t, W) { var p = this.pos(W), r = this.o.r * L.plateH(this.o.layer) * this.pop.v, c = this.o.color ? lin(hexRgb(this.o.color), 2.2) : [T.key[0] * 2.2, T.key[1] * 2.2, T.key[2] * 2.2];
    S.spr(p[0], p[1], p[0], p[1], r * 3.2, 4, 0, 0, c, 0.1); S.spr(p[0], p[1], p[0], p[1], r, 3, this.o.icon == null ? 7 : this.o.icon, this.o.glow, c, 1); };
  Orb.prototype.hit = function (x, y, W) { var p = this.pos(W), r = this.o.r * W.L.plateH(this.o.layer) * 1.7; return (x - p[0]) * (x - p[0]) + (y - p[1]) * (y - p[1]) < r * r; };
  Orb.prototype.tap = function (W) { this.pop.kick(-6); W.sound.chime(null, 3); if (this.o.onTap) this.o.onTap(this, W); };
  Orb.prototype.box = function (W) { var p = this.pos(W), r = this.o.r * W.L.plateH(this.o.layer) * 3; return [p[0], p[1], r, r]; };

  /* ===================== SOUND BED (WebAudio synth: forest reverb, chimes, whooshes, creature voices; no samples, no network) ===================== */
  function Sound(E) { this.E = E; this.ctx = null; this.muted = !!(E.cfg.sound && E.cfg.sound.muted); this.vol = (E.cfg.sound && E.cfg.sound.volume) || 0.6; this.last = {}; }
  var SO = Sound.prototype;
  SO.unlock = function () {
    if (this.ctx || this.muted) { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); return; }
    var AC = global.AudioContext || global.webkitAudioContext; if (!AC) return;
    var c = this.ctx = new AC(), comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(comp);
    /* generated hall impulse: soft forest reverb */
    var len = Math.round(c.sampleRate * 2.4), ir = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    this.verb = c.createConvolver(); this.verb.buffer = ir; this.wet = c.createGain(); this.wet.gain.value = 0.32; this.verb.connect(this.wet); this.wet.connect(this.master);
    this.dry = c.createGain(); this.dry.gain.value = 1; this.dry.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); var nd = this.noiseBuf.getChannelData(0); for (var k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
    if (this.E.cfg.sound.ambient !== false) this.ambient(true);
  };
  SO.out = function (g, wet) { g.connect(this.dry); if (wet) { var w = this.ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.verb); } };
  SO.ok = function (key, gap) { if (this.muted || !this.ctx || this.E.reduced() && key === "bloop") return false; var t = this.ctx.currentTime; if (gap && this.last[key] && t - this.last[key] < gap) return false; this.last[key] = t; return true; };
  SO.env = function (g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  SO.voice = function (id) { return (this.E.voiceFor && this.E.voiceFor(id)) || { root: 220, wave: "sine", burp: 90 }; }; /* pages map ids (kids, objects) to voices */
  SO.tone = function (f, type, t, a, d, peak, wet, f2) { var c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    this.env(g, t, a, peak, d); o.connect(g); this.out(g, wet); o.start(t); o.stop(t + a + d + 0.05); return o; };
  SO.chime = function (kid, step) { if (!this.ok("chime", 0.05)) return; var v = this.voice(kid), t = this.ctx.currentTime, scale = [0, 2, 4, 7, 9, 12, 14, 16], f = v.root * 2 * Math.pow(2, scale[(step || 0) % scale.length] / 12);
    this.tone(f, "sine", t, 0.005, 1.4, 0.18, 0.9); this.tone(f * 2.76, "sine", t, 0.003, 0.5, 0.05, 0.9); this.tone(f * 5.4, "sine", t, 0.002, 0.2, 0.02, 1); };
  SO.whoosh = function () { if (!this.ok("whoosh", 0.1)) return; var c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.5); f.frequency.exponentialRampToValueAtTime(600, t + 0.9); this.env(g, t, 0.25, 0.12, 0.6); s.connect(f); f.connect(g); this.out(g, 0.6); s.start(t); s.stop(t + 1); };
  SO.slurp = function (kid) { if (!this.ok("slurp", 0.2)) return; var c = this.ctx, t = c.currentTime, v = this.voice(kid);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; f.type = "bandpass"; f.Q.value = 6; f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(1900, t + 0.32);
    this.env(g, t, 0.03, 0.35, 0.34); s.connect(f); f.connect(g); this.out(g, 0.2); s.start(t); s.stop(t + 0.45);
    this.tone(v.root * 0.9, "sine", t, 0.02, 0.3, 0.16, 0.25, v.root * 2.1); };
  SO.burp = function (kid) { if (!this.ok("burp", 0.3)) return; var c = this.ctx, t = c.currentTime, v = this.voice(kid), o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = v.wave === "triangle" ? "triangle" : "sawtooth"; o.frequency.setValueAtTime(v.burp * 1.25, t); o.frequency.exponentialRampToValueAtTime(v.burp * 0.8, t + 0.42);
    lfo.frequency.value = 28; lg.gain.value = v.burp * 0.22; lfo.connect(lg); lg.connect(o.frequency); f.type = "lowpass"; f.frequency.value = 700; f.Q.value = 3;
    this.env(g, t, 0.03, 0.32, 0.44); o.connect(f); f.connect(g); this.out(g, 0.3); o.start(t); lfo.start(t); o.stop(t + 0.55); lfo.stop(t + 0.55);
    var self = this; setTimeout(function () { if (self.ctx) self.sparkle(kid, 3); }, 260); };
  SO.boop = function (kid) { if (!this.ok("boop", 0.12)) return; var t = this.ctx.currentTime, v = this.voice(kid); this.tone(v.root * 1.5, "sine", t, 0.01, 0.16, 0.2, 0.3, v.root * 2.2); this.tone(v.root * 3, "sine", t + 0.07, 0.01, 0.18, 0.08, 0.5); };
  SO.bloop = function (kid) { if (!this.ok("bloop" + kid, 0.35)) return; var t = this.ctx.currentTime, v = this.voice(kid), f = v.root * (1.6 + Math.random() * 1.6); this.tone(f, "sine", t, 0.004, 0.09, 0.03, 0.3, f * 1.8); };
  SO.sparkle = function (kid, n) { if (!this.ok("sparkle", 0.08)) return; var t = this.ctx.currentTime, v = this.voice(kid), sc = [0, 4, 7, 11, 14, 19, 23];
    for (var i = 0; i < (n || 5); i++) { var f = v.root * 4 * Math.pow(2, sc[(Math.random() * sc.length) | 0] / 12); this.tone(f, "triangle", t + i * 0.06 + Math.random() * 0.03, 0.003, 0.5, 0.035, 1); } };
  SO.chord = function (roots) { if (!this.ok("chord", 0.5)) return; var t = this.ctx.currentTime, self = this; [0, 4, 7, 12].forEach(function (s, i) { self.tone(196 * Math.pow(2, s / 12), "sine", t + i * 0.09, 0.08, 2.4, 0.08, 0.8); }); };
  SO.firework = function () { if (!this.ok("fw", 0.05)) return; var c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; f.type = "lowpass"; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.8);
    this.env(g, t, 0.005, 0.25, 0.9); s.connect(f); f.connect(g); this.out(g, 0.7); s.start(t); s.stop(t + 1); this.sparkle(null, 6); };
  SO.ambient = function (on) { if (!this.ctx) return; if (!on) { if (this.amb) { this.amb.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5); this.amb = null; } return; } if (this.amb) return;
    var c = this.ctx, g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.05, c.currentTime, 2.0); var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 520; f.connect(g); this.out(g, 0.8);
    [98, 146.8, 196.4, 293.3].forEach(function (fr, i) { var o = c.createOscillator(); o.type = "sine"; o.frequency.value = fr * (1 + (i - 1.5) * 0.002); var og = c.createGain(); og.gain.value = 0.22 / (i + 1); o.connect(og); og.connect(f); o.start(); });
    var s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; var nf = c.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 900; nf.Q.value = 0.5; var ng = c.createGain(); ng.gain.value = 0.25; s.connect(nf); nf.connect(ng); ng.connect(f); s.start();
    this.amb = { g: g }; };
  SO.setMuted = function (m) { this.muted = !!m; if (this.ctx) { this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.08); } else if (!m) this.unlock(); };

  /* ===================== SHARED IN-WORLD OBJECTS: carved stones, glyph atlas, hanging lanterns, path (timeline) ===================== */
  /* carved stone plate: R = stone shade, G = top rim light, B = carved-text glow, A = coverage (drawn by S.drawPlate with a stone theme) */
  function carvedStone(text, sub, seed, o) {
    o = o || {}; seed = seed || 7; var big = o.size || 54, W = o.w || Math.max(360, Math.min(1800, Math.round(Math.max(text.length * big * 1.0, sub ? sub.length * big * 0.36 : 0) + 160))), H = sub ? Math.round(big * 3.2 + 40) : Math.round(big * 3.1);
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var c = cv.getContext("2d");
    var sh = document.createElement("canvas"); sh.width = W; sh.height = H; var x = sh.getContext("2d");
    x.beginPath(); for (var i = 0; i <= 64; i++) { var a = i / 64 * TAU, rx = W * 0.47, ry = H * 0.42, k = 1 + 0.05 * Math.sin(a * 3 + seed) + 0.035 * Math.sin(a * 7 + seed * 2), px = W / 2 + Math.cos(a) * rx * k, py = H * 0.5 + Math.sin(a) * ry * k * (a > Math.PI ? 1 : 0.9);
      if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); x.fillStyle = "#fff"; x.fill();
    var tx = document.createElement("canvas"); tx.width = W; tx.height = H; var t = tx.getContext("2d"); t.fillStyle = "#fff"; t.textAlign = "center"; t.textBaseline = "middle";
    var ls = o.spacing == null ? Math.round(big * 0.3) : o.spacing;
    t.font = (o.weight || "") + " " + big + "px " + (o.font || "Michroma, 'Space Grotesk', sans-serif"); try { t.letterSpacing = ls + "px"; } catch (e) {} t.fillText(o.upper === false ? text : text.toUpperCase(), W / 2 + ls / 2, sub ? H * 0.37 : H * 0.5);
    if (sub) { var sb = Math.round(big * 0.56); t.font = "500 " + sb + "px 'Space Grotesk', sans-serif"; try { t.letterSpacing = "2px"; } catch (e) {} t.fillText(sub, W / 2, H * 0.7); }
    var tb = document.createElement("canvas"); tb.width = W; tb.height = H; var b = tb.getContext("2d"); b.filter = "blur(" + Math.round(big / 11) + "px)"; b.drawImage(tx, 0, 0); b.filter = "none"; b.globalCompositeOperation = "lighter"; b.drawImage(tx, 0, 0);
    var A = x.getImageData(0, 0, W, H).data, Tt = b.getImageData(0, 0, W, H).data, Tc = t.getImageData(0, 0, W, H).data, out = c.createImageData(W, H), d = out.data, rr = Math.max(3, Math.round(H / 30));
    for (var j = 0; j < H; j++) for (var i2 = 0; i2 < W; i2++) { var q = (j * W + i2) * 4, cov = A[q + 3] / 255; var up = j > rr ? A[((j - rr) * W + i2) * 4 + 3] / 255 : 0, rim = cov * (1 - up);
      var nz = 0.5 + 0.5 * Math.sin(i2 * 0.09 + Math.sin(j * 0.13) * 2) * Math.sin(j * 0.07 + i2 * 0.02), carve = Tc[q + 3] / 255, val = (0.16 + 0.12 * nz + 0.18 * (1 - j / H)) * (1 - 0.6 * carve);
      d[q] = Math.round(clamp(val, 0, 1) * 255); d[q + 1] = Math.round(clamp(rim * 1.2, 0, 1) * 255); d[q + 2] = Math.round(clamp(Tt[q + 3] / 255 * cov, 0, 1) * 255); d[q + 3] = Math.round(cov * 255); }
    c.putImageData(out, 0, 0); return cv;
  }
  function stoneTheme(T, glowHex, o) { o = o || {}; return { dark: [0.004, 0.011, 0.02], lit: [0.07, 0.15, 0.21], rim: T.rimC, glow: glowHex ? lin(hexRgb(glowHex), o.gk || 2.4) : [T.key[0] * 2.4, T.key[1] * 2.4, T.key[2] * 2.4], rimI: 0.55, glowI: o.glowI || 1, fogA: 0, tw: 0, light: o.light || [0.5, 0.1] }; }
  /* house glyphs, 64px cells, white on black (sprite kind 3 samples .r) */
  var GLYPHS = ["sun", "calendar", "pulse", "thermo", "camera", "bulb", "jar", "compass", "broom", "hearts", "bag", "road", "idea", "basket", "hourglass", "bowl", "frame", "photo", "car", "house", "star", "timer", "bell", "door", "sparkle", "lantern", "moon", "tree"];
  function glyphAtlas() {
    var n = GLYPHS.length, cv = document.createElement("canvas"); cv.width = n * 64; cv.height = 64; var c = cv.getContext("2d");
    c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, 64); c.strokeStyle = "#fff"; c.fillStyle = "#fff"; c.lineWidth = 4; c.lineCap = "round"; c.lineJoin = "round";
    function P(f) { c.beginPath(); f(); c.stroke(); } function F(f) { c.beginPath(); f(); c.fill(); }
    var D = {
      sun: function () { P(function () { c.arc(0, 0, 8, 0, TAU); }); for (var i = 0; i < 8; i++) { var a = i / 8 * TAU; P(function () { c.moveTo(Math.cos(a) * 13, Math.sin(a) * 13); c.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); }); } },
      calendar: function () { P(function () { c.rect(-17, -13, 34, 30); c.moveTo(-17, -4); c.lineTo(17, -4); c.moveTo(-9, -18); c.lineTo(-9, -9); c.moveTo(9, -18); c.lineTo(9, -9); }); F(function () { c.arc(-7, 6, 3, 0, TAU); c.arc(7, 6, 3, 0, TAU); }); },
      pulse: function () { P(function () { c.moveTo(-19, 2); c.lineTo(-9, 2); c.lineTo(-4, -12); c.lineTo(3, 14); c.lineTo(8, 2); c.lineTo(19, 2); }); },
      thermo: function () { P(function () { c.moveTo(-4, 6); c.lineTo(-4, -14); c.arc(0, -14, 4, Math.PI, 0); c.lineTo(4, 6); }); F(function () { c.arc(0, 11, 7, 0, TAU); }); },
      camera: function () { P(function () { c.rect(-18, -9, 36, 24); c.moveTo(-7, -9); c.lineTo(-4, -15); c.lineTo(4, -15); c.lineTo(7, -9); }); P(function () { c.arc(0, 3, 7, 0, TAU); }); },
      bulb: function () { P(function () { c.arc(0, -5, 11, Math.PI * 0.8, Math.PI * 2.2); c.lineTo(5, 9); c.lineTo(-5, 9); c.closePath(); c.moveTo(-5, 14); c.lineTo(5, 14); }); },
      jar: function () { P(function () { c.rect(-9, -18, 18, 5); c.moveTo(-11, -12); c.quadraticCurveTo(-15, -10, -15, -4); c.lineTo(-15, 13); c.quadraticCurveTo(-15, 17, -11, 17); c.lineTo(11, 17); c.quadraticCurveTo(15, 17, 15, 13); c.lineTo(15, -4); c.quadraticCurveTo(15, -10, 11, -12); }); F(function () { c.rect(-12, 3, 24, 12); }); },
      compass: function () { P(function () { c.arc(0, 0, 17, 0, TAU); }); F(function () { c.moveTo(0, -12); c.lineTo(5, 0); c.lineTo(0, 12); c.lineTo(-5, 0); c.closePath(); }); },
      broom: function () { P(function () { c.moveTo(12, -18); c.lineTo(-2, 4); }); F(function () { c.moveTo(-2, 0); c.lineTo(6, 6); c.lineTo(-4, 19); c.lineTo(-17, 13); c.closePath(); }); },
      hearts: function () { function h(x, y, s) { F(function () { c.moveTo(x, y + 8 * s); c.bezierCurveTo(x - 14 * s, y - 2 * s, x - 6 * s, y - 13 * s, x, y - 5 * s); c.bezierCurveTo(x + 6 * s, y - 13 * s, x + 14 * s, y - 2 * s, x, y + 8 * s); }); } h(-6, 2, 1); h(9, -4, 0.7); },
      bag: function () { P(function () { c.rect(-14, -6, 28, 22); c.moveTo(-7, -6); c.lineTo(-7, -12); c.quadraticCurveTo(0, -19, 7, -12); c.lineTo(7, -6); c.moveTo(-14, 3); c.lineTo(14, 3); }); },
      road: function () { P(function () { c.moveTo(-6, 18); c.quadraticCurveTo(-10, 2, 0, -4); c.quadraticCurveTo(10, -10, 2, -18); c.moveTo(10, 18); c.quadraticCurveTo(4, 4, 12, -2); }); F(function () { c.arc(12, -12, 4, 0, TAU); }); },
      idea: function () { for (var i = 0; i < 3; i++) { var x0 = [-10, 9, 0][i], y0 = [6, 8, -9][i], r = [8, 6, 10][i]; F(function () { for (var k = 0; k < 8; k++) { var a = k / 8 * TAU, rr = k % 2 ? r * 0.38 : r; c.lineTo(x0 + Math.cos(a - Math.PI / 2) * rr, y0 + Math.sin(a - Math.PI / 2) * rr); } c.closePath(); }); } },
      basket: function () { P(function () { c.moveTo(-18, -2); c.lineTo(18, -2); c.lineTo(13, 16); c.lineTo(-13, 16); c.closePath(); c.moveTo(-9, -2); c.lineTo(-3, -16); c.moveTo(9, -2); c.lineTo(3, -16); c.moveTo(-6, 4); c.lineTo(-5, 11); c.moveTo(0, 4); c.lineTo(0, 11); c.moveTo(6, 4); c.lineTo(5, 11); }); },
      hourglass: function () { P(function () { c.moveTo(-12, -17); c.lineTo(12, -17); c.moveTo(-12, 17); c.lineTo(12, 17); c.moveTo(-10, -17); c.quadraticCurveTo(-10, -4, 0, 0); c.quadraticCurveTo(10, 4, 10, 17); c.moveTo(10, -17); c.quadraticCurveTo(10, -4, 0, 0); c.quadraticCurveTo(-10, 4, -10, 17); }); F(function () { c.moveTo(-6, 15); c.lineTo(6, 15); c.lineTo(0, 7); c.closePath(); }); },
      bowl: function () { P(function () { c.moveTo(-19, 0); c.lineTo(19, 0); c.quadraticCurveTo(17, 16, 0, 16); c.quadraticCurveTo(-17, 16, -19, 0); c.moveTo(-6, -6); c.quadraticCurveTo(-2, -11, -6, -16); c.moveTo(4, -6); c.quadraticCurveTo(8, -11, 4, -16); }); },
      frame: function () { P(function () { c.rect(-17, -14, 34, 28); c.moveTo(-12, 9); c.lineTo(-3, -1); c.lineTo(3, 5); c.lineTo(7, 1); c.lineTo(12, 9); }); F(function () { c.arc(7, -6, 3, 0, TAU); }); },
      photo: function () { D.camera(); F(function () { c.arc(14, -14, 5, 0, TAU); }); },
      car: function () { P(function () { c.moveTo(-19, 8); c.lineTo(-19, 0); c.lineTo(-12, -2); c.lineTo(-7, -10); c.lineTo(8, -10); c.lineTo(13, -2); c.lineTo(19, 0); c.lineTo(19, 8); c.closePath(); }); F(function () { c.arc(-10, 10, 4.5, 0, TAU); c.arc(10, 10, 4.5, 0, TAU); }); },
      house: function () { P(function () { c.moveTo(-18, -1); c.lineTo(0, -17); c.lineTo(18, -1); c.moveTo(-13, -5); c.lineTo(-13, 16); c.lineTo(13, 16); c.lineTo(13, -5); c.moveTo(-4, 16); c.lineTo(-4, 6); c.lineTo(4, 6); c.lineTo(4, 16); }); },
      star: function () { F(function () { for (var k = 0; k < 10; k++) { var a = k / 10 * TAU - Math.PI / 2, rr = k % 2 ? 7.5 : 18; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }); },
      timer: function () { P(function () { c.arc(0, 3, 15, 0, TAU); c.moveTo(0, 3); c.lineTo(0, -6); c.moveTo(0, 3); c.lineTo(7, 7); c.moveTo(-5, -17); c.lineTo(5, -17); c.moveTo(0, -17); c.lineTo(0, -12); }); },
      bell: function () { P(function () { c.moveTo(-14, 10); c.quadraticCurveTo(-10, 6, -10, -3); c.quadraticCurveTo(-10, -15, 0, -15); c.quadraticCurveTo(10, -15, 10, -3); c.quadraticCurveTo(10, 6, 14, 10); c.closePath(); }); F(function () { c.arc(0, 14, 4, 0, TAU); }); },
      door: function () { P(function () { c.rect(-11, -18, 22, 36); }); F(function () { c.arc(5, 1, 2.6, 0, TAU); }); },
      sparkle: function () { F(function () { for (var k = 0; k < 8; k++) { var a = k / 8 * TAU, rr = k % 2 ? 6 : 18; c.lineTo(Math.cos(a - Math.PI / 2) * rr, Math.sin(a - Math.PI / 2) * rr); } c.closePath(); }); },
      lantern: function () { P(function () { c.moveTo(0, -19); c.lineTo(0, -14); c.rect(-9, -14, 18, 4); c.moveTo(-8, -10); c.quadraticCurveTo(-14, 2, -8, 14); c.lineTo(8, 14); c.quadraticCurveTo(14, 2, 8, -10); }); F(function () { c.arc(0, 3, 4.5, 0, TAU); }); },
      moon: function () { F(function () { c.arc(0, 0, 16, 0.6, TAU - 0.6 + 0.0001); c.arc(8, -3, 12, TAU - 0.9, 0.9, true); c.closePath(); }); },
      tree: function () { P(function () { c.moveTo(0, 18); c.lineTo(0, 0); }); F(function () { c.moveTo(0, -19); c.lineTo(14, 4); c.lineTo(-14, 4); c.closePath(); }); }
    };
    GLYPHS.forEach(function (g, i) { c.save(); c.translate(i * 64 + 32, 32); (D[g] || D.sparkle)(); c.restore(); });
    return cv;
  }
  function glyph(name) { var i = GLYPHS.indexOf(name); return i < 0 ? GLYPHS.indexOf("sparkle") : i; }
  /* Lantern: a glowing orb hanging on a dark vine, pendulum spring + wind; carved label stone below. Tap dives into its scene.
     o: { id, label (aria + carved), sub, glyph, color, space: "view" (fx,fy of the viewport) | "plate" (fx,fy of a layer plate, scrolls with it),
          layer, fx, fy (anchor), len (vine length, view/plate height fraction), r (orb radius, fraction), depth (parallax), carve (bool), onTap(lantern, world) } */
  function Lantern(o) {
    this.o = Object.assign({ space: "view", layer: "ground", fx: 0.5, fy: 0, len: 0.2, r: 0.022, depth: 0.85, carve: true, glow: 1.15, labelW: 0.11, pass: "ground", bright: 1 }, o || {});
    this.pass = this.o.pass; this.label = this.o.label + (this.o.sub ? ". " + this.o.sub : ""); this.id = this.o.id;
    this.th = (Math.random() - 0.5) * 0.2; this.om = 0; this.ph = Math.random() * 10; this.pop = new Spring(1, 110, 0.38); this.hov = new Spring(0, 90, 0.7); this.hot = 0;
  }
  var LnP = Lantern.prototype;
  LnP.anchor = function (W) { var L = W.L, o = this.o; if (o.space === "plate") return L.toPx(o.layer, o.fx, o.fy);
    return [o.fx * L.w + L.cam[0] * o.depth, o.fy * L.h + L.cam[1] * o.depth]; };
  LnP.unit = function (W) { var L = W.L; return this.o.space === "plate" ? L.plateH(this.o.layer) : Math.min(L.h, L.w * 1.25); };
  LnP.pos = function (W) { var A = this.anchor(W), l = this.o.len * (this.o.space === "plate" ? this.unit(W) : W.L.h); return [A[0] + Math.sin(this.th) * l, A[1] + Math.cos(this.th) * l]; };
  LnP.step = function (t, dt, W) { this.pop.step(dt); this.hov.step(dt); if (!dt) { this.th = 0; return; }
    var T = t - W.t0, wind = 0.22 * Math.sin(T * 0.31 + this.ph * 0.3) + 0.14 * Math.sin(T * 0.73 + this.ph), l = Math.max(0.05, this.o.len) * 6;
    var acc = -(9.8 / l) * Math.sin(this.th) - 1.2 * this.om + wind * 0.5 / (1 + l * 0.6); this.om += acc * dt; this.th = clamp(this.th + this.om * dt, -0.16, 0.16); };
  LnP.ensurePlate = function (W) { if (!this.o.carve || this.plated || !W.fontsOk) return; var cv = carvedStone(this.o.label, this.o.sub, 3 + (this.o.fx * 97 | 0), { size: this.o.size || 44, weight: "600", font: "'Space Grotesk', sans-serif", spacing: 7 });
    W.S.loadPlate("lbl-" + this.id, cv); this.ar = cv.height / cv.width; this.lw = cv.width; this.plated = true; };
  LnP.draw = function (S, L, T, t, W) {
    this.ensurePlate(W); var A = this.anchor(W), P = this.pos(W), u = this.unit(W), k = L.k || 1, r = this.o.r * u * this.pop.v * (1 + 0.12 * this.hov.v), Tm = t - W.t0;
    var c = this.o.color ? lin(hexRgb(this.o.color), 2.2) : [T.key[0] * 2.2, T.key[1] * 2.2, T.key[2] * 2.2], br = this.o.bright * (0.9 + 0.1 * Math.sin(Tm * 1.3 + this.ph)) * (1 + 0.6 * this.hov.v + 1.2 * this.hot);
    /* vine: dark capsule chain with a gentle catenary bend and a couple of leaves */
    var n = 10, prv = A; for (var i = 1; i <= n; i++) { var f = i / n, bend = Math.sin(f * Math.PI) * 0.035 * u * Math.sin(Tm * 0.5 + this.ph),
        x = lerp(A[0], P[0], f) + bend, y = lerp(A[1], P[1] - r * 1.05, f); S.spr(prv[0], prv[1], x, y, lerp(3.6, 1.6, f) * k, 5, 0, 0, [0.003, 0.009, 0.018], 1); prv = [x, y];
      if (i === 3 || i === 6) { var s2 = i === 3 ? 1 : -1, ll = 9 * k; S.spr(x, y, x + s2 * ll, y + ll * 0.4, ll * 0.32, 2, 0.12, 0, [0.004, 0.012, 0.024], 1); } }
    S.spr(P[0], P[1] + r * 0.3, P[0], P[1] + r * 0.3, r * 3.4, 4, 0, 0, c, 0.09 * br);
    S.spr(P[0], P[1], P[0], P[1], r, 3, this.o.glyph == null ? glyph("sparkle") : (typeof this.o.glyph === "number" ? this.o.glyph : glyph(this.o.glyph)), this.o.glow * br, c, 1);
    if (this.plated && S.plates["lbl-" + this.id]) { var w2 = (this.o.labelW * (this.o.space === "plate" ? L.plateH(this.o.layer) * 1.78 : L.w)) * (this.o.labelK || 1) * (this.lw / 520), h2 = w2 * this.ar;
      w2 = Math.max(w2, 0); S.drawPlate("lbl-" + this.id, [P[0] - w2 / 2, P[1] + r * 1.35, w2, h2], stoneTheme(T, this.o.color, { glowI: 0.8 + 0.5 * this.hov.v + this.hot, light: W.lightN })); }
  };
  LnP.hit = function (x, y, W) { var P = this.pos(W), r = this.o.r * this.unit(W) * 2.0; var dy = y - P[1]; return Math.abs(x - P[0]) < r && dy > -r && dy < r * 2.2; };
  LnP.tap = function (W) { this.pop.kick(-7); this.om += 1.6 * (Math.random() < 0.5 ? -1 : 1); W.sound.chime(null, 3); if (this.o.onTap) this.o.onTap(this, W); };
  LnP.box = function (W) { var P = this.pos(W), r = this.o.r * this.unit(W) * 3.2; return [P[0], P[1] + r * 0.3, r, r * 1.4]; };
  /* screen point (CSS px) for page transitions */
  LnP.cssPos = function (W) { var P = this.pos(W); return [P[0] / W.rs, P[1] / W.rs]; };
  /* Path: a horizontally scrolling glowing trail across the ground plate (Calendar World's forest path, timelines).
     o: { y0, amp, color, x0, x1 (ground-plate fractions, x1 may exceed 1 when the world scrolls) } ; at(f) -> [px, py] */
  function Path(o) { this.o = Object.assign({ x0: 0.02, x1: 1.0, y0: 0.82, amp: 0.025, color: null, pass: "ground", dots: 120 }, o || {}); this.pass = this.o.pass; }
  Path.prototype.yAt = function (fx) { var o = this.o; return o.y0 + o.amp * Math.sin(fx * 9.0) + o.amp * 0.5 * Math.sin(fx * 23.0 + 1.3); };
  Path.prototype.at = function (W, fx) { return W.L.toPx("ground", fx, this.yAt(fx)); };
  Path.prototype.draw = function (S, L, T, t, W) { var o = this.o, c = o.color ? lin(hexRgb(o.color), 1.6) : [T.key[0] * 1.6, T.key[1] * 1.6, T.key[2] * 1.6], prv = null, Tm = t - W.t0, k = L.k || 1;
    for (var i = 0; i <= o.dots; i++) { var f = lerp(o.x0, o.x1, i / o.dots), p = this.at(W, f); if (p[0] < -60 || p[0] > L.w + 60) { prv = p; continue; }
      var fade = W.pathFade ? W.pathFade(f) : 1, b = (0.55 + 0.45 * Math.sin(f * 60 - Tm * 1.6)) * fade;
      if (prv) S.spr(prv[0], prv[1], p[0], p[1], 2.2 * k, 0, 0, 0, [c[0] * b, c[1] * b, c[2] * b], 0.8); prv = p; }
  };

  /* mount a page scene from a home-board tile: the tile swells into a light-iris, the scene dollies in behind it.
     tileEl: the tapped element; make(host) -> World (unstarted or started). Returns the world. Exit with world.exit().then(close). */
  function openFromTile(tileEl, make, o) {
    o = o || {}; var r = tileEl ? tileEl.getBoundingClientRect() : o.from ? { left: o.from[0], top: o.from[1], width: 0, height: 0 } : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    var host = document.createElement("div"); host.className = "ori-page"; host.style.cssText = "position:fixed;inset:0;z-index:" + (o.z || 50) + ";";
    host.setAttribute("data-ori-alpha", "1"); (o.parent || document.body).appendChild(host);
    var W = make(host); var from = [r.left + r.width / 2, r.top + r.height / 2];
    if (tileEl && tileEl.animate && !(W && W.reduced && W.reduced())) tileEl.animate([{ transform: "scale(1)", filter: "brightness(1)" }, { transform: "scale(1.08)", filter: "brightness(2.2)" }, { transform: "scale(1)", filter: "brightness(1)" }], { duration: 520, easing: "cubic-bezier(.2,.9,.2,1)" });
    if (W && W.enter) { if (W.platesReady) W.enter({ from: from }); else { var prev = W.onReady; W.onReady = function () { if (prev) prev.call(W); W.enter({ from: from }); W.onReady = prev; }; W.enter({ from: from }); } }
    W.close = function () { return W.exit({ to: from }).then(function () { W.destroy(); host.remove(); }); };
    return W;
  }
  return {
    version: "0.4.0",
    World: World, Scene: Scene, Sound: Sound, Spring: Spring, Orb: Orb, oriTheme: oriTheme, openFromTile: openFromTile,
    Lantern: Lantern, Path: Path, carvedStone: carvedStone, stoneTheme: stoneTheme, glyphAtlas: glyphAtlas, glyph: glyph, GLYPHS: GLYPHS,
    LAYOUTS: KIT_LAYOUTS, DEPTH: DEPTH, SCROLLK: SCROLLK, DEFAULTS: KIT_DEFAULTS,
    util: { clamp: clamp, lerp: lerp, sstep: sstep, easeOut: easeOut, easeInOut: easeInOut, bump: bump, now: now, hexRgb: hexRgb, rgba: rgba, mixc: mixc, rng: rng, deepMerge: deepMerge, lin: lin, TAU: TAU }
  };
});
