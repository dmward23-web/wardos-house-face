/* LIVING HOUSE · probe.js · loaded only with ?probe=1 (lh.js injects it; zero cost when off). FPS (rAF), long tasks
   (count + max ms), JS heap (performance.memory or n/a), DOM node count, sampled every 1 s into window.__lhProbe
   (rolling 600 samples), dumped to console every 10 s, downloadable with the save button. */
(function () {
  var frames = 0, lt = { n: 0, max: 0 }, log = window.__lhProbe = [], C = window.LHClock;
  (function raf() { frames++; requestAnimationFrame(raf); })();
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { lt.n++; lt.max = Math.max(lt.max, Math.round(e.duration)); }); }).observe({ type: "longtask", buffered: true }); } catch (e) { lt.n = "n/a"; }
  var box = document.createElement("div"); box.className = "lh-probe";
  var txt = document.createElement("pre"), btn = document.createElement("button"); btn.textContent = "save"; btn.type = "button";
  box.appendChild(txt); box.appendChild(btn); document.body.appendChild(box);
  btn.addEventListener("click", function () { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(log, null, 1)], { type: "application/json" })); a.download = "lh-probe.json"; a.click(); });
  var last = performance.now();
  setInterval(function () {
    var t = performance.now(), fps = Math.round(frames * 1000 / (t - last)); frames = 0; last = t;
    var m = performance.memory, heap = m ? (m.usedJSHeapSize / 1048576).toFixed(1) + " MB" : "n/a", dom = document.getElementsByTagName("*").length;
    var s = { t: C ? C.realMs() : 0, fps: fps, longtasks: lt.n, longMax: lt.max, heap: heap, dom: dom };
    log.push(s); if (log.length > 600) log.shift();
    txt.textContent = "fps " + fps + "\nlong " + lt.n + " max " + lt.max + "ms\nheap " + heap + "\ndom " + dom;
  }, 1000);
  setInterval(function () { console.log("[lhProbe]", JSON.stringify(log.slice(-10))); }, 10000);
})();
