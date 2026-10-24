"""Box fallback: use the system Chrome when Playwright's bundled browser is not installed (temp HOME hides its cache)."""
import os, shutil


def launch_kw(p, **kw):
    try:
        if os.path.exists(p.chromium.executable_path):
            return kw
    except Exception:
        pass
    for c in (os.environ.get("WARDOS_CHROME"), "/usr/bin/google-chrome", shutil.which("chromium") or ""):
        if c and os.path.exists(c):
            kw["executable_path"] = c
            break
    return kw
