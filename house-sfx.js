/* House face · LOUD kid SFX + VFX · original Web Audio · mute + reduced-motion safe */
(function (global) {
  "use strict";
  var MUTE_KEY = "house-sfx:mute";
  var AMBIENT_KEY = "house-sfx:ambient";

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }
  function isMuted() {
    try { if (localStorage.getItem(MUTE_KEY) === "1") return true; } catch (e) {}
    var root = document.documentElement.getAttribute("data-sound");
    return root === "off" || root === "0" || root === "false";
  }
  function setMuted(on) {
    try { localStorage.setItem(MUTE_KEY, on ? "1" : "0"); } catch (e) {}
    document.documentElement.setAttribute("data-sound", on ? "off" : "on");
    document.body.classList.toggle("sfx-muted", !!on);
    document.querySelectorAll("[data-mute-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "🔇 OFF" : "🔊 ON";
    });
    if (on) stopAmbient(); else startAmbient();
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
    var c = ctx(); if (!c) return null;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(c.destination);
    return g;
  }
  function osc(freq, type, peak, attack, dur, t0, slideTo) {
    if (isMuted()) return;
    try {
      var c = ctx(); if (!c) return;
      t0 = t0 != null ? t0 : c.currentTime;
      var o = c.createOscillator();
      var g = envGain(peak || 0.06, attack || 0.01, dur || 0.2, t0);
      if (!g) return;
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      o.connect(g); o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) {}
  }
  function noiseBurst(peak, dur, t0, filterFreq) {
    if (isMuted()) return;
    try {
      var c = ctx(); if (!c) return;
      t0 = t0 != null ? t0 : c.currentTime;
      var n = c.createBufferSource();
      var len = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.6);
      n.buffer = buf;
      var g = envGain(peak || 0.05, 0.004, dur, t0);
      if (!g) return;
      var f = c.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = filterFreq || 1400; f.Q.value = 0.8;
      n.connect(f); f.connect(g); n.start(t0); n.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  function theme() {
    return document.body.getAttribute("data-theme") ||
      (document.body.classList.contains("theme-harris") ? "harris" :
       document.body.classList.contains("theme-hayes") ? "hayes" :
       document.body.classList.contains("theme-ainsley") ? "ainsley" : "house");
  }

  function sfxQuest() {
    var t = theme(), c = ctx(); if (!c || isMuted()) return;
    var t0 = c.currentTime;
    if (t === "harris") {
      osc(160, "square", 0.09, 0.004, 0.07, t0);
      osc(80, "sawtooth", 0.07, 0.008, 0.14, t0 + 0.03, 50);
      osc(320, "square", 0.05, 0.004, 0.06, t0 + 0.06);
      noiseBurst(0.07, 0.12, t0, 900);
    } else if (t === "hayes") {
      osc(1100, "square", 0.08, 0.003, 0.06, t0);
      osc(550, "sawtooth", 0.07, 0.008, 0.16, t0 + 0.04, 180);
      osc(2200, "square", 0.035, 0.003, 0.05, t0 + 0.02);
      noiseBurst(0.08, 0.15, t0 + 0.02, 2000);
    } else if (t === "ainsley") {
      [988, 1319, 1568, 2093].forEach(function (f, i) {
        osc(f, "sine", 0.05, 0.01, 0.22, t0 + i * 0.045);
      });
      noiseBurst(0.03, 0.2, t0, 3000);
    } else {
      osc(880, "sine", 0.06, 0.01, 0.12, t0);
    }
  }

  function sfxClear() {
    var t = theme(), c = ctx(); if (!c || isMuted()) return;
    var t0 = c.currentTime;
    if (t === "harris") {
      [392, 523, 659, 784, 1047].forEach(function (f, i) {
        osc(f, "square", 0.07, 0.01, 0.28, t0 + i * 0.08);
      });
      noiseBurst(0.08, 0.35, t0 + 0.35, 700);
    } else if (t === "hayes") {
      // VICTORY ROYALE-ish original stinger
      osc(196, "sawtooth", 0.07, 0.01, 0.25, t0);
      osc(392, "sawtooth", 0.08, 0.01, 0.3, t0 + 0.12);
      osc(587, "square", 0.08, 0.01, 0.35, t0 + 0.24);
      osc(784, "square", 0.07, 0.01, 0.4, t0 + 0.36);
      osc(1175, "square", 0.06, 0.01, 0.5, t0 + 0.48);
      noiseBurst(0.1, 0.45, t0 + 0.2, 1800);
    } else if (t === "ainsley") {
      noiseBurst(0.06, 0.4, t0, 2500);
      [523, 659, 784, 988, 1319, 1568].forEach(function (f, i) {
        osc(f, "sine", 0.055, 0.02, 0.4, t0 + 0.05 + i * 0.07);
      });
    } else {
      [523, 659, 784, 1047].forEach(function (f, i) {
        osc(f, "triangle", 0.06, 0.01, 0.25, t0 + i * 0.08);
      });
    }
  }

  function sfxGoal() {
    var c = ctx(); if (!c || isMuted()) return;
    var t0 = c.currentTime;
    sfxClear();
    // Extra fanfare layer
    [880, 1108, 1318, 1760].forEach(function (f, i) {
      osc(f, "triangle", 0.06, 0.02, 0.45, t0 + 0.5 + i * 0.1);
    });
    noiseBurst(0.09, 0.5, t0 + 0.55, 1200);
  }

  function sfxTap() {
    if (isMuted()) return;
    osc(720, "square", 0.03, 0.002, 0.04, null);
  }

  /* Ambient beds — very quiet loops */
  var _ambNodes = [];
  function stopAmbient() {
    _ambNodes.forEach(function (n) { try { n.stop(); } catch (e) {} });
    _ambNodes = [];
  }
  function startAmbient() {
    stopAmbient();
    if (isMuted() || reducedMotion()) return;
    var c = ctx(); if (!c) return;
    var t = theme();
    try {
      var o = c.createOscillator();
      var g = c.createGain();
      g.gain.value = 0.008;
      o.type = "sine";
      if (t === "harris") o.frequency.value = 65;
      else if (t === "hayes") o.frequency.value = 90;
      else if (t === "ainsley") o.frequency.value = 110;
      else o.frequency.value = 80;
      var lfo = c.createOscillator();
      var lg = c.createGain();
      lg.gain.value = 0.004;
      lfo.frequency.value = t === "ainsley" ? 0.15 : 0.08;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(c.destination);
      o.start(); lfo.start();
      _ambNodes.push(o, lfo);
    } catch (e) {}
  }

  /* VFX layer */
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
    var n = count || 22;
    var t = kind || theme();
    for (var i = 0; i < n; i++) {
      var p = document.createElement("i");
      p.className = "vfx-bit vfx-" + t;
      var ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      var dist = 80 + Math.random() * 180;
      p.style.left = x + "px"; p.style.top = y + "px";
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      p.style.setProperty("--rot", (Math.random() * 300 - 150) + "deg");
      p.style.animationDelay = (Math.random() * 0.1) + "s";
      layer.appendChild(p);
      (function (node) { window.setTimeout(function () { node.remove(); }, 1200); })(p);
    }
  }

  function floatPopup(el, text) {
    if (reducedMotion()) return;
    var layer = ensureLayer();
    var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    var pop = document.createElement("div");
    pop.className = "vfx-float vfx-" + theme();
    pop.textContent = text;
    pop.style.left = (r.left + r.width / 2) + "px";
    pop.style.top = (r.top + 8) + "px";
    layer.appendChild(pop);
    window.setTimeout(function () { pop.remove(); }, 1100);
  }

  function boomAt(el, kind) {
    if (reducedMotion()) return;
    var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    spawnParticles(r.left + r.width / 2, r.top + r.height / 2, kind || theme(), 24);
    if (el) {
      el.classList.remove("vfx-boom"); void el.offsetWidth; el.classList.add("vfx-boom");
      window.setTimeout(function () { el.classList.remove("vfx-boom"); }, 500);
    }
  }

  function screenShake(hard) {
    if (reducedMotion()) return;
    document.body.classList.remove("vfx-shake", "vfx-shake-hard");
    void document.body.offsetWidth;
    document.body.classList.add(hard ? "vfx-shake-hard" : "vfx-shake");
    window.setTimeout(function () {
      document.body.classList.remove("vfx-shake", "vfx-shake-hard");
    }, hard ? 650 : 420);
  }

  function celebrateClear() {
    sfxClear();
    if (reducedMotion()) return;
    screenShake(true);
    var layer = ensureLayer();
    var burst = document.createElement("div");
    burst.className = "vfx-mega vfx-" + theme();
    layer.appendChild(burst);
    for (var i = 0; i < 48; i++) {
      var p = document.createElement("i");
      p.className = "vfx-bit vfx-rain vfx-" + theme();
      p.style.left = Math.random() * 100 + "vw";
      p.style.top = "-12px";
      p.style.setProperty("--dx", (Math.random() * 100 - 50) + "px");
      p.style.setProperty("--dy", (window.innerHeight * 0.75 + Math.random() * 220) + "px");
      p.style.animationDuration = 0.85 + Math.random() * 0.9 + "s";
      layer.appendChild(p);
      (function (node) { window.setTimeout(function () { node.remove(); }, 1900); })(p);
    }
    window.setTimeout(function () { burst.remove(); }, 1500);
  }

  function celebrateGoal(rewardText) {
    sfxGoal();
    if (reducedMotion()) {
      document.body.classList.add("bank-goal-hit");
      return;
    }
    celebrateClear();
    var layer = ensureLayer();
    var banner = document.createElement("div");
    banner.className = "vfx-goal-banner vfx-" + theme();
    banner.innerHTML = "<div class='g-title'>UNLOCKED!!!</div><div class='g-sub'>" +
      (rewardText || "Ask Dad for your reward") + "</div>";
    layer.appendChild(banner);
    document.body.classList.add("bank-goal-hit");
    window.setTimeout(function () { banner.remove(); }, 2800);
  }

  function currencyLabel() {
    var t = theme();
    if (t === "harris") return "+1 GEM ◆";
    if (t === "hayes") return "+1 COIN ◎";
    if (t === "ainsley") return "+1 STAR ★";
    return "+1 ★";
  }

  function questPop(el) {
    sfxQuest();
    boomAt(el);
    floatPopup(el, currencyLabel());
    // light hotbar / era / loadout react
    document.querySelectorAll(".hotbar-slot, .loadout-slot, .track-dot, .era").forEach(function (s, i) {
      if (i > 4) return;
      s.classList.remove("juice-ping");
      void s.offsetWidth;
      s.classList.add("juice-ping");
    });
  }

  function wireMute() {
    setMuted(isMuted());
    document.querySelectorAll("[data-mute-toggle]").forEach(function (btn) {
      if (btn.getAttribute("data-mute-wired") === "1") return;
      btn.setAttribute("data-mute-wired", "1");
      btn.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        setMuted(!isMuted());
        if (!isMuted()) sfxTap();
      });
    });
  }

  document.addEventListener("house:cleared", function () { celebrateClear(); });
  document.addEventListener("house:goal-hit", function (ev) {
    celebrateGoal(ev.detail && ev.detail.reward);
  });

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest(".quest, .chore, [data-check]");
    if (!el) return;
    window.setTimeout(function () {
      if (el.classList.contains("done") || el.classList.contains("lit")) questPop(el);
    }, 12);
  });

  // first user gesture unlocks audio + ambient
  function unlock() {
    try { var c = ctx(); if (c && c.state === "suspended") c.resume(); } catch (e) {}
    startAmbient();
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
  }
  document.addEventListener("pointerdown", unlock);
  document.addEventListener("keydown", unlock);

  function boot() {
    wireMute();
    if (isMuted()) document.documentElement.setAttribute("data-sound", "off");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  global.HouseSfx = {
    quest: sfxQuest, clear: sfxClear, goal: sfxGoal, tap: sfxTap,
    boomAt: boomAt, celebrateClear: celebrateClear, celebrateGoal: celebrateGoal,
    floatPopup: floatPopup, screenShake: screenShake,
    setMuted: setMuted, isMuted: isMuted, wireMute: wireMute,
    startAmbient: startAmbient, stopAmbient: stopAmbient
  };
})(window);
