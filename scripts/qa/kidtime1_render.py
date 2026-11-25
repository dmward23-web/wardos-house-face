"""R3-4 · Hayes Today strip shows a real clock time, not FRI 4."""
import json, os, re, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
FEED = ROOT / "scripts" / "qa" / "fixtures" / "day0-dec4"
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
         ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp"}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        p = self.path.split("?", 1)[0].lstrip("/") or "index.html"
        m = re.match(r"api/private/([a-z-]+)\.json$", p)
        f = (FEED / ("feed-%s.json" % m.group(1))) if m else (ROOT / p).resolve()
        if not f.is_file() or (not m and ROOT not in f.parents and f != ROOT):
            self.send_error(404)
            return
        d = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(f.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(d)))
        self.end_headers()
        try:
            self.wfile.write(d)
        except Exception:
            pass

srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d" % srv.server_address[1]
JS = r"""() => {
  const rows = [...document.querySelectorAll('#sec-days .consume-ahead-row')].filter(e => {
    const r = e.getBoundingClientRect();
    return getComputedStyle(e).display !== 'none' && r.height > 1;
  }).map(e => e.innerText.replace(/\s+/g, ' ').trim());
  return { rows };
}"""
with sync_playwright() as p:
    br = p.chromium.launch(**launch_kw(p, headless=True))
    c = br.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    c.add_init_script("try{localStorage.setItem('wardos-private-feed-token','r58-box-fixture-key')}catch(e){}")
    pg = c.new_page()
    pg.goto(base + "/kid-hayes.html?pfBase=" + base + "&now=2026-12-04T07:30:00-06:00&freeze=1", wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(3500)
    print(json.dumps(pg.evaluate(JS)))
    br.close()
srv.shutdown()
