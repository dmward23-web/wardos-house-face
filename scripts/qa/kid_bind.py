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

def read_board(page, kid):
    page.goto(BASE + "kid-%s.html?now=2026-11-10T12:30:00-06:00&freeze=1" % kid, wait_until="load", timeout=60000)
    page.wait_for_timeout(1800)
    return page.evaluate(PROBE, kid)

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
        page = ctx.new_page()
        for kid in ("ainsley", "hayes", "harris", "ainsley", "hayes", "harris"):
            out["stale"][kid] = read_board(page, kid)
        ctx.close()
        browser.close()
    srv.shutdown()
    print(json.dumps(out))

if __name__ == "__main__":
    main()
