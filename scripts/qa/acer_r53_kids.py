"""Kid boards at 1920x1080 DPR 1. Home at 48,48, nothing past y1080, saves and schedule visible, chore text legible."""
import json, os, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])
OUT = Path(os.environ.get("WARDOS_OUT") or "/tmp/r53-kids")
OUT.mkdir(parents=True, exist_ok=True)
PAGES = ["kid-ainsley.html", "kid-hayes.html", "kid-harris.html"]

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
        self.wfile.write(data)

httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
PROBE = """() => {
  function lum(rgb) {
    const n = String(rgb).match(/[\\d.]+/g);
    if (!n) return 0;
    const c = n.slice(0, 3).map(v => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    const L1 = lum(a), L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }
  function bgOf(el) {
    let n = el;
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      const m = String(c).match(/[\\d.]+/g);
      if (m && Number(m[3] == null ? 1 : m[3]) > 0.4 && c !== "rgba(0, 0, 0, 0)") return c;
      n = n.parentElement;
    }
    return "rgb(0,0,0)";
  }
  const vis = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 2 && r.height > 2;
  };
  let bottom = 0;
  document.body.querySelectorAll("*").forEach(el => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    if (r.top < 1080 && r.bottom > bottom) bottom = r.bottom;
  });
  const home = document.querySelector("a.kw-home, a.wardos-home");
  const hr = home ? home.getBoundingClientRect() : null;
  const jar = document.querySelector("#sec-jar .prism-jar");
  const days = document.querySelector("#sec-days");
  const chore = document.querySelector("#sec-musts .chore .what, #sec-musts .chore");
  let ratio = 0;
  if (chore && vis(chore)) ratio = contrast(getComputedStyle(chore).color, bgOf(chore));
  const link = document.getElementById("prism-face-css");
  const dr = days ? days.getBoundingClientRect() : null;
  return {
    bottom: Math.round(bottom),
    home: hr ? { x: Math.round(hr.x), y: Math.round(hr.y), w: Math.round(hr.width), h: Math.round(hr.height) } : null,
    saves: !!(jar && vis(jar)),
    schedule: !!(days && vis(days) && dr && dr.height >= 32 && dr.bottom <= 1080),
    scheduleText: days ? (days.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 80) : "",
    contrast: Math.round(ratio * 100) / 100,
    prism: !!(link && link.sheet)
  };
}"""
out = {}
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for name in PAGES:
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(base + name + "?now=2026-11-10T12:30:00-06:00&freeze=1", wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(1500)
        shot = OUT / (name.replace(".html", "") + ".png")
        page.screenshot(path=str(shot), full_page=False)
        info = page.evaluate(PROBE)
        info["png"] = str(shot)
        out[name] = info
        page.close()
        ctx.close()
    browser.close()
print(json.dumps(out), flush=True)
os._exit(0)
