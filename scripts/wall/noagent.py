# NOAGENT1 · guard: wall copy never names a house agent (Atlas 10/2). Renders wall.html at every deadspace state
# clock (today's real 06:45 / 15:30, Oct 1 pinned 20:00 / 21:30) and the three kid boards, at 1920x1080, 1080x1920
# and Dan's phone 440x956, and FAILS if the drawn text (innerText) or any aria-label / title / alt on the page names
# Ledger, Harbor (not the street Harbor Cove), Vita, Atlas, Alfred, Prism, Wright, Grok, Daystaff or Plumb.
# The display filter is house-noagent.js; this test reads what a person sees, so a new leak fails here.
# Usage: python3 scripts/wall/noagent.py   (exit 1 on any hit)
import os as _os, sys as _sys; _sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__))); import datasnap
import sys, os, json, subprocess, time, random, datetime
from playwright.sync_api import sync_playwright
WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
TODAY = json.load(open(os.path.join(WT, "data/kid-seats.json"))).get("asOfIso") or datetime.date.today().isoformat()
CLOCKS = [TODAY + "T06:45:00-05:00", TODAY + "T15:30:00-05:00", "2026-10-01T20:00:00-05:00", "2026-10-01T21:30:00-05:00"]
PAGES = ["wall.html", "kid-hayes.html", "kid-harris.html", "kid-ainsley.html"]
SIZES = [(1920, 1080), (1080, 1920), (440, 956)]
RX = r"\b(Ledger|Harbor(?!\s+Cove)|Vita|Atlas|Alfred|Prism|Wright|Grok|Daystaff|Plumb)\b"
PROBE = """(rx) => { const re = new RegExp(rx, 'gi'), hits = [];
  const t = document.body ? document.body.innerText : ''; let m;
  while ((m = re.exec(t))) hits.push('text: ...' + t.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\\s+/g, ' ') + '...');
  for (const e of document.querySelectorAll('[aria-label],[title],[alt]')) for (const a of ['aria-label', 'title', 'alt']) { const v = e.getAttribute(a); if (v && new RegExp(rx, 'i').test(v)) hits.push(a + ': ' + v.slice(0, 80)); }
  if (new RegExp(rx, 'i').test(document.title)) hits.push('title: ' + document.title);
  return hits; }"""
PORT = random.randint(20000, 40000)
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=WT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8); L = f"http://127.0.0.1:{PORT}/"
ok = True; n = 0
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for page in PAGES:
            for iso in (CLOCKS if page == "wall.html" else CLOCKS[1:2] + CLOCKS[3:]):
                for vw, vh in SIZES:
                    mob = vw <= 500
                    ctx = b.new_context(viewport={"width": vw, "height": vh}, is_mobile=mob, has_touch=mob, screen={"width": vw, "height": vh}); pg = ctx.new_page()
                    pg.clock.install(time=datetime.datetime.fromisoformat(iso))
                    def route(r, _iso=iso):
                        pb = datasnap.body(r.request.url, _iso)
                        if pb is not None and r.request.url.startswith(L): return r.fulfill(status=200, content_type="application/json", body=pb)
                        return r.continue_() if r.request.url.startswith(L) else r.abort()
                    pg.route("**/*", route)
                    pg.goto(L + page); pg.clock.run_for(3000); pg.wait_for_timeout(1200); pg.clock.run_for(1000); pg.wait_for_timeout(300)
                    hits = pg.evaluate(PROBE, RX); ctx.close(); n += 1
                    tag = f"{page} {iso[:16]} {vw}x{vh}"
                    if hits: ok = False; print("FAIL", tag, "|", " | ".join(sorted(set(hits))[:6]))
                    else: print("PASS", tag)
        b.close()
finally:
    srv.terminate()
print("NOAGENT", "PASS" if ok else "FAIL", f"({n} renders)"); sys.exit(0 if ok else 1)
