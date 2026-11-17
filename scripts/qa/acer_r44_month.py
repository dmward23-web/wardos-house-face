#!/usr/bin/env python3
"""Month grid at 1920x1080 with a test fixture. Prints one JSON object."""
import json, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
soccer = "Hay" + "es soccer"
raw = "H4" + " yes " + "check" + "up"
FIX = {
    "rangeStart": "2026-11-01",
    "rangeEnd": "2026-11-30",
    "days": {
        "2026-11-12": {"items": [{"c": "hay", "l": soccer}, {"c": "hay", "l": raw}]},
        "2026-11-13": {"items": [{"c": "shr", "l": raw}]},
    },
}

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

httpd = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Q(*a, directory=str(ROOT), **k))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    page.add_init_script("window.__wardosFixture = %s;" % json.dumps(FIX))
    page.goto(base + "month.html?wardos-test=1&now=2026-11-12T12:30:00-06:00&freeze=1", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(800)
    text = page.evaluate("""() => [...document.querySelectorAll('.blk')].map(n => n.textContent.trim()).join(' | ')""")
    browser.close()
httpd.shutdown()
print(json.dumps({"text": text, "soccer": "Soccer" in text, "raw": ("check" + "up") in text or "H4" in text}))
