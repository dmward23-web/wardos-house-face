"""CLIP1 (Dan 10/2, live preview: 'Temperature Auto · 65 to', 'Ends on the boa', 'Ligh' / 'Di' cut at a tile edge).
RULE: no words may be clipped or truncated anywhere on the wall or a board. Renders the wall and every board it
reaches (plus the kid boards) on the REAL data at the CURRENT clock at the five gate viewports and fails on any
visible element with words where:
  WIDE    scrollWidth > clientWidth + 1 and its words' rects run past its own box (a ring drawn outside is not words)
  TALL    scrollHeight > clientHeight + 1 on a box that clips (overflow not visible: a fixed-height text box)
  ELLIPSIS text-overflow ellipsis / clip that is actually cutting words (overflow not visible and wider than the box)
  CLAMP   a line-clamp that is hiding lines
  CUT     a painted word rect that runs past an ancestor with overflow hidden / clip (any side), or past a
          scrolling ancestor sideways
  EDGE    a painted word rect that runs off the window's left / right edge (the page is wider than the screen)
Skipped: hidden / transparent elements, SVG defs, templates, screen-reader-only boxes (clip box 2px or less),
words fully outside the viewport (page scroll is not clipping).
--minfont N also renders as a browser with a minimum font size of N px does (Dan's live preview showed the small
labels drawn larger than designed: 'Temperature Auto · 65 to', 'Ends on the boa', 'Ligh' / 'Di'): every word drawn
smaller than N px on screen (after the board's zoom) is drawn at N, then the same checks run. The gate runs both (plain and --minfont 14).
Usage: python3 scripts/wall/clip-scan.py [worktree] [--pages a.html,...] [--vps 1920x1080,...] [--minfont 14] [--json out.json]"""
import sys, re, json, socket, subprocess, time, datetime
from pathlib import Path
from multiprocessing import Pool
args = [a for i, a in enumerate(sys.argv[1:]) if not a.startswith("--") and not sys.argv[i].startswith("--")]  # skip option values
def opt(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
WT = Path(args[0] if args else Path(__file__).resolve().parents[2]).resolve()
VPS = [tuple(map(int, v.split("x"))) for v in opt("--vps", "2560x1440,1920x1080,1536x730,1366x768,1280x650").split(",")]
MINFONT = float(opt("--minfont", "0") or 0)
MINJS = r"""(m) => { const zm = e => { let z = 1; for (let a = e; a; a = a.parentElement) z *= parseFloat(getComputedStyle(a).zoom) || 1; return z; };
 const L = []; for (const e of document.querySelectorAll('body *')) { const f = parseFloat(getComputedStyle(e).fontSize), z = zm(e); if (f && f * z < m) L.push([e, m / z]); }
 for (const [e, f] of L) e.style.setProperty('font-size', f.toFixed(2) + 'px', 'important'); return L.length; }"""
CLOCK = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).replace(microsecond=0).isoformat()
JS = r"""() => {
 const H = innerHeight, W = innerWidth, out = [];
 const vis = e => { for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05 || a.hidden) return false; } return true; };
 const sel = e => { let s = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''); const t = e.closest('[data-tile-id],[data-tile],[id]'); if (t && t !== e) s = (t.getAttribute('data-tile-id') || t.getAttribute('data-tile') || '#' + t.id) + ' > ' + s; return s; };
 const words = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
 const srOnly = e => { const r = e.getBoundingClientRect(); return r.width <= 2 || r.height <= 2; };
 const ownText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
 const inView = r => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
 const seen = new Set();
 const add = (k, e, why) => { const key = k + '|' + sel(e); if (seen.has(key)) return; seen.add(key); out.push(k + ' "' + words(e).slice(0, 48) + '" in ' + sel(e) + (why ? ' (' + why + ')' : '')); };
 /* the words themselves must run past the box: a ring or glow drawn outside it (::before inset -7px) is not clipping */
 const textPast = (e, axis) => { const b = e.getBoundingClientRect(), tw0 = document.createTreeWalker(e, 4), r0 = document.createRange(); let t;
   while ((t = tw0.nextNode())) { if (!t.nodeValue.trim() || !t.parentElement || !vis(t.parentElement)) continue; r0.selectNodeContents(t);
     for (const q of r0.getClientRects()) { if (q.width < 1 || q.height < 1) continue;
       if (axis === 'x' ? (q.right > b.right + 1.5 || q.left < b.left - 1.5) : (q.bottom > b.bottom + 1.5 || q.top < b.top - 1.5)) return true; } }
   return false; };
 for (const e of document.body.querySelectorAll('*')) {
   if (e.closest('svg,defs,symbol,template,script,style,noscript,select,option')) continue;
   if (!e.clientWidth && !e.clientHeight) continue;
   const r = e.getBoundingClientRect(); if (!inView(r)) continue;
   if (!words(e)) continue;
   if (!vis(e) || srOnly(e)) continue;
   const c = getComputedStyle(e), clipsX = c.overflowX !== 'visible', clipsY = c.overflowY !== 'visible';
   const sw = e.scrollWidth - e.clientWidth, sh = e.scrollHeight - e.clientHeight;
   if (c.webkitLineClamp && c.webkitLineClamp !== 'none' && sh > 1) { add('CLAMP', e, 'line-clamp ' + c.webkitLineClamp); continue; }
   if (sw > 1 && clipsX && (c.textOverflow === 'ellipsis' || ownText(e))) { add('ELLIPSIS', e, 'text-overflow ' + c.textOverflow + ', ' + sw + 'px cut'); continue; }
   if (sw > 1 && (ownText(e) || clipsX) && textPast(e, 'x')) { add('WIDE', e, sw + 'px past its box'); continue; }
   if (sh > 1 && clipsY && c.overflowY !== 'auto' && c.overflowY !== 'scroll' && textPast(e, 'y')) { add('TALL', e, sh + 'px cut at the bottom'); continue; }
 }
 /* CUT: painted word rects past a clipping ancestor */
 const tw = document.createTreeWalker(document.body, 4); let n; const rg = document.createRange(); const anc = new Map();
 const clipAnc = p => { if (anc.has(p)) return anc.get(p); const L = []; for (let a = p; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); const hx = c.overflowX === 'hidden' || c.overflowX === 'clip', hy = c.overflowY === 'hidden' || c.overflowY === 'clip', sx = c.overflowX === 'auto' || c.overflowX === 'scroll'; if (hx || hy || sx) { const q = a.getBoundingClientRect(), kx = a.offsetWidth ? q.width / a.offsetWidth : 1, ky = a.offsetHeight ? q.height / a.offsetHeight : 1; /* zoomed boxes: client* are unzoomed px */ if (q.width > 2 && q.height > 2) L.push({ a, hx: hx || sx, hy, l: q.left + a.clientLeft * kx, t: q.top + a.clientTop * ky, r: q.left + (a.clientLeft + a.clientWidth) * kx, b: q.top + (a.clientTop + a.clientHeight) * ky }); } } anc.set(p, L); return L; };
 while ((n = tw.nextNode())) {
   const s = n.nodeValue.trim(), p = n.parentElement; if (!s || !p || p.closest('svg,defs,symbol,template,script,style,noscript,select,option') || !vis(p) || srOnly(p)) continue;
   rg.selectNodeContents(n);
   for (const q of rg.getClientRects()) {
     if (q.width < 1 || q.height < 1 || !inView(q)) continue;
     if (q.right > W + 1.5 || q.left < -1.5) { const key = 'EDGE|' + sel(p); if (!seen.has(key)) { seen.add(key); out.push('EDGE "' + s.slice(0, 48) + '" in ' + sel(p) + ' (runs off the window ' + (q.right > W ? 'right' : 'left') + ' edge by ' + Math.round(q.right > W ? q.right - W : -q.left) + 'px)'); } continue; }
     for (const k of clipAnc(p)) {
       const cx = k.hx && (q.right > k.r + 1.5 || q.left < k.l - 1.5), cy = k.hy && (q.bottom > k.b + 1.5 || q.top < k.t - 1.5);
       if (cx || cy) { const key = 'CUT|' + sel(p); if (!seen.has(key)) { seen.add(key); out.push('CUT "' + s.slice(0, 48) + '" in ' + sel(p) + ' (past ' + sel(k.a) + (cx ? ' sideways' : ' top/bottom') + ')'); } break; }
     }
   }
 }
 return out;
}"""
def job(a):
    page, (W, H), port = a
    from playwright.sync_api import sync_playwright
    base = f"http://127.0.0.1:{port}/"
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": W, "height": H}, reduced_motion="reduce")
        ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(base) and r.request.method in ("GET", "HEAD") else r.abort())
        pg = ctx.new_page()
        try:
            pg.clock.install(time=CLOCK); pg.goto(base + page, wait_until="load", timeout=30000); pg.wait_for_timeout(1800)
            try: pg.clock.run_for(1500)
            except Exception: pass
            if MINFONT:
                pg.evaluate(MINJS, MINFONT); pg.wait_for_timeout(400)
                try: pg.clock.run_for(800)
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
                b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1920, "height": 1080})
                pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith(f"http://127.0.0.1:{port}/") else r.abort())
                pg.goto(f"http://127.0.0.1:{port}/wall.html", wait_until="load"); pg.wait_for_timeout(1500)
                try: pg.wait_for_function("() => document.querySelectorAll('a[href*=\".html\"],[data-go*=\".html\"]').length > 10", timeout=15000)
                except Exception: pass
                hrefs = pg.evaluate("() => [...document.querySelectorAll('a[href],[data-go]')].map(a => a.getAttribute('href') || a.getAttribute('data-go'))"); b.close()
            boards = sorted({h.split("#")[0].split("?")[0] for h in hrefs if h and re.match(r"^[\w./-]+\.html", h)} - {"wall.html"})
            pages = list(dict.fromkeys(["wall.html"] + boards + ["kid-harris.html", "kid-hayes.html", "kid-ainsley.html"]))
        if len(pages) < 10: print(f"CLIP SCAN FAIL · page discovery found only {len(pages)} page(s): {pages}"); sys.exit(2)
        print(f"pages ({len(pages)}): {' '.join(pages)}", flush=True)
        with Pool(5) as pool: res = pool.map(job, [(pg_, vp, port) for pg_ in pages for vp in VPS], chunksize=3)
    finally: srv.terminate()
    bad = 0; total = 0
    for page, vp, o in res:
        if o: bad += 1; total += len(o); print(f"FAIL {page} {vp} ({len(o)})"); [print("     " + x) for x in o[:12]]
    if opt("--json"): Path(opt("--json")).write_text(json.dumps([{"page": a, "vp": b, "clips": c} for a, b, c in res], indent=1))
    print(f"CLIP SCAN {'FAIL' if bad else 'PASS'} · clock {CLOCK} (real data){' · min font ' + str(int(MINFONT)) + 'px' if MINFONT else ''} · {len(res) - bad}/{len(res)} renders clean · {total} clipped element(s)")
    sys.exit(1 if bad else 0)
