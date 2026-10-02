#!/usr/bin/env python3
"""Build data/cal-months.json (month view) from calendar dump pages.

Usage: cal-months.py OUT.json PAGE.json [PAGE.json ...]
Pages: Google Calendar MCP search output ({"events":[...]}) or Google API
shape ({"items":[...]} / list). Only start/end/summary are used; descriptions
and locations never leave this script. Summaries are scrubbed with
~/.config/wardos/privacy-scrub.tsv (missing file = hard fail).
"""
import json, os, re, sys, datetime as dt
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Chicago")
out, pages = sys.argv[1], sys.argv[2:]

fp = os.path.expanduser("~/.config/wardos/privacy-scrub.tsv")
if not os.path.exists(fp):
    sys.exit("HARD FAIL: privacy-scrub.tsv missing — refusing to publish")
RULES = []
for line in open(fp):
    line = line.rstrip("\n")
    if not line or line.startswith("#"): continue
    rx, _, rep = line.partition("\t")
    RULES.append((re.compile(rx, re.I), rep))
# ATLASLANE6 · display-only renames (DAN RULING t2812u), same rules as scripts/house/display-rename.mjs.
# The source calendar is never edited. ATLASLANE9: raw-title patterns live in a private box file (never in the published
# repo); the public config holds only ids + display strings. Missing private file = no renames (parent scrub drops them).
_RC = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config", "display-rename.json")))
_PR = _RC.get("privateRules") or {}
_PFP = os.path.expanduser(os.environ.get(_PR.get("env") or "WARDOS_DISPLAY_RENAME_PRIVATE") or _PR.get("path") or "")
_PAT = {r["id"]: r["pattern"] for r in (json.load(open(_PFP)).get("renames") or [])} if _PFP and os.path.exists(_PFP) else {}
RENAMES = [(re.compile(_PAT[r["id"]], re.I), r["replace"]) for r in _RC["renames"] if r["id"] in _PAT]
PAREN = re.compile(_RC["parentScrub"]["parenthetical"], re.I)
POSS = re.compile(_RC["parentScrub"]["possessive"])
RESIDUAL = re.compile(_RC["parentScrub"]["residual"], re.I)
MONEY_PAREN = re.compile(_RC["moneyScrub"]["parenthetical"])
MONEY_TOKEN = re.compile(_RC["moneyScrub"]["token"])
MONEY_ALLOW = _RC["moneyScrub"]["allow"]

def nomoney(s):
    """Calendar labels carry no money on the board ("($30)" dropped); MONEY_ALLOW strings stay."""
    if s.strip() in MONEY_ALLOW: return s
    for i, a in enumerate(MONEY_ALLOW): s = s.replace(a, f"\0{i}\0")
    s = MONEY_TOKEN.sub("", MONEY_PAREN.sub("", s))
    for i, a in enumerate(MONEY_ALLOW): s = s.replace(f"\0{i}\0", a)
    return s

def display(s):
    """Renamed + parent-scrubbed label, or None (not published) if a parent word survives."""
    s = nomoney(s)
    for rx, rep in RENAMES: s = rx.sub(rep, s)
    s = POSS.sub(lambda m: m.group(1) + m.group(2), PAREN.sub("", s))
    s = re.sub(r"\s+([·,;:])", r" \1", re.sub(r"\s{2,}", " ", s)).strip()
    return None if (not s or RESIDUAL.search(s)) else s

BLOCK = re.compile(r"midwest anxiety|bonebrake|\brandy\b|therap|counsel", re.I)

def scrub(s):
    for rx, rep in RULES: s = rx.sub(rep, s)
    return re.sub(r"\s{2,}", " ", s).strip()

def norm(x):
    s = x.get("start"); e = x.get("end")
    if isinstance(s, dict):  # Google API shape
        allday = "date" in s
        return x.get("id"), x.get("summary", ""), s.get("dateTime") or s.get("date"), e.get("dateTime") or e.get("date"), allday
    return x.get("event_id"), x.get("summary", ""), x["start_time"], x["end_time"], bool(x.get("all_day")) or "T" not in x["start_time"]

ev = {}
for p in pages:
    d = json.load(open(p))
    items = d.get("events") or d.get("items") or [] if isinstance(d, dict) else d
    for x in items:
        if x.get("status") == "cancelled": continue
        i, summ, s, e, allday = norm(x)
        ev[i] = (summ, s, e, allday)

SKIP = re.compile(r"^(atlas:|get\b|buy\b|backup\b|free\b|kids — pack)", re.I)
DAN_KEEP = re.compile(r"✈|\bWN\d|#[A-Z0-9]{6}|DRIVE|Nashville|Erin", re.I)
FLIGHT = re.compile(r"✈|\bWN\d|#[A-Z0-9]{6}|DRIVE\b", re.I)
LOW = re.compile(r"specials|drop-off|pickup|spirit day", re.I)
HAS_TIME = re.compile(r"\b\d{1,2}:\d{2}")

def kid(summ):
    s = re.sub(r"Hayes Johnson|Johnson Kids", "", summ)
    names = [k for k, rx in (("ain", r"\bAinsley\b"), ("hay", r"\bHayes\b"), ("har", r"\bHarris\b")) if re.search(rx, s)]
    if len(names) > 1 or re.match(r"^(Kids|Ward Kids)\b", s): return "shr"
    return names[0] if names else None

def hm(t):
    h = t.hour % 12 or 12
    return f"{h}:{t.minute:02d}"

days, withdan = {}, {}
for i, (summ, s, e, allday) in ev.items():
    if not summ or SKIP.search(summ): continue
    if allday:
        d0 = dt.date.fromisoformat(s[:10]); d1 = dt.date.fromisoformat(e[:10])
        if d1 <= d0: d1 = d0 + dt.timedelta(days=1)
        t0 = None
    else:
        t0 = dt.datetime.fromisoformat(s).astimezone(TZ); t1 = dt.datetime.fromisoformat(e).astimezone(TZ)
        d0 = t0.date(); d1 = (t1 - dt.timedelta(minutes=1)).date() + dt.timedelta(days=1)
    if re.match(r"^Kids with Dan\b", summ):
        d = d0
        while d < d1: withdan[d.isoformat()] = 1; d += dt.timedelta(days=1)
        continue
    if summ.startswith("Dan") and not DAN_KEEP.search(summ): continue
    label = display(scrub(summ))
    if label is None: continue  # still names a parent after the display pass: not published
    if BLOCK.search(label): sys.exit(f"HARD FAIL: private term survived scrub in: {label!r}")
    c = kid(label)
    if FLIGHT.search(label) and not allday: c = "flight"
    elif allday or not c: c = c if (c and not allday) else "aware"
    if not allday and (d1 - d0).days <= 1 and not HAS_TIME.search(label) and not LOW.search(label):
        label = f"{label} · {hm(t0)}"
    pri = 0 if c == "flight" else (3 if c == "aware" else (2 if LOW.search(label) else 1))
    sort = (t0.hour * 60 + t0.minute) if t0 else -1
    d = d0
    while d < d1:
        days.setdefault(d.isoformat(), []).append((pri, sort, c, label))
        d += dt.timedelta(days=1)

outdays = {}
for k in sorted(set(days) | set(withdan)):
    seen, items = set(), []
    for pri, sort, c, label in sorted(days.get(k, [])):
        if label in seen: continue
        seen.add(label); items.append({"c": c, "l": label})
    outdays[k] = {"withDan": bool(withdan.get(k)), "items": items}

THROUGH = os.environ.get("CAL_THROUGH")
if THROUGH: outdays = {k: v for k, v in outdays.items() if k <= THROUGH}
keys = sorted(outdays)
json.dump({
    "status": "live",
    "generatedAt": dt.datetime.now(TZ).isoformat(timespec="seconds"),
    "tz": "America/Chicago",
    "rangeStart": keys[0] if keys else None,
    "rangeEnd": THROUGH or (keys[-1] if keys else None),
    "days": outdays,
}, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"cal-months: {len(ev)} events -> {len(outdays)} days {keys[0] if keys else ''}..{keys[-1] if keys else ''}")
