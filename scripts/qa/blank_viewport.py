"""MERCNODATA1 · render-time check: load a page unpaired (no device key) or offline (?pfOffline=1) in a real browser and
measure how much of the screen is not black. Usage: python3 scripts/qa/blank_viewport.py <page.html> <width> <height> <unpaired|offline> [shot.png]
Prints JSON {"lit": fraction of sampled pixels brighter than near-black, "canvas": bool, "errors": [...]}
Serves the repo on a random loopback port; every non-loopback request is stubbed (204), so the hub is never reached."""
import json, os, sys, threading, functools, io
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
page_name, w, h, mode = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
shot = sys.argv[5] if len(sys.argv) > 5 else None
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}/"
PROBE = r"""() => { const c = document.querySelector('canvas'); const s = c && getComputedStyle(c);
  return { canvas: !!(c && c.width > 0 && c.height > 0 && s.display !== 'none' && s.visibility !== 'hidden') }; }"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--disable-gpu"])
    pg = b.new_page(); pg.set_viewport_size({"width": w, "height": h})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    def gate(route):
        if urlparse(route.request.url).hostname != "127.0.0.1": return route.fulfill(status=204, body="")
        return route.continue_()
    pg.route("**/*", gate)
    pg.goto(base + page_name + ("?pfOffline=1" if mode == "offline" else ""), wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(2500)
    png = pg.screenshot(path=shot) if shot else pg.screenshot()
    info = pg.evaluate(PROBE)
    b.close()
srv.shutdown()
from PIL import Image
im = Image.open(io.BytesIO(png)).convert("L").resize((96, 96))
px = list(im.tobytes())
lit = sum(1 for v in px if v > 24) / len(px)
print(json.dumps({"lit": round(lit, 3), "canvas": info["canvas"], "errors": errors[:5]}))
