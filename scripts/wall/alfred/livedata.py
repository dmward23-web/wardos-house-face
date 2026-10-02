import json, sys, socket, subprocess, time, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True); import datetime
CLOCK = sys.argv[3] if len(sys.argv) > 3 else datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).replace(microsecond=0).isoformat()
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "-d", str(ROOT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
base = f"http://127.0.0.1:{port}/"; WX = re.compile(r"^https://(api\.open-meteo\.com|api\.weather\.gov|wttr\.in)/")
res = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H in ((1920, 1080), (2560, 1440)):
        ctx = b.new_context(viewport={"width": W, "height": H}, timezone_id="America/Chicago")
        reqs, errs = [], []
        def route(r):
            u = r.request.url
            if r.request.method not in ("GET", "HEAD"): return r.abort()
            if u.startswith(base) or WX.match(u): reqs.append(u.replace(base, "")); return r.continue_()
            reqs.append("BLOCKED " + u[:100]); return r.abort()
        ctx.route("**/*", route); pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
        pg.clock.install(time=CLOCK); pg.goto(base + "wall.html", wait_until="load"); pg.wait_for_timeout(3000); pg.clock.run_for(2000)
        d = pg.evaluate(r"""() => { const vis = e => { for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || a.hidden) return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.top < innerHeight; };
          const tiles = {}; for (const e of document.querySelectorAll('[data-tile-id],[data-tile]')) { const id = e.getAttribute('data-tile-id') || e.getAttribute('data-tile'); const v = vis(e); const t = v ? (e.innerText || '').replace(/\s+/g, ' ').trim() : '';
            if (!(id in tiles) || (v && !tiles[id].visible)) tiles[id] = { visible: v, text: t.slice(0, 220), empty: v && t.length < 3 }; }
          const hdr = document.querySelector('a.hdr, header'); return { now: new Date().toString(), header: hdr ? hdr.innerText.replace(/\s+/g, ' ').trim() : '', tiles,
            body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 6000) }; }""")
        pg.screenshot(path=str(OUT / f"live-now-{W}.png"))
        d["requests"] = sorted(set(reqs)); d["errors"] = errs; res[f"{W}x{H}"] = d; ctx.close()
    b.close()
srv.terminate()
json.dump(res, open(OUT / "livedata.json", "w"), indent=1)
d = res["1920x1080"]; print(d["now"]); print("HEADER:", d["header"]); print("REQ:", [r for r in d["requests"] if "data/" in r or "BLOCKED" in r or "http" in r]); print("ERR:", d["errors"])
for k, v in d["tiles"].items():
    if v["visible"]: print(f"  {k}: {v['text'][:170]}")
print("HIDDEN:", [k for k, v in d["tiles"].items() if not v["visible"]])
