"""Tap-loop stress. One browser, a fresh context per tap, 36 cycles. Exits non-zero on a hang."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fixture_clock import arm_navigation_cutoff, log_step, open_context, release_context, stop_httpd
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
N = 36

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
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
url = base + "sheet-google-home.html?now=2026-11-12T12:30:00-06:00&freeze=1"
ok = 0
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for i in range(N):
        n = i + 1
        log_step("stress tap %d" % n)
        ctx, page = open_context(browser, tap=n, viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        try:
            page.goto(url, wait_until="commit", timeout=15000)
            page.wait_for_selector("a.wardos-home", state="visible", timeout=8000)
            ready = page.evaluate("""() => {
              const a = document.querySelector("a.wardos-home");
              if (!a) return null;
              const r = a.getBoundingClientRect();
              if (r.width < 32 || r.height < 32) return null;
              const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              if (!(hit && hit.closest && hit.closest("a.wardos-home"))) return null;
              return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            }""")
            if not ready:
                log_step("stress tap %d not-ready" % n)
                raise SystemExit(1)
            arm_navigation_cutoff(page)
            with page.expect_request("**/sheet-index.html**", timeout=4000):
                page.mouse.click(ready["x"], ready["y"], delay=0)
            ok += 1
            log_step("stress tap %d ok" % n)
        finally:
            release_context(page, ctx, tap=n)
    print(json.dumps({"loops": N, "ok": ok, "hangs": 0}), flush=True)
    sys.stdout.flush()
    stop_httpd(httpd)
    sys.exit(0 if ok == N else 1)
