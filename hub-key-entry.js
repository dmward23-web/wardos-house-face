/* KEYPASTE2 (PRIVFEED3: paste box retired; tapping a locked tile explains QR pairing) · WardOS hub.
 * iOS home-screen icons keep their own storage (separate from Safari), so a
 * setup link opened in Safari never reaches the icon. Tapping a camera that
 * says NEED KEY opens this box; paste the link (or the keys) once and both the
 * lights + camera keys are saved on THIS screen. Keys never live in the repo. */
(function () {
  "use strict";
  var LIGHTS_LS = "wardos-lights-proxy-token";
  var NEST_LS = "wardosNestProxyToken";

  function parseKeys(text) {
    text = String(text || "").trim();
    var out = { lights: "", nest: "" };
    var m = text.match(/lightsProxyToken=([A-Za-z0-9_-]+)/);
    if (m) out.lights = m[1];
    m = text.match(/nestProxyToken=([A-Za-z0-9_-]+)/);
    if (m) out.nest = m[1];
    if (!out.lights) { m = text.match(/\blights-[A-Za-z0-9]{16,}\b/); if (m) out.lights = m[0]; }
    if (!out.nest) { m = text.match(/\bnest-[A-Za-z0-9]{16,}\b/); if (m) out.nest = m[0]; }
    return out;
  }

  function noDeviceKey() { var ks = ["wardos-lights-proxy-token", "wardosNestProxyToken", "wardos-private-feed-token"]; try { for (var i = 0; i < ks.length; i++) { if (localStorage.getItem(ks[i])) return false; } return true; } catch (e) { return false; } }

  /* KEYAUTO1: opening the setup link saves its keys on this screen automatically, no paste. */
  (function autoSaveFromUrl() {
    try {
      var k = parseKeys(location.search);
      /* PRIVFEED3 · legacy setup links still work once (same storage keys), 16+ chars like the server, then stripped */
      /* SEEDGUARD1 · a legacy ?lightsProxyToken= / ?nestProxyToken= seed is saved ONLY when this screen holds no device key yet, so a crafted link can never replace (unpair) a paired screen's key. The param is still stripped. */
      var fresh = noDeviceKey(); /* checked once, before either write, so one link can seed both keys on an empty screen */
      if (fresh && k.lights && k.lights.length >= 16) localStorage.setItem(LIGHTS_LS, k.lights);
      if (fresh && k.nest && k.nest.length >= 16) localStorage.setItem(NEST_LS, k.nest);
      if (k.lights || k.nest) {
        var u = new URL(location.href);
        ["lightsProxyToken", "nestProxyToken", "proxyToken"].forEach(function (n) { u.searchParams.delete(n); });
        history.replaceState(history.state, "", u.pathname + u.search + u.hash);
      }
    } catch (_) {}
  })();

  function el(tag, css, txt) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* PRIVFEED3 · DONE LAW: no paste box. An unpaired screen gets an honest "needs pairing" card that says how to pair
     by scanning: Dad page -> "Pair a screen" -> scan the code with this screen (house-pair.js does the rest). */
  function openBox() {
    if (document.getElementById("hub-key-entry")) return;
    var wrap = el("div", "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;");
    wrap.id = "hub-key-entry";
    wrap.setAttribute("data-needs-pairing", "");
    var card = el("div", "width:100%;max-width:420px;background:#17120a;border:2px solid #e8b64a;border-radius:18px;padding:20px;color:#f6ead0;font:16px/1.35 -apple-system,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6);");
    card.appendChild(el("div", "font-weight:800;font-size:20px;color:#ffd36b;margin-bottom:6px;", "This screen needs pairing"));
    card.appendChild(el("div", "opacity:.9;margin-bottom:12px;", "On Dad's page, tap \u201cPair a screen\u201d and scan the code with this screen's camera. Nothing to type or paste."));
    var ok = el("button", "width:100%;padding:12px;border-radius:12px;border:0;background:linear-gradient(#ffd36b,#e0a33a);color:#1b1206;font-weight:800;font-size:16px;", "OK");
    card.appendChild(ok);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    ok.addEventListener("click", function () { wrap.remove(); });
    wrap.addEventListener("click", function (e) { if (e.target === wrap) wrap.remove(); });
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var tile = t && t.closest ? t.closest("#hub-cam-deck .hub-cam, [data-hub-key-entry]") : null;
    if (!tile) return;
    var pill = tile.querySelector ? tile.querySelector(".hub-cam-pill") : null;
    var noKey = false;
    try { noKey = !localStorage.getItem(NEST_LS) && !localStorage.getItem(LIGHTS_LS); } catch (_) {}
    var need = tile.hasAttribute("data-hub-key-entry") || noKey || (pill && /NEED KEY|PAIR/i.test(pill.textContent || ""));
    if (!need) return;
    e.preventDefault();
    e.stopPropagation();
    openBox();
  }, true);

  /* KEYPASTE2: a screen with no camera key opens the box by itself (once per load). */
  function hasKey() {
    try {
      return !!localStorage.getItem(NEST_LS) || /(nestProxyToken|proxyToken)=/.test(location.search);
    } catch (_) { return true; }
  }
  /* AUDIT1 · wall/kiosk screens never get a board-covering modal on load; the cam NEED KEY pill
     is the quiet cue there (tap it to add the key). Phones keep the one-time auto-open. */
  function isPhone() {
    try { var w = Math.min(screen.width, screen.height); return !!(w && w <= 600); } catch (_) { return false; }
  }
  /* KEYAUTO2 · Dan 10/4: no popup on load, ever, on any screen. The key arrives by opening the setup link once
     (KEYAUTO1 saves it). A key-less screen just shows the quiet NEED KEY pill; tapping it opens the box. */
  void hasKey; void isPhone;

  window.WardHubKeyEntry = { open: openBox, parse: parseKeys };
})();
