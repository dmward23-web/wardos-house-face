# ION1 browser check for wall.html (Prism's Ion kit). Real data unless a scenario says "fixture".
# Usage: python3 check_ion.py [isoTime]   (default NOW CT on real data; pass an Oct 1 clock to replay the pinned snapshot)
import sys, json, subprocess, time, datetime, random, copy
from playwright.sync_api import sync_playwright
import os; WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../..")) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../wall.html")) else "/workspace/wt-wall-redesign-1"; PORT = random.randint(20000, 40000)
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=WT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8); L = f"http://127.0.0.1:{PORT}/"
T = datetime.datetime.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).replace(microsecond=0)  # gate rule 10/2: NOW CT on real data
sys.path.insert(0, os.path.join(WT, "scripts/wall")); import datasnap  # DAYWIN1: Oct 1 clocks read the Oct 1 data set
seats = json.load(open(datasnap.path("kid-seats.json", T.isoformat())))
FIX = copy.deepcopy(seats)  # states fixture: CHOICE open (no claim yet) + travel-week Pack; test-only, never written to data/
FIX["choice"].update({"open": True, "exception": False, "lockAt": T.strftime("%Y-%m-%dT23:00:00-05:00"), "claimedBy": None})
FIX["pack"] = {"travelWeek": True, "dark": False, "items": [{"id": "pack-dragon", "word": "Dragon care"}, {"id": "pack-bag", "word": "Bag"}, {"id": "pack-charger", "word": "Charger"}]}
GEOM = """() => {
  const z = parseFloat(document.getElementById('wall-panel').style.zoom) || 1, vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const panel = document.getElementById('wall-panel').getBoundingClientRect();
  const tiles = [...document.querySelectorAll('.mod, .act, .ctl, .seat, .claim, .us-x, .wwin, .rail .badge')].filter(vis);
  const noId = tiles.filter(e => !e.querySelector('[data-tile-id]')).filter(e => !e.closest('[data-tile-id]') || !(e.closest('[data-tile-id]').getAttribute('data-owner') || e.closest('[data-owner]'))).map(e => e.className);
  const missingOwner = [...document.querySelectorAll('[data-tile-id]')].filter(e => !e.hasAttribute('data-owner')).map(e => e.getAttribute('data-tile-id'));
  const clipped = [...document.querySelectorAll('[data-tile-id]')].filter(vis).filter(e => e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== 'visible').map(e => e.getAttribute('data-tile-id') + ' ' + e.scrollHeight + '>' + e.clientHeight);
  const outside = tiles.filter(e => { const r = e.getBoundingClientRect(); return r.right > panel.right + 1 || r.bottom > panel.bottom + 1 || r.bottom > innerHeight + 1; }).map(e => (e.closest('[data-tile-id]')||e).getAttribute('data-tile-id') || e.className);
  const targets = [...document.querySelectorAll('#wall-panel button, #wall-panel a[href]')].filter(vis).filter(e => !e.disabled);
  const small = targets.map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 24) || e.className, Math.round(Math.min(r.width, r.height) / z)]; }).filter(x => x[1] < 48);
  return { zoom: z, docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, docOverflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    tiles: tiles.length, tileIds: document.querySelectorAll('[data-tile-id]').length, noId, missingOwner, clipped, outside, targets: targets.length, small,
    preview: document.querySelectorAll('[data-state-preview], .spv, .sp-tag').length,
    bellLed: (document.getElementById('w-bell-led') || {}).className || '', redLeds: [...document.querySelectorAll('.led.bad')].filter(vis).length,
    breathing: document.getAnimations().filter(a => a.playState === 'running' && a.animationName === 'x21-breathe').length,
    mustH: [...document.querySelectorAll('.seats-law > .seat.kid')].map(s => s.querySelector('.kid-law > .musts .must')).filter(m => m && m.offsetParent).map(m => Math.round(m.getBoundingClientRect().height / z * 10) / 10),
    css: [...document.styleSheets].map(s => (s.href || 'inline').replace(location.origin + '/', '')),
    fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i) };
}"""
LED = "() => { const i = document.createElement('i'); i.className = 'led bad'; i.setAttribute('data-check-only', ''); const h = document.getElementById('w-lights-row'); const host = (h && h.offsetParent) ? h : document.getElementById('wall-panel'); if (host !== h) i.style.cssText = 'position:absolute;left:4px;top:4px;width:16px;height:16px;border-radius:50%'; host.appendChild(i); }"  # check-only alert LED so loop 4 has a host
ANIM = "() => document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName || a.constructor.name)"
def page(b, vw, vh, fixture=False, reduced=None, at=None):
    ctx = b.new_context(viewport={"width": vw, "height": vh}, reduced_motion=reduced or "no-preference"); pg = ctx.new_page(); errs = []; reqs = []
    TT = at or T; pg.clock.install(time=TT); pg.on("pageerror", lambda e: errs.append(str(e)))
    def route(r):
        u = r.request.url
        if fixture and "/data/kid-seats.json" in u: return r.fulfill(status=200, content_type="application/json", body=json.dumps(FIX))
        pb = datasnap.body(u, TT.isoformat())
        if pb is not None and u.startswith(L): return r.fulfill(status=200, content_type="application/json", body=pb)
        if u.startswith(L): return r.continue_()
        reqs.append(u); return r.abort()
    pg.route("**/*", route)
    pg.goto(L + "wall.html"); pg.clock.run_for(3000); pg.wait_for_timeout(1500); pg.clock.run_for(1000); pg.wait_for_timeout(300)
    return ctx, pg, errs, reqs
ok = True
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for vw, vh in [(2560, 1440), (1920, 1080), (1536, 730), (1366, 768), (1280, 650), (1080, 1920)]:  # FILL1: laptop windows too
            ctx, pg, errs, reqs = page(b, vw, vh)
            g = pg.evaluate(GEOM); pg.evaluate(LED); pg.wait_for_timeout(200); anims = sorted(set(pg.evaluate(ANIM)))
            bad = (anims != ["x21-breathe", "x21-drift", "x21-scan", "x21-sweep"] or g["docOverflowX"] or (vw > vh and g["docOverflowY"]) or g["noId"] or g["missingOwner"] or g["clipped"] or (vw > vh and g["outside"]) or g["small"] or g["preview"] or errs or reqs
                   or g["breathing"] or g["redLeds"] or "bad" in g["bellLed"]  # QUIET1: real data today has no active alert -> no red, no breathe
                   or (len(g["mustH"]) > 1 and max(g["mustH"]) - min(g["mustH"]) > 1))  # MUSTEQ1/2: one MUSTS height across seats, every size
            ok = ok and not bad
            print(f"{vw}x{vh}", "FAIL" if bad else "PASS", json.dumps({k: g[k] for k in g if k not in ("css", "fonts")}), "anims:", sorted(anims), "errors:", errs[:3], "non-local:", reqs[:3])
            if vw == 2560: print("  css order:", g["css"]); print("  fonts loaded:", g["fonts"])
            ctx.close()
        # reduced motion: zero running animations
        ctx, pg, errs, reqs = page(b, 2560, 1440, reduced="reduce"); pg.evaluate(LED); pg.wait_for_timeout(200); a = pg.evaluate(ANIM); ctx.close()
        print("reduced-motion running animations:", a, "PASS" if not a else "FAIL"); ok = ok and not a
        # KIDSAWAY1: a kids-away clock has no seats. The face check runs at NOW (no seats, no claim, no check-in tile, the
        # away band shows real days or collapses); the seat scenario below then runs at the last kids-home window of
        # today's house-mode timeline (real data, that window's midpoint, capped 30 min before it ends).
        ctx, pg, errs, reqs = page(b, 2560, 1440)
        aw = pg.evaluate("() => ({ away: document.body.classList.contains('is-away'), seats: !!(document.getElementById('w-kids') && !document.getElementById('w-kids').hidden), claim: [...document.querySelectorAll('#w-claim .cj')].filter(e => e.offsetParent).length, checkin: !!(document.getElementById('w-ltap-checkin') && document.getElementById('w-ltap-checkin').offsetParent), band: !!(document.getElementById('w-away') && !document.getElementById('w-away').hidden), items: document.querySelectorAll('#w-away .aw-i').length, back: (document.getElementById('w-away-back') || {}).textContent || '' })")
        ctx.close(); AT = None
        if aw["away"]:
            awok = not aw["seats"] and not aw["claim"] and not aw["checkin"] and (aw["band"] == (aw["items"] > 0)) and not errs
            print("kids-away face (now):", json.dumps(aw), "PASS" if awok else "FAIL"); ok = ok and awok
            hm = json.load(open(datasnap.path("house-mode.json", T.isoformat())))
            homes = [w for w in (hm.get("timeline") or []) if w.get("mode") != "kids-away" and w.get("since") and w.get("until") and datetime.datetime.fromisoformat(w["since"]) < T]
            if homes:
                w = homes[-1]; s0_, u0_ = datetime.datetime.fromisoformat(w["since"]), datetime.datetime.fromisoformat(w["until"])
                AT = max(s0_ + (u0_ - s0_) / 2, u0_ - datetime.timedelta(minutes=30)) if (u0_ - s0_) > datetime.timedelta(hours=1) else s0_ + (u0_ - s0_) / 2
                print("seat scenario clock (last kids-home window today):", AT.isoformat(), w.get("mode"))
            else: print("seat scenario: n/a, no kids-home window today")
        # states fixture: CHOICE claim -> owner mark, siblings locked, never released; Pack travel week -> Ainsley's Bag darkens only hers (per kid); Harris fill same minute
        if aw["away"] and AT is None: b.close(); print("ION CHECK", "PASS" if ok else "FAIL"); raise SystemExit(0 if ok else 1)
        if AT is not None:
            FIX["choice"]["lockAt"] = AT.strftime("%Y-%m-%dT23:00:00-05:00")
        ctx, pg, errs, reqs = page(b, 2560, 1440, fixture=True, at=AT)
        s0 = pg.evaluate("() => ({ claim: !document.getElementById('w-claim').hidden, cj: [...document.querySelectorAll('#w-claim .cj')].map(e => e.innerText.trim() + '|' + e.getAttribute('data-locked')), pack: document.querySelectorAll('[data-law-pack]').length })")
        pg.click('[data-law-claim="hayes"]'); pg.clock.run_for(300)
        s1 = pg.evaluate("() => ({ cj: [...document.querySelectorAll('#w-claim .cj')].map(e => e.innerText.replace(/\\s+/g,' ').trim() + '|locked=' + e.getAttribute('data-locked') + '|by=' + e.getAttribute('data-claimed-by') + '|disabled=' + e.disabled), small: document.querySelector('#w-claim .claim-h small').textContent })")
        f0 = pg.evaluate("() => document.querySelector('[data-law-fill] i').style.width")
        pg.click('[data-law-must="harris"][data-law-id="must-bed"]'); pg.clock.run_for(100)
        f1 = pg.evaluate("() => [document.querySelector('[data-law-fill] i').style.width, document.querySelector('[data-law-must=\"harris\"][data-law-id=\"must-bed\"]').getAttribute('data-state')]")
        pg.click('[data-law-pack="ainsley"][data-law-id="pack-bag"]'); pg.clock.run_for(300)
        s2 = pg.evaluate("() => ({ packLeft: document.querySelectorAll('[data-law-pack]').length, perKid: ['harris','hayes','ainsley'].map(k => document.querySelectorAll('[data-law-pack=\"' + k + '\"]').length), mystery: document.querySelectorAll('[data-law-mystery]').length, photo: document.querySelectorAll('[data-disputed-photo], .pframe').length })")
        g = pg.evaluate(GEOM)
        print("fixture before:", json.dumps(s0)); print("fixture after Hayes claim:", json.dumps(s1)); print("Harris fill:", f0, "->", f1); print("after pack-bag:", json.dumps(s2))
        print("fixture geometry:", json.dumps({k: g[k] for k in ("clipped", "outside", "small", "preview")}), "errors:", errs[:3])
        st = (s0["claim"] and len(s0["cj"]) == 3 and s0["pack"] == 9 and any("locked=false|by=hayes" in x for x in s1["cj"]) and sum("locked=true" in x and "disabled=true" in x for x in s1["cj"]) == 2
              and f1[1] == "done" and f1[0] == "25%" and s2["perKid"] == [3, 3, 0] and s2["mystery"] == 0 and s2["photo"] == 0 and not g["clipped"] and not g["outside"] and not g["small"] and not errs)
        print("states:", "PASS" if st else "FAIL"); ok = ok and st
        pg.screenshot(path=os.environ.get("ION_FIXTURE_PNG", "/tmp/ion-fixture-states.png")); ctx.close(); b.close()
finally:
    srv.terminate()
print("ION CHECK", "PASS" if ok else "FAIL")
