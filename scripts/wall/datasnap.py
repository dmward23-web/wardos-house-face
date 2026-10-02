# DAYWIN1 · pinned data for test clocks on Thu Oct 1 2026. The day's generated files (data/*.json) change every
# morning; a check that runs at an Oct 1 test clock reads the Oct 1 data set it was written against
# (scripts/wall/fixtures/oct01-data = data/*.json at 38a15c6). Any other clock reads data/ as it is (real data).
import os, re
SNAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "oct01-data")
DATA_RE = re.compile(r"/data/([A-Za-z0-9._-]+\.json)(?:\?|$)")
def pinned(iso):
    return str(iso).startswith("2026-10-01")
def body(url, iso):
    """bytes of the pinned file for this data URL at this clock, else None (serve the real file)."""
    if not pinned(iso): return None
    m = DATA_RE.search(url)
    if not m: return None
    p = os.path.join(SNAP, m.group(1))
    return open(p, "rb").read() if os.path.exists(p) else None
def path(name, iso):
    """path of data/<name> for this clock (pinned snapshot on Oct 1)."""
    p = os.path.join(SNAP, name)
    if pinned(iso) and os.path.exists(p): return p
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", name)
