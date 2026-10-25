"""CAMREST2 · real-browser checks for the hub camera tiles. Usage:
  python3 scripts/qa/camrest_viewport.py <scenario> [width] [height]
  python3 scripts/qa/camrest_viewport.py shot <out.png> <width> <height> <scale>   (screenshot; the path is the caller's, never the repo)
Serves the repo on a loopback port and plays a stub hub (?pfBase=, loopback only). Every other host and port is
answered 503 here, so nothing reaches a real hub, camera proxy or Google. Camera names in the fixture are synthetic
("Qa Porch" ...). Prints one JSON line."""
import json, os, sys, threading, functools, re, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FIX = os.path.join(ROOT, "scripts", "qa", "fixtures", "private")
scenario = sys.argv[1]
SHOT = scenario == "shot"
if SHOT:
    shot_path, w, h, scale = sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])
else:
    w = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    h = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    scale = 1
NAMES = ["Qa Porch", "Qa Drive", "Qa Yard"]
SLUGS = ["qa-a", "qa-b", "qa-c"]
# one tiny real JPEG (1x1 grey) for a still that heals
JPEG = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbd3ffd9")
STATIC_STILLS = scenario in ("static5xx",)
def nest_live():
    snap = (lambda s: "qa-stills/" + s + ".jpg") if STATIC_STILLS else (lambda s: "data/nest-snaps/" + s + ".jpg")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    if scenario == "stateD":   # CAMREST3 · State D: paired, the hub's camera data is hours old (stale) but its old stills still load
        now = datetime.fromtimestamp(time.time() - 3 * 3600, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return {"status": "live", "source": "synthetic", "fetchedAt": now, "cameraCount": 3,
            "cameras": [{"id": "qa-dev-" + s, "name": n, "where": "Camera", "type": "camera", "online": True,
                         "snapshotUrl": snap(s), "snapCapturedAt": now, "streamUrl": None, "traits": [], "rawName": n,
                         "protocols": ["WEB_RTC"]} for s, n in zip(SLUGS, NAMES)]}
hits = {"still": 0, "still_ok": 0, "nest_live": 0, "foreign": 0}
lock = threading.Lock()
STILL_FAILS = {"still5xx": 10 ** 6, "recover": 2, "static5xx": 10 ** 6, "calbad": 0, "shot": 10 ** 6, "feed401": 0, "feed503": 0, "slow": 0, "motion": 10 ** 6, "onebad": 0, "stateD": 0}[scenario]
per = {}
def send(self, code, body=b"", ctype="application/json"):
    self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body)))
    self.send_header("Connection", "close"); self.end_headers(); self.wfile.write(body)
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = urlparse(self.path).path
        m = re.fullmatch(r"/api/private/nest/([a-z0-9-]+)\.jpg", p) or re.fullmatch(r"/qa-stills/([a-z0-9-]+)\.jpg", p)
        if m:
            with lock:
                hits["still"] += 1; per[m.group(1)] = per.get(m.group(1), 0) + 1; n = per[m.group(1)]
            if scenario == "slow": time.sleep(4)   # under PrivateFeed's 6s timeout
            if n <= STILL_FAILS or (scenario == "onebad" and m.group(1) == "qa-b"): return send(self, 500, b"{}")
            with lock: hits["still_ok"] += 1
            return send(self, 200, JPEG, "image/jpeg")
        m = re.fullmatch(r"/api/private/([a-z-]+)\.json", p)
        if m:
            name = m.group(1)
            if name == "nest-live":
                with lock: hits["nest_live"] += 1
                if scenario == "feed401": return send(self, 401, b"{}")
                if scenario == "feed503": return send(self, 503, b"{}")
                return send(self, 200, json.dumps(nest_live()).encode())
            if scenario == "calbad" and name in ("cal-live", "cal-months", "kids-week"): return send(self, 503, b"{}")
            f = os.path.join(FIX, name + ".synthetic.json")
            return send(self, 200, open(f, "rb").read()) if os.path.isfile(f) else send(self, 404, b"{}")
        if re.search(r"(^|/)(data/[^/]+\.json|kids-week\.json)$", p): return send(self, 404, b"")
        return super().do_GET()
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
port = srv.server_address[1]
base = f"http://127.0.0.1:{port}"
TILES = r"""() => { const names = %s; const deck = document.getElementById('hub-cam-deck');
  const vis = el => { for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden') return false; } return true; };
  return { deckVisible: !!deck && vis(deck), tiles: [...document.querySelectorAll('#hub-cam-deck .hub-cam')].map(t => {
    const img = t.querySelector('img.hub-cam-media'), pill = t.querySelector('.hub-cam-pill'), rp = t.querySelector('.hub-cam-rest-pill');
    const blob = t.outerHTML + ' ' + (t.getAttribute('aria-label') || '');
    return { visible: vis(t), resting: t.classList.contains('hub-cam-resting'), restPill: !!rp && vis(rp),
      restWord: rp ? rp.textContent.trim() : '', imgVisible: !!img && vis(img) && getComputedStyle(img).display !== 'none',
      imgOk: !!img && img.complete && img.naturalWidth > 0 && !/^data:/.test(img.getAttribute('src') || ''),
      statusPill: !!pill && vis(pill), why: t.getAttribute('data-rest-why') || '', aria: (t.getAttribute('aria-label') || '').replace(/Qa \w+/g, '<NAME>'),
      names: names.filter(n => blob.includes(n)).length, camId: t.hasAttribute('data-cam-id'), pfCam: !!(img && img.hasAttribute('data-pf-cam')),
      devIds: (blob.match(/qa-dev-/g) || []).length, href: t.getAttribute('href') }; }) }; }""" % json.dumps(NAMES)
STYLE = r"""() => { const p = document.querySelector('.hub-cam-rest-pill'), w = document.querySelector('.hub-cam-rest-word'), d = document.querySelector('.hub-cam-rest-dot'), r = document.querySelector('.hub-cam-rest');
  if (!p || !w) return null; const cs = getComputedStyle(p), ws = getComputedStyle(w), ds = getComputedStyle(d), bs = getComputedStyle(r, '::before'), as = getComputedStyle(r, '::after');
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const fg = rgb(ws.color), bgA = rgb(cs.backgroundColor); const a = bgA[3] == null ? 1 : bgA[3];
  /* worst case: the pill over the brightest art (white) */
  const over = [0, 1, 2].map(i => bgA[i] * a + 255 * (1 - a)); const L1 = lum(fg), L2 = lum(over);
  return { fontPx: parseFloat(ws.fontSize), color: ws.color, border: cs.borderTopColor + ' ' + cs.borderTopWidth, radius: cs.borderRadius,
    bg: cs.backgroundColor, contrastWorst: +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2), artFilter: bs.filter,
    vignette: as.backgroundImage.slice(0, 80), dotAnim: ds.animationName, dotSize: ds.width, family: ws.fontFamily.split(',')[0],
    fit: [...document.querySelectorAll('.hub-cam-rest')].map(x => { const q = x.querySelector('.hub-cam-rest-pill'), wd = x.querySelector('.hub-cam-rest-word');
      return { box: Math.round(x.getBoundingClientRect().width), pill: Math.round(q.getBoundingClientRect().width), shown: getComputedStyle(q).display !== 'none', px: parseFloat(getComputedStyle(wd).fontSize) }; }) }; }"""
out = {"scenario": scenario, "size": f"{w}x{h}"}
with sync_playwright() as pw:
    try: b = pw.chromium.launch(args=["--disable-gpu"])
    except Exception:   # no bundled Chromium here: use the system Chrome (same as gate3)
        import shutil
        b = pw.chromium.launch(executable_path=shutil.which("google-chrome") or shutil.which("chromium"), args=["--disable-gpu", "--no-sandbox"])
    mob = w < 600
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=scale if SHOT else (2 if mob else 1), is_mobile=mob, has_touch=mob,
                        reduced_motion="reduce" if scenario != "motion" else "no-preference")
    pg = ctx.new_page(); errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)[:160]))
    pg.add_init_script("try { localStorage.setItem('wardos-private-feed-token', 'qaSyntheticDeviceKey0000'); } catch (e) {}")
    def gate(route):
        u = urlparse(route.request.url)
        if u.scheme in ("data", "blob"): return route.continue_()
        if u.hostname == "127.0.0.1" and u.port == port: return route.continue_()
        hits["foreign"] += 1
        return route.fulfill(status=503, body="")
    pg.route("**/*", gate)
    pg.clock.install()
    pg.goto(base + "/sheet-index.html?pfBase=" + base, wait_until="load", timeout=120000)
    pg.wait_for_timeout(1500 if scenario == "slow" else 3000)
    def tiles(): return pg.evaluate(TILES)
    if SHOT:
        pg.wait_for_timeout(1500)
        deck = pg.query_selector("#hub-cam-deck")
        if deck: deck.scroll_into_view_if_needed()
        pg.wait_for_timeout(500)
        pg.screenshot(path=shot_path)
        out["t0"] = tiles(); out["style"] = pg.evaluate(STYLE)
    else:
        out["t0"] = tiles()
        if scenario in ("still5xx", "static5xx"):
            for _ in range(3): pg.evaluate("HouseNest.paintHubCamDeck(document)")   # repaints must never un-rest
            out["t_repaint"] = tiles()
            pg.clock.run_for(75000); pg.wait_for_timeout(1500)
            out["t75"] = tiles(); out["style"] = pg.evaluate(STYLE)
        elif scenario == "recover":
            out["still_before"] = hits["still"]
            for step in (16000, 31000, 61000):
                pg.clock.run_for(step); pg.wait_for_timeout(1500)
            out["t_after"] = tiles()
        elif scenario == "slow":
            out["t_loading"] = out["t0"]; pg.wait_for_timeout(6000); out["t_loaded"] = tiles()
        elif scenario in ("feed401", "feed503", "stateD"):
            pg.clock.run_for(20000); pg.wait_for_timeout(1500); out["t20"] = tiles()
        elif scenario == "motion":
            out["style"] = pg.evaluate(STYLE)
    b.close()
srv.shutdown()
out["hits"] = hits; out["errors"] = errors[:5]
print(json.dumps(out))
