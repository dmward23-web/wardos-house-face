"""NODASH1 (Dan 10/2): no em dash on the face. Renders wall.html and every board it reaches (plus the kid boards) on
the REAL data at the CURRENT clock and fails on any em dash (U+2014) in visible rendered text (innerText; aria labels,
titles and SVG defs are not the face). Read-only, local only.
Usage: python3 scripts/wall/no-emdash.py [worktree] [--vp 1920x1080]"""
import sys, re, json, socket, subprocess, time, datetime
from pathlib import Path
args = [a for a in sys.argv[1:] if not a.startswith("--")]
WT = Path(args[0] if args else Path(__file__).resolve().parents[2]).resolve()
vp = "1920x1080"
if "--vp" in sys.argv: vp = sys.argv[sys.argv.index("--vp") + 1]
W, H = map(int, vp.split("x"))
CLOCK = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).replace(microsecond=0).isoformat()
JS = r"""() => { const out = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  const vis = e => { for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05 || a.hidden) return false; } return true; };
  while ((n = tw.nextNode())) { const t = n.nodeValue; if (!t.includes('\u2014') || !n.parentElement || n.parentElement.closest('defs,symbol,template,script,style,noscript')) continue;
    if (!vis(n.parentElement)) continue; const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue;
    const p = n.parentElement; out.push((p.id ? '#' + p.id : p.tagName.toLowerCase() + '.' + String(p.className).split(' ')[0]) + ': ' + t.trim().slice(0, 60)); }
  return out; }"""
def main():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "-d", str(WT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    base = f"http://127.0.0.1:{port}/"; bad = 0
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch(); ctx = b.new_context(viewport={"width": W, "height": H}, reduced_motion="reduce")
            ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(base) and r.request.method in ("GET", "HEAD") else r.abort())
            pg = ctx.new_page(); pg.clock.install(time=CLOCK); pg.goto(base + "wall.html", wait_until="load"); pg.wait_for_timeout(1500)
            hrefs = pg.evaluate("() => [...document.querySelectorAll('a[href],[data-go]')].map(a => a.getAttribute('href') || a.getAttribute('data-go'))")
            boards = sorted({h.split("#")[0].split("?")[0] for h in hrefs if h and re.match(r"^[\w./-]+\.html", h)} - {"wall.html"})
            pages = list(dict.fromkeys(["wall.html"] + boards + ["kid-harris.html", "kid-hayes.html", "kid-ainsley.html"]))
            for page in pages:
                pg = ctx.new_page(); pg.clock.install(time=CLOCK)
                pg.goto(base + page, wait_until="load"); pg.wait_for_timeout(1800)
                try: pg.clock.run_for(1500)
                except Exception: pass
                hits = pg.evaluate(JS); pg.close()
                print(("FAIL " if hits else "PASS ") + page + (": " + " | ".join(hits[:6]) if hits else ""))
                bad += bool(hits)
            b.close()
    finally: srv.terminate()
    print(f"NO EM DASH {'FAIL' if bad else 'PASS'} · {vp} · clock {CLOCK} · {bad} page(s) with an em dash on the face")
    sys.exit(1 if bad else 0)
if __name__ == "__main__": main()
