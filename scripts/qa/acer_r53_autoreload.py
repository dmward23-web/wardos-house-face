"""Headless proof: a new version.json reloads the wall only after it is idle,
and the outdoor tile recovers from two failures without a reload."""
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path("/opt/cursor/artifacts/r53-autoreload")
OUT.mkdir(parents=True, exist_ok=True)
TOKEN = json.loads((ROOT / "version.json").read_text())["token"]
state = {"token": TOKEN + "b", "wx": 0}
WX_OK = {
    "raw": {
        "current": {
            "temperature_2m": 22.2,
            "weather_code": 1,
            "wind_speed_10m": 8,
            "is_day": 1,
            "precipitation": 0,
            "rain": 0,
            "showers": 0,
            "snowfall": 0,
            "interval": 900,
        }
    },
    "ts": 1,
    "stale": False,
}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/version.json":
            body = json.dumps({"token": state["token"]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            try:
                self.wfile.write(body)
            except Exception:
                return
            return
        if path == "/wx":
            state["wx"] += 1
            if state["wx"] < 3:
                body = b'{"status":"down"}'
                self.send_response(530)
            else:
                body = json.dumps(WX_OK).encode()
                self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            try:
                self.wfile.write(body)
            except Exception:
                return
            return
        rel = path.lstrip("/") or "index.html"
        file = (ROOT / rel).resolve()
        if not str(file).startswith(str(ROOT)) or not file.is_file():
            self.send_error(404)
            return
        data = file.read_bytes()
        kind = "text/html"
        if file.suffix == ".js":
            kind = "text/javascript"
        elif file.suffix == ".css":
            kind = "text/css"
        elif file.suffix == ".json":
            kind = "application/json"
        elif file.suffix == ".svg":
            kind = "image/svg+xml"
        elif file.suffix == ".png":
            kind = "image/png"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except Exception:
            return

httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
log = []

def note(msg):
    log.append(msg)
    print(msg, flush=True)

note("base " + base)
note("served token " + state["token"] + " page token " + TOKEN)
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(base + "sheet-index.html", wait_until="domcontentloaded", timeout=20000)
    page.wait_for_timeout(2500)
    note("after first poll url " + page.url)
    page.screenshot(path=str(OUT / "01-before-idle.png"))
    spot = page.evaluate("""() => {
      const el = document.elementFromPoint(960, 540);
      return { tag: el && el.tagName, link: !!(el && el.closest && el.closest("a")) };
    }""")
    note("center " + json.dumps(spot))
    if not spot["link"]:
        page.mouse.click(960, 540)
        note("pressed the wall")
    page.wait_for_timeout(3000)
    note("while active url " + page.url)
    page.screenshot(path=str(OUT / "02-active-no-reload.png"))
    wx = page.evaluate("""() => (document.getElementById("house-wx") || {}).innerText || "" """)
    note("weather while failing " + " ".join(wx.split()))
    # The press holds the reload. The feed retries at 15s then 30s, so it is back before the wall is idle.
    page.wait_for_timeout(55000)
    wx = page.evaluate("""() => (document.getElementById("house-wx") || {}).innerText || "" """)
    note("weather after retry " + " ".join(wx.split()))
    note("url before idle elapses " + page.url)
    page.screenshot(path=str(OUT / "03-feed-recovered.png"))
    page.wait_for_function("() => location.search.indexOf('fresh=') >= 0", timeout=45000)
    note("reloaded url " + page.url)
    page.screenshot(path=str(OUT / "04-after-idle-reload.png"))
    note("wx fetches " + str(state["wx"]))

(OUT / "run.log").write_text("\n".join(log) + "\n")
os._exit(0)
