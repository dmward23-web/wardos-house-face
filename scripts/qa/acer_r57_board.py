"""r57 · synthetic feed, display script loaded, 1920x1080. Prints one JSON line and saves shots."""
import json
import os
import threading
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get("WARDOS_ROOT") or Path(__file__).resolve().parents[2])
OUT = Path(os.environ.get("WARDOS_ARTIFACT_DIR") or "/opt/cursor/artifacts/r57")
CT = ZoneInfo("America/Chicago")
now = datetime.now(CT)
if now.hour >= 17:
    now = now + timedelta(days=1)
day = now.strftime("%Y-%m-%d")
start = now.replace(hour=18, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S-06:00")
start2 = now.replace(hour=19, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S-06:00")


def ev(summary, title=None, what=None, when="Tue · 6:00", iso=None, **extra):
    row = {
        "summary": summary,
        "title": summary if title is None else title,
        "what": summary if what is None else what,
        "when": when,
        "startIso": iso or start,
        "start": iso or start,
        "location": "gym",
    }
    row.update(extra)
    return row


HAYES = [
    ev("Skate City Night"),
    ev("costume parade", "Hayes costume parade", "Hayes costume parade", iso=start2),
    ev("Friends Club"),
    ev("basketball"),
    ev("Hayes dentist", "Hayes dentist", "Hayes dentist"),
]
AINSLEY = [
    ev("Picture day"),
    ev("partner dinner"),
    ev("Soccer"),
    ev("Art club"),
    ev("Lantern walk", "Other title", "Third title"),
]
HARRIS = [
    ev("Art club"),
    ev("Harris doctor", "Harris doctor", "Harris doctor"),
    ev("mediation legal", "mediation legal", "mediation legal"),
    ev("H4 yes checkup", "H4 yes checkup", "H4 yes checkup"),
    ev("Raffle", "Raffle", "Raffle", organizer={"displayName": "therapy-token"}),
]
WEEK = {
    "asOfIso": day,
    "kids": {
        "hayes": {"id": "hayes", "name": "Hayes", "today": HAYES, "school": [], "sports": [], "quests": []},
        "ainsley": {"id": "ainsley", "name": "Ainsley", "today": AINSLEY, "school": [], "sports": [], "quests": []},
        "harris": {"id": "harris", "name": "Harris", "today": HARRIS, "school": [], "sports": [], "quests": []},
    },
}
EMPTY = {
    "asOfIso": day,
    "kids": {
        "harris": {
            "id": "harris",
            "name": "Harris",
            "today": [],
            "school": [],
            "sports": [],
            "quests": [],
            "hottest": {
                "what": "NOTHING NEXT ON THE CALENDAR",
                "summary": "NOTHING NEXT ON THE CALENDAR",
                "title": "NOTHING NEXT ON THE CALENDAR",
                "label": "NOTHING NEXT ON THE CALENDAR",
                "text": "NOTHING NEXT ON THE CALENDAR",
                "l": "NOTHING NEXT ON THE CALENDAR",
            },
        }
    },
}
CAL = {
    "status": "live",
    "fetchedAt": datetime.now(CT).isoformat(),
    "asOfIso": day,
    "upcomingLeaves": [dict(r, start=r["startIso"]) for r in HAYES + AINSLEY + HARRIS],
    "boardStrip": {"queue": [dict(summary=r["summary"], what=r["what"], title=r["title"], start=r["startIso"]) for r in HAYES + AINSLEY if "dentist" not in r["summary"].lower()]},
}


class H(BaseHTTPRequestHandler):
    empty = False

    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.endswith(".html"):
            H.empty = "empty=1" in self.path
        empty = H.empty or "empty=1" in self.path
        body = None
        if path.endswith("/kids-week.json"):
            body = json.dumps(EMPTY if empty else WEEK).encode()
        elif path.endswith("/cal-live.json"):
            body = json.dumps(CAL).encode()
        elif path.endswith("/private-names.json"):
            body = b"{}"
        if body is not None:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        rel = path.lstrip("/") or "index.html"
        file = (ROOT / rel).resolve()
        if not str(file).startswith(str(ROOT.resolve())) or not file.is_file():
            self.send_error(404)
            return
        data = file.read_bytes()
        kind = "text/html" if file.suffix == ".html" else "application/octet-stream"
        if file.suffix == ".js":
            kind = "text/javascript"
        elif file.suffix == ".css":
            kind = "text/css"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def text_of(page):
    return page.evaluate("() => document.body ? document.body.innerText : ''")


def hero_of(page):
    return page.evaluate("""() => {
      const el = document.querySelector('.consume-hero-name, .consume-hero-title');
      return el ? el.innerText.replace(/\\s+/g, ' ').trim() : '';
    }""")


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % httpd.server_address[1]
    OUT.mkdir(parents=True, exist_ok=True)
    shots = {
        "sheet-index.html": "hub-1920.png",
        "sheet-today.html": "today-1920.png",
        "sheet-weekend.html": "sheet-weekend-1920.png",
        "kid-hayes.html": "kid-hayes-1920.png",
        "kid-harris.html": "kid-harris-1920.png",
        "kid-ainsley.html": "kid-ainsley-1920.png",
    }
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        page = ctx.new_page()

        def open_page(path):
            page.goto(base + path + ("&" if "?" in path else "?") + "pfBase=" + base, wait_until="load", timeout=60000)
            page.wait_for_timeout(1200)
            page.evaluate("() => { if (window.HouseBoardStrip && window.HouseBoardStrip.boot) window.HouseBoardStrip.boot(); }")
            page.wait_for_timeout(800)

        open_page("/sheet-index.html")
        page.screenshot(path=str(OUT / shots["sheet-index.html"]))
        out["strip"] = page.evaluate("""() => {
          const el = document.querySelector("[data-live='leaveby-layouts']") || document.querySelector('.leaveby');
          if (!el) return '';
          const show = getComputedStyle(el).display + ' ' + getComputedStyle(el).visibility;
          return show + ' ' + (el.textContent || '').replace(/\\s+/g, ' ').trim();
        }""")
        out["hub"] = text_of(page) + "\n" + (out["strip"] or "")
        out["stripBlank"] = not any(word in (out["strip"] or "") for word in ("Skate City Night", "costume parade", "Friends Club", "basketball", "Picture day"))
        out["harrisTile"] = page.evaluate("() => (document.querySelector('a.tile.harris') || {}).innerText || ''")
        out["harrisAllDone"] = "All done" in out["harrisTile"]
        titles = page.evaluate("""() => {
          const D = window.HouseEventDisplay;
          if (!D) return {};
          const same = D.summarize({ summary: 'Skate City Night', title: 'Skate City Night', what: 'Skate City Night', location: 'gym' }, 'shared');
          const diff = D.summarize({ summary: 'Lantern walk', title: 'Other title', what: 'Third title', location: 'gym' }, 'shared');
          return { same: same && same.title, different: diff && diff.title };
        }""")
        out["same"] = titles.get("same")
        out["different"] = titles.get("different")

        open_page("/sheet-today.html")
        page.screenshot(path=str(OUT / shots["sheet-today.html"]))
        out["today"] = text_of(page)

        open_page("/kid-hayes.html")
        page.screenshot(path=str(OUT / shots["kid-hayes.html"]))
        out["hayes"] = text_of(page)
        out["hayesHero"] = hero_of(page)

        open_page("/kid-harris.html")
        page.screenshot(path=str(OUT / shots["kid-harris.html"]))
        out["harris"] = text_of(page)

        open_page("/kid-ainsley.html")
        page.screenshot(path=str(OUT / shots["kid-ainsley.html"]))
        out["ainsley"] = text_of(page)

        open_page("/kid-harris.html?empty=1")
        empty = page.evaluate("""() => {
          const el = document.querySelector('.consume-hero');
          const title = document.querySelector('.consume-hero-title, .consume-hero-name');
          const text = title ? title.innerText.replace(/\\s+/g, ' ').trim() : '';
          const r = el ? el.getBoundingClientRect() : { left: 0, right: 0 };
          const n = (text.match(/NOTHING NEXT ON THE CALENDAR|Nothing next/g) || []).length;
          return { text, count: n, left: r.left, right: r.right };
        }""")
        out["empty"] = empty

        open_page("/sheet-weekend.html")
        page.screenshot(path=str(OUT / shots["sheet-weekend.html"]))
        out["weekend"] = page.evaluate("""() => {
          const boxes = [];
          const sel = 'a.wardos-home, .name-accent, .live-clock, .live-clock-host, .cheer-label, header.hdr';
          document.querySelectorAll(sel).forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return;
            boxes.push({ name: el.className || el.tagName, left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: (el.innerText || '').slice(0, 40) });
          });
          const home = boxes.find((b) => /wardos-home/.test(b.name));
          const ideas = boxes.find((b) => /name-accent/.test(b.name));
          function hit(a, b) {
            if (!a || !b) return false;
            const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            return x > 1 && y > 1;
          }
          const clock = boxes.find((b) => /live-clock/.test(b.name) && !/host/.test(b.name));
          const clipped = !!(clock && (clock.right > 1872 || clock.left < 48 || clock.bottom > 1032));
          return { boxes, overlap: hit(home, ideas), leftOf: boxes.filter((b) => b.left < 48).length, clockClipped: clipped, clock };
        }""")
        out["page"] = (out.get("hub") or "") + (out.get("today") or "") + (out.get("hayes") or "")
        page.close()
        browser.close()
    httpd.shutdown()
    print(json.dumps(out), flush=True)


if __name__ == "__main__":
    main()
