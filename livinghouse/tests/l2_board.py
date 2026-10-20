"""Layer 2 board check and stills. Synthetic fixtures only. Serves the repo on loopback.
Usage (from the repo root, or any cwd):
  python3 livinghouse/tests/l2_board.py check
  python3 livinghouse/tests/l2_board.py shots before|after <dir>
  python3 livinghouse/tests/l2_board.py probe <dir>
LH_ROOT overrides the repo path. Non-loopback requests get an empty JSON body.
"""
import json, os, sys, threading, functools
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, quote
from playwright.sync_api import sync_playwright

ROOT = os.environ.get("LH_ROOT") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FETCHED = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
VPS = [(1920, 1080), (440, 956), (390, 844)]
BANNED = (
    "kids away", "back in", "kids back", "dad week", "home week", "away week",
    "handoff", "hand-off", "who's where", "who’s where", "custody", "their mom",
    "jones", "before friday", "fri 3", "friday 3",
)
EVENTS = [
    {"id": "e1", "summary": "Road trip · leave 2:10", "start": "2026-10-23T15:00:00-05:00", "end": "2026-10-23T18:00:00-05:00", "allDay": False},
    {"id": "e2", "summary": "Hayes practice", "start": "2026-10-24T07:00:00-05:00", "end": "2026-10-24T08:00:00-05:00", "allDay": False},
    {"id": "e3", "summary": "Ainsley art", "start": "2026-10-24T15:00:00-05:00", "end": "2026-10-24T16:00:00-05:00", "allDay": False},
    {"id": "e4", "summary": "Harris practice", "start": "2026-10-27T16:30:00-05:00", "end": "2026-10-27T17:30:00-05:00", "allDay": False},
    {"id": "e5", "summary": "Library books", "start": "2026-10-31T18:00:00-05:00", "end": "2026-10-31T19:00:00-05:00", "allDay": False},
    {"id": "e6", "summary": "Hayes practice", "start": "2026-11-01T10:00:00-06:00", "end": "2026-11-01T11:00:00-06:00", "allDay": False},
    {"id": "e7", "summary": "Harris practice", "start": "2026-12-01T16:00:00-06:00", "end": "2026-12-01T17:00:00-06:00", "allDay": False},
]
HOME_DAYS = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-27", "2026-10-30", "2026-10-31", "2026-11-01", "2026-12-01"]
AWAY_DAYS = ["2026-10-25", "2026-10-26"]
TAP_DAYS = ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-27", "2026-10-31", "2026-11-01", "2026-12-01"]

def months():
    days = {}
    for d in HOME_DAYS:
        days[d] = {"withDan": True}
    for d in AWAY_DAYS:
        days[d] = {"withDan": False}
    return {"status": "live", "fetchedAt": FETCHED, "changeMin": 600, "days": days}

def taps():
    body = {}
    for d in TAP_DAYS:
        body["house-checkoffs:ainsley:" + d] = {"item-1": {"v": True, "t": 1}}
        body["house-checkoffs:hayes:" + d] = {"item-2": {"v": False, "t": 1}}
        body["house-checkoffs:harris:" + d] = {"item-3": {"v": True, "t": 1}}
    return {"ok": True, "taps": body}

def feeds(base):
    return {
        "cal": {"status": "live", "fetchedAt": FETCHED, "upcomingLeaves": EVENTS},
        "months": months(),
        "lights": {"status": "live", "fetchedAt": FETCHED, "writeProxy": base.rstrip("/"), "lights": [
            {"id": "harris-room", "on": True, "online": True},
            {"id": "kitchen", "on": False, "online": True},
        ]},
        "sensi": {"status": "live", "fetchedAt": FETCHED, "thermostat": {"online": True, "mode": "Heat", "ambient": 18, "heatSetpoint": 21}},
        "nest": {"status": "live", "fetchedAt": FETCHED, "cameras": [{"name": "eave", "online": True, "snapshotUrl": None, "streamUrl": None}]},
        "kw": {"kids": {
            "ainsley": {"quests": [{"id": "item-1", "cadence": "daily"}]},
            "hayes": {"quests": [{"id": "item-2", "cadence": "daily"}]},
            "harris": {"quests": [{"id": "item-3", "cadence": "daily"}]},
        }},
    }

PATHS = {
    "/data/cal-live.json": "cal",
    "/data/cal-months.json": "months",
    "/data/lights-live.json": "lights",
    "/data/sensi-live.json": "sensi",
    "/data/nest-live.json": "nest",
    "/kids-week.json": "kw",
}

def serve():
    class Q(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, "http://127.0.0.1:%d/" % srv.server_address[1]

def route_for(base, missing, hits):
    data = feeds(base)
    def handle(route):
        req = route.request
        u = urlparse(req.url)
        hits.append(u.path)
        if u.hostname not in ("127.0.0.1", "localhost"):
            route.fulfill(status=200, content_type="application/json", body="{}")
            return
        if u.path == "/api/taps":
            if missing:
                route.fulfill(status=404, body="")
            else:
                route.fulfill(status=200, content_type="application/json", body=json.dumps(taps()))
            return
        key = PATHS.get(u.path)
        if key and missing:
            route.fulfill(status=404, body="")
            return
        if key:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(data[key]))
            return
        if u.path.endswith("/data/cal-live.raw.json"):
            route.fulfill(status=404, body="")
            return
        route.continue_()
    return handle

PROBE_JS = """() => {
  const text = (document.body.innerText || "");
  const aria = [...document.querySelectorAll("[aria-label]")].map(e => e.getAttribute("aria-label") || "");
  const cr = [...document.querySelectorAll(".lh-cr")].map(e => ({
    kid: e.dataset.kid, kind: e.dataset.kind, art: e.dataset.art, why: e.dataset.why || "",
    pose: e.dataset.pose, hidden: !!e.hidden, pace: e.classList.contains("pace")
  }));
  const stones = [...document.querySelectorAll(".lh-stone")].map(e => ({
    pri: e.dataset.priority, fog: e.classList.contains("fog"), fo: e.style.getPropertyValue("--fo"),
    text: (e.innerText || "").replace(/\\s+/g, " ").trim()
  }));
  const pot = document.querySelector(".lh-cauldron");
  const yard = document.querySelector("#lh-yard");
  const week = document.querySelector("#lh-yard-week");
  const smoke = document.querySelector(".lh-smoke");
  const gar = document.querySelector("#lh-garage");
  const cam = document.querySelector(".lh-camlamp");
  const attr = (el, k) => el ? el.getAttribute(k) : null;
  const de = document.documentElement;
  let nights = null;
  try { nights = JSON.parse(localStorage.getItem("lh-yard-nights") || "null"); } catch (e) { nights = "bad"; }
  return {
    away: de.classList.contains("lh-state-away"),
    home: de.classList.contains("lh-state-home"),
    halloween: de.classList.contains("lh-halloween"),
    leavesHidden: !!document.querySelector("#lh-leaves").hidden,
    fogPriority: de.getAttribute("data-fog-priority"),
    mirror: de.getAttribute("data-mirror"),
    yardN: de.getAttribute("data-yard"),
    sign: (document.querySelector(".lh-board") || {}).textContent || "",
    dad: (document.querySelector(".lh-dad .lh-plaque") || {}).textContent || "",
    lanternHidden: document.querySelector(".lh-away").hidden,
    lanternLabel: document.querySelector(".lh-away").getAttribute("aria-label"),
    calloutHidden: document.querySelector("#lh-callout").hidden,
    callout: (document.querySelector("[data-lh=c-line]") || {}).textContent || "",
    candleEmpty: document.querySelector(".lh-candle").classList.contains("empty"),
    candle: ((document.querySelector("[data-lh=cand-v]") || {}).textContent || "") + " " + ((document.querySelector("[data-lh=cand-k]") || {}).textContent || ""),
    potFeed: pot.getAttribute("data-feed"),
    potText: (pot.innerText || "").replace(/\\s+/g, " ").trim(),
    potFill: getComputedStyle(pot).getPropertyValue("--fill").trim(),
    creatures: cr,
    stones: stones,
    pebbles: [...document.querySelectorAll(".lh-pebble")].map(e => e.dataset.day),
    pebbleText: [...document.querySelectorAll(".lh-pebble")].map(e => e.textContent).join(""),
    weekFeed: attr(week, "data-feed"),
    weekWhy: attr(week, "data-why"),
    smokeHidden: smoke ? smoke.hidden : true,
    smokeFeed: attr(smoke, "data-feed"),
    smokeWhy: attr(smoke, "data-why"),
    garHidden: gar ? gar.hidden : true,
    garFeed: attr(gar, "data-feed"),
    camHidden: cam ? cam.hidden : true,
    wins: [...document.querySelectorAll(".lh-win")].map(e => e.dataset.kid + ":" + [...e.classList].filter(c => ["lit","dark","glow"].includes(c)).join(",")),
    previewHidden: document.querySelector("#lh-preview").hidden,
    clockTag: !!document.querySelector(".lh-clocktag"),
    probe: !!document.querySelector(".lh-probe"),
    probeN: (window.__lhProbe || []).length,
    nights: nights,
    text: text,
    aria: aria,
    pumpkins: document.querySelectorAll("#lh-pglow i").length
  };
}"""

def open_board(browser, base, w, h, query, missing, yard, token, reduced):
    ctx = browser.new_context(viewport={"width": w, "height": h}, reduced_motion="reduce" if reduced else "no-preference")
    hits = []
    ctx.route("**/*", route_for(base, missing, hits))
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)[:240]))
    bits = ["localStorage.clear();"]
    if token:
        bits.append("localStorage.setItem('wardos-lights-proxy-token','fixture-hub-key');")
    if yard is not None:
        bits.append("localStorage.setItem('lh-yard-nights',%s);" % json.dumps(json.dumps(yard)))
    pg.add_init_script("".join(bits))
    pg.goto(base + "livinghouse/index.html" + query, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_selector("html.lh-ready", timeout=20000)
    pg.wait_for_timeout(500)
    info = pg.evaluate(PROBE_JS)
    info["errors"] = errors
    info["rawHit"] = any(p.endswith("cal-live.raw.json") for p in hits)
    info["mp4"] = sum(1 for p in hits if p.endswith(".mp4") or p.endswith(".webm"))
    info["taps"] = sum(1 for p in hits if p == "/api/taps")
    return ctx, pg, info

def banned(info):
    blob = (info["text"] + "\n" + "\n".join(info["aria"])).lower()
    return [w for w in BANNED if w in blob]

def check_common(info, fails, tag):
    if info["errors"]:
        fails.append(tag + " pageerror " + " | ".join(info["errors"][:3]))
    if info["rawHit"]:
        fails.append(tag + " requested cal-live.raw.json")
    if info["mp4"]:
        fails.append(tag + " requested a video file")
    if info["sign"] != "The Ward's":
        fails.append(tag + " sign " + info["sign"])
    if info["dad"] != "Dad":
        fails.append(tag + " dad chip")
    hit = banned(info)
    if hit:
        fails.append(tag + " banned words " + ",".join(hit))

def expect_away(info, fails, tag):
    check_common(info, fails, tag)
    if not info["away"] or info["home"]:
        fails.append(tag + " expected away lighting")
    if not info["lanternHidden"] is False and info["lanternHidden"]:
        fails.append(tag + " lantern hidden")
    if info["lanternHidden"]:
        fails.append(tag + " lantern should show")
    if info["lanternLabel"] != "Porch lantern":
        fails.append(tag + " lantern label")
    if not info["calloutHidden"]:
        fails.append(tag + " callout should be hidden")
    if info["potFeed"] != "rest":
        fails.append(tag + " pot " + str(info["potFeed"]))
    if info["potText"] not in ("Chores",):
        fails.append(tag + " pot text " + info["potText"])
    if any(not c["hidden"] or c["pose"] != "absent" for c in info["creatures"]):
        fails.append(tag + " creatures " + json.dumps(info["creatures"]))
    if info["pebbles"]:
        fails.append(tag + " yard drew pebbles while away")
    if any(c.split(":")[1] != "dark" for c in info["wins"]):
        fails.append(tag + " windows " + ",".join(info["wins"]))
    kidbits = [s["text"] for s in info["stones"] if any(n in s["text"] for n in ("Hayes", "Harris", "Ainsley", "Practice", "Art"))]
    if kidbits:
        fails.append(tag + " kid stone while away " + " | ".join(kidbits))

def expect_home_shell(info, fails, tag):
    check_common(info, fails, tag)
    if info["away"] or not info["home"]:
        fails.append(tag + " expected home lighting")
    if not info["lanternHidden"]:
        fails.append(tag + " lantern should be hidden at home")
    if len(info["creatures"]) != 3:
        fails.append(tag + " creature count")
    kinds = {c["kid"]: c["kind"] for c in info["creatures"]}
    if kinds != {"ainsley": "owl", "hayes": "cat", "harris": "raven"}:
        fails.append(tag + " kinds " + json.dumps(kinds))
    if any(c["art"] != "missing" or c["why"] != "no perched loop" for c in info["creatures"]):
        fails.append(tag + " art should be missing " + json.dumps(info["creatures"]))
    if info["weekFeed"] != "missing" or info["weekWhy"] != "no shared chore history":
        fails.append(tag + " weekly hook")
    if info["smokeHidden"] is not True or info["smokeFeed"] != "missing" or "chimney" not in (info["smokeWhy"] or ""):
        fails.append(tag + " smoke hook " + str(info["smokeFeed"]) + " " + str(info["smokeWhy"]))
    if info["garHidden"] is not True or info["garFeed"] != "missing":
        fails.append(tag + " garage hook")
    if info["pebbleText"].strip():
        fails.append(tag + " pebble had text")

def run_check(browser, base):
    fails = []
    cases = [
        ("dad", "2026-10-23T08:00:00-05:00", False, {"days": {"2026-10-21": 1, "2026-10-22": 1}}),
        ("school", "2026-10-24T06:30:00-05:00", False, {"days": {"2026-10-21": 1}}),
        ("oct24-eve", "2026-10-24T18:00:00-05:00", False, None),
        ("away", "2026-10-25T15:00:00-05:00", False, {"days": {"2026-10-21": 1}}),
        ("return-am", "2026-10-27T08:00:00-05:00", False, None),
        ("return-pm", "2026-10-27T16:00:00-05:00", False, None),
        ("oct31", "2026-10-31T19:00:00-05:00", False, None),
        ("nov1", "2026-11-01T10:00:00-06:00", False, None),
        ("dec1", "2026-12-01T10:00:00-06:00", False, None),
        ("missing", "2026-10-23T08:00:00-05:00", True, None),
        ("night", "2026-10-23T21:30:00-05:00", False, {"days": {}}),
    ]
    for name, now, missing, yard in cases:
        for w, h in VPS:
            tag = "%s@%dx%d" % (name, w, h)
            q = "?now=%s&freeze=1&night=0" % quote(now)
            ctx, pg, info = open_board(browser, base, w, h, q, missing, yard, token=not missing, reduced=False)
            try:
                if name in ("oct24-eve", "away", "return-am"):
                    expect_away(info, fails, tag)
                elif name == "missing":
                    expect_home_shell(info, fails, tag)
                    if info["potFeed"] != "missing" or "No chore feed yet" not in info["potText"]:
                        fails.append(tag + " missing pot " + info["potText"] + " " + str(info["potFeed"]))
                    if info["taps"]:
                        fails.append(tag + " taps called without a hub")
                    if info["camHidden"] is not True:
                        fails.append(tag + " eave lamp without a nest feed")
                    if not info["clockTag"]:
                        fails.append(tag + " clock tag missing under now")
                else:
                    expect_home_shell(info, fails, tag)
                    if info["potFeed"] != "live":
                        fails.append(tag + " pot not live " + str(info["potFeed"]) + " " + info["potText"])
                    if any(ch.isdigit() for ch in info["potText"]) or "$" in info["potText"]:
                        fails.append(tag + " pot showed a figure " + info["potText"])
                    if info["taps"] < 1:
                        fails.append(tag + " did not call /api/taps")
                    if "harris=true" not in (info["mirror"] or "") or "cam=true" not in (info["mirror"] or ""):
                        fails.append(tag + " mirror " + str(info["mirror"]))
                    if "garage=missing" not in (info["mirror"] or "") or "smoke=missing" not in (info["mirror"] or ""):
                        fails.append(tag + " mirror hooks " + str(info["mirror"]))
                    if info["camHidden"]:
                        fails.append(tag + " eave lamp should be on")
                if name == "dad":
                    if info["candleEmpty"] or "Leave" not in info["candle"]:
                        fails.append(tag + " candle " + info["candle"])
                    if set(info["pebbles"]) != {"2026-10-21", "2026-10-22"}:
                        fails.append(tag + " pebbles " + ",".join(info["pebbles"]))
                    pris = [s["pri"] for s in info["stones"]]
                    if "4" not in pris:
                        fails.append(tag + " no far stone " + json.dumps(info["stones"]))
                    for s in info["stones"]:
                        if s["pri"] in ("0", "1") and s["fog"]:
                            fails.append(tag + " near stone fogged")
                        if s["pri"] and int(s["pri"]) >= 2 and not s["fog"]:
                            fails.append(tag + " far stone sharp")
                if name == "school":
                    poses = {c["kid"]: c["pose"] for c in info["creatures"]}
                    if poses.get("hayes") != "pace" or poses.get("ainsley") != "perch" or poses.get("harris") != "perch":
                        fails.append(tag + " poses " + json.dumps(poses))
                    if info["calloutHidden"] or "Practice" not in info["callout"]:
                        fails.append(tag + " callout " + info["callout"])
                    if info["away"]:
                        fails.append(tag + " school morning should be home")
                if name == "return-pm":
                    poses = {c["kid"]: c["pose"] for c in info["creatures"]}
                    if poses.get("harris") != "pace":
                        fails.append(tag + " harris should pace " + json.dumps(poses))
                    if "Practice" not in info["callout"]:
                        fails.append(tag + " return callout " + info["callout"])
                if name == "oct31":
                    if not info["halloween"] or info["pumpkins"] < 1 or info["leavesHidden"]:
                        fails.append(tag + " halloween leaves " + str(info["leavesHidden"]) + " pk " + str(info["pumpkins"]))
                    if not info["previewHidden"]:
                        fails.append(tag + " preview leaked")
                if name in ("nov1", "dec1"):
                    if info["halloween"] or not info["leavesHidden"]:
                        fails.append(tag + " season leaves/halloween")
                if name == "night":
                    days = (info["nights"] or {}).get("days") or {}
                    if days.get("2026-10-23") != 1:
                        fails.append(tag + " night not stored " + json.dumps(info["nights"]))
                    if "2026-10-23" not in info["pebbles"]:
                        fails.append(tag + " tonight pebble missing")
                    if any(ch.isdigit() for ch in info["pebbleText"]):
                        fails.append(tag + " pebble text")
                if name == "away":
                    days = (info["nights"] or {}).get("days") or {}
                    if "2026-10-25" in days:
                        fails.append(tag + " away night was stored")
            finally:
                pg.close()
                ctx.close()
    # an away night is not written, even after 21:00
    ctx, pg, info = open_board(browser, base, 1920, 1080, "?now=%s&freeze=1&night=0" % quote("2026-10-25T21:30:00-05:00"), False, {"days": {}}, True, False)
    try:
        days = (info["nights"] or {}).get("days") or {}
        if "2026-10-25" in days:
            fails.append("away night stored " + json.dumps(info["nights"]))
        if info["pebbles"]:
            fails.append("away night drew pebbles")
        if not info["away"]:
            fails.append("21:30 on an away day should stay away")
    finally:
        pg.close(); ctx.close()
    # reduced motion: the soon creature perches instead of pacing
    ctx, pg, info = open_board(browser, base, 1920, 1080, "?now=%s&freeze=1&night=0" % quote("2026-10-24T06:30:00-05:00"), False, None, True, True)
    try:
        poses = {c["kid"]: c["pose"] for c in info["creatures"]}
        if poses.get("hayes") != "perch":
            fails.append("reduced hayes pose " + json.dumps(poses))
        if any(c["pace"] for c in info["creatures"]):
            fails.append("reduced still had pace class")
    finally:
        pg.close(); ctx.close()
    # no ?now and no ?probe: no clock tag, no probe overlay
    ctx, pg, info = open_board(browser, base, 390, 844, "?night=0", False, None, True, False)
    try:
        if info["clockTag"] or info["probe"] or info["probeN"]:
            fails.append("override leak clock=%s probe=%s n=%s" % (info["clockTag"], info["probe"], info["probeN"]))
        if "CLOCK OVERRIDE" in info["text"]:
            fails.append("clock words leaked")
    finally:
        pg.close(); ctx.close()
    # probe overlay exists only with the param, and samples arrive
    ctx, pg, info = open_board(browser, base, 440, 956, "?probe=1&night=0", False, None, True, False)
    try:
        pg.wait_for_timeout(1500)
        info = pg.evaluate(PROBE_JS)
        if not info["probe"] or info["probeN"] < 1:
            fails.append("probe did not sample")
        if info["clockTag"]:
            fails.append("probe alone must not show the clock tag")
    finally:
        pg.close(); ctx.close()
    return fails

def shot(browser, base, dest, when):
    os.makedirs(dest, exist_ok=True)
    jobs = [
        ("home", "2026-10-23T18:30:00-05:00", False),
        ("away", "2026-10-25T15:00:00-05:00", False),
    ]
    yard = {"days": {"2026-10-21": 1, "2026-10-22": 1}}
    for label, now, missing in jobs:
        for w, h in VPS:
            q = "?now=%s&freeze=1" % quote(now)
            ctx, pg, info = open_board(browser, base, w, h, q, missing, yard, True, True)
            try:
                pg.wait_for_timeout(1200)
                name = "%s-%s-%dx%d.png" % (when, label, w, h)
                pg.screenshot(path=os.path.join(dest, name))
            finally:
                pg.close(); ctx.close()

def probe(browser, base, dest):
    os.makedirs(dest, exist_ok=True)
    out = {}
    for w, h in VPS:
        ctx, pg, info = open_board(browser, base, w, h, "?probe=1&now=%s&freeze=1&night=0" % quote("2026-10-23T18:30:00-05:00"), False, None, True, True)
        try:
            pg.wait_for_timeout(60000)
            log = pg.evaluate("() => window.__lhProbe || []")
            key = "%dx%d" % (w, h)
            path = os.path.join(dest, "probe-%s.json" % key)
            payload = {"viewport": key, "seconds": 60, "samples": log, "hardware": "UNVERIFIED", "note": "headless chromium, synthetic fixtures"}
            with open(path, "w", encoding="utf8") as f:
                json.dump(payload, f)
            out[key] = {"n": len(log), "path": path}
        finally:
            pg.close(); ctx.close()
    return out

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    srv, base = serve()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--disable-gpu"])
            try:
                if mode == "check":
                    fails = run_check(browser, base)
                    print(json.dumps({"ok": not fails, "fails": fails}))
                    return 1 if fails else 0
                if mode == "shots":
                    when, dest = sys.argv[2], sys.argv[3]
                    shot(browser, base, dest, when)
                    print(json.dumps({"ok": True, "dir": dest}))
                    return 0
                if mode == "probe":
                    dest = sys.argv[2]
                    print(json.dumps({"ok": True, "probe": probe(browser, base, dest)}))
                    return 0
                print(json.dumps({"ok": False, "fails": ["unknown mode"]}))
                return 2
            finally:
                browser.close()
    finally:
        srv.shutdown()

if __name__ == "__main__":
    sys.exit(main())
