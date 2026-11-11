"""Round 10 · Ainsley's sprite box has real paint, and the clock, next card, and chore type are on the wall."""
import functools, json, os, sys, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WEEK = json.dumps({
    "asOfIso": "2026-11-10",
    "kids": {"ainsley": {"today": [
        {"id": "swim", "kind": "sport", "what": "Ainsley swim Coach Ann", "startIso": "2026-11-10T16:25:00-06:00"}
    ]}}
})

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        if "kids-week" in self.path or "cal-live" in self.path:
            body = WEEK.encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % srv.server_address[1]
PROBE = r"""() => {
  const cv = document.querySelector("canvas.kw-canvas");
  const x = +(cv && cv.getAttribute("data-hero-x"));
  const y = +(cv && cv.getAttribute("data-hero-y"));
  const w = +(cv && cv.getAttribute("data-hero-w"));
  const h = +(cv && cv.getAttribute("data-hero-h"));
  let painted = 0;
  if (cv && w > 10 && h > 10) {
    const dpr = cv.width / 900;
    const ctx = cv.getContext("2d");
    const img = ctx.getImageData(Math.max(0, Math.round(x * dpr)), Math.max(0, Math.round(y * dpr)), Math.round(w * dpr), Math.round(h * dpr));
    const d = img.data;
    for (let i = 0; i < d.length; i += 16) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if ((Math.abs(r - b) < 45 && r > 80 && b > 55) || (r > 200 && g > 185 && b > 160)) painted++;
    }
  }
  const clock = ((document.querySelector("[data-kw-clock]") || {}).textContent || "").replace(/\s+/g, " ").trim();
  const heroEl = document.querySelector("#sec-days .consume-hero") || document.querySelector(".consume-hero");
  const next = ((heroEl || {}).textContent || "").replace(/\s+/g, " ").trim();
  const nextHtml = heroEl ? heroEl.className + " " + (heroEl.innerHTML || "").slice(0, 240) : "no-hero";
  const jar = ((document.querySelector("[data-jar-state]") || {}).textContent || "").replace(/\s+/g, " ").trim();
  const what = document.querySelector("#sec-musts .what");
  const whatPx = what ? parseFloat(getComputedStyle(what).fontSize) : 0;
  const hero = document.querySelector("#sec-days .consume-hero:not(.empty)");
  const note = document.querySelector("[data-kw-offline]");
  return { painted, clock, next, nextHtml, jar, whatPx, offlineOnCard: !!(note && hero), box: [x, y, w, h] };
}"""
with sync_playwright() as p:
    b = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
    ctx = b.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1, timezone_id="America/Chicago", reduced_motion="reduce")
    pg = ctx.new_page()
    pg.add_init_script("""() => { try {
      localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000');
      localStorage.setItem('wardos-lights-proxy-token', 'paired-test-key-value');
      localStorage.setItem('wardos-lights-proxy', location.origin);
    } catch (e) {} }""")
    seen = []
    def handle(route):
        u = route.request.url
        if "kids-week" in u or "cal-live" in u or "/api/private/" in u:
            seen.append(u[:160])
            route.fulfill(status=200, content_type="application/json", body=WEEK)
        elif u.startswith(base) or u.startswith("data:"):
            route.continue_()
        else:
            seen.append("abort " + u[:120])
            route.abort()
    pg.route("**/*", handle)
    pg.goto(base + "sheet-index.html?now=2026-11-10T12:30:00-06:00", wait_until="domcontentloaded", timeout=60000)
    pg.evaluate("""() => {
      localStorage.setItem('wardosNestProxyToken', 'legacy-stale-test-key');
      localStorage.setItem('wardos-lights-proxy-token', 'paired-test-key-value');
      localStorage.setItem('wardos-lights-proxy', location.origin);
      localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000');
    }""")
    pg.goto(base + "kid-ainsley.html?now=2026-11-10T12:30:00-06:00&freeze=1", wait_until="load", timeout=60000)
    pg.wait_for_timeout(2500)
    out = pg.evaluate(PROBE)
    b.close()
srv.shutdown()
print(json.dumps(out))
