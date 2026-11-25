"""DINNERJSON1 · one mode: present | missing | stale | flagged | layout. Prints one JSON line."""
import json, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
NOW = "2026-12-04T07:30:00-06:00"
MODE = sys.argv[1] if len(sys.argv) > 1 else "present"

def week(start, flagged=False):
    row = {
        "dow": "Fri", "date": "2026-12-04", "meal": "Pizza night", "prep": "Heat the oven",
        "kid": "Cheese pizza",
        "budget": {"amount": "65.00", "source": "plan", "flagged": flagged, "text": "Needs a look"},
    }
    return {
        "schema": "wardos.dinner-week/1", "week_start": start,
        "rows": [row],
        "stores": [{"name": "Market", "total": "40.00"}, {"name": "Bakery", "total": "25.00"}],
    }

DOC = {
    "present": week("2026-11-28"),
    "stale": week("2026-10-31"),
    "flagged": week("2026-11-28", True),
    "missing": None,
    "layout": week("2026-11-28"),
}[MODE]

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a):
        pass
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.endswith("/dinner-week.json"):
            if DOC is None:
                self.send_error(404)
                return
            body = json.dumps(DOC).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

PROBE = r"""() => {
  const text = document.body.innerText;
  const rows = [...document.querySelectorAll('[data-dinner-week] .day-row')].map(el => (el.innerText || '').replace(/\s+/g, ' ').trim());
  const budget = document.querySelector('[data-dinner-budget]');
  const meals = [...document.querySelectorAll('[data-dinner-meal]')].map(el => (el.textContent || '').trim());
  const stores = [...document.querySelectorAll('[data-store-total]')].map(el => el.getAttribute('data-store-total'));
  const vis = el => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el);
    return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
  const ctl = [...document.querySelectorAll('a[href],button')].filter(vis);
  const hits = ctl.map(el => {
    const r = el.getBoundingClientRect();
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const h = document.elementFromPoint(x, y);
    return !h || h === el || el.contains(h) || (h.closest && h.closest('a,button') === el);
  });
  let overlap = false;
  const boxes = [...document.querySelectorAll('[data-dinner-week] .day-row')].filter(vis).map(el => el.getBoundingClientRect());
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (x > 0.5 && y > 0.5) overlap = true;
  }
  const trunc = [...document.querySelectorAll('[data-dinner-week] *')].filter(vis).filter(el => {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    return own && el.scrollWidth > el.clientWidth + 1;
  }).length;
  const src = document.querySelector('[data-dinner-week]');
  return { text, rows, meals, budget: budget ? budget.textContent : '', stores, hits, overlap, trunc, nctl: ctl.length, source: src ? src.getAttribute('data-dinner-source') : '' };
}"""

def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page.goto(base + "/sheet-dinner.html?now=" + NOW.replace("+", "%2B") + "&freeze=1", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(1200)
        info = page.evaluate(PROBE)
        browser.close()
    httpd.shutdown()
    print(json.dumps(info))

if __name__ == "__main__":
    main()
