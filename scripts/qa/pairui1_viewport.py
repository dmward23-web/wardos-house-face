"""PAIRUI1 · real-browser checks for the unpaired hub face. Usage:
  python3 scripts/qa/pairui1_viewport.py <unpaired|paired|offline|kid> [width] [height]
Serves the repo on a loopback port. Every request to another host is aborted, so nothing reaches a real hub,
camera proxy or Google. The paired scenario uses a fake key and points the hub at this loopback server, so its
feeds fail and the screen is paired but offline. Prints one JSON line."""
import json, os, sys, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
scenario = sys.argv[1]
w = int(sys.argv[2]) if len(sys.argv) > 2 else 440
h = int(sys.argv[3]) if len(sys.argv) > 3 else 956
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if urlparse(self.path).path.startswith("/api/"):
            body = b"{}"
            self.send_response(503); self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d/" % srv.server_address[1]
page_name = {"kid": "kid-harris.html", "offline": "sheet-index.html?pfOffline=1"}.get(scenario, "sheet-index.html")
SNAP = """() => {
  const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width>0 && r.height>0 && cs.display!=='none' && cs.visibility!=='hidden' && +cs.opacity>0 && !e.closest('[hidden]'); };
  const textEls = re => [...document.querySelectorAll('body *')].filter(e => vis(e) && [...e.childNodes].some(c => c.nodeType===3 && re.test(c.textContent)));
  const tag = e => String(e.className || e.tagName).split(' ')[0];
  const lb = [...document.querySelectorAll('.leaveby')];
  const cams = [...document.querySelectorAll('.hub-cam-rest-word')].filter(vis).map(e => e.textContent.trim());
  return {
    pairState: document.documentElement.getAttribute('data-pair-state'),
    needs: textEls(/needs pairing/i).map(tag),
    ready: textEls(/\\bready\\b/i).map(e => tag(e) + ':' + e.textContent.trim().slice(0, 40)),
    resting: textEls(/camera resting/i).length,
    leavebyVisible: lb.filter(vis).length,
    leavebyText: lb.filter(vis).map(e => e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60)),
    camWords: cams,
    pairWord: [...document.querySelectorAll('.hub-lights-pairword')].filter(vis).length,
    bulkVisible: [...document.querySelectorAll('.hub-lights-bulk')].filter(vis).length,
    switches: [...document.querySelectorAll('#hub-lights-grid button, #hub-lights-grid [role=switch]')].filter(vis).length,
    kidPad: [...document.querySelectorAll('.kid-light-pad .light-pad-state')].map(e => e.textContent.trim()),
    pill: (() => { const l = document.querySelector('.hub-lights-pairword'), c = document.querySelector('.hub-cam-rest-pill');
      const f = e => { if (!e || !vis(e)) return null; const cs = getComputedStyle(e); return { shadow: cs.boxShadow, bg: cs.backgroundColor, border: cs.borderTopColor + ' ' + cs.borderTopWidth, color: getComputedStyle(e.lastChild && e.lastChild.nodeType === 1 ? e.lastChild : e).color, weight: cs.fontWeight }; };
      const cw = c && c.querySelector('.hub-cam-rest-word'); const cam = f(c); if (cam && cw) { cam.color = getComputedStyle(cw).color; cam.weight = getComputedStyle(cw).fontWeight; }
      const lt = f(l); if (lt) { lt.color = getComputedStyle(l).color; lt.weight = getComputedStyle(l).fontWeight; }
      return { lights: lt, cam }; })(),
    panel: (() => { const P = document.getElementById('hub-lights-panel'), g = document.querySelector('.hub-lights-pairword');
      if (!P || !vis(P)) return null; const r = P.getBoundingClientRect(); const q = g && vis(g) ? g.getBoundingClientRect() : null;
      return { w: Math.round(r.width), h: Math.round(r.height), pillH: q ? Math.round(q.height) : 0, pillW: q ? Math.round(q.width) : 0 }; })(),
    lightsText: [...document.querySelectorAll('#hub-lights-panel, .lights-gate, #lights-gate')].filter(vis).map(e => e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120))
  };
}"""
out = {"scenario": scenario, "errors": []}
with sync_playwright() as p:
    b = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
    ctx = b.new_context(viewport={"width": w, "height": h})
    def guard(route):
        host = urlparse(route.request.url).hostname
        if host in ("127.0.0.1",): return route.continue_()
        return route.abort()
    ctx.route("**/*", guard)
    if scenario == "paired":
        ctx.add_init_script("try{localStorage.setItem('wardos-lights-proxy-token','qa-fake-key-0123456789abcdef');localStorage.setItem('wardos-lights-proxy','%s');}catch(e){}" % base.rstrip("/"))
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: out["errors"].append(str(e)[:200]))
    pg.goto(base + page_name, wait_until="load")
    pg.wait_for_timeout(4500)
    out["t0"] = pg.evaluate(SNAP)
    pg.wait_for_timeout(2500)  # a later repaint must not bring the card or the switches back
    out["t1"] = pg.evaluate(SNAP)
    ctx.close(); b.close()
srv.shutdown()
print(json.dumps(out))
