/* LAW8C3 · one sound state for the whole house face.
   Every page loads this first, in <head>, so html[data-sound] is set before the first paint. All the header and HUD
   sound icons (hub, kid boards, desk sheets) read the same key, so they always agree and never blink on load.
   Key "house:sound" = "on" | "off". Unset = nobody has chosen yet: silent until the first tap anywhere on any page,
   which turns sound on and saves it (a tap on a sound control decides instead). The old keys are read once to migrate. */
(function (global) {
  "use strict";
  var KEY = "house:sound", html = document.documentElement, st = null, subs = [];
  var CONTROL = "[data-sound-toggle],[data-mute-toggle],.night52-snd,.hl-mute,.kw-mute";
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function read() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "on" || v === "off") return v;
      var n = localStorage.getItem("night52:snd");          /* hub button choice (NIGHT52) */
      if (n === "1" || n === "0") v = n === "1" ? "on" : "off";
      else if (localStorage.getItem("house-sfx:mute") === "1") v = "off";   /* kid HUD mute */
      if (v) store(v);
      return v || null;
    } catch (e) { return null; }
  }
  function isOn() { return st === "on"; }
  function paint() { html.setAttribute("data-sound", isOn() ? "on" : "off"); }
  function emit(src) {
    var on = isOn();
    subs.slice().forEach(function (fn) { try { fn(on, src); } catch (e) {} });
    try { document.dispatchEvent(new CustomEvent("house:sound", { detail: { on: on, src: src } })); } catch (e) {}
  }
  function set(on, src) {
    var v = on ? "on" : "off", changed = v !== st;
    st = v; store(v); paint();
    if (changed) emit(src || "user");
    return on;
  }
  st = read(); paint();
  /* first tap anywhere, while nobody has chosen, turns sound on (same moment browsers allow audio) */
  document.addEventListener("pointerdown", function first(e) {
    if (st !== null) { document.removeEventListener("pointerdown", first, true); return; }
    if (e.target && e.target.closest && e.target.closest(CONTROL)) return;   /* the control's own click decides */
    document.removeEventListener("pointerdown", first, true);
    set(true, "first-tap");
  }, true);
  /* another tab or window changed it */
  global.addEventListener("storage", function (e) {
    if (e.key !== KEY || (e.newValue !== "on" && e.newValue !== "off") || e.newValue === st) return;
    st = e.newValue; paint(); emit("storage");
  });
  /* back/forward cache: a restored page re-reads the shared state */
  global.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var v = read(); if (v !== st) { st = v; paint(); emit("pageshow"); }
  });
  /* ONE control style everywhere (hub header, kid HUDs, sheets): the same round speaker icon. Its look follows
     html[data-sound], so it is right on the first frame whatever script draws it. */
  var SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/><path class="w" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="x" d="M16 9l5 6M21 9l-5 6"/></svg>';
  var CSS = ".house-snd{position:relative;box-sizing:border-box;width:36px;height:36px;min-width:36px;min-height:36px;border-radius:18px;padding:0;border:1px solid rgba(255,255,255,.28);background:rgba(8,12,18,.72);color:#e9eef5;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.45);cursor:pointer;font-size:0;line-height:0;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}" +
    ".house-snd::after{content:'';position:absolute;inset:-4px}" +
    ".house-snd svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}" +
    "html[data-sound=on] .house-snd .x,html:not([data-sound=on]) .house-snd .w{display:none}" +
    "html[data-sound=on] .house-snd .w,html:not([data-sound=on]) .house-snd .x{display:inline}" +
    "[data-mute-toggle]:not(.house-snd),[data-sound-toggle]:not(.house-snd){visibility:hidden}";  /* no old-label flash before the icon is wired */
  try { var st0 = document.createElement("style"); st0.id = "house-snd-css"; st0.textContent = CSS; (document.head || html).appendChild(st0); } catch (e) {}
  function icon(btn) {
    if (!btn) return btn;
    if (!btn.classList.contains("house-snd")) btn.classList.add("house-snd");
    if (!btn.querySelector("svg.hs")) { btn.innerHTML = SVG.replace("<svg ", '<svg class="hs" '); }
    var on = isOn();
    btn.setAttribute("aria-pressed", on ? "false" : "true");
    btn.setAttribute("aria-label", on ? "Sound on. Tap to mute" : "Sound off. Tap for sound");
    return btn;
  }
  global.HouseSound = {
    SVG: SVG, icon: icon,
    KEY: KEY, isOn: isOn, chosen: function () { return st !== null; },
    set: function (on) { return set(!!on, "user"); }, toggle: function () { return set(!isOn(), "user"); },
    onChange: function (fn) { if (typeof fn === "function") subs.push(fn); }
  };
})(window);
