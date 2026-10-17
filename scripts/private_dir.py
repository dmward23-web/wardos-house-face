"""PRIVFEED1 · Python twin of scripts/private-dir.mjs (box-only private folder, never inside a git work tree)."""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIVATE_DIR = os.path.abspath(os.environ.get("WARDOS_PRIVATE_DIR") or os.path.expanduser("~/.local/share/wardos-private"))

def priv_path(*parts):
    return os.path.join(PRIVATE_DIR, *parts)

def inside_repo(p):
    a = os.path.abspath(p)
    if a == ROOT or a.startswith(ROOT + os.sep): return True
    d = os.path.dirname(a)
    while d and d != os.path.dirname(d):
        if os.path.exists(os.path.join(d, ".git")): return True
        d = os.path.dirname(d)
    return False

def assert_private_out(p, what="private data"):
    if inside_repo(p):
        sys.exit(f"PRIVFEED1 HARD FAIL: refusing to write {what} inside a git work tree: {p} (private files live in {PRIVATE_DIR})")
    os.makedirs(os.path.dirname(os.path.abspath(p)), mode=0o700, exist_ok=True)
    return p
