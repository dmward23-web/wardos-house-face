"""LDAWAY1 + AINSNOSCORE2 · real-browser checks for sheet-load-day (away rules) and sheet-allowance (Ainsley's jar hero).
Usage: python3 scripts/qa/ldjar_viewport.py <load-day|allowance|kid-ainsley|chores> <feed|nofeed|slow|trusted|other|bad> [width] [height]
Serves the repo on a random loopback port and plays the hub on the same port (?pfBase=, loopback only) with the
synthetic fixtures in scripts/qa/fixtures/private (Smith/QXS stand-ins). 'nofeed' answers every feed with 404, so the
page has no month data; 'slow' answers after 5 s; 'trusted' / 'other' set kids.ainsley.jarState to trusted / empty; 'bad' answers kids-week with unreadable JSON. A fake key in a fresh browser profile; non-loopback requests get 204.
Prints one JSON line."""
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); from pw_chrome import launch_kw
import json, os, sys, threading, functools, time, re
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FIX = os.path.join(ROOT, "scripts", "qa", "fixtures", "private")
page = mode = None
w = h = 0
NOW = os.environ.get("LDNOW", "2026-10-20T16:00:00-05:00")
hits = []
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = urlparse(self.path).path
        if p.startswith("/api/private/"):
            box = getattr(self.server, "box", None)
            mode_now = box["mode"] if box else mode
            hit_list = box["hits"] if box else hits
            m = re.fullmatch(r"/api/private/([a-z-]+)\.json", p)
            f = m and os.path.join(FIX, m.group(1) + ".synthetic.json")
            if mode_now != "nofeed" and f and os.path.isfile(f):
                hit_list.append(m.group(1))
                if mode_now == "slow": time.sleep(5)
                # CAMREST4 · AINSJAR1 race: a loopback feed can paint EMPTY before the domcontentloaded sample, so that
                # "pre-data" sample was not pre-data (failed 1 in 3 on base 239004c8 and on tip). Hold the jarState feed 1.5 s.
                if mode_now in ("trusted", "other") and m.group(1) == "kids-week": time.sleep(1.5)
                body = open(f, "rb").read()
                if mode_now in ("trusted", "other") and m.group(1) == "kids-week":
                    d = json.loads(body); d.setdefault("kids", {}).setdefault("ainsley", {})["jarState"] = "trusted" if mode_now == "trusted" else "empty"; body = json.dumps(d).encode()
                if mode_now == "bad" and m.group(1) == "kids-week": body = b"{not json"
                self.send_response(200); self.send_header("Content-Type", "application/json")
            else:
                body = b"{}"; self.send_response(404)
            self.send_header("Content-Length", str(len(body))); self.send_header("Connection", "close"); self.end_headers()
            self.wfile.write(body); return
        return super().do_GET()
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}"
VIS = "const vis = el => { for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden') return false; } const r = el.getBoundingClientRect(); return r.width >= 1 && r.height >= 1; };"
LD = "() => { " + VIS + r""" const KID = /\b(Hayes|Harris|Ainsley)\b/, CLK = /\b\d{1,2}:\d{2}\b/;
  const kidTimes = [...document.querySelectorAll('.pack-item, .beat, .glance-row, .loadband-title, .loadband-sub')].filter(vis).map(e => e.innerText.replace(/\s+/g, ' ').trim()).filter(t => KID.test(t) && CLK.test(t));
  return { kidsAway: document.documentElement.classList.contains('kids-away'), hasMonths: !!(window.AwayFilter && AwayFilter.hasMonths()),
    kidItemsShown: [...document.querySelectorAll('[data-away-kid]')].filter(vis).length, kidItems: document.querySelectorAll('[data-away-kid]').length,
    hidden: document.querySelectorAll('[data-away-hidden]').length, kidTimes }; }"""
AL = r"""() => { const STAR = /[\u2605\u2606\u272d\u2b50]/, D = /\d/;
  const s = document.querySelector('.bank.ainsley .star-count'), b = s && s.querySelector('.star-big'), k = document.querySelector('.bank.ainsley');
  const pseudo = k ? [...k.querySelectorAll('*')].map(e => [getComputedStyle(e, '::before').content, getComputedStyle(e, '::after').content]).flat().filter(c => c && c !== 'none' && c !== 'normal').join(' ') : '';
  /* DAYPKG1 v2i · Dad's weekly figure ([data-dad-wk], Atlas v2g: next to each kid's Paid hold on the ward-money=dad page) is Dad's
     money, not her jar: it is reported apart as dadWk and checked for its own shape; her rows stay star and digit free */
  const dwEl = k && k.querySelector('[data-dad-wk]'), dadWk = dwEl && !dwEl.hidden ? dwEl.innerText.trim() : '';
  const t = k ? ((dadWk ? k.innerText.replace(dadWk, ' ') : k.innerText) + ' ' + pseudo).replace(/\s+/g, ' ') : '';
  return { hero: s ? s.innerText.replace(/\s+/g, ' ').trim() : null, big: b ? b.innerText.trim() : null, digit: s ? D.test(s.innerText) : null,
    icon: b ? !!b.querySelector('svg,use,.s') : null, state: (() => { const e = k && k.querySelector('.star-count [data-jar-state]'); return e ? e.textContent.trim() : null; })(), bank: k ? { star: STAR.test(t), digit: D.test(t), text: t.slice(0, 300), dadWk } : null }; }"""
KA = r"""() => { const STAR = /[\u2605\u2606\u272d\u2b50]/, D = /\d/;
  const vis = el => { for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden') return false; } const r = el.getBoundingClientRect(); return r.width >= 1 && r.height >= 1; };
  const texts = (root, skip) => { const o = []; if (!root) return o; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const el = n.parentElement, t = n.nodeValue.trim(); if (!t || !el || el.closest('script,style') || (skip && el.closest(skip)) || !vis(el)) continue; o.push(t); }
    for (const el of root.querySelectorAll('*')) { if (!vis(el)) continue; for (const ps of ['::before', '::after']) { const c = getComputedStyle(el, ps).content; if (c && c !== 'none' && c !== 'normal') o.push(c); } }
    return o; };
  const all = texts(document.body).filter(t => STAR.test(t));
  const jar = document.querySelector('#sec-jar'), musts = document.querySelector('#sec-musts');
  const jd = texts(jar).filter(t => D.test(t)), md = texts(musts, '.what').filter(t => D.test(t) || STAR.test(t));
  const st = jar && jar.querySelector('[data-jar-state]');
  return { stars: all.slice(0, 6), jarDigits: jd.slice(0, 6), mustsDigits: md.slice(0, 6), state: st && vis(st) ? st.textContent.trim() : null,
    stateUnderLabel: !!(st && jar.querySelector('.bank-title') && (jar.querySelector('.bank-title').compareDocumentPosition(st) & 4)),
    progress: document.querySelectorAll('[data-progress-meta],[data-left-count],[data-bank-life],[data-bank-symbol]').length }; }"""
KC = r"""() => { const STAR = /[\u2605\u2606\u272d\u2b50]/, D = /\d/;
  const sec = document.querySelector('section[aria-label="Ainsley chores"]'); if (!sec) return { missing: 1 };
  const vis = el => { for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden') return false; } return true; };
  const o = []; const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const el = n.parentElement, t = n.nodeValue.trim(); if (t && el && vis(el)) o.push(t); }
  for (const el of sec.querySelectorAll('*')) { if (!vis(el)) continue; for (const ps of ['::before', '::after']) { const c = getComputedStyle(el, ps).content; if (c && c !== 'none' && c !== 'normal') o.push(c); } }
  return { star: o.filter(t => STAR.test(t)).slice(0, 6), digit: o.filter(t => D.test(t)).slice(0, 6), rows: sec.querySelectorAll('.chore').length, starIcons: [...sec.querySelectorAll('use')].filter(u => /star/.test(u.getAttribute('href') || '') && vis(u)).length }; }"""
def run_case(b, base, page, mode_name, w, h, now, box=None):
    stamp = now or "2026-10-20T16:00:00-05:00"
    if box is None:
        global mode, hits
        mode = mode_name
        hits = []
    else:
        box["mode"] = mode_name
        box["hits"] = []
    mode = mode_name
    out = {"page": page, "mode": mode, "size": f"{w}x{h}"}
    mob = w < 600
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, reduced_motion="reduce")
    try:
        pg = ctx.new_page(); errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)[:160]))
        pg.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
        def gate(route):
            if urlparse(route.request.url).hostname != "127.0.0.1": return route.fulfill(status=204, body="")
            return route.continue_()
        pg.route("**/*", gate)
        pg.clock.install(time=stamp)
        if page == "load-day":
            pg.goto(base + "/sheet-load-day.html?now=" + stamp.replace("+", "%2B") + "&pfBase=" + base, wait_until="load", timeout=120000)
            pg.wait_for_timeout(9000 if mode == "slow" else 4000)
            out["state"] = pg.evaluate(LD)
        else:
            samples = []; Jx = {"allowance": AL, "kid-ainsley": KA, "chores": KC}[page]
            url = {"allowance": "/sheet-allowance.html?now=" + stamp.replace("+", "%2B") + "&pfBase=", "chores": "/sheet-chores.html?pfBase=",
                   "kid-ainsley": "/kid-ainsley.html?now=" + stamp.replace("+", "%2B") + "&pfBase="}[page]
            pg.goto(base + url + base, wait_until="domcontentloaded", timeout=120000)
            samples.append(pg.evaluate(Jx))
            for t in [300, 2000]:
                pg.wait_for_timeout(t); samples.append(pg.evaluate(Jx))
            if page == "allowance" and mode not in ("nofeed", "bad"):
                pg.wait_for_function("() => document.documentElement.hasAttribute('data-jar-settled')", timeout=90000)
            elif page in ("allowance", "kid-ainsley"):
                pg.wait_for_function("() => document.documentElement.hasAttribute('data-jar-settled')", timeout=90000)
            else:
                pg.wait_for_timeout(7000 if mode == "slow" else 4000)
            samples.append(pg.evaluate(Jx))
            out["samples"] = samples
        out["hub_hits"] = len(box["hits"] if box is not None else hits); out["errors"] = errors[:5]
        return out
    finally:
        ctx.close()

def serve(sock_path):
    import socket, queue
    jobs = queue.Queue()
    def worker():
        box = {"mode": "feed", "hits": []}
        srvw = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
        srvw.box = box
        threading.Thread(target=srvw.serve_forever, daemon=True).start()
        basew = "http://127.0.0.1:%d" % srvw.server_address[1]
        with sync_playwright() as p:
            b = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
            try:
                while True:
                    item = jobs.get()
                    if item is None: break
                    conn, job = item
                    try:
                        out = run_case(b, basew, job["page"], job["mode"], int(job["w"]), int(job["h"]), job.get("now") or "", box)
                    except Exception as e:
                        out = {"error": str(e)[:300]}
                    try: conn.sendall((json.dumps(out) + "\n").encode())
                    finally: conn.close()
            finally:
                b.close()
    for _ in range(3):
        threading.Thread(target=worker, daemon=True).start()
    if os.path.exists(sock_path): os.remove(sock_path)
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.bind(sock_path); s.listen(16)
    try:
        while True:
            conn, _ = s.accept()
            data = b""
            while b"\n" not in data:
                chunk = conn.recv(1 << 20)
                if not chunk: break
                data += chunk
            if not data.strip() or data.strip() == b"bye":
                conn.close()
                for _ in range(3): jobs.put(None)
                break
            try: jobs.put((conn, json.loads(data.decode())))
            except Exception as e:
                conn.sendall((json.dumps({"error": str(e)[:200]}) + "\n").encode()); conn.close()
    finally:
        s.close()
        try: os.remove(sock_path)
        except OSError: pass

if len(sys.argv) > 1 and sys.argv[1] == "--client":
    import socket
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.connect(sys.argv[2])
    sock.sendall(sys.stdin.buffer.read() + b"\n")
    buf = b""
    while b"\n" not in buf:
        chunk = sock.recv(1 << 20)
        if not chunk: break
        buf += chunk
    sys.stdout.buffer.write(buf.split(b"\n", 1)[0] + b"\n")
    sys.exit(0)
if len(sys.argv) > 1 and sys.argv[1] == "--serve":
    serve(sys.argv[2]); srv.shutdown(); sys.exit(0)
page, mode = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 440
h = int(sys.argv[4]) if len(sys.argv) > 4 else 956
NOW = os.environ.get("LDNOW", NOW)
with sync_playwright() as p:
    b = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
    out = run_case(b, base, page, mode, w, h, NOW)
    b.close()
srv.shutdown()
print(json.dumps(out))
