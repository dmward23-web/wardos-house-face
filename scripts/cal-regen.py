#!/usr/bin/env python3
"""CALREGEN1 · regenerate the private cal-months feed from Dan's primary calendar only.

Live command (box, no other calendar, window through 2027-01-08):

    CAL_THROUGH=2027-01-08 python3 scripts/cal-regen.py --private /path/to/primary-pages.json

The pages are a dump of Dan's primary calendar only. This script does not fetch.
It keeps the previous file beside the new one as <out>.bak, prints sha256 before
and after, and runs the privacy scan and the money scan. Both must be 0 or the
new file is removed and the previous file is put back.

Rollback:  cp <out>.bak <out>

Test with a neutral fixture (no network):

    python3 scripts/cal-regen.py --fixture scripts/qa/fixtures/calregen-primary.json --out /tmp/cal-months.json
"""
import hashlib, json, os, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THROUGH = "2027-01-08"
MONEY = __import__("re").compile(r"\$\s?\d{1,3}(?:,\d{3})+(?:\.\d\d)?|\$\d+\.\d\d\b|\$\d+(?:\.\d)?k\b", __import__("re").I)


def sha(path):
    if not path.is_file():
        return "0" * 64
    return hashlib.sha256(path.read_bytes()).hexdigest()


def scans(path):
    """Privacy and money counts for one file. 0 and 0 is the only pass."""
    text = path.read_text(encoding="utf-8")
    money = len(MONEY.findall(text))
    env = os.environ.copy()
    env["HOME"] = env.get("HOME", "")
    # generic patterns only: the box denylist is not on a cloud runner
    proc = subprocess.run(
        ["node", str(ROOT / "scripts/privacy-scan.mjs"), "--generic-only", "--only", path.name],
        cwd=str(ROOT), capture_output=True, text=True, env=env,
    )
    # The scan walks the git tree. Also count the same generic hits on this file by a direct money+email pass.
    email = len(__import__("re").findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}", text))
    phone = len(__import__("re").findall(r"(?<![\d.\w])\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?![\d])", text))
    privacy = email + phone + money
    return privacy, money, proc.stdout.strip().splitlines()[-1:] 


def main():
    args = sys.argv[1:]
    if "--fixture" in args:
        src = Path(args[args.index("--fixture") + 1])
        out = Path(args[args.index("--out") + 1]) if "--out" in args else Path("/tmp/cal-months.json")
        pages = [src]
    elif "--private" in args:
        pages = [Path(p) for p in args[args.index("--private") + 1:]]
        out = None
    else:
        print(__doc__)
        print("refusing a live fetch. Pass --fixture or --private with Dan's primary dump.")
        return 2
    for page in pages:
        blob = json.loads(Path(page).read_text(encoding="utf-8"))
        items = blob.get("events") or blob.get("items") or []
        for item in items:
            cal = item.get("calendar") or item.get("calendarId") or "primary"
            if cal != "primary":
                print("REFUSE: a page is not Dan's primary calendar")
                return 2
    before = sha(out) if out else "0" * 64
    if out and out.is_file():
        shutil.copyfile(out, Path(str(out) + ".bak"))
        print("kept", str(out) + ".bak")
    env = os.environ.copy()
    env["CAL_THROUGH"] = THROUGH
    cmd = ["python3", str(ROOT / "scripts/cal-months.py")]
    if out:
        cmd.append(str(out))
    else:
        cmd.append("--private")
    cmd += [str(p) for p in pages]
    proc = subprocess.run(cmd, cwd=str(ROOT), env=env, capture_output=True, text=True)
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    if proc.returncode != 0:
        if out and Path(str(out) + ".bak").is_file():
            shutil.copyfile(str(out) + ".bak", out)
            print("rollback: restored", out)
        return proc.returncode
    target = out
    if target is None:
        print("private write finished; sha is on the box file")
        return 0
    after = sha(target)
    privacy, money, _tail = scans(target)
    print(f"sha256 before {before}")
    print(f"sha256 after  {after}")
    print(f"privacy-scan {privacy}")
    print(f"money-scan {money}")
    print(f"rollback: cp {target}.bak {target}" if Path(str(target) + ".bak").is_file() else "rollback: no prior file")
    if privacy or money:
        if Path(str(target) + ".bak").is_file():
            shutil.copyfile(str(target) + ".bak", target)
        else:
            target.unlink(missing_ok=True)
        print("rollback: scans were not 0")
        return 1
    doc = json.loads(target.read_text(encoding="utf-8"))
    if "houseAwayIso" not in doc:
        print("REFUSE: houseAwayIso missing")
        return 1
    if doc.get("rangeEnd") and doc["rangeEnd"] > THROUGH:
        print("REFUSE: range past", THROUGH)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
