"""Kid boards must not render another kid's name, asset, or marker.
   Fresh profile, then the same profile after the other boards, so a stale cache shows up.
"""
import functools, json, os, sys, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
KIDS = ("ainsley", "hayes", "harris")
MARK = {"ainsley": "record", "hayes": "chest", "harris": "ore"}

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d/" % srv.server_address[1]

PROBE = r"""(kid) => {
  const others = ['ainsley', 'hayes', 'harris'].filter(k => k !== kid);
  const names = { ainsley: 'Ainsley', hayes: 'Hayes', harris: 'Harris' };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    let n = el;
    while (n && n.nodeType === 1) {
      const c = getComputedStyle(n);
      if (c.display === 'none' || c.visibility === 'hidden') return false;
      n = n.parentElement;
    }
    return true;
  };
  const text = [...document.querySelectorAll('body *')].filter(vis).map(el => (el.innerText || '')).join('\n');
  const urls = [];
  for (const el of document.querySelectorAll('img, source, [style]')) {
    const src = el.getAttribute('src') || '';
    const bg = getComputedStyle(el).backgroundImage || '';
    if (src) urls.push(src);
    if (bg && bg !== 'none') urls.push(bg);
  }
  const attrs = [];
  for (const el of document.querySelectorAll('[data-kid], [data-theme], [data-marker], [data-check], [data-quest-id]')) {
    for (const a of el.attributes) if (a.name.startsWith('data-')) attrs.push(a.value);
  }
  const bad = [];
  const blob = text + '\n' + urls.join('\n') + '\n' + attrs.join('\n');
  for (const other of others) {
    if (blob.toLowerCase().indexOf(other) >= 0) bad.push(other);
    if (text.indexOf(names[other]) >= 0) bad.push(names[other]);
  }
  return {
    kid: document.body.getAttribute('data-kid'),
    theme: document.body.getAttribute('data-theme'),
    marker: (document.querySelector('.kw-canvas') || {}).getAttribute ? document.querySelector('.kw-canvas').getAttribute('data-marker') : '',
    jar: ((document.querySelector('.je-jar-cv') || {}).getAttribute && document.querySelector('.je-jar-cv').getAttribute('aria-label')) || '',
    bad: [...new Set(bad)]
  };
}"""

SEED = """() => {
  try {
    localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000');
    localStorage.setItem('house-saves:v1', JSON.stringify({
      ainsley: [{ id: 'vinyl-1', name: 'Vinyl', need: 1, created: 1 }],
      hayes: [{ id: 'blocks-1', name: 'Blocks', need: 1, created: 1 }],
      harris: [{ id: 'truck-1', name: 'Truck', need: 1, created: 1 }]
    }));
  } catch (e) {}
}"""
PIXEL = r"""() => {
  const cv = document.querySelector('canvas.kw-canvas');
  if (!cv) return { missing: true };
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { missing: true };
  const w = cv.width, h = cv.height;
  let best = { n: 0, sat: -1, r: 0, g: 0, b: 0 };
  try {
    for (let gy = Math.floor(h * 0.35); gy < h * 0.86; gy += 40) {
      for (let gx = Math.floor(w * 0.12); gx < w * 0.78; gx += 40) {
        const d = ctx.getImageData(gx, gy, 32, 32).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 40) continue;
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
        if (n < 40) continue;
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (sat > best.sat) best = { n, sat, r, g, b };
      }
    }
  } catch (e) { return { tainted: true, error: String(e).slice(0, 120) }; }
  best.w = w; best.h = h;
  return best;
}"""

def read_board(page, kid):
    page.goto(BASE + "kid-%s.html?now=2026-11-10T12:30:00-06:00&freeze=1&audit=1" % kid, wait_until="load", timeout=60000)
    page.wait_for_timeout(1800)
    row = page.evaluate(PROBE, kid)
    row["pixel"] = page.evaluate(PIXEL)
    return row

def main():
    out = {"fresh": {}, "stale": {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, args=["--no-sandbox", "--disable-dev-shm-usage"]))
        for kid in KIDS:
            ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
            page = ctx.new_page()
            out["fresh"][kid] = read_board(page, kid)
            ctx.close()
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
        ctx.add_init_script(SEED)
        page = ctx.new_page()
        for kid in ("ainsley", "hayes", "harris", "hayes"):
            out["stale"][kid] = read_board(page, kid)
        out["pixels"] = {
            "ainsley": out["stale"]["ainsley"]["pixel"],
            "hayesFirst": None,
            "hayesAfter": out["stale"]["hayes"]["pixel"],
        }
        ctx.close()
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
        ctx.add_init_script(SEED)
        page = ctx.new_page()
        out["pixels"]["hayesFirst"] = read_board(page, "hayes")["pixel"]
        ctx.close()
        browser.close()
    srv.shutdown()
    print(json.dumps(out))

if __name__ == "__main__":
    main()
