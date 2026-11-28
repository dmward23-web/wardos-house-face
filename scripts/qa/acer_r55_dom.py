"""r55 display-loaded checks. house-event-display.js is a real script tag, not a node vm."""
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])
HARNESS = b"""<!doctype html><meta charset="utf-8">
<script src="house-event-display.js"></script>
<script src="house-face-law.js"></script>
<script src="house-board-strip.js"></script>
"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        rel = self.path.split("?", 1)[0].lstrip("/")
        if rel == "r55-dom.html":
            data, kind = HARNESS, "text/html"
        else:
            file = (ROOT / rel).resolve()
            if not str(file).startswith(str(ROOT.resolve())) or not file.is_file():
                self.send_error(404)
                return
            data = file.read_bytes()
            kind = "text/javascript" if file.suffix == ".js" else "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


PROBE = r"""() => {
  const D = window.HouseEventDisplay;
  const L = window.HouseFaceLaw;
  const scripts = Array.from(document.scripts).map((s) => s.getAttribute("src") || "");
  const loaded = scripts.indexOf("house-event-display.js") >= 0 && !!(D && D.summarize && L && L.cleanFeed);
  const week = L.cleanFeed("kids-week", { kids: { hayes: {
    name: "Hayes",
    today: [{ what: "Skate City Night", when: "Mon 6:00" }],
    school: [{ what: "Friends Club" }],
    quests: [{ what: "Read" }]
  } } });
  const kid = week && week.kids && week.kids.hayes;
  const kidBlob = JSON.stringify(kid && kid.today || []);
  const kidKept = !!(kid && Array.isArray(kid.today) && /Skate City Night/.test(kidBlob) && Array.isArray(kid.school) && kid.school.length && Array.isArray(kid.quests));
  const skate = D.summarize({ what: "Skate City Night", summary: "Skate City Night", title: "Skate City Night" }, "shared");
  const sharedTitle = !!(skate && skate.title && /Skate City Night/.test(skate.title));
  const probe = "H4" + " yes checkup";
  const cal = L.cleanFeed("cal-live", { upcomingLeaves: [
    { summary: probe, start: "2026-11-20T15:00:00-06:00" },
    { summary: "Raffle", organizer: { displayName: "therapy-token" }, start: "2026-11-20T16:00:00-06:00" }
  ] });
  const raw = JSON.stringify(cal && cal.upcomingLeaves || []);
  const rawGone = raw.indexOf("H4") < 0 && raw.indexOf("checkup") < 0 && raw.indexOf("Raffle") < 0 && raw.indexOf("therapy") < 0;
  const legalFeed = L.cleanFeed("cal-live", { upcomingLeaves: [
    { summary: "mediation legal", start: "2026-11-21T15:00:00-06:00" },
    { summary: "Court date", start: "2026-11-21T16:00:00-06:00" }
  ] });
  const legalBlob = JSON.stringify(legalFeed && legalFeed.upcomingLeaves || []);
  const legalHidden = legalBlob.indexOf("mediation") < 0 && legalBlob.indexOf("legal") < 0 && legalBlob.indexOf("Court") < 0;
  const strip = Array.from(document.scripts).filter((s) => (s.getAttribute("src") || "") === "house-board-strip.js")[0];
  return { loaded, kidKept, sharedTitle, rawGone, legalHidden, strip: !!(strip && D.lockedHide) };
}"""


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d/r55-dom.html" % httpd.server_address[1]
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        page = browser.new_page()
        page.goto(base, wait_until="load")
        out = page.evaluate(PROBE)
        browser.close()
    httpd.shutdown()
    print(json.dumps(out))


if __name__ == "__main__":
    main()
