#!/usr/bin/env python3
"""WardOS VISTAP gate (Alfred Tier 1, Nov 22 2026). One script, box or cloud, no repo edits.
usage: vistap_gate.py <tree> <feed_dir with feed-*.json> <out_dir> [--now ISO] [--routes a,b] [--shots]
Checks every beta-minimum route at 1920x1080 DPR1 (frozen ?now):
  TXT   visible own text < 24px
  TGT   interactive target < 64px (kid boards: < 96px)
  CLIP  overflow container clips content with no '+N more' cue
  TRUNC text cut by ellipsis (scrollWidth > clientWidth)
  COVER centre of a target or text line is hit by an unrelated element (overlap)
  DEAD  visible control that is disabled / aria-disabled / pointer-events:none (dead offline control)
Exit 0 only if 0 findings. Exit 1 = findings. Exit 2 = harness error (route failed to load)."""
import json, sys, re, threading, hashlib, argparse
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ap = argparse.ArgumentParser(); ap.add_argument("tree"); ap.add_argument("feed"); ap.add_argument("out")
ap.add_argument("--now", default="2026-11-17T07:30:00-06:00"); ap.add_argument("--routes", default="")
ap.add_argument("--shots", action="store_true")
ap.add_argument("--block", default="TXT,TGT,CLIP,TRUNC,COVER,DEAD", help="classes that fail the gate; beta bar (Atlas Nov 22): COVER,TRUNC,DEAD,CLIP")
a = ap.parse_args(); BLOCK = set(a.block.split(","))
T, FEED, OUT = Path(a.tree).resolve(), Path(a.feed).resolve(), Path(a.out); OUT.mkdir(parents=True, exist_ok=True)
BETA = ["sheet-index", "sheet-today", "month", "sheet-chores", "sheet-allowance", "sheet-dan",
        "kid-ainsley", "kid-hayes", "kid-harris", "sheet-lights"]
ROUTES = [r for r in a.routes.split(",") if r] or BETA
sys.path.insert(0, str(T / "scripts/qa"))
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
         ".webp": "image/webp", ".json": "application/json", ".jpg": "image/jpeg", ".woff2": "font/woff2"}
class H(BaseHTTPRequestHandler):
    def log_message(self, *x): pass
    def do_GET(self):
        p = self.path.split("?", 1)[0].lstrip("/") or "index.html"
        m = re.match(r"api/private/([a-z-]+)\.json$", p)
        f = (FEED / ("feed-%s.json" % m.group(1))) if m else (T / p).resolve()
        if not f.is_file() or (not m and T not in f.parents and f != T): self.send_error(404); return
        d = f.read_bytes(); self.send_response(200); self.send_header("Content-Type", TYPES.get(f.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(d))); self.end_headers()
        try: self.wfile.write(d)
        except Exception: pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
base = "http://127.0.0.1:%d" % srv.server_address[1]
J = r"""(kid) => {
 const W = innerWidth, Hh = innerHeight;
 const vis = e => { const c = getComputedStyle(e), r = e.getBoundingClientRect();
   return c.display !== 'none' && c.visibility !== 'hidden' && parseFloat(c.opacity) > 0.05 && r.width > 1 && r.height > 1
     && r.bottom > 0 && r.top < Hh && r.right > 0 && r.left < W && !e.closest('[hidden],[aria-hidden=true]'); };
 const own = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
 const id = e => (e.tagName + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')).slice(0, 60);
 const bx = e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
 const F = []; const add = (k, e, d) => F.push({k, el: id(e), box: bx(e), t: (own(e) || e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40), d});
 const all = [...document.querySelectorAll('body *')].filter(vis);
 const ctl = all.filter(e => e.matches('a[href],button,[role=button],[data-check],input,select,textarea,[onclick],[tabindex]:not([tabindex="-1"])'));
 const ctlTop = ctl.filter(e => !ctl.some(o => o !== e && o.contains(e)));
 const hitOk = (e) => { const r = e.getBoundingClientRect(); const x = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(Hh - 1, Math.max(0, r.top + r.height / 2));
   const h = document.elementFromPoint(x, y); if (!h) return 'nothing';
   if (h === e || e.contains(h)) return null;
   const c = e.closest('a[href],button,[role=button],[data-check],label,[onclick]'); if (c && (c === h || c.contains(h))) return null;
   if (h.contains(e) && getComputedStyle(h).pointerEvents !== 'none' && !h.matches('a[href],button,[role=button],[onclick]')) return null;
   return id(h); };
 for (const e of all) { const t = own(e); if (!t) continue; const fs = parseFloat(getComputedStyle(e).fontSize);
   if (fs < 24) add('TXT', e, fs + 'px');
   const c = getComputedStyle(e); if (c.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) add('TRUNC', e, e.scrollWidth + '>' + e.clientWidth);
   const by = hitOk(e); if (by) { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(Math.min(W-1, r.left + r.width/2), Math.min(Hh-1, r.top + r.height/2));
     const hc = h ? getComputedStyle(h) : null; const clear = hc && /rgba\(0, 0, 0, 0\)|transparent/.test(hc.backgroundColor) && hc.backgroundImage === 'none' && !own(h) && !hc.backdropFilter.match(/blur/);
     if (!clear) add('COVER', e, 'text hit by ' + by); } }
 for (const e of ctlTop) { const r = e.getBoundingClientRect(), m = Math.min(r.width, r.height), floor = kid ? 96 : 64;
   if (m < floor) add('TGT', e, Math.round(r.width) + 'x' + Math.round(r.height) + ' <' + floor);
   const c = getComputedStyle(e);
   if (e.disabled || e.getAttribute('aria-disabled') === 'true' || c.pointerEvents === 'none') add('DEAD', e, 'disabled/no pointer');
   else { const by = hitOk(e); if (by) add('COVER', e, 'target hit by ' + by); } }
 for (const e of all) { if (e.children.length < 1) continue; const c = getComputedStyle(e);
   if (!/(hidden|clip|auto|scroll)/.test(c.overflowY + ' ' + c.overflowX)) continue;
   if (!(e.scrollHeight > e.clientHeight + 4 || e.scrollWidth > e.clientWidth + 4)) continue;
   const scope = e.parentElement || e; if (/\+\s*\d+\s*more/i.test(scope.innerText || '')) continue;
   add('CLIP', e, 'scroll ' + e.scrollWidth + 'x' + e.scrollHeight + ' > ' + e.clientWidth + 'x' + e.clientHeight); }
 const seen = new Set(); return F.filter(f => { const k = f.k + f.el + f.box.join(','); if (seen.has(k)) return false; seen.add(k); return true; }); }"""
res, err, shots = {}, {}, {}
with sync_playwright() as p:
    br = p.chromium.launch(**launch_kw(p, headless=True))
    for r in ROUTES:
        c = br.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        c.add_init_script("try{localStorage.setItem('wardos-private-feed-token','r58-box-fixture-key')}catch(e){}")
        pg = c.new_page()
        try:
            resp = pg.goto("%s/%s.html?pfBase=%s&now=%s&freeze=1" % (base, r, base, a.now.replace("+", "%2B")), wait_until="domcontentloaded", timeout=30000)
            if not resp or resp.status != 200: raise RuntimeError("HTTP %s" % (resp.status if resp else None))
            pg.wait_for_timeout(3500)
            res[r] = pg.evaluate(J, r.startswith("kid-"))
            if a.shots:
                f = OUT / ("golden-%s.png" % r); pg.screenshot(path=str(f)); shots[r] = hashlib.sha256(f.read_bytes()).hexdigest()
        except Exception as e:
            err[r] = str(e)[:200]
        c.close()
        x = res.get(r, []); cnt = {}
        for f in x: cnt[f["k"]] = cnt.get(f["k"], 0) + 1
        print("%-16s %s" % (r, ("ERROR " + err[r]) if r in err else (" ".join("%s=%d" % kv for kv in sorted(cnt.items())) or "clean")), flush=True)
    br.close()
srv.shutdown()
(OUT / "vistap.json").write_text(json.dumps({"tree": str(T), "now": a.now, "routes": ROUTES, "findings": res, "errors": err, "golden_sha256": shots}, indent=1))
if shots: (OUT / "GOLDEN-SHA256SUMS").write_text("".join("%s  golden-%s.png\n" % (h, r) for r, h in shots.items()))
n = sum(len(v) for v in res.values()); nb = sum(1 for v in res.values() for f in v if f["k"] in BLOCK)
print("VISTAP total findings %d, blocking %d (%s), errors %d" % (n, nb, ",".join(sorted(BLOCK)), len(err)))
sys.exit(2 if err else (1 if nb else 0))
