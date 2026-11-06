#!/usr/bin/env python3
"""Fail-closed checks for the lights recovery package.

Prints one status line. Never prints file bodies, token values, or tunnel
credential paths.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

HOLD = "lights-recover-1"
DIRTY = "accept-pinned-bytes"
STILLS_ALLOW = "allow-existing"
STILLS_HOLD = "hold"
SPAWN_RE = re.compile(
    r"""['"]((?:kasa-daemon|kasa-write|kasa-probe)\.py|lights-fetch\.mjs)['"]"""
)
REL_RE = re.compile(r"""['"](\./[^'"]+)['"]""")
HERE_RE = re.compile(r"""HERE\s*/\s*['"]([^'"]+)['"]""")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def fail(msg: str, code: int) -> None:
    print(f"REFUSE {msg}")
    raise SystemExit(code)


def cmd_gate(args: argparse.Namespace) -> None:
    gate_path = Path(args.gate)
    if not gate_path.is_file():
        fail("gate file absent", 10)
    gate = load_json(gate_path)
    if gate.get("schema") != "wardos.lights-recover.gate/1":
        fail("gate schema", 10)
    script = Path(args.script)
    if gate.get("artifact_sha256") != sha256(script):
        fail("gate artifact hash does not match this script", 10)
    if gate.get("hold_release") != HOLD:
        fail("gate hold release is not the single lights-recover phrase", 10)
    manifest = Path(args.manifest)
    if gate.get("manifest_sha256") != sha256(manifest):
        fail("gate manifest hash mismatch", 10)
    if gate.get("dirty_tree") != DIRTY:
        fail("dirty b79 tree is not explicitly accepted", 11)
    stills = gate.get("cached_stills")
    if args.need_stills:
        if stills == STILLS_HOLD or stills in (None, ""):
            fail("cached stills decision is not allow-existing; routes were not modified", 10)
        if stills != STILLS_ALLOW:
            fail("cached stills decision is not a known value", 10)
    if args.ingress:
        review = Path(args.ingress)
        if gate.get("ingress_review_sha256") != sha256(review):
            fail("gate ingress review hash mismatch", 15)
    print("OK gate")


def parse_ingress(text: str):
    lines = text.splitlines()
    start = None
    for i, ln in enumerate(lines):
        if re.match(r"^ingress:\s*(#.*)?$", ln):
            start = i
            break
    if start is None:
        fail("ingress section missing", 15)
    rules = []
    cur = None

    def take(item: dict, raw: str) -> None:
        if ":" not in raw:
            fail("ingress line is not a key", 15)
        key, val = raw.split(":", 1)
        key, val = key.strip(), val.strip().strip("'\"")
        if key not in ("hostname", "service", "path"):
            fail(f"ingress key {key}", 15)
        if key == "path":
            fail("ingress path constraint was not in the reviewed rules", 15)
        if key in item and item[key] is not None:
            fail(f"ingress duplicate {key}", 15)
        item[key] = val

    for ln in lines[start + 1 :]:
        if not ln.strip() or ln.strip().startswith("#"):
            continue
        indent = len(ln) - len(ln.lstrip(" "))
        if indent <= 0:
            break
        raw = ln.strip()
        if raw.startswith("- "):
            if cur is not None:
                rules.append(cur)
            cur = {"hostname": None, "service": None}
            rest = raw[2:].strip()
            if rest:
                take(cur, rest)
            continue
        if cur is None:
            fail("ingress line outside a rule", 15)
        take(cur, raw)
    if cur is not None:
        rules.append(cur)
    return rules


def cmd_ingress(args: argparse.Namespace) -> None:
    review = load_json(Path(args.review))
    if review.get("schema") != "wardos.hub.ingress-review/1":
        fail("ingress review schema", 15)
    got = parse_ingress(Path(args.config).read_text(encoding="utf-8"))
    exp = review.get("rules")
    if not isinstance(exp, list) or len(got) != len(exp):
        fail("ingress rule count", 15)
    for item, want in zip(got, exp):
        host = item.get("hostname") or None
        if host == "":
            host = None
        if host != want.get("hostname") or item.get("service") != want.get("service"):
            fail("ingress rule mismatch", 15)
        service = item.get("service") or ""
        if service != "http_status:404" and not re.fullmatch(r"http://127\.0\.0\.1:\d+", service):
            fail("ingress origin is not loopback", 15)
    print(f"OK ingress {len(got)}")


def rel_of(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def refs_of(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    found = set()
    for match in REL_RE.finditer(text):
        found.add(match.group(1))
    for match in HERE_RE.finditer(text):
        found.add("./" + match.group(1))
    for match in SPAWN_RE.finditer(text):
        found.add("./" + match.group(1))
    return found


def cmd_transitive(args: argparse.Namespace) -> None:
    root = Path(args.root).resolve()
    manifest = load_json(Path(args.manifest))
    if manifest.get("schema") != "wardos.lights-recover.manifest/1":
        fail("manifest schema", 11)
    rows = manifest.get("files")
    if not isinstance(rows, list):
        fail("manifest files", 11)
    by_path = {row["path"]: row for row in rows}
    missing = [
        row["path"]
        for row in rows
        if row.get("required_before_execute") and not row.get("sha256")
    ]
    if missing:
        fail("runtime-hash-required " + ",".join(missing), 11)
    # Refuse before opening any excluded file. The hash stays a pin of the
    # existing box bytes; this package does not read or copy them.
    blocked = [
        row["path"]
        for row in rows
        if row.get("required_before_execute") and row.get("security_review") == "open"
    ]
    if blocked:
        fail("security-review-open " + ",".join(blocked), 11)
    for row in rows:
        pin = row.get("sha256")
        if not pin:
            continue
        target = root / row["path"]
        if not target.is_file():
            if row.get("required_before_execute"):
                fail(f"missing {row['path']}", 11)
            continue
        have = sha256(target)
        if have != pin:
            fail(f"hash mismatch {row['path']}", 11)
    start = root / "scripts" / "lights-write-proxy.mjs"
    if not start.is_file():
        fail("missing scripts/lights-write-proxy.mjs", 11)
    seen = set()
    queue = [start]
    while queue:
        current = queue.pop()
        key = rel_of(root, current)
        if key in seen:
            continue
        seen.add(key)
        if key not in by_path:
            fail(f"unlisted transitive {key}", 11)
        pin = by_path[key].get("sha256")
        if not pin:
            fail(f"runtime-hash-required {key}", 11)
        if sha256(current) != pin:
            fail(f"hash mismatch {key}", 11)
        for spec in refs_of(current):
            if not spec.startswith("./"):
                continue
            nxt = (current.parent / spec).resolve()
            try:
                nxt.relative_to(root)
            except ValueError:
                fail(f"transitive escapes run tree {spec}", 11)
            if nxt.suffix not in {".mjs", ".js", ".py", ".sh"}:
                continue
            if not nxt.is_file():
                fail(f"missing transitive {spec}", 11)
            queue.append(nxt)
    print(f"OK transitive {len(seen)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    gate = sub.add_parser("gate")
    gate.add_argument("--gate", required=True)
    gate.add_argument("--script", required=True)
    gate.add_argument("--manifest", required=True)
    gate.add_argument("--ingress")
    gate.add_argument("--need-stills", action="store_true")
    gate.set_defaults(func=cmd_gate)
    ingress = sub.add_parser("ingress")
    ingress.add_argument("--config", required=True)
    ingress.add_argument("--review", required=True)
    ingress.set_defaults(func=cmd_ingress)
    trans = sub.add_parser("transitive")
    trans.add_argument("--root", required=True)
    trans.add_argument("--manifest", required=True)
    trans.set_defaults(func=cmd_transitive)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
