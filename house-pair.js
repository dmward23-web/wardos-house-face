/* PRIVFEED3 · QR pairing (Atlas-approved design b). Two jobs, no paste anywhere:
 *  1. Redeem: a new screen opened from a pairing QR/link (…/sheet-index.html#pair=<code>) strips the fragment
 *     at once (history.replaceState), and only after a real tap on "Pair this screen" (TAPPAIR1) POSTs the one-time code to the BUILT-IN hub (HouseHub; never a host from the link), stores the device key under the SAME
 *     storage key every screen already uses (wardos-lights-proxy-token, HUBTOK / lightsProxyToken seed), then reloads clean.
 *     The fragment never reaches any server log. A wrong, used or expired code shows an honest "needs pairing" note.
 *  2. Dad page tile ("Pair a screen"): only on a screen that already holds the key. Asks the hub (with the key) for a
 *     one-time code (single use, 5 minutes, memory only on the box) and draws it as a QR in the page (vendored
 *     qrcode-generator, MIT; no CDN). Never mounted on shared glass.
 * Load right after private-feed.js. */
(function (g) {
  "use strict";
  if (g.HousePairing) return;
  var KEY_LS = "wardos-lights-proxy-token", HUB_LS = "wardos-lights-proxy";
  function lsGet(k) { try { return g.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { g.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  var HUB_RE = /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/, CODE_RE = /^[A-Za-z0-9_-]{16,64}$/;

  function readFragment() {
    var h = String(g.location && g.location.hash || "").replace(/^#/, "");
    if (!/(^|&)pair=/.test(h)) return null;
    var out = {};
    h.split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) { try { out[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* */ } } });
    return out;
  }
  function stripFragment() {
    try { g.history.replaceState(g.history.state, "", g.location.pathname + g.location.search); } catch (e) { try { g.location.hash = ""; } catch (e2) { /* */ } }
  }
  function note(msg, ok) {
    function paint() {
      var n = document.createElement("div");
      n.setAttribute("role", "status"); n.setAttribute("data-pair-note", ok ? "ok" : "fail");
      n.textContent = msg;
      n.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483001;padding:10px 16px;border-radius:14px;" +
        "font:600 15px/1.3 Inter,system-ui,sans-serif;color:#fff;background:" + (ok ? "rgba(30,90,50,.92)" : "rgba(110,40,30,.92)") + ";max-width:90vw;text-align:center";
      document.body.appendChild(n);
      if (ok) setTimeout(function () { n.remove(); }, 6000);
    }
    if (document.body) paint(); else document.addEventListener("DOMContentLoaded", paint, { once: true });
  }

  /* ---- 1. redeem (TAPPAIR1: only on a real tap) ---- */
  /* The code leaves the address bar before anything else and is kept only in this closure. Nothing is sent until a
     person taps "Pair this screen" (event.isTrusted), so a link-preview bot that runs the page's JS cannot burn the
     code or receive the key. Redeem goes ONLY to the built-in hub (HouseHub); a #hub= or any host in the link is ignored. */
  var ready = Promise.resolve(false);
  var frag = readFragment();
  function redeem(code, hub, done) {
    fetch(hub + "/api/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code }), cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.j && typeof res.j.key === "string" && res.j.key.length >= 16) {
          g.HouseHub.saveLights(hub);
          lsSet(KEY_LS, res.j.key);
          try { g.sessionStorage.setItem("wardos-paired-note", "1"); } catch (e) { /* */ }
          g.location.replace(g.location.pathname + g.location.search); /* reload clean, every module starts keyed */
          return;
        }
        done();
        note(res.status === 429 ? "Too many tries. Wait a minute, then ask Dad for a new code." : "That code expired or was already used. Ask Dad for a new code.", false);
      }, function () { done(); note("Could not reach the house hub to pair. Try again on home Wi-Fi.", false); });
  }
  function askTap(code, hub) {
    function paint() {
      var card = document.createElement("div");
      card.setAttribute("data-pair-card", "");
      card.setAttribute("role", "dialog"); card.setAttribute("aria-label", "Pair this screen");
      card.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(8,12,18,.78)";
      var box = document.createElement("div");
      box.style.cssText = "background:#16202b;color:#f4ead8;border-radius:22px;padding:28px 30px;max-width:420px;width:86vw;text-align:center;font:600 17px/1.35 Inter,system-ui,sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.5)";
      var h = document.createElement("div"); h.textContent = "Pair this screen with the house?"; h.style.cssText = "font-size:21px;font-weight:800;margin-bottom:8px";
      var p = document.createElement("div"); p.textContent = "Tap once. The code works one time and only for a few minutes."; p.style.cssText = "opacity:.8;margin-bottom:18px";
      var btn = document.createElement("button"); btn.type = "button"; btn.setAttribute("data-pair-go", ""); btn.textContent = "Pair this screen";
      btn.style.cssText = "font:800 18px/1 Inter,system-ui,sans-serif;padding:16px 26px;border-radius:16px;border:0;background:#8ee7ff;color:#0c1822;cursor:pointer;min-width:220px";
      var no = document.createElement("button"); no.type = "button"; no.textContent = "Not now";
      no.style.cssText = "display:block;margin:14px auto 0;font:600 15px Inter,system-ui,sans-serif;background:none;border:0;color:#f4ead8;opacity:.7;cursor:pointer";
      btn.addEventListener("click", function (ev) {
        if (!ev || ev.isTrusted !== true) return; /* scripted clicks never redeem */
        btn.disabled = true; btn.textContent = "Pairing…";
        redeem(code, hub, function () { card.remove(); });
        code = ""; /* one shot from this page */
      });
      no.addEventListener("click", function () { code = ""; card.remove(); });
      box.appendChild(h); box.appendChild(p); box.appendChild(btn); box.appendChild(no); card.appendChild(box);
      document.body.appendChild(card);
    }
    if (document.body) paint(); else document.addEventListener("DOMContentLoaded", paint, { once: true });
  }
  if (frag) {
    stripFragment(); /* first thing: the code leaves the address bar before any network call */
    var code0 = frag.pair || "", hub0 = g.HouseHub ? g.HouseHub.lights() : "";
    if (!CODE_RE.test(code0) || !HUB_RE.test(hub0) || !g.HouseHub.okForKey(hub0)) { note("This pairing link is not valid. Ask Dad for a new code.", false); }
    else askTap(code0, hub0);
  }
  try { if (g.sessionStorage.getItem("wardos-paired-note")) { g.sessionStorage.removeItem("wardos-paired-note"); note("Screen paired", true); } } catch (e) { /* */ }

  /* ---- 2. Dad tile ---- */
  /* the QR opens the house host (built-in camera/page host) so the new screen finds the hub with no address in the link */
  function houseUrl() {
    var c = g.HouseHub ? g.HouseHub.cams() : "";
    return (c && /^https:/.test(c) ? c + "/" : g.location.origin + g.location.pathname.replace(/[^/]*$/, "")) + "sheet-index.html";
  }
  function mountTile(el) {
    var key = lsGet(KEY_LS), hub = g.HouseHub ? g.HouseHub.lights() : "";
    if (!el || !key || !HUB_RE.test(hub) || !g.HouseHub.okForKey(hub)) { if (el) el.hidden = true; return false; } /* only on a paired screen */
    el.hidden = false;
    var btn = el.querySelector("[data-pair-btn]"), box = el.querySelector("[data-pair-qr]"), st = el.querySelector("[data-pair-status]");
    var timer = null;
    function status(t) { if (st) st.textContent = t; }
    function clear() { if (timer) clearInterval(timer); timer = null; if (box) box.innerHTML = ""; }
    btn.addEventListener("click", function () {
      clear(); status("Asking the house for a code…"); btn.disabled = true;
      fetch(hub + "/api/pair/mint", { method: "POST", headers: { "X-Lights-Proxy-Token": key, "Content-Type": "application/json" }, body: "{}", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
        .then(function (res) {
          btn.disabled = false;
          if (res.status !== 200 || !res.j || !CODE_RE.test(res.j.code || "")) { status(res.status === 401 ? "This screen's key was not accepted. It needs pairing again." : "The house hub did not answer. Try again."); return; }
          var link = houseUrl() + "#pair=" + encodeURIComponent(res.j.code); /* HUBPIN1 · no &hub= */
          if (typeof g.qrcode === "function" && box) {
            var q = g.qrcode(0, "M"); q.addData(link); q.make();
            box.innerHTML = q.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
          }
          var end = Date.parse(res.j.expiresAt) || (Date.now() + 300000);
          function tick() {
            var s = Math.max(0, Math.round((end - Date.now()) / 1000));
            if (!s) { clear(); status("Code expired. Tap to make a new one."); return; }
            status("Scan with the new screen's camera · works once · " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " left");
          }
          tick(); timer = setInterval(tick, 1000);
        }, function () { btn.disabled = false; status("The house hub did not answer. Try again."); });
    });
    return true;
  }
  function boot() { document.querySelectorAll("[data-pair-tile]").forEach(mountTile); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  g.HousePairing = { ready: ready, mountTile: mountTile };
})(window);
