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
  const hubish = /sheet-index|kid-ainsley|kid-hayes|kid-harris/.test(location.pathname);
  if (hubish) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.replace(/\\s+/g, ' ').trim();
      if (!t) continue;
      const el = node.parentElement;
      if (!el || !vis(el) || el.closest('.hub-cam-rest')) continue;
      const px = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (px < 18) small.push({ t: t.slice(0, 24), px: px });
    }
  }
  const hits = [...document.querySelectorAll('a, button')].filter(vis);
  const overlaps = [];
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      if (hits[i].contains(hits[j]) || hits[j].contains(hits[i])) continue;
      const a = hits[i].getBoundingClientRect();
      const b = hits[j].getBoundingClientRect();
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > 1 && y > 1) overlaps.push({ a: (hits[i].textContent || '').trim().slice(0, 20), b: (hits[j].textContent || '').trim().slice(0, 20), x: Math.round(x), y: Math.round(y) });
    }
  }
  const boxHit = (a, b) => {
    if (!a || !b) return false;
    const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return x > 1 && y > 1;
  };
  const lights = document.getElementById('hub-lights-panel');
  const launch = document.querySelector('.hub-launch');
  const lightsLaunch = !!(lights && launch && vis(lights) && vis(launch) && boxHit(lights.getBoundingClientRect(), launch.getBoundingClientRect()));
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
  return { stageW: stage ? stage.offsetWidth : 0, stageH: stage ? stage.offsetHeight : 0, scale: Math.round(s * 1000) / 1000, innerWidth, innerHeight, dpr: devicePixelRatio, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, scrollH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight, banned, phase, pickup: text.indexOf('School pickup') >= 0, soccer: text.indexOf('Leave for soccer') >= 0, swim: text.indexOf('4:25 PM') >= 0, outdoor: text.indexOf('62') >= 0, indoor: text.indexOf('65') >= 0, hub: img ? img.getAttribute('src') : '', diag: !!diagEl, small: small.slice(0, 8), smallN: small.length, overlaps: overlaps.slice(0, 8), overlapN: overlaps.length, diagOverlap, lightsLaunch };
}"""


def parse_viewport(raw):
    size, dpr = raw.split("@")
    w, h = size.split("x")
    return int(w), int(h), float(dpr)


def with_query(url, clock, diag):
    parts = urlparse(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
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
                            page.wait_for_timeout(500)
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
                        if args.assert_layout and route_name in ("sheet-index.html", "kid-ainsley.html", "kid-hayes.html", "kid-harris.html"):
                            if info.get("smallN"):
                                fails.append(name + " small-text")
                            if info.get("overlapN"):
                                fails.append(name + " overlap")
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
