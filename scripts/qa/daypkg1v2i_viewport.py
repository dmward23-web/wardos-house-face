"""DAYPKG1 v2i · real-browser checks for Alfred's v2h FAIL (ship-2026-10-28T0416-daypkg1v2h).
Usage: python3 scripts/qa/daypkg1v2i_viewport.py <kidobs|allowance|midnight|home> <page> [width] [height]
  kidobs    a MutationObserver (characterData/attribute old values) plus textContent / nodeValue / innerHTML / setAttribute
            hooks are installed by add_init_script BEFORE any page script runs; every '$' that is ever written into the
            DOM (even if house-nomoney strips it a tick later) is recorded, and kid storage is read for '$' at the end.
            The kids-week feed carries a money goal on every kid ('$45' title, '1 star = $1' blurb) so the v2h path is hot.
  allowance sheet-allowance [data-dad-wk] text after load (must read '$N wk', not a star).
  midnight  fake clock at 23:59:40 CT; reports the fake time at which house-fresh moved the board to the new day.
  home      taps the header centre and reports the page it lands on.
Serves the repo on a fixed loopback port chosen from 52300-52399 (never 38787, 38788, 39517, 40251, 40252, 41787, 41788,
47810-47812, 8787, 8788), plays the hub's /api/private/* on that port (?pfBase=, loopback only) from the synthetic
fixtures, answers /api/pair and /api/pair/mint 403, and fulfils every non-loopback request 204 (no hub is ever called).
Chromium is launched over a pipe (no debugging port). Prints one JSON line."""
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); from pw_chrome import launch_kw
import json, os, sys, threading, functools, socket, re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FIX = os.path.join(ROOT, "scripts", "qa", "fixtures", "private")
mode, page = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 440
h = int(sys.argv[4]) if len(sys.argv) > 4 else 956
FORBID = {38787, 38788, 39517, 40251, 40252, 41787, 41788, 47810, 47811, 47812, 8787, 8788}
D = chr(36)
hits = []
def feed(name):
    f = os.path.join(FIX, name + ".synthetic.json")
    if not os.path.isfile(f): return None
    d = json.load(open(f))
    if name == "kids-week":
        for k, kid in (d.get("kids") or {}).items():
            g = kid.setdefault("bankGoal", {}); g["title"] = "Lego set " + D + "45"; g["blurb"] = "1 \u2605 = " + D + "1 \u00b7 " + D + "45 goal"; g.setdefault("need", 45)
    return json.dumps(d).encode()
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = urlparse(self.path).path
        if p.startswith("/api/pair"):
            body = b'{"ok":false}'; self.send_response(403)
        elif p.startswith("/api/private/"):
            m = re.fullmatch(r"/api/private/([a-z-]+)\.json", p); body = m and feed(m.group(1))
            if body: hits.append(m.group(1)); self.send_response(200)
            else: body = b"{}"; self.send_response(404)
        else:
            return super().do_GET()
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.send_header("Connection", "close"); self.end_headers()
        self.wfile.write(body)
    do_POST = do_GET
srv = None
for port in range(52300, 52400):
    if port in FORBID: continue
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Q, directory=ROOT)); break
    except OSError: continue
assert srv, "no free port in 52300-52399"
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d" % srv.server_address[1]
OBS = r"""(() => { const D = String.fromCharCode(36); const hits = []; window.__v2iHits = hits;
  const note = (k, v, where) => { try { if (String(v).indexOf(D) >= 0 && hits.length < 40) hits.push([k, String(v).slice(0, 120), where]); } catch (e) {} };
  const who = (n) => { try { const e = n && (n.nodeType === 1 ? n : n.parentElement); if (!e) return ''; return e.tagName + (e.id ? '#' + e.id : '') + [...e.attributes].filter(a => a.name.startsWith('data-')).map(a => '[' + a.name + ']').join(''); } catch (e) { return ''; } };
  const skip = (n) => { try { const e = n && (n.nodeType === 1 ? n : n.parentElement); return !!(e && e.closest && e.closest('script,style,noscript,template')); } catch (e) { return false; } };
  const hook = (proto, prop) => { const d = Object.getOwnPropertyDescriptor(proto, prop); if (!d || !d.set) return;
    Object.defineProperty(proto, prop, { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) { if (!(this.tagName === 'SCRIPT' || this.tagName === 'STYLE') && !skip(this)) note('set:' + prop, v, who(this)); return d.set.call(this, v); } }); };
  hook(Node.prototype, 'textContent'); hook(Node.prototype, 'nodeValue'); hook(CharacterData.prototype, 'data'); hook(Element.prototype, 'innerHTML'); hook(HTMLElement.prototype, 'innerText'); hook(Element.prototype, 'outerHTML');
  const sa = Element.prototype.setAttribute; Element.prototype.setAttribute = function (a, v) { if (!/^(src|href|style|class|d|viewBox)$/.test(a)) note('attr:' + a, v, who(this)); return sa.call(this, a, v); };
  const ins = Element.prototype.insertAdjacentHTML; Element.prototype.insertAdjacentHTML = function (p, v) { note('insertAdjacentHTML', v, who(this)); return ins.call(this, p, v); };
  const scan = (n) => { if (!n || skip(n)) return; if (n.nodeType === 3) note('mo:added-text', n.nodeValue, who(n)); else if (n.nodeType === 1) { for (const a of n.attributes || []) if (!/^(src|href|style|class)$/.test(a.name)) note('mo:added-attr:' + a.name, a.value, who(n)); for (let c = n.firstChild; c; c = c.nextSibling) scan(c); } };
  new MutationObserver((list) => { for (const m of list) {
      if (m.type === 'characterData') { if (!skip(m.target)) { note('mo:char-old', m.oldValue, who(m.target)); note('mo:char-now', m.target.nodeValue, who(m.target)); } }
      else if (m.type === 'attributes') { if (!/^(src|href|style|class)$/.test(m.attributeName)) { note('mo:attr-old:' + m.attributeName, m.oldValue, who(m.target)); note('mo:attr-now:' + m.attributeName, m.target.getAttribute(m.attributeName), who(m.target)); } }
      else for (const n of m.addedNodes) scan(n); } })
    .observe(document, { subtree: true, childList: true, characterData: true, characterDataOldValue: true, attributes: true, attributeOldValue: true });
})();"""
PARSED = r"""() => { const D = String.fromCharCode(36); const o = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const e = n.parentElement; if (e && e.closest('script,style,noscript,template')) continue; if (n.nodeValue.indexOf(D) >= 0) o.push(n.nodeValue.slice(0, 80)); }
  const st = []; for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) { const k = s.key(i), v = s.getItem(k) || ''; if ((k + v).indexOf(D) >= 0) st.push(k); }
  const g = [...document.querySelectorAll('[data-bank-goal-title],[data-bank-goal-blurb]')].map(e => [e.hasAttribute('data-bank-goal-title') ? 'title' : 'blurb', e.textContent, e.hidden]);
  return { domDollar: o.slice(0, 10), storageDollar: st, goal: g, hits: (window.__v2iHits || []).slice(0, 30) }; }"""
NOW = os.environ.get("V2INOW", "2026-10-28T09:00:00-05:00")
out = {"mode": mode, "page": page, "size": "%dx%d" % (w, h), "port": srv.server_address[1]}
with sync_playwright() as p:
    b = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
    out["browserPid"] = None
    try:
        mob = w < 600
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, reduced_motion="reduce")
        ctx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        if mode == "kidobs": ctx.add_init_script(OBS)
        def gate(route):
            u = urlparse(route.request.url)
            if u.path.startswith("/api/pair"): return route.fulfill(status=403, content_type="application/json", body='{"ok":false}')
            if u.hostname != "127.0.0.1" or u.port != srv.server_address[1]: return route.fulfill(status=204, body="")
            return route.continue_()
        ctx.route("**/*", gate)
        pg = ctx.new_page(); errors = []; navs = []
        pg.on("pageerror", lambda e: errors.append(str(e)[:160]))
        pg.on("framenavigated", lambda f: navs.append(f.url) if f == pg.main_frame else None)
        q = "?pfBase=" + base + ("&kid=hayes" if page == "mercury-run" else "")
        if mode == "midnight":
            t0 = "2026-10-28T23:59:40-05:00"; pg.clock.install(time=t0)
            pg.goto(base + "/" + page + ".html" + q, wait_until="load", timeout=120000)
            mid = pg.evaluate("Date.parse('2026-10-29T00:00:00-05:00')"); landed = None
            for _ in range(24):
                pg.clock.run_for(2500); pg.wait_for_timeout(150)
                if "fresh=" in pg.url:
                    try: landed = pg.evaluate("Date.now()")
                    except Exception: landed = None
                    break
            out["state"] = {"reloadedTo": pg.url.replace(base, ""), "secondsAfterMidnight": None if landed is None else round((landed - mid) / 1000, 1), "fresh": "fresh=" in pg.url}
        else:
            pg.clock.install(time=NOW)
            pg.goto(base + "/" + page + ".html" + q, wait_until="load", timeout=120000)
            pg.wait_for_timeout(3500); pg.clock.fast_forward(61000); pg.wait_for_timeout(1500)
            if mode == "kidobs":
                out["state"] = pg.evaluate(PARSED)
            elif mode == "allowance":
                out["state"] = pg.evaluate("() => [...document.querySelectorAll('[data-dad-wk]')].map(e => ({ kid: (e.parentElement.querySelector('[data-dad-paid]') || {}).getAttribute ? e.parentElement.querySelector('[data-dad-paid]').getAttribute('data-dad-paid') : null, text: e.textContent, hidden: e.hidden, shown: !!(e.offsetWidth || e.offsetHeight) }))")
            elif mode == "home":
                hd = pg.query_selector("header.hdr") or pg.query_selector("body header")
                box = hd.bounding_box() if hd else None
                out["hdrHome"] = pg.evaluate("() => { const h = document.querySelector('header.hdr') || document.querySelector('body header'); return h ? h.classList.contains('hdr-home-tap') : null; }")
                spot = pg.evaluate("""() => { const h = document.querySelector('header.hdr') || document.querySelector('body header'); if (!h) return null; const r = h.getBoundingClientRect();
                  const C = 'a[href],button,input,select,textarea,label,summary,[role=button],[data-mute-toggle],[contenteditable=true]';
                  for (let y = r.top + 6; y < r.bottom - 2; y += 6) for (let x = r.left + 8; x < r.right - 8; x += 10) { const e = document.elementFromPoint(x, y); if (e && h.contains(e) && !e.closest(C)) return [x, y, 'hdr']; }
                  const k = document.querySelector('[data-kw-home]'); if (k) { const q = k.getBoundingClientRect(); if (q.width && q.height) return [q.left + q.width / 2, q.top + q.height / 2, 'kw-home']; }
                  for (let y = r.top + 6; y < r.bottom - 2; y += 6) for (let x = r.left + 8; x < r.right - 8; x += 10) { const e = document.elementFromPoint(x, y); if (e && !e.closest(C)) return [x, y, 'hdr-overlay']; } return null; }""")
                if spot:
                    try:
                        with pg.expect_navigation(timeout=8000):
                            if mob: pg.touchscreen.tap(spot[0], spot[1])
                            else: pg.mouse.click(spot[0], spot[1])
                    except Exception as e: out["tapErr"] = str(e)[:80]
                out["state"] = {"landed": urlparse(pg.url).path, "spot": spot}
        out["errors"] = errors[:6]; out["feedHits"] = sorted(set(hits)); out["navs"] = [n.replace(base, "") for n in navs][:6]
        ctx.close()
    finally:
        b.close()
srv.shutdown(); srv.server_close()
print(json.dumps(out))
