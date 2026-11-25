"""HOUSEAWAY1 · hub at 1920x1080 DPR 1 for five pinned clocks, synthetic feeds only (loopback pfBase). One JSON line."""
import json, os, sys, threading
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/houseaway1")
OUT.mkdir(parents=True, exist_ok=True)
MONTHS = json.loads((ROOT / "scripts/qa/fixtures/private/cal-months.houseaway.synthetic.json").read_text())
CLOCKS = [("sat-nov21-1200", "2026-11-21T12:00:00-06:00", False), ("sun-nov22-0900", "2026-11-22T09:00:00-06:00", True),
          ("fri-nov27-1600", "2026-11-27T16:00:00-06:00", True), ("thu-dec03-1200", "2026-12-03T12:00:00-06:00", True),
          ("fri-dec04-1441", "2026-12-04T14:41:00-06:00", False)]
STATE = {}
def week(now_iso):
    n = datetime.fromisoformat(now_iso); day = n.strftime("%Y-%m-%d")
    def ev(s, h, kind="activity"):
        a = (n + timedelta(hours=h)).isoformat(); b = (n + timedelta(hours=h, minutes=45)).isoformat()
        return {"summary": s, "title": s, "what": s, "kind": kind, "startIso": a, "endIso": b, "start": a, "end": b, "time": (n + timedelta(hours=h)).strftime("%-I:%M"), "badge": "TODAY"}
    kids = {"hayes": [ev("Hayes robot kit", 2)], "harris": [ev("Harris drum lesson", 3)], "ainsley": [ev("Ainsley pottery", 4)]}
    return {"asOfIso": day, "boardStrip": {"queue": [x for v in kids.values() for x in v]},
            "kids": {k: {"id": k, "name": k.title(), "today": v, "quests": []} for k, v in kids.items()}}
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(ROOT), **k)
    def log_message(self, *a): pass
    def do_GET(self):
        p = self.path.split("?", 1)[0]
        if p.endswith("/kids-week.json"): body = json.dumps(week(STATE["now"])).encode()
        elif p.endswith("/cal-months.json"): body = json.dumps(MONTHS).encode()
        elif p.endswith("/cal-live.json"): body = json.dumps({"status": "live", "fetchedAt": STATE["now"], "upcomingLeaves": []}).encode()
        elif p.endswith("/private-names.json"): body = b"{}"
        elif "/api/private/" in p: body = b"{}"
        else: return super().do_GET()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
PROBE = """() => { const AF = window.AwayFilter; const kids = [...document.querySelectorAll(".tile[data-kid-seed]")];
  const vis = el => { for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden') return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const txt = document.body.innerText;
  return { hasMonths: !!(AF && AF.hasMonths()), awayNow: !!(AF && AF.isAwayNow()), kidTiles: kids.length, kidTilesShown: kids.filter(vis).length,
    kidTextShown: ["Hayes robot kit", "Harris drum lesson", "Ainsley pottery"].filter(s => txt.includes(s)) }; }"""
res = {}
httpd = ThreadingHTTPServer(("127.0.0.1", 0), H); threading.Thread(target=httpd.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d" % httpd.server_address[1]
with sync_playwright() as p:
    br = p.chromium.launch(**launch_kw(p, headless=True))
    for tag, iso, want_away in CLOCKS:
        STATE["now"] = iso
        ctx = br.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1, timezone_id="America/Chicago")
        ctx.route(__import__("re").compile(r"^https?://(?!127\.0\.0\.1).*"), lambda r: r.abort())
        ctx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        pg = ctx.new_page(); pg.clock.install(time=iso)
        pg.goto(f"{base}/sheet-index.html?pfBase={base}&now={iso.replace('+', '%2B')}", wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(3500)
        r = pg.evaluate(PROBE); r["wantAway"] = want_away
        r["pass"] = r["hasMonths"] and r["awayNow"] == want_away and ((r["kidTilesShown"] == 0 and not r["kidTextShown"]) if want_away else True)
        f = OUT / f"hub-{tag}.png"; pg.screenshot(path=str(f)); r["png"] = str(f)
        res[tag] = r; ctx.close()
    br.close()
httpd.shutdown()
print(json.dumps(res))
