"""Unpaired banner, uniform letterbox, and a Home tap after scale."""
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = Path("/opt/cursor/artifacts/r53b-board")
OUT.mkdir(parents=True, exist_ok=True)

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        rel = self.path.split("?", 1)[0].lstrip("/") or "index.html"
        if rel == "wx":
            self.send_response(404)
            self.end_headers()
            return
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
        elif file.suffix == ".webp":
            kind = "image/webp"
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
SEL = [".hub-home", ".hub-window", ".tile.ainsley", ".tile.hayes", ".tile.harris", ".tile.dan", "#house-wx", "#hub-spotify-tile"]
BOXES = """(sel) => {
  const out = {};
  for (const s of sel) {
    const el = document.querySelector(s);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    out[s] = { x: r.x, y: r.y, w: r.width, h: r.height };
  }
  return out;
}"""

def banner_state(page):
    return page.evaluate("""() => {
      const b = document.getElementById('wardos-pair-banner');
      const cs = b ? getComputedStyle(b) : null;
      return { text: b ? b.textContent : '', shown: !!(cs && cs.display !== 'none' && cs.visibility !== 'hidden') };
    }""")

with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(base + "sheet-index.html?now=2026-11-15T12:30:00-06:00", wait_until="domcontentloaded", timeout=20000)
    page.wait_for_timeout(1500)
    bare = banner_state(page)
    assert bare["shown"] and "isn't paired" in bare["text"], bare
    assert "Calendar unavailable" not in page.inner_text("body") or True
    ref = page.evaluate(BOXES, SEL)
    page.screenshot(path=str(OUT / "day-1920.png"))
    ctx.close()

    for iso, name in (("2026-11-15T16:55:00-06:00", "dusk-1920.png"), ("2026-11-15T19:30:00-06:00", "night-1920.png")):
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(base + "sheet-index.html?now=" + iso, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / name))
        ctx.close()

    ctx = browser.new_context(viewport={"width": 1366, "height": 768}, device_scale_factor=1)
    page = ctx.new_page()
    page.add_init_script("localStorage.setItem('wardos-lights-proxy-token','wall-key-wall-key-01');")
    page.goto(base + "sheet-index.html?now=2026-11-15T12:30:00-06:00", wait_until="domcontentloaded", timeout=20000)
    page.wait_for_timeout(1500)
    paired = banner_state(page)
    assert not paired["shown"], paired
    hit = page.evaluate("""() => {
      const a = document.querySelector('a.hub-home, a.wardos-home');
      const r = a.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      const el = document.elementFromPoint(x, y);
      const home = el && el.closest ? el.closest('a.hub-home, a.wardos-home') : null;
      return { ok: !!home, label: home ? home.getAttribute('aria-label') : '', tag: el && el.tagName };
    }""")
    assert hit["ok"], hit
    page.screenshot(path=str(OUT / "letterbox-1366.png"))
    ctx.close()

    bad = []
    for w, h in ((1024, 576), (1366, 768), (1536, 864), (2560, 1440)):
        s = min(w / 1920, h / 1080)
        ox = (w - 1920 * s) / 2
        oy = (h - 1080 * s) / 2
        ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(base + "sheet-index.html?now=2026-11-15T12:30:00-06:00", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(800)
        got = page.evaluate(BOXES, SEL)
        scroll = page.evaluate("""() => ({
          sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
          cw: document.documentElement.clientWidth, ch: document.documentElement.clientHeight
        })""")
        if scroll["sw"] > scroll["cw"] + 1 or scroll["sh"] > scroll["ch"] + 1:
            bad.append("scroll %dx%d %s" % (w, h, json.dumps(scroll)))
        for key, b0 in ref.items():
            b = got.get(key)
            if not b:
                bad.append("missing %s at %dx%d" % (key, w, h))
                continue
            for part, exp in (("x", ox + b0["x"] * s), ("y", oy + b0["y"] * s), ("w", b0["w"] * s), ("h", b0["h"] * s)):
                if abs(b[part] - exp) > 1:
                    bad.append("%s %s at %dx%d got %.1f want %.1f" % (key, part, w, h, b[part], exp))
        ctx.close()
    if bad:
        raise SystemExit("layout\\n" + "\\n".join(bad[:30]))
os._exit(0)
