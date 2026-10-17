"""TEXTLAW2 · visible-text law for Python writers (scripts/cal-months.py).

Reads the one shared rules file, scripts/text-law.json, that scripts/cal-from-events.mjs reads too,
so both data writers put the same words on the glass. Words only: never ids, times or custody.
"""
import json, os, re

LAW = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "text-law.json"), encoding="utf-8"))
def names_path():
    """NAMESDIR1 · WARDOS_PRIVATE_NAMES, else <private dir>/private-names.tsv (~/.local/share/wardos-private), else the old
    ~/.config/wardos/private-names.tsv (fallback)."""
    if os.environ.get("WARDOS_PRIVATE_NAMES"): return os.environ["WARDOS_PRIVATE_NAMES"]
    primary = os.path.join(os.environ.get("WARDOS_PRIVATE_DIR") or os.path.expanduser("~/.local/share/wardos-private"), "private-names.tsv")
    return primary if os.path.exists(primary) else os.path.expanduser("~/.config/wardos/private-names.tsv")
def _private_names():
    """PRIVNAME1 · {PARTNER} / {COPARENT} from private-names.tsv (names_path(); role<TAB>name), WARDOS_PRIVATE_NAMES=<path>,
    or WARDOS_NAMES="partner=X;coparent=Y" (tests). Never in git. Missing = hard fail."""
    out = {}
    def add(role, name):
        role, name = (role or "").strip().lower(), (name or "").strip()
        if role and name: out.setdefault(role, []).append(name)
    if os.environ.get("WARDOS_NAMES"):
        for kv in os.environ["WARDOS_NAMES"].split(";"):
            if "=" in kv: add(*kv.split("=", 1))
    else:
        fp = names_path()
        if not os.path.exists(fp): raise SystemExit(f"HARD FAIL: private-names.tsv missing ({fp}), refusing to write glass text")
        for ln in open(fp, encoding="utf-8"):
            ln = ln.rstrip("\n")
            if ln.strip() and not ln.startswith("#") and "\t" in ln: add(*ln.split("\t", 1))
    for role in ("partner", "coparent"):
        if not out.get(role): raise SystemExit(f"HARD FAIL: private names have no {role}")
    return out
_NAMES = _private_names()
def _fill(rx): return re.sub(r"\{(PARTNER|COPARENT)\}", lambda m: "(?:" + "|".join(re.escape(n) for n in _NAMES[m.group(1).lower()]) + ")", rx)
def _private_rules():
    """CALSCRUB1 · event-specific rules live box-only: WARDOS_TEXT_LAW_PRIVATE or <private dir>/text-law.private.json (applied first)."""
    fp = os.environ.get("WARDOS_TEXT_LAW_PRIVATE") or os.path.join(os.environ.get("WARDOS_PRIVATE_DIR") or os.path.expanduser("~/.local/share/wardos-private"), "text-law.private.json")
    try: return json.load(open(fp, encoding="utf-8")).get("rules", [])
    except Exception: return []
RULES = [(re.compile(_fill(r["re"]), re.I if "i" in r.get("flags", "") else 0),
          re.sub(r"\$(\d)", r"\\\1", r["to"]),       # $1 (JS) -> \1 (Python)
          0 if r["global"] else 1)
         for r in _private_rules() + LAW["rules"]]
SKIP = re.compile(r"(https?:|\d{4}-\d\d-\d\d)")

def clean_text(s):
    if not isinstance(s, str) or not s.strip() or len(s) >= LAW["maxLen"] or SKIP.match(s): return s
    for rx, rep, n in RULES: s = rx.sub(rep, s, count=n)
    return re.sub(r"\s{2,}", " ", s).strip()

if __name__ == "__main__":   # test hook: JSON list of strings on stdin -> cleaned list on stdout
    import sys
    print(json.dumps([clean_text(x) for x in json.load(sys.stdin)], ensure_ascii=False))
