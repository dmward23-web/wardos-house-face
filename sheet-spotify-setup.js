/* SPOTCUT (Alfred, ADULTCUT1) · sheet-spotify-setup.html (Dad-only). The one-time Spotify setup handlers moved here from
 * sheet-spotify.js so no kid-reachable page carries a Client ID field or a save path. The Client ID is POSTed to the house
 * box (HouseSpotify.setup, which only answers on this page); nothing is written to browser storage. */
(function () {
  "use strict";
  var SP = window.HouseSpotify;
  var $ = function (id) { return document.getElementById(id); };
  $("spw-copy-btn").addEventListener("click", function () {
    var t = $("spw-redirect").textContent, b = this;
    function ok() { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1600); }
    function selectCode() { var r = document.createRange(); r.selectNodeContents($("spw-redirect")); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected"; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, selectCode);
    else selectCode();
  });
  $("spw-setup-go").addEventListener("click", function () {
    var v = ($("spw-client").value || "").trim().replace(/\s+/g, ""), err = $("spw-setup-err");
    var m = /[0-9a-f]{32}/i.exec(v);
    if (!m) { err.textContent = "That doesn't look like a Client ID. It's 32 letters and numbers on the app's page."; return; }
    if (!SP || !SP.setup) { err.textContent = "The Spotify helper didn't load. Reload this page."; return; }
    err.textContent = "Saving on the house box...";
    SP.setup(m[0], "sheet-spotify.html").then(function (j) {
      if (j && j.url) { err.textContent = "Opening Spotify sign-in..."; return; }
      err.textContent = (j && j.message) || (j && j.error === "offline" ? "House box didn't answer. Try again in a minute." : j && j.error === "dad_only" ? "Setup only runs on Dad's setup sheet." : "Couldn't save that. Try again.");
    });
  });
})();
