#!/usr/bin/env python3
"""
WardOS House Face · Kasa LIVE probe (prototype)

Cloud-first: tplink-cloud-api (email+password → list devices + sysinfo).
Optional --lan: python-kasa Discover on the local network (same creds for newer
devices that require KLAP/AES auth).

Credentials ONLY from (never printed):
  env  KASA_USER / KASA_PASSWORD
  env  KASA_USERNAME / KASA_PASSWORD   (python-kasa CLI names)
  file ~/.config/wardos/kasa.user
  file ~/.config/wardos/kasa.password

Exit:
  0  printed JSON (status live|need_creds|error) to stdout — no secrets
  2  need_creds
  1  other error

Does NOT write data/lights-live.json. Does NOT push LIVE.
See LIGHTS-LIVE.md
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

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
NEED_CREDS_MSG = (
    "need_creds · place Kasa account email+password on Atlas box only: "
    "~/.config/wardos/kasa.user and ~/.config/wardos/kasa.password (mode 600), "
    "or export KASA_USER + KASA_PASSWORD. "
    "tplinkcloud.com web login is cameras-only — Kasa IoT uses the cloud API / Kasa app account."
)


def _read_secret_file(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        mode = path.stat().st_mode & 0o777
        if mode & 0o077:
            # warn to stderr only — do not refuse (Dan may fix later)
            print(
                f"warn: {path} mode is {oct(mode)}; prefer chmod 600",
                file=sys.stderr,
            )
    except OSError:
        pass
    return path.read_text(encoding="utf-8").strip()


def load_credentials() -> tuple[str, str] | None:
    user = (
        os.environ.get("KASA_USER", "").strip()
        or os.environ.get("KASA_USERNAME", "").strip()
        or _read_secret_file(CONFIG_DIR / "kasa.user")
    )
    password = os.environ.get("KASA_PASSWORD", "").strip() or _read_secret_file(
        CONFIG_DIR / "kasa.password"
    )
    if user and password:
        return user, password
    return None


def normalize_alias(alias: str) -> str:
    s = alias.strip().lower().replace("’", "'")
    s = s.replace("'", "")
    s = " ".join(s.split())
    return s


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


def need_creds_payload() -> dict:
    return {
        "status": "need_creds",
        "fetchedAt": utc_now(),
        "source": "kasa-probe",
        "writeSupported": False,
        "brightnessControlSupported": True,  # KS220/HS220 via python-kasa / dimmer passthrough
        "lights": [
            {
                **roster_meta(r["id"]),
                "on": None,
                "brightness": None,
                "online": False,
            }
            for r in ROSTER
        ],
        "reserved": [],
        "error": NEED_CREDS_MSG,
    }


def _sysinfo_dict(sys_info) -> dict | None:
    if sys_info is None:
        return None
    if hasattr(sys_info, "__dict__") and not isinstance(sys_info, dict):
        return dict(sys_info.__dict__)
    if isinstance(sys_info, dict):
        return sys_info
    return None


def _parse_on_brightness(sys_info: dict | None) -> tuple[bool | None, int | None]:
    if not sys_info:
        return None, None
    on = None
    if "relay_state" in sys_info:
        on = bool(sys_info["relay_state"])
    elif "device_on" in sys_info:
        on = bool(sys_info["device_on"])
    elif isinstance(sys_info.get("light_state"), dict):
        ls = sys_info["light_state"]
        on = bool(ls.get("on_off", ls.get("on", 0)))
    brightness = sys_info.get("brightness")
    if brightness is None and isinstance(sys_info.get("light_state"), dict):
        brightness = sys_info["light_state"].get("brightness")
    if brightness is not None:
        try:
            brightness = int(brightness)
            brightness = max(0, min(100, brightness))
        except (TypeError, ValueError):
            brightness = None
    return on, brightness


async def probe_cloud(username: str, password: str) -> dict:
    from tplinkcloud import (
        TPLinkAuthError,
        TPLinkCloudError,
        TPLinkDeviceManager,
        TPLinkDeviceOfflineError,
        TPLinkMFARequiredError,
    )

    try:
        manager = TPLinkDeviceManager(
            username, password, prefetch=False, include_tapo=False
        )
    except TPLinkMFARequiredError as e:
        return {
            "status": "error",
            "fetchedAt": utc_now(),
            "source": "tplink-cloud-api",
            "writeSupported": False,
            "brightnessControlSupported": True,
            "lights": [],
            "reserved": [],
            "error": f"MFA required on TP-Link account ({getattr(e, 'mfa_type', '?')}) — disable MFA for automation or provide mfa_callback path",
        }
    except TPLinkAuthError:
        return {
            "status": "error",
            "fetchedAt": utc_now(),
            "source": "tplink-cloud-api",
            "writeSupported": False,
            "brightnessControlSupported": True,
            "lights": [],
            "reserved": [],
            "error": "TP-Link/Kasa auth failed (bad email/password) — secrets not printed",
        }
    except TPLinkCloudError as e:
        return {
            "status": "error",
            "fetchedAt": utc_now(),
            "source": "tplink-cloud-api",
            "writeSupported": False,
            "brightnessControlSupported": True,
            "lights": [],
            "reserved": [],
            "error": f"TP-Link cloud error (code={getattr(e, 'error_code', '?')})",
        }

    devices = await manager.get_devices()
    by_roster: dict[str, object] = {}
    unmatched: list[dict] = []

    for dev in devices:
        alias = (dev.get_alias() or "").strip()
        rid = match_roster_id(alias) if alias else None
        info = getattr(dev, "device_info", None)
        status = getattr(info, "status", None) if info else None
        model = getattr(info, "device_model", None) if info else None
        # Cloud list status: typically 1 = online
        list_online = status in (1, "1", True, "online", "ONLINE")
        entry = {
            "alias": alias,
            "model": model,
            "device_id_suffix": (getattr(dev, "device_id", "") or "")[-8:],
            "list_online": list_online,
            "dev": dev,
        }
        if rid and rid not in by_roster:
            by_roster[rid] = entry
        else:
            unmatched.append(
                {
                    "alias": alias,
                    "model": model,
                    "list_online": list_online,
                    "mapped": rid,
                }
            )

    lights = []
    errors = []
    for row in ROSTER:
        rid = row["id"]
        meta = roster_meta(rid)
        hit = by_roster.get(rid)
        if not hit:
            lights.append({**meta, "on": None, "brightness": None, "online": False})
            errors.append(f"{rid}: not found in cloud device list (check Kasa app alias)")
            continue
        online = bool(hit["list_online"])
        on = None
        brightness = None
        if online:
            try:
                sys_info = _sysinfo_dict(await hit["dev"].get_sys_info())
                on, brightness = _parse_on_brightness(sys_info)
            except TPLinkDeviceOfflineError:
                online = False
            except Exception as e:  # noqa: BLE001 — probe must stay secret-safe
                errors.append(f"{rid}: sysinfo failed ({type(e).__name__})")
                online = False
        lights.append({**meta, "on": on, "brightness": brightness, "online": online})

    mapped = len(by_roster)
    if mapped == 0:
        status = "error"
    else:
        # Partial map OK — missing pads stay online:false; do not invent state
        status = "live"

    payload = {
        "status": status,
        "fetchedAt": utc_now(),
        "source": "tplink-cloud-api",
        "writeSupported": False,
        "brightnessControlSupported": True,
        "lights": lights,
        "reserved": unmatched,
        "error": None if status == "live" and not errors else "; ".join(errors) if errors else (
            "no roster devices matched cloud aliases" if mapped == 0 else None
        ),
        "note": (
            "Brightness READ from get_sysinfo.brightness (HS220/KS220). "
            "WRITE via scripts/kasa-write.py + lights-write-proxy.mjs (cloud passthrough)."
        ),
    }
    return payload


async def probe_lan(username: str, password: str, timeout: int = 8) -> dict:
    from kasa import Credentials, Discover

    creds = Credentials(username, password)
    devices = await Discover.discover(
        credentials=creds, discovery_timeout=timeout, timeout=timeout
    )
    by_roster: dict[str, object] = {}
    unmatched: list[dict] = []

    for _ip, dev in devices.items():
        try:
            await dev.update()
        except Exception as e:  # noqa: BLE001
            unmatched.append({"host": _ip, "error": type(e).__name__})
            continue
        alias = (dev.alias or "").strip()
        rid = match_roster_id(alias) if alias else None
        brightness = None
        try:
            light = None
            if hasattr(dev, "modules"):
                from kasa.interfaces import Light

                light = dev.modules.get(Light) if hasattr(dev.modules, "get") else None
            if light is not None and getattr(light, "brightness", None) is not None:
                brightness = int(light.brightness)
            elif hasattr(dev, "brightness"):
                brightness = int(dev.brightness)
        except Exception:
            brightness = None
        entry = {
            "alias": alias,
            "model": getattr(dev, "model", None),
            "on": bool(dev.is_on),
            "brightness": brightness,
            "online": True,
        }
        if rid and rid not in by_roster:
            by_roster[rid] = entry
        else:
            unmatched.append(entry)

    lights = []
    for row in ROSTER:
        rid = row["id"]
        meta = roster_meta(rid)
        hit = by_roster.get(rid)
        if not hit:
            lights.append({**meta, "on": None, "brightness": None, "online": False})
        else:
            lights.append(
                {
                    **meta,
                    "on": hit["on"],
                    "brightness": hit["brightness"],
                    "online": True,
                }
            )

    mapped = len(by_roster)
    status = "live" if mapped > 0 else "error"
    return {
        "status": status,
        "fetchedAt": utc_now(),
        "source": "python-kasa-lan",
        "writeSupported": False,
        "brightnessControlSupported": True,
        "lights": lights,
        "reserved": unmatched,
        "error": None
        if mapped
        else "LAN discover found no roster aliases — Atlas may not be on home Wi-Fi; use cloud path",
        "note": "LAN path uses python-kasa Discover + Credentials(email, password).",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Kasa LIVE probe for House Face")
    parser.add_argument(
        "--lan",
        action="store_true",
        help="Use python-kasa LAN discover instead of tplink-cloud-api",
    )
    parser.add_argument(
        "--discovery-timeout",
        type=int,
        default=8,
        help="LAN discovery timeout seconds",
    )
    args = parser.parse_args()

    creds = load_credentials()
    if not creds:
        payload = need_creds_payload()
        print(json.dumps(payload, indent=2))
        return 2

    try:
        if args.lan:
            payload = asyncio.run(probe_lan(creds[0], creds[1], args.discovery_timeout))
        else:
            payload = asyncio.run(probe_cloud(creds[0], creds[1]))
    except Exception as e:  # noqa: BLE001
        payload = {
            "status": "error",
            "fetchedAt": utc_now(),
            "source": "kasa-probe",
            "writeSupported": False,
            "brightnessControlSupported": True,
            "lights": [
                {**roster_meta(r["id"]), "on": None, "brightness": None, "online": False}
                for r in ROSTER
            ],
            "reserved": [],
            "error": f"{type(e).__name__}: probe failed (secrets not printed)",
        }
        print(json.dumps(payload, indent=2))
        return 1

    print(json.dumps(payload, indent=2))
    if payload.get("status") == "need_creds":
        return 2
    if payload.get("status") == "error":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
