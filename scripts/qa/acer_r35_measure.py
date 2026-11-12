#!/usr/bin/env python3
"""1920x1080@1 checks for round 35. Prints one JSON object. Generic titles only."""
import json, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
DAY = "2026-11-10T12:30:00-06:00"
WHEN = "2026-11-10T22:30:00-06:00"
WEEK = {
    "asOfIso": "2026-11-10",
    "kids": {
        "ainsley": {"today": [{"summary": "Ainsley dentist", "what": "Ainsley dentist", "kind": "appointment", "startIso": WHEN, "when": "Tue 10 · 10:30 PM"}]},
        "dan": {"today": [{"summary": "Dad dentist", "what": "Dad dentist", "kind": "appointment", "startIso": WHEN, "when": "Tue 10 · 10:30 PM"}]},
        "hayes": {"today": [{"summary": "Appointment", "what": "Appointment", "kind": "appointment", "startIso": WHEN, "when": "Tue 10 · 10:30 PM"}]},
        "harris": {"today": [{"summary": "Session", "what": "Session", "kind": "session", "startIso": WHEN, "when": "Tue 10 · 10:30 PM"}]},
    },
}


def serve():
    class Q(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Q(*a, directory=str(ROOT), **k))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/" % httpd.server_address[1]


def main():
    httpd, base = serve()
    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(**launch_kw(p, args=["--no-sandbox", "--disable-dev-shm-usage"]))
            ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)

            def handle(route):
                url = route.request.url
                if "kids-week" in url:
                    route.fulfill(status=200, content_type="application/json", body=json.dumps(WEEK))
                    return
                if route.request.method != "GET":
                    route.fulfill(status=403, content_type="application/json", body="{}")
                    return
                route.continue_()

            ctx.route("**/*", handle)
            page = ctx.new_page()
            def arm(pg, kid):
                pg.evaluate("""(kid) => {
                  localStorage.setItem('wardos-lights-proxy-token', 'paired-test-key-value');
                  localStorage.setItem('wardos-lights-proxy', location.origin);
                  if (window.WardKids && WardKids.boot && kid) WardKids.boot(kid);
                  else if (window.WardKids && WardKids.loadJSON) {
                    WardKids.loadJSON(function (e, d) {
                      if (!d) return;
                      WardKids._data = d;
                      try { document.dispatchEvent(new CustomEvent('house:kids-data-ready', { detail: { data: d } })); } catch (err) {}
                    });
                  }
                }""", kid)
            page.goto(base + "kid-ainsley.html?now=%s&freeze=1" % DAY, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(400)
            arm(page, "ainsley")
            page.wait_for_timeout(1800)
            out["board"] = page.evaluate("""() => {
              const el = document.querySelector('#sec-days') || document.body;
              return (el.innerText || '').replace(/\\s+/g, ' ').trim();
            }""")
            page.goto(base + "sheet-index.html?now=%s&freeze=1" % DAY, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(400)
            arm(page, "")
            page.wait_for_timeout(1800)
            tiles = page.evaluate("""() => {
              const text = (sel) => {
                const el = document.querySelector(sel);
                return el ? (el.innerText || '').replace(/\\s+/g, ' ').trim() : '';
              };
              return { ainsley: text('a.tile.ainsley'), dad: text('a.tile.dan'), hayes: text('a.tile.hayes'), harris: text('a.tile.harris') };
            }""")
            out.update(tiles)
            page.goto(base + "sheet-lights.html?now=%s&freeze=1" % DAY, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1200)
            out["lights"] = page.evaluate("""() => {
              const on = document.querySelector('#lights-all-on').getBoundingClientRect();
              const off = document.querySelector('#lights-all-off').getBoundingClientRect();
              return { gap: off.left - on.right, on: on.width, off: off.width };
            }""")
            off = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)

            def missing(route):
                if route.request.method != "GET":
                    route.fulfill(status=403, content_type="application/json", body="{}")
                    return
                route.continue_()

            off.route("**/*", missing)
            op = off.new_page()
            op.goto(base + "kid-hayes.html?pfOffline=1&now=%s&freeze=1" % DAY, wait_until="domcontentloaded", timeout=30000)
            op.wait_for_timeout(1800)
            out["offline"] = op.evaluate("""() => {
              const all = [...document.querySelectorAll('button')].filter(n => (n.textContent || '').indexOf('Schedule not loaded') >= 0);
              const el = all.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
              if (!el) return { text: '', w: 0, h: 0, font: 0, tag: '' };
              const b = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              return { text: (el.textContent || '').trim(), w: b.width, h: b.height, font: parseFloat(cs.fontSize) || 0, tag: el.tagName };
            }""")
            hook = """(() => {
              const orig = CanvasRenderingContext2D.prototype.drawImage;
              window.__layerDraws = [];
              CanvasRenderingContext2D.prototype.drawImage = function (img) {
                const args = arguments;
                let dw = img && img.width, dh = img && img.height;
                if (args.length === 5) { dw = args[3]; dh = args[4]; }
                if (args.length === 9) { dw = args[7]; dh = args[8]; }
                const src = (img && (img.currentSrc || img.src)) || '';
                const canvasW = this.canvas && this.canvas.width;
                if (canvasW >= 1920 && /\\/(sky|far|mid|near|fg)\\.webp/.test(src)) {
                  window.__layerDraws.push({ src: src.split('/').slice(-3).join('/'), nw: img.naturalWidth || img.width, nh: img.naturalHeight || img.height, dw: dw, dh: dh });
                }
                return orig.apply(this, args);
              };
            })();"""
            game = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            game.add_init_script(hook)
            gp = game.new_page()
            gp.goto(base + "mercury-run.html?now=%s&freeze=1&adapt=0" % DAY, wait_until="domcontentloaded", timeout=30000)
            gp.wait_for_timeout(2500)
            out["mercury"] = gp.evaluate("() => window.__layerDraws || []")
            browser.close()
    finally:
        httpd.shutdown()
    print(json.dumps(out))


if __name__ == "__main__":
    main()
