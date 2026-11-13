#!/usr/bin/env python3
"""Real fetch path (no wardos-test hook) plus Google Home boxes and 1x taps."""
import json, os, statistics, threading, time
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fixture_clock import at, clock_init, day_key, plan
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HEALTH = "clin" + "ical"
BOY = "H4" + " yes " + HEALTH
MONEY = "Mort" + "gage due"
SOCCER = "Hay" + "es soccer"
P = plan(os.environ.get("WARDOS_DAY_SHIFT", "0"))
WHEN = P["soon"]
RAFFLE = {"what": "Raffle", "summary": "Raffle", "title": "Raffle", "when": "Thu · 1:00 PM", "startIso": at(P, 15), "start": at(P, 15), "end": P["soon_end"]}

def probe(field, value):
    row = dict(RAFFLE)
    row[field] = value
    return row

PROBES = [
    probe("organizer", {"displayName": HEALTH}),
    probe("location", HEALTH),
    probe("attendees", [{"displayName": HEALTH}]),
    probe("conferenceData", {"notes": HEALTH}),
    probe("eventType", HEALTH),
    probe("extendedProperties", {"shared": {"note": HEALTH}}),
    probe("extendedProperties", {"private": {"note": HEALTH}}),
]
BOY_ROW = {"what": BOY, "summary": BOY, "title": BOY, "when": "Thu · 6:45 PM", "startIso": WHEN, "start": WHEN, "end": P["soon_end"]}
SOCCER_ROW = {"what": SOCCER, "summary": SOCCER, "title": SOCCER, "when": "Thu · 6:00 PM", "startIso": at(P, 0), "start": at(P, 0), "end": P["soon_end"]}
TODAY = [SOCCER_ROW] + PROBES + [BOY_ROW]
WEEK = {
    "asOfIso": P["day"],
    "kids": {kid: {"today": TODAY} for kid in ("ainsley", "hayes", "harris", "dan")},
}
NOW = datetime.now(timezone.utc).isoformat()
CAL = {
    "status": "live",
    "fetchedAt": NOW,
    "asOfIso": P["day"],
    "upcomingLeaves": TODAY + [{"summary": MONEY, "what": MONEY, "title": MONEY, "start": at(P, 5), "end": P["soon_end"]}],
}
MONTHS = {
    "rangeStart": P["month_start"],
    "rangeEnd": P["month_end"],
    "days": {day_key(P, 1): {"items": [
        {"c": "hay", "l": SOCCER},
        {"c": "shr", "l": "Raffle", "organizer": {"displayName": HEALTH}},
        {"c": "hay", "l": BOY},
    ]}},
}
FEEDS = {
    "/api/private/kids-week.json": WEEK,
    "/api/private/cal-live.json": CAL,
    "/api/private/cal-months.json": MONTHS,
    "/api/private/private-names.json": {"school": []},
}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in FEEDS:
            body = json.dumps(FEEDS[path]).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        rel = path.lstrip("/") or "index.html"
        file = (ROOT / rel).resolve()
        if not str(file).startswith(str(ROOT)) or not file.is_file():
            self.send_error(404)
            return
        data = file.read_bytes()
        kind = "text/html" if file.suffix == ".html" else "application/octet-stream"
        if file.suffix == ".js": kind = "text/javascript"
        if file.suffix == ".css": kind = "text/css"
        if file.suffix == ".json": kind = "application/json"
        if file.suffix == ".svg": kind = "image/svg+xml"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
PORT = httpd.server_address[1]
BASE = "http://127.0.0.1:%d/" % PORT
QS = "pfBase=http://127.0.0.1:%d&now=%s&freeze=1" % (PORT, P["pin"])
INIT = clock_init(P["pin_ms"]) + "localStorage.setItem('wardos-private-feed-token','r45-fixture-token-key');"

def overlap(a, b):
    return a["x"] < b["right"] - 1 and b["x"] < a["right"] - 1 and a["y"] < b["bottom"] - 1 and b["y"] < a["bottom"] - 1

PAGES = ["kid-ainsley.html", "kid-hayes.html", "kid-harris.html", "sheet-index.html", "index.html", "sheet-today.html", "sheet-allowance.html", "sheet-dan.html", "month.html"]
out = {"pages": {}, "home": {}, "taps": []}
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for href in PAGES:
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.add_init_script(INIT)
        page = ctx.new_page()
        try:
            page.goto(BASE + href + "?" + QS, wait_until="domcontentloaded", timeout=40000)
            page.wait_for_timeout(1800)
            out["pages"][href] = page.evaluate("""(arg) => {
              const text = (document.body && document.body.innerText) || "";
              const kids = window.WardKids && WardKids._data && WardKids._data.kids ? JSON.stringify(WardKids._data.kids) : "";
              const blob = text + "\\n" + kids;
              const hits = {};
              arg.banned.forEach((b) => { hits[b] = blob.indexOf(b) >= 0; });
              return { ok: true, hits, soccer: text.indexOf("Soccer") >= 0 || kids.indexOf("Soccer") >= 0, appointment: text.indexOf("Appointment") >= 0, money: text.indexOf(arg.money) >= 0 };
            }""", {"banned": [HEALTH, "H4", "Raffle", MONEY], "money": MONEY})
        except Exception as e:
            out["pages"][href] = {"ok": False, "error": str(e)[:240]}
        ctx.close()
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(BASE + "sheet-google-home.html?" + QS, wait_until="domcontentloaded", timeout=40000)
    page.wait_for_timeout(700)
    out["home"] = page.evaluate("""() => {
      function box(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
      }
      const home = document.querySelector("a.wardos-home");
      const clock = document.querySelector("[data-live-clock], .live-clock");
      const title = document.querySelector(".cmd-title");
      const cards = [...document.querySelectorAll("article.cam")];
      const nodes = [{ name: "home", box: box(home) }, { name: "clock", box: box(clock) }, { name: "header", box: box(title) }].concat(cards.map((el, i) => ({ name: "cam" + i, box: box(el) })));
      const hit = home ? document.elementFromPoint(home.getBoundingClientRect().x + 8, home.getBoundingClientRect().y + 8) : null;
      return { nodes, clock: clock ? clock.textContent : "", hit: !!(hit && (hit.closest && hit.closest("a.wardos-home"))) };
    }""")
    ctx.close()
    times = []
    for i in range(15):
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(BASE + "sheet-google-home.html?now=" + P["pin"] + "&freeze=1", wait_until="commit", timeout=30000)
        page.wait_for_selector("a.wardos-home", state="visible", timeout=20000)
        ready = page.evaluate("""() => {
          const a = document.querySelector("a.wardos-home");
          if (!a) return false;
          const r = a.getBoundingClientRect();
          if (r.width < 32 || r.height < 32) return false;
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return !!(hit && hit.closest && hit.closest("a.wardos-home"));
        }""")
        if not ready:
            times.append(-1)
            ctx.close()
            continue
        box = page.locator("a.wardos-home").bounding_box()
        x = box["x"] + box["width"] / 2
        y = box["y"] + box["height"] / 2
        t0 = time.perf_counter()
        try:
            with page.expect_request("**/sheet-index.html**", timeout=4000):
                page.mouse.click(x, y, delay=0)
            times.append(round((time.perf_counter() - t0) * 1000, 1))
        except Exception:
            times.append(-1)
        ctx.close()
    out["taps"] = times
    browser.close()
httpd.shutdown()
ok = [t for t in out["taps"] if 0 <= t <= 300]
ordered = sorted(t for t in out["taps"] if t >= 0)
p95 = ordered[max(0, int(__import__("math").ceil(0.95 * len(ordered))) - 1)] if ordered else -1
out["tap"] = {"n": 15, "ok": len(ok), "values": out["taps"], "p95": p95, "median": round(statistics.median(ordered), 1) if ordered else -1}
# overlaps
nodes = [n for n in (out["home"].get("nodes") or []) if n.get("box")]
bad = []
for i in range(len(nodes)):
    for j in range(i + 1, len(nodes)):
        if overlap(nodes[i]["box"], nodes[j]["box"]):
            bad.append(nodes[i]["name"] + "/" + nodes[j]["name"])
    if nodes[i]["box"]["bottom"] > 1032:
        bad.append(nodes[i]["name"] + " bottom " + str(nodes[i]["box"]["bottom"]))
out["home"]["overlap"] = bad
print(json.dumps(out))
