#!/usr/bin/env python3
"""FRESHDATA1 · pull the LIVE published feeds into a gate snapshot before any real-data gate or render.

Usage: fresh-data.py <snapshot-root> [--base URL]

The branch's committed data/*.json is a morning snapshot; calendar boards then read "CAL STALE" and old
titles. Real data at the current clock = the same live feeds the preview reads (main's published data/,
refreshed by Atlas's 10-minute data-only commits). Each data/<name>.json the snapshot ships is replaced by
the live copy (GET only, valid JSON only); a feed the live site lacks keeps the snapshot copy and is named.
Then the 8 branch wall feeds (house-mode, next-up, kid-seats, unlocks, pickup-chain, school-night, who-home,
logistics-taps; main does not publish them) are regenerated IN THE SNAPSHOT by its own
scripts/house-feeds-refresh.sh from the fresh calendar pull Atlas's routine writes (--events, default
/workspace/cal-dmward23-week.json; it must be under 2 h old). Read only on the house: no writes anywhere but the snapshot. Refuses a git checkout (never touches a
worktree's committed data). Writes <root>/data/.fresh.json (base, fetchedAt, per-file result).
"""
import json, os, sys, subprocess, time, datetime as dt, urllib.request

args = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = "https://dmward23-web.github.io/wardos-house-face/data/"
if "--base" in sys.argv: BASE = sys.argv[sys.argv.index("--base") + 1].rstrip("/") + "/"; args = [a for a in args if a != BASE.rstrip("/")]
if not args: sys.exit(__doc__)
root = os.path.abspath(args[0]); data = os.path.join(root, "data")
if os.path.exists(os.path.join(root, ".git")): sys.exit(f"FRESH DATA REFUSED: {root} is a git checkout; run on a snapshot copy")
if not os.path.isdir(data): sys.exit(f"FRESH DATA FAIL: no data/ in {root}")
now = dt.datetime.now(dt.timezone(dt.timedelta(hours=-5))).replace(microsecond=0).isoformat()
res, ok, kept = {}, 0, []
for name in sorted(os.listdir(data)):
    if not name.endswith(".json") or name.startswith("."): continue
    try:
        req = urllib.request.Request(BASE + name + "?t=" + str(int(dt.datetime.now().timestamp())), headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(req, timeout=20) as r: body = r.read()
        obj = json.loads(body)
        with open(os.path.join(data, name), "wb") as f: f.write(body)
        stamp = next((obj.get(k) for k in ("fetchedAt", "refreshedAt", "generatedAt", "updatedAt", "asOfIso") if isinstance(obj, dict) and obj.get(k)), None)
        res[name] = {"live": True, "stamp": stamp}; ok += 1
    except Exception as e:
        res[name] = {"live": False, "why": str(e)[:120]}; kept.append(name)
# root copies the kid boards may read
for name in ("kids-week.json",):
    if os.path.exists(os.path.join(root, name)) and res.get(name, {}).get("live"):
        with open(os.path.join(data, name), "rb") as s, open(os.path.join(root, name), "wb") as d: d.write(s.read())
EV = os.environ.get("FRESH_EVENTS", "/workspace/cal-dmward23-week.json")
feeds = {"events": EV}
try:
    age = (time.time() - os.path.getmtime(EV)) / 60
    feeds["ageMin"] = round(age)
    if age > 120: raise RuntimeError(f"calendar pull {EV} is {round(age)} min old (> 2 h)")
    r = subprocess.run(["bash", os.path.join(root, "scripts/house-feeds-refresh.sh"), "--events", EV], cwd=root, capture_output=True, text=True, timeout=300)
    feeds["ok"] = r.returncode == 0; feeds["out"] = (r.stdout + r.stderr).strip().splitlines()[-1:] if (r.stdout or r.stderr) else []
except Exception as e:
    feeds["ok"] = False; feeds["why"] = str(e)[:200]
json.dump({"base": BASE, "fetchedAt": now, "files": res, "feeds": feeds}, open(os.path.join(data, ".fresh.json"), "w"), indent=1)
cal = res.get("cal-live.json", {})
REGEN = {"house-mode.json", "next-up.json", "kid-seats.json", "unlocks.json", "pickup-chain.json", "school-night.json", "who-home.json", "logistics-taps.json"}
if feeds.get("ok"): kept = [k for k in kept if k not in REGEN]
good = bool(cal.get("live")) and feeds.get("ok")
print(f"FRESH DATA {'PASS' if good else 'FAIL'} · {now} · {ok} live feed(s) from {BASE}" + (f" · branch copy kept (not published by main): {', '.join(kept)}" if kept else "") + f" · cal-live {cal.get('stamp')} · wall feeds " + ("regenerated from " + EV + f" ({feeds.get('ageMin')} min old)" if feeds.get("ok") else "FAILED: " + str(feeds.get("why") or feeds.get("out"))))
sys.exit(0 if good else 1)
