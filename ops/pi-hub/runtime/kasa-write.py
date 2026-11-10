#!/usr/bin/env python3
"""
WardOS House Face · Kasa LIVE write (cloud)

On/off + brightness for Dining / Harris / Kitchen via tplink-cloud-api
passthrough (same auth as kasa-probe.py). Credentials NEVER printed.

Usage:
  kasa-write.py --id kitchen --on true
  kasa-write.py --id dining-room --brightness 40
  kasa-write.py --id harris-room --on false
  kasa-write.py --id kitchen --on true --brightness 50
  kasa-write.py --all-on | --all-off

Exit: 0 ok · 2 need_creds · 1 error
Stdout: JSON only (no secrets).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def _stable_term_id() -> str:
    """TPLINKQUIET1: reuse one terminal UUID so TP-Link stops mailing 'New Login' alerts."""
    import uuid
    p = Path(os.environ.get("HOME", "")) / ".config" / "wardos" / "kasa.term_id"
    try:
        v = p.read_text().strip()
        if v:
            return v
    except OSError:
        pass
    v = str(uuid.uuid4())
    p.write_text(v + "\n")
    os.chmod(p, 0o600)
    return v

ROSTER = [
    {
        "id": "dining-room",
        "name": "Dining Room",
        "where": "Dining Room",
        "kind": "dimmer",
        "aliases": ("dining room", "dining-room", "dining"),
    },
    {
        "id": "harris-room",
        "name": "Harris's Room",
        "where": "Harris's Room",
        "kind": "dimmer",
        "aliases": (
            "harris's room",
            "harris’ room",
            "harris room",
            "harris-room",
            "harris",
        ),
    },
    {
        "id": "kitchen",
        "name": "Kitchen",
        "where": "Kitchen",
        "kind": "dimmer",
        "aliases": ("kitchen",),
    },
]

CONFIG_DIR = Path(os.environ.get("HOME", "")) / ".config" / "wardos"


def _read_secret_file(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8").strip()


def load_credentials() -> tuple[str, str] | None:
    """KASACREDS1: the box cred files win over env vars, as a pair.

    A stray box-level KASA_USER (e.g. holding the password) used to override
    good files and break login after a restore. Env is only a fallback, and an
    env user that isn't an email is ignored.
    """
    f_user = _read_secret_file(CONFIG_DIR / "kasa.user")
    f_pass = _read_secret_file(CONFIG_DIR / "kasa.password")
    if f_user and f_pass:
        return f_user, f_pass
    e_user = (
        os.environ.get("KASA_USER", "").strip()
        or os.environ.get("KASA_USERNAME", "").strip()
    )
    if "@" not in e_user:
        e_user = ""
    user = e_user or f_user
    password = os.environ.get("KASA_PASSWORD", "").strip() or f_pass
    if user and password:
        return user, password
    return None


def normalize_alias(alias: str) -> str:
    s = alias.strip().lower().replace("’", "'").replace("'", "")
    return " ".join(s.split())


def match_roster_id(alias: str) -> str | None:
    n = normalize_alias(alias)
    for row in ROSTER:
        for a in row["aliases"]:
            if normalize_alias(a) == n:
                return row["id"]
    return None


def roster_meta(rid: str) -> dict:
    for row in ROSTER:
        if row["id"] == rid:
            return {
                "id": row["id"],
                "name": row["name"],
                "where": row["where"],
                "kind": row["kind"],
            }
    raise KeyError(rid)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _parse_on_brightness(sys_info: dict | None) -> tuple[bool | None, int | None]:
    if not sys_info:
        return None, None
    on = None
    if "relay_state" in sys_info:
        try:
            on = int(sys_info["relay_state"]) == 1
        except (TypeError, ValueError):
            on = bool(sys_info["relay_state"])
    brightness = sys_info.get("brightness")
    if brightness is None and isinstance(sys_info.get("light_state"), dict):
        brightness = sys_info["light_state"].get("brightness")
    if brightness is not None:
        try:
            brightness = max(0, min(100, int(brightness)))
        except (TypeError, ValueError):
            brightness = None
    return on, brightness


def _ok_passthrough(result) -> bool:
    if result is None:
        return True
    if isinstance(result, dict):
        err = result.get("err_code")
        return err is None or err == 0
    return True


async def _find_device(manager, rid: str):
    devices = await manager.get_devices()
    for dev in devices:
        alias = (dev.get_alias() or "").strip()
        if match_roster_id(alias) == rid:
            return dev, alias
    return None, None


async def write_one(manager, rid: str, on: bool | None, brightness: int | None) -> dict:
    meta = roster_meta(rid)
    dev, alias = await _find_device(manager, rid)
    if not dev:
        return {
            **meta,
            "ok": False,
            "error": f"{rid}: not found in cloud device list",
            "alias": None,
        }
    actions: list[str] = []
    try:
        if brightness is not None:
            br = max(1, min(100, int(brightness)))
            r = await dev._pass_through_request(
                "smartlife.iot.dimmer", "set_brightness", {"brightness": br}
            )
            if not _ok_passthrough(r):
                return {
                    **meta,
                    "ok": False,
                    "error": f"set_brightness failed: {r}",
                    "alias": alias,
                }
            actions.append(f"brightness={br}")
        if on is True:
            r = await dev.power_on()
            if not _ok_passthrough(r):
                return {
                    **meta,
                    "ok": False,
                    "error": f"power_on failed: {r}",
                    "alias": alias,
                }
            actions.append("on")
        elif on is False:
            r = await dev.power_off()
            if not _ok_passthrough(r):
                return {
                    **meta,
                    "ok": False,
                    "error": f"power_off failed: {r}",
                    "alias": alias,
                }
            actions.append("off")

        raw = await dev._pass_through_request("system", "get_sysinfo", None)
        sys_info = raw if isinstance(raw, dict) else None
        cur_on, cur_br = _parse_on_brightness(sys_info)
        return {
            **meta,
            "ok": True,
            "alias": alias,
            "on": cur_on,
            "brightness": cur_br,
            "online": True,
            "actions": actions,
        }
    except Exception as e:  # noqa: BLE001 — keep secrets out of messages
        return {
            **meta,
            "ok": False,
            "error": f"{type(e).__name__}: write failed",
            "alias": alias,
        }


async def run(args) -> dict:
    creds = load_credentials()
    if not creds:
        return {
            "ok": False,
            "status": "need_creds",
            "fetchedAt": utc_now(),
            "error": "need_creds · kasa.user + kasa.password on Atlas only",
            "lights": [],
        }
    username, password = creds
    from tplinkcloud import TPLinkDeviceManager

    manager = TPLinkDeviceManager(username, password, term_id=_stable_term_id())

    targets: list[tuple[str, bool | None, int | None]] = []
    if args.all_on:
        for row in ROSTER:
            targets.append((row["id"], True, None))
    elif args.all_off:
        for row in ROSTER:
            targets.append((row["id"], False, None))
    else:
        if not args.id:
            return {
                "ok": False,
                "status": "error",
                "fetchedAt": utc_now(),
                "error": "--id required (or --all-on / --all-off)",
                "lights": [],
            }
        rid = args.id.strip()
        if rid not in {r["id"] for r in ROSTER}:
            return {
                "ok": False,
                "status": "error",
                "fetchedAt": utc_now(),
                "error": f"unknown id {rid}",
                "lights": [],
            }
        on = None
        if args.on is not None:
            on = args.on.lower() in ("1", "true", "yes", "on")
        br = args.brightness
        if br is not None:
            br = max(0, min(100, int(br)))
        if on is None and br is None:
            return {
                "ok": False,
                "status": "error",
                "fetchedAt": utc_now(),
                "error": "need --on and/or --brightness",
                "lights": [],
            }
        targets.append((rid, on, br))

    results = []
    for rid, on, br in targets:
        results.append(await write_one(manager, rid, on, br))

    all_ok = all(r.get("ok") for r in results)
    return {
        "ok": all_ok,
        "status": "live" if all_ok else "error",
        "fetchedAt": utc_now(),
        "source": "tplink-cloud-api-write",
        "writeSupported": True,
        "lights": results,
        "error": None
        if all_ok
        else "; ".join(r.get("error") or "fail" for r in results if not r.get("ok")),
    }


def parse_args(argv):
    p = argparse.ArgumentParser(description="Kasa LIVE write (cloud)")
    p.add_argument("--id", help="roster id: dining-room|harris-room|kitchen")
    p.add_argument("--on", help="true|false")
    p.add_argument("--brightness", type=int, help="0-100 (HS220 uses 1-100)")
    p.add_argument("--all-on", action="store_true")
    p.add_argument("--all-off", action="store_true")
    return p.parse_args(argv)


def main():
    args = parse_args(sys.argv[1:])
    try:
        payload = asyncio.run(run(args))
    except Exception as e:  # noqa: BLE001
        payload = {
            "ok": False,
            "status": "error",
            "fetchedAt": utc_now(),
            "error": type(e).__name__,
            "lights": [],
        }
    print(json.dumps(payload, indent=2))
    if payload.get("status") == "need_creds":
        sys.exit(2)
    sys.exit(0 if payload.get("ok") else 1)


if __name__ == "__main__":
    main()
