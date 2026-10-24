/* ORICALM1 · one tame orb that floats near its home spot beside the header. No zipping, no chasing taps. */
(function () {
  if (!document.documentElement.classList.contains("ori-calm")) return;
  var orb = document.createElement("div");
  orb.className = "ori-calm-orb";
  orb.setAttribute("aria-hidden", "true");
  document.body.appendChild(orb);
  function home() {
    var hdr = document.querySelector("header.hdr");
    var r = hdr ? hdr.getBoundingClientRect() : null;
    var x, y;
    if (r && r.left >= 80) { x = r.left - 40; y = r.top + r.height * 0.5; }
    else { x = r ? r.right - 20 : innerWidth - 30; y = r ? r.bottom + 2 : 120; }
    orb.style.setProperty("--orb-x", Math.round(x) + "px");
    orb.style.setProperty("--orb-y", Math.round(y) + "px");
  }
  home();
  addEventListener("resize", home);
  setTimeout(home, 800);
})();
/* ORICALM1 · soft dark veil when leaving the main board, so the Ori boards still arrive the way they did. */
(function () {
  var root = document.documentElement;
  if (!root.classList.contains("ori-calm")) return;
  /* VEILPAUSE1 · on leave, hold the board's ambient CSS motion so a slow phone frame paints the veil first; resume on back. */
  var held = [];
  function clear() { document.querySelectorAll(".ori-iris[data-calm]").forEach(function (el) { el.remove(); }); held.splice(0).forEach(function (an) { try { an.play(); } catch (e) {} }); }
  addEventListener("pageshow", clear);
  document.addEventListener("click", function (ev) {
    if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var u; try { u = new URL(a.href, location.href); } catch (e) { return; }
    if (u.origin !== location.origin || !/\.html$/.test(u.pathname) || u.pathname === location.pathname) return;
    ev.preventDefault();
    try { sessionStorage.setItem("ori-veil-next", String(Date.now())); } catch (e) {}
    var el = document.createElement("div");
    el.className = "ori-iris";
    el.setAttribute("data-calm", "1");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#062018;opacity:0;pointer-events:none;transition:opacity .2s ease";
    try { document.getAnimations().forEach(function (an) { if (an.playState === "running") { an.pause(); held.push(an); } }); } catch (e) {}
    root.appendChild(el);
    void getComputedStyle(el).opacity;
    el.style.opacity = "1";
    if (root.classList.contains("ori-reduced")) { setTimeout(function () { location.href = u.href; }, 0); return; }
    /* VEILPAUSE1 · leave on the frame after the veil was drawn at opacity >= .9 (and >= 320ms), never later than 1.5s. */
    var t0 = Date.now(), gone = false, shown = false;
    function go() { if (gone) return; gone = true; location.href = u.href; }
    function tick() { if (gone) return; if (shown) return go(); if (Date.now() - t0 >= 320 && (parseFloat(getComputedStyle(el).opacity) || 0) >= 0.9) shown = true; requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
    setTimeout(go, 1500);
  }, false);
})();
