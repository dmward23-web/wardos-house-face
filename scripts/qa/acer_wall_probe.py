"""One 1920x1080 measurement of sheet-index for the Acer lock. Prints one JSON line."""
import functools, json, os, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/sheet-index.html" % srv.server_address[1]
PROBE = """() => {
  const panel = document.querySelector('.panel');
  const pr = panel.getBoundingClientRect();
  const cs = getComputedStyle(panel);
  const vis = e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden' && !e.closest('[hidden]'); };
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const tiles = [...document.querySelectorAll('.tile')].filter(vis).map(el => {
    const r = el.getBoundingClientRect();
    const label = el.querySelector('.tile-label');
    return { cls: el.className, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), font: label ? parseFloat(getComputedStyle(label).fontSize) : null };
  });
  const smallText = [];
  for (const el of document.querySelectorAll('.tile-label, .tile-sub, .name-accent, .leaveby-main, .hdr-date-time')) {
    if (!vis(el)) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 24) smallText.push({ t: (el.textContent || '').trim().slice(0, 40), px });
  }
  const safe = [];
  for (const el of document.querySelectorAll('.tile-label, .name-accent, a.tile, .hub-home, button')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left < 48 || r.top < 48 || r.right > 1920 - 48 || r.bottom > 1080 - 48) {
      safe.push({ t: (el.textContent || el.getAttribute('aria-label') || el.className || '').toString().trim().slice(0, 40), l: Math.round(r.left), t0: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
    }
  }
  const smallHit = [];
  for (const el of document.querySelectorAll('a, button')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 64 || r.height < 64) smallHit.push({ t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
  }
  const home = document.querySelector('.hub-home img');
  const hr = home ? home.getBoundingClientRect() : { width: 0, height: 0 };
  const bg = getComputedStyle(document.body).backgroundSize;
  return {
    panel: { w: Math.round(pr.width), h: Math.round(pr.height), pad: cs.paddingTop, colGap: cs.columnGap, cols: cs.gridTemplateColumns },
    scroll: document.documentElement.scrollHeight,
    tiles, slots: { header: box('header.hdr'), window: box('.hub-window'), ainsley: box('.tile.ainsley'), hayes: box('.tile.hayes'), harris: box('.tile.harris'), dad: box('.tile.dan') },
    smallText, safe: safe.slice(0, 30), smallHit: smallHit.slice(0, 40), bg,
    icon: { w: Math.round(hr.width), h: Math.round(hr.height) },
    windowImg: (() => { const img = document.querySelector('.hub-window img'); if (!img) return null; const r = img.getBoundingClientRect();
      return { src: img.getAttribute('src'), naturalW: img.naturalWidth, naturalH: img.naturalHeight, cssW: Math.round(r.width), cssH: Math.round(r.height) }; })(),
    kidArt: getComputedStyle(document.querySelector('.tile.ainsley')).backgroundImage,
    dadArt: getComputedStyle(document.querySelector('.tile.dan')).backgroundImage,
    dadStage: (() => { const tile = document.querySelector('.tile.dan'), stage = document.querySelector('.tile.dan [data-dad-stage]');
      if (!tile || !stage) return null; const t = tile.getBoundingClientRect(), s = stage.getBoundingClientRect();
      return { h: Math.round(s.height), gap: Math.round(t.bottom - s.bottom) }; })()
  };
}"""
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
    ctx = b.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    pg = ctx.new_page()
    pg.goto(base, wait_until="load")
    pg.wait_for_timeout(600)
    out = pg.evaluate(PROBE)
    ctx.close(); b.close()
srv.shutdown()
print(json.dumps(out))
