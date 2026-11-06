#!/usr/bin/env python3
"""Activation boundary for the Pi hub. Absent or wrong gate refuses. No secret values."""
import json
import sys


def fail(msg: str) -> None:
    print("REFUSE " + msg)
    raise SystemExit(78)


def main() -> None:
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
