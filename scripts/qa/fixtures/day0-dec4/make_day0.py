#!/usr/bin/env python3
"""Dec 4 2026 Day-0 feed fixture (Wright, Nov 23). Neutral text only: no clinical, money, email- or phone-shaped strings.
Base: r54 render-tip feeds (schema reference). Freeze with ?now=2026-12-04T07:30:00-06:00."""
import json, copy, sys
from pathlib import Path
SRC = Path("/workspace/plates/2026-11-17/r54-checks/render-tip")
kw = json.load(open(SRC/"feed-kids-week.json")); cl = json.load(open(SRC/"feed-cal-live.json"))
NOW = "2026-12-04T13:30:00.000Z"   # 7:30 AM CT
kw.update(asOf="Fri Dec 4 2026", asOfIso="2026-12-04", refreshedAt=NOW)
kw["homeWeek"] = {"with": "Dad", "place": "Home", "through": "2026-12-11", "throughLabel": "through Fri Dec 11"}
kw["boardStrip"].update(label="Next up · today", time="3:00 PM", place="School pickup", badge="Fri",
    startIso="2026-12-04T21:00:00.000Z", endIso="2026-12-04T21:30:00.000Z", kind="pickup")
MUSTS = {
 "hayes":   ["Brush teeth", "Backpack by the door", "Reading 20 min", "Feed the fish", "Make bed", "Shoes on the rack", "Lunchbox in sink"],
 "harris":  ["Brush teeth", "Backpack by the door", "Spelling list", "Make bed", "Clothes in hamper", "Water bottle filled"],
 "ainsley": ["Brush teeth", "Pack bag for tomorrow", "Practice piano 15 min", "Make bed", "Dishes to sink"],
}
TIMES = ["7:00 AM", "7:15 AM", "7:30 AM", "3:30 PM", "5:00 PM", "7:30 PM", "8:00 PM"]
for k, items in MUSTS.items():
    kid = kw["kids"][k]
    kid["today"] = [{"kind": "must", "when": "Today · " + TIMES[i], "what": w, "hint": "", "tone": "act"} for i, w in enumerate(items)]
    kid["today"].insert(0, {"kind": "event", "when": "Today · 3:00 PM", "what": "School pickup", "hint": "Dad", "tone": "act"})
dan = kw["kids"]["dan"]
dan["today"] = [{"when": "Fri · 7:45 AM", "what": "School drop-off", "tone": "act"},
                {"when": "Fri · 3:00 PM", "what": "School pickup", "tone": "act"},
                {"when": "Fri · 5:30 PM", "what": "Pizza and movie night", "tone": "act"},
                {"when": "Fri · 7:00 PM", "what": "Hang the stockings", "tone": "act"}]
dan["week"] = [{"when": d, "what": w, "tone": "act"} for d, w in [
  ("Sat 5 · 10:00", "Tree farm trip"), ("Sun 6 · 2:00", "Cookie baking"), ("Mon 7 · 3:00", "School pickup"),
  ("Tue 8 · 6:00", "Skate night"), ("Wed 9 · 3:00", "School pickup")]]
# Ahead: 26 events, distinct times, Dec 4..11
AHEAD = []
titles = ["School pickup", "Soccer practice", "Library trip", "Pizza night", "Tree farm trip", "Cookie baking", "Skate night",
          "Piano lesson", "Swim class", "Movie night", "Grocery run", "Gingerbread house", "Lights drive", "Board game night",
          "Park walk", "Art class", "Haircut", "Bike ride", "Wrap gifts", "Hot cocoa stop", "Choir practice", "Craft table",
          "Snow fort build", "Sledding hill", "Card making", "Holiday concert"]
day, minute = 4, 0
for i, t in enumerate(titles):
    d = 4 + i // 4; h = [8, 11, 15, 18][i % 4]; m = (i * 7) % 60
    AHEAD.append({"summary": t + " · %d:%02d" % ((h - 1) % 12 + 1, m), "start": "2026-12-%02dT%02d:%02d:00-06:00" % (d, h, m)})
assert len({a["start"] for a in AHEAD}) == len(AHEAD) >= 24
cl.update(status="live", fetchedAt="2026-12-04T13:00:00Z", asOfIso="2026-12-04", upcomingLeaves=AHEAD)
out = Path(sys.argv[1] if len(sys.argv) > 1 else "feeds"); out.mkdir(exist_ok=True)
json.dump(kw, open(out/"feed-kids-week.json", "w"), indent=1); json.dump(cl, open(out/"feed-cal-live.json", "w"), indent=1)
print("wrote", out, "musts", {k: len(v) for k, v in MUSTS.items()}, "dan rows", len(dan["today"]), "ahead", len(AHEAD))
