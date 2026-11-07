#!/usr/bin/env python3
"""Activation boundary for the Pi hub. Absent or wrong gate refuses. No secret values.

Bootstrap python3 that runs this file is a trusted helper on the machine
running the installer. It is not a pin of the Pi interpreter.
"""
import hashlib
import json
import os
import platform
import sys
from pathlib import Path

ALLOWED_UNITS = {
    "wardos-pi-lights.service",
    "wardos-pi-tunnel@r1.service",
    "wardos-pi-tunnel@r2.service",
}
SENSI_PIN = "54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc"


def fail(msg: str) -> None:
    print("REFUSE " + msg)
    raise SystemExit(78)


def load(path: str, label: str):
    try:
        return json.load(open(path, encoding="utf-8"))
    except OSError:
        fail(label + " absent")
    except json.JSONDecodeError:
        fail(label + " unreadable")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def canonical(raw: str) -> str:
    if not raw or not raw.startswith("/") or ".." in raw.split("/"):
        fail("dest traversal")
    cur = Path("/")
    for part in Path(raw).parts[1:]:
        cur = cur / part
        if cur.is_symlink():
            fail("dest symlink ancestor")
        if not cur.exists():
            break
    resolved = Path(os.path.realpath(raw))
    lexical = Path(os.path.normpath(raw))
    if resolved != lexical:
        fail("dest not canonical")
    text = str(resolved)
    roots = ("/opt/wardos", "/tmp", "/var/tmp", "/opt/cursor/artifacts")
    if not any(text == root or text.startswith(root + "/") for root in roots):
        fail("dest escapes")
    protected = ("/etc", "/usr", "/lib", "/bin", "/home", "/home/dan", "/workspace")
    if text in protected or text.startswith(tuple(p + "/" for p in protected)):
        fail("dest protected")
    print(text)


def contained(prefix: str, candidate: str) -> None:
    """Every existing ancestor of candidate must stay inside prefix and not be a symlink."""
    if not prefix.startswith("/") or not candidate.startswith("/") or ".." in candidate.split("/"):
        fail("contained traversal")
    pref = Path(os.path.realpath(prefix))
    if pref != Path(os.path.normpath(prefix)):
        fail("contained prefix")
    lex = Path(os.path.normpath(candidate))
    try:
        lex.relative_to(pref)
    except ValueError:
        fail("contained escapes")
    cur = Path("/")
    for part in lex.parts[1:]:
        cur = cur / part
        if cur.is_symlink():
            fail("contained symlink")
        if not cur.exists():
            break
        if cur == pref or str(cur).startswith(str(pref) + "/"):
            real = Path(os.path.realpath(cur))
            try:
                real.relative_to(pref)
            except ValueError:
                fail("contained escapes")


def wheelhouse_digest(house: Path) -> str:
    files = sorted(p for p in house.glob("*.whl")) if house.is_dir() else []
    blob = b"".join(sha256(p).encode() for p in files)
    return hashlib.sha256(blob).hexdigest()


def preflight_target(result: str, prefix: str, lock: str, house: str) -> None:
    """Target binding. The JSON file is not an authenticated record and is not ARM approval."""
    doc = load(result, "preflight")
    if doc.get("schema") != "wardos.pi-preflight.result/1":
        fail("preflight schema")
    if doc.get("record_is_authentication") is not False or doc.get("arm_execution_approved") is not False:
        fail("preflight record is not authentication")
    arch = platform.machine()
    if arch != "aarch64" or doc.get("host_arch") != "aarch64":
        fail("target requires this machine to be aarch64")
    if doc.get("pip_exit") != 0 or doc.get("import_exit") != 0:
        fail("preflight pip and import must both be 0")
    if doc.get("aarch64_import_proven") is not True:
        fail("preflight ARM flag does not match this machine")
    lock_path = Path(lock)
    house_path = Path(house)
    if not lock_path.is_file() or sha256(lock_path) != doc.get("lock_sha256"):
        fail("preflight lock")
    if wheelhouse_digest(house_path) != doc.get("wheelhouse_sha256"):
        fail("preflight wheelhouse")
    venv = str(doc.get("venv_path") or "")
    py = str(doc.get("venv_python") or "")
    contained(prefix, venv)
    contained(prefix, py)
    if Path(py).is_symlink() or not Path(py).is_file():
        fail("tested venv python")
    if os.path.realpath(py) != str(Path(venv) / "bin" / "python"):
        fail("tested venv mismatch")
    print(os.path.realpath(py))


def preflight_ok(path: str) -> None:
    """Both pip and import must be 0. A fixture cannot set the ARM flag."""
    doc = load(path, "preflight")
    arch = platform.machine()
    if doc.get("host_arch") != arch:
        fail("preflight arch is not this machine")
    if doc.get("pip_exit") != 0 or doc.get("import_exit") != 0:
        fail("preflight pip and import must both be 0")
    proven = arch == "aarch64" and doc.get("pip_exit") == 0 and doc.get("import_exit") == 0
    if bool(doc.get("aarch64_import_proven")) != proven:
        fail("preflight ARM flag does not match this machine")
    if doc.get("phrase_is_proof") is True:
        fail("preflight phrase is not proof")
    print("OK preflight record")


def expected_fragment(prefix: str, name: str) -> str:
    base = prefix.rstrip("/") + "/lib/systemd/system/"
    if name == "wardos-pi-lights.service":
        return base + "wardos-pi-lights.service"
    if name in ("wardos-pi-tunnel@r1.service", "wardos-pi-tunnel@r2.service"):
        return base + "wardos-pi-tunnel@.service"
    fail("systemd unit")
    return ""


def systemd(path: str, prefix: str) -> None:
    gate = load(path, "systemd gate")
    if gate.get("schema") != "wardos.pi-systemd.gate/1":
        fail("systemd gate schema")
    units = gate.get("units")
    if not isinstance(units, list) or not units:
        fail("systemd units")
    for unit in units:
        if not isinstance(unit, dict):
            fail("systemd unit must name the staged file")
        name = unit.get("name")
        frag = unit.get("fragment_path") or ""
        digest = unit.get("fragment_sha256") or ""
        if name not in ALLOWED_UNITS or len(digest) != 64:
            fail("systemd unit")
        if any(bad in name for bad in ("nest", "cams", "8787")):
            fail("systemd unit")
        if frag != expected_fragment(prefix, name):
            fail("systemd fragment is not the staged unit")
        contained(prefix, frag)
        target = Path(frag)
        if target.is_symlink() or not target.is_file():
            fail("systemd fragment")
        if sha256(target) != digest:
            fail("systemd fragment hash")
        text = target.read_text(encoding="utf-8")
        if "User=" not in text or "ExecStart=" not in text:
            fail("systemd effective unit")
        user = next(line.split("=", 1)[1].strip() for line in text.splitlines() if line.startswith("User="))
        if user in ("", "root") or (gate.get("service_user") and gate.get("service_user") != user):
            fail("systemd user")
        exec_line = next(line.split("=", 1)[1].strip() for line in text.splitlines() if line.startswith("ExecStart="))
        if prefix not in exec_line:
            fail("systemd exec")
    print("OK systemd gate")


def install_root(path: str, prefix: str) -> None:
    gate = load(path, "install gate")
    if gate.get("schema") != "wardos.pi-install.gate/1":
        fail("install gate schema")
    if gate.get("root") != "/opt/wardos":
        fail("install root")
    if prefix != "/opt/wardos" and not prefix.startswith("/opt/wardos/"):
        fail("install prefix")
    user = gate.get("service_user") or ""
    home = gate.get("service_home") or ""
    if not user or user == "root" or not home.startswith("/"):
        fail("service user home")
    print("OK install gate")


def activate(path: str) -> None:
    gate = load(path, "activation gate")
    if gate.get("schema") != "wardos.pi-activate.gate/1":
        fail("activation gate schema")
    if gate.get("activate") != "lights-and-tunnel":
        fail("activation scope")
    if gate.get("cams") != "parked":
        fail("cams stay parked")
    if gate.get("ssh") != "leave-off":
        fail("ssh gate")
    if gate.get("secrets") != "paths-only":
        fail("secrets gate")
    if gate.get("privacy_consent") != "full-8788-accepted":
        fail("privacy consent absent")
    if gate.get("provisioning") != "not-performed":
        fail("provisioning hold")
    profile = gate.get("exec_profile") or "target"
    if profile not in ("target", "fixture-stub"):
        fail("exec profile")
    print("OK pi gate")


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "--canonical":
        if len(sys.argv) != 3:
            fail("prefix absent")
        canonical(sys.argv[2])
        return
    if len(sys.argv) >= 2 and sys.argv[1] == "--contained":
        if len(sys.argv) != 4:
            fail("contained arguments")
        contained(sys.argv[2], sys.argv[3])
        return
    if len(sys.argv) >= 2 and sys.argv[1] == "--preflight-ok":
        if len(sys.argv) != 3:
            fail("preflight absent")
        preflight_ok(sys.argv[2])
        return
    if len(sys.argv) >= 2 and sys.argv[1] == "--preflight-target":
        if len(sys.argv) != 6:
            fail("preflight target arguments")
        preflight_target(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        return
    if len(sys.argv) >= 2 and sys.argv[1] == "--systemd":
        if len(sys.argv) != 4 or not sys.argv[2]:
            fail("systemd gate absent")
        systemd(sys.argv[2], sys.argv[3])
        return
    if len(sys.argv) >= 2 and sys.argv[1] == "--install":
        if len(sys.argv) != 4 or not sys.argv[2]:
            fail("install gate absent")
        install_root(sys.argv[2], sys.argv[3])
        return
    if len(sys.argv) != 2 or not sys.argv[1]:
        fail("activation gate absent")
    activate(sys.argv[1])


if __name__ == "__main__":
    main()
