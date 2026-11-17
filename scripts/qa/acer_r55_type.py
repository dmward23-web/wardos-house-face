"""1920x1080 DPR 1. Strip type is at least 24px and tomorrow events do not share a line."""
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
        elif file.suffix == ".css":
            kind = "text/css"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
PROBE = r"""() => {
  const host = document.body;
  host.insertAdjacentHTML("beforeend",
    '<div class="lb-day-tmr" id="r55-tmr"><span class="lb-day-tchip">9:00 Soccer</span><span class="lb-day-tchip">10:00 Art club</span></div>' +
    '<div class="lb-day-what" id="r55-what">Skate City Night</div>' +
    '<div class="kf-row"><span class="kf-md" id="r55-md">Friends Club</span></div>' +
    '<ul class="cw-day" id="r55-day"><li>6:00 Skate City Night</li><li>7:00 basketball</li></ul>');
  const px = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return { sel: sel, px: parseFloat(getComputedStyle(el).fontSize) };
  };
  const fonts = ["#r55-what", "#r55-md", "#r55-tmr .lb-day-tchip", "#r55-day li"].map(px).filter(Boolean);
  const chips = [...document.querySelectorAll("#r55-tmr .lb-day-tchip")].map((el) => {
    const r = el.getClientRects();
    return { n: r.length, top: r.length ? r[0].top : 0, bottom: r.length ? r[r.length - 1].bottom : 0 };
  });
  let shared = false;
  if (chips.length === 2) {
    const overlap = Math.min(chips[0].bottom, chips[1].bottom) - Math.max(chips[0].top, chips[1].top);
    shared = overlap > 4;
  } else shared = true;
  return { fonts: fonts, sharedLine: shared, lines: chips };
}"""
out = {}
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for name in ["sheet-index.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html"]:
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(base + name, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(400)
        out[name] = page.evaluate(PROBE)
        page.close()
        ctx.close()
    browser.close()
print(json.dumps(out), flush=True)
os._exit(0)
