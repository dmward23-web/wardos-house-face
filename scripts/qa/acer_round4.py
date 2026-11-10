"""Round 4: audit-mode chore taps, jump frames, and a 7-year-old walkthrough.
Run from the repo root. Writes frames under /opt/cursor/artifacts/acer-r4.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pw_chrome import launch_kw

ROOT = Path(__file__).resolve().parents[2]
OUT = Path("/opt/cursor/artifacts/acer-r4")
OUT.mkdir(parents=True, exist_ok=True)
NOW = "2026-11-10T12:30:00-06:00"


def serve(p):
    from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
    import threading

    class Q(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            return

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), lambda *a, **k: Q(*a, directory=str(ROOT), **k))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


def shot(page, name):
    path = OUT / name
    try:
        page.screenshot(path=str(path), timeout=8000, animations="disabled")
    except Exception as exc:
        path.write_text(str(exc)[:200])
    return str(path)


def main():
    report = {"writes": [], "chores": {}, "jumps": {}, "walk": []}
    with sync_playwright() as p:
        httpd, base = serve(p)
        browser = p.chromium.launch(**launch_kw(p, args=["--no-sandbox", "--disable-dev-shm-usage"]))
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        week = {"asOfIso": "2026-11-10", "kids": {
            "hayes": {"today": [{"id": "pick", "kind": "school_pickup", "what": "School pickup", "startIso": "2026-11-10T15:15:00-06:00"}]},
            "harris": {"today": [{"id": "soc", "kind": "leave", "what": "soccer", "startIso": "2026-11-10T18:00:00-06:00"}]},
            "ainsley": {"today": [{"id": "swim", "kind": "sport", "what": "Ainsley swim", "startIso": "2026-11-10T16:25:00-06:00"}]},
            "dan": {"today": [{"id": "pick", "kind": "school_pickup", "what": "School pickup", "startIso": "2026-11-10T15:15:00-06:00"}]}
        }}
        def handle(route):
            url = route.request.url
            if route.request.method != "GET":
                route.fulfill(status=403, body="{}")
                return
            if "kids-week" in url:
                route.fulfill(status=200, content_type="application/json", body=json.dumps(week))
            elif "/wx" in url:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"tempC": 16.7, "wind": "calm"}))
            elif "sensi-live" in url:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"ambient": 65, "mode": "heat"}))
            elif "api.weather.gov" in url:
                route.fulfill(status=404, body="{}")
            elif "nest-live" in url:
                route.fulfill(status=200, content_type="application/json", body=json.dumps({"cams": []}))
            else:
                route.continue_()
        ctx.route("**/*", handle)
        page = ctx.new_page()

        def on_req(req):
            if req.method not in ("GET", "HEAD"):
                report["writes"].append(req.method + " " + req.url)

        page.on("request", on_req)
        page.goto(base + "/sheet-chores.html?audit=1&now=" + NOW + "&freeze=1", wait_until="domcontentloaded")
        page.wait_for_timeout(1800)
        taps = page.locator(".day-tap.is-today")
        if taps.count() < 10:
            taps = page.locator(".chore[data-check], .day-tap.is-today")
        n = min(10, taps.count())
        for i in range(n):
            taps.nth(i).click(timeout=3000, force=True)
        page.wait_for_timeout(300)
        done = page.locator(".day-tap.done, .chore.done").count()
        report["chores"]["rapid"] = {"clicked": n, "done": done}
        if n:
            taps.nth(0).click(timeout=3000, force=True)
            page.wait_for_timeout(900)
            taps.nth(0).click(timeout=3000, force=True)
            page.wait_for_timeout(200)
        report["chores"]["afterUndoFirst"] = page.locator(".day-tap.done, .chore.done").count()
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        report["chores"]["afterReload"] = page.locator(".day-tap.done, .chore.done").count()
        page.goto(base + "/sheet-index.html?audit=1&now=" + NOW + "&freeze=1", wait_until="domcontentloaded")
        page.wait_for_timeout(600)
        page.goto(base + "/kid-hayes.html?audit=1&now=" + NOW + "&freeze=1", wait_until="domcontentloaded")
        page.wait_for_timeout(1600)
        report["chores"]["hayesFill"] = page.evaluate("() => document.querySelector('.kw-canvas') && document.querySelector('.kw-canvas').getAttribute('data-fill')")
        report["chores"]["hayesDone"] = page.locator("#sec-musts .chore.done").count()

        for kid in ("hayes", "harris", "ainsley"):
            page.goto(base + f"/kid-{kid}.html?audit=1&now={NOW}&freeze=1", wait_until="domcontentloaded")
            page.wait_for_timeout(1600)
            cv = page.locator(".kw-canvas")
            box = cv.bounding_box()
            shot(page, f"{kid}-idle.png")
            page.evaluate("() => window.KidWorld && KidWorld.jump && KidWorld.jump()")
            page.wait_for_timeout(420)
            air = page.evaluate("() => document.querySelector('.kw-canvas') && document.querySelector('.kw-canvas').getAttribute('data-jump')")
            shot(page, f"{kid}-apex.png")
            page.wait_for_timeout(700)
            ground = page.evaluate("() => document.querySelector('.kw-canvas') && document.querySelector('.kw-canvas').getAttribute('data-jump')")
            shot(page, f"{kid}-landed.png")
            before = page.evaluate("() => document.querySelector('.kw-canvas') && document.querySelector('.kw-canvas').getAttribute('data-fill')")
            chore = page.locator("#sec-musts .chore:not(.done)").first
            if chore.count():
                chore.click(timeout=3000, force=True)
            page.wait_for_timeout(700)
            after = page.evaluate("() => document.querySelector('.kw-canvas') && document.querySelector('.kw-canvas').getAttribute('data-fill')")
            shot(page, f"{kid}-grown.png")
            report["jumps"][kid] = {"air": air, "landed": ground, "fillBefore": before, "fillAfter": after}

        page.set_viewport_size({"width": 1920, "height": 1080})
        for size, tag in (({"width": 1920, "height": 1080}, "1920"), ({"width": 1536, "height": 816}, "1536x816")):
            page.set_viewport_size(size)
            page.goto(base + "/sheet-index.html?audit=1&now=" + NOW + "&freeze=1", wait_until="domcontentloaded")
            page.wait_for_timeout(1200)
            shot(page, f"walk-{tag}-1-hub.png")
            page.locator("a.tile.hayes").click(timeout=4000)
            page.wait_for_timeout(1500)
            shot(page, f"walk-{tag}-2-hayes.png")
            page.locator("#sec-musts .chore").first.click(timeout=3000, force=True)
            page.wait_for_timeout(500)
            shot(page, f"walk-{tag}-3-chore.png")
            box = page.locator(".kw-canvas").bounding_box()
            if box:
                page.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.78)
            page.wait_for_timeout(420)
            shot(page, f"walk-{tag}-4-jump.png")
            page.locator(".wardos-home, .kw-home").first.click(timeout=3000)
            page.wait_for_timeout(1600)
            report["walk"].append({"size": tag, "url": page.url, "hub": "sheet-index" in page.url or page.url.rstrip("/").endswith("index.html")})
            shot(page, f"walk-{tag}-5-home.png")

        browser.close()
        httpd.shutdown()
    (OUT / "report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    ok = (
        report["chores"]["rapid"]["clicked"] >= 10
        and report["chores"]["rapid"]["done"] >= 10
        and not report["writes"]
        and all(v.get("air") == "air" for v in report["jumps"].values())
        and all(step["hub"] for step in report["walk"])
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
