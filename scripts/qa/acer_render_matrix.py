#!/usr/bin/env python3
"""ACERFIX render matrix. Synthetic feeds only. No real secrets, no actuator writes.

Viewport screenshots (full_page is false). CSS size and raster size are both recorded.
"""
import argparse, json, os, shutil, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, urlencode, parse_qsl, urlunparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORE = [
    "sheet-index.html", "kid-ainsley.html", "kid-hayes.html", "kid-harris.html",
    "sheet-today.html", "month.html", "sheet-lights.html", "sheet-google-home.html",
]
LINKED = [
    "nest-webrtc.html", "sheet-chores.html", "sheet-groceries.html",
    "sheet-weekend.html", "sheet-win.html", "sheet-spotify.html",
]
WEEK = {
    "asOfIso": "2026-11-10",
    "kids": {
        "hayes": {"today": [
            {"id": "bad", "kind": "school", "what": "provider school visit confirmed Tue 8:50 (Hayes attending",
             "description": "therapy notes", "startIso": "2026-11-10T14:50:00-06:00"},
            {"id": "pick", "kind": "school_pickup", "what": "School pickup", "startIso": "2026-11-10T15:15:00-06:00"}
        ]},
        "harris": {"today": [
            {"id": "soc", "kind": "leave", "what": "soccer 6:30-7:30", "startIso": "2026-11-10T18:00:00-06:00"}
        ]},
        "ainsley": {"today": [
            {"id": "swim", "kind": "sport", "what": "Ainsley swim Coach Ann", "startIso": "2026-11-10T16:25:00-06:00"}
        ]},
        "dan": {"today": [
            {"id": "pick", "kind": "school_pickup", "what": "School pickup", "startIso": "2026-11-10T15:15:00-06:00"}
        ]}
    }
}
NEST = {
    "status": "live", "fetchedAt": "2026-11-06T21:46:00.000Z", "source": "synthetic",
    "cameras": [
        {"id": "slot-a", "place": "Porch", "name": "Porch", "snapshotUrl": "", "snapCapturedAt": "2026-11-06T21:46:00.000Z"},
        {"id": "slot-b", "place": "Drive", "name": "Drive", "snapshotUrl": "", "snapCapturedAt": "2026-11-06T21:46:00.000Z"},
        {"id": "slot-c", "place": "Yard", "name": "Yard", "snapshotUrl": "", "snapCapturedAt": "2026-11-06T21:46:00.000Z"}
    ]
}
WX = {
    "stale": False,
    "ts": 1762800000000,
    "raw": {
        "current": {"temperature_2m": 16.7, "weather_code": 1, "is_day": 1, "time": "2026-11-10T12:00", "wind_speed_10m": 8},
        "daily": {"temperature_2m_max": [18.3], "temperature_2m_min": [4.4]},
        "hourly": {"time": [], "precipitation_probability": [], "precipitation": []}
    }
}
SENSI = {
    "status": "live", "updatedAt": "2026-11-10T18:00:00.000Z", "source": "synthetic", "writeSupported": False,
    "thermostat": {"name": "Thermostat", "online": True, "ambient": 65, "ambientRaw": 65, "setpoint": 68, "heatSetpoint": 68, "coolSetpoint": 74, "mode": "Heat", "fan": "Auto", "humidity": 40, "hold": False, "scale": "f"}
}

PROBE = """() => {
  const stage = document.querySelector('.wardos-stage');
  const s = stage ? (stage.getBoundingClientRect().width / 1920) : 1;
  const text = document.body ? document.body.innerText : '';
  const banned = /provider|therap|counsel|onerror|6:30/.test(text);
  const img = document.querySelector('.hub-window img');
  const phase = document.documentElement.getAttribute('data-scene-phase') || '';
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) return false;
    return true;
  };
  const small = [];
  const hubish = true;
  if (hubish) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.replace(/\\s+/g, ' ').trim();
      if (!t) continue;
      const el = node.parentElement;
      if (!el || !vis(el)) continue;
      const px = parseFloat(getComputedStyle(el).fontSize) || 0;
      const eff = px * (s || 1);
      if (eff < 17.5) small.push({ t: t.slice(0, 24), px: Math.round(eff * 10) / 10 });
    }
  }
  const hits = [...document.querySelectorAll('a, button')].filter(vis);
  const overlaps = [];
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      if (hits[i].contains(hits[j]) || hits[j].contains(hits[i])) continue;
      const ta = (hits[i].textContent || '').replace(/\s+/g, '').trim();
      const tb = (hits[j].textContent || '').replace(/\s+/g, '').trim();
      if (!ta || !tb) continue;
      const a = hits[i].getBoundingClientRect();
      const b = hits[j].getBoundingClientRect();
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > 1 && y > 1) overlaps.push({ a: (hits[i].textContent || '').trim().slice(0, 20), b: (hits[j].textContent || '').trim().slice(0, 20), x: Math.round(x), y: Math.round(y) });
    }
  }
  const seen = (r, el) => {
    let n = el && el.parentElement;
    while (n && n !== document.body) {
      const c = getComputedStyle(n);
      const cuts = /hidden|clip|auto|scroll/.test(c.overflowY) || /hidden|clip|auto|scroll/.test(c.overflowX);
      if (cuts) {
        const b = n.getBoundingClientRect();
        const ix = Math.min(r.right, b.right) - Math.max(r.left, b.left);
        const iy = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
        if (ix < 2 || iy < 2) return false;
      }
      n = n.parentElement;
    }
    return true;
  };
  const boxHit = (a, b) => {
    if (!a || !b) return false;
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return x > 1 && y > 1;
  };
  const lights = document.getElementById('hub-lights-panel');
  const launch = document.querySelector('.hub-launch');
  const lightsLaunch = !!(lights && launch && vis(lights) && vis(launch) && boxHit(lights.getBoundingClientRect(), launch.getBoundingClientRect()));
  const clips = [];
  const clipOf = (node) => {
    let n = node.parentElement;
    const r = node.getBoundingClientRect();
    while (n && n !== document.body) {
      const c = getComputedStyle(n);
      const ox = c.overflowX, oy = c.overflowY;
      const scrollX = ox === 'auto' || ox === 'scroll';
      const scrollY = oy === 'auto' || oy === 'scroll';
      const cutX = ox === 'hidden' || ox === 'clip';
      const cutY = oy === 'hidden' || oy === 'clip';
      if (scrollY || scrollX) {
        const b = n.getBoundingClientRect();
        const dy = scrollY ? Math.max(0, b.top - r.top, r.bottom - b.bottom) : 0;
        const dx = scrollX ? Math.max(0, b.left - r.left, r.right - b.right) : 0;
        const visibleY = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
        const visibleX = Math.min(r.right, b.right) - Math.max(r.left, b.left);
        if ((dy > 2 && visibleY > 2) || (dx > 2 && visibleX > 2)) {
          return { t: (node.textContent || node.className || '').toString().trim().slice(0, 24), dx: Math.round(dx), dy: Math.round(dy) };
        }
        return null;
      }
      if (cutX || cutY) {
        const b = n.getBoundingClientRect();
        const dx = cutX ? Math.max(0, b.left - r.left, r.right - b.right) : 0;
        const dy = cutY ? Math.max(0, b.top - r.top, r.bottom - b.bottom) : 0;
        const visY = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
        const visX = Math.min(r.right, b.right) - Math.max(r.left, b.left);
        if ((dx > 2 || dy > 2) && visX > 8 && visY > 8) return { t: (node.textContent || node.className || '').toString().trim().slice(0, 24), dx: Math.round(dx), dy: Math.round(dy) };
      }
      n = n.parentElement;
    }
    return null;
  };
  for (const el of [...document.querySelectorAll('button, a, .day-tap, .chore, .what')]) {
    if (!vis(el) || clips.length > 8) continue;
    const hit = clipOf(el);
    if (hit) clips.push(hit);
  }
  const blanks = [];
  for (const el of document.querySelectorAll('.panel, .sec, #sec-musts, .card')) {
    if (!vis(el) || blanks.length > 6) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 200 || r.height < 200) continue;
    const words = (el.innerText || '').replace(/\s+/g, ' ').trim();
    const pic = el.querySelector('img, canvas, video, svg');
    const bg = getComputedStyle(el).backgroundImage;
    if (!words && !pic && (!bg || bg === 'none')) blanks.push((el.id || el.className || '').toString().slice(0, 40));
  }
  const textBoxes = [];
  const twalk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let tn;
  while ((tn = twalk.nextNode())) {
    const raw = tn.textContent.replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    const el = tn.parentElement;
    if (!el || !vis(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(tn);
    for (const r of range.getClientRects()) {
      if (r.width > 1 && r.height > 1 && seen(r, el)) textBoxes.push({ t: raw.slice(0, 28), r, el });
    }
  }
  const textHits = [];
  for (let i = 0; i < textBoxes.length && textHits.length < 8; i++) {
    for (let j = i + 1; j < textBoxes.length && textHits.length < 8; j++) {
      const A = textBoxes[i], B = textBoxes[j];
      if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
      if (boxHit(A.r, B.r)) textHits.push({ a: A.t, b: B.t });
    }
  }
  const overflow = [];
  for (const item of textBoxes) {
    if (overflow.length > 8) break;
    let n = item.el.parentElement;
    while (n && n !== document.body) {
      const c = getComputedStyle(n);
      const cuts = c.overflowX === 'hidden' || c.overflowX === 'clip' || c.overflowY === 'hidden' || c.overflowY === 'clip';
      if (cuts) {
        const b = n.getBoundingClientRect();
        const ix = Math.min(item.r.right, b.right) - Math.max(item.r.left, b.left);
        const iy = Math.min(item.r.bottom, b.bottom) - Math.max(item.r.top, b.top);
        const outside = item.r.left < b.left - 2 || item.r.right > b.right + 2 || item.r.top < b.top - 2 || item.r.bottom > b.bottom + 2;
        if (ix > 1 && iy > 1 && outside) overflow.push(item.t);
        break;
      }
      n = n.parentElement;
    }
  }
  const stray = [];
  for (const item of textBoxes) {
    if (stray.length > 6) break;
    const home = item.el.closest('.panel, .kw-hud, header, .chore-shortcuts, #wardos-diag, .hub-launch, .hub-upper');
    const pos = getComputedStyle(item.el).position;
    if (!home && (pos === 'fixed' || pos === 'absolute' || /CLOCK OVERRIDE/.test(item.t))) stray.push(item.t);
  }
  const dead = [];
  for (const el of document.querySelectorAll('.col, #sec-musts, #sec-days, #sec-jar')) {
    if (!vis(el) || dead.length > 6) continue;
    const b = el.getBoundingClientRect();
    if (b.width < 80 || b.height < 80) continue;
    let used = 0;
    for (const c of el.children) {
      if (!vis(c)) continue;
      const r = c.getBoundingClientRect();
      const ix = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left));
      const iy = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
      used += ix * iy;
    }
    const area = b.width * b.height;
    const slack = 300 * 200 * s * s;
    if (area > 0 && (used / area < 0.5 || (area - used) > slack)) dead.push((el.id || el.className || '').toString().slice(0, 40));
  }
  const wrappedDays = [...document.querySelectorAll('.quest-days')].filter(group => {
    const taps = [...group.querySelectorAll('.day-tap')].filter(vis);
    if (taps.length < 7) return false;
    const tops = taps.map(t => t.getBoundingClientRect().top);
    return Math.max.apply(null, tops) - Math.min.apply(null, tops) > 8;
  }).length;
  const feedDown = /Schedule didn't load|Schedule unavailable|Calendar unavailable/.test(text);
  let homeMatch = true;
  const homeProbe = document.querySelector('button.kw-home, a.wardos-home, a.hub-home');
  if (homeProbe && vis(homeProbe)) {
    const hs = getComputedStyle(homeProbe);
    if ((parseFloat(hs.opacity) || 1) < 0.95) homeMatch = false;
    if (homeProbe.classList.contains('kw-home') && hs.backgroundColor.indexOf('28, 36, 48') < 0) homeMatch = false;
  }
  const homeEl = document.querySelector('a.wardos-home, button.kw-home.wardos-home, button.kw-home, a.hub-home');
  let home = null;
  if (homeEl && vis(homeEl)) {
    const hr = homeEl.getBoundingClientRect();
    home = { w: Math.round(hr.width), h: Math.round(hr.height), x: Math.round(hr.left), y: Math.round(hr.top), label: homeEl.getAttribute('aria-label') || '' };
  }
  const touchSmall = [];
  for (const el of document.querySelectorAll('a.wardos-home, button.kw-home, a.hub-home, .day-tap, .kid-chip, .hub-launch a, .kw-offline')) {
    if (!vis(el) || touchSmall.length > 8) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 63.5 || r.height < 63.5) touchSmall.push({ t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) });
  }
  const debugLeak = /CLOCK OVERRIDE/.test(text) && !/[?&]diag=1(?:&|$)/.test(location.search);
  const diagEl = document.getElementById('wardos-diag');
  let diagOverlap = false;
  if (diagEl) {
    const d = diagEl.getBoundingClientRect();
    for (const el of hits) {
      if (diagEl.contains(el)) continue;
      const r = el.getBoundingClientRect();
      const x = Math.min(d.right, r.right) - Math.max(d.left, r.left);
      const y = Math.min(d.bottom, r.bottom) - Math.max(d.top, r.top);
      if (x > 1 && y > 1) diagOverlap = true;
    }
  }
  return { stageW: stage ? stage.offsetWidth : 0, stageH: stage ? stage.offsetHeight : 0, scale: Math.round(s * 1000) / 1000, innerWidth, innerHeight, dpr: devicePixelRatio, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, scrollH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight, banned, phase, pickup: text.indexOf('School pickup') >= 0, soccer: text.indexOf('Leave for soccer') >= 0, swim: text.indexOf('4:25 PM') >= 0, outdoor: text.indexOf('62') >= 0, indoor: text.indexOf('65') >= 0, hub: img ? img.getAttribute('src') : '', diag: !!diagEl, small: small.slice(0, 8), smallN: small.length, overlaps: overlaps.slice(0, 8), overlapN: overlaps.length, diagOverlap, lightsLaunch, clips: clips.slice(0, 8), clipN: clips.length, blanks, blankN: blanks.length, debugLeak, textHits: textHits.slice(0, 8), textN: textHits.length, overflow: overflow.slice(0, 8), overflowN: overflow.length, stray: stray.slice(0, 6), strayN: stray.length, touch: touchSmall.slice(0, 8), touchN: touchSmall.length, home, dead, deadN: dead.length, wrappedDays, feedDown, homeMatch };
}"""


def parse_viewport(raw):
    size, dpr = raw.split("@")
    w, h = size.split("x")
    return int(w), int(h), float(dpr)


def with_query(url, clock, diag):
    parts = urlparse(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    q["audit"] = "1"
    if clock and clock != "real":
        q["now"] = clock
        q["freeze"] = "1"
    if diag:
        q["diag"] = "1"
    return urlunparse(parts._replace(query=urlencode(q)))


def serve():
    class Q(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Q(*a, directory=str(ROOT), **k))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d/" % httpd.server_address[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="")
    ap.add_argument("--routes", default="core,hub-linked")
    ap.add_argument("--viewports", default="1920x1080@1,1536x864@1.25")
    ap.add_argument("--clocks", default="real,2026-11-10T12:30:00-06:00,2026-11-10T21:00:00-06:00")
    ap.add_argument("--paired-fixtures", action="store_true")
    ap.add_argument("--block-real-writes", action="store_true")
    ap.add_argument("--assert-layout", action="store_true")
    ap.add_argument("--out", required=True)
    ap.add_argument("--paired-key-file", default="")
    ap.add_argument("--fake-stale-camera-key", action="store_true")
    ap.add_argument("--allow-camera-playback-only", action="store_true")
    ap.add_argument("--block-real-controls", action="store_true")
    ap.add_argument("--delete-profile-on-exit", action="store_true")
    ap.add_argument("--profile", default="")
    args = ap.parse_args()
    if args.paired_key_file:
        raise SystemExit("real camera playback is not part of this synthetic matrix")
    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    routes = []
    for part in args.routes.split(","):
        part = part.strip()
        if part == "core":
            routes.extend(CORE)
        elif part == "hub-linked":
            routes.extend(LINKED)
        elif part:
            routes.append(part)
    httpd = None
    base = args.base
    if not base:
        httpd, base = serve()
    if not base.endswith("/"):
        base += "/"
    from playwright.sync_api import sync_playwright
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from pw_chrome import launch_kw
    shots = []
    fails = []
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_kw(p, args=["--no-sandbox", "--disable-dev-shm-usage"]))
        try:
            ver = browser.version
        except Exception:
            ver = ""
        for vp in args.viewports.split(","):
            css_w, css_h, dpr = parse_viewport(vp.strip())
            for clock in args.clocks.split(","):
                clock = clock.strip()
                ctx = browser.new_context(viewport={"width": css_w, "height": css_h}, device_scale_factor=dpr)
                if args.paired_fixtures or args.block_real_writes or args.block_real_controls:
                    def handle(route):
                        url = route.request.url
                        if route.request.method != "GET":
                            route.fulfill(status=403, content_type="application/json", body='{"ok":false,"blocked":true}')
                            return
                        if "kids-week" in url:
                            route.fulfill(status=200, content_type="application/json", body=json.dumps(WEEK))
                        elif "nest-live" in url:
                            route.fulfill(status=200, content_type="application/json", body=json.dumps(NEST))
                        elif "/wx" in url:
                            route.fulfill(status=200, content_type="application/json", body=json.dumps(WX))
                        elif "api.weather.gov" in url:
                            route.fulfill(status=404, content_type="application/json", body="{}")
                        elif "sensi-live" in url:
                            route.fulfill(status=200, content_type="application/json", body=json.dumps(SENSI))
                        elif "cal-live" in url or "cal-months" in url:
                            route.fulfill(status=200, content_type="application/json", body='{"status":"live","asOfIso":"2026-11-10","events":[]}')
                        else:
                            route.continue_()
                    ctx.route("**/*", handle)
                page = ctx.new_page()
                page.goto(base + "sheet-index.html", wait_until="domcontentloaded", timeout=30000)
                if args.paired_fixtures or args.fake_stale_camera_key:
                    page.evaluate("""() => {
                      localStorage.setItem('wardosNestProxyToken', 'legacy-stale-test-key');
                      localStorage.setItem('wardos-lights-proxy-token', 'paired-test-key-value');
                      localStorage.setItem('wardos-lights-proxy', location.origin);
                    }""")
                for route_name in routes:
                    diag = route_name == "sheet-index.html" and clock.endswith("12:30:00-06:00") and css_w == 1920
                    url = with_query(base + route_name, clock, diag)
                    tag = "real" if clock == "real" else ("day" if "12:30" in clock else "night")
                    dpr_tag = str(int(dpr)) if float(dpr).is_integer() else str(dpr).replace(".", "p")
                    name = "%s__%dx%d_dpr%s__%s.png" % (route_name.replace(".html", ""), css_w, css_h, dpr_tag, tag)
                    if diag:
                        name = name.replace(".png", "__diag.png")
                    rec = {"route": route_name, "css": [css_w, css_h], "dpr": dpr, "clock": clock, "file": name}
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        if route_name == "sheet-index.html" and "12:30" in clock:
                            try:
                                page.wait_for_function("() => (document.body.innerText || '').indexOf('School pickup') >= 0", timeout=5000)
                            except Exception:
                                pass
                        else:
                            page.wait_for_timeout(1600)
                        info = page.evaluate(PROBE)
                        shot = page.screenshot(full_page=False)
                        (out / name).write_bytes(shot)
                        rec["raster"] = [css_w * dpr, css_h * dpr] if abs((css_w * dpr) - round(css_w * dpr)) < 0.01 else [css_w, css_h]
                        rec["probe"] = info
                        if args.assert_layout and route_name == "sheet-index.html":
                            if info["stageW"] != 1920 or info["stageH"] != 1080:
                                fails.append(name + " stage")
                            if info["scrollW"] > info["clientW"] + 1 or info["scrollH"] > info["clientH"] + 1:
                                fails.append(name + " scroll")
                            if info["banned"]:
                                fails.append(name + " banned-text")
                            if clock.endswith("12:30:00-06:00") and "hub-window-day" not in (info["hub"] or ""):
                                fails.append(name + " expected-day")
                            if clock.endswith("12:30:00-06:00") and not info.get("pickup"):
                                fails.append(name + " expected-pickup")
                            if clock.endswith("21:00:00-06:00") and "hub-window-night" not in (info["hub"] or ""):
                                fails.append(name + " expected-night")
                            if diag and not info["diag"]:
                                fails.append(name + " diag")
                            if clock.endswith("12:30:00-06:00") and (not info.get("outdoor") or not info.get("indoor")):
                                fails.append(name + " temps")
                            if info.get("lightsLaunch"):
                                fails.append(name + " lights-launch")
                            if diag and info.get("diagOverlap"):
                                fails.append(name + " diag-overlap")
                        watch = tuple(routes)
                        if args.assert_layout:
                            if info.get("smallN"):
                                fails.append(name + " small-text")
                            if info.get("overlapN"):
                                fails.append(name + " overlap")
                            home = info.get("home") or {}
                            if not home or home.get("w", 0) < 64 or home.get("h", 0) < 64:
                                fails.append(name + " home")
                            if info.get("deadN"):
                                fails.append(name + " dead-area")
                            if info.get("wrappedDays"):
                                fails.append(name + " wrapped-days")
                            if info.get("feedDown"):
                                fails.append(name + " feed-down")
                            if info.get("homeMatch") is False:
                                fails.append(name + " home-contrast")
                        if args.assert_layout and route_name in watch:
                            if info.get("clipN"):
                                fails.append(name + " clipped")
                            if info.get("debugLeak"):
                                fails.append(name + " debug")
                            if info.get("blankN"):
                                fails.append(name + " blank")
                            if info.get("textN"):
                                fails.append(name + " text-overlap")
                            if info.get("overflowN"):
                                fails.append(name + " text-overflow")
                            if info.get("strayN"):
                                fails.append(name + " stray")
                            if info.get("touchN"):
                                fails.append(name + " touch")
                    except Exception as exc:
                        rec["error"] = str(exc)[:180]
                        fails.append(name + " " + rec["error"])
                    shots.append(rec)
                ctx.close()
        browser.close()
    if httpd:
        httpd.shutdown()
    manifest = {
        "git": os.popen("git -C %s rev-parse HEAD" % ROOT).read().strip(),
        "browser": ver,
        "shots": shots,
        "fails": fails,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps({"shots": len(shots), "fails": fails}, indent=2))
    if fails:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
