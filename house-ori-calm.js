/* ORICALM1 · one tame orb that floats near its home spot beside the header. No zipping, no chasing taps. */
(function () {
  if (!document.documentElement.classList.contains("ori-calm")) return;
  var orb = document.createElement("div");
  orb.className = "ori-calm-orb";
  orb.setAttribute("aria-hidden", "true");
  document.body.appendChild(orb);
  function home() {
    var hdr = document.querySelector("header.hdr");
    var r = hdr ? hdr.getBoundingClientRect() : null;
    var x, y;
    if (r && r.left >= 80) { x = r.left - 40; y = r.top + r.height * 0.5; }
    else { x = r ? r.right - 20 : innerWidth - 30; y = r ? r.bottom + 2 : 120; }
    orb.style.setProperty("--orb-x", Math.round(x) + "px");
    orb.style.setProperty("--orb-y", Math.round(y) + "px");
  }
  home();
  addEventListener("resize", home);
  setTimeout(home, 800);
})();
