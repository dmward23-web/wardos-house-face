"""DAYPKG1 v2j (Alfred v2i FAIL, P2) · kid-reachable closure crawl with a zero-'$' assertion on every page.
Usage: python3 scripts/qa/daypkg1v2j_crawl.py <width> <height>   -> prints one JSON line
Seeds: kid-hayes, kid-harris, kid-ainsley, mercury-run (?kid=hayes) and sheet-index. On every page it collects the static
links (a/area href, data-href, form action) and then dispatches up to 140 clicks (links, buttons, role=button/link,
tabindex, onclick, the header and its Home tap target [data-kw-home], anything with a pointer cursor); every document
request a click starts is RECORDED AND ABORTED, so the page stays and the target joins the queue. Redirect pages
(index.html, month-chat.html) count via the page they land on. Dad pages (sheet-dan, sheet-allowance) are never crawled:
an edge to one is reported as a violation.
Per page it reports '$' (String.fromCharCode(36)) in:
  dom        every text node of the document (hidden included; script/style/noscript/template text excluded), every
             attribute value except src/href/srcset/style/class/d/viewBox, form values, ::before/::after content, and the
             same for each same-origin iframe;
  transient  a MutationObserver plus textContent / nodeValue / data / innerHTML / outerHTML / innerText / setAttribute /
             insertAdjacentHTML / document.write / cookie hooks, installed by add_init_script BEFORE any page script;
  storage    every localStorage / sessionStorage setItem, plus a dump of both stores after the page settles.
The kids-week feed carries a money goal on every kid ('$45' title and blurb), so the scrub paths are hot.
Harness (Alfred v2i rulings): served under /wardos-house-face/ like GitHub Pages on a loopback port picked from
52500-52599 (never 38787, 38788, 39517, 40251, 40252, 41787, 41788, 47810-47812, 8787, 8788); /api/private/* plays the
synthetic fixtures (?pfBase=, loopback only); /api/pair redeem answers 200 with a synthetic key, /api/pair/mint answers
403; every other /api/* is 404 locally; every request to a non-loopback host is ABORTED (never answered). One browser
per run, launched over a pipe, closed at the end."""
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); from pw_chrome import launch_kw
import json, os, sys, threading, functools, re, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, urljoin
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FIX = os.path.join(ROOT, "scripts", "qa", "fixtures", "private")
PRE = "/wardos-house-face/"
w, h = int(sys.argv[1]), int(sys.argv[2])
FORBID = {38787, 38788, 39517, 40251, 40252, 41787, 41788, 47810, 47811, 47812, 8787, 8788}
D = chr(36)
SEEDS = ["kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "mercury-run.html", "sheet-index.html"]
DAD = {"sheet-dan.html", "sheet-allowance.html"}
api = {"pair200": 0, "mint403": 0, "private": 0, "other404": 0}
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
    def j(self, code, body):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.send_header("Connection", "close"); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        u = urlparse(self.path); p = u.path
        if p == "/api/pair/mint": api["mint403"] += 1; return self.j(403, b'{"ok":false}')
        if p == "/api/pair": api["pair200"] += 1; return self.j(200, json.dumps({"ok": True, "key": "qa-fake-key-v2j-0000"}).encode())
        if p.startswith("/api/private/"):
            m = re.fullmatch(r"/api/private/([a-z-]+)\.json", p); body = m and feed(m.group(1))
            if body: api["private"] += 1; return self.j(200, body)
            return self.j(404, b"{}")
        if p.startswith("/api/"): api["other404"] += 1; return self.j(404, b"{}")
        if p == PRE[:-1]: self.send_response(301); self.send_header("Location", PRE); self.end_headers(); return
        if not p.startswith(PRE): return self.j(404, b"{}")
        self.path = "/" + p[len(PRE):] + (("?" + u.query) if u.query else "")
        return super().do_GET()
    do_POST = do_GET
srv = None
for port in range(52500, 52600):
    if port in FORBID: continue
    try: srv = ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Q, directory=ROOT)); break
    except OSError: continue
assert srv, "no free port in 52500-52599"
threading.Thread(target=srv.serve_forever, daemon=True).start()
PORT = srv.server_address[1]; base = "http://127.0.0.1:%d" % PORT
OBS = r"""(() => { const D = String.fromCharCode(36); const hits = []; window.__v2jHits = hits; const st = []; window.__v2jStore = st;
  const note = (k, v, where) => { try { if (String(v).indexOf(D) >= 0 && hits.length < 60) hits.push([k, String(v).slice(0, 120), where]); } catch (e) {} };
  const who = (n) => { try { const e = n && (n.nodeType === 1 ? n : n.parentElement); if (!e) return ''; return e.tagName + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''); } catch (e) { return ''; } };
  const skip = (n) => { try { const e = n && (n.nodeType === 1 ? n : n.parentElement); return !!(e && e.closest && e.closest('script,style,noscript,template')); } catch (e) { return false; } };
  const hook = (proto, prop) => { const d = Object.getOwnPropertyDescriptor(proto, prop); if (!d || !d.set) return;
    Object.defineProperty(proto, prop, { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) { if (!(this.tagName === 'SCRIPT' || this.tagName === 'STYLE') && !skip(this)) note('set:' + prop, v, who(this)); return d.set.call(this, v); } }); };
  hook(Node.prototype, 'textContent'); hook(Node.prototype, 'nodeValue'); hook(CharacterData.prototype, 'data'); hook(Element.prototype, 'innerHTML'); hook(HTMLElement.prototype, 'innerText'); hook(Element.prototype, 'outerHTML');
  const sa = Element.prototype.setAttribute; Element.prototype.setAttribute = function (a, v) { if (!/^(src|href|srcset|style|class|d|viewBox)$/i.test(a)) note('attr:' + a, v, who(this)); return sa.call(this, a, v); };
  const ins = Element.prototype.insertAdjacentHTML; Element.prototype.insertAdjacentHTML = function (p, v) { note('insertAdjacentHTML', v, who(this)); return ins.call(this, p, v); };
  const dw = Document.prototype.write; Document.prototype.write = function (...a) { note('document.write', a.join(''), 'document'); return dw.apply(this, a); };
  try { const cd = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie'); Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get: cd.get, set: function (v) { if (String(v).indexOf(D) >= 0) st.push(['cookie', String(v).slice(0, 80)]); return cd.set.call(this, v); } }); } catch (e) {}
  const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if ((String(k) + String(v)).indexOf(D) >= 0 && st.length < 40) st.push([this === window.sessionStorage ? 'session' : 'local', String(k), String(v).slice(0, 80)]); return si.call(this, k, v); };
  try { window.open = function (u) { (window.__v2jOpen = window.__v2jOpen || []).push(String(u)); return null; }; history.back = function () {}; history.go = function () {}; window.close = function () {}; } catch (e) {}
  const scan = (n) => { if (!n || skip(n)) return; if (n.nodeType === 3) note('mo:added-text', n.nodeValue, who(n)); else if (n.nodeType === 1) { for (const a of n.attributes || []) if (!/^(src|href|srcset|style|class|d|viewBox)$/i.test(a.name)) note('mo:added-attr:' + a.name, a.value, who(n)); for (let c = n.firstChild; c; c = c.nextSibling) scan(c); } };
  new MutationObserver((list) => { for (const m of list) {
      if (m.type === 'characterData') { if (!skip(m.target)) { note('mo:char-old', m.oldValue, who(m.target)); note('mo:char-now', m.target.nodeValue, who(m.target)); } }
      else if (m.type === 'attributes') { if (!/^(src|href|srcset|style|class|d|viewBox)$/i.test(m.attributeName)) { note('mo:attr-old:' + m.attributeName, m.oldValue, who(m.target)); note('mo:attr-now:' + m.attributeName, m.target.getAttribute(m.attributeName), who(m.target)); } }
      else for (const n of m.addedNodes) scan(n); } })
    .observe(document, { subtree: true, childList: true, characterData: true, characterDataOldValue: true, attributes: true, attributeOldValue: true });
})();"""
LINKS = r"""() => { const o = new Set(); for (const e of document.querySelectorAll('a[href],area[href]')) o.add(e.href);
  for (const e of document.querySelectorAll('[data-href]')) { try { o.add(new URL(e.getAttribute('data-href'), location.href).href); } catch (x) {} }
  for (const e of document.querySelectorAll('form[action]')) o.add(e.action); return [...o]; }"""
CLICK = r"""async () => { const C = 'a[href],area[href],button,summary,label,[role=button],[role=link],[role=tab],[onclick],[tabindex],[data-href],[data-kw-home],header,header.hdr,.hdr';
  const set = new Set(document.querySelectorAll(C));
  for (const e of document.querySelectorAll('body *')) { if (set.size >= 400) break; try { if (getComputedStyle(e).cursor === 'pointer') set.add(e); } catch (x) {} }
  const pri = (e) => (e.matches('[data-kw-home],header,header.hdr,.hdr') ? 0 : e.matches('a[href],[data-href]') ? 1 : 2);
  const list = [...set].sort((a, b) => pri(a) - pri(b)).slice(0, 140); let n = 0;
  for (const e of list) { try { if (!e.isConnected) continue; e.click(); n++; } catch (x) {} await new Promise(r => setTimeout(r, 35)); }
  return { candidates: set.size, clicked: n }; }"""
STATE = r"""() => { const D = String.fromCharCode(36); const dom = [];
  const doc = (d, tag) => { const w = d.createTreeWalker(d.documentElement, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const e = n.parentElement; if (e && e.closest('script,style,noscript,template')) continue; if (n.nodeValue.indexOf(D) >= 0 && dom.length < 20) dom.push([tag + 'text', n.nodeValue.trim().slice(0, 80), e ? e.tagName + '.' + (typeof e.className === 'string' ? e.className.split(' ')[0] : '') : '']); }
    for (const e of d.querySelectorAll('*')) { if (e.closest('script,style,noscript,template') && e.tagName !== 'SCRIPT') continue;
      for (const a of e.attributes) if (!/^(src|href|srcset|style|class|d|viewBox)$/i.test(a.name) && e.tagName !== 'SCRIPT' && a.value.indexOf(D) >= 0 && dom.length < 20) dom.push([tag + 'attr:' + a.name, a.value.slice(0, 80), e.tagName]);
      if ('value' in e && typeof e.value === 'string' && e.value.indexOf(D) >= 0 && dom.length < 20) dom.push([tag + 'value', e.value.slice(0, 80), e.tagName]);
      for (const ps of ['::before', '::after']) { try { const c = getComputedStyle(e, ps).content; if (c && c !== 'none' && c !== 'normal' && c.indexOf(D) >= 0 && dom.length < 20) dom.push([tag + 'pseudo' + ps, c.slice(0, 60), e.tagName]); } catch (x) {} } } };
  doc(document, ''); const frames = [];
  for (const f of document.querySelectorAll('iframe')) { try { if (f.contentDocument && f.contentDocument.documentElement) { doc(f.contentDocument, 'iframe:'); frames.push(f.getAttribute('src') || ''); } } catch (x) { frames.push('opaque:' + (f.getAttribute('src') || '')); } }
  const store = []; for (const [nm, s] of [['local', localStorage], ['session', sessionStorage]]) for (let i = 0; i < s.length; i++) { const k = s.key(i), v = s.getItem(k) || ''; if ((k + v).indexOf(D) >= 0) store.push([nm, k, v.slice(0, 80)]); }
  let fh = []; for (const f of document.querySelectorAll('iframe')) { try { fh = fh.concat(f.contentWindow.__v2jHits || []); } catch (x) {} }
  return { dom, transient: (window.__v2jHits || []).concat(fh).slice(0, 30), storageWrites: (window.__v2jStore || []).slice(0, 20), storage: store, frames, opened: window.__v2jOpen || [], hdr: !!document.querySelector('header'), kwHome: !!document.querySelector('[data-kw-home]') }; }"""
def page_of(url):
    u = urlparse(url)
    if u.hostname != "127.0.0.1" or u.port != PORT or not u.path.startswith(PRE): return None
    p = u.path[len(PRE):] or "index.html"
    if p.endswith("/"): p += "index.html"
    if not p.endswith(".html") and "." not in p.rsplit("/", 1)[-1]: p += ".html"
    return p if p.endswith(".html") else None
out = {"size": "%dx%d" % (w, h), "port": PORT, "prefix": PRE, "pages": {}, "edges": {}, "dad_edges": [], "outside": [], "aborted_nonlocal": 0}
t0 = time.time()
with sync_playwright() as p:
    b = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
    try:
        mob = w < 600
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, reduced_motion="reduce")
        ctx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        ctx.add_init_script(OBS)
        cap = {"on": False, "seen": []}
        def gate(route):
            req = route.request; u = urlparse(req.url)
            if u.hostname != "127.0.0.1" or u.port != PORT:
                out["aborted_nonlocal"] += 1
                if req.is_navigation_request(): out["outside"].append(["nav", req.url[:100]]); return route.abort("aborted")  # a tapped outside link: abort with ERR_ABORTED so no error page commits
                return route.abort()
            if cap["on"] and req.is_navigation_request() and req.frame == cap.get("frame"):
                cap["seen"].append(req.url); return route.abort("aborted")  # ERR_ABORTED: no error page commits, the page stays
            return route.continue_()
        ctx.route("**/*", gate)
        queue = list(SEEDS); seen = set(SEEDS); qs = {"mercury-run.html": "&kid=hayes"}
        while queue:
            pgname = queue.pop(0)
            pg = ctx.new_page(); errors = []; pg.on("pageerror", lambda e: errors.append(str(e)[:120])); pg.on("dialog", lambda d: d.dismiss())
            rec = {"loaded": False}
            try:
                cap["on"] = False
                pg.goto(base + PRE + pgname + "?pfBase=" + base + qs.get(pgname, ""), wait_until="load", timeout=60000)
                pg.wait_for_timeout(2500)
                landed = page_of(pg.url); rec["landed"] = landed; rec["loaded"] = True
                targets = set(pg.evaluate(LINKS))
                cap["on"] = True; cap["seen"] = []; cap["frame"] = pg.main_frame
                rec["click"] = pg.evaluate(CLICK); pg.wait_for_timeout(600)
                cap["on"] = False
                targets |= set(cap["seen"]); targets |= set(pg.evaluate("() => window.__v2jOpen || []"))
                pg.wait_for_timeout(300)
                st = pg.evaluate(STATE); rec.update(st)
                rec["errors"] = errors[:4]
                found = set()
                for t in targets:
                    q = page_of(urljoin(pg.url, t))
                    if q is None:
                        uu = urlparse(urljoin(pg.url, t))
                        if uu.scheme in ("http", "https") and not (uu.hostname == "127.0.0.1" and uu.port == PORT and uu.path.startswith(PRE)): out["outside"].append([pgname, t[:100]])
                        continue
                    found.add(q)
                if landed and landed != pgname:
                    rec["redirect_to"] = landed; found.add(landed)
                out["edges"][pgname] = sorted(found)
                for q in sorted(found):
                    if q in DAD: out["dad_edges"].append([pgname, q]); continue
                    if q not in seen and os.path.isfile(os.path.join(ROOT, q)): seen.add(q); queue.append(q)
                    elif q not in seen: rec.setdefault("missing_targets", []).append(q)
            except Exception as e:
                rec["err"] = str(e)[:200]
            finally:
                cap["on"] = False
                try: pg.close()
                except Exception: pass
            out["pages"][pgname] = rec
        ctx.close()
    finally:
        b.close()
srv.shutdown(); srv.server_close()
out["api"] = api; out["secs"] = round(time.time() - t0, 1); out["closure"] = sorted(out["pages"]); out["count"] = len(out["pages"])
out["outside"] = out["outside"][:20]
print(json.dumps(out))
