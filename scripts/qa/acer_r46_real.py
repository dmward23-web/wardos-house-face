#!/usr/bin/env python3
"""Real /api/private fetch, page-data counts, early taps, clock pill boxes."""
import json, math, statistics, threading, time
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HEALTH = "tele" + "health"
BOY = "Hay" + "es dent" + "ist"
WHEN = "2026-11-12T13:00:00-06:00"
MARK = "#wardos-show"
SOCCER = "Hay" + "es soccer"
LABELS = {"Soccer", "Appointment", "Swim", "Homework", "School pickup", "School drop", "Baseball", "Flag", "Choir", "Raffle", "Art club", "Conference", "Picture day", "No school", "Field trip", "Book order", "Donation", "HOA", "School specials", "Leave for swim", "Leave for soccer", "Leave for baseball", "Leave for flag", "Nothing else today", "More on the month calendar"}

def row(what, **extra):
    item = {"what": what, "summary": what, "title": what, "l": what, "startIso": WHEN, "start": WHEN, "when": "Thu · 1:00 PM"}
    item.update(extra)
    return item

ainsley = [
    row("Dentist", description=MARK, c="ain"),
    row(SOCCER, c="ain", startIso="2026-11-12T18:00:00-06:00", start="2026-11-12T18:00:00-06:00"),
]
hayes = [
    row(BOY, description=MARK, c="hay", kid="hayes"),
    row("Raffle", c="hay", attachments=[{"title": HEALTH}]),
    row("Raffle", c="hay", source={"title": HEALTH}, startIso="2026-11-12T13:00:01-06:00"),
    row("speech therapy", description=MARK, c="hay", kid="hayes"),
]
WEEK = {"asOfIso": "2026-11-12", "kids": {"ainsley": {"today": ainsley}, "hayes": {"today": hayes}, "harris": {"today": list(hayes)}, "dan": {"today": [row("Dentist", description=MARK)]}}}
NOW = datetime.now(timezone.utc).isoformat()
CAL = {"status": "live", "fetchedAt": NOW, "asOfIso": "2026-11-12", "upcomingLeaves": ainsley + hayes}
MONTHS = {"rangeStart": "2026-11-01", "rangeEnd": "2026-11-30", "days": {"2026-11-12": {"items": [
    {"c": "ain", "l": "Dentist", "description": MARK, "start": WHEN},
    {"c": "ain", "l": SOCCER},
    {"c": "hay", "l": "Raffle", "attachments": [{"title": HEALTH}]},
]}}}
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
QS = "pfBase=http://127.0.0.1:%d&now=2026-11-12T12:30:00-06:00&freeze=1" % PORT
INIT = "localStorage.setItem('wardos-private-feed-token','r46-fixture-token-key');"
PAGES = ["kid-ainsley.html", "kid-hayes.html", "kid-harris.html", "sheet-index.html", "index.html", "sheet-today.html", "sheet-allowance.html", "month.html"]

def overlap(a, b):
    return a["x"] < b["right"] - 1 and b["x"] < a["right"] - 1 and a["y"] < b["bottom"] - 1 and b["y"] < a["bottom"] - 1

HIT_JS = """() => {
  const a = document.querySelector("#gh-home, a.wardos-home");
  if (!a) return null;
  const r = a.getBoundingClientRect();
  if (r.width < 32 || r.height < 32) return null;
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  if (!hit || !hit.closest || !hit.closest("a.wardos-home")) return null;
  return { cx: cx, cy: cy, x: r.x, y: r.y, w: r.width, h: r.height };
}"""

def wait_home(page):
    """Stable box and a center hit. The loop itself stops at 8s.
    Each probe is one evaluate, so it does not wait on animation frames or a locator."""
    deadline = time.perf_counter() + 8.0
    prev = None
    while time.perf_counter() < deadline:
        try:
            page.wait_for_selector("#gh-home, a.wardos-home", state="attached", timeout=500)
            box = page.evaluate(HIT_JS)
        except Exception:
            box = None
        if box and prev and abs(box["x"] - prev["x"]) < 1 and abs(box["y"] - prev["y"]) < 1 and abs(box["w"] - prev["w"]) < 1 and abs(box["h"] - prev["h"]) < 1:
            return box
        prev = box or None
        left = deadline - time.perf_counter()
        if left <= 0:
            break
        time.sleep(min(0.02, left))
    return None

out = {"pages": {}, "home": {}, "tap": {"runs": []}}
with sync_playwright() as p:
    browser = p.chromium.launch(**launch_kw(p, headless=True))
    for href in PAGES:
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        ctx.add_init_script(INIT)
        page = ctx.new_page()
        try:
            page.goto(BASE + href + "?" + QS, wait_until="domcontentloaded", timeout=40000)
            page.wait_for_timeout(1600)
            out["pages"][href] = page.evaluate("""(arg) => {
              const W = window.WardKids && WardKids._data ? WardKids._data : null;
              const blob = JSON.stringify(W || {});
              const labels = new Set(arg.labels);
              let off = 0, boyRows = 0;
              function walk(v) {
                if (!v || typeof v !== "object") return;
                if (Array.isArray(v)) { v.forEach(walk); return; }
                if (v.what || v.l || v.title) {
                  const label = v.what || v.l || v.title;
                  if (!labels.has(label)) off++;
                  const raw = JSON.stringify(v);
                  if (/hayes|harris|h4/i.test(raw)) boyRows++;
                }
                Object.keys(v).forEach((k) => { if (v[k] && typeof v[k] === "object") walk(v[k]); });
              }
              walk(W);
              const text = (document.body && document.body.innerText) || "";
              return {
                banned: (blob.match(/telehealth|H4|Hayes|Harris/g) || []).length,
                off, boyRows,
                appointment: text.indexOf("Appointment") >= 0 || blob.indexOf("Appointment") >= 0,
                domAppointment: text.indexOf("Appointment") >= 0,
                soccer: text.indexOf("Soccer") >= 0 || blob.indexOf("Soccer") >= 0
              };
            }""", {"labels": sorted(LABELS)})
        except Exception as e:
            out["pages"][href] = {"error": str(e)[:200], "banned": 1, "off": 1, "boyRows": 1, "appointment": False}
        ctx.close()
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(BASE + "sheet-google-home.html?now=2026-11-12T12:30:00-06:00&freeze=1", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(500)
    out["home"] = page.evaluate("""() => {
      function box(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
      }
      const nodes = [
        { name: "home", box: box(document.querySelector("a.wardos-home")) },
        { name: "pill", box: box(document.querySelector(".live-clock-host")) },
        { name: "banner", box: box(document.querySelector("section.banner, .cmd-title")) },
        { name: "header", box: box(document.querySelector("header.hdr")) }
      ].concat([...document.querySelectorAll("article.cam")].map((el, i) => ({ name: "cam" + i, box: box(el) })));
      return { nodes, clock: (document.querySelector("[data-live-clock]") || {}).textContent || "" };
    }""")
    ctx.close()
    for run in range(3):
        times = []
        for i in range(15):
            ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            page = ctx.new_page()
            page.goto(BASE + "sheet-google-home.html?now=2026-11-12T12:30:00-06:00&freeze=1", wait_until="commit", timeout=30000)
            box = wait_home(page)
            t0 = time.perf_counter()
            try:
                if not box:
                    raise RuntimeError("home not hit-testable")
                with page.expect_request("**/sheet-index.html**", timeout=4000):
                    page.mouse.click(box["cx"], box["cy"], delay=0)
                times.append(round((time.perf_counter() - t0) * 1000, 1))
            except Exception:
                times.append(-1)
            ctx.close()
        ordered = sorted(t for t in times if t >= 0)
        p95 = ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)] if ordered else -1
        out["tap"]["runs"].append({"ok": sum(1 for t in times if 0 <= t <= 300), "values": times, "p95": p95, "median": round(statistics.median(ordered), 1) if ordered else -1})
    browser.close()
nodes = {n["name"]: n["box"] for n in (out["home"].get("nodes") or []) if n.get("box")}
bad = []
for name, box in nodes.items():
    if box["bottom"] > 1032:
        bad.append(name + " bottom " + str(box["bottom"]))
pill, header = nodes.get("pill"), nodes.get("header")
if pill and header:
    if not (pill["x"] >= header["x"] - 1 and pill["right"] <= header["right"] + 1 and pill["y"] >= header["y"] - 1 and pill["bottom"] <= header["bottom"] + 1):
        bad.append("pill outside header")
for a, b in (("pill", "banner"), ("pill", "home"), ("home", "banner"), ("home", "header")):
    if a in nodes and b in nodes and overlap(nodes[a], nodes[b]):
        bad.append(a + "/" + b)
for name, box in nodes.items():
    if not name.startswith("cam"):
        continue
    for other in ("pill", "home", "banner", "header"):
        if other in nodes and overlap(box, nodes[other]):
            bad.append(name + "/" + other)
out["home"]["overlap"] = bad
httpd.shutdown()
print(json.dumps(out))
