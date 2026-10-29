/* HATCH2 · Hearthlings hatch v2 stills, PREVIEW ONLY (loaded by preview-hatch2.html and nothing else).
   ?kid=hayes|harris|ainsley picks the kid; anything else shows the plain dark stage. The still is set only when the proxy's
   caps.json keys the exact listed file (wg-assets.js WGArt.have, LIVEWX2), so a box without the private art asks for nothing.
   <picture>: <source type="image/webp"> first, <img> png fallback. No words, no counts, no money on this page. */
(function () {
  var KIDS = { hayes: 1, harris: 1, ainsley: 1 };
  var kid = (new URLSearchParams(location.search).get("kid") || "").toLowerCase();
  if (!KIDS[kid]) return;
  var stage = document.getElementById("h2-stage");
  document.body.setAttribute("data-kid", kid);
  function names(k) { return { webp: "kidboards/hatch-" + k + "-v2.webp", png: "kidboards/hatch-" + k + "-v2.png" }; }
  function put(art) {
    var n = names(kid), have = art.have || {};
    if (!have[n.webp] && !have[n.png]) return;   /* nothing listed: keep the plain stage */
    var pic = document.createElement("picture");
    if (have[n.webp]) { var s = document.createElement("source"); s.type = "image/webp"; s.srcset = art.base + n.webp; pic.appendChild(s); }
    var img = document.createElement("img");
    img.alt = ""; img.decoding = "async";
    img.src = art.base + (have[n.png] ? n.png : n.webp);
    pic.appendChild(img);
    stage.textContent = "";
    stage.appendChild(pic);
    document.body.setAttribute("data-hatch2-on", kid);
  }
  if (window.WGArt) put(window.WGArt);
  else addEventListener("wg:caps", function () { if (window.WGArt) put(window.WGArt); });
})();
