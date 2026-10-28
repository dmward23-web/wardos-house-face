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
ROOT = os.path.abspath(os.environ.get("V2J_CRAWL_ROOT") or os.path.join(os.path.dirname(__file__), "..", ".."))  # ADULTCUT1: the positive control serves 4557b0d2
FIX = os.path.join(ROOT, "scripts", "qa", "fixtures", "private")
PRE = "/wardos-house-face/"
w, h = int(sys.argv[1]), int(sys.argv[2])
FORBID = {38787, 38788, 39517, 40251, 40252, 41787, 41788, 47810, 47811, 47812, 8787, 8788}
D = chr(36)
SEEDS = ["kid-hayes.html", "kid-harris.html", "kid-ainsley.html", "mercury-run.html", "sheet-index.html"]
DAD = {"sheet-dan.html", "sheet-allowance.html", "sheet-spotify-setup.html"}  # SPOTCUT: the Spotify setup sheet is Dad-only
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
  /* ADULTCUT1 P3 (Alfred) · read sentinels: a '$' that comes back out of storage (getItem) or through JSON.parse */
  const rd = []; window.__v2jReads = rd;
  const gi = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { const v = gi.call(this, k); try { if (v != null && (String(k) + String(v)).indexOf(D) >= 0 && rd.length < 40) rd.push(['getItem:' + (this === window.sessionStorage ? 'session' : 'local'), String(k), String(v).slice(0, 80)]); } catch (e) {} return v; };
  const jp = JSON.parse; JSON.parse = function (t, r) { try { if (typeof t === 'string' && t.indexOf(D) >= 0 && rd.length < 40) rd.push(['JSON.parse', t.slice(0, 80)]); } catch (e) {} return jp.call(JSON, t, r); };
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
  let fh = [], fr = []; for (const f of document.querySelectorAll('iframe')) { try { fh = fh.concat(f.contentWindow.__v2jHits || []); fr = fr.concat(f.contentWindow.__v2jReads || []); } catch (x) {} }
  return { dom, transient: (window.__v2jHits || []).concat(fh).slice(0, 30), reads: (window.__v2jReads || []).concat(fr).slice(0, 20), storageWrites: (window.__v2jStore || []).slice(0, 20), storage: store, frames, opened: window.__v2jOpen || [], hdr: !!document.querySelector('header'), kwHome: !!document.querySelector('[data-kw-home]') }; }"""
# SPOTCUT (Alfred, ADULTCUT1) · no kid-reachable page may carry a Spotify credential field or a Client ID save path.
# CRED lists any input/textarea/contenteditable naming a client id / secret / Spotify, the old setup ids, and any save
# button that names Spotify or a Client ID (main document and same-origin iframes).
CRED = r"""() => { const out = []; const ID = /client[\s_-]*(id|secret)|redirect[\s_-]*uri|api[\s_-]*key|access[\s_-]*token|refresh[\s_-]*token/i, SP = /spotify/i;
  const doc = (d, tag) => { for (const e of d.querySelectorAll('input,textarea,[contenteditable=""],[contenteditable=true]')) {
      if (e.tagName === 'INPUT' && !/^(|text|password|url|email|tel|number)$/i.test(e.getAttribute('type') || '')) continue;
      const own = [e.id, e.name, e.placeholder, e.getAttribute('aria-label'), e.getAttribute('autocomplete'), [...(e.labels || [])].map(l => l.textContent).join(' ')].join(' ');
      const li = e.closest('li,label'); const near = li ? li.textContent.slice(0, 200) : '';
      if (ID.test(own) || SP.test(own) || ID.test(near)) out.push([tag + 'input', (e.id || e.name || e.placeholder || e.tagName).slice(0, 60)]); }
    for (const id of ['spw-client', 'spw-setup', 'spw-setup-go', 'spw-copy-btn', 'spw-redirect']) if (d.getElementById(id)) out.push([tag + 'id', id]);
    for (const e of d.querySelectorAll('button,[role=button],input[type=submit]')) { const t = (e.textContent || e.value || '') + ' ' + (e.getAttribute('aria-label') || ''); if (/save/i.test(t) && (SP.test(t) || ID.test(t))) out.push([tag + 'save', t.trim().slice(0, 60)]); } };
  doc(document, ''); for (const f of document.querySelectorAll('iframe')) { try { if (f.contentDocument) doc(f.contentDocument, 'iframe:'); } catch (x) {} }
  return out; }"""
PROBE_ID = "0123456789abcdef0123456789abcdef"
PROBE = r"""async (cid) => { const S = window.HouseSpotify; if (!S) return { has: false };
  const of = window.fetch, sent = []; window.fetch = function (u, o) { sent.push([String(u).slice(0, 120), (o && o.method) || 'GET']); return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })); };
  let r = null; try { r = typeof S.setup === 'function' ? await S.setup(cid, 'sheet-spotify.html') : { ok: false, error: 'no_setup' }; } catch (e) { r = { threw: String(e).slice(0, 80) }; } finally { window.fetch = of; }
  const st = []; for (const [nm, s] of [['local', localStorage], ['session', sessionStorage]]) for (let i = 0; i < s.length; i++) { const k = s.key(i), v = s.getItem(k) || ''; if ((k + v).toLowerCase().indexOf(cid) >= 0) st.push([nm, k]); }
  return { has: true, r, sent, stored: st }; }"""
# ADULTCUT1 (Atlas 7:56) · every same-origin script / stylesheet a kid page actually loaded (static tags and anything injected
# later, from the Performance resource list) is read from disk and run through the denylist, so a helper that is never
# invoked (an exported App Store link, a deep link) is still caught.
LOADED = r"""() => { const o = new Set(); for (const e of document.querySelectorAll('script[src],link[rel=stylesheet][href]')) o.add(e.src || e.href);
  try { for (const r of performance.getEntriesByType('resource')) if (/^(script|link|css|other|fetch|xmlhttprequest)$/.test(r.initiatorType)) o.add(r.name); } catch (x) {}
  return [...o]; }"""
_scan_cache = {}
def scan_loaded(pgname, urls):
    n = 0
    for u in urls:
        uu = urlparse(u)
        if uu.hostname != "127.0.0.1" or uu.port != PORT or not uu.path.startswith(PRE): continue
        rel = uu.path[len(PRE):]
        if not re.search(r"\.(js|mjs|css)$", rel): continue
        fp = os.path.join(ROOT, rel)
        if not os.path.isfile(fp): continue
        if rel not in _scan_cache:
            txt = open(fp, encoding="utf-8", errors="replace").read()
            _scan_cache[rel] = [m.group(0)[:120] for m in ADULT.finditer(txt)] if ADULT is not None else []
        n += 1
        for m in _scan_cache[rel]: out["adult"].append([pgname, "script:" + rel, m])
    return n

def page_of(url):
    u = urlparse(url)
    if u.hostname != "127.0.0.1" or u.port != PORT or not u.path.startswith(PRE): return None
    p = u.path[len(PRE):] or "index.html"
    if p.endswith("/"): p += "index.html"
    if not p.endswith(".html") and "." not in p.rsplit("/", 1)[-1]: p += ".html"
    return p if p.endswith(".html") else None
out = {"size": "%dx%d" % (w, h), "port": PORT, "prefix": PRE, "pages": {}, "edges": {}, "dad_edges": [], "outside": [], "aborted_nonlocal": 0,
       "desk": [], "desk_checks": {"links": 0, "opens": 0, "navs": 0, "requests": 0, "markup_pages": 0}}   # DESKCUT1
DESK_RE = re.compile(r"wardos-desk-face|desk-face|desk-index", re.I)  # ADULTCUT1 P3: widened with the static grep
out["spotify_cred"] = []; out["spotify_checks"] = {"pages": 0, "probes": 0}; out["spotify_setup_requests"] = []
# ADULTCUT1 (Atlas): dev / admin / billing / account surfaces. The denylist regex lives in daypkg1v2j-crawl.test.mjs and
# arrives as ADULT_DENY_RE; out.adult_re echoes it so the test proves the crawl applied its regex, not a stale copy.
import os as _os, re as _re
ADULT_SRC = _os.environ.get("ADULT_DENY_RE", "")
ADULT = _re.compile(ADULT_SRC, _re.I) if ADULT_SRC else None
out["adult"] = []; out["adult_re"] = ADULT_SRC or None
def adult_hit(page, kind, u):
    if ADULT is not None and ADULT.search(str(u)): out["adult"].append([page, kind, str(u)[:120]])
# ADULTCUT2 (Atlas 9:07) · two tappable-target asserts. The regex lives in daypkg1v2j-crawl.test.mjs and arrives as
# OUTBOUND_AUTH_RE (echoed in out.auth_re). Tappable targets = a/area href, data-href, form action, formaction, every
# window.open, and every main-frame navigation a click / location set starts (recorded and aborted, local or not).
#   out.outbound_auth  any tappable target that is a sign-in / OAuth / authorize URL
#   out.offsite        any tappable target that leaves the house: allowlist = the house origin and prefix only
#                      (http://127.0.0.1:PORT/wardos-house-face/), plus OFFSITE_ALLOW (JSON list, the test passes []).
#                      javascript: and about:blank are not targets (they never leave the page); mailto:, tel:, sms:,
#                      intent:, app schemes, data: and blob: navs all count as leaving.
AUTH_SRC = _os.environ.get("OUTBOUND_AUTH_RE", "")
AUTH = _re.compile(AUTH_SRC, _re.I) if AUTH_SRC else None
ALLOW = json.loads(_os.environ.get("OFFSITE_ALLOW") or "[]")
out["auth_re"] = AUTH_SRC or None; out["offsite_allow"] = ["house origin " + PRE] + ALLOW
out["outbound_auth"] = []; out["offsite"] = []; out["tap_checks"] = {"targets": 0, "pseudo": 0}
def is_house(u):
    uu = urlparse(u)
    return uu.scheme in ("http", "https") and uu.hostname == "127.0.0.1" and uu.port == PORT and uu.path.startswith(PRE)
def tap_check(page, kind, t, sink=None):
    sink = sink if sink is not None else out
    s = str(t).strip(); sink["tap_checks"]["targets"] += 1
    if AUTH is not None and AUTH.search(s): sink["outbound_auth"].append([page, kind, s[:140]])
    low = s.lower()
    if low.startswith("javascript:") or low in ("about:blank", "about:srcdoc") or low.startswith("#"): sink["tap_checks"]["pseudo"] += 1; return
    if is_house(s) or any(s.startswith(a) for a in ALLOW): return
    sink["offsite"].append([page, kind, s[:140]])
LINKS2 = r"""() => { const o = []; for (const e of document.querySelectorAll('a[href],area[href]')) o.push(['href', e.href]);
  for (const e of document.querySelectorAll('[data-href]')) { try { o.push(['data-href', new URL(e.getAttribute('data-href'), location.href).href]); } catch (x) { o.push(['data-href', e.getAttribute('data-href')]); } }
  for (const e of document.querySelectorAll('form[action]')) o.push(['form action', e.action]);
  for (const e of document.querySelectorAll('[formaction]')) o.push(['formaction', e.formAction || e.getAttribute('formaction')]);
  for (const f of document.querySelectorAll('iframe')) { try { const d = f.contentDocument; if (!d) continue; for (const e of d.querySelectorAll('a[href],area[href]')) o.push(['iframe href', e.href]); for (const e of d.querySelectorAll('form[action]')) o.push(['iframe form action', e.action]); } catch (x) {} }
  return o; }"""
cur = {"page": None}
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
            out["desk_checks"]["requests"] += 1
            if req.is_navigation_request(): out["desk_checks"]["navs"] += 1
            if DESK_RE.search(req.url): out["desk"].append([cur["page"], "nav (location set / tap / form)" if req.is_navigation_request() else "request " + req.resource_type, req.url[:120]])
            adult_hit(cur["page"], "nav (location set / tap / form)" if req.is_navigation_request() else "request " + req.resource_type, req.url)
            if "/api/spotify/setup" in req.url: out["spotify_setup_requests"].append([cur["page"], req.method, req.url[:120]])
            if u.hostname != "127.0.0.1" or u.port != PORT:
                out["aborted_nonlocal"] += 1
                if req.is_navigation_request():
                    out["outside"].append(["nav", req.url[:100]])
                    tap_check(cur["page"], "nav (non-local)" + ("" if cap["on"] and req.frame == cap.get("frame") else " frame/load"), req.url)  # ADULTCUT2
                    return route.abort("aborted")  # a tapped outside link: abort with ERR_ABORTED so no error page commits
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
                cap["on"] = False; cur["page"] = pgname
                pg.goto(base + PRE + pgname + "?pfBase=" + base + qs.get(pgname, ""), wait_until="load", timeout=60000)
                pg.wait_for_timeout(2500)
                landed = page_of(pg.url); rec["landed"] = landed; rec["loaded"] = True
                targets = set(pg.evaluate(LINKS))
                for t in targets:
                    out["desk_checks"]["links"] += 1
                    if DESK_RE.search(t): out["desk"].append([pgname, "href", t[:120]])
                    adult_hit(pgname, "href", t)
                cap["on"] = True; cap["seen"] = []; cap["frame"] = pg.main_frame
                rec["click"] = pg.evaluate(CLICK); pg.wait_for_timeout(600)
                cap["on"] = False
                targets |= set(cap["seen"]); opened = pg.evaluate("() => window.__v2jOpen || []"); targets |= set(opened)
                for kind, t in pg.evaluate(LINKS2): tap_check(pgname, kind, t)  # ADULTCUT2
                for t in cap["seen"]: tap_check(pgname, "nav (tap / location set)", t)
                for t in opened: tap_check(pgname, "window.open", t)
                for t in opened:
                    out["desk_checks"]["opens"] += 1
                    if DESK_RE.search(str(t)): out["desk"].append([pgname, "window.open", str(t)[:120]])
                    adult_hit(pgname, "window.open", t)
                out["desk_checks"]["markup_pages"] += 1
                markup = pg.evaluate("() => document.documentElement.outerHTML")
                if DESK_RE.search(markup): out["desk"].append([pgname, "markup", pg.url])
                if ADULT is not None:
                    for m in ADULT.finditer(markup): out["adult"].append([pgname, "markup", m.group(0)[:120]])
                out["desk_checks"]["scripts"] = out["desk_checks"].get("scripts", 0) + scan_loaded(pgname, pg.evaluate(LOADED))
                out["spotify_checks"]["pages"] += 1
                for c in pg.evaluate(CRED): out["spotify_cred"].append([pgname] + c)
                pr = pg.evaluate(PROBE, PROBE_ID)
                if pr.get("has"):
                    out["spotify_checks"]["probes"] += 1; rec["spotify_probe"] = pr
                    if (pr.get("r") or {}).get("error") != "dad_only" or pr.get("stored") or pr.get("sent"): out["spotify_cred"].append([pgname, "save-path", json.dumps(pr)[:160]])
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
        # ADULTCUT2 AUTHPROBE (Atlas 9:07) · the main crawl has no lights key and the hub is aborted, so Spotify sits at no_key /
        # offline and its sign-in never shows. Here every kid closure page runs again in its own context with a synthetic lights
        # key and the pinned QA hub (https://hub.qa.invalid, the origin HouseHub.lights() gives a loopback page) MOCKED, never
        # reached: GET /api/spotify* answers {state:"need_auth"}, POST /api/spotify/auth-start answers a synthetic
        # accounts.spotify.com/authorize URL. Every other non-local request is aborted; every main-frame navigation is recorded
        # and aborted. First any element whose text says Connect Spotify / sign in / log in is clicked (attributed), then the
        # same 140-click pass. Every tappable target goes through the same two asserts. Dad control: the Connect Spotify button
        # on sheet-spotify-setup.html must produce the authorize navigation, so a zero on kid pages is a real zero.
        AUTH_URL = "https://accounts.spotify.com/authorize?client_id=qa0000&response_type=code&redirect_uri=https%3A%2F%2Fdmward23-web.github.io%2Fwardos-house-face%2Fspotify-callback.html&code_challenge_method=S256&code_challenge=qa&state=qa"
        ap = {"pages": {}, "need_auth_pages": [], "outbound_auth": [], "offsite": [], "tap_checks": {"targets": 0, "pseudo": 0}, "hub_mock": {"state": 0, "auth_start": 0, "other_aborted": 0}, "named_clicks": []}
        out["authprobe"] = ap
        CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Content-Type": "application/json"}
        acap = {"on": False, "frame": None, "seen": []}
        def agate(route):
            req = route.request; u = urlparse(req.url)
            if u.hostname == "hub.qa.invalid":
                if req.method == "OPTIONS": return route.fulfill(status=204, headers=CORS, body="")  # CORS preflight on the mocked .invalid hub only
                if u.path == "/api/spotify/auth-start" and req.method == "POST": ap["hub_mock"]["auth_start"] += 1; return route.fulfill(status=200, headers=CORS, body=json.dumps({"ok": True, "url": AUTH_URL}))
                if u.path.startswith("/api/spotify") and req.method == "GET": ap["hub_mock"]["state"] += 1; return route.fulfill(status=200, headers=CORS, body=json.dumps({"ok": True, "state": "need_auth"}))
                ap["hub_mock"]["other_aborted"] += 1; return route.abort()
            nav = req.is_navigation_request()
            if acap["on"] and nav and req.frame == acap["frame"]: acap["seen"].append(req.url); return route.abort("aborted")
            if u.hostname != "127.0.0.1" or u.port != PORT:
                if nav: acap["seen"].append(req.url); return route.abort("aborted")
                return route.abort()
            return route.continue_()
        NAMED = r"""() => { const o = []; let i = 0; for (const e of document.querySelectorAll('a,button,[role=button],[role=link],[data-sp-act],input[type=submit],input[type=button]')) {
            const t = ((e.textContent || e.value || '') + ' ' + (e.getAttribute('aria-label') || '')).replace(/\s+/g, ' ').trim();
            if (/connect\s*spotify|sign\s*-?\s*in|log\s*-?\s*in|authori[sz]e/i.test(t) || e.getAttribute('data-sp-act') === 'connect') { e.setAttribute('data-ac2-named', String(i)); o.push([String(i), e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), t.slice(0, 40), !!(e.offsetWidth || e.offsetHeight)]); i++; } }
          return o; }"""
        def probe_page(actx, pgname, sink, named_only=False):
            pg = actx.new_page(); pg.on("dialog", lambda d: d.dismiss()); prec = {}
            try:
                acap["on"] = False; acap["seen"] = []; cur["page"] = "authprobe:" + pgname
                pg.goto(base + PRE + pgname + "?pfBase=" + base + qs.get(pgname, ""), wait_until="load", timeout=60000)
                pg.wait_for_timeout(2500)
                prec["phase"] = pg.evaluate("() => window.HouseSpotify ? HouseSpotify.get().phase : null")
                if prec["phase"] == "need_auth" and pgname not in ap["need_auth_pages"]: ap["need_auth_pages"].append(pgname)
                for kind, t in pg.evaluate(LINKS2): tap_check(pgname, kind, t, sink)
                acap["on"] = True; acap["frame"] = pg.main_frame; acap["seen"] = []
                named = pg.evaluate(NAMED); prec["named"] = []
                for idx, desc, txt, vis in named:
                    before = len(acap["seen"])
                    try: pg.evaluate("(i) => { const e = document.querySelector('[data-ac2-named=\"' + i + '\"]'); if (e && e.isConnected) e.click(); }", idx)
                    except Exception: pass
                    pg.wait_for_timeout(900)
                    got = acap["seen"][before:]
                    prec["named"].append([desc, txt, vis, [g[:100] for g in got]])
                    ap["named_clicks"].append([pgname, desc, txt, vis, [g[:100] for g in got]])
                    for g in got: tap_check(pgname, "nav from " + desc + " '" + txt + "'", g, sink)
                if not named_only:
                    before = len(acap["seen"])
                    prec["click"] = pg.evaluate(CLICK); pg.wait_for_timeout(1200)
                    for g in acap["seen"][before:]: tap_check(pgname, "nav (tap / location set)", g, sink)
                    opened = pg.evaluate("() => window.__v2jOpen || []")
                    for t in opened: tap_check(pgname, "window.open", t, sink)
                acap["on"] = False
            except Exception as e:
                prec["err"] = str(e)[:200]
            finally:
                acap["on"] = False
                try: pg.close()
                except Exception: pass
            return prec
        for pgname in sorted(out["pages"]):
            actx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, reduced_motion="reduce")
            actx.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); localStorage.setItem('wardos-lights-proxy-token', 'qa-fake-key-v2j-0000'); } catch (e) {}")
            actx.add_init_script(OBS); actx.route("**/*", agate)
            ap["pages"][pgname] = probe_page(actx, pgname, ap)
            actx.close()
        # Dad control (own context, same mock): the Dad-only sheet must reach the authorize URL from its Connect Spotify button
        dctl = {"outbound_auth": [], "offsite": [], "tap_checks": {"targets": 0, "pseudo": 0}}
        actx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, reduced_motion="reduce")
        actx.add_init_script("try { localStorage.setItem('wardos-lights-proxy-token', 'qa-fake-key-v2j-0000'); } catch (e) {}")
        actx.add_init_script(OBS); actx.route("**/*", agate)
        dctl["page"] = probe_page(actx, "sheet-spotify-setup.html", dctl, named_only=True)
        actx.close()
        ap["dad_control"] = dctl
        ap["named_clicks"] = ap["named_clicks"][:60]; ap["outbound_auth"] = ap["outbound_auth"][:60]; ap["offsite"] = ap["offsite"][:60]
        # ADULTCUT1 P3 (Alfred) · positive controls on Dad pages, in their own context (own storage, nothing counted as kid):
        # sheet-allowance with a '$' ledger seeded must light the getItem and JSON.parse sentinels (and the DOM / transient
        # hooks); sheet-spotify-setup must show the credential field CRED looks for. Non-local requests are aborted.
        cctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, reduced_motion="reduce")
        # the seeded legacy house-bank:v1 makes kids-data's own Dad-sheet boot (migrateDadLedger -> ledgerAge) getItem and
        # JSON.parse both '$' ledgers: real page code, not the probe, lights the read sentinels
        cctx.add_init_script("try { var q = 'Lego ' + String.fromCharCode(36) + '45'; if (!localStorage.getItem('dad-ledger:v1')) localStorage.setItem('dad-ledger:v1', JSON.stringify({ _w: 2, _qa: q })); if (!sessionStorage.getItem('qa-seeded')) { sessionStorage.setItem('qa-seeded', '1'); localStorage.setItem('house-bank:v1', JSON.stringify({ _w: 1, _qa: q })); } } catch (e) {}")
        cctx.add_init_script(OBS)
        cctx.route("**/*", lambda route: route.abort() if (urlparse(route.request.url).hostname != "127.0.0.1" or urlparse(route.request.url).port != PORT) else route.continue_())
        out["control"] = {}
        for cname in ("sheet-allowance.html", "sheet-spotify-setup.html"):
            cp = cctx.new_page(); cp.on("dialog", lambda d: d.dismiss()); crec = {}
            try:
                cur["page"] = "control:" + cname
                cp.goto(base + PRE + cname + "?pfBase=" + base, wait_until="load", timeout=60000); cp.wait_for_timeout(2500)
                cst = cp.evaluate(STATE)
                crec = {"reads": cst["reads"], "dom": len(cst["dom"]), "transient": len(cst["transient"]), "cred": cp.evaluate(CRED)}
                # offline the Dad page paints no figure, so one '$' text node is appended and the same STATE scan must see it
                cp.evaluate("() => { const s = document.createElement('span'); s.textContent = 'QA ' + String.fromCharCode(36) + '7'; document.body.appendChild(s); }")
                cp.wait_for_timeout(400); cst2 = cp.evaluate(STATE)
                crec["dom_injected"] = len(cst2["dom"]) + len(cst2["transient"])
            except Exception as e:
                crec["err"] = str(e)[:200]
            finally:
                try: cp.close()
                except Exception: pass
            out["control"][cname] = crec
        cctx.close()
    finally:
        b.close()
srv.shutdown(); srv.server_close()
out["api"] = api; out["secs"] = round(time.time() - t0, 1); out["closure"] = sorted(out["pages"]); out["count"] = len(out["pages"])
out["outside"] = out["outside"][:20]; out["outbound_auth"] = out["outbound_auth"][:60]; out["offsite"] = out["offsite"][:60]
print(json.dumps(out))
