#!/usr/bin/env python3
"""15 Home taps on Google Home from first paint, under 4x CPU. Prints one JSON object."""
import json, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

httpd = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Q(*a, directory=str(ROOT), **k))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
times = []
ok = 0
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for i in range(15):
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page = ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
        try:
            page.goto(base + "sheet-google-home.html?now=2026-11-12T12:30:00-06:00&freeze=1", wait_until="commit", timeout=30000)
            page.wait_for_selector("a.wardos-home", state="attached", timeout=20000)
            t0 = time.perf_counter()
            try:
                with page.expect_navigation(timeout=8000, wait_until="commit"):
                    page.locator("a.wardos-home").click(timeout=5000)
            except Exception:
                pass
            try:
                page.wait_for_url("**sheet-index.html**", timeout=20000)
            except Exception:
                pass
            dt = (time.perf_counter() - t0) * 1000
            if "sheet-index" in page.url:
                ok += 1
                times.append(dt)
        except Exception:
            pass
        ctx.close()
    browser.close()
httpd.shutdown()
times.sort()
mid = times[len(times) // 2] if times else -1
print(json.dumps({"ok": ok, "n": 15, "median": round(mid, 1), "max": round(max(times), 1) if times else -1}))
