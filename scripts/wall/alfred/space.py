"""GATE RULE 10/2: REAL data at the CURRENT clock only (repo data/ as regenerated, no fixtures). Fixture states run only with
SPACE_FIXTURES=1 and are reported separately; they never count toward a pass. Method is Alfred's space.py verbatim otherwise.
Usage: python3 scripts/wall/alfred/space.py <worktree> <outdir>   (SPACE_PAGES=a.html,b.html to limit; SPACE_CLOCK=ISO to pin)
SPACE-01 (Alfred, independent): reflow / dead space on wall.html + every board it reaches, 7 states x 5 viewports.
Content = visible text, media (img/svg/canvas/video), form controls, LEDs/progress; decorative tile backgrounds are NOT content.
FAIL: largest empty rectangle > 2% of the viewport (content dilated 12px), any inter-tile vertical gap > 24px,
laptop landscape fill (1280/1366/1536): side gutter > 4% of width per side or panel height < 92% of viewport (letterbox).
Read-only: GET only, local only; fixtures routed in from the repo's scripts/wall/fixtures (data/ never written)."""
import json, sys, socket, subprocess, time, re
from pathlib import Path
from multiprocessing import Pool
WT = Path(sys.argv[1]).resolve(); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
FX = WT / "scripts/wall/fixtures"
VPS = [(1280, 650), (1366, 768), (1536, 730), (1920, 1080), (2560, 1440)]
FIXTURE_STATES = [
 ("morning", "2026-10-01T06:45:00-05:00", {"data/kid-seats.json": "kid-seats.gen0645", "data/next-up.json": "next-up.gen0645", "data/house-mode.json": "house-mode.gen0645"}),
 ("after-school", "2026-10-01T15:30:00-05:00", {"data/kid-seats.json": "kid-seats.gen1530", "data/next-up.json": "next-up.gen1530", "data/house-mode.json": "house-mode.gen1530"}),
 ("close-window", "2026-10-01T20:00:00-05:00", {}),
 ("travel-week", "2026-10-01T20:00:00-05:00", {"data/kid-seats.json": "kid-seats.travel-week"}),
 ("no-pickups", "2026-10-01T15:30:00-05:00", {"data/pickup-chain.json": "pickup-chain.empty", "data/kid-seats.json": "kid-seats.gen1530", "data/next-up.json": "next-up.gen1530", "data/house-mode.json": "house-mode.gen1530"}),
 ("choice-hidden", "2026-10-01T20:00:00-05:00", {"data/kid-seats.json": "kid-seats.choice-hidden"}),
 ("doors-absent", "2026-10-01T20:00:00-05:00", {"data/nest-live.json": "nest-live.no-doorbell"}),
]
import datetime, os
def _now_ct():
    return datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).replace(microsecond=0).isoformat()
CLOCK_NOW = os.environ.get("SPACE_CLOCK") or _now_ct()
STATES = [("real-now", CLOCK_NOW, {})]
if os.environ.get('SPACE_FIXTURES'): STATES = STATES + [(l + '-FIXTURE', c, m) for l, c, m in FIXTURE_STATES]
PROBE = r"""() => {
 const W = innerWidth, H = innerHeight, C = 8, cols = Math.ceil(W / C), rows = Math.ceil(H / C), D = 12;
 const vis = e => { for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05 || a.hidden) return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
 const g = new Uint8Array(cols * rows), g0 = new Uint8Array(cols * rows);
 const mark0 = r => { const x0 = Math.max(0, Math.floor(r.left / C)), x1 = Math.min(cols - 1, Math.floor((r.right - 1) / C)), y0 = Math.max(0, Math.floor(r.top / C)), y1 = Math.min(rows - 1, Math.floor((r.bottom - 1) / C)); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g0[y * cols + x] = 1; };
 const mark = r => { mark0(r); const x0 = Math.max(0, Math.floor((r.left - D) / C)), x1 = Math.min(cols - 1, Math.floor((r.right + D) / C)), y0 = Math.max(0, Math.floor((r.top - D) / C)), y1 = Math.min(rows - 1, Math.floor((r.bottom + D) / C)); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * cols + x] = 1; };
 const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
 while ((n = tw.nextNode())) { if (!n.nodeValue.trim() || !n.parentElement || !vis(n.parentElement)) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width > 0) mark(r); }
 for (const e of document.querySelectorAll('img,svg,canvas,video,button,input,select,textarea,progress,meter,.led,[role=img],[role=progressbar]')) if (vis(e)) mark(e.getBoundingClientRect());
 const TILE = '[data-tile-id],[data-tile],.mod,.act,.ctl,.seat,.claim,.card,.sec,.tile,.panel > section,.panel > div > section';
 const tiles = [...document.querySelectorAll(TILE)].filter(vis).map(e => { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-tile-id') || e.getAttribute('data-tile') || e.id || (e.className.toString().split(' ')[0]) || e.tagName, l: r.left, t: r.top, r: r.right, b: r.bottom, leaf: !e.querySelector(TILE) }; })
   .filter(t => t.b > 0 && t.t < H && t.r - t.l > 40 && t.b - t.t > 16);
 const pnl = document.querySelector('#wall-panel, .panel, main, body > div'); const pr = pnl ? pnl.getBoundingClientRect() : { left: 0, right: W, top: 0, bottom: H };
 return { W, H, C, cols, rows, g: Array.from(g), tiles, g0: Array.from(g0), panel: { l: pr.left, r: pr.right, t: pr.top, b: pr.bottom }, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight };
}"""
def largest_empty(d):
    cols, rows, g = d["cols"], d["rows"], d["g"]; h = [0] * cols; best = (0, 0, 0, 0, 0)
    for y in range(rows):
        for x in range(cols): h[x] = h[x] + 1 if not g[y * cols + x] else 0
        st = []
        for x in range(cols + 1):
            hh = h[x] if x < cols else 0; sx = x
            while st and st[-1][1] >= hh:
                sx, sh = st.pop(); a = sh * (x - sx)
                if a > best[0]: best = (a, sx, y - sh + 1, x - sx, sh)
            st.append((sx, hh))
    a, x, y, w, hh = best; C = d["C"]
    return {"frac": a * C * C / (d["W"] * d["H"]), "x": x * C, "y": y * C, "w": w * C, "h": hh * C}
def gaps(d):
    t = [x for x in d["tiles"] if x["leaf"]]; out = []
    for a in t:
        below = [b for b in t if b is not a and b["t"] >= a["b"] - 1 and min(a["r"], b["r"]) - max(a["l"], b["l"]) > 0.3 * min(a["r"] - a["l"], b["r"] - b["l"])]
        if not below: continue
        nb = min(below, key=lambda b: b["t"]); gap = nb["t"] - a["b"]
        # something else sitting in the gap (a non-leaf header/strip)? then it isn't empty
        if gap <= 24: continue
        # gap = the longest run of 8px rows in the band (overlap x-range) with NO content at all (text/media/controls, undilated)
        C, cols, g0 = d["C"], d["cols"], d["g0"]; x0 = int(max(a["l"], nb["l"]) // C); x1 = int(min(a["r"], nb["r"]) // C); y0 = int(a["b"] // C) + 1; y1 = int(nb["t"] // C) - 1
        run = best = 0
        for y in range(y0, y1 + 1):
            empty = all(not g0[y * cols + x] for x in range(max(0, x0), min(cols, x1 + 1)))
            run = run + 1 if empty else 0; best = max(best, run)
        gap = best * C
        if gap > 24: out.append({"above": a["id"], "below": nb["id"], "gap": round(gap), "x": round(max(a["l"], nb["l"])), "y": round(a["b"])})
    return sorted(out, key=lambda z: -z["gap"])
def job(args):
    page, state, vp, port = args
    from playwright.sync_api import sync_playwright
    label, clock, fx = state; W, H = vp; base = f"http://127.0.0.1:{port}/"
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": W, "height": H}, reduced_motion="reduce")
        def route(r):
            u = r.request.url
            if r.request.method not in ("GET", "HEAD") or not u.startswith(base): return r.abort()
            path = u[len(base):].split("?")[0]
            if path in fx: return r.fulfill(status=200, content_type="application/json", body=(FX / (fx[path] + ".FIXTURE.json")).read_text())
            return r.continue_()
        ctx.route("**/*", route); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        try:
            pg.clock.install(time=clock)
            pg.goto(base + page, wait_until="load", timeout=30000); pg.wait_for_timeout(1800)
            try: pg.clock.run_for(1500)
            except Exception: pass
            d = pg.evaluate(PROBE)
        except Exception as e:
            b.close(); return {"page": page, "state": label, "vp": f"{W}x{H}", "error": str(e)[:200]}
        le = largest_empty(d); gp = gaps(d)
        fill = None
        if W <= 1536:
            lg, rg = d["panel"]["l"], W - d["panel"]["r"]; ph = min(d["panel"]["b"], H) - max(d["panel"]["t"], 0)
            fill = {"left": round(lg), "right": round(rg), "panelH": round(ph), "ok": lg <= 0.04 * W and rg <= 0.04 * W and (ph >= 0.92 * H or d["sh"] > H + 8)}
        fails = []
        if le["frac"] > 0.02: fails.append(f"empty {le['w']}x{le['h']} at ({le['x']},{le['y']}) = {le['frac']:.1%}")
        if gp: fails.append(f"gap {gp[0]['gap']}px {gp[0]['above']} -> {gp[0]['below']} at y={gp[0]['y']}")
        if fill and not fill["ok"]: fails.append(f"landscape fill: gutters L{fill['left']} R{fill['right']} panelH {fill['panelH']}/{H}")
        if d["sw"] > W + 2: fails.append(f"sideways overflow {d['sw'] - W}px")
        shot = None
        if fails and (page == "wall.html" or vp in [(1920, 1080), (1366, 768)]):
            shot = str(OUT / f"{page.replace('.html','')}-{label}-{W}x{H}.png"); pg.screenshot(path=shot)
        b.close()
        return {"page": page, "state": label, "vp": f"{W}x{H}", "largest_empty": le, "gaps": gp[:3], "fill": fill, "fails": fails, "errors": errs[:2], "shot": shot}
if __name__ == "__main__":
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "-d", str(WT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:   # boards = every same-origin page linked from the wall (1920, real data)
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1920, "height": 1080}); pg.goto(f"http://127.0.0.1:{port}/wall.html", wait_until="load"); pg.wait_for_timeout(1500)
        hrefs = pg.evaluate("() => [...document.querySelectorAll('a[href],[data-go]')].map(a => a.getAttribute('href') || a.getAttribute('data-go'))"); b.close()
    boards = sorted({h.split("#")[0].split("?")[0] for h in hrefs if h and re.match(r"^[\w./-]+\.html", h) and not h.startswith("http")} - {"wall.html"})
    import os
    pages = (["wall.html"] + boards + ["kid-harris.html", "kid-hayes.html", "kid-ainsley.html"]) if not os.environ.get("SPACE_PAGES") else os.environ["SPACE_PAGES"].split(",")
    pages = list(dict.fromkeys(pages))  # the wall now links the kid boards itself: count each page once
    jobs = [(pg_, st, vp, port) for pg_ in pages for st in STATES for vp in VPS]
    print(f"clock {CLOCK_NOW} (real data) · {len(pages)} pages x {len(STATES)} states x {len(VPS)} vps = {len(jobs)} renders; boards: {boards}", flush=True)
    with Pool(5) as pool: res = pool.map(job, jobs, chunksize=4)
    srv.terminate()
    json.dump(res, open(OUT / "space.json", "w"), indent=1)
    summ = {}
    for r in res:
        if r["state"].endswith("-FIXTURE"): continue  # fixtures never count
        k = r["vp"]; d = summ.setdefault(k, {"renders": 0, "fail": 0, "wall_fail": 0, "errors": 0})
        d["renders"] += 1; d["errors"] += bool(r.get("error")); f = bool(r.get("fails")) or bool(r.get("error")); d["fail"] += f; d["wall_fail"] += f and r["page"] == "wall.html"
    print(json.dumps(summ))
