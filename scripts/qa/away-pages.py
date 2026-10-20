#!/usr/bin/env python3
"""AWAYLAW1 · ?now fixture page test: on kids-away days no kid time renders on the 10 away-law pages.
usage: away-pages.py <root> <outdir> [label]   env NOWS (comma ISO list), PAGES, VPS (default 440x956), SHOTS=1
Each page loads as <page>?now=<ISO> with the browser clock pinned to the same moment (away-filter.js reads ?now,
every other renderer reads the clock). Visible text only. A FAIL is any visible element (<=160 chars) naming a kid
(Ainsley, Hayes, Harris, Boys, Kids, school or a private school code; external calendar rows excluded) with a clock time that falls inside an away window
(data/cal-months.json withDan, 3:00 PM switch; the row's day from its text, its dated cell, a day word above it, else
today; the page's own clock reading excepted). Kid times on Dad days (Month, next week) are allowed. Also reported: NOCUSTODY phrases on shared pages (all but sheet-dan), colour/dress-up rows, em dashes.
Exit 1 when any page FAILs."""
import sys, os, json, re, socket, subprocess, time
from datetime import datetime
from playwright.sync_api import sync_playwright
root, out = sys.argv[1], sys.argv[2]; label = sys.argv[3] if len(sys.argv) > 3 else "away"
NOWS = os.environ.get("NOWS", "2026-10-17T10:00:00-05:00,2026-10-20T16:00:00-05:00").split(",")
PAGES = os.environ.get("PAGES", "sheet-index.html,sheet-dan.html,kid-hayes.html,kid-harris.html,kid-ainsley.html,month.html,month-chat.html,sheet-today.html,sheet-load-day.html,sheet-pack.html").split(",")
VPS = [tuple(map(int, v.split("x"))) for v in os.environ.get("VPS", "440x956").split(",")]
SHOTS = os.environ.get("SHOTS", "1") == "1"
DAN_ONLY = {"sheet-dan.html"}
os.makedirs(out, exist_ok=True)
JS = r"""() => {
 const vis = el => { for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0) return false; } const r = el.getBoundingClientRect(); return r.width >= 1 && r.height >= 1; };
 const DAYW = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b\.?(\s+[a-z]{3}\s+\d{1,2}\b)?|\btoday\b|\btomorrow\b/i;
 const hint = el => { /* the day a row sits under: nearest data-away-day, else a day word in an earlier sibling up the tree */
  const c = el.closest('[data-away-day]'); if (c) return { day: c.getAttribute('data-away-day'), hint: '' };
  let a = el;
  for (let lv = 0; a && lv < 5; lv++, a = a.parentElement) {
   for (let p = a.previousElementSibling, k = 0; p && k < 12; p = p.previousElementSibling, k++) {
    const t = (p.innerText || '').replace(/\s+/g, ' ').trim(); const m = t.match(DAYW); if (m && t.length < 200) return { day: '', hint: m[0] };
   }
  }
  return { day: '', hint: '' };
 };
 const rows = new Map(), texts = [];
 for (const el of document.body.querySelectorAll('*')) {
  if (el.closest('script,style,noscript,template,svg')) continue;
  const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 160 || rows.has(t)) continue;
  if (!vis(el)) continue;
  rows.set(t, hint(el));
 }
 const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
 while ((n = w.nextNode())) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); const el = n.parentElement; if (!t || !el || el.closest('script,style,noscript,template')) continue; if (vis(el)) texts.push(t); }
 return { rows: [...rows].map(([t, h]) => ({ t, day: h.day, hint: h.hint })), texts };
}"""
def _priv(role):  # PF4 · school codes and external calendar terms come from the private names file (never in git)
    fp = os.environ.get("WARDOS_PRIVATE_NAMES") or os.path.join(os.environ.get("WARDOS_PRIVATE_DIR") or os.path.expanduser("~/.local/share/wardos-private"), "private-names.tsv")
    if not os.path.exists(fp): fp = os.path.expanduser("~/.config/wardos/private-names.tsv")
    try: return [re.escape(l.split("\t", 1)[1].strip()) for l in open(fp, encoding="utf-8") if "\t" in l and l.split("\t", 1)[0].strip() == role and l.split("\t", 1)[1].strip()]
    except OSError: return []
KID = re.compile(r"\b(Ainsley|Hayes|Harris|Boys|Kids|school)\b" + "".join(r"|\b" + c + r"\b" for c in _priv("school")), re.I)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from ext_roles import EXT_ROLES   # EXTNAMES1 · shared role constant
_EXT = [n for r in EXT_ROLES for n in _priv(r)]
EXT_ROW = re.compile(r"\b(?!(?:the|at|ward|kids|dad|dan)\b)[a-z]+\s+(?:" + "|".join(_EXT) + r")\b", re.I) if _EXT else re.compile(r"(?!)")
TIME = re.compile(r"(?<![\d/])(\d{1,2}):(\d{2})(?!\d)|(?<![\d/:])(\d{1,2})\s?(a|p|am|pm)\b|~\s?(\d{1,2})\b", re.I)
def _nocust():   # NOCUSTODY1 · one phrase list: main's scripts/qa/nocustody.test.mjs PHRASES (read at run time)
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "nocustody.test.mjs"), encoding="utf-8").read()
    # QAFIX1 · the declaration line now carries a trailing // comment and its own ['\u2019] classes; take the literal up to
    # the last "/i;" on the line, turn JS \uXXXX into the real char, and widen only bare apostrophes (not ones in a class)
    m = re.search(r"^export const PHRASES = /(.*)/i;[ \t]*(?://.*)?$", src, re.M)
    if not m: raise SystemExit("away-pages: PHRASES not found in nocustody.test.mjs")
    body = re.sub(r"\\u([0-9a-fA-F]{4})", lambda u: chr(int(u.group(1), 16)), m.group(1))
    return re.compile(re.sub(r"(?<!\[)'", "['\u2019]", body), re.I)
NOCUST = _nocust()
DRESS = re.compile(r"\b(orange|red|yellow|green|blue|purple|pink|white|black|gold|tie[- ]?dye|neon|camo|maroon)\s+(day|out)\b|dress[- ]?up|spirit\s+(day|week)|pajama|pj day|costume|outsiders day|greaser|crazy (hair|sock)|hat day", re.I)
from datetime import timedelta, timezone
def _months():  # QAFIX1 · a missing, empty or bad month file means no away window: the normal awake board (P3 crash fix)
    try: d = json.load(open(os.path.join(root, "data/cal-months.json"), encoding="utf-8"))
    except (OSError, ValueError): return {}
    d = d.get("days") if isinstance(d, dict) else None
    return d if isinstance(d, dict) else {}
MONTHS = _months()
DOWS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
def ct(dt):  # aware datetime -> CT wall (fixtures carry -05:00, CDT through Nov 1)
    return dt.astimezone(timezone(timedelta(hours=-5)))
def with_dan(d):
    v = MONTHS.get(d.isoformat()); return None if v is None else bool(v.get("withDan"))
def away_at(day, minute):  # same rule as away-filter.js: withDan false all day; 3:00 PM switch on edge days
    w = with_dan(day)
    if w is None: return False
    if not w: return True
    if minute < 900 and with_dan(day - timedelta(days=1)) is False: return True
    if minute >= 900 and with_dan(day + timedelta(days=1)) is False: return True
    return False
def day_of(text, now):
    t = text.lower(); today = ct(now).date()
    if re.search(r"\btoday\b|\btonight\b", t): return today
    if re.search(r"\btomorrow\b", t): return today + timedelta(days=1)
    m = re.search(r"\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?(?:\s+(?:[a-z]{3}\s+)?(\d{1,2})\b(?!:))?", t)
    if not m: return None
    if m.group(2):
        for i in range(-7, 32):
            d = today + timedelta(days=i)
            if d.day == int(m.group(2)): return d
    return today + timedelta(days=(DOWS.index(m.group(1)) - today.weekday()) % 7)
def minute_of(m):
    if m.group(1): h, mi, ap = int(m.group(1)), int(m.group(2)), None
    elif m.group(3): h, mi, ap = int(m.group(3)), 0, m.group(4)
    else: h, mi, ap = int(m.group(5)), 0, None
    hh = h % 12
    if ap: hh += 12 if ap.lower().startswith("p") else 0
    elif h == 12 or h <= 6: hh += 12
    return hh * 60 + mi
def clock_tokens(iso):
    d = datetime.fromisoformat(iso); h12 = d.hour % 12 or 12
    return {f"{h12}:{d.minute:02d}", f"{d.hour}:{d.minute:02d}", f"{d.hour:02d}:{d.minute:02d}"}
DAN_OWN = re.compile(r"^\W*(?:✈️\s*)?Dan\b")
def kid_times(rows, now_iso):
    """A row fails when it names a kid, carries a clock time, and that time falls in an away window. The row's day
    comes from its own text (also a day word inside a removed adult time chip), else its dated cell, else a day word above it, else today."""
    own = clock_tokens(now_iso); now = datetime.fromisoformat(now_iso); bad = []
    # adult timed rows (a time, no kid named, or Dan's own item) are taken out of any container that holds them,
    # so a day card with Dan's 8:10a flight and a 3:00 PM kid row is judged on the kid row alone
    def is_adult(x):
        c = EXT_ROW.sub("", x)
        return bool(TIME.search(c)) and (not KID.search(c) or bool(DAN_OWN.match(c)))
    adult = sorted({r["t"] for r in rows if is_adult(r["t"])}, key=len, reverse=True)
    for r in rows:
        t = r["t"]; core = EXT_ROW.sub("", t)
        if DAN_OWN.match(core): continue
        for a in adult:
            if a != t and a in core: core = core.replace(a, " ")
        if not KID.search(core): continue
        times = [m for m in TIME.finditer(core) if m.group(0).strip() not in own]
        if not times: continue
        # the row's own day word first, even when it sat inside an adult time chip that was taken out ("SAT 12:40 PM")
        d = day_of(core, now) or day_of(t, now) or (datetime.fromisoformat(r["day"]).date() if r.get("day") else None) or day_of(r.get("hint") or "", now) or ct(now).date()
        if any(away_at(d, minute_of(m)) for m in times): bad.append(t + "  [" + d.isoformat() + "]")
    bad.sort(key=len); keep = []
    for t in bad:
        if not any(k.split("  [")[0] in t for k in keep): keep.append(t)
    return keep
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "-d", root], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
res = {"label": label, "root": root, "nows": NOWS, "pages": {}}; fails = 0
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for now in NOWS:
            for W, H in VPS:
                mob = W < 600
                for pg_name in PAGES:
                    key = f"{pg_name[:-5]}-{now[:10]}-{W}x{H}"
                    ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob, reduced_motion="reduce")
                    ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1).*"), lambda r: r.abort())
                    pg = ctx.new_page(); errs = []
                    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
                    pg.clock.install(time=now)
                    data = {"rows": [], "texts": []}
                    try:
                        pg.goto(f"http://127.0.0.1:{port}/{pg_name}?now={now.replace('+', '%2B')}", wait_until="load", timeout=240000)
                        pg.wait_for_timeout(int(os.environ.get("WAIT", "5000")))
                        data = pg.evaluate(JS)
                        if SHOTS: pg.screenshot(path=os.path.join(out, f"{label}-{key}.png"), animations="disabled", timeout=180000)
                    except Exception as e:
                        errs.append("LOAD/SHOT " + str(e).splitlines()[0][:140])
                    kt = kid_times(data["rows"], now)
                    cu = sorted({t for t in data["texts"] if NOCUST.search(t)}) if pg_name not in DAN_ONLY else []
                    dr = sorted({t for t in data["texts"] if DRESS.search(t)})
                    em = sorted({t for t in data["texts"] if "\u2014" in t})
                    ok = not kt and not cu and not dr and not em and not any(x.startswith("LOAD") for x in errs) and bool(data["texts"])
                    fails += 0 if ok else 1
                    res["pages"][key] = {"result": "PASS" if ok else "FAIL", "kid_times": kt, "nocust": cu, "dress": dr, "em_dash": em, "errors": errs}
                    print(("PASS " if ok else "FAIL ") + key, json.dumps({"kid_times": kt[:6], "nocust": cu[:4], "dress": dr[:3], "em_dash": em[:3], "errors": errs[:2]}, ensure_ascii=False), flush=True)
                    ctx.close()
        b.close()
finally:
    srv.kill()
res["fails"] = fails
json.dump(res, open(os.path.join(out, f"{label}.json"), "w"), indent=1, ensure_ascii=False)
print(f"AWAY PAGES {'PASS' if not fails else 'FAIL'} · {len(res['pages'])} page-views · {fails} failing")
sys.exit(1 if fails else 0)
