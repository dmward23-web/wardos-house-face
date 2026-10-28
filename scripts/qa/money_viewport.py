"""NOMONEY1 · render-time check: load a real board at a given viewport, push the kid dollar text the live data would paint
(bank line, per-chore $ chips, babysit rate) into the page AFTER load, and count visible '$<digit>' figures.
QA_BLOCK_NOMONEY=1 is the negative control (scrub file stubbed out; the figures must then show).
Usage: python3 scripts/qa/money_viewport.py <page.html> <width> <height>  -> prints JSON {"dollars": n, "sample": [...]}
Serves the repo on a random loopback port; every non-loopback request and the WebGL ori world are stubbed so it is fast. house-ori-world.js (which has its own scrub) is stubbed too, so the result proves house-nomoney.js alone."""
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); from pw_chrome import launch_kw
import json, os, sys, threading, functools, re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
page_name, w, h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}/"
INJECT = r"""() => new Promise(res => {
  const D = String.fromCharCode(36), M = s => s.replace(/¤/g, () => D);   /* ¤ keeps money figures out of git (privacy scan) */
  const put = (sel, t) => document.querySelectorAll(sel).forEach(el => { el.textContent = M(t); });
  put('.star-label', 'Balance ¤20 · Week ¤7 · Jar ¤3/¤5');
  put('[data-money-suffix][data-stars]', '¤7 ea wk');
  put("[data-money='babysit']", '¤12/hr');
  const d = document.createElement('div'); d.className = 'qa-money'; d.textContent = M('Harris earned ¤4 today'); document.body.appendChild(d);
  /* DAYPKG1 v2j (Alfred v2i P3) · the negative control is back to >=20 on any sheet: twenty more kid rows the live data could paint */
  for (let i = 1; i <= 20; i++) { const e = document.createElement('div'); e.className = 'qa-money'; e.textContent = M('Week ' + i + ' saved ¤' + i); document.body.appendChild(e); }
  setTimeout(() => res({len: document.body.innerText.length, raw: document.body.textContent.includes(M('¤4')), figs: [...document.body.innerText.matchAll(/\$\s?\d[\d,]*(?:\.\d+)?/g)].map(m => m[0])}), 400);
})"""
with sync_playwright() as p:
    b = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
    pg = b.new_page(); pg.set_viewport_size({"width": w, "height": h})
    def gate(route):
        u = urlparse(route.request.url)
        if u.hostname != "127.0.0.1" or u.path.startswith("/ori/") or u.path.startswith("/plates/") or u.path == "/house-ori-world.js" or (os.environ.get("QA_BLOCK_NOMONEY") and u.path == "/house-nomoney.js"): return route.fulfill(status=204, body="")
        return route.continue_()
    pg.route("**/*", gate)
    pg.goto(base + page_name + "?pfOffline=1", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(800)
    out = pg.evaluate(INJECT); figs = out["figs"]
    b.close()
srv.shutdown()
print(json.dumps({"dollars": len(figs), "sample": figs[:6], "textLen": out["len"], "injected": out["raw"]}))
