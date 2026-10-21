"""LIVEFIX3 · real-browser checks. Usage: python3 scripts/qa/livefix3_viewport.py <ainsley|hub|hubwall|wall> [width] [height]
Serves the repo on a loopback port and plays the hub (?pfBase=, loopback only) with the synthetic fixtures in
scripts/qa/fixtures/private (Smith/QXS stand-ins). 'hub*' answer cal-live with synthetic rows for an away Wednesday.
Prints one JSON line."""
import json, os, sys, threading, functools, re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FIX = os.path.join(ROOT, "scripts", "qa", "fixtures", "private")
mode = sys.argv[1]
w = int(sys.argv[2]) if len(sys.argv) > 2 else 440
h = int(sys.argv[3]) if len(sys.argv) > 3 else 956
NOW = "2026-10-20T19:00:00-05:00"
def at(hm): return "2026-10-21T" + hm + ":00-05:00"
CAL = {"status": "live", "source": "synthetic", "fetchedAt": "2026-10-21T00:00:00.000Z", "tz": "America/Chicago", "asOfIso": "2026-10-20",
       "upcomingLeaves": [
         {"summary": "Harris · Smith conference (VIRTUAL) · 4:00", "start": at("16:00"), "end": at("16:15")},
         {"summary": "Hayes · QXS conference (VIRTUAL) · 4:30", "start": at("16:30"), "end": at("16:45")},
         {"summary": "Harris flag practice · 5:30-6:30", "start": at("17:30"), "end": at("18:30")},
         {"summary": "Hayes + Harris · Jones Skate Night · 6:00", "start": at("18:00"), "end": at("20:00")}]}
hits = []
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = urlparse(self.path).path
        if p.startswith("/api/private/"):
            m = re.fullmatch(r"/api/private/([a-z-]+)\.json", p)
            name = m and m.group(1)
            f = name and os.path.join(FIX, name + ".synthetic.json")
            if name == "cal-live" and mode.startswith("hub") or name == "cal-live" and mode == "wall":
                body = json.dumps(CAL).encode()
            elif f and os.path.isfile(f):
                body = open(f, "rb").read()
            else:
                body = b"{}"; self.send_response(404); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
            hits.append(name)
            self.send_response(200); self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body))); self.send_header("Connection", "close"); self.end_headers()
            self.wfile.write(body); return
        if re.search(r"(^|/)(data/[^/]+\.json|kids-week\.json)$", p):   # the live phone never reads /data: only the hub route feeds the page
            self.send_response(404); self.send_header("Content-Length", "0"); self.end_headers(); return
        return super().do_GET()
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}"
AIN = r"""() => { const D = /[\d$%\u2605\u2606\u2b50]/;
  const vis = el => { for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden') return false; } return true; };
  const sec = document.querySelector('.sec-schedule.consume-sched'); if (!sec) return { missing: 1 };
  const o = []; const tw = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) { const el = n.parentElement, t = n.nodeValue.trim(); if (!t || !el || !vis(el) || el.closest('[data-mount-consume-hdr]')) continue; o.push(t); }
  return { digits: o.filter(t => D.test(t)).slice(0, 8), texts: o.length, endDate: o.filter(t => /\bOct\b|\bthrough\b|Multi-day/i.test(t)).slice(0, 4) }; }"""
TMR = r"""() => [...document.querySelectorAll('.lb-day-tmr, .lb-list-sec--tmr, [data-live="leaveby-tomorrow"], .leaveby-sec--tmr')].map(e => e.innerText.replace(/\s+/g, ' ')).join(' || ')"""
out = {"mode": mode, "size": f"{w}x{h}"}
with sync_playwright() as p:
    b = p.chromium.launch(args=["--disable-gpu"])
    mob = w < 600
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, reduced_motion="reduce")
    pg = ctx.new_page(); errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)[:160]))
    pg.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
    def gate(route):
        if urlparse(route.request.url).hostname != "127.0.0.1": return route.fulfill(status=204, body="")
        return route.continue_()
    pg.route("**/*", gate)
    pg.clock.install(time=NOW)
    q = "?now=" + NOW.replace("+", "%2B") + "&pfBase=" + base
    if mode == "ainsley":
        pg.goto(base + "/kid-ainsley.html" + q, wait_until="load", timeout=120000); pg.wait_for_timeout(4000)
        out["state"] = pg.evaluate(AIN)
    else:
        page = {"hub": "/sheet-index.html" + q, "hubwall": "/sheet-index.html" + q + "&from=wall", "wall": "/wall.html" + q}[mode]
        pg.goto(base + page, wait_until="load", timeout=120000); pg.wait_for_timeout(5000)
        t = pg.evaluate(TMR) if mode != "wall" else pg.evaluate("document.body.innerText.replace(/\\s+/g,' ')")
        out["state"] = {"conf": len(re.findall(r"conference", t, re.I)), "practice": len(re.findall(r"practice", t, re.I)),
                        "skate": len(re.findall(r"skate", t, re.I)), "tmr_len": len(t)}
    b.close()
srv.shutdown()
out["hub_hits"] = len(hits); out["errors"] = errors[:5]
print(json.dumps(out))
