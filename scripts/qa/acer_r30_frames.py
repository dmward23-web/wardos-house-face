#!/usr/bin/env python3
"""Round 30 frames. Synthetic feeds. Does not change stage scale."""
import json, os, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import acer_render_matrix as mx
from pw_chrome import launch_kw
from playwright.sync_api import sync_playwright

ROOT = mx.ROOT
ROUTES = [
    "sheet-index.html", "sheet-lights.html", "sheet-chores.html",
    "kid-hayes.html", "kid-harris.html", "kid-ainsley.html",
    "sheet-today.html", "month.html", "mercury-run.html",
]
CLOCKS = ["2026-11-10T12:30:00-06:00", "2026-11-10T21:00:00-06:00"]
VIEWPORTS = ["1920x1080@1", "1536x864@1.25"]


def tag_of(clock):
    return "day" if "12:30" in clock else "night"


def name_of(route, css_w, css_h, dpr, clock):
    dpr_tag = str(int(dpr)) if float(dpr).is_integer() else str(dpr).replace(".", "p")
    stem = route.replace(".html", "")
    return "%s__%dx%d_dpr%s__%s.png" % (stem, css_w, css_h, dpr_tag, tag_of(clock))


def main():
    out = Path("/opt/cursor/artifacts/acer-r30")
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    httpd, base = mx.serve()
    shots = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(**launch_kw(p, args=["--no-sandbox", "--disable-dev-shm-usage"]))
            for vp in VIEWPORTS:
                css_w, css_h, dpr = mx.parse_viewport(vp)
                for clock in CLOCKS:
                    ctx = browser.new_context(viewport={"width": css_w, "height": css_h}, device_scale_factor=dpr)

                    week_body = json.dumps(mx.WEEK)

                    def handle(route, _request=None):
                        url = route.request.url
                        if route.request.method != "GET":
                            route.fulfill(status=403, content_type="application/json", body='{"ok":false}')
                            return
                        if "kids-week" in url:
                            route.fulfill(status=200, content_type="application/json", body=week_body)
                        elif "nest-live" in url:
                            route.fulfill(status=200, content_type="application/json", body=json.dumps(mx.NEST))
                        elif "/wx" in url:
                            route.fulfill(status=200, content_type="application/json", body=json.dumps(mx.WX))
                        elif "sensi-live" in url:
                            route.fulfill(status=200, content_type="application/json", body=json.dumps(mx.SENSI))
                        elif "cal-live" in url or "cal-months" in url:
                            route.fulfill(status=200, content_type="application/json", body='{"status":"live","asOfIso":"2026-11-10","events":[]}')
                        else:
                            route.continue_()

                    ctx.route("**/*", handle)
                    page = ctx.new_page()
                    page.goto(base + "sheet-index.html", wait_until="domcontentloaded", timeout=30000)
                    page.evaluate("""() => {
                      localStorage.setItem('wardos-lights-proxy-token', 'paired-test-key-value');
                      localStorage.setItem('wardos-lights-proxy', location.origin);
                    }""")
                    for route_name in ROUTES:
                        url = mx.with_query(base + route_name, clock, False)
                        file_name = name_of(route_name, css_w, css_h, dpr, clock)
                        page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        page.wait_for_timeout(1400)
                        page.screenshot(path=str(out / file_name), full_page=False)
                        shots.append(file_name)
                    # Hayes add-a-save modal
                    page.goto(mx.with_query(base + "kid-hayes.html", clock, False), wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(1200)
                    page.evaluate("""() => {
                      var b = document.querySelector('.prism-jar-plus, .saves-plus, [data-saves-plus]');
                      if (b) b.click();
                    }""")
                    page.wait_for_timeout(400)
                    modal = name_of("kid-hayes-add-save", css_w, css_h, dpr, clock)
                    page.screenshot(path=str(out / modal), full_page=False)
                    shots.append(modal)
                    # Chores with More expanded
                    page.goto(mx.with_query(base + "sheet-chores.html", clock, False), wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(1600)
                    page.evaluate("""() => {
                      document.querySelectorAll('section.col').forEach(function (col) { col.setAttribute('data-show-all', '1'); });
                      if (window.fitChoreColumns) window.fitChoreColumns();
                    }""")
                    page.wait_for_timeout(400)
                    more = name_of("sheet-chores-more", css_w, css_h, dpr, clock)
                    page.screenshot(path=str(out / more), full_page=False)
                    shots.append(more)
                    ctx.close()
                    # Unavailable feed, Hayes only
                    off = browser.new_context(viewport={"width": css_w, "height": css_h}, device_scale_factor=dpr)

                    def missing(route):
                        if "kids-week" in route.request.url:
                            route.fulfill(status=404, content_type="application/json", body="{}")
                        elif route.request.method != "GET":
                            route.fulfill(status=403, content_type="application/json", body="{}")
                        else:
                            route.continue_()

                    off.route("**/*", missing)
                    op = off.new_page()
                    op.goto(mx.with_query(base + "kid-hayes.html", clock, False), wait_until="domcontentloaded", timeout=30000)
                    op.wait_for_timeout(1600)
                    op.evaluate("""() => { document.dispatchEvent(new Event('house:kids-data-missing')); }""")
                    op.wait_for_timeout(300)
                    miss = name_of("kid-hayes-unavailable", css_w, css_h, dpr, clock)
                    op.screenshot(path=str(out / miss), full_page=False)
                    shots.append(miss)
                    off.close()
            browser.close()
    finally:
        httpd.shutdown()
    sha = os.popen("git -C %s rev-parse HEAD" % ROOT).read().strip()
    manifest = {"git": sha, "round": 30, "shots": shots}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps({"shots": len(shots), "git": sha, "out": str(out)}))


if __name__ == "__main__":
    main()
