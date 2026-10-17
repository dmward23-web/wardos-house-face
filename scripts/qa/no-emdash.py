"""NODASH2 (NODATA3, Alfred 10/16): no em dash on the face, on the wall AND on the phone.
Extends NODASH1 (scripts/wall/no-emdash.py, wall 1920x1080 only) to phone viewports. Renders wall.html, every board it
reaches, the kid boards and the House hub (sheet-index.html) at each viewport on the data in the given root, and fails on
any em dash (U+2014) in visible rendered text (aria labels, titles and SVG defs are not the face). Arrows (U+2192 etc.)
in calendar-fed text are reported as WARN lines (static UI arrows exist by design), never a fail.
Read-only, local only (every non-local request is aborted).
Usage: python3 scripts/qa/no-emdash.py [root] [--vps 1920x1080,440x956,390x844]   env CLOCK=<iso> pins the clock (default now, CT)"""
import sys, re, os, socket, subprocess, time, datetime
from pathlib import Path
args = [a for a in sys.argv[1:] if not a.startswith("--") and not re.match(r"^\d+x\d+(,\d+x\d+)*$", a)]
WT = Path(args[0] if args else Path(__file__).resolve().parents[2]).resolve()
vps = "1920x1080,440x956"
if "--vps" in sys.argv: vps = sys.argv[sys.argv.index("--vps") + 1]
VPS = [tuple(map(int, v.split("x"))) for v in vps.split(",")]
CLOCK = os.environ.get("CLOCK") or datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).replace(microsecond=0).isoformat()
JS = r"""(ch) => { const out = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  const vis = e => { for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05 || a.hidden) return false; } return true; };
  while ((n = tw.nextNode())) { const t = n.nodeValue; if (!ch.some(c => t.includes(c)) || !n.parentElement || n.parentElement.closest('defs,symbol,template,script,style,noscript')) continue;
    if (!vis(n.parentElement)) continue; const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue;
    const p = n.parentElement; out.push((p.id ? '#' + p.id : p.tagName.toLowerCase() + '.' + String(p.className).split(' ')[0]) + ': ' + t.trim().slice(0, 70)); }
  return out; }"""
def main():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "-d", str(WT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    base = f"http://127.0.0.1:{port}/"; bad = 0; warn = 0
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch()
            for W, H in VPS:
                mob = W < 600
                ctx = b.new_context(viewport={"width": W, "height": H}, reduced_motion="reduce", is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
                ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(base) and r.request.method in ("GET", "HEAD") else r.abort())
                pg = ctx.new_page(); pg.clock.install(time=CLOCK); pg.goto(base + "wall.html", wait_until="load"); pg.wait_for_timeout(1500)
                hrefs = pg.evaluate("() => [...document.querySelectorAll('a[href],[data-go]')].map(a => a.getAttribute('href') || a.getAttribute('data-go'))"); pg.close()
                boards = sorted({h.split("#")[0].split("?")[0] for h in hrefs if h and re.match(r"^[\w./-]+\.html", h)} - {"wall.html"})
                pages = list(dict.fromkeys(["wall.html", "sheet-index.html"] + boards + ["kid-harris.html", "kid-hayes.html", "kid-ainsley.html"]))
                for page in pages:
                    if not (WT / page).exists(): continue
                    pg = ctx.new_page(); pg.clock.install(time=CLOCK)
                    try:
                        pg.goto(base + page, wait_until="load", timeout=120000); pg.wait_for_timeout(2500)
                        try: pg.clock.run_for(1500)
                        except Exception: pass
                        hits = pg.evaluate(JS, ["\u2014"]); arrows = pg.evaluate(JS, ["\u2192", "\u21d2", "\u27a1"])
                    except Exception as e:
                        hits, arrows = ["ERROR (page did not load: " + str(e).splitlines()[0][:80] + ")"], []
                    pg.close()
                    print(("FAIL " if hits else "PASS ") + f"{W}x{H} " + page + (": " + " | ".join(hits[:6]) if hits else ""), flush=True)
                    if arrows: print(f"WARN {W}x{H} {page} arrows: " + " | ".join(arrows[:6])); warn += 1
                    bad += bool(hits)
                ctx.close()
            b.close()
    finally: srv.terminate()
    print(f"NO EM DASH {'FAIL' if bad else 'PASS'} · {vps} · clock {CLOCK} · {bad} page-view(s) with an em dash on the face · {warn} with arrows (warn)")
    sys.exit(1 if bad else 0)
if __name__ == "__main__": main()
