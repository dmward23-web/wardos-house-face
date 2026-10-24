/* WGART1 · named Prism asset anchors. Any element with data-asset="signs/sign-crypt.png" (and optional data-asset-ph for
   phone, data-asset-var for the CSS var, default --wg-art) gets that art only when the proxy's night/media/caps.json lists
   the exact file keyed in caps.artH (LIVEWX2: hashed keys, never names; a | list takes the first file present). KIDWORLD1: a kid plate named *-costume.* has the costume baked in and marks data-costume-baked so overlay loops skip the static costume. Words baked into Prism art hide the live text (kept for screen readers). Pages serves {video:false} with no art list, so nothing is requested there (no 404) and the
   polished-glass fallback (wg-glass.css) stays. Art lives in the private folder only, never git. */
(function () {
  var root = (document.currentScript && document.currentScript.src || "").replace(/wg-assets\.js.*$/, "");
  var base = root + "night/media/art/halloween/";
  /* KIDWORLD1 · costume plates only inside the Halloween season window, the same CT date gate as every other Halloween scene pack
     (LHScenePacks.forDate: the october packs, Oct 1-31 CT, from LHClock.now()). No gate loaded = no costume (fails closed to the plain plate). */
  /* KIDWORLD2 / LIVEWX2 · -costume plates only in the October pack, else the plain plate (November plates are the ambient line's NOVPACK1) */
  function costumeSeason() { var P = window.LHScenePacks, C = window.LHClock; if (!P || !P.forDate) return false; return /^october/.test(P.forDate(C && C.now ? C.now() : new Date()).id); }
  function phone() { return innerWidth / innerHeight < 0.8; }
  function apply(have) {
    var els = document.querySelectorAll("[data-asset]");
    for (var i = 0; i < els.length; i++) (function (el) {
      var pick = function (a) { return (a || "").split("|").filter(function (n) { return have[n] && (/-costume\./.test(n) ? costumeSeason() : true); })[0]; }, name = (phone() && pick(el.getAttribute("data-asset-ph"))) || pick(el.getAttribute("data-asset")), v = el.getAttribute("data-asset-var") || "--wg-art";
      if (!name) { el.style.removeProperty(v); el.removeAttribute("data-asset-on"); el.removeAttribute("data-asset-baked"); return; }
      var im = new Image(); im.onload = function () { el.style.setProperty(v, "url(\"" + base + name + "\")"); el.setAttribute("data-asset-on", name); if (/-costume\./.test(name)) el.setAttribute("data-costume-baked", ""); else el.removeAttribute("data-costume-baked"); if (el === document.documentElement || /blank|^backgrounds|^kidboards/.test(name)) el.removeAttribute("data-asset-baked"); else el.setAttribute("data-asset-baked", ""); document.documentElement.classList.add("wg-art-on"); };
      im.src = base + name;
    })(els[i]);
  }
  var have = null, cs = null;
  /* LIVEWX2 · caps.json never names art (Alfred P2): it sends artH, one 64-bit FNV-1a key per present listed file. artKey is
     the same code as the proxy's artKey; have[name] answers 1 when the name's key is present, so every reader keeps have[n]. */
  function artKey(n) {
    var a = 0x811c9dc5, b = 0x050c5d1f;
    for (var i = 0; i < n.length; i++) { var c = n.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b ^ c, 0x01000193) >>> 0; b = (b ^ (b >>> 13)) >>> 0; }
    return ("0000000" + a.toString(16)).slice(-8) + ("0000000" + b.toString(16)).slice(-8);
  }
  function haveOf(keys) {
    var memo = {};
    var look = function (n) { if (typeof n !== "string") return undefined; if (!(n in memo)) memo[n] = keys[artKey(n)] ? 1 : 0; return memo[n] || undefined; };
    return typeof Proxy === "function" ? new Proxy({}, { get: function (t, n) { return look(n); }, has: function (t, n) { return !!look(n); } }) : {};
  }
  /* WGLOAD1 · slow-network + reload hardening: an 8 s timeout per try, up to 5 tries with backoff (2,4,8,16 s);
     a miss keeps the polished-glass fallback. Pages that need the list (porch curve, spook ghost, overlay loops) get
     window.WGArt and one "wg:caps" event. */
  function caps(n) {
    var ac = typeof AbortController === "function" ? new AbortController() : null, to = setTimeout(function () { ac && ac.abort(); }, 8000);
    fetch(root + "night/media/caps.json", { cache: "no-store", signal: ac ? ac.signal : undefined }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      clearTimeout(to);
      if (!j) throw 0;
      var keys = {}, nk = 0; (j.artH || []).forEach(function (k) { if (typeof k === "string") { keys[k] = 1; nk++; } });
      (j.art || []).forEach(function (k) { if (typeof k === "string") { keys[artKey(k)] = 1; nk++; } });   /* box QA servers may still send names */
      have = haveOf(keys);
      window.WGArt = { base: base, have: have, video: !!j.video, key: artKey };
      cs = costumeSeason();   /* LIVEWX2 · season state recorded on first apply: a load just before CT midnight still swaps at the edge */
      if (nk) apply(have);
      try { dispatchEvent(new CustomEvent("wg:caps", { detail: { video: !!j.video, n: nk } })); } catch (e) {}
    }).catch(function () { clearTimeout(to); if (n < 4) setTimeout(function () { caps(n + 1); }, 2000 * Math.pow(2, n)); });
  }
  caps(0);
  setInterval(function () { var c = costumeSeason(); if (cs !== null && c !== cs && have) apply(have); cs = c; }, 60000);   /* the season edge (CT midnight Nov 1) swaps the plate without a reload */
  var t; addEventListener("resize", function () { if (!have) return; clearTimeout(t); t = setTimeout(function () { apply(have); }, 200); });
})();
