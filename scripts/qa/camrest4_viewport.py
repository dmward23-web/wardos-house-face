"""CAMREST4 · real-browser checks: the Harris kid light pad on the world (revoked key says Not connected; a paired
pad tap writes through the shared lights path) and the resting cam tiles (no clipped element). Usage:
  (CAMREST5 adds lights0/lights401 on sheet-lights and the "cr5" probe: pad clip, tap overlap, sub-14 text)
  python3 scripts/qa/camrest4_viewport.py <kid401|kid0|kidC|rest|ctl-hayes|ctl-harris|ctl-ainsley|lights0|lights401> [width] [height]
Serves the repo on a loopback port. The hub and the private feed are mocked in the browser; every other host is
aborted, so nothing reaches a real hub, camera or Google. Keys and pair codes are fake. Prints one JSON line."""
import json, os, re, sys, threading, functools, time
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
scenario = sys.argv[1]
w = int(sys.argv[2]) if len(sys.argv) > 2 else 440
h = int(sys.argv[3]) if len(sys.argv) > 3 else 956
PF = "http://127.0.0.1:9"  # private feed base: always answered by the route mock below, never dialled
KEY = "qa-fake-key-" + "0" * 20
REVOKED = "qa-revoked-key-" + "0" * 17
CODE = "qafakecode" + "0" * 14
src = open(os.path.join(ROOT, "house-lights.js")).read()
DECK = [re.search(r"id\s*:\s*[\"']([^\"']+)", e).group(1) for e in re.findall(r"\{[^{}]*\}", re.search(r"HUB_DECK\s*=\s*\[(.*?)\];", src, re.S).group(1)) if re.search(r"live\s*:\s*true", e)]
IDS = list(dict.fromkeys(["harris-room"] + DECK))[:3]
def lights(on=False):
    t = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return {"status": "live", "source": "qa", "fetchedAt": t, "writeSupported": True, "reserved": [],
            "lights": [{"id": i, "name": "Qa Lamp %d" % n if n else "Room Lamp", "where": "x", "kind": "plug", "on": on, "brightness": None, "online": True} for n, i in enumerate(IDS)]}
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
O = "http://127.0.0.1:%d" % srv.server_address[1]
PROBE = """() => {
  const vis = e => { if (!e) return false; let n = e; while (n && n.nodeType === 1) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; n = n.parentElement; }
    const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
  const pill = document.querySelector('.kid-light-pad .light-pad-state');
  const rk = document.querySelector('.kid-light-pad .cmd-rocker');
  let hit = null; if (rk) { const r = rk.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); hit = !!(t && (t === rk || rk.contains(t))); }
  const tiles = [...document.querySelectorAll('.hub-cam-rest')].filter(vis);
  const clipped = [];
  for (const z of tiles) for (const e of [z, ...z.querySelectorAll('*')]) {
    if (!vis(e)) continue; const cs = getComputedStyle(e);
    const txt = (e.textContent || '').trim().length > 0;
    if ((cs.overflow + cs.overflowX).includes('hidden') && e.scrollWidth > e.clientWidth + 1) clipped.push('scroll:' + e.className);
    if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && txt) clipped.push('ellipsis:' + e.className);
    const tr = z.getBoundingClientRect(), r = e.getBoundingClientRect();
    if (e !== z && txt && (r.left < tr.left - 0.5 || r.right > tr.right + 0.5 || r.top < tr.top - 0.5 || r.bottom > tr.bottom + 0.5)) clipped.push('outside:' + e.className);
  }
  return { kwOn: document.body.classList.contains('kw-on'), padVisible: vis(document.querySelector('.kid-light-pad')),
    pillText: pill ? pill.textContent.trim() : null, pillVisible: vis(pill), rockerEnabled: !!(rk && !rk.disabled), rockerHit: hit,
    restTiles: tiles.length, restOverflow: tiles.map(t => getComputedStyle(t).overflowX), clipped,
    restFit: tiles.map(t => { const a = t.getBoundingClientRect(), b = t.parentElement.getBoundingClientRect(); return a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && t.offsetWidth <= t.parentElement.clientWidth; }),
    /* every visible kid control on the world: the point at its centre must be the control (no canvas on top) */
    controls: [...document.querySelectorAll('.kw-stage button, .kw-stage a[href], .kw-stage [role=button], .kw-stage input')].filter(e => vis(e) && !e.disabled).map(e => {
      const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { c: String(e.className || e.tagName).slice(0, 40), ok: !!(t && (t === e || e.contains(t))), top: t ? String(t.className || t.tagName).slice(0, 40) : null }; }) };
}"""
P5 = """() => {
  /* CAMREST5 · own-style visibility (an element counts unless it or an ancestor is display:none, or it is visibility:hidden),
     as the gate's tap metric does: a control under a hidden panel still counts */
  const shown = e => { for (let n = e; n && n.nodeType === 1; n = n.parentElement) if (getComputedStyle(n).display === 'none') return false;
    const r = e.getBoundingClientRect(); return getComputedStyle(e).visibility !== 'hidden' && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const vis = e => { for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return false; }
    const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const nm = e => (e.tagName + '.' + String(e.className || '')).slice(0, 60);
  const taps = [...document.querySelectorAll('a[href],button,[role="button"],[role=switch],[onclick],input,select,.chip,[data-href],[tabindex="0"]')].filter(shown);
  const pad = document.querySelector('.kw-light .kid-light-pad'), path = document.querySelector('.kw-path');
  const mine = e => (pad && pad.contains(e)) || e === path;
  const ov = [];
  for (const a of taps) if (mine(a)) for (const b of taps) { if (a === b || a.contains(b) || b.contains(a) || (pad && pad.contains(a) && pad.contains(b))) continue;
    const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); const x = Math.min(r.right, q.right) - Math.max(r.left, q.left), y = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
    if (x > 0 && y > 0) ov.push(nm(a) + ' x ' + nm(b) + ' ' + Math.round(x) + 'x' + Math.round(y)); }
  let gap = null;
  if (pad && path) { const r = pad.getBoundingClientRect(), q = path.getBoundingClientRect(); gap = Math.round(q.left - r.right); }
  const st = document.querySelector('.kw-light .light-pad-state');
  const lp = [...document.querySelectorAll('.lights-cmd article.light-pad')].filter(vis);
  const lclip = [];
  for (const z of lp) for (const e of [z, ...z.querySelectorAll('*')]) { if (!vis(e)) continue; const c = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && ((c.overflow + c.overflowX).match(/hidden|clip/) || c.textOverflow === 'ellipsis')) lclip.push(nm(e) + ' ' + e.scrollWidth + '/' + e.clientWidth); }
  const small = [];
  for (const e of document.querySelectorAll('body *')) { if (!vis(e)) continue; if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const f = parseFloat(getComputedStyle(e).fontSize); if (f < 14) small.push(nm(e) + ' ' + f); }
  return { tapOverlap: ov, padPathGap: gap, padStateFont: st ? parseFloat(getComputedStyle(st).fontSize) : null, padStateText: st ? st.textContent.trim() : null,
    lightPads: lp.length, lightClip: lclip, lightSrc: lp.map(z => { const s = z.querySelector('.light-pad-src'); return s && vis(s) ? s.textContent.trim() : null; }).filter(Boolean),
    sub14: small.length, sub14List: small.slice(0, 60), camLabelSmall: [...document.querySelectorAll('.hub-cam-label')].filter(e => vis(e) && parseFloat(getComputedStyle(e).fontSize) < 14).length };
}"""
out = {"scenario": scenario, "w": w, "errors": [], "writes": 0}
with sync_playwright() as p:
    b = p.chromium.launch(**launch_kw(p, args=["--disable-gpu"]))
    vp = dict(viewport={"width": w, "height": h})
    if w <= 600: vp.update(device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx = b.new_context(timezone_id="America/Chicago", reduced_motion="reduce", **vp)
    st = {"on": False}
    def route(r):
        u = r.request.url; base = u.split("?")[0]
        if base.startswith(PF):
            return r.fulfill(status=401, body="{}") if scenario != "kidC" else (
                r.fulfill(status=200, content_type="application/json", body=json.dumps(lights(st["on"]))) if "lights-live.json" in base else r.fulfill(status=404, body="{}"))
        if u.startswith((O + "/", "data:", "blob:")): return r.continue_()
        if base.endswith("/api/pair/mint"): return r.fulfill(status=403, content_type="application/json", body='{"ok":false}')
        if base.endswith("/api/pair") and scenario == "kidC": return r.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "key": KEY}))
        if base.endswith("/health"):
            if scenario in ("kid401", "lights401"): return r.fulfill(status=401, content_type="application/json", body='{"ok":false,"error":"unauthorized"}')
            if scenario == "kidC": return r.fulfill(status=200, content_type="application/json", body='{"ok":true,"writeSupported":true,"lightsWrite":true,"service":"lights-write-proxy"}')
        if base.endswith("/api/lights/set") and scenario == "kidC":
            out["writes"] += 1; st["on"] = not st["on"]; L = lights(st["on"]); L["ok"] = True
            return r.fulfill(status=200, content_type="application/json", body=json.dumps(L))
        if base.endswith("/api/lights"):
            if scenario in ("kid401", "lights401"): return r.fulfill(status=401, body="{}")
            if scenario == "kidC": return r.fulfill(status=200, content_type="application/json", body=json.dumps(lights(st["on"])))
        return r.abort()
    ctx.route("**/*", route)
    if scenario in ("kid401", "lights401"):
        ctx.add_init_script("try{localStorage.setItem('wardos-lights-proxy-token',%s)}catch(e){}" % json.dumps(REVOKED))
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: out["errors"].append(str(e)[:200]))
    pg.clock.install(time=datetime.now(timezone.utc))
    page = "sheet-lights.html" if scenario.startswith("lights") else "sheet-index.html" if scenario == "rest" else ("kid-" + scenario[4:] + ".html" if scenario.startswith("ctl-") else "kid-harris.html")
    if scenario == "kidC":
        pg.goto(O + "/" + page + "?pfBase=" + PF + "#pair=" + CODE, wait_until="load")
        try:
            pg.wait_for_selector("[data-pair-go]", timeout=5000)
            with pg.expect_navigation(timeout=15000): pg.click("[data-pair-go]")
            pg.wait_for_load_state("load")
        except Exception as e: out["redeem"] = str(e)[:80]
    else:
        pg.goto(O + "/" + page + "?pfBase=" + PF, wait_until="load")
    pg.wait_for_timeout(2500); pg.clock.fast_forward(61000); pg.wait_for_timeout(500); pg.clock.fast_forward(1000); pg.wait_for_timeout(1200)
    out["t0"] = pg.evaluate(PROBE)
    out["cr5"] = pg.evaluate(P5)
    if scenario == "kidC":
        rk = pg.query_selector(".kid-light-pad .cmd-rocker")
        if rk:
            bb = rk.bounding_box()
            if bb: pg.mouse.click(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
            pg.wait_for_timeout(1500)
        out["t1"] = pg.evaluate(PROBE)
    ctx.close(); b.close()
srv.shutdown()
print(json.dumps(out))
