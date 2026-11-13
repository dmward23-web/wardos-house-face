#!/usr/bin/env python3
"""Real pages, ?wardos-test=1. Prints one JSON object."""
import json, os, sys, threading
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fixture_clock import at, clock_init, log_step, pin_at, plan, shift_day, stop_httpd
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
P = plan(os.environ.get("WARDOS_DAY_SHIFT", "0"))
WHEN = P["start"]
SHEET = ["Soccer", "Swim", "School pickup", "School drop", "Baseball", "Flag", "Homework", "Choir", "Raffle", "Conference", "Donation", "HOA"]
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

sheet = []
sheet.append(row(SOCCER, startIso=pin_at(P, 0), start=pin_at(P, 0), end=P["end"]))
for i, label in enumerate(SHEET):
    if label == "Soccer":
        continue
    stamp = pin_at(P, 5 + i)
    sheet.append(row(label, startIso=stamp, start=stamp, end=P["end"]))
for key, value in FIELDS:
    probe = row("Homework", startIso=pin_at(P, 40), start=pin_at(P, 40), end=P["end"])
    probe[key] = value
    sheet.append(probe)
dad_rows = [
    row(BOY, startIso=at(P, 0), start=at(P, 0), end=P["soon_end"]),
    row(MONEY, startIso=at(P, 5), start=at(P, 5), end=P["soon_end"]),
]

days = {}
field_items = []
for key, value in FIELDS:
    field_items.append({"c": "shr", "l": "Homework", key: value})
# Today and later only. Earlier weeks are wf-past and their text is not on the wall.
days[P["day"]] = {"items": [{"c": "hay", "l": SOCCER}, {"c": "hay", "l": BOY}, {"c": "ain", "l": "Dentist", "description": "#wardos-show"}] + field_items}
for n, label in enumerate(LABELS):
    days[shift_day(P, 1 + n)] = {"items": [{"c": "shr", "l": label}]}

now = datetime.now(timezone.utc).isoformat()
leaves = []
for item in sheet + dad_rows:
    ev = dict(item)
    ev["summary"] = item["what"]
    ev["start"] = item["start"]
    ev["end"] = item.get("end") or P["end"]
    leaves.append(ev)
FIX = {
    "kids": {
        "ainsley": {"today": sheet},
        "hayes": {"today": sheet},
        "harris": {"today": sheet},
        "dan": {"today": dad_rows},
    },
    "cal": {"status": "live", "fetchedAt": now, "asOfIso": P["day"], "upcomingLeaves": leaves},
    "days": days,
    "rangeStart": P["month_start"],
    "rangeEnd": shift_day(P, 1 + len(LABELS)),
}

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

httpd = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Q(*a, directory=str(ROOT), **k))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % httpd.server_address[1]
QS = "wardos-test=1&now=" + P["pin"] + "&freeze=1"
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
        log_step("r44 page " + name)
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.set_default_timeout(8000)
        page = ctx.new_page()
        page.add_init_script(clock_init(P["pin_ms"]) + "window.__wardosFixture = %s;" % json.dumps(FIX))
        rec = {"ok": False, "rows": 0, "titles": []}
        try:
            page.goto(base + href + "?" + QS, wait_until="domcontentloaded", timeout=15000)
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
              const titles = [...document.querySelectorAll("[data-live='leaveby-today'] .leaveby-row-title")].map((el) => (el.textContent || "").trim()).filter(Boolean);
              return { ok: true, hits, has, titles, rows: titles.length };
            }""", {"banned": BANNED, "labels": ["Soccer", "Appointment", MONEY] + LABELS})
        except Exception as e:
            rec = {"ok": False, "rows": 0, "titles": [], "error": str(e)[:300]}
        out["pages"][name] = rec
        log_step("r44 page " + name + " rows " + str(rec.get("rows")))
        ctx.close()
    log_step("r44 page google-home")
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    ctx.set_default_timeout(8000)
    page = ctx.new_page()
    try:
        page.goto(base + "sheet-google-home.html?" + QS, wait_until="domcontentloaded", timeout=15000)
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
    log_step("r44 close")
    print(json.dumps(out), flush=True)
    sys.stdout.flush()
    stop_httpd(httpd)
    os._exit(0)
