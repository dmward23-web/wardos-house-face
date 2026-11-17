#!/usr/bin/env python3
"""Hub click and touch proof at 1920x1080@1, plus offline copy count.
Writes artifacts/acer-r36/hub-nav-proof.json and hub-nav-proof.log.
"""
import json, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PREFIX = "/dmward23-web/wardos-house-face/dda6a552"
OUT = Path("/opt/cursor/artifacts/acer-r36")
KIDS = [
    ("a.tile.ainsley", "kid-ainsley.html"),
    ("a.tile.hayes", "kid-hayes.html"),
    ("a.tile.harris", "kid-harris.html"),
    ("a.tile.dan", "sheet-today.html"),
]


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = unquote(self.path.split("?")[0])
        if path.startswith(PREFIX):
            path = path[len(PREFIX):] or "/"
        if path.endswith("/"):
            path += "index.html"
        f = ROOT / path.lstrip("/")
        if not f.is_file():
            self.send_response(404)
            self.end_headers()
            return
        data = f.read_bytes()
        ctype = {".html": "text/html", ".js": "text/javascript", ".css": "text/css"}.get(f.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def serve():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d" % httpd.server_address[1]


def hit(page, sel):
    return page.evaluate("""(sel) => {
      const a = document.querySelector(sel);
      if (!a) return { ok: false, why: 'missing' };
      const r = a.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return {
        ok: true, x, y, href: a.getAttribute('href') || '',
        topTag: top && top.tagName,
        topClass: top && (top.className && top.className.baseVal || top.className || ''),
        topIsAnchor: top === a,
        inside: !!(top && a.contains(top))
      };
    }""", sel)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    httpd, origin = serve()
    log = []
    rows = []
    offline = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(**launch_kw(p, args=["--no-sandbox", "--disable-dev-shm-usage"]))
            for label, prefix in (("local", ""), ("prefixed", PREFIX)):
                for gesture in ("click", "touch"):
                    ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1, has_touch=True)
                    page = ctx.new_page()
                    hub = origin + prefix + "/sheet-index.html"
                    page.goto(hub, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_function("() => !document.querySelector('.ori-iris')", timeout=4000)
                    page.wait_for_timeout(200)
                    nav = page.evaluate("""() => [...document.querySelectorAll('.hub-launch a')].map(a => ({
                      href: a.getAttribute('href'), text: (a.textContent || '').trim()
                    }))""")
                    targets = list(KIDS) + [(".hub-launch a[href='%s']" % n["href"], n["href"].split("?")[0]) for n in nav]
                    for sel, expect in targets:
                        info = hit(page, sel)
                        landed = ""
                        err = ""
                        t0 = time.time()
                        try:
                            if gesture == "touch":
                                page.touchscreen.tap(info["x"], info["y"])
                            else:
                                page.mouse.click(info["x"], info["y"])
                            page.wait_for_url("**/" + expect.split("?")[0].split("/")[-1] + "*", timeout=2000, wait_until="commit")
                            landed = page.url
                        except Exception as e:
                            err = str(e).split("\n")[0][:180]
                            landed = page.url
                        ms = int((time.time() - t0) * 1000)
                        ok = expect.split("?")[0] in landed and info.get("inside") and ms <= 2000
                        row = {"origin": label, "gesture": gesture, "sel": sel, "expect": expect, "hit": info, "landed": landed, "ms": ms, "ok": ok, "err": err}
                        rows.append(row)
                        log.append("%s %s %s -> %s in %dms inside=%s topAnchor=%s %s" % (
                            label, gesture, expect, "OK" if ok else "FAIL", ms, info.get("inside"), info.get("topIsAnchor"), err))
                        page.goto(hub, wait_until="domcontentloaded", timeout=30000)
                        page.wait_for_function("() => !document.querySelector('.ori-iris')", timeout=4000)
                    ctx.close()
            off = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            op = off.new_page()
            for kid in ("hayes", "harris", "ainsley"):
                op.goto(origin + "/kid-%s.html?pfOffline=1" % kid, wait_until="domcontentloaded", timeout=30000)
                op.wait_for_timeout(1200)
                count = op.evaluate("""() => {
                  const nodes = [...document.querySelectorAll('button, a, [role=button]')];
                  return nodes.filter(n => {
                    const t = (n.textContent || '');
                    if (t.indexOf('Schedule not loaded') < 0) return false;
                    const r = n.getBoundingClientRect();
                    const cs = getComputedStyle(n);
                    return r.width >= 64 && r.height >= 64 && cs.visibility !== 'hidden' && cs.display !== 'none' && !n.hidden;
                  }).length;
                }""")
                offline.append({"kid": kid, "visible": count})
                log.append("offline %s visible=%s" % (kid, count))
            browser.close()
    finally:
        httpd.shutdown()
    proof = {"rows": rows, "offline": offline, "pass": all(r["ok"] for r in rows) and all(o["visible"] == 1 for o in offline)}
    (OUT / "hub-nav-proof.json").write_text(json.dumps(proof, indent=2))
    (OUT / "hub-nav-proof.log").write_text("\n".join(log) + "\n")
    print(json.dumps({"pass": proof["pass"], "n": len(rows), "fail": [r for r in rows if not r["ok"]][:6], "offline": offline}))


if __name__ == "__main__":
    main()
