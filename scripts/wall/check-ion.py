# ION1 browser check for wall.html (Prism's Ion kit). Real data unless a scenario says "fixture".
# Usage: python3 check_ion.py [isoTime]   (default Thu Oct 1 8:30 PM CT; kid-seats.json generatedAt is 8:05 PM)
import sys, json, subprocess, time, datetime, random, copy
from playwright.sync_api import sync_playwright
import os; WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../..")) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../wall.html")) else "/workspace/wt-wall-redesign-1"; PORT = random.randint(20000, 40000)
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=WT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8); L = f"http://127.0.0.1:{PORT}/"
T = datetime.datetime.fromisoformat(sys.argv[1] if len(sys.argv) > 1 else "2026-10-01T20:30:00-05:00")
seats = json.load(open(WT + "/data/kid-seats.json"))
FIX = copy.deepcopy(seats)  # states fixture: CHOICE open (no claim yet) + travel-week Pack; test-only, never written to data/
FIX["choice"].update({"open": True, "exception": False, "lockAt": "2026-10-01T23:00:00-05:00", "claimedBy": None})
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
    css: [...document.styleSheets].map(s => (s.href || 'inline').replace(location.origin + '/', '')),
    fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i) };
}"""
LED = "() => { const i = document.createElement('i'); i.className = 'led bad'; i.setAttribute('data-check-only', ''); (document.getElementById('w-lights-row') || document.body).appendChild(i); }"  # check-only alert LED so loop 4 has a host
ANIM = "() => document.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName || a.constructor.name)"
def page(b, vw, vh, fixture=False, reduced=None):
    ctx = b.new_context(viewport={"width": vw, "height": vh}, reduced_motion=reduced or "no-preference"); pg = ctx.new_page(); errs = []; reqs = []
    pg.clock.install(time=T); pg.on("pageerror", lambda e: errs.append(str(e)))
    def route(r):
        u = r.request.url
        if fixture and "/data/kid-seats.json" in u: return r.fulfill(status=200, content_type="application/json", body=json.dumps(FIX))
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
            bad = (anims != ["x21-breathe", "x21-drift", "x21-scan", "x21-sweep"] or g["docOverflowX"] or (vw > vh and g["docOverflowY"]) or g["noId"] or g["missingOwner"] or g["clipped"] or (vw > vh and g["outside"]) or g["small"] or g["preview"] or errs or reqs)
            ok = ok and not bad
            print(f"{vw}x{vh}", "FAIL" if bad else "PASS", json.dumps({k: g[k] for k in g if k not in ("css", "fonts")}), "anims:", sorted(anims), "errors:", errs[:3], "non-local:", reqs[:3])
            if vw == 2560: print("  css order:", g["css"]); print("  fonts loaded:", g["fonts"])
            ctx.close()
        # reduced motion: zero running animations
        ctx, pg, errs, reqs = page(b, 2560, 1440, reduced="reduce"); pg.evaluate(LED); pg.wait_for_timeout(200); a = pg.evaluate(ANIM); ctx.close()
        print("reduced-motion running animations:", a, "PASS" if not a else "FAIL"); ok = ok and not a
        # states fixture: CHOICE claim -> owner mark, siblings locked, never released; Pack travel week -> Ainsley's Bag darkens only hers (per kid); Harris fill same minute
        ctx, pg, errs, reqs = page(b, 2560, 1440, fixture=True)
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
