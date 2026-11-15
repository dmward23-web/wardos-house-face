"""Sixty fresh loads of each stage sheet. Prism face must really load, with nothing blocked."""
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])
SHEETS = [
    "sheet-google-home.html", "month.html", "sheet-allowance.html", "sheet-win.html",
    "sheet-groceries.html", "sheet-index.html", "sheet-lights.html", "sheet-chores.html",
    "sheet-today.html", "nest-webrtc.html", "sheet-spotify.html", "sheet-weekend.html",
]
ASSETS = ("prism-face.css", "prism-face.js", "home-key-light")
PROBE = """() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const dcl = nav && nav.domContentLoadedEventStart;
  if (!dcl) return false;
  const link = document.getElementById("prism-face-css");
  let cssOk = false;
  try { cssOk = !!(link && link.sheet && link.sheet.cssRules && link.sheet.cssRules.length > 0); } catch (e) { cssOk = false; }
  const entries = performance.getEntriesByType("resource");
  const ready = (bit) => entries.some((e) => e.name.indexOf(bit) >= 0 && e.startTime < dcl && e.responseEnd > 0 && ((e.decodedBodySize || 0) > 0 || (e.transferSize || 0) > 0));
  return cssOk && ready("prism-face.css") && ready("prism-face.js") && ready("home-key-light");
}"""

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
        if file.suffix == ".png":
            kind = "image/png"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except BrokenPipeError:
            return

httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]

def one(browser, url):
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    failed = []
    def on_fail(req):
        if any(bit in req.url for bit in ASSETS):
            failed.append(req.url.split("/")[-1])
    page.on("requestfailed", on_fail)
    ok = False
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=8000)
        ok = bool(page.evaluate(PROBE))
    except Exception:
        ok = False
    finally:
        try:
            page.evaluate("() => { try { window.stop(); } catch (e) {} }")
        except Exception:
            pass
        try:
            page.close()
        except Exception:
            pass
        try:
            ctx.close()
        except Exception:
            pass
    return ok and not failed

out = {}
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for name in SHEETS:
        home = 0
        missing = 0
        for i in range(60):
            if one(browser, base + name):
                home += 1
            else:
                missing += 1
        out[name] = {"loads": 60, "missing": missing, "home": home}
        print(name, out[name], flush=True)
print(json.dumps(out), flush=True)
os._exit(0 if all(row["missing"] == 0 and row["home"] == 60 for row in out.values()) else 1)
