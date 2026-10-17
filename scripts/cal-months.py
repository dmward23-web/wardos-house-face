#!/usr/bin/env python3
"""Build cal-months.json (month view) from calendar dump pages into the box-only private folder (PRIVFEED1).

Usage: cal-months.py --private PAGE.json [PAGE.json ...]   (writes $WARDOS_PRIVATE_DIR/cal-months.json)
       cal-months.py OUT.json PAGE.json [...]             (OUT must be outside any git work tree)
Pages: Google Calendar MCP search output ({"events":[...]}) or Google API
shape ({"items":[...]} / list). Only start/end/summary are used; descriptions
and locations never leave this script. Summaries are scrubbed with
~/.config/wardos/privacy-scrub.tsv (missing file = hard fail).
"""
import json, os, re, sys, datetime as dt
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Chicago")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from private_dir import priv_path, assert_private_out
from ext_roles import EXT_ROLES   # EXTNAMES1 · shared role constant
from text_law import clean_text, names_path, external_filter, external_drop   # EXTFILTER1 · NAMESDIR1 names_path · PRIVFEED3 · TEXTLAW2: one shared rules file (scripts/text-law.json) with cal-from-events.mjs
# PRIVFEED3 · LAW8C1: colour-day / dress-up rows never reach the month view (same regex as house-face-law.js / calendar-refresh.mjs)
DRESS = re.compile(r"\b(?:orange|red|blue|green|pink|purple|yellow|black|white|gold|maroon|colou?r|crazy hair|pajamas?|pj|twin|hat|jersey|spirit|outsiders)\s+day\b|dress[- ]?up|spirit\s+week|\bwear\b|\bcostume|\bpajama", re.I)
out, pages = sys.argv[1], sys.argv[2:]
if out == "--private": out = priv_path("cal-months.json")
if out != "--reclean-private": assert_private_out(out, "cal-months")

fp = os.path.expanduser("~/.config/wardos/privacy-scrub.tsv")
if not os.path.exists(fp):
    sys.exit("HARD FAIL: privacy-scrub.tsv missing — refusing to publish")
RULES = []
for line in open(fp):
    line = line.rstrip("\n")
    if not line or line.startswith("#"): continue
    rx, _, rep = line.partition("\t")
    RULES.append((re.compile(rx, re.I), rep))
# PRIVFEED1 · provider / person names live in ~/.config/wardos/privacy-block.txt (one regex per line, never in git)
_bf = os.path.expanduser("~/.config/wardos/privacy-block.txt")
_bx = [l.strip() for l in open(_bf) if l.strip() and not l.startswith("#")] if os.path.exists(_bf) else []
BLOCK = re.compile("|".join(_bx + [r"therap", r"counsel"]), re.I)

def _names_early(role):
    fp2 = names_path()
    if not os.path.exists(fp2): return []
    return [l.rstrip("\n").split("\t", 1)[1].strip() for l in open(fp2, encoding="utf-8")
            if "\t" in l and not l.startswith("#") and l.split("\t", 1)[0].strip().lower() == role and l.split("\t", 1)[1].strip()]
_CP = "|".join(re.escape(n) for n in _names_early("coparent"))
# THEIRMOM1 on the box (PRIVFEED1): the co-parent's name never reaches any label; the client no longer carries it.
COPARENT_RULES = [(re.compile(rf"pickup at (?:{_CP})'s", re.I), "pickup at their mom's"), (re.compile(rf"\bto (?:{_CP})\b", re.I), "to their mom"),
                  (re.compile(rf"\b(?:{_CP})'s", re.I), "their mom's"), (re.compile(rf"\b(?:{_CP})\b", re.I), "their mom")] if _CP else []

def scrub(s):
    for rx, rep in RULES + COPARENT_RULES: s = rx.sub(rep, s)
    return re.sub(r"\s{2,}", " ", s).strip()

if out == "--reclean-private" or (len(sys.argv) > 1 and sys.argv[1] == "--reclean-private"):
    # PRIVFEED1 · re-apply scrub to labels of the private cal-months in place (withDan/order untouched)
    tgt = priv_path("cal-months.json"); doc = json.load(open(tgt, encoding="utf-8")); n = 0
    for day in doc.get("days", {}).values():
        for it in day.get("items", []):
            l = external_filter(clean_text(scrub(it.get("l", ""))))   # EXTFILTER1: None = row filtered out
            n += l != it.get("l"); it["l"] = l
        day["items"] = [it for it in day.get("items", []) if it.get("l") and not DRESS.search(it["l"])]
    json.dump(doc, open(tgt, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"cal-months --reclean-private: {n} labels changed"); sys.exit(0)

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
def _names(role):
    fp = names_path()
    if not os.path.exists(fp): return []
    return [l.rstrip("\n").split("\t", 1)[1] for l in open(fp, encoding="utf-8")
            if "\t" in l and not l.startswith("#") and l.split("\t", 1)[0].strip().lower() == role]
DAN_KEEP = re.compile("|".join([r"✈", r"\bWN\d", r"#[A-Z0-9]{6}", r"DRIVE", r"Nashville"] + [re.escape(n.strip()) for n in _names("partner") if n.strip()]), re.I)
FLIGHT = re.compile(r"✈|\bWN\d|#[A-Z0-9]{6}|DRIVE\b", re.I)
LOW = re.compile(r"specials|drop-off|pickup|spirit day", re.I)
HAS_TIME = re.compile(r"\b\d{1,2}:\d{2}")

# EXTNAMES1 · private-names.tsv role "external" names people outside the household (never in git). A kid's first name
# followed by one of them is not our kid. ONLY "external" is filtered, plus the old key "otherfamily" during the
# transition (a later commit drops it). partner, coparent, household, school and every other role are never filtered.
# An unknown role gets one count-only warning and stays unfiltered. No external rows at all (and none under the old key)
# = a config error: one count-only warning.
def _all_roles():
    fp = names_path()
    if not os.path.exists(fp): return {}
    out = {}
    for l in open(fp, encoding="utf-8"):
        if "\t" in l and not l.startswith("#"):
            r, n = l.rstrip("\n").split("\t", 1)
            if n.strip(): out.setdefault(r.strip().lower(), []).append(n.strip())
    return out
_ROLES = _all_roles()
_EXT_ROLES = EXT_ROLES   # shared constant (scripts/ext_roles.py)
_KNOWN_ROLES = set(_EXT_ROLES) | {"partner", "coparent", "household", "school"}
_EXT = [re.escape(n) for r in _EXT_ROLES for n in _ROLES.get(r, [])]
_UNKNOWN = sum(1 for r in _ROLES if r not in _KNOWN_ROLES)
if _UNKNOWN: sys.stderr.write(f"WARN private-names: {_UNKNOWN} unknown role(s), not filtered\n")
if not _EXT: sys.stderr.write("WARN private-names: role external has 0 entries (config error)\n")
_EXT_KID = re.compile(r"\b(?:Ainsley|Hayes|Harris)\s+(?:" + "|".join(_EXT) + r")\b", re.I) if _EXT else None
def kid(summ):
    s = _EXT_KID.sub("", summ) if _EXT_KID else summ
    s = re.sub(r"\b(?!Ward\b)[A-Z][a-z]+ Kids\b", "", s)
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
    label = scrub(summ)
    if BLOCK.search(label): sys.exit(f"HARD FAIL: private term survived scrub in: {label!r}")
    if external_drop(summ) or external_drop(label): continue   # EXTFILTER1: filtered rows never reach the month board
    c = kid(label)
    if FLIGHT.search(label) and not allday: c = "flight"
    elif allday or not c: c = c if (c and not allday) else "aware"
    if not allday and (d1 - d0).days <= 1 and not HAS_TIME.search(label) and not LOW.search(label):
        label = f"{label} · {hm(t0)}"
    label = external_filter(clean_text(label))   # EXTFILTER1 (term -> placeholder) · PRIVFEED3 · TEXTLAW2: words only, after the row is classed on the raw title (withDan untouched)
    if not label or DRESS.search(label): continue   # LAW8C1
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
