"""R3-1 · every visible chore row ends above the more chip, and every day-tap hits at centre and insets."""
import json, os, re, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
STATE = {"feed": ROOT / "scripts" / "qa" / "fixtures" / "day0-dec4"}
SHOTS = Path("/cursor/stores/self/artifacts")
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
  const vis = (e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 1;
  const cols = [...document.querySelectorAll('section.col')].map(col => {
    const name = (col.getAttribute('aria-label') || ((col.querySelector('.col-name, .col-hdr') || {}).innerText || '')).replace(/\s+/g, ' ').trim();
    const labelOf = (card) => ((card.querySelector('.what') || {}).innerText || '').replace(/\s+/g, ' ').trim();
    const every = [...col.querySelectorAll(':scope .chore-list > .chore')];
    const rows = every.filter(vis);
    const chip = col.querySelector('.more-chip');
    const chipOn = chip && vis(chip);
    const chipTop = chipOn ? chip.getBoundingClientRect().top : 1e9;
    const low = rows.filter(row => row.getBoundingClientRect().bottom > chipTop + 0.5).length;
    const taps = rows.flatMap(row => [...row.querySelectorAll('.day-tap')].filter(vis));
    const misses = [];
    for (const tap of taps) {
      const r = tap.getBoundingClientRect();
      const pts = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + r.width / 2, r.top + 4],
        [r.left + r.width / 2, r.bottom - 4]
      ];
      for (const [x, y] of pts) {
        const h = document.elementFromPoint(Math.min(innerWidth - 1, x), Math.min(innerHeight - 1, y));
        if (!(h && (h === tap || tap.contains(h)))) misses.push((tap.innerText || '').trim());
      }
    }
    return {
      name,
      rows: rows.length,
      all: every.map(labelOf),
      page: rows.map(labelOf),
      chip: chipOn ? (chip.textContent || '').replace(/\s+/g, ' ').trim() : '',
      chipTag: chip ? chip.tagName : '',
      chipH: chipOn ? Math.round(chip.getBoundingClientRect().height) : 0,
      low,
      misses: misses.length
    };
  });
  return { cols };
}"""

def open_chores(pg):
    pg.goto(base + "/sheet-chores.html?pfBase=" + base + "&now=2026-12-04T07:30:00-06:00&freeze=1", wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(3500)
    pg.wait_for_function("""() => {
      var whats = Array.prototype.map.call(document.querySelectorAll('section.col .chore .what'), function (el) { return el.textContent || ''; });
      return whats.length >= 9 && whats.every(function (t) { return t.indexOf('\u00b7') < 0 && t.indexOf('stage') < 0; });
    }""", timeout=45000)

def reset_pages(pg):
    pg.evaluate("""() => {
      document.querySelectorAll('section.col').forEach(function (col) {
        col.setAttribute('data-chore-start', '0');
      });
      if (window.fitChoreColumns) window.fitChoreColumns();
    }""")
    pg.wait_for_timeout(200)

def shot_pages(pg, tag):
    reset_pages(pg)
    pg.screenshot(path=str(SHOTS / ("chores-r4-" + tag + "-p1.png")))
    for kid in ("Ainsley", "Hayes", "Harris"):
        reset_pages(pg)
        pg.evaluate("""(kid) => {
          document.querySelectorAll('section.col').forEach(function (col) {
            const name = ((col.querySelector('.col-name, .col-hdr') || {}).innerText || '');
            if (name.indexOf(kid) < 0) return;
            const chip = col.querySelector('.more-chip');
            if (chip) chip.click();
          });
        }""", kid)
        pg.wait_for_timeout(200)
        pg.screenshot(path=str(SHOTS / ("chores-r4-" + tag + "-" + kid.lower() + "-p2.png")))

def walk(pg):
    reset_pages(pg)
    history = {}
    chips = {}
    for _ in range(8):
        snap = pg.evaluate(JS)["cols"]
        pending = []
        for col in snap:
            if not re.search(r"Ainsley|Hayes|Harris", col["name"]):
                continue
            key = col["name"]
            seen = history.setdefault(key, [])
            if seen and col["page"] == seen[0]["page"]:
                continue
            if not seen:
                chips[key] = {"chip": col["chip"], "chipTag": col["chipTag"], "chipH": col["chipH"], "low": col["low"], "misses": col["misses"], "rows": col["rows"], "all": col["all"]}
            seen.append({"page": col["page"], "chip": col["chip"]})
            if col["chip"]:
                pending.append(key)
        if not pending:
            break
        pg.evaluate("""(names) => {
          document.querySelectorAll('section.col').forEach(function (col) {
            const name = (col.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
            if (names.indexOf(name) < 0) return;
            const chip = col.querySelector('.more-chip');
            if (chip) chip.click();
          });
        }""", pending)
        pg.wait_for_timeout(250)
    cols = []
    for key, pages in history.items():
        meta = chips[key]
        cols.append({
            "name": key,
            "rows": meta["rows"],
            "chip": meta["chip"],
            "chipTag": meta["chipTag"],
            "chipH": meta["chipH"],
            "low": meta["low"],
            "misses": meta["misses"],
            "all": meta["all"],
            "pages": [p["page"] for p in pages],
        })
    return {"cols": cols}

shots = os.environ.get("CHORES_SHOTS") == "1"
out = {}
with sync_playwright() as p:
    br = p.chromium.launch(**launch_kw(p, headless=True))
    c = br.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    c.add_init_script("try{localStorage.setItem('wardos-private-feed-token','r58-box-fixture-key')}catch(e){}")
    pg = c.new_page()
    STATE["feed"] = ROOT / "scripts" / "qa" / "fixtures" / "day0-dec4"
    open_chores(pg)
    if shots:
        shot_pages(pg, "day0")
    out["day0"] = walk(pg)
    STATE["feed"] = ROOT / "scripts" / "qa" / "fixtures" / "overflow-r3"
    open_chores(pg)
    if shots:
        shot_pages(pg, "overflow")
    out["overflow"] = walk(pg)
    br.close()
srv.shutdown()
print(json.dumps(out))
