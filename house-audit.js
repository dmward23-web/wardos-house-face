/* AUDIT1 · ?audit=1 or WARDOS_AUDIT blocks every non-GET.
   Checkoffs stay in localStorage. The words "audit on" are painted only
   inside #wardos-diag, and that overlay exists only when ?diag=1. */
(function (global) {
  "use strict";
  if (global.HouseAudit) return;

  function queryOn() {
    try { return /(?:\?|&)audit=1(?:&|$)/.test((global.location && global.location.search) || ""); }
    catch (e) { return false; }
  }
  function stored() {
    try { return !!(global.sessionStorage && global.sessionStorage.getItem("wardos-audit") === "1"); }
    catch (e) { return false; }
  }
  function remember() {
    if (!queryOn()) return;
    try { if (global.sessionStorage) global.sessionStorage.setItem("wardos-audit", "1"); } catch (e) { /* */ }
  }
  function active() {
    if (global.WARDOS_AUDIT === true) return true;
    try {
      if (global.document && global.document.documentElement.getAttribute("data-audit") === "1") return true;
    } catch (e) { /* */ }
    return queryOn() || stored();
  }
  function href(url) {
    if (!active() || url == null) return url;
    var s = String(url);
    if (!s || s.charAt(0) === "#" || /^(?:mailto|tel|javascript):/i.test(s)) return s;
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(s)) return s;
    if (/[?&]audit=1(?:&|$)/.test(s)) return s;
    var hash = "";
    var hi = s.indexOf("#");
    if (hi >= 0) { hash = s.slice(hi); s = s.slice(0, hi); }
    return s + (s.indexOf("?") >= 0 ? "&" : "?") + "audit=1" + hash;
  }

  function deny(method) {
    var m = String(method || "GET").toUpperCase();
    return active() && m !== "GET" && m !== "HEAD";
  }

  function stub() {
    try {
      return new Response("{}", {
        status: 204,
        headers: { "Content-Type": "application/json", "X-Wardos-Audit": "blocked" }
      });
    } catch (e) {
      return {
        ok: true,
        status: 204,
        headers: { get: function () { return "blocked"; } },
        json: function () { return Promise.resolve({}); },
        text: function () { return Promise.resolve(""); }
      };
    }
  }

  function install() {
    if (global.fetch && !global.fetch._wardosAudit) {
      var orig = global.fetch.bind(global);
      var wrapped = function (input, init) {
        var method = (init && init.method) || (input && input.method) || "GET";
        if (deny(method)) return Promise.resolve(stub());
        return orig(input, init);
      };
      wrapped._wardosAudit = true;
      global.fetch = wrapped;
    }
    var XHR = global.XMLHttpRequest;
    if (XHR && !XHR._wardosAudit) {
      var open = XHR.prototype.open;
      var send = XHR.prototype.send;
      XHR.prototype.open = function (method, url) {
        this._wardosMethod = method;
        this._wardosUrl = url;
        return open.apply(this, arguments);
      };
      XHR.prototype.send = function (body) {
        if (deny(this._wardosMethod)) {
          var self = this;
          setTimeout(function () {
            try { Object.defineProperty(self, "readyState", { configurable: true, value: 4 }); } catch (e) { self.readyState = 4; }
            try { Object.defineProperty(self, "status", { configurable: true, value: 204 }); } catch (e2) { self.status = 204; }
            self.responseText = "{}";
            if (typeof self.onreadystatechange === "function") self.onreadystatechange();
            if (typeof self.onload === "function") self.onload();
          }, 0);
          return;
        }
        return send.apply(this, arguments);
      };
      XHR._wardosAudit = true;
    }
    if (global.navigator && typeof global.navigator.sendBeacon === "function" && !global.navigator.sendBeacon._wardosAudit) {
      var beacon = global.navigator.sendBeacon.bind(global.navigator);
      var wrappedBeacon = function () {
        if (active()) return true;
        return beacon.apply(global.navigator, arguments);
      };
      wrappedBeacon._wardosAudit = true;
      try { global.navigator.sendBeacon = wrappedBeacon; } catch (e3) { /* */ }
    }
    if (active() && global.document && global.document.documentElement) {
      global.document.documentElement.setAttribute("data-audit", "1");
    }
  }

  remember();
  install();
  if (global.document && global.document.addEventListener) {
    global.document.addEventListener("click", function (ev) {
      if (!active()) return;
      var t = ev.target;
      var a = t && t.closest ? t.closest("a[href]") : null;
      if (!a) return;
      var next = href(a.getAttribute("href"));
      if (next && next !== a.getAttribute("href")) a.setAttribute("href", next);
    }, true);
  }
  global.HouseAudit = { active: active, install: install, deny: deny, href: href };
})(typeof window !== "undefined" ? window : globalThis);
