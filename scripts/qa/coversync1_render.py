"""COVERSYNC1 · the #acer-cover ground colour must flip when HouseScene notifies. One JSON line.
A board left open paints the cover only on load. This drives one page: night ?now, then the
day plate on --wg-hubbg, then HouseScene's own minute. No resize. Synthetic clock only."""
import json, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
NIGHT = "2026-11-10T21:00:00-06:00"
DAY_URL = 'url("month-theme/november/wall-day.webp")'
PROBE = """() => {
  const c = document.getElementById('acer-cover');
  if (!c || !c.width) return null;
  let rgb = null;
  try {
    const ctx = c.getContext('2d');
    const x = Math.floor(c.width / 2), y = Math.floor(c.height * 0.85);
    const p = ctx.getImageData(x, y, 1, 1).data;
    rgb = [p[0], p[1], p[2]];
  } catch (e) { rgb = null; }
  const S = window.HouseScene;
  return {
    rgb: rgb,
    phase: S && S.phase ? S.phase() : null,
    bg: (getComputedStyle(document.documentElement).getPropertyValue('--wg-hubbg') || '').trim().slice(0, 120)
  };
}"""


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass


def dist(a, b):
    if not a or not b:
        return 0
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    out = {"pass": False}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page = ctx.new_page()
        page.clock.install(time=NIGHT)
        page.goto(base + "/sheet-index.html?now=" + NIGHT.replace("+", "%2B") + "&freeze=1", wait_until="domcontentloaded", timeout=60000)
        page.clock.fast_forward(2000)
        page.wait_for_timeout(2500)
        before = page.evaluate(PROBE)
        page.evaluate("(url) => document.documentElement.style.setProperty('--wg-hubbg', url)", DAY_URL)
        page.clock.fast_forward(70000)
        page.wait_for_timeout(2500)
        after = page.evaluate(PROBE)
        out = {
            "before": before,
            "after": after,
            "delta": dist((before or {}).get("rgb"), (after or {}).get("rgb")),
        }
        out["pass"] = bool(before and after and before.get("phase") == "night" and out["delta"] >= 30 and "wall-day" in (after.get("bg") or ""))
        browser.close()
    httpd.shutdown()
    print(json.dumps(out))


if __name__ == "__main__":
    main()
