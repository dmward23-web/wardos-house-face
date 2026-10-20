/* LIVING HOUSE · return.js · one calm way back to the house.
   Loaded only when this page's URL has from=lh. Nothing is stored for the visit.
   Never draws the clock override or the probe overlay. */
(function () {
  if (document.getElementById("lh-return")) return;
  var a = document.createElement("a");
  a.id = "lh-return";
  a.setAttribute("data-lh-return", "");
  var nested = /\/livinghouse\//.test(String(location.pathname || ""));
  var keep = new URLSearchParams();
  try {
    var q = new URLSearchParams(location.search);
    ["now", "freeze", "rec", "probe", "halloween", "state"].forEach(function (k) { if (q.get(k)) keep.set(k, q.get(k)); });
  } catch (e) { /* no query */ }
  var s = keep.toString();
  a.href = (nested ? "index.html" : "livinghouse/index.html") + (s ? "?" + s : "");
  a.textContent = "House";
  a.setAttribute("aria-label", "Back to the house");
  a.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147482000;min-width:44px;min-height:44px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:999px;font:700 16px/1.2 system-ui,sans-serif;color:#f6dfae;background:rgba(20,16,12,.92);border:1px solid rgba(255,210,150,.4);text-decoration:none";
  (document.body || document.documentElement).appendChild(a);
})();
