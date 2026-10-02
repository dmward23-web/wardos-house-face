# PRESSMAP1 · press-map test for wall.html (map: scripts/wall/press-map.json, doc: docs/PRESS-MAP.md).
# Every visible tappable on the wall must match a map entry (unmapped = FAIL). Each one is pressed in a fresh
# browser context (no state carried between presses) at each viewport:
#   go      -> the page loads (HTTP < 400, not blank), lands on the mapped page#anchor, the anchor element is in the
#              viewport, and the page has a way home (header home tap / Main board / wall link).
#   inplace -> the wall answers within 1s (DOM feedback), the URL does not change.
# No request leaves the box (any non-local request = FAIL; no key is saved, so nothing writes).
# Test clock (Playwright clock.install), real branch data. Usage: python3 scripts/wall/press-map.py [WxH ...] [--time ISO] [--out file.json]
import os as _os, sys as _sys; _sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__))); import datasnap  # DAYWIN1
import sys, os, json, re, subprocess, time, random, datetime, fnmatch
from playwright.sync_api import sync_playwright
WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
args = sys.argv[1:]; iso = "2026-10-01T21:30:00-05:00"; out = None; vps = []
while args:
    a = args.pop(0)
    if a == "--time": iso = args.pop(0)
    elif a == "--out": out = args.pop(0)
    else: w, h = a.split("x"); vps.append((int(w), int(h)))
vps = vps or [(1920, 1080), (2560, 1440)]
MAP = json.load(open(os.path.join(WT, "scripts/wall/press-map.json")))
PORT = random.randint(20000, 40000)
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=WT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8); L = f"http://127.0.0.1:{PORT}/"
ENUM = """(entries) => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden'; };
  const els = [...document.querySelectorAll('#wall-panel a[href], #wall-panel button, #wall-panel [data-go], #wall-panel [role=button], #wall-panel [data-inplace]')].filter(vis)
    .filter(e => !e.disabled);
  return els.map((e, i) => { e.setAttribute('data-pm-i', String(i)); const m = entries.filter(x => { try { return e.matches(x.selector); } catch (er) { return false; } }).map(x => x.id);
    return { i, m, tag: e.tagName.toLowerCase(), text: e.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40), target: e.getAttribute('href') || e.getAttribute('data-go') || '' }; }); }"""
OBS = """() => { window.__pm = 0; new MutationObserver(ms => { window.__pm += ms.length; }).observe(document.getElementById('wall-panel'), { subtree: true, childList: true, attributes: true, characterData: true }); }"""
LAND = """(anchor) => { const a = anchor ? document.getElementById(anchor) : null; const r = a && a.getBoundingClientRect();
  const home = !!document.querySelector('header.hdr-home-tap, .hdr-home-tap, a.hub-wall-link, a[href*="wall.html"], a[href^="sheet-index.html"], #hub-home');
  return { anchor: !!a, inView: !!(r && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.height > 0), home, text: (document.body.innerText || '').trim().length, title: document.title }; }"""
def allowed(dest):
    return any(fnmatch.fnmatch(dest, p) for p in MAP["allowDest"])
def match_dest(want, got):
    return fnmatch.fnmatch(got, want)
results = []; ok = True
def page(b, vw, vh, nonlocal_):
    ctx = b.new_context(viewport={"width": vw, "height": vh}); pg = ctx.new_page(); errs = []
    pg.clock.install(time=datetime.datetime.fromisoformat(iso)); pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    def route(r):
        pb = datasnap.body(r.request.url, iso)
        if pb is not None and r.request.url.startswith(L): return r.fulfill(status=200, content_type="application/json", body=pb)
        if r.request.url.startswith(L): return r.continue_()
        # the wall itself may not reach off the box at all; a destination board's public GET (weather) is aborted, not a failure
        if r.request.method != "GET" or "/wall.html" in (pg.url or ""): nonlocal_.append(r.request.method + " " + r.request.url)
        return r.abort()
    pg.route("**/*", route)
    pg.goto(L + "wall.html"); pg.clock.run_for(3000); pg.wait_for_timeout(900); pg.clock.run_for(1000); pg.wait_for_timeout(200)
    return ctx, pg, errs
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for vw, vh in vps:
            nl = []; ctx, pg, errs = page(b, vw, vh, nl); items = pg.evaluate(ENUM, MAP["entries"]); ctx.close()
            byid = {e["id"]: e for e in MAP["entries"]}
            for it in items:
                r = {"vp": f"{vw}x{vh}", **it, "ok": False, "why": ""}
                if not it["m"]:
                    r["why"] = "UNMAPPED tappable"; results.append(r); ok = False; continue
                e = byid[it["m"][0]]; r["entry"] = e["id"]; r["kind"] = e["kind"]
                nl = []; ctx, pg, errs = page(b, vw, vh, nl)
                pg.evaluate(ENUM, MAP["entries"])  # re-tag (same clock, same data -> same order)
                loc = pg.locator(f'[data-pm-i="{it["i"]}"]')
                start = pg.url
                try:
                    if e["kind"] == "go":
                        dest = it["target"] if e["dest"] == "*" else e["dest"]
                        resp = []
                        pg.on("response", lambda rs: resp.append(rs) if rs.request.is_navigation_request() and rs.request.frame == pg.main_frame else None)
                        with pg.expect_navigation(timeout=8000):
                            loc.click(timeout=4000, force=True)
                        pg.clock.run_for(2500); pg.wait_for_timeout(700)
                        got = pg.url.replace(L, "")
                        anchor = got.split("#", 1)[1] if "#" in got else ""
                        land = pg.evaluate(LAND, anchor)
                        status = resp[-1].status if resp else 0
                        r.update({"dest": got, "status": status, **land})
                        why = []
                        if not match_dest(dest, got): why.append(f"went to {got}, map says {dest}")
                        if not allowed(got): why.append("destination not in allowDest")
                        if status >= 400 or status == 0: why.append(f"HTTP {status}")
                        if not land["anchor"]: why.append(f"no #{anchor} on the page")
                        elif not land["inView"]: why.append(f"#{anchor} not in the viewport")
                        if not land["home"]: why.append("no way home")
                        if land["text"] < 40: why.append("blank page")
                        r["why"] = "; ".join(why); r["ok"] = not why
                    else:
                        pg.evaluate(OBS)
                        loc.click(timeout=4000, force=True); pg.clock.run_for(900); pg.wait_for_timeout(300)
                        n = pg.evaluate("() => window.__pm || 0"); same = pg.url == start
                        r.update({"feedback": n, "urlSame": same})
                        why = []
                        if not same: why.append("in-place press changed the URL to " + pg.url.replace(L, ""))
                        if n <= 0: why.append("no visible feedback")
                        r["why"] = "; ".join(why); r["ok"] = not why
                except Exception as ex:
                    r["why"] = "press failed: " + str(ex).split("\n")[0][:140]
                if nl: r["ok"] = False; r["why"] = (r["why"] + "; " if r["why"] else "") + "non-local request " + nl[0][:80]
                if errs: r["ok"] = False; r["why"] = (r["why"] + "; " if r["why"] else "") + "page error " + errs[0]
                ok = ok and r["ok"]; results.append(r); ctx.close()
            # PRESS3 (Atlas 10/2) rules on top of the map: each kid's name opens THAT kid's board; check-in is an
            # explicit I'm here chip inside the seat; the jar explainer shows rules only (no $, no numbers)
            nl = []; ctx, pg, errs = page(b, vw, vh, nl)
            rule = pg.evaluate("""() => {
              const why = [];
              for (const k of ['harris', 'hayes', 'ainsley']) {
                const seat = document.getElementById('w-kid-' + k); if (!seat || seat.closest('[hidden]')) continue;
                const n = seat.querySelector('[data-kid-board]');
                if (!n || n.getAttribute('data-go') !== 'kid-' + k + '.html#kid-board') why.push(k + ' name does not open kid-' + k + '.html#kid-board');
                if (n && n.hasAttribute('data-kid-checkin')) why.push(k + ' name still checks in');
                const c = seat.querySelector('[data-kid-checkin]');
                if (!c || !/I.m here/.test(c.textContent)) why.push(k + " seat has no I'm here chip");
              }
              const j = document.getElementById('w-jar');
              if (j && j.getAttribute('data-go') !== 'sheet-index.html#jar-rules') why.push('jar does not open the jar explainer');
              return why;
            }""")
            ctx.close()
            ctx = b.new_context(viewport={"width": vw, "height": vh}); pg = ctx.new_page(); pg.clock.install(time=datetime.datetime.fromisoformat(iso))
            pg.route("**/*", lambda r: r.fulfill(status=200, content_type="application/json", body=datasnap.body(r.request.url, iso)) if (r.request.url.startswith(L) and datasnap.body(r.request.url, iso) is not None) else (r.continue_() if r.request.url.startswith(L) else r.abort()))
            pg.goto(L + "sheet-index.html#jar-rules"); pg.clock.run_for(2500); pg.wait_for_timeout(700)
            jx = pg.evaluate("""() => { const s = document.getElementById('jar-rules'); if (!s) return { why: 'no #jar-rules' };
              const r = s.getBoundingClientRect(), t = s.innerText || '';
              return { why: (r.width < 50 || r.height < 50 || r.top >= innerHeight) ? 'jar explainer not in view' : (!/How the jar works/.test(t) ? 'jar explainer has no rules' : ((/[$\u00a2\u00a3\u20ac]|[0-9]/.test(t)) ? 'jar explainer shows money or numbers: ' + t.slice(0, 80) : '')),
                home: !!s.querySelector('a[href*="wall.html"], a[href*="sheet-index.html"]') }; }""")
            ctx.close()
            if jx.get("why"): rule.append(jx["why"])
            if not jx.get("home"): rule.append("jar explainer has no way back")
            r = {"vp": f"{vw}x{vh}", "entry": "PRESS3-rules", "kind": "rule", "text": "names / I'm here / jar", "ok": not rule, "why": "; ".join(rule)}
            ok = ok and r["ok"]; results.append(r)
        b.close()
finally:
    srv.terminate()
for vp in sorted(set(r["vp"] for r in results)):
    rs = [r for r in results if r["vp"] == vp]; bad = [r for r in rs if not r["ok"]]
    print(f"{vp}: {sum(1 for r in rs if r.get('kind') != 'rule')} presses ({sum(1 for r in rs if r.get('kind') == 'go')} go, {sum(1 for r in rs if r.get('kind') == 'inplace')} in place) + {sum(1 for r in rs if r.get('kind') == 'rule')} rule check, {len(bad)} FAIL")
    for r in bad: print("   FAIL", r.get("entry", "-"), "|", r["text"], "|", r["why"])
if out: json.dump({"time": iso, "results": results}, open(out, "w"), indent=1)
print("PRESS MAP", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
