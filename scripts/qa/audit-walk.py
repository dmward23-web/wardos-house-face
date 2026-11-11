"""Visit every hub route under audit=1 and count non-GET requests."""
import functools, json, os, sys, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, urljoin
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d/" % srv.server_address[1]
PORT = srv.server_address[1]

def main():
    writes = []
    pages = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        def on_req(req):
            if req.method.upper() not in ("GET", "HEAD"):
                writes.append([req.method, req.url[:140]])
        ctx.on("request", on_req)
        page = ctx.new_page()
        page.goto(BASE + "sheet-index.html?audit=1", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(800)
        hrefs = page.evaluate("""() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(Boolean)""")
        names = []
        for href in hrefs:
            path = urlparse(urljoin(BASE, href)).path.split("/")[-1]
            if path.endswith(".html") and path not in names and os.path.isfile(os.path.join(ROOT, path)):
                names.append(path)
        if "mercury-run.html" not in names:
            names.append("mercury-run.html")
        for name in names:
            rec = {"active": False}
            try:
                page.goto(BASE + name + "?audit=1", wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(400)
                rec = page.evaluate("""async () => {
                  const r = await fetch('/api/taps', { method: 'POST', body: '{}' });
                  let header = '';
                  try { header = r.headers.get('X-Wardos-Audit') || ''; } catch (e) {}
                  return {
                    active: !!(window.HouseAudit && HouseAudit.active && HouseAudit.active()),
                    status: r.status,
                    header: header,
                    attr: document.documentElement.getAttribute('data-audit')
                  };
                }""")
            except Exception as e:
                rec["err"] = str(e)[:160]
            pages[name] = rec
        browser.close()
    srv.shutdown()
    print(json.dumps({"writes": writes, "pages": pages, "count": len(pages)}))

if __name__ == "__main__":
    main()
