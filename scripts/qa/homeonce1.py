"""HOMEONCE1 · pointerup then click on Home must start exactly one navigation.
   On 6bf26fb9 pointerup assigns and the click's default follows the anchor too."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw

ROOT = Path(__file__).resolve().parents[2]
PAGE = b"""<!doctype html><meta charset=utf-8><title>home</title>
<a class="wardos-home" href="sheet-index.html">Home</a>
<script src="house-home.js"></script>
"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/homeonce.html"):
            body = PAGE
            kind = "text/html"
        else:
            rel = path.lstrip("/")
            file = (ROOT / rel).resolve()
            if not str(file).startswith(str(ROOT.resolve())) or not file.is_file():
                self.send_error(404)
                return
            body = file.read_bytes()
            kind = "text/javascript" if file.suffix == ".js" else "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d/homeonce.html" % httpd.server_address[1]
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, headless=True))
        page = browser.new_page()
        page.goto(base, wait_until="load", timeout=30000)
        page.wait_for_function("() => document.querySelector('a[data-home-armed=\"1\"]')", timeout=8000)
        result = page.evaluate("""() => {
          const el = document.querySelector('a[data-kw-home]');
          const up = new PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: 'mouse' });
          el.dispatchEvent(up);
          let clickPrevented = null;
          el.addEventListener('click', function (ev) { clickPrevented = ev.defaultPrevented; });
          const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
          el.dispatchEvent(click);
          /* pointerup's go() is the one assign. A click that is not cancelled follows the anchor too. */
          const fromPointer = up.defaultPrevented ? 1 : 0;
          const fromClick = clickPrevented ? 0 : 1;
          return { pointerPrevented: up.defaultPrevented, clickPrevented: clickPrevented, navs: fromPointer + fromClick };
        }""")
        browser.close()
    httpd.shutdown()
    print(json.dumps(result))


if __name__ == "__main__":
    main()
