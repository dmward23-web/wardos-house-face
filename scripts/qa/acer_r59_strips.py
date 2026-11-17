"""r59 · strip, hero and ahead text is visible inside the 48px safe area. One JSON line."""
import json
import os
import threading
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])
CT = ZoneInfo("America/Chicago")
now = datetime.now(CT)
day = now.strftime("%Y-%m-%d")
start = now.replace(hour=18, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S-06:00")
start2 = now.replace(hour=19, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S-06:00")


def ev(summary, iso=None):
    return {
        "summary": summary, "title": summary, "what": summary, "when": "Tue · 6:00",
        "startIso": iso or start, "start": iso or start, "location": "gym",
    }


WEEK = {
    "asOfIso": day,
    "kids": {
        "hayes": {"id": "hayes", "name": "Hayes", "today": [ev("Skate City Night"), ev("costume parade", start2)], "quests": []},
        "ainsley": {"id": "ainsley", "name": "Ainsley", "today": [ev("Picture day"), ev("Soccer")], "quests": []},
        "harris": {"id": "harris", "name": "Harris", "today": [ev("Art club"), ev("basketball")], "quests": []},
    },
}
CAL = {
    "status": "live", "fetchedAt": datetime.now(CT).isoformat(), "asOfIso": day,
    "upcomingLeaves": [
        {"summary": "Skate City Night", "title": "Skate City Night", "start": start, "end": start2, "allDay": False},
        {"summary": "Picture day", "title": "Picture day", "start": start2, "end": start2, "allDay": False},
    ],
}


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


PROBE = r"""() => {
  const home = document.querySelector('a.wardos-home');
  const hb = home ? home.getBoundingClientRect() : null;
  const overlap = (r) => hb && r.left < hb.right && r.right > hb.left && r.top < hb.bottom && r.bottom > hb.top;
  const lum = (c) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
    if (!m) return 0;
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
  };
  const rows = [];
  const sel = '.lb-day-what, .kid-what-line, .consume-hero-name, .consume-ahead-what, .leaveby-row-title';
  for (const el of document.querySelectorAll(sel)) {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const cs0 = getComputedStyle(el);
    if (cs0.display === 'none' || cs0.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    let bg = cs.backgroundColor;
    let n = el;
    while (n && (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
      n = n.parentElement;
      if (n) bg = getComputedStyle(n).backgroundColor;
    }
    rows.push({
      t: t.slice(0, 40), w: Math.round(r.width), h: Math.round(r.height),
      l: Math.round(r.left), top: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom),
      op: parseFloat(cs.opacity) || 0, fs: parseFloat(cs.fontSize) || 0,
      contrast: Math.abs(lum(cs.color) - lum(bg)),
      lines: Math.round(r.height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) || 24)),
      over: overlap(r)
    });
  }
  return { n: rows.length, rows: rows.slice(0, 24) };
}"""


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        page = ctx.new_page()
        for name in ("sheet-index.html", "sheet-today.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html"):
            page.goto(base + "/" + name + "?pfBase=" + base, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1200)
            out[name] = page.evaluate(PROBE)
        page.goto(base + "/sheet-index.html?pfBase=" + base, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(600)
        clock = page.evaluate("""() => {
          const el = document.querySelector('.hdr-date-time');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
        }""")
        clock_ok = False
        if clock and clock["w"] > 8:
            page.mouse.click(clock["x"], clock["y"])
            try:
                page.wait_for_url("**/sheet-today.html**", timeout=4000)
                clock_ok = True
            except Exception:
                clock_ok = "sheet-today" in page.url
        page.goto(base + "/sheet-today.html?d=2026-11-15&pfBase=" + base, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(800)
        day = page.evaluate("""() => {
          const panel = document.querySelector('.day-view');
          const grid = document.querySelector('.kids-col, .today-day, .kid-card');
          const gs = grid ? getComputedStyle(grid) : null;
          const row = panel && (panel.querySelector('.dv-row') || panel);
          const r = row ? row.getBoundingClientRect() : null;
          let hit = false;
          if (r && r.width > 1 && r.height > 1) {
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(20, r.height / 2));
            hit = !!(top && panel.contains(top));
          }
          return {
            panel: !!panel,
            gridHidden: !grid || gs.display === 'none' || gs.visibility === 'hidden',
            hit: hit,
            top: r ? Math.round(r.top) : 0,
            bottom: r ? Math.round(r.bottom) : 0
          };
        }""")
        browser.close()
    httpd.shutdown()
    print(json.dumps({"pages": out, "clock": clock_ok, "day": day}), flush=True)


if __name__ == "__main__":
    main()
