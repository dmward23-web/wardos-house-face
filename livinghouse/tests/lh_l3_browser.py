#!/usr/bin/env python3
"""Layer 3 browser proof. Synthetic feeds only. Serves the repo and stubs every data json.
   TZ=America/Chicago. Screenshots go to LH_L3_OUT, or a temp dir when that is unset.
   LH_L3_PROBE=1 also records a 60s ?probe=1 run at the wall and both phone sizes."""
import json, os, tempfile, threading, time
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

os.environ["TZ"] = "America/Chicago"
for k in list(os.environ):
    if k.startswith("WARDOS_"):
        del os.environ[k]

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
# Proof stays off git. Set LH_L3_OUT to keep screenshots; otherwise they go to a temp dir.
OUT = os.environ.get("LH_L3_OUT") or tempfile.mkdtemp(prefix="lh-l3-")
os.makedirs(OUT, exist_ok=True)

def fetched():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def days(with_dan=True):
    out = {}
    t = datetime(2026, 10, 1, tzinfo=timezone.utc)
    end = datetime(2026, 12, 31, tzinfo=timezone.utc)
    while t <= end:
        out[t.strftime("%Y-%m-%d")] = {"withDan": with_dan}
        t = t.replace(day=t.day)  # placeholder, replaced below
        from datetime import timedelta
        t = t + timedelta(days=1)
    return out

def shift(cal, a, b):
    raw = json.loads(json.dumps(cal))
    for e in raw["upcomingLeaves"]:
        e["start"] = e["start"].replace(a, b)
        e["end"] = e["end"].replace(a, b)
    return raw

SCHOOL = {"status": "live", "upcomingLeaves": [
    {"id": "h1", "summary": "Hayes item 1 leave 7:05", "start": "2026-10-20T07:40:00-05:00", "end": "2026-10-20T15:00:00-05:00", "allDay": False},
    {"id": "r1", "summary": "Harris item 1", "start": "2026-10-20T08:00:00-05:00", "end": "2026-10-20T15:00:00-05:00", "allDay": False},
    {"id": "a1", "summary": "Ainsley item 1 leave 7:20", "start": "2026-10-20T07:50:00-05:00", "end": "2026-10-20T15:00:00-05:00", "allDay": False},
]}
DEC = {"status": "live", "upcomingLeaves": [
    {"id": "h1", "summary": "Hayes item 1 leave 7:05", "start": "2026-12-01T07:40:00-06:00", "end": "2026-12-01T15:00:00-06:00", "allDay": False},
    {"id": "r1", "summary": "Harris item 1", "start": "2026-12-01T08:00:00-06:00", "end": "2026-12-01T15:00:00-06:00", "allDay": False},
]}
AUDIENCE = {"status": "live", "upcomingLeaves": [
    {"id": "dad", "summary": "Example Fest with Sam · leave 4:10", "start": "2026-10-22T16:30:00-05:00", "end": "2026-10-22T18:00:00-05:00", "allDay": False},
    {"id": "kid", "summary": "Hayes practice", "start": "2026-10-22T17:00:00-05:00", "end": "2026-10-22T18:00:00-05:00", "allDay": False},
]}

STATE = {"mode": "school"}

def months_body():
    mode = STATE["mode"]
    if mode == "missing":
        return None
    d = days(True)
    if mode in ("away", "return"):
        d["2026-10-21"] = {"withDan": False}
    return {"changeMin": 900, "days": d, "status": "live", "fetchedAt": fetched()}

def cal_body():
    mode = STATE["mode"]
    if mode == "missing":
        return None
    if mode == "dec":
        cal = DEC
    elif mode == "away":
        cal = shift(SCHOOL, "2026-10-20", "2026-10-21")
    elif mode == "audience":
        cal = AUDIENCE
    else:
        cal = SCHOOL
    out = json.loads(json.dumps(cal))
    out["fetchedAt"] = fetched()
    out["status"] = "live"
    return out

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def log_message(self, fmt, *args):
        return
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.endswith("/caps.json"):
            return self._json({"video": False})
        if path.endswith("/cal-live.json") or path.endswith("/cal-live.raw.json"):
            body = cal_body()
            return self._json(body) if body is not None else self._miss()
        if path.endswith("/cal-months.json"):
            body = months_body()
            return self._json(body) if body is not None else self._miss()
        if path.endswith("/kids-week.json"):
            if STATE["mode"] == "missing":
                return self._miss()
            return self._json({"kids": {"ainsley": {"quests": []}, "hayes": {"quests": []}, "harris": {"quests": []}}})
        if path.endswith("/lights-live.json") or path.endswith("/sensi-live.json") or path.endswith("/nest-live.json"):
            if STATE["mode"] == "missing":
                return self._miss()
            return self._json({"status": "offline"})
        return super().do_GET()
    def _json(self, obj):
        raw = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)
    def _miss(self):
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()

def serve():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

BANNED = ["Kids away", "Back in", "Dad week", "home week", "away week", "handoff", "Who's where", "custody", "Smith", "Mom"]

def assert_clean(page, where):
    text = page.locator("body").inner_text()
    for w in BANNED:
        if w.lower() in text.lower():
            raise SystemExit("banned copy on " + where)

def open_page(page, base, query, w, h):
    print("open " + query + " @ " + str(w) + "x" + str(h), flush=True)
    page.set_viewport_size({"width": w, "height": h})
    try:
        page.evaluate("() => localStorage.removeItem('lh-audience')")
    except Exception:
        pass
    page.goto(base + query, wait_until="domcontentloaded")
    # The moon tick rewrites <html> every second, so a visibility wait never goes stable.
    page.wait_for_function("() => document.documentElement.classList.contains('lh-ready')", timeout=20000)
    page.wait_for_timeout(250)

def attr(page, name):
    return page.locator("html").get_attribute(name)

def write_proof(name, data):
    # The proof directory is a network mount and can return EIO on a direct write.
    dest = os.path.join(OUT, name)
    last = None
    for i in range(6):
        try:
            with open(dest, "wb") as fh:
                fh.write(data)
            return
        except OSError as e:
            last = e
            time.sleep(0.5 * (i + 1))
    raise last

def shot(page, name):
    write_proof(name, page.screenshot())

def press_at(page, selector):
    box = page.locator(selector).bounding_box()
    if not box:
        raise AssertionError("no box for " + selector)
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()

def after_hold(page):
    # The 520ms press timer shares the page clock. Headless Chrome on this VM
    # can lag that clock by several seconds, so a wall-clock sleep returns too early
    # and pointerup then cancels the timer. Wait until a later page timer fires.
    page.wait_for_function(
        "() => new Promise(function (res) { setTimeout(function () { res(true); }, 900); })",
        timeout=20000,
    )

def morning_lines(page):
    return page.locator("#lh-morning .ln").all_inner_texts()

def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    base = "http://127.0.0.1:%d/livinghouse/index.html" % httpd.server_address[1]
    fails = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True,
                                     args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
        context = browser.new_context(locale="en-US")
        context.add_init_script("window.__spoke=0;try{const s=window.speechSynthesis;if(s){s.speak=function(){window.__spoke++;};}}catch(e){}")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        posts = []
        page.on("request", lambda r: posts.append(r.url) if r.method == "POST" else None)

        def check(label, fn):
            try:
                fn()
            except Exception as e:
                fails.append(label + ": " + str(e).split("\n")[0])

        # real clock: no override chrome
        STATE["mode"] = "school"
        open_page(page, base, "", 1920, 1080)
        check("no override", lambda: (_eq(page.locator(".lh-clocktag").count(), 0), _eq(page.locator(".lh-probe").count(), 0)))

        sizes = [(1920, 1080, "wall-1920"), (440, 956, "phone-440"), (390, 844, "phone-390")]

        # before: 5:30, sequence not started
        for w, h, name in sizes:
            open_page(page, base, "?now=2026-10-20T05:30:00-05:00&freeze=1", w, h)
            check("before " + name, lambda: (_eq(attr(page, "data-morning"), "before"), _true(page.locator("#lh-morning").is_hidden())))
            assert_clean(page, "before " + name)
            shot(page, "before-" + name + ".png")

        # school morning 6:30
        for w, h, name in sizes:
            open_page(page, base, "?now=2026-10-20T06:30:00-05:00&freeze=1", w, h)
            def morning_ok(name=name):
                _eq(attr(page, "data-morning"), "on")
                _eq(attr(page, "data-morning-feed"), "live")
                _true(page.locator("#lh-moon").evaluate("el => el.classList.contains('lh-set')"))
                lines = morning_lines(page)
                _eq(lines, ["Hayes · Leave 7:05 AM", "Harris · Item 1 8:00 AM"])
                _true("Ainsley" not in " ".join(lines))
            check("morning " + name, morning_ok)
            assert_clean(page, "morning " + name)
            shot(page, "after-morning-" + name + ".png")

        # long-press text, voice stays muted, audience toggle, 44px control
        open_page(page, base, "?now=2026-10-20T06:30:00-05:00&freeze=1", 1920, 1080)
        box = page.locator("#lh-audience").bounding_box()
        check("audience size", lambda: (_true(box["width"] >= 44 and box["height"] >= 44)))
        press_at(page, ".lh-board")
        after_hold(page)
        check("press sign", lambda: (_eq(page.locator("#lh-press").inner_text(), "The Ward's"), _eq(page.locator("#lh-press").get_attribute("data-voice"), "muted"), _eq(page.locator("#lh-press").get_attribute("data-spoken"), "0")))
        page.mouse.up()
        _eq(page.evaluate("window.__spoke"), 0)
        page.locator("#lh-audience").click()
        page.wait_for_timeout(200)
        check("tap guest", lambda: _eq(attr(page, "data-audience"), "guest"))
        press_at(page, "#lh-audience")
        after_hold(page)
        check("hold dan", lambda: (_eq(attr(page, "data-audience"), "dan"), _true(page.locator("#lh-danhooks").evaluate("el => el.hidden === false")), _eq((page.locator("#lh-danhooks").inner_text() or "").strip(), ""), _eq(page.locator("#lh-rough").get_attribute("data-feed"), "missing"), _eq(page.locator("#lh-partner").get_attribute("data-feed"), "missing")))
        page.mouse.up()
        _eq(page.evaluate("window.__spoke"), 0)

        # away day
        STATE["mode"] = "away"
        for w, h, name in sizes:
            open_page(page, base, "?now=2026-10-21T06:30:00-05:00&freeze=1", w, h)
            def away_ok(name=name):
                _eq(attr(page, "data-morning"), "away")
                _true(page.locator("#lh-morning").is_hidden())
                _true(page.locator("html").evaluate("el => el.classList.contains('lh-state-away')"))
                _true(not page.locator(".lh-away").is_hidden())
                text = page.locator("body").inner_text()
                _true("7:05" not in text and "Leave" not in text and "item 1" not in text.lower())
            check("away " + name, away_ok)
            assert_clean(page, "away " + name)
            shot(page, "away-" + name + ".png")
        press_at(page, ".lh-kw[data-kid=hayes] .name")
        after_hold(page)
        check("away press", lambda: _true(page.locator("#lh-press").is_hidden()))
        page.mouse.up()
        _eq(page.evaluate("window.__spoke"), 0)

        # missing feed
        STATE["mode"] = "missing"
        for w, h, name in sizes:
            open_page(page, base, "?now=2026-10-20T06:30:00-05:00&freeze=1", w, h)
            def miss_ok(name=name):
                _eq(attr(page, "data-morning"), "missing")
                _eq(attr(page, "data-morning-feed"), "missing")
                _true(page.locator("#lh-morning").is_hidden())
                _true(page.locator("html").evaluate("el => el.classList.contains('lh-state-home')"))
                _true("Calendar offline" in page.locator("body").inner_text())
                _true("Leave" not in page.locator("#lh").inner_text())
            check("missing " + name, miss_ok)
            assert_clean(page, "missing " + name)
            shot(page, "missing-" + name + ".png")

        # return morning is still away (change minute has not arrived)
        STATE["mode"] = "return"
        open_page(page, base, "?now=2026-10-22T06:30:00-05:00&freeze=1", 1920, 1080)
        check("return", lambda: (_eq(attr(page, "data-morning"), "away"), _true(page.locator("#lh-morning").is_hidden())))

        # dad afternoon: kids mode shows the Dad leave, guest mode hides it and keeps the kid line
        STATE["mode"] = "audience"
        open_page(page, base, "?now=2026-10-22T15:00:00-05:00&freeze=1&audience=kids", 1920, 1080)
        check("dad candle", lambda: _true("Leave" in page.locator(".lh-candle").inner_text() and "4:10" in page.locator(".lh-candle").inner_text()))
        for w, h, name in sizes:
            open_page(page, base, "?now=2026-10-22T15:00:00-05:00&freeze=1&audience=guest", w, h)
            def guest_ok(name=name):
                _eq(attr(page, "data-audience"), "guest")
                _eq(page.locator(".lh-dad").get_attribute("href"), None)
                _eq(page.locator(".lh-plaque").inner_text().strip(), "Dad")
                candle = page.locator(".lh-candle").inner_text()
                _true("Example Fest" not in candle and "4:10" not in candle)
                _true("Hayes" in page.locator("body").inner_text())
            check("guest " + name, guest_ok)
            assert_clean(page, "guest " + name)
            shot(page, "audience-" + name + ".png")

        # date fixtures
        STATE["mode"] = "school"
        open_page(page, base, "?now=2026-10-24T06:30:00-05:00&freeze=1", 1920, 1080)
        check("oct 24", lambda: _eq(attr(page, "data-morning"), "weekend"))
        open_page(page, base, "?now=2026-10-31T06:30:00-05:00&freeze=1", 440, 956)
        check("oct 31", lambda: (_eq(attr(page, "data-morning"), "weekend"), _true(page.locator("html").evaluate("el => el.classList.contains('lh-halloween')"))))
        open_page(page, base, "?now=2026-11-01T06:30:00-06:00&freeze=1", 390, 844)
        check("nov 1", lambda: _eq(attr(page, "data-morning"), "weekend"))
        STATE["mode"] = "dec"
        open_page(page, base, "?now=2026-12-01T06:30:00-06:00&freeze=1", 1920, 1080)
        check("dec 1", lambda: _eq(morning_lines(page), ["Hayes · Leave 7:05 AM", "Harris · Item 1 8:00 AM"]))

        # reduced motion still shows the lines
        STATE["mode"] = "school"
        page.emulate_media(reduced_motion="reduce")
        open_page(page, base, "?now=2026-10-20T06:30:00-05:00&freeze=1", 1920, 1080)
        check("reduced motion", lambda: _eq(morning_lines(page), ["Hayes · Leave 7:05 AM", "Harris · Item 1 8:00 AM"]))
        page.emulate_media(reduced_motion="no-preference")

        check("no posts", lambda: _eq(posts, []))
        ours = [e for e in errors if "lh" in e.lower() or "livinghouse" in e.lower()]
        if ours:
            fails.append("page errors: " + " | ".join(ours[:4]))

        if os.environ.get("LH_L3_PROBE") == "1" and not fails:
            for w, h, name in sizes:
                STATE["mode"] = "school"
                open_page(page, base, "?now=2026-10-20T06:30:00-05:00&freeze=1&probe=1", w, h)
                page.wait_for_function("() => window.__lhProbe && window.__lhProbe.length >= 60", timeout=180000)
                data = page.evaluate("() => window.__lhProbe.slice(0, 60)")
                raw = json.dumps({"viewport": "%dx%d" % (w, h), "seconds": 60, "note": "headless Chromium, synthetic feeds, device perf UNVERIFIED", "samples": data}, indent=1).encode()
                write_proof("probe-" + name + ".json", raw)
                _true(page.locator(".lh-probe").count() == 1)

        browser.close()
    httpd.shutdown()
    if fails:
        print("lh-l3-browser: FAIL")
        for f in fails:
            print(" - " + f)
        raise SystemExit(1)
    print("lh-l3-browser: ok")

def _eq(got, want):
    if got != want:
        raise AssertionError(repr(got) + " != " + repr(want))

def _true(v):
    if not v:
        raise AssertionError("expected true")

if __name__ == "__main__":
    main()
