"""M7 · computed z-index of the home control is the int32 max, with no phone-shaped source literal."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

os.chdir(ROOT)
srv = ThreadingHTTPServer(("127.0.0.1", 0), Q)
import threading
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d" % srv.server_address[1]
with sync_playwright() as p:
    br = p.chromium.launch(**launch_kw(p, headless=True))
    pg = br.new_page(viewport={"width": 1920, "height": 1080})
    pg.goto(base + "/sheet-today.html", wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(1200)
    z = pg.evaluate("""() => {
      const els = [...document.querySelectorAll('a.wardos-home')].filter(el => getComputedStyle(el).display !== 'none');
      const el = els[0] || document.querySelector('a.wardos-home');
      return el ? getComputedStyle(el).zIndex : '';
    }""")
    br.close()
srv.shutdown()
import json
print(json.dumps({"z": z}))
