"""B6 · date text and Ahead rows for two frozen clocks. One JSON line."""
import json, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WEEK = {
    "asOfIso": "2026-12-04",
    "kids": {
        "hayes": {"id": "hayes", "name": "Hayes", "quests": [], "today": [
            {"what": "Robot kit", "when": "Fri 4 · 8:00 AM", "tone": "act"},
            {"what": "Skate night", "when": "Sun 6 · 8:00 AM", "tone": "act"},
        ]},
        "harris": {"id": "harris", "name": "Harris", "quests": [], "today": []},
        "ainsley": {"id": "ainsley", "name": "Ainsley", "quests": [], "today": []},
    },
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
            body = b'{"status":"live","upcomingLeaves":[]}'
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
  const dateEl = document.querySelector("[data-live='date-short']");
  const ahead = [...document.querySelectorAll('.consume-ahead-row,.lb-day-what')].map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { date: dateEl ? dateEl.textContent.trim() : '', ahead: ahead.join(' | ') };
}"""

def shot(page, base, iso):
    page.goto(base + "/sheet-dinner.html?pfBase=" + base + "&now=" + iso.replace("+", "%2B") + "&freeze=1", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(800)
    dinner = page.evaluate(PROBE)
    page.goto(base + "/kid-hayes.html?pfBase=" + base + "&now=" + iso.replace("+", "%2B") + "&freeze=1", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(1500)
    kid = page.evaluate(PROBE)
    return {"date": dinner["date"], "ahead": kid["ahead"]}

def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        page = ctx.new_page()
        a = shot(page, base, "2026-12-04T07:30:00-06:00")
        b = shot(page, base, "2026-12-06T07:30:00-06:00")
        browser.close()
    httpd.shutdown()
    print(json.dumps({"a": a, "b": b}))

if __name__ == "__main__":
    main()
