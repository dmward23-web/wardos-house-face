"""Sixty loads of each stage sheet. Prism-face assets must not be cancelled, and Home must be present."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHEETS = [
    "sheet-google-home.html", "month.html", "sheet-allowance.html", "sheet-win.html",
    "sheet-groceries.html", "sheet-index.html", "sheet-lights.html", "sheet-chores.html",
    "sheet-today.html", "nest-webrtc.html", "sheet-spotify.html", "sheet-weekend.html",
]
ASSETS = ("prism-face.css", "prism-face.js", "assets/icons/home-key-light.svg", "assets/icons/home-key-light-64.png")

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        rel = self.path.split("?", 1)[0].lstrip("/") or "index.html"
        file = (ROOT / rel).resolve()
        if not str(file).startswith(str(ROOT)) or not file.is_file():
            self.send_error(404)
            return
        data = file.read_bytes()
        kind = "text/html" if file.suffix == ".html" else "application/octet-stream"
        if file.suffix == ".js":
            kind = "text/javascript"
        if file.suffix == ".css":
            kind = "text/css"
        if file.suffix == ".svg":
            kind = "image/svg+xml"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
out = {}
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for name in SHEETS:
        missing = 0
        home = 0
        for i in range(60):
            ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            page = ctx.new_page()
            bad = []
            def on_fail(req, bag=bad):
                url = req.url
                if any(bit in url for bit in ASSETS):
                    bag.append(url)
            page.on("requestfailed", on_fail)
            page.goto(base + name, wait_until="commit", timeout=15000)
            page.wait_for_selector("link#prism-face-css, img[src*='home-key-light']", timeout=8000)
            icon = page.evaluate("""() => {
              const img = document.querySelector("img[src*='home-key-light'], img[srcset*='home-key-light']");
              const link = document.getElementById("prism-face-css");
              const js = document.getElementById("prism-face-js");
              return !!(img && (img.getAttribute("src") || img.currentSrc)) && !!link && !!js;
            }""")
            if bad:
                missing += 1
            if icon:
                home += 1
            ctx.close()
        out[name] = {"loads": 60, "missing": missing, "home": home}
    browser.close()
httpd.shutdown()
print(json.dumps(out))
