#!/usr/bin/env python3
"""FRESHDATA1 · real data at the current clock for a gate snapshot (never a git checkout).

Usage: fresh-data.py <snapshot-root>        env FRESH_EVENTS (default /workspace/cal-dmward23-week.json)

The branch's committed data is a morning snapshot (calendar boards then read "CAL STALE" and old titles).
Before any real-data gate or render this rebuilds the snapshot's calendar data the way the 10-minute routine
does (scripts/house-board-calendar-refresh.sh, steps 0-3, minus its board-os mirror and git):
  0. privacy-scrub the fresh calendar pull with ~/.config/wardos/privacy-scrub.tsv (missing file = fail closed)
  1. scripts/calendar-refresh.mjs --no-mirror      -> kids-week.json, data/kids-week.json, kids-data.js EMBEDDED
  2. scripts/cal-from-events.mjs                   -> data/cal-live.json
  3. scripts/house-feeds-refresh.sh                -> the 8 wall feeds (house-mode, next-up, kid-seats, ...)
  4. scripts/cal-months.py on the same pull        -> the pull's days replaced in data/cal-months.json
Device feeds (nest, sensi, lights) come from main's live published data/ (GET only).
If the pull is missing, over 2 h old or cannot be scrubbed: cal-live comes from main's live data instead,
the branch copies of the rest are kept, and the result says PARTIAL. Writes <root>/data/.fresh.json.
Read only on the house: writes nowhere but the snapshot; no network but GETs of the published data.
"""
import json, os, re, sys, subprocess, time, tempfile, datetime as dt, urllib.request

BASE = "https://dmward23-web.github.io/wardos-house-face/data/"
DEVICE = ["nest-live.json", "sensi-live.json", "lights-live.json"]
if len(sys.argv) < 2: sys.exit(__doc__)
root = os.path.abspath(sys.argv[1]); data = os.path.join(root, "data")
if os.path.exists(os.path.join(root, ".git")): sys.exit(f"FRESH DATA REFUSED: {root} is a git checkout; run on a snapshot copy")
if not os.path.isdir(data): sys.exit(f"FRESH DATA FAIL: no data/ in {root}")
now = dt.datetime.now(dt.timezone(dt.timedelta(hours=-5))).replace(microsecond=0).isoformat()
EV = os.environ.get("FRESH_EVENTS", "/workspace/cal-dmward23-week.json")
rep = {"fetchedAt": now, "base": BASE, "events": EV, "steps": {}}

def get_live(name):
    req = urllib.request.Request(BASE + name + "?t=" + str(int(time.time())), headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=20) as r: body = r.read()
    json.loads(body)
    with open(os.path.join(data, name), "wb") as f: f.write(body)

for name in DEVICE:
    try: get_live(name); rep["steps"][name] = "live"
    except Exception as e: rep["steps"][name] = "kept branch copy: " + str(e)[:80]

def run(cmd):
    r = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=300)
    if r.returncode: raise RuntimeError(" ".join(os.path.basename(c) for c in cmd[:2]) + " failed: " + (r.stderr or r.stdout).strip()[-200:])
    return r

cal_ok = False
try:
    if not os.path.exists(EV): raise RuntimeError(f"no calendar pull at {EV}")
    age = (time.time() - os.path.getmtime(EV)) / 60; rep["pullAgeMin"] = round(age)
    if age > 120: raise RuntimeError(f"calendar pull is {round(age)} min old (> 2 h)")
    fp = os.path.expanduser("~/.config/wardos/privacy-scrub.tsv")
    if not os.path.exists(fp): raise RuntimeError("privacy-scrub.tsv missing: fail closed")
    rules = []
    for line in open(fp):
        line = line.rstrip("\n")
        if not line or line.startswith("#"): continue
        rx, _, r_ = line.partition("\t"); rules.append((re.compile(rx, re.I), r_))
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("summary", "title", "description") and isinstance(v, str):
                    for rx, r_ in rules: v = rx.sub(r_, v)
                    o[k] = re.sub(r"\s{2,}", " ", v).strip()
                else: walk(v)
        elif isinstance(o, list):
            for x in o: walk(x)
    dump = json.load(open(EV)); walk(dump)
    tmpd = tempfile.mkdtemp(prefix="fresh-"); S = os.path.join(tmpd, "events.json"); json.dump(dump, open(S, "w"))
    try:
        run(["node", "scripts/calendar-refresh.mjs", "--events", S, "--week", os.path.join(root, "kids-week.json"), "--no-mirror"]); rep["steps"]["kids-week"] = "regenerated"
        run(["node", "scripts/cal-from-events.mjs", "--events", S, "--out", os.path.join(data, "cal-live.json")]); rep["steps"]["cal-live.json"] = "regenerated"
        cal_ok = True
        run(["bash", "scripts/house-feeds-refresh.sh", "--events", S]); rep["steps"]["wall-feeds"] = "regenerated"
        cm = os.path.join(tmpd, "cal-months.json")
        run(["python3", "scripts/cal-months.py", cm, S])
        fresh = json.load(open(cm)); cur_p = os.path.join(data, "cal-months.json")
        cur = json.load(open(cur_p)) if os.path.exists(cur_p) else {"days": {}}
        lo, hi = fresh.get("rangeStart"), fresh.get("rangeEnd")
        for k in list(cur.get("days", {})):
            if lo and hi and lo <= k <= hi: del cur["days"][k]
        cur.setdefault("days", {}).update(fresh.get("days", {})); cur["days"] = dict(sorted(cur["days"].items()))
        cur["generatedAt"] = fresh.get("generatedAt"); cur["freshDays"] = [lo, hi]
        json.dump(cur, open(cur_p, "w"), ensure_ascii=False, separators=(",", ":")); rep["steps"]["cal-months.json"] = f"days {lo}..{hi} regenerated"
    finally:
        for f in os.listdir(tmpd): os.remove(os.path.join(tmpd, f))
        os.rmdir(tmpd)
except Exception as e:
    rep["calendarPath"] = "not run: " + str(e)[:200]
    if not cal_ok:
        try: get_live("cal-live.json"); rep["steps"]["cal-live.json"] = "main live copy"; cal_ok = "live"
        except Exception as e2: rep["steps"]["cal-live.json"] = "STALE branch copy: " + str(e2)[:80]
json.dump(rep, open(os.path.join(data, ".fresh.json"), "w"), indent=1)
full = cal_ok is True and "calendarPath" not in rep
cl = json.load(open(os.path.join(data, "cal-live.json")))
print(f"FRESH DATA {'PASS' if full else ('PARTIAL' if cal_ok else 'FAIL')} · {now} · pull {EV} ({rep.get('pullAgeMin')} min old) · cal-live fetchedAt {cl.get('fetchedAt')} · "
      + " · ".join(f"{k}: {v}" for k, v in rep["steps"].items()) + (f" · {rep['calendarPath']}" if "calendarPath" in rep else ""))
sys.exit(0 if cal_ok else 1)
