"""r58 · home on every route, 1920x1080, synthetic feed. One JSON line. Saves PNGs."""
import json
import os
import threading
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])
OUT = Path(os.environ.get("WARDOS_ARTIFACT_DIR") or "/opt/cursor/artifacts/r58")
CT = ZoneInfo("America/Chicago")
day = datetime.now(CT).strftime("%Y-%m-%d")
WEEK = {"asOfIso": day, "kids": {"hayes": {"name": "Hayes", "today": [{"what": "Skate City Night", "summary": "Skate City Night", "title": "Skate City Night", "startIso": day + "T18:00:00-06:00"}]}}}
CAL = {"status": "live", "fetchedAt": datetime.now(CT).isoformat(), "asOfIso": day, "upcomingLeaves": []}


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.endswith("/kids-week.json"):
            body = json.dumps(WEEK).encode()
        elif path.endswith("/cal-live.json") or path.endswith("/cal-months.json"):
            body = json.dumps(CAL).encode()
        elif path.endswith("/private-names.json"):
            body = b"{}"
        else:
            return super().do_GET()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def routes():
    names = []
    for p in sorted(ROOT.glob("sheet-*.html")):
        if "pre-theme" in p.name:
            continue
        names.append(p.name)
    for name in ["month.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "nest-webrtc.html", "mercury-run.html"]:
        if name not in names and (ROOT / name).is_file():
            names.append(name)
    return names


PROBE = r"""() => {
  const home = document.querySelector('a.wardos-home, a.kw-home, a.hub-home');
  if (!home) return { present: false };
  const r = home.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const top = document.elementFromPoint(cx, cy);
  const hit = !!(top && (top === home || home.contains(top)));
  const veil = document.createElement('div');
  veil.className = 'ori-iris';
  veil.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#062018';
  document.body.appendChild(veil);
  const top2 = document.elementFromPoint(cx, cy);
  const homeOf = (el) => el && el.closest && el.closest('a.wardos-home, a.kw-home, a.hub-home');
  const overVeil = !!(top2 && (top2 === home || home.contains(top2) || homeOf(top2)));
  veil.remove();
  return { present: true, w: r.width, h: r.height, hit: hit, overVeil: overVeil, hidden: home.hasAttribute('hidden') || getComputedStyle(home).display === 'none' };
}"""


def main():
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    OUT.mkdir(parents=True, exist_ok=True)
    pages = {}
    idle = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        page = ctx.new_page()
        for name in routes():
            page.goto(base + "/" + name + "?pfBase=" + base, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(700)
            safe = name.replace(".html", "")
            try:
                page.screenshot(path=str(OUT / (safe + "-1920.png")))
            except Exception:
                pass
            info = page.evaluate(PROBE)
            reached = False
            if name != "sheet-index.html" and info.get("present") and not info.get("hidden"):
                page.evaluate("""() => {
                  const home = document.querySelector('a.wardos-home, a.kw-home');
                  if (home) home.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
                }""")
                try:
                    page.wait_for_url("**/sheet-index.html**", timeout=8000)
                    reached = True
                except Exception:
                    reached = "sheet-index" in page.url
            pages[name] = dict(info, reached=reached, url=page.url)
        # idle return uses the page clock so the suite does not wait 120s
        ctx2 = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        pg = ctx2.new_page()
        pg.clock.install()
        pg.goto(base + "/sheet-pack.html?pfBase=" + base, wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(400)
        pg.clock.fast_forward(120000)
        try:
            pg.wait_for_url("**/sheet-index.html**", timeout=8000)
            idle = {"ok": True, "url": pg.url}
        except Exception as e:
            idle = {"ok": "sheet-index" in pg.url, "url": pg.url, "err": str(e)[:160]}
        browser.close()
    httpd.shutdown()
    print(json.dumps({"pages": pages, "idle": idle}), flush=True)


if __name__ == "__main__":
    main()
