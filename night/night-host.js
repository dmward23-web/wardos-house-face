/* NIGHT52 · v5.2 night scene behind a board. The scene runs in a same-origin iframe
   under the board UI, so every card, label and button stays above the colour grade.
   Sound follows the one shared house state (house-sound.js, LAW8C3); the hub toggle is a header button (never under the scene).
   URL overrides pass through: ?phase= ?weather= ?wind= ?dir=. ?night=0 turns it off. */
(function () {
  var q = new URLSearchParams(location.search);
  if (q.get("night") === "0") return;
  /* Ainsley keeps her concert venue: no night scene behind her board (Alfred 10/16, kid-world.js nightOn) */
  var KEY = "night52:snd"; /* legacy key, only used when house-sound.js is missing */
  var HS = window.HouseSound || null;
  function houseOn() { return HS ? HS.isOn() : false; }
  var root = (document.currentScript && document.currentScript.src) || "night/night-host.js";
  var base = root.replace(/night-host\.js.*$/, "");
  var pass = new URLSearchParams();
  ["phase", "weather", "wind", "dir"].forEach(function (k) { if (q.get(k)) pass.set(k, q.get(k)); });
  pass.set("embed", "1");
  var fr, btn, on = false, ready = false;
  function post(m) { try { if (fr && fr.contentWindow) fr.contentWindow.postMessage(m, location.origin); } catch (_) {} }
  function setSnd(v, user) {
    on = !!v;
    if (user) { if (HS) HS.set(on); else { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (_) {} } }
    post({ night: "snd", on: on });
    if (btn) { if (HS && HS.icon) HS.icon(btn); btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on ? "true" : "false"); btn.setAttribute("aria-label", on ? "Night sound on. Tap to mute" : "Night sound off. Tap for sound"); }
  }
  function interactive(el) {
    return !!(el && el.closest && el.closest("a,button,input,select,textarea,label,[role=button],[role=link],[onclick],[data-tap],.chip,.tile,.card,.hub-tile,.kw-hud,.kw-week,.kw-path,.kw-jar-host,header,footer,nav,section,.hotbar"));
  }
  function mount() {
    /* Ainsley keeps her concert venue: no night scene behind her board (Alfred 10/16; kid-world.js nightOn agrees) */
    if (document.body.getAttribute("data-kid") === "ainsley") { window.HouseNight = { on: false, sound: function () { return false; }, set: function () {} }; return; }
    document.documentElement.classList.add("night52");
    fr = document.createElement("iframe");
    fr.className = "night52-scene"; fr.title = ""; fr.setAttribute("aria-hidden", "true"); fr.tabIndex = -1;
    fr.setAttribute("allow", "autoplay");
    fr.src = base + "scene.html?" + pass.toString();
    fr.addEventListener("load", function () { ready = true; setSnd(on, false); });
    document.body.insertBefore(fr, document.body.firstChild);
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "night52-snd";
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/><path class="w" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="x" d="M16 9l5 6M21 9l-5 6"/></svg>';
    btn.setAttribute("data-sound-toggle", "");
    if (HS && HS.icon) HS.icon(btn);   /* same svg + look rule as every other sound control */
    btn.addEventListener("click", function (e) { e.stopPropagation(); setSnd(!on, true); });
    var hub = /(^|\/)(sheet-index|index)\.html$|\/$/.test(location.pathname);
    if (hub) document.documentElement.classList.add("night52-hub");   /* LAW8C3 · porch tail below the hub (night-host.css) */
    if (!hub) btn = null;   /* kid boards and desk sheets show their own control (or none); the scene just follows the house state */
    setSnd(houseOn(), false);   /* LAW8C3 · drawn in the saved state before it is shown: no blink */
    if (btn) document.body.appendChild(btn);
    if (HS) HS.onChange(function (v) { setSnd(v, false); });
    else if (hub) {
      var pref = null; try { pref = localStorage.getItem(KEY); } catch (_) {}
      document.addEventListener("pointerdown", function first(e) {
        if (e.target === btn || btn.contains(e.target)) return;
        document.removeEventListener("pointerdown", first, true);
        if (pref !== "0") setSnd(true, false);
      }, true);
    }
    /* taps on empty board background reach the scene (fire, owl, pumpkins) */
    var down = false;
    function fwd(type, e) { post({ night: "tap", type: type, x: e.clientX, y: e.clientY, pt: e.pointerType }); }
    document.addEventListener("pointerdown", function (e) { if (interactive(e.target) || (btn && btn.contains(e.target))) return; down = true; fwd("down", e); }, true);
    document.addEventListener("pointermove", function (e) { if (down) fwd("move", e); }, { capture: true, passive: true });
    document.addEventListener("pointerup", function (e) { if (down) { down = false; fwd("up", e); } }, true);
    document.addEventListener("pointercancel", function (e) { if (down) { down = false; fwd("cancel", e); } }, true);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
  window.HouseNight = { on: true, sound: function () { return on; }, set: function (v) { setSnd(v, true); } };
})();
