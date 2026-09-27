/* House face · theme SFX + VFX · original Web Audio only · respects mute + reduced-motion */
(function (global) {
  "use strict";

  var MUTE_KEY = "house-sfx:mute";

  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) { return false; }
  }

  function isMuted() {
    try {
      if (localStorage.getItem(MUTE_KEY) === "1") return true;
    } catch (e) { /* */ }
    var root = document.documentElement.getAttribute("data-sound");
    if (root === "off" || root === "0" || root === "false") return true;
    return false;
  }

  function setMuted(on) {
    try { localStorage.setItem(MUTE_KEY, on ? "1" : "0"); } catch (e) { /* */ }
    document.documentElement.setAttribute("data-sound", on ? "off" : "on");
    document.body.classList.toggle("sfx-muted", !!on);
    document.querySelectorAll("[data-mute-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "🔇 Mute" : "🔊 Sound";
    });
  }

  var _ctx = null;
  function ctx() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_ctx) _ctx = new AC();
    if (_ctx.state === "suspended") _ctx.resume();
    return _ctx;
  }

  function envGain(peak, attack, dur, t0) {
    var c = ctx();
    if (!c) return null;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(c.destination);
    return g;
  }

  function osc(freq, type, peak, attack, dur, t0, slideTo) {
    if (isMuted() || reducedMotion()) return;
    try {
      var c = ctx();
      if (!c) return;
      t0 = t0 != null ? t0 : c.currentTime;
      var o = c.createOscillator();
      var g = envGain(peak || 0.05, attack || 0.01, dur || 0.2, t0);
      if (!g) return;
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      o.connect(g);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    } catch (e) { /* */ }
  }

  function noiseBurst(peak, dur, t0) {
    if (isMuted() || reducedMotion()) return;
    try {
      var c = ctx();
      if (!c) return;
      t0 = t0 != null ? t0 : c.currentTime;
      var n = c.createBufferSource();
      var len = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      n.buffer = buf;
      var g = envGain(peak || 0.04, 0.005, dur, t0);
      if (!g) return;
      var f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1200;
      n.connect(f);
      f.connect(g);
      n.start(t0);
      n.stop(t0 + dur + 0.02);
    } catch (e) { /* */ }
  }

  var theme = function () {
    return document.body.getAttribute("data-theme") ||
      (document.body.classList.contains("theme-harris") ? "harris" :
       document.body.classList.contains("theme-hayes") ? "hayes" :
       document.body.classList.contains("theme-ainsley") ? "ainsley" : "house");
  };

  /* —— Theme SFX packs (homage, original synth) —— */
  function sfxQuest() {
    var t = theme();
    var c = ctx();
    if (!c || isMuted()) return;
    var t0 = c.currentTime;
    if (t === "harris") {
      // place/break block click + soft wood
      osc(180, "square", 0.06, 0.005, 0.08, t0);
      osc(90, "sawtooth", 0.04, 0.01, 0.12, t0 + 0.02, 60);
      noiseBurst(0.035, 0.1, t0);
    } else if (t === "hayes") {
      // eliminate / hit marker
      osc(880, "square", 0.05, 0.005, 0.07, t0);
      osc(440, "sawtooth", 0.045, 0.01, 0.14, t0 + 0.04, 220);
      noiseBurst(0.05, 0.12, t0 + 0.02);
    } else if (t === "ainsley") {
      // sparkle chime
      osc(988, "sine", 0.045, 0.01, 0.18, t0);
      osc(1319, "sine", 0.035, 0.01, 0.22, t0 + 0.05);
      osc(1760, "triangle", 0.025, 0.01, 0.28, t0 + 0.1);
    } else {
      osc(880, "sine", 0.05, 0.01, 0.12, t0);
    }
  }

  function sfxClear() {
    var t = theme();
    var c = ctx();
    if (!c || isMuted()) return;
    var t0 = c.currentTime;
    if (t === "harris") {
      // level-up jingle (original)
      [523, 659, 784, 1047].forEach(function (f, i) {
        osc(f, "square", 0.055, 0.01, 0.22, t0 + i * 0.09);
      });
      noiseBurst(0.04, 0.25, t0 + 0.3);
    } else if (t === "hayes") {
      // victory stinger
      osc(392, "sawtooth", 0.05, 0.01, 0.2, t0);
      osc(523, "sawtooth", 0.05, 0.01, 0.22, t0 + 0.1);
      osc(784, "square", 0.06, 0.01, 0.35, t0 + 0.2);
      osc(1175, "square", 0.04, 0.01, 0.4, t0 + 0.32);
      noiseBurst(0.06, 0.3, t0 + 0.15);
    } else if (t === "ainsley") {
      // encore whoosh + sparkle cascade
      noiseBurst(0.05, 0.35, t0);
      [659, 831, 988, 1319, 1568].forEach(function (f, i) {
        osc(f, "sine", 0.04, 0.02, 0.35, t0 + 0.08 + i * 0.07);
      });
    } else {
      [523, 659, 784, 1047].forEach(function (f, i) {
        osc(f, "triangle", 0.05, 0.01, 0.25, t0 + i * 0.08);
      });
    }
  }

  function sfxTap() {
    if (isMuted()) return;
    osc(660, "square", 0.025, 0.003, 0.05, null);
  }

  /* —— VFX —— */
  function ensureLayer() {
    var el = document.getElementById("house-vfx-layer");
    if (el) return el;
    el = document.createElement("div");
    el.id = "house-vfx-layer";
    el.className = "house-vfx-layer";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    return el;
  }

  function spawnParticles(x, y, kind, count) {
    if (reducedMotion()) return;
    var layer = ensureLayer();
    var n = count || 14;
    var t = kind || theme();
    for (var i = 0; i < n; i++) {
      var p = document.createElement("i");
      p.className = "vfx-bit vfx-" + t;
      var ang = (Math.PI * 2 * i) / n + (Math.random() * 0.4);
      var dist = 60 + Math.random() * 140;
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      p.style.setProperty("--rot", (Math.random() * 240 - 120) + "deg");
      p.style.animationDelay = (Math.random() * 0.08) + "s";
      layer.appendChild(p);
      (function (node) {
        window.setTimeout(function () { node.remove(); }, 1100);
      })(p);
    }
  }

  function boomAt(el, kind) {
    if (reducedMotion()) return;
    var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    spawnParticles(x, y, kind || theme(), 18);
    // local flash
    if (el) {
      el.classList.remove("vfx-boom");
      void el.offsetWidth;
      el.classList.add("vfx-boom");
      window.setTimeout(function () { el.classList.remove("vfx-boom"); }, 500);
    }
  }

  function screenShake() {
    if (reducedMotion()) return;
    document.body.classList.remove("vfx-shake");
    void document.body.offsetWidth;
    document.body.classList.add("vfx-shake");
    window.setTimeout(function () { document.body.classList.remove("vfx-shake"); }, 420);
  }

  function celebrateClear() {
    sfxClear();
    if (reducedMotion()) return;
    screenShake();
    var layer = ensureLayer();
    var burst = document.createElement("div");
    burst.className = "vfx-mega vfx-" + theme();
    layer.appendChild(burst);
    // confetti rain
    for (var i = 0; i < 36; i++) {
      var p = document.createElement("i");
      p.className = "vfx-bit vfx-rain vfx-" + theme();
      p.style.left = Math.random() * 100 + "vw";
      p.style.top = "-10px";
      p.style.setProperty("--dx", (Math.random() * 80 - 40) + "px");
      p.style.setProperty("--dy", (window.innerHeight * 0.7 + Math.random() * 200) + "px");
      p.style.animationDuration = 0.9 + Math.random() * 0.8 + "s";
      layer.appendChild(p);
      (function (node) {
        window.setTimeout(function () { node.remove(); }, 1800);
      })(p);
    }
    window.setTimeout(function () { burst.remove(); }, 1400);
  }

  function questPop(el) {
    sfxQuest();
    boomAt(el);
  }

  function wireMute() {
    setMuted(isMuted());
    document.querySelectorAll("[data-mute-toggle]").forEach(function (btn) {
      if (btn.getAttribute("data-mute-wired") === "1") return;
      btn.setAttribute("data-mute-wired", "1");
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        setMuted(!isMuted());
        if (!isMuted()) sfxTap();
      });
    });
  }

  // Hook into checkoff clears / quest taps via events + delegation
  document.addEventListener("house:cleared", function () {
    celebrateClear();
  });

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest(".quest, .chore, [data-check]");
    if (!el) return;
    // play after toggle — slight delay so done class applies
    window.setTimeout(function () {
      if (el.classList.contains("done") || el.classList.contains("lit")) {
        questPop(el);
      }
    }, 10);
  });

  function boot() {
    wireMute();
    // sync mute from storage to data-sound
    if (isMuted()) document.documentElement.setAttribute("data-sound", "off");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.HouseSfx = {
    quest: sfxQuest,
    clear: sfxClear,
    tap: sfxTap,
    boomAt: boomAt,
    celebrateClear: celebrateClear,
    screenShake: screenShake,
    setMuted: setMuted,
    isMuted: isMuted,
    wireMute: wireMute
  };
})(window);
