#!/usr/bin/env python3
"""Activation boundary for the Pi hub. Absent or wrong gate refuses. No secret values."""
import json
import sys


def fail(msg: str) -> None:
    print("REFUSE " + msg)
    raise SystemExit(78)


ALLOWED_UNITS = {
    "wardos-pi-lights.service",
    "wardos-pi-tunnel@r1.service",
    "wardos-pi-tunnel@r2.service",
}


def systemd(path: str) -> None:
    try:
        gate = json.load(open(path, encoding="utf-8"))
    except OSError:
        fail("systemd gate absent")
    except json.JSONDecodeError:
        fail("systemd gate unreadable")
    if gate.get("schema") != "wardos.pi-systemd.gate/1":
        fail("systemd gate schema")
    units = gate.get("units")
    if not isinstance(units, list) or not units:
        fail("systemd units")
    for unit in units:
        if not isinstance(unit, str) or unit not in ALLOWED_UNITS:
            fail("systemd unit")
        if "nest" in unit or "cams" in unit or "8787" in unit:
            fail("systemd unit")
    print("OK systemd gate")


def install_root(path: str, prefix: str) -> None:
    try:
        gate = json.load(open(path, encoding="utf-8"))
    except OSError:
        fail("install gate absent")
    except json.JSONDecodeError:
        fail("install gate unreadable")
    if gate.get("schema") != "wardos.pi-install.gate/1":
        fail("install gate schema")
    if gate.get("root") != "/opt/wardos":
        fail("install root")
    if prefix != "/opt/wardos" and not prefix.startswith("/opt/wardos/"):
        fail("install prefix")
    print("OK install gate")


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "--systemd":
        if len(sys.argv) != 3 or not sys.argv[2]:
            fail("systemd gate absent")
        systemd(sys.argv[2])
        return
    if len(sys.argv) >= 2 and sys.argv[1] == "--install":
        if len(sys.argv) != 4 or not sys.argv[2]:
            fail("install gate absent")
        install_root(sys.argv[2], sys.argv[3])
        return
    if len(sys.argv) != 2 or not sys.argv[1]:
        fail("activation gate absent")
    try:
        gate = json.load(open(sys.argv[1], encoding="utf-8"))
    except OSError:
        fail("activation gate absent")
    except json.JSONDecodeError:
        fail("activation gate unreadable")
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
    print("OK pi gate")


if __name__ == "__main__":
    main()
