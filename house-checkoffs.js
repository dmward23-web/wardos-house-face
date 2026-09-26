/* House face · client-side checkoffs · localStorage only · kids-safe · no backend */
(function () {
  "use strict";

  var page = (location.pathname.split("/").pop() || "sheet").replace(/\.html$/i, "");
  var KEY = "house-checkoffs:" + page;
  var clearedLatch = false;
  var POP_MS = 420;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* private mode / quota — silent */ }
  }

  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function ringEl(el) {
    return el.querySelector(".ring, .box") || null;
  }

  function isDone(el) {
    if (el.classList.contains("tap-star")) return el.classList.contains("lit");
    return el.classList.contains("done");
  }

  function checkNodes() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-check]"));
  }

  function applyDone(el, done, animate) {
    var isChore = el.classList.contains("chore") || el.classList.contains("quest");
    var isStar = el.classList.contains("tap-star");

    if (isStar) {
      el.classList.toggle("lit", done);
      el.classList.toggle("dim", !done);
      el.setAttribute("aria-pressed", done ? "true" : "false");
    } else {
      el.classList.toggle("done", done);
      if (isChore) {
        el.classList.toggle("open", !done);
        var hint = el.querySelector(".hint");
        var earn = el.querySelector(".star-earn");
        if (hint) {
          if (!hint.getAttribute("data-hint-open")) {
            hint.setAttribute("data-hint-open", hint.textContent);
          }
          hint.textContent = done
            ? "done · nice!"
            : hint.getAttribute("data-hint-open") || "tap when done";
        }
        if (earn) earn.textContent = done ? "★ +1" : "★ 1";
      }
      var ring = ringEl(el);
      if (ring) ring.textContent = done ? "✓" : "";
    }

    if (animate && !reducedMotion()) {
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
      window.setTimeout(function () {
        el.classList.remove("pop");
      }, POP_MS);
    }
  }

  function soundEnabled() {
    var root = document.documentElement;
    var flag = root.getAttribute("data-sound");
    if (flag === null || flag === "") flag = "on";
    if (flag === "off" || flag === "0" || flag === "false") return false;
    if (reducedMotion()) return false;
    return true;
  }

  var _audioCtx = null;
  function getCtx() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_audioCtx) _audioCtx = new AC();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    return _audioCtx;
  }

  function tone(freq, dur, type, peak, when) {
    if (!soundEnabled()) return;
    try {
      var ctx = getCtx();
      if (!ctx) return;
      var t0 = (when != null ? when : ctx.currentTime);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak || 0.05, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* silent */ }
  }

  function cheerDing() {
    if (!soundEnabled()) return;
    try {
      var ctx = getCtx();
      if (!ctx) return;
      var t0 = ctx.currentTime;
      tone(880, 0.14, "sine", 0.055, t0);
      tone(1320, 0.16, "sine", 0.04, t0 + 0.04);
    } catch (e) { /* silent */ }
  }

  function cheerVictory() {
    if (!soundEnabled()) return;
    try {
      var ctx = getCtx();
      if (!ctx) return;
      var t0 = ctx.currentTime;
      tone(523.25, 0.18, "triangle", 0.06, t0);
      tone(659.25, 0.2, "triangle", 0.055, t0 + 0.08);
      tone(783.99, 0.22, "triangle", 0.05, t0 + 0.16);
      tone(1046.5, 0.32, "sine", 0.07, t0 + 0.26);
    } catch (e) { /* silent */ }
  }

  function progressStats() {
    var nodes = checkNodes();
    var total = nodes.length;
    var done = 0;
    nodes.forEach(function (el) {
      if (isDone(el)) done += 1;
    });
    return { total: total, done: done, left: Math.max(0, total - done), pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function syncProgress(animateFill) {
    var stats = progressStats();
    var fills = document.querySelectorAll("[data-progress-fill]");
    fills.forEach(function (fill) {
      if (animateFill && !reducedMotion()) {
        fill.classList.remove("xp-bump");
        void fill.offsetWidth;
        fill.classList.add("xp-bump");
        window.setTimeout(function () { fill.classList.remove("xp-bump"); }, 480);
      }
      fill.style.width = stats.pct + "%";
      fill.setAttribute("data-pct", String(stats.pct));
      fill.classList.toggle("is-full", stats.total > 0 && stats.left === 0);
      fill.classList.toggle("is-low", stats.pct > 0 && stats.pct < 40);
      fill.classList.toggle("is-mid", stats.pct >= 40 && stats.pct < 100);
    });

    document.querySelectorAll("[data-progress-meta]").forEach(function (el) {
      var tpl = el.getAttribute("data-progress-meta") || "";
      if (tpl.indexOf("{") >= 0) {
        el.textContent = tpl
          .replace(/\{done\}/g, String(stats.done))
          .replace(/\{total\}/g, String(stats.total))
          .replace(/\{left\}/g, String(stats.left))
          .replace(/\{pct\}/g, String(stats.pct));
      } else if (stats.total === 0) {
        el.textContent = "tap quests to fill";
      } else if (stats.left === 0) {
        el.textContent = "CLEAR · " + stats.done + "/" + stats.total;
      } else {
        el.textContent = stats.done + "/" + stats.total + " · " + stats.left + " left";
      }
    });

    document.querySelectorAll("[data-left-count]").forEach(function (el) {
      if (stats.total === 0) {
        el.textContent = "—";
      } else if (stats.left === 0) {
        el.textContent = "CLEAR";
        el.classList.add("is-clear");
      } else {
        el.textContent = stats.left + " left";
        el.classList.remove("is-clear");
      }
    });

    document.querySelectorAll("[data-progress-val]").forEach(function (el) {
      el.textContent = stats.pct + "%";
    });

    document.body.classList.toggle("house-progress-full", stats.total > 0 && stats.left === 0);
    document.body.setAttribute("data-checks-done", String(stats.done));
    document.body.setAttribute("data-checks-total", String(stats.total));
    document.body.setAttribute("data-checks-left", String(stats.left));

    return stats;
  }

  function burstLabel() {
    var forced = document.body.getAttribute("data-clear-label");
    if (forced) return forced;
    if (/harris/i.test(page)) return "LEVEL UP";
    if (/hayes/i.test(page)) return "VICTORY";
    if (/ainsley/i.test(page)) return "ENCORE";
    return "CLEARED";
  }

  function ensureBurst() {
    var el = document.getElementById("house-clear-burst");
    if (el) return el;
    el = document.createElement("div");
    el.id = "house-clear-burst";
    el.className = "house-clear-burst";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="hcb-flash"></div>' +
      '<div class="hcb-particles" aria-hidden="true">' +
      '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>' +
      '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>' +
      "</div>" +
      '<div class="hcb-label"></div>' +
      '<div class="hcb-sub">all quests done</div>';
    document.body.appendChild(el);
    return el;
  }

  function fireClearBurst() {
    if (reducedMotion()) {
      document.body.classList.add("house-cleared");
      return;
    }
    var el = ensureBurst();
    var label = el.querySelector(".hcb-label");
    if (label) label.textContent = burstLabel();
    el.classList.remove("is-on");
    void el.offsetWidth;
    el.classList.add("is-on");
    document.body.classList.add("house-cleared", "house-clear-flash");
    window.setTimeout(function () {
      document.body.classList.remove("house-clear-flash");
    }, 900);
    window.setTimeout(function () {
      el.classList.remove("is-on");
    }, 2200);
  }

  function evaluateClear(fromToggle) {
    var stats = syncProgress(!!fromToggle);
    if (stats.total === 0) {
      clearedLatch = false;
      document.body.classList.remove("house-cleared", "house-clear-flash");
      return stats;
    }
    if (stats.left === 0) {
      if (!clearedLatch) {
        clearedLatch = true;
        document.body.classList.add("house-cleared");
        if (fromToggle) {
          fireClearBurst();
          cheerVictory();
          try {
            document.dispatchEvent(
              new CustomEvent("house:cleared", {
                detail: { page: page, done: stats.done, total: stats.total }
              })
            );
          } catch (e) { /* ignore */ }
        }
      }
    } else if (clearedLatch) {
      clearedLatch = false;
      document.body.classList.remove("house-cleared", "house-clear-flash");
      var burst = document.getElementById("house-clear-burst");
      if (burst) burst.classList.remove("is-on");
    }
    return stats;
  }

  function wireChecks() {
    if (reducedMotion()) {
      document.documentElement.classList.add("rm-reduce");
      document.body.classList.add("rm-reduce");
    }

    var state = load();
    var nodes = checkNodes();
    nodes.forEach(function (el) {
      var id = el.getAttribute("data-check");
      if (!id) return;

      if (Object.prototype.hasOwnProperty.call(state, id)) {
        applyDone(el, !!state[id], false);
      }

      el.setAttribute("role", el.getAttribute("role") || "button");
      el.setAttribute("tabindex", el.getAttribute("tabindex") || "0");

      function toggle(ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        var nowDone = el.classList.contains("tap-star")
          ? !el.classList.contains("lit")
          : !el.classList.contains("done");
        applyDone(el, nowDone, true);
        if (nowDone) cheerDing();
        state = load();
        state[id] = nowDone;
        save(state);
        evaluateClear(true);
      }

      el.addEventListener("click", toggle);
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") toggle(ev);
      });
    });

    evaluateClear(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireChecks);
  } else {
    wireChecks();
  }
})();
