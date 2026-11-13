#!/usr/bin/env python3
"""Real fetch path (no wardos-test hook) plus Google Home boxes and 1x taps."""
import json, os, statistics, sys, threading, time
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fixture_clock import at, clock_init, day_key, log_step, pin_at, plan, stop_httpd
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HEALTH = "clin" + "ical"
BOY = "H4" + " yes " + HEALTH
MONEY = "Mort" + "gage due"
SOCCER = "Hay" + "es soccer"
P = plan(os.environ.get("WARDOS_DAY_SHIFT", "0"))
WHEN = pin_at(P, 0)
RAFFLE = {"what": "Raffle", "summary": "Raffle", "title": "Raffle", "when": "Thu · 1:00 PM", "startIso": pin_at(P, 20), "start": pin_at(P, 20), "end": P["end"]}

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
BOY_PIN = {"what": BOY, "summary": BOY, "title": BOY, "when": "Thu · 6:45 PM", "startIso": pin_at(P, 40), "start": pin_at(P, 40), "end": P["end"]}
BOY_ROW = {"what": BOY, "summary": BOY, "title": BOY, "when": "Thu · 6:45 PM", "startIso": at(P, 10), "start": at(P, 10), "end": P["soon_end"]}
SOCCER_ROW = {"what": SOCCER, "summary": SOCCER, "title": SOCCER, "when": "Thu · 6:00 PM", "startIso": pin_at(P, 0), "start": pin_at(P, 0), "end": P["end"]}
SOCCER_DAD = {"what": SOCCER, "summary": SOCCER, "title": SOCCER, "when": "Thu · 6:00 PM", "startIso": at(P, 0), "start": at(P, 0), "end": P["soon_end"]}
MONEY_ROW = {"summary": MONEY, "what": MONEY, "title": MONEY, "start": at(P, 5), "startIso": at(P, 5), "end": P["soon_end"]}
RAFFLE_DAD = {"what": "Raffle", "summary": "Raffle", "title": "Raffle", "when": "Thu · 1:00 PM", "startIso": at(P, 15), "start": at(P, 15), "end": P["soon_end"]}
DAD_PROBES = []
for field, value in (
    ("organizer", {"displayName": HEALTH}),
    ("location", HEALTH),
    ("attendees", [{"displayName": HEALTH}]),
    ("conferenceData", {"notes": HEALTH}),
    ("eventType", HEALTH),
    ("extendedProperties", {"shared": {"note": HEALTH}}),
    ("extendedProperties", {"private": {"note": HEALTH}}),
):
    item = dict(RAFFLE_DAD)
    item[field] = value
    DAD_PROBES.append(item)
PIN_ROWS = [SOCCER_ROW] + PROBES + [BOY_PIN]
DAD_NINE = [SOCCER_DAD] + DAD_PROBES + [BOY_ROW]
assert [sum(1 for r in rows if r.get("what") == BOY) for rows in (PIN_ROWS, PIN_ROWS, PIN_ROWS)] == [1, 1, 1]
assert len(DAD_NINE) == 9
assert len(DAD_PROBES) == 7
WEEK = {
    "asOfIso": P["day"],
    "kids": {
        "ainsley": {"today": PIN_ROWS},
        "hayes": {"today": PIN_ROWS},
        "harris": {"today": PIN_ROWS},
        "dan": {"today": DAD_NINE},
    },
}
NOW = datetime.now(timezone.utc).isoformat()
CAL = {
    "status": "live",
    "fetchedAt": NOW,
    "asOfIso": P["day"],
    "upcomingLeaves": PIN_ROWS + DAD_NINE + [MONEY_ROW],
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
out = {"pages": {}, "home": {}, "taps": [], "inputs": {
    "boy": [sum(1 for r in WEEK["kids"][k]["today"] if r.get("what") == BOY) for k in ("ainsley", "hayes", "harris")],
    "dad": len(WEEK["kids"]["dan"]["today"]),
}}
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for href in PAGES:
        log_step("r45 page " + href)
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.set_default_timeout(8000)
        ctx.set_default_navigation_timeout(15000)
        ctx.add_init_script(INIT)
        page = ctx.new_page()
        try:
            page.goto(BASE + href + "?" + QS, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(1800)
            out["pages"][href] = page.evaluate("""(arg) => {
              const text = (document.body && document.body.innerText) || "";
              const kids = window.WardKids && WardKids._data && WardKids._data.kids ? JSON.stringify(WardKids._data.kids) : "";
              const blob = text + "\\n" + kids;
              const hits = {};
              arg.banned.forEach((b) => { hits[b] = blob.indexOf(b) >= 0; });
              const titles = [...document.querySelectorAll("[data-live='leaveby-today'] .leaveby-row-title")].map((el) => (el.textContent || "").trim()).filter(Boolean);
              return { ok: true, hits, titles, rows: titles.length, soccer: text.indexOf("Soccer") >= 0 || kids.indexOf("Soccer") >= 0, todaySoccer: titles.indexOf("Soccer") >= 0, appointment: text.indexOf("Appointment") >= 0, money: text.indexOf(arg.money) >= 0 };
            }""", {"banned": [HEALTH, "H4", "Raffle", MONEY], "money": MONEY})
            log_step("r45 page " + href + " rows " + str(out["pages"][href].get("rows")))
        except Exception as e:
            out["pages"][href] = {"ok": False, "rows": 0, "titles": [], "error": "r45 page " + href + ": " + str(e)[:240]}
            log_step("r45 page " + href + " FAIL " + str(e)[:160])
        ctx.close()
    log_step("r45 page google-home")
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    ctx.set_default_timeout(8000)
    ctx.set_default_navigation_timeout(15000)
    page = ctx.new_page()
    page.goto(BASE + "sheet-google-home.html?" + QS, wait_until="domcontentloaded", timeout=15000)
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
    tap_n = 0 if os.environ.get("WARDOS_SKIP_TAPS") == "1" else 15
    if tap_n == 0:
        log_step("r45 taps skipped")
    for i in range(tap_n):
        log_step("r45 tap %d" % (i + 1))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.set_default_timeout(8000)
        ctx.set_default_navigation_timeout(15000)
        page = ctx.new_page()
        try:
            page.goto(BASE + "sheet-google-home.html?now=" + P["pin"] + "&freeze=1", wait_until="commit", timeout=15000)
            page.wait_for_selector("a.wardos-home", state="visible", timeout=8000)
            ready = page.evaluate("""() => {
              const a = document.querySelector("a.wardos-home");
              if (!a) return null;
              const r = a.getBoundingClientRect();
              if (r.width < 32 || r.height < 32) return null;
              const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              if (!(hit && hit.closest && hit.closest("a.wardos-home"))) return null;
              return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            }""")
            if not ready:
                times.append(-1)
                log_step("r45 tap %d not-ready" % (i + 1))
                ctx.close()
                continue
            t0 = time.perf_counter()
            with page.expect_request("**/sheet-index.html**", timeout=4000):
                page.mouse.click(ready["x"], ready["y"], delay=0)
            ms = round((time.perf_counter() - t0) * 1000, 1)
            times.append(ms)
            log_step("r45 tap %d %sms" % (i + 1, ms))
        except Exception as e:
            times.append(-1)
            log_step("r45 tap %d FAIL %s" % (i + 1, str(e)[:120]))
        ctx.close()
    out["taps"] = times
    ok = [t for t in out["taps"] if 0 <= t <= 300]
    ordered = sorted(t for t in out["taps"] if t >= 0)
    p95 = ordered[max(0, int(__import__("math").ceil(0.95 * len(ordered))) - 1)] if ordered else -1
    out["tap"] = {"n": 15, "ok": len(ok), "values": out["taps"], "p95": p95, "median": round(statistics.median(ordered), 1) if ordered else -1}
    nodes = [n for n in (out["home"].get("nodes") or []) if n.get("box")]
    bad = []
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            if overlap(nodes[i]["box"], nodes[j]["box"]):
                bad.append(nodes[i]["name"] + "/" + nodes[j]["name"])
        if nodes[i]["box"]["bottom"] > 1032:
            bad.append(nodes[i]["name"] + " bottom " + str(nodes[i]["box"]["bottom"]))
    out["home"]["overlap"] = bad
    log_step("r45 close")
    print(json.dumps(out), flush=True)
    sys.stdout.flush()
    stop_httpd(httpd)
    os._exit(0)
