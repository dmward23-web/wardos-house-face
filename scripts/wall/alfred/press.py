"""GATE RULE 10/2: REAL data at the CURRENT clock (PRESS_CLOCK pins it; PRESS_FX fixtures are extra runs that never count).
Usage: python3 scripts/wall/alfred/press.py <worktree> <outdir>
PRESS-01 (Alfred, independent): enumerate every visible tappable / tappable-looking thing on wall.html and press each one.
Read-only: GET only, local host only (external requests aborted), fresh browser context per press.
PREVIEW-USE (CLIP1 10/2, defaults off): PRESS_ALLOW=<regex> also lets GETs to matching outside URLs through (the preview's
live data); PRESS_LOUD=1 also fails a press that puts anything loud on the face (an error / failed / refused / denied /
try again / could not line, undefined / NaN / null, a role=alert box), records the writes the preview guard refused
(window.__previewBlocked), and notes (never fails) the quiet setup states a keyless preview shows (NEED KEY, read only, offline)."""
import json, re, sys, csv, socket, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright
WT = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
VPS = [(1920, 1080), (2560, 1440)]
s = socket.socket(); s.bind(("127.0.0.1", 0)); PORT = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "-d", str(WT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
BASE = f"http://127.0.0.1:{PORT}/"; WALL = BASE + "wall.html"
ENUM = r"""() => {
 const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (r.width < 4 || r.height < 4) return false;
   if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05) return false;
   if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
   for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; if (a.hidden) return false; }
   const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
   const top = document.elementFromPoint(x, y); return !!top && (top === e || e.contains(top) || top.contains(e)); };
 const path = e => { const p = []; for (let a = e; a && a !== document.body; a = a.parentElement) { if (a.id) { p.unshift('#' + CSS.escape(a.id)); break; }
   let i = 1, s = a; while ((s = s.previousElementSibling)) if (s.tagName === a.tagName) i++; p.unshift(a.tagName.toLowerCase() + ':nth-of-type(' + i + ')'); } return p.join('>'); };
 const INTER = 'a[href],button,input,select,textarea,[role=button],[role=link],[onclick],[data-go],[tabindex]:not([tabindex="-1"])';
 const isInter = e => e.matches(INTER) || getComputedStyle(e).cursor === 'pointer';
 const out = [], seen = new Set();
 const all = [...document.querySelectorAll('body *')];
 for (const e of all) {
   if (!isInter(e) || !vis(e)) continue;
   let p = e.parentElement, inner = false; while (p) { if (p.matches && (p.matches(INTER) || getComputedStyle(p).cursor === 'pointer') && vis(p)) { inner = true; break; } p = p.parentElement; }
   if (inner) continue;
   out.push({ kind: 'interactive', el: e });
 }
 const covered = e => out.some(o => o.el === e || o.el.contains(e));
 const KID = /^(Harris|Hayes|Ainsley)$/;
 for (const e of all) {
   if (covered(e) || !vis(e)) continue;
   const t = (e.innerText || '').trim(); if (!t || t.length > 40 || e.children.length > 2) continue;
   const cls = (e.className && e.className.baseVal === undefined ? e.className : '') + ' ' + e.id;
   const inTile = e.closest('[data-tile],[data-tile-id],.mod,.act,.seat');
   let why = null;
   if (KID.test(t) && e.closest('.seat,[data-tile*=seat],[data-kid]')) why = 'kid name';
   else if (/next-?up|w-next/i.test(cls) || /^Next up$/i.test(t)) why = 'NEXT UP';
   else if (inTile && (/^h[1-4]$/i.test(e.tagName) || /(^|\s|-)(t|ttl|title|head|hd|kick|kicker|lbl|label|name)(\s|$)/.test(cls)) && t.length <= 30) why = 'tile title';
   if (why) out.push({ kind: 'instinctive', el: e, why });
 }
 return out.map((o, i) => { const r = o.el.getBoundingClientRect(); const a = o.el.closest('a[href]');
   return { i, kind: o.kind, why: o.why || '', sel: path(o.el), tag: o.el.tagName.toLowerCase(), text: (o.el.innerText || o.el.getAttribute('aria-label') || o.el.value || '').replace(/\s+/g, ' ').trim().slice(0, 60),
     href: a ? a.getAttribute('href') : (o.el.getAttribute('data-go') || ''), tile: (o.el.closest('[data-tile]') || {}).getAttribute ? o.el.closest('[data-tile]').getAttribute('data-tile') : '',
     aria: o.el.getAttribute('aria-label') || '', x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
}"""
SNAP = r"""() => { const o = {}; let n = 0; for (const e of document.querySelectorAll('body *')) { n++; if (e.closest('#w-clock,#w-date,.clock,[data-tick]')) continue;
  const cs = getComputedStyle(e); o[n] = [e.className && e.className.baseVal === undefined ? e.className : '', e.getAttribute('aria-pressed'), e.getAttribute('data-state'), e.hidden, cs.display, cs.visibility,
  e.childElementCount ? '' : (e.textContent || '').trim().slice(0, 80)].join('|'); } return o; }"""
HOME = r"""() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight; };
  const links = [...document.querySelectorAll('a[href]')].filter(vis);
  const hdr = document.querySelector('header.hdr-home-tap, .hdr-home-tap, #hub-home');
  const home = links.filter(a => /(^|\/)(wall\.html|index\.html|sheet-index\.html)(#|\?|$)|^\.\/?$|^\/$/.test(a.getAttribute('href')) || /main board|^home$|back|wall/i.test(a.innerText || a.getAttribute('aria-label') || ''));
  const txt = (document.body.innerText || '').trim();
  let anchorInView = null; if (location.hash.length > 1) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) { const r = t.getBoundingClientRect(); anchorInView = r.top < innerHeight && r.bottom > 0; } else anchorInView = false; }
  const hl = home.slice(0, 3).map(a => (a.getAttribute('href') + ' "' + (a.innerText || '').trim().slice(0, 20) + '"'));
  if (!hl.length && hdr) { const r = hdr.getBoundingClientRect(); hl.push('header tap -> Main board' + (r.bottom > 0 && r.top < innerHeight ? '' : ' (off-screen, scroll up)')); }
  return { home: hl, textLen: txt.length, title: document.title, anchorInView,
           closeCtl: [...document.querySelectorAll('button,[role=button]')].filter(vis).some(b => /cancel|close|done|back|×|✕/i.test((b.innerText || '') + (b.getAttribute('aria-label') || '')) || b.hasAttribute('data-pad-cancel')) }; }"""
BADGE = {"today": "sheet-today", "week": "sheet-index", "month": "month", "countdowns": "sheet-countdowns", "dad seat": "sheet-dan", "us together": "sheet-us",
         "pack": "sheet-pack", "weekend fun": "sheet-weekend", "week win": "sheet-win", "groceries": "sheet-groceries", "dinner vote": "sheet-dinner", "gallery": "sheet-gallery",
         "needs photo": "sheet-gallery-hero", "load day": "sheet-load-day", "home · sensi · nest": "sheet-google-home", "desk gate": "sheet-desk-gate", "status": "sheet-status",
         "main board": "sheet-index", "chores musts": "sheet-chores", "harris": "kid-harris", "hayes": "kid-hayes", "ainsley": "kid-ainsley"}
def expected(c):
    t = c["text"].lower().strip()
    if c["why"] == "kid name" or (re.fullmatch(r"harris|hayes|ainsley", t) and "seat" in (c["sel"] + c["tile"])): return "go:kid-" + t + ".html (Dan: kid name opens that kid's board)"
    for k, v in sorted(BADGE.items(), key=lambda kv: -len(kv[0])):
        if t.startswith(k) and ("rail" in c["sel"] or "badge" in c["sel"] or c["href"]): return f"go:{v}.html"
    if c["href"] and not c["href"].startswith("#"): return "go:" + c["href"].split("#")[0]
    if c["kind"] == "instinctive": return "go:the tile's board or visible in-place response"
    return "inplace:visible feedback on the wall"
import os
import datetime
ALLOW = re.compile(os.environ["PRESS_ALLOW"]) if os.environ.get("PRESS_ALLOW") else None
LOUD_ON = os.environ.get("PRESS_LOUD") == "1"
LOUD = r"""() => { const RX = /\b(error|errors|failed|failure|couldn.?t|could not|can.?t (save|reach|connect|load)|not saved|refused|denied|try again|unauthori[sz]ed|forbidden|undefined|NaN)\b|\bnull\b/i;
  const NOTE = /\b(need key|need token|read.only|offline)\b/i;
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight) return false;
    for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05 || a.hidden) return false; } return true; };
  const out = [], notes = [];
  for (const e of document.querySelectorAll('body *')) { if (e.closest('script,style,template,noscript,svg,#pv-chip')) continue;
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
    const alert = /^(alert|alertdialog)$/.test(e.getAttribute('role') || '');
    if ((alert && (e.innerText || '').trim()) || (own && RX.test(own))) { if (vis(e)) out.push((alert ? 'alert: ' : '') + (alert ? e.innerText : own).replace(/\s+/g, ' ').trim().slice(0, 70)); }
    else if (own && NOTE.test(own) && vis(e)) notes.push(own.replace(/\s+/g, ' ').trim().slice(0, 70)); }
  return { loud: [...new Set(out)], notes: [...new Set(notes)], blocked: (window.__previewBlocked || []).length }; }"""
CLOCK = os.environ.get("PRESS_CLOCK") or datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).replace(microsecond=0).isoformat()
print("clock", CLOCK, "real data" if not os.environ.get("PRESS_FX") else "FIXTURE (does not count)", flush=True); FXMAP = json.loads(os.environ.get("PRESS_FX") or "{}")
rows = []
with sync_playwright() as p:
    b = p.chromium.launch()
    def ctx_new(W, H):
        ctx = b.new_context(viewport={"width": W, "height": H})
        def route(r):
            u = r.request.url
            if r.request.method not in ("GET", "HEAD") or not (u.startswith(BASE) or (ALLOW and ALLOW.search(u))): return r.abort()
            path = u[len(BASE):].split("?")[0]
            if path in FXMAP: return r.fulfill(status=200, content_type="application/json", body=(WT / "scripts/wall/fixtures" / (FXMAP[path] + ".FIXTURE.json")).read_text())
            return r.continue_()
        ctx.route("**/*", route)
        if CLOCK: ctx.clock.install(time=CLOCK)
        return ctx
    for W, H in VPS:
        ctx = ctx_new(W, H); pg = ctx.new_page(); pg.goto(WALL, wait_until="load"); pg.wait_for_timeout(2000)
        cands = pg.evaluate(ENUM); s0 = pg.evaluate(SNAP); pg.wait_for_timeout(1300); s1 = pg.evaluate(SNAP)
        noisy = {k for k in s0 if s0.get(k) != s1.get(k)}; pg.screenshot(path=str(OUT / f"wall-{W}.png")); ctx.close()
        print(f"{W}x{H}: {len(cands)} candidates ({sum(c['kind']=='interactive' for c in cands)} interactive)", flush=True)
        for c in cands:
            ctx = ctx_new(W, H); pg = ctx.new_page(); errs = []; pops = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:160])); ctx.on("page", lambda np: pops.append(np))
            pg.goto(WALL, wait_until="load"); pg.wait_for_timeout(1500)
            now = pg.evaluate(ENUM); m = [x for x in now if x["sel"] == c["sel"]]
            for _ in range(10):  # live data can land after 1.5 s on a cold fetch: wait (up to 5 s more) for the face to paint, as a person would
                if m: break
                pg.wait_for_timeout(500); now = pg.evaluate(ENUM); m = [x for x in now if x["sel"] == c["sel"]]
            if not m: rows.append(dict(vp=f"{W}x{H}", element=c["text"] or c["aria"] or c["tag"], selector=c["sel"], kind=c["kind"] + (f" ({c['why']})" if c["why"] else ""), expected=expected(c), actual="element not present on reload", verdict="FAIL")); ctx.close(); continue
            x = m[0]; before = pg.evaluate(SNAP); resp = {"status": None}; loud0 = pg.evaluate(LOUD) if LOUD_ON else None
            pg.on("response", lambda r: resp.update(status=r.status) if r.request.is_navigation_request() and r.frame == pg.main_frame else None)
            try: pg.mouse.click(x["x"], x["y"])
            except Exception as e: errs.append("click: " + str(e)[:100])
            pg.wait_for_timeout(1300)
            try: pg.wait_for_load_state("load", timeout=4000)
            except Exception: pass
            url = pg.url; actual, verdict = "", "PASS"
            exp = expected(c); target = pops[0] if pops else pg
            if pops or url.split("#")[0] != WALL:
                try: target.wait_for_load_state("load", timeout=5000); target.wait_for_timeout(700)
                except Exception: pass
                land = target.url.replace(BASE, ""); h = target.evaluate(HOME)
                actual = f"go {land} [{resp['status'] or ''}] home={h['home'][:1] or 'NONE'} anchorInView={h['anchorInView']} text={h['textLen']}" + (" (new tab)" if pops else "")
                if h["textLen"] < 40: verdict = "FAIL blank page"
                elif not h["home"]: verdict = "FAIL no way home"
                elif resp["status"] and resp["status"] >= 400: verdict = f"FAIL HTTP {resp['status']}"
                elif h["anchorInView"] is False: verdict = "FAIL anchor not in view"
                if exp.startswith("go:") and "board or" not in exp:
                    want = exp[3:].split(" ")[0].split("#")[0]
                    if want and not land.split("#")[0].split("?")[0].endswith(want): verdict = (verdict + "; " if verdict != "PASS" else "") + f"FAIL wrong destination (expected {want})"
            elif url != WALL and url.split("#")[0] == WALL:
                actual = f"hash change {url.replace(BASE, '')}"
            else:
                after = pg.evaluate(SNAP); ch = [k for k in after if before.get(k) != after.get(k) and k not in noisy]
                h = pg.evaluate(HOME)
                if ch:
                    txt = [after[k].split("|")[-1] for k in ch if after[k].split("|")[-1]][:2]
                    actual = f"in place: {len(ch)} element(s) changed" + (f" {txt}" if txt else "")
                    if exp.startswith("go:") and "board or" not in exp: verdict = f"FAIL wrong destination (expected {exp[3:].split(' ')[0]}, got in-place)"
                else:
                    actual = "no visible change (no URL change, no DOM/toast change)"; verdict = "FAIL no-op"
            if LOUD_ON:
                try: l1 = target.evaluate(LOUD)
                except Exception as e: l1 = {"loud": ["(could not read: " + str(e)[:60] + ")"], "blocked": 0}
                l2 = pg.evaluate(LOUD) if target is not pg else l1
                fresh = [t for t in l1["loud"] if target is not pg or url.split("#")[0] != WALL or t not in loud0["loud"]]
                nts = [t for t in l1.get("notes", []) if target is not pg or url.split("#")[0] != WALL or t not in loud0.get("notes", [])]
                actual += f" | refused writes {l2['blocked']}" + (f" | LOUD {fresh[:2]}" if fresh else " | quiet") + (f" | note {nts[:2]}" if nts else "")
                if fresh: verdict = (verdict + "; " if verdict != "PASS" else "") + "FAIL loud: " + fresh[0]
            if errs: verdict = (verdict + "; " if verdict != "PASS" else "") + "FAIL JS error: " + errs[0]
            rows.append(dict(vp=f"{W}x{H}", element=c["text"] or c["aria"] or c["tag"], selector=c["sel"], kind=c["kind"] + (f" ({c['why']})" if c["why"] else ""), expected=exp, actual=actual, verdict=verdict))
            ctx.close()
    b.close()
srv.terminate()
with open(OUT / "press-map-alfred.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["vp", "element", "selector", "kind", "expected", "actual", "verdict"]); w.writeheader(); w.writerows(rows)
summ = {}
for r in rows:
    d = summ.setdefault(r["vp"], {"total": 0, "pass": 0, "fail": 0, "interactive": 0, "instinctive": 0}); d["total"] += 1
    d["pass" if r["verdict"] == "PASS" else "fail"] += 1; d["interactive" if r["kind"].startswith("interactive") else "instinctive"] += 1
json.dump({"summary": summ, "rows": rows}, open(OUT / "press.json", "w"), indent=1); print(json.dumps(summ))
