"""OVERLAP1 (Dan 10/2: overlapping text is a real bug). Renders every House Face board (every page the wall
reaches, plus the kid boards) on the REAL data at the CURRENT clock at the five gate viewports and fails on:
  OVER  two lines of visible words drawn over each other (>30% of the smaller line), from different elements
  OUT   visible words spilling past the edge of their own placed card (landscape pack mode)
  SIDEWAYS  the page scrolls sideways
Only what is actually painted counts: words clipped by an overflow:hidden box (an ellipsis line) are measured
as clipped; SVG defs, templates and hidden / transparent elements are skipped.
Usage: python3 scripts/wall/overlap-scan.py [worktree] [--pages a.html,b.html] [--vps 1920x1080,...] [--kidvps 390x844]
KIDPAGES1: kid-*.html pages also run at the phone portrait 440x956 (iPhone 17 Pro Max, mobile, 3x, touch);
--kidvps adds more phone sizes (e.g. 390x844) to the kid pages only."""
import sys, re, json, socket, subprocess, time, datetime
from pathlib import Path
from multiprocessing import Pool
args = [a for a in sys.argv[1:] if not a.startswith("--")]
def opt(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
WT = Path(args[0] if args else Path(__file__).resolve().parents[2]).resolve()
VPS = [tuple(map(int, v.split("x"))) for v in opt("--vps", "1280x650,1366x768,1536x730,1920x1080,2560x1440").split(",")]
KIDVPS = [tuple(map(int, v.split("x"))) for v in ("440x956," + opt("--kidvps", "")).strip(",").split(",") if v]
CLOCK = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).replace(microsecond=0).isoformat()
JS = r"""() => {
 const H = innerHeight, W = innerWidth, bx = [];
 const vis = e => { for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05 || a.hidden) return false; } return true; };
 const clipOf = e => { let l = -1e9, t = -1e9, r = 1e9, b = 1e9; for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.overflowX !== 'visible' || c.overflowY !== 'visible') { const q = a.getBoundingClientRect(); l = Math.max(l, q.left); t = Math.max(t, q.top); r = Math.min(r, q.right); b = Math.min(b, q.bottom); } } return { l, t, r, b }; };
 const tw = document.createTreeWalker(document.body, 4); let n; const rg = document.createRange(); const clips = new Map();
 while ((n = tw.nextNode())) { const s = n.nodeValue.trim(); const p = n.parentElement; if (!s || !p || p.closest('defs,symbol,template,script,style,noscript') || !vis(p)) continue;
   let c = clips.get(p); if (!c) { c = clipOf(p); clips.set(p, c); }
   rg.selectNodeContents(n); const card = p.closest('[data-ls-placed]');
   for (const q of rg.getClientRects()) { const r = { left: Math.max(q.left, c.l), top: Math.max(q.top, c.t), right: Math.min(q.right, c.r), bottom: Math.min(q.bottom, c.b) };
     r.width = r.right - r.left; r.height = r.bottom - r.top; if (r.width <= 1 || r.height <= 1 || r.bottom < 0 || r.top > H) continue; bx.push({ s: s.slice(0, 28), p, r, card }); } }
 const out = [];
 for (const b of bx) { if (!b.card) continue; const c = b.card.getBoundingClientRect(); if (b.r.bottom > c.bottom + 3 || b.r.right > c.right + 3 || b.r.left < c.left - 3 || b.r.top < c.top - 3) out.push('OUT "' + b.s + '" of ' + (b.card.id || String(b.card.className).split(' ')[0])); }
 for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) { const A = bx[i], B = bx[j]; if (A.p === B.p || A.p.contains(B.p) || B.p.contains(A.p)) continue; const a = A.r, b = B.r;
   const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
   if (ix > 3 && iy > 3 && ix * iy > 0.3 * Math.min(a.width * a.height, b.width * b.height)) out.push('OVER "' + A.s + '" x "' + B.s + '"'); }
 if (document.documentElement.scrollWidth > W + 2) out.push('SIDEWAYS ' + (document.documentElement.scrollWidth - W) + 'px');
 return [...new Set(out)];
}"""
def job(a):
    page, (W, H), port = a
    from playwright.sync_api import sync_playwright
    base = f"http://127.0.0.1:{port}/"
    with sync_playwright() as p:
        mob = W < 600
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": W, "height": H}, reduced_motion="reduce",
                                                     **({"device_scale_factor": 3, "is_mobile": True, "has_touch": True, "screen": {"width": W, "height": H}} if mob else {}))
        ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(base) and r.request.method in ("GET", "HEAD") else r.abort())
        pg = ctx.new_page()
        try:
            pg.clock.install(time=CLOCK); pg.goto(base + page, wait_until="load", timeout=30000); pg.wait_for_timeout(1800)
            try: pg.clock.run_for(1500)
            except Exception: pass
            o = pg.evaluate(JS)
        except Exception as e: o = ["ERROR " + str(e)[:120]]
        b.close(); return (page, f"{W}x{H}", o)
if __name__ == "__main__":
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "-d", str(WT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        if opt("--pages"): pages = opt("--pages").split(",")
        else:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1920, "height": 1080}); pg.goto(f"http://127.0.0.1:{port}/wall.html", wait_until="load"); pg.wait_for_timeout(1500)
                hrefs = pg.evaluate("() => [...document.querySelectorAll('a[href],[data-go]')].map(a => a.getAttribute('href') || a.getAttribute('data-go'))"); b.close()
            boards = sorted({h.split("#")[0].split("?")[0] for h in hrefs if h and re.match(r"^[\w./-]+\.html", h)} - {"wall.html"})
            pages = list(dict.fromkeys(["wall.html"] + boards + ["kid-harris.html", "kid-hayes.html", "kid-ainsley.html"]))
        with Pool(5) as pool: res = pool.map(job, [(pg_, vp, port) for pg_ in pages for vp in (VPS + KIDVPS if re.match(r"kid-[a-z]+\.html$", pg_) else VPS)], chunksize=3)
    finally: srv.terminate()
    bad = 0
    for page, vp, o in res:
        if o: bad += 1; print(f"FAIL {page} {vp}"); [print("     " + x) for x in o[:8]]
    print(f"OVERLAP SCAN {'FAIL' if bad else 'PASS'} · clock {CLOCK} (real data) · {len(res) - bad}/{len(res)} renders clean")
    sys.exit(1 if bad else 0)
