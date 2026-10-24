/* HUBPIN1 · where a screen may send its device key, decided by the page itself, never by a link.
 *
 * Every script that attaches the house key (lights, cams, private feed, Spotify, thermostat, tap sync, pairing) asks
 * HouseHub first:
 *   HouseHub.lights() / HouseHub.cams()  the built-in hub origins, or "" (fail closed)
 *   HouseHub.okForKey(url)               true only for an allow-listed origin; the key is never sent anywhere else
 * The allow-list is pinned as SHA-256 of each origin ("https://host"), so no house hostname is written in git.
 * No ?lightsProxy=, ?proxy= or any other URL input can change a hub. HUBPAIR1: a #pair= link's &hub= may ADD one only on a
 * screen with no valid hub yet, and only if it is on the list (okLinkHub). A saved hub (localStorage) is
 * honoured only while it is on the list; anything else saved by an old link is ignored and never gets the key.
 * Box-only previews: a page served from 127.0.0.1/localhost may also use loopback http bases.
 * Allow-list entries: the two house origins (lights, cams) and two reserved .invalid QA origins (never resolve).
 */
(function (g) {
  "use strict";
  var PIN = ["684b83d4a06ec5bfc2f21c6cc7c6c5b2d42e31038122ad190189ec3364bb2b12", "4ccb5446788139f908a7bd69a43c15baeb367f9175d77d5cbc9483d97fb7743a", "88ce695bef4758aae88fb6aae5b33c1f4bc70d04f36f8bab9fe737a65ca6b227", "b0a9adae422eada33937aa0020ce234c1bdda31608995329990e8f00aba4a00f"];
  var HUB_LS = "wardos-lights-proxy", CAM_LS = "wardosNestProxy";

  /* compact synchronous SHA-256 (hex) for short ASCII strings */
  function sha256(ascii) {
    var K = [], H = [], i, j, p = 2, isP;
    for (; K.length < 64; p++) { isP = true; for (j = 2; j * j <= p; j++) if (p % j === 0) { isP = false; break; }
      if (isP) { if (H.length < 8) H.push((Math.pow(p, 1 / 2) * 4294967296) | 0); K.push((Math.pow(p, 1 / 3) * 4294967296) | 0); } }
    var bytes = []; for (i = 0; i < ascii.length; i++) bytes.push(ascii.charCodeAt(i) & 255);
    var bitLen = bytes.length * 8; bytes.push(128); while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bitLen >>> (i * 8)) & 255);
    var w = new Array(64), rot = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (i = 0; i < bytes.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
      for (j = 16; j < 64; j++) {
        var s0 = rot(w[j - 15], 7) ^ rot(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = rot(w[j - 2], 17) ^ rot(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], gg = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        var t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & gg)) + K[j] + w[j]) | 0;
        var t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = gg; gg = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + gg) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = ""; for (i = 0; i < 8; i++) out += ("00000000" + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }

  function lsGet(k) { try { return g.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { g.localStorage.setItem(k, v); } catch (e) { /* */ } }
  function originOf(u) {
    var m = /^(https?):\/\/([A-Za-z0-9.-]+)(:\d+)?(?:[\/?#]|$)/.exec(String(u || ""));
    return m ? (m[1] + "://" + m[2] + (m[3] || "")).toLowerCase() : "";
  }
  function pageHost() { try { return String(g.location.hostname || "").toLowerCase(); } catch (e) { return ""; } }
  function loopHost(h) { return h === "127.0.0.1" || h === "localhost"; }
  function pageIsLoop() { return loopHost(pageHost()); }
  function pinned(o) { return /^https:\/\/[a-z0-9.-]+$/.test(o) && PIN.indexOf(sha256(o)) >= 0; }
  function okForKey(u) {
    var o = originOf(u);
    if (!o) return false;
    if (pinned(o)) return true;
    var m = /^http:\/\/([a-z0-9.-]+)(:\d+)?$/.exec(o);
    return !!(m && loopHost(m[1]) && pageIsLoop()); /* box previews only */
  }
  function siblingOf(host, label) {
    var parts = String(host || "").split(".");
    return parts.length >= 3 && !/^\d+$/.test(parts[parts.length - 1]) ? "https://" + label + "." + parts.slice(1).join(".") : "";
  }
  function hostOf(o) { return String(o || "").replace(/^https?:\/\//, "").replace(/:\d+$/, ""); }
  function sibling(label) { return siblingOf(pageHost(), label); }
  function pick(cands) { for (var i = 0; i < cands.length; i++) { var o = originOf(cands[i]); if (o && okForKey(o)) return o; } return ""; }
  function savedLights() { return pick([lsGet(HUB_LS)]); }
  function lights() {
    var here = ""; try { here = g.location.origin; } catch (e) { /* */ }
    var cam = pick([lsGet(CAM_LS), here]);
    return pick([lsGet(HUB_LS), sibling("lights"), cam ? siblingOf(hostOf(cam), "lights") : "", pageIsLoop() ? "https://hub.qa.invalid" : ""]);
  }
  function cams() {
    var here = ""; try { here = g.location.origin; } catch (e) { /* */ }
    var hub = savedLights();
    return pick([lsGet(CAM_LS), here, sibling("cams"), hub ? siblingOf(hostOf(hub), "cams") : "", pageIsLoop() ? "https://cams.qa.invalid" : ""]);
  }
  /* HUBPAIR1 · a pairing link may name a hub, honoured only to bootstrap a screen with NO valid hub yet (a Pages home
     has no sibling hub). It must be a bare https origin whose SHA-256 is on the list. The reserved .invalid QA origins
     pass only on a QA page (loopback or a .invalid page host), never on a real host. Nothing is sent before this check. */
  function qaPage() { var h = pageHost(); return loopHost(h) || /\.invalid$/.test(h); }
  function okLinkHub(u) {
    u = String(u || "");
    if (!/^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/?$/.test(u)) return "";
    var o = originOf(u);
    if (!o || !pinned(o)) return "";
    if (/\.invalid(:\d+)?$/.test(o) && !qaPage()) return "";
    return o;
  }
  /* the only writer of the saved hub: pairing, after a successful exchange with the built-in hub */
  function saveLights(o) { o = originOf(o); if (o && pinned(o)) { lsSet(HUB_LS, o); return true; } return false; }

  /* never-send-key-off-list: one guard under every caller. A request to an origin that is not on the list leaves
     without any house key header, whatever the calling script put there. */
  var KEY_HDR = /^(x-lights-proxy-token|x-nest-proxy-token|x-private-feed-token|authorization)$/i;
  var blocked = 0;
  function stripKeys(h) {
    if (!h) return h;
    var out = {}, hit = false;
    var put = function (k, v) { if (KEY_HDR.test(k)) { hit = true; return; } out[k] = v; };
    if (typeof h.forEach === "function" && !Array.isArray(h)) h.forEach(function (v, k) { put(k, v); });
    else if (Array.isArray(h)) h.forEach(function (kv) { put(kv[0], kv[1]); });
    else for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) put(k, h[k]);
    if (hit) blocked++;
    return out;
  }
  if (typeof g.fetch === "function" && !g.fetch.__houseHub) {
    var rawFetch = g.fetch.bind(g);
    var guarded = function (input, init) {
      var url = typeof input === "string" ? input : (input && (input.url || input.href)) || String(input || "");
      var abs = url; try { abs = new URL(url, g.location.href).href; } catch (e) { /* */ }
      if (!okForKey(abs)) {
        if (init && init.headers) init = Object.assign({}, init, { headers: stripKeys(init.headers) });
        if (typeof Request !== "undefined" && input instanceof Request) {
          var hs = stripKeys(input.headers);
          input = new Request(input, { headers: hs });
        }
      }
      return rawFetch(input, init);
    };
    guarded.__houseHub = true;
    g.fetch = guarded;
  }

  g.HouseHub = { blockedCount: function () { return blocked; }, lights: lights, cams: cams, okForKey: okForKey, okLinkHub: okLinkHub, saveLights: saveLights, originOf: originOf, _sha256: sha256 };
})(typeof window !== "undefined" ? window : globalThis);
