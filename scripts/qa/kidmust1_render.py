"""KIDMUST1 · Day-0 must rows on the three kid boards at 1920x1080.
Prints one JSON object: per kid, total, visible, hidden, chip text, hit-tests, overlaps, truncation.
"""
import json, os, re, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
STATE = {"feed": ROOT / "scripts" / "qa" / "fixtures" / "day0-dec4"}
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
         ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp"}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass
    def do_GET(self):
        p = self.path.split("?", 1)[0].lstrip("/") or "index.html"
        m = re.match(r"api/private/([a-z-]+)\.json$", p)
        f = (STATE["feed"] / ("feed-%s.json" % m.group(1))) if m else (ROOT / p).resolve()
        if not f.is_file() or (not m and ROOT not in f.parents and f != ROOT):
            self.send_error(404)
            return
        d = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(f.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(d)))
        self.end_headers()
        try:
            self.wfile.write(d)
        except Exception:
            pass

srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d" % srv.server_address[1]
JS = r"""() => {
  const vis = (e) => {
    const c = getComputedStyle(e), r = e.getBoundingClientRect();
    return c.display !== 'none' && c.visibility !== 'hidden' && parseFloat(c.opacity) > 0.05 && r.width > 1 && r.height > 1;
  };
  const rows = [...document.querySelectorAll('#sec-musts .quest, #sec-musts .chore')].filter(e => !e.classList.contains('must-more'));
  const shown = rows.filter(vis);
  const hidden = rows.filter(e => !vis(e));
  const chip = document.querySelector('#sec-musts .must-more');
  const chipOn = chip && vis(chip);
  const hit = (e) => {
    const r = e.getBoundingClientRect();
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const h = document.elementFromPoint(x, y);
    return !!(h && (h === e || e.contains(h)));
  };
  const overlap = (a, b) => {
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return x > 8 && y > 8;
  };
  const jar = document.querySelector('#sec-jar, .prism-jar');
  const days = document.getElementById('sec-days');
  const blocks = [jar, days].filter(Boolean);
  const hits = shown.map(e => hit(e));
  const overs = [];
  for (const row of shown) {
    const r = row.getBoundingClientRect();
    for (const b of blocks) {
      if (row.contains(b) || b.contains(row)) continue;
      if (overlap(r, b.getBoundingClientRect())) overs.push((row.querySelector('.what') || row).innerText.slice(0, 24));
    }
    for (const tap of document.querySelectorAll('.day-tap')) {
      if (row.contains(tap)) continue;
      if (overlap(r, tap.getBoundingClientRect())) overs.push('tap');
    }
  }
  let chipOver = false;
  if (chipOn) {
    const r = chip.getBoundingClientRect();
    for (const b of blocks) if (overlap(r, b.getBoundingClientRect())) chipOver = true;
  }
  const trunc = [];
  for (const row of shown) {
    const t = row.querySelector('.what');
    if (!t) continue;
    if (t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1) trunc.push(t.innerText.slice(0, 24));
  }
  const home = document.querySelector('a.wardos-home');
  let homeHit = false;
  if (home) {
    const hr = home.getBoundingClientRect();
    const hh = document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2);
    homeHit = !!(hh && (hh === home || home.contains(hh)));
  }
  return {
    kid: document.body.getAttribute('data-kid'),
    total: rows.length,
    visible: shown.length,
    hidden: hidden.length,
    titles: shown.map(e => ((e.querySelector('.what') || e).innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 12),
    chip: chipOn ? (chip.textContent || '').replace(/\s+/g, ' ').trim() : '',
    chipH: chipOn ? Math.round(chip.getBoundingClientRect().height) : 0,
    rowHits: hits.every(Boolean),
    chipHit: chipOn ? hit(chip) : hidden.length === 0,
    overlaps: overs,
    chipOver,
    trunc,
    homeHit
  };
}"""

def shoot(pg, drop=False):
    if drop:
        pg.evaluate("() => { const r = document.querySelector('#sec-musts .quest'); if (r) r.remove(); }")
    return pg.evaluate(JS)

def boards(pg, drop=False):
    out = {}
    for kid in ("kid-ainsley", "kid-hayes", "kid-harris"):
        pg.goto("%s/%s.html?pfBase=%s&now=2026-12-04T07:30:00-06:00&freeze=1" % (base, kid, base), wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(3500)
        out[kid] = shoot(pg, drop)
    return out

out = {"day0": {}, "overflow": {}, "tap": {}}
with sync_playwright() as p:
    br = p.chromium.launch(**launch_kw(p, headless=True))
    ctx = br.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    ctx.add_init_script("try{localStorage.setItem('wardos-private-feed-token','r58-box-fixture-key')}catch(e){}")
    pg = ctx.new_page()
    STATE["feed"] = ROOT / "scripts" / "qa" / "fixtures" / "day0-dec4"
    out["day0"] = boards(pg, os.environ.get("KIDMUST_DROP") == "1")
    STATE["feed"] = ROOT / "scripts" / "qa" / "fixtures" / "overflow-r3"
    out["overflow"] = boards(pg, False)
    pg.goto("%s/kid-hayes.html?pfBase=%s&now=2026-12-04T07:30:00-06:00&freeze=1" % (base, base), wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(2500)
    before = pg.evaluate(JS)
    hidden_title = ""
    pg.evaluate("""() => {
      const vis = (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 1;
      const rows = [...document.querySelectorAll('#sec-musts .quest')];
      const hid = rows.find(e => !vis(e));
      window.__hid = hid ? ((hid.querySelector('.what') || hid).innerText || '').replace(/\s+/g, ' ').trim() : '';
    }""")
    hidden_title = pg.evaluate("() => window.__hid || ''")
    pg.click("#sec-musts .must-more")
    pg.wait_for_timeout(400)
    mid = pg.evaluate(JS)
    pg.click("#sec-musts .must-more")
    pg.wait_for_timeout(400)
    after = pg.evaluate(JS)
    out["tap"] = {"before": before.get("chip"), "mid": mid.get("chip"), "after": after.get("chip"),
                  "hid": hidden_title, "midTitles": mid.get("titles"), "home": mid.get("homeHit"),
                  "chipH": before.get("chipH")}
    br.close()
srv.shutdown()
print(json.dumps(out))
