"""FOLLOWUP1 · slow-hub check for mercury-run: a paired screen whose hub answers kids-week after a delay (default 5 s, past
the 4 s empty start). Usage: python3 scripts/qa/slow_hub.py <full|empty> [delay_s] [width] [height]
Prints JSON {"early_lit", "at_4500": {"gather", "hud"}, "at_8000": {"gather", "hud"}, "hub_hits", "errors"}.
Serves the repo on a random loopback port and plays the hub on the same port (?pfBase=, loopback only): the synthetic
fixture scripts/qa/fixtures/private/kids-week.synthetic.json is the week. 'full' ticks every must for the kid before the
hub answers (device-local checks, like a kid who already closed the week); 'empty' ticks nothing. A fake key in a fresh
browser profile; every non-loopback request is stubbed (204)."""
import json, os, sys, threading, functools, io, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FIX = os.path.join(ROOT, "scripts", "qa", "fixtures", "private", "kids-week.synthetic.json")
mode = sys.argv[1]
delay = float(sys.argv[2]) if len(sys.argv) > 2 else 5.0
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1920
h = int(sys.argv[4]) if len(sys.argv) > 4 else 1080
hits = []
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = urlparse(self.path).path
        if p.startswith("/api/private/"):
            if p == "/api/private/kids-week.json":
                hits.append(time.time())
                time.sleep(delay)
                body = open(FIX, "rb").read()
                self.send_response(200); self.send_header("Content-Type", "application/json")
            else:
                body = b"{}"; self.send_response(404)
            self.send_header("Content-Length", str(len(body))); self.send_header("Connection", "close"); self.end_headers()
            self.wfile.write(body); return
        return super().do_GET()
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}"
SEED = r"""async () => {
  const d = await (await fetch('/scripts/qa/fixtures/private/kids-week.synthetic.json')).json();
  const W = window.WardKids, kid = 'hayes', days = W.weekDayIsos(W.DAY_ISO);
  for (const q of W.mustQuests(kid, d)) {
    const isos = (q.cadence || 'daily') === 'daily' ? days : [W.DAY_ISO];
    for (const iso of isos) { const k = W.checkKeyFor(q.id, d, iso); const s = W.loadKeyState(k); s[q.id] = true; W.saveKeyState(k, s); }
  }
  return W.mustQuests(kid, d).length;
}"""
STATE = "() => ({ gather: !!document.querySelector('#run-ui .gather'), hud: document.querySelectorAll('#run-ui .hud').length })"
def lit(png):
    px = list(Image.open(io.BytesIO(png)).convert("L").resize((96, 96)).tobytes())
    return round(sum(1 for v in px if v > 24) / len(px), 3)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--disable-gpu"])
    pg = b.new_page(); pg.set_viewport_size({"width": w, "height": h})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
    def gate(route):
        if urlparse(route.request.url).hostname != "127.0.0.1": return route.fulfill(status=204, body="")
        return route.continue_()
    pg.route("**/*", gate)
    t0 = time.time()
    pg.goto(base + "/mercury-run.html?kid=hayes&pfBase=" + base, wait_until="domcontentloaded", timeout=60000)
    seeded = pg.evaluate(SEED) if mode == "full" else 0
    pg.wait_for_timeout(max(0, int((1.2 - (time.time() - t0)) * 1000)))
    early = lit(pg.screenshot())
    pg.wait_for_timeout(max(0, int((4.5 - (time.time() - t0)) * 1000)))
    s1 = pg.evaluate(STATE)
    pg.wait_for_timeout(max(0, int((delay + 3.0 - (time.time() - t0)) * 1000)))
    s2 = pg.evaluate(STATE)
    b.close()
srv.shutdown()
print(json.dumps({"mode": mode, "seeded": seeded, "early_lit": early, "at_4500": s1, "after_hub": s2, "hub_hits": len(hits), "errors": errors[:5]}))
