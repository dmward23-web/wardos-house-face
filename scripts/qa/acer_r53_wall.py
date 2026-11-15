"""Groceries safe area, first camera tap, Cameras commit, Music slot, offline line."""
import json, os, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

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
        self.send_response(200)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
out = {}
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(base + "sheet-groceries.html", wait_until="domcontentloaded", timeout=15000)
    page.wait_for_timeout(400)
    out["groceries"] = page.evaluate("""() => {
      const sel = ".fav, .add-btn, a.treat-kid, .ftr-chip, a.wardos-home";
      const nodes = Array.from(document.querySelectorAll(sel)).map(el => {
        const r = el.getBoundingClientRect();
        return { t: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.bottom), x: Math.round(r.left) };
      });
      const panel = document.querySelector(".panel").getBoundingClientRect();
      return { nodes, bottom: Math.round(panel.bottom) };
    }""")
    ctx.close()

    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(base + "sheet-index.html", wait_until="domcontentloaded", timeout=15000)
    page.wait_for_function("""() => {
      const line = document.getElementById("hub-offline-line");
      const music = document.getElementById("hub-spotify-tile");
      return line && !line.hidden && music && (music.textContent || "").indexOf("Music offline") >= 0;
    }""", timeout=8000)
    out.update(page.evaluate("""() => {
      const box = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom), visible: s.display !== "none" && r.width > 0 && r.height > 0 };
      };
      const musicEl = document.getElementById("hub-spotify-tile");
      const music = box(musicEl);
      music.offline = (musicEl.querySelector(".sp-title") || {}).textContent || "";
      music.buttons = Array.from(musicEl.querySelectorAll(".sp-btn")).filter(b => getComputedStyle(b).display !== "none").map(b => {
        const r = b.getBoundingClientRect();
        return { label: b.getAttribute("aria-label"), x: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height), disabled: b.disabled || b.getAttribute("aria-disabled") === "true" };
      }).sort((a, b) => a.x - b.x);
      music.gaps = [];
      for (var gi = 1; gi < music.buttons.length; gi++) music.gaps.push(music.buttons[gi].x - music.buttons[gi - 1].right);
      const lights = document.getElementById("hub-lights-panel");
      const line = document.getElementById("hub-offline-line");
      return {
        music,
        lights: !!(lights && getComputedStyle(lights).display !== "none" && !lights.hidden),
        offline: line && !line.hidden ? line.textContent : "",
        calendarPlates: Array.from(document.querySelectorAll(".roster-title, .hub-next-title")).filter(el => el.textContent.indexOf("Calendar unavailable") >= 0 && getComputedStyle(el).display !== "none").length,
        launch: box(document.querySelector(".hub-launch"))
      };
    }"""))
    page.evaluate("""() => { const deck = document.getElementById("hub-cam-deck"); if (deck) deck.hidden = false; }""")
    cam_box = page.evaluate("""() => {
      const a = document.querySelector("a.hub-cam");
      const r = a.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + Math.min(24, r.height / 2) };
    }""")
    t_cam = time.perf_counter()
    with page.expect_request("**/sheet-google-home.html", timeout=8000):
        page.mouse.click(cam_box["cx"], cam_box["cy"], delay=0)
    out["cam"] = {"navigated": True, "ms": round((time.perf_counter() - t_cam) * 1000)}
    try:
        page.goto("about:blank", wait_until="commit", timeout=2000)
    except Exception:
        pass
    ctx.close()

    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(base + "sheet-google-home.html", wait_until="domcontentloaded", timeout=15000)
    page.wait_for_function("""() => {
      const a = document.getElementById("gh-home");
      if (!a) return false;
      const r = a.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + 8, r.top + 8);
      return !!(hit && (hit === a || a.contains(hit)));
    }""", timeout=8000)
    home_box = page.evaluate("""() => {
      const a = document.getElementById("gh-home");
      const r = a.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }""")
    t0 = time.perf_counter()
    with page.expect_request("**/sheet-index.html", timeout=8000):
        page.mouse.click(home_box["cx"], home_box["cy"], delay=0)
    request_ms = round((time.perf_counter() - t0) * 1000)
    page.wait_for_url("**/sheet-index.html", wait_until="commit", timeout=8000)
    out["home"] = {"request": request_ms, "ms": round((time.perf_counter() - t0) * 1000)}
    print(json.dumps(out), flush=True)
    os._exit(0)
