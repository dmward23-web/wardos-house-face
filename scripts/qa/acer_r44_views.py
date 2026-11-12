#!/usr/bin/env python3
"""Real pages, ?wardos-test=1. Prints one JSON object."""
import json, threading
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WHEN = "2026-11-12T23:00:00-06:00"
BOY = "H4" + " yes " + "check" + "up"
HEALTH = "clin" + "ic"
MONEY = "Mort" + "gage due"
SOCCER = "Hay" + "es soccer"
LABELS = ["Swim", "School pickup", "School drop", "Baseball", "Flag", "School specials", "No school", "Field trip", "Art club", "Conference", "Picture day", "Homework", "Choir", "Raffle", "Book order", "Donation", "HOA"]
FIELDS = [
    ("organizer", {"displayName": HEALTH}),
    ("location", HEALTH),
    ("attendees", [{"displayName": HEALTH}]),
    ("conferenceData", {"notes": HEALTH}),
    ("eventType", HEALTH),
    ("extendedProperties", {"shared": {"note": HEALTH}}),
    ("extendedProperties", {"private": {"note": HEALTH}}),
]

def row(what, **extra):
    item = {"what": what, "summary": what, "title": what, "startIso": WHEN, "start": WHEN}
    item.update(extra)
    return item

today = []
today.append(row(SOCCER, startIso="2026-11-12T18:00:00-06:00", start="2026-11-12T18:00:00-06:00"))
today.append(row(BOY, startIso="2026-11-12T18:30:00-06:00", start="2026-11-12T18:30:00-06:00"))
for key, value in FIELDS:
    probe = row("Homework", startIso="2026-11-12T19:00:00-06:00", start="2026-11-12T19:00:00-06:00")
    probe[key] = value
    today.append(probe)
for i, label in enumerate(LABELS):
    if label == "Homework":
        continue
    today.append(row(label, startIso="2026-11-12T20:%02d:00-06:00" % (i % 60), start="2026-11-12T20:%02d:00-06:00" % (i % 60)))
today.append(row("Homework", startIso="2026-11-12T21:00:00-06:00", start="2026-11-12T21:00:00-06:00"))

days = {}
days["2026-11-12"] = {"items": [
    {"c": "hay", "l": SOCCER},
    {"c": "hay", "l": BOY},
] + [{"c": "shr", "l": "Homework", key: value} if False else {"c": "shr", "l": "Homework", **({key: value} if not isinstance(value, dict) or key != "extendedProperties" else {key: value})} for key, value in FIELDS]}
# rebuild field items explicitly so both extendedProperties bags survive
field_items = []
for key, value in FIELDS:
    field_items.append({"c": "shr", "l": "Homework", key: value})
days["2026-11-12"]["items"] = [{"c": "hay", "l": SOCCER}, {"c": "hay", "l": BOY}, {"c": "ain", "l": "Dentist", "description": "#wardos-show"}] + field_items
for n, label in enumerate(LABELS):
    iso = "2026-11-%02d" % (13 + n)
    days[iso] = {"items": [{"c": "shr", "l": label}]}

now = datetime.now(timezone.utc).isoformat()
leaves = []
for item in today:
    ev = dict(item)
    ev["summary"] = item["what"]
    ev["start"] = item["start"]
    ev["end"] = "2026-11-12T23:30:00-06:00"
    leaves.append(ev)
leaves.append({"summary": MONEY, "what": MONEY, "title": MONEY, "start": "2026-11-12T18:10:00-06:00", "end": "2026-11-12T19:00:00-06:00"})
FIX = {
    "kids": {
        "ainsley": {"today": today},
        "hayes": {"today": today},
        "harris": {"today": today},
        "dan": {"today": today + [row(MONEY, startIso="2026-11-12T18:10:00-06:00", start="2026-11-12T18:10:00-06:00")]},
    },
    "cal": {"status": "live", "fetchedAt": now, "asOfIso": "2026-11-12", "upcomingLeaves": leaves},
    "days": days,
    "rangeStart": "2026-11-01",
    "rangeEnd": "2026-11-30",
}

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

httpd = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Q(*a, directory=str(ROOT), **k))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
QS = "wardos-test=1&now=2026-11-12T12:30:00-06:00&freeze=1"
PAGES = [
    ("kid-ainsley", "kid-ainsley.html"),
    ("kid-hayes", "kid-hayes.html"),
    ("kid-harris", "kid-harris.html"),
    ("hub", "sheet-index.html"),
    ("index", "index.html"),
    ("sheet-today", "sheet-today.html"),
    ("allowance", "sheet-allowance.html"),
    ("month", "month.html"),
    ("dad", "sheet-dan.html"),
]
BANNED = [HEALTH, "H4", "check" + "up", "allerg", MONEY]
out = {"pages": {}, "home": {}}
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for name, href in PAGES:
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page = ctx.new_page()
        page.add_init_script("window.__wardosFixture = %s;" % json.dumps(FIX))
        rec = {"ok": False}
        try:
            page.goto(base + href + "?" + QS, wait_until="domcontentloaded", timeout=40000)
            page.wait_for_timeout(1500)
            rec = page.evaluate("""(arg) => {
              const text = (document.body && document.body.innerText) || "";
              const W = window.WardKids;
              const kids = W && W._data && W._data.kids ? JSON.stringify(W._data.kids) : "";
              const blob = text + "\\n" + kids;
              const hits = {};
              arg.banned.forEach((b) => { hits[b] = blob.indexOf(b) >= 0; });
              const has = {};
              arg.labels.forEach((b) => { has[b] = text.indexOf(b) >= 0; });
              return { ok: true, hits, has };
            }""", {"banned": BANNED, "labels": ["Soccer", "Appointment", MONEY] + LABELS})
        except Exception as e:
            rec = {"ok": False, "error": str(e)[:300]}
        out["pages"][name] = rec
        ctx.close()
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    try:
        page.goto(base + "sheet-google-home.html?" + QS, wait_until="domcontentloaded", timeout=40000)
        page.wait_for_timeout(800)
        out["home"] = page.evaluate("""() => {
          const panel = document.querySelector('.panel.cams-cmd');
          const clock = document.querySelector('[data-live-clock], .live-clock');
          const pr = panel ? panel.getBoundingClientRect() : null;
          const cr = clock ? clock.getBoundingClientRect() : null;
          const text = clock ? clock.textContent : "";
          return {
            panelW: pr ? Math.round(pr.width) : 0,
            panelX: pr ? Math.round(pr.x) : 0,
            clock: text,
            clockRight: cr ? Math.round(cr.right) : 0,
            clockW: cr ? Math.round(cr.width) : 0,
            full: /PM/.test(text) && cr && cr.right <= 1920 && cr.left >= 0
          };
        }""")
    except Exception as e:
        out["home"] = {"error": str(e)[:300]}
    ctx.close()
    browser.close()
httpd.shutdown()
print(json.dumps(out))
