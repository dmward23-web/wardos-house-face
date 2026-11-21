#!/usr/bin/env python3
"""Activation boundary for the Pi hub. Absent or wrong gate refuses. No secret values.

Bootstrap python3 that runs this file is a trusted helper on the machine
running the installer. It is not a pin of the Pi interpreter.
"""
import hashlib
import json
import os
import platform
import re
import shlex
import subprocess
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


class TransactionError(Exception):
    """A service transaction failed after the decision to mutate, or during reversal.

    This is not SystemExit. Callers catch it per row so one observation failure
    cannot skip the other rows. Pre-mutation refusals still use fail().
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


INVOCATION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{7,80}$")


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


def bind_venv(doc: dict, prefix: str) -> str:
    """The exported interpreter is the venv launcher, not an external realpath.

    python -m venv --copies makes bin/python a real file inside the venv.
    A symlink launcher, or a record that stores only the base interpreter, is refused.
    """
    venv = str(doc.get("venv_path") or "")
    py = str(doc.get("venv_python") or "")
    base = str(doc.get("base_interpreter") or "")
    launcher = os.path.normpath(str(Path(venv) / "bin" / "python")) if venv else ""
    if not launcher or os.path.normpath(py) != launcher:
        fail("tested venv mismatch")
    contained(prefix, venv)
    contained(prefix, py)
    path = Path(py)
    if path.is_symlink() or not path.is_file():
        fail("tested venv python")
    real = os.path.realpath(py)
    if real != launcher or (base and os.path.realpath(base) != real):
        fail("tested venv mismatch")
    return launcher


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
    print(bind_venv(doc, prefix))


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


def expand_specifiers(text: str, unit: str) -> str:
    name = unit[:-8] if unit.endswith(".service") else unit
    if "@" in name:
        head, inst = name.split("@", 1)
    else:
        head, inst = name, ""
    out = []
    i = 0
    while i < len(text):
        if text[i] == "%" and i + 1 < len(text):
            spec = text[i + 1]
            i += 2
            if spec == "%":
                out.append("%")
            elif spec in ("i", "I"):
                out.append(inst)
            elif spec == "p":
                out.append(head)
            elif spec == "n":
                out.append(name)
            else:
                out.append("%" + spec)
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def argv_from_show(value: str) -> list:
    if "argv[]=" in value:
        value = value.split("argv[]=", 1)[1].split(" ;", 1)[0].strip()
    return shlex.split(value)


def normalized_exec(unit_name: str, file_exec: str) -> list:
    return shlex.split(expand_specifiers(file_exec, unit_name))


def proc_identity(pid: str, root: str) -> tuple:
    base = Path(root) / str(pid)
    raw = (base / "stat").read_text(encoding="utf-8")
    fields = raw[raw.rfind(")") + 2 :].split()
    start = fields[19]
    argv = [part.decode() for part in (base / "cmdline").read_bytes().split(b"\0") if part]
    return start, argv


def proc_root(prefix: str) -> str:
    override = os.environ.get("WARDOS_PROC_ROOT")
    if not override:
        return "/proc"
    if os.environ.get("WARDOS_SYSTEMD_FIXTURE") != "isolated":
        fail("proc root is not available in production")
    if prefix == "/opt/wardos" or prefix.startswith("/opt/wardos/"):
        fail("proc root is not available in production")
    return override


def observe_enabled(ctl: str, name: str, *, bound: bool) -> bool:
    try:
        run = subprocess.run([ctl, "is-enabled", name], text=True, capture_output=True)
    except OSError:
        run = None
    text = "" if run is None else (run.stdout or "").strip()
    if run is not None and text == "enabled" and run.returncode == 0:
        return True
    if run is not None and text == "disabled" and run.returncode == 1:
        return False
    if bound:
        raise TransactionError("systemd enabled state")
    fail("systemd enabled state")
    return False


def observe_active(ctl: str, name: str, *, bound: bool) -> bool:
    try:
        run = subprocess.run([ctl, "is-active", name], text=True, capture_output=True)
    except OSError:
        run = None
    text = "" if run is None else (run.stdout or "").strip()
    if run is not None and text == "active" and run.returncode == 0:
        return True
    if run is not None and text == "inactive" and run.returncode == 3:
        return False
    reason = "systemd transitional state" if text in ("activating", "deactivating", "reloading", "maintenance") else "systemd active state"
    if bound:
        raise TransactionError(reason)
    fail(reason)
    return False


def systemd_apply(gate_path: str, prefix: str, ctl: str, mode: str) -> None:
    """Apply a staged unit change and account every attempted row.

    A start is owned only when that start command prints INVOCATION=<id> and a
    later show of the same unit still has that id, the staged fragment, user,
    and argv, and the same pid/start/argv. A pid first seen on a show is not
    provenance. The fresh show and the following stop or disable --now are
    still two calls: a change in that gap is not atomic, so a mismatch refuses
    the destructive call and leaves the row as residue. This is not systemd proof.
    """
    proc = proc_root(prefix)
    gate = load(gate_path, "systemd gate")
    systemd(gate_path, prefix)
    units = gate["units"]

    def show(name: str, *, bound: bool) -> dict:
        try:
            run = subprocess.run(
                [ctl, "show", "-p", "FragmentPath", "-p", "DropInPaths", "-p", "User", "-p", "ExecStart", "-p", "MainPID", "-p", "InvocationID", name],
                text=True,
                capture_output=True,
            )
        except OSError:
            run = None
        if run is None or run.returncode != 0:
            if bound:
                raise TransactionError("systemd show")
            fail("systemd show")
        info = {}
        for line in (run.stdout or "").splitlines():
            if "=" in line:
                key, val = line.split("=", 1)
                info[key] = val.strip()
        return info

    def controller(*args: str) -> subprocess.CompletedProcess:
        try:
            return subprocess.run([ctl, *args], text=True, capture_output=True)
        except OSError as exc:
            raise TransactionError("systemd controller") from exc

    def identity_matches(info: dict, owned: dict, fragment: str, user: str, file_exec: str, unit_name: str) -> bool:
        invocation = str(owned.get("invocation") or "")
        if not INVOCATION_RE.fullmatch(invocation) or info.get("InvocationID", "") != invocation:
            return False
        if info.get("FragmentPath", "") != fragment or info.get("User", "") != user:
            return False
        if argv_from_show(info.get("ExecStart", "")) != normalized_exec(unit_name, file_exec):
            return False
        pid = info.get("MainPID", "0") or "0"
        if str(owned.get("pid") or "") != str(pid):
            return False
        if pid in ("0", ""):
            return True
        try:
            start, argv = proc_identity(pid, proc)
        except (OSError, IndexError):
            return False
        return str(owned.get("start") or "") == start and list(owned.get("argv") or []) == argv

    meta = {}
    checked = []
    for unit in units:
        name = unit["name"]
        frag = unit["fragment_path"]
        info = show(name, bound=False)
        if info.get("FragmentPath") != frag or not frag.startswith(prefix + "/"):
            fail("systemd name is not the staged unit")
        if info.get("DropInPaths", "") not in ("", "-"):
            fail("systemd drop-in")
        text = Path(frag).read_text(encoding="utf-8").splitlines()
        file_user = next(line.split("=", 1)[1].strip() for line in text if line.startswith("User="))
        file_exec = next(line.split("=", 1)[1].strip() for line in text if line.startswith("ExecStart="))
        if info.get("User", "") != file_user:
            fail("systemd effective unit")
        if argv_from_show(info.get("ExecStart", "")) != normalized_exec(name, file_exec):
            fail("systemd effective argv")
        pid = info.get("MainPID", "0") or "0"
        owned = unit.get("owned_run") or {}
        if pid not in ("0", ""):
            if mode != "rollback-services" or not identity_matches(info, owned, frag, file_user, file_exec, name):
                fail("systemd foreign run")
        meta[name] = {"fragment": frag, "user": file_user, "exec": file_exec, "owned": owned}
        checked.append(name)
    prior = {
        name: {"enabled": observe_enabled(ctl, name, bound=False), "active": observe_active(ctl, name, bound=False)}
        for name in checked
    }
    started = {}
    start_fault = {}

    def bind_start(name: str, token: str) -> dict:
        if not INVOCATION_RE.fullmatch(token or ""):
            raise TransactionError("systemd ownership unproven")
        info = show(name, bound=True)
        pid = info.get("MainPID", "0") or "0"
        owned = {"invocation": token, "pid": pid, "start": "", "argv": []}
        if pid not in ("0", ""):
            try:
                start, argv = proc_identity(pid, proc)
            except (OSError, IndexError):
                raise TransactionError("systemd run identity")
        else:
            start, argv = "", []
        owned["start"] = start
        owned["argv"] = argv
        row = meta[name]
        if not identity_matches(info, owned, row["fragment"], row["user"], row["exec"], name):
            raise TransactionError("systemd ownership unproven")
        return owned

    def reverse_row(name: str, step: str) -> None:
        state = prior[name]
        row = meta[name]
        if step == "enable":
            if not state["enabled"] and controller("disable", name).returncode != 0:
                raise TransactionError("systemd disable")
            if observe_enabled(ctl, name, bound=True) != state["enabled"]:
                raise TransactionError("systemd poststate")
            return
        if step == "start":
            owned = started.get(name)
            if not owned:
                raise TransactionError(start_fault.get(name) or "systemd ownership unproven")
            info = show(name, bound=True)
            if not identity_matches(info, owned, row["fragment"], row["user"], row["exec"], name):
                raise TransactionError("systemd ownership unproven")
            pid = info.get("MainPID", "0") or "0"
            if pid not in ("0", ""):
                if controller("stop", name).returncode != 0:
                    raise TransactionError("systemd stop")
            if observe_active(ctl, name, bound=True) is not False:
                raise TransactionError("systemd poststate")
            return
        if step == "disable-now":
            rc = 0
            if state["enabled"]:
                rc = controller("enable", name).returncode
            if rc == 0 and state["active"]:
                rc = controller("start", name).returncode
            if rc != 0:
                raise TransactionError("systemd disable")
            if observe_enabled(ctl, name, bound=True) != state["enabled"] or observe_active(ctl, name, bound=True) != state["active"]:
                raise TransactionError("systemd poststate")
            return
        raise TransactionError("systemd reversal")

    attempted = []
    residues = []
    try:
        for name in checked:
            if mode == "rollback-services":
                steps = ["disable-now"]
            elif mode == "start":
                steps = ["start"]
            elif mode == "enable":
                steps = ["enable"]
            else:
                steps = ["enable", "start"]
            for step in steps:
                if step == "disable-now":
                    info = show(name, bound=True)
                    pid = info.get("MainPID", "0") or "0"
                    row = meta[name]
                    if pid not in ("0", "") and not identity_matches(info, row["owned"], row["fragment"], row["user"], row["exec"], name):
                        residues.append(name + ":disable-now")
                        print("RESIDUE " + name + ":disable-now systemd ownership unproven")
                        raise TransactionError("systemd ownership unproven")
                    attempted.append((name, step))
                    if controller("disable", "--now", name).returncode != 0:
                        raise TransactionError("systemd disable")
                    continue
                if step == "start":
                    run = controller("start", name)
                    token = ""
                    for line in (run.stdout or "").splitlines():
                        if line.startswith("INVOCATION="):
                            token = line.split("=", 1)[1].strip()
                    attempted.append((name, step))
                    try:
                        started[name] = bind_start(name, token)
                    except TransactionError as exc:
                        started[name] = None
                        start_fault[name] = exc.reason
                        raise
                    if run.returncode != 0:
                        raise TransactionError("systemd start")
                    continue
                attempted.append((name, step))
                if controller(step, name).returncode != 0:
                    raise TransactionError("systemd " + step)
    except TransactionError as exc:
        failed_cmd = False
        if not attempted and not residues:
            residues.append("transaction")
            print("RESIDUE transaction " + exc.reason)
        for name, step in reversed(attempted):
            try:
                reverse_row(name, step)
                print("REVERSED " + name + ":" + step)
            except TransactionError as exc:
                residues.append(name + ":" + step)
                print("RESIDUE " + name + ":" + step + " " + exc.reason)
                if exc.reason in ("systemd disable", "systemd stop", "systemd enable", "systemd start"):
                    failed_cmd = True
        if failed_cmd:
            fail("systemd reversal failed")
        if residues:
            fail("systemd reversal incomplete")
        fail("systemd partial action reversed")
    print("OK systemd " + mode)


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
    if len(sys.argv) >= 2 and sys.argv[1] == "--bind-venv":
        if len(sys.argv) != 4:
            fail("bind venv arguments")
        print(bind_venv(load(sys.argv[2], "preflight"), sys.argv[3]))
        return
    if len(sys.argv) >= 2 and sys.argv[1] == "--systemd":
        if len(sys.argv) != 4 or not sys.argv[2]:
            fail("systemd gate absent")
        systemd(sys.argv[2], sys.argv[3])
        return
    if len(sys.argv) >= 2 and sys.argv[1] == "--systemd-apply":
        if len(sys.argv) != 6:
            fail("systemd apply arguments")
        systemd_apply(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
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
