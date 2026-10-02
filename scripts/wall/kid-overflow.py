# KIDFIT1 · kid boards never push sideways: at 1080x1920 (wall portrait) and 440x956 (Dan's phone) nothing on
# kid-hayes / kid-harris / kid-ainsley reaches past the viewport, pseudo-elements included (the board's own
# overflow-x clip on body is lifted for the measurement so a hidden overflow can't hide). Test clock Thu Oct 1 9:30 PM CT.
# Usage: python3 scripts/wall/kid-overflow.py   (exit 1 on any overflow)
import sys, os, subprocess, time, random, datetime, json
from playwright.sync_api import sync_playwright
WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../..")); PORT = random.randint(20000, 40000)
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=WT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8); L = f"http://127.0.0.1:{PORT}/"
MEASURE = """() => { for (const e of [document.documentElement, document.body]) e.style.setProperty('overflow-x', 'visible', 'important');
  const p = document.querySelector('.panel'); const pr = p.getBoundingClientRect();
  return { vw: innerWidth, docSW: document.documentElement.scrollWidth, panelR: Math.round(pr.right), panelSW: p.scrollWidth, panelCW: p.clientWidth,
           overflowX: getComputedStyle(p).overflowX }; }"""
ok = True
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for vw, vh in [(1080, 1920), (440, 956)]:
            for kid in ["hayes", "harris", "ainsley"]:
                mob = vw <= 500
                ctx = b.new_context(viewport={"width": vw, "height": vh}, is_mobile=mob, has_touch=mob, screen={"width": vw, "height": vh}); pg = ctx.new_page(); errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:100]))
                pg.clock.install(time=datetime.datetime.fromisoformat("2026-10-01T21:30:00-05:00"))
                pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith(L) else r.abort())
                pg.goto(L + f"kid-{kid}.html"); pg.clock.run_for(2500); pg.wait_for_timeout(1200)
                m = pg.evaluate(MEASURE)
                lim = max(vw, m["panelCW"]) if vw < 600 else vw  # phone: the board's own width=1080 viewport meta is the layout width
                bad = m["docSW"] > lim or m["vw"] > lim or m["panelR"] > lim or errs
                ok = ok and not bad
                print(f"{vw}x{vh} kid-{kid}", "FAIL" if bad else "PASS", json.dumps(m), "errors:", errs[:2])
                ctx.close()
        b.close()
finally:
    srv.terminate()
print("KID OVERFLOW", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
