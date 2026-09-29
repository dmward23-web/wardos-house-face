#!/usr/bin/env python3
"""
WardOS House Face · Kasa warm-session daemon (LIGHTSFAST1)

Long-lived child of lights-write-proxy.mjs. Holds ONE TP-Link cloud session
(stable term_id from kasa-write.py, so no "New Login" mail) plus the device
handles, so a tap is a single cloud passthrough (~0.5 s) instead of a fresh
login + device list + read-back (~8 s).

Protocol: JSON lines. stdin  {"rid":1,"op":"set","id":"kitchen","on":true,"brightness":40}
                              {"rid":2,"op":"all","on":false}
                              {"rid":3,"op":"state"}
                     stdout {"rid":1,"ok":true,"lights":[...]}  (+ unsolicited {"event":"state",...})
Credentials NEVER printed.
"""
from __future__ import annotations

import asyncio
import importlib.util
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("kasa_write", HERE / "kasa-write.py")
kw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(kw)

POLL_S = 45
SESSION_MAX_S = 6 * 3600  # re-login at most every 6h (same term_id)


class Warm:
    def __init__(self):
        self.manager = None
        self.devs: dict[str, object] = {}
        self.aliases: dict[str, str] = {}
        self.born = 0.0
        self.state: dict[str, dict] = {}
        self.lock = asyncio.Lock()

    async def connect(self):
        creds = kw.load_credentials()
        if not creds:
            raise RuntimeError("need_creds")
        from tplinkcloud import TPLinkDeviceManager

        u, p = creds
        self.manager = TPLinkDeviceManager(u, p, term_id=kw._stable_term_id())
        devices = await self.manager.get_devices()
        self.devs, self.aliases = {}, {}
        for dev in devices:
            alias = (dev.get_alias() or "").strip()
            rid = kw.match_roster_id(alias)
            if rid:
                self.devs[rid] = dev
                self.aliases[rid] = alias
        self.born = time.time()

    async def ensure(self):
        if not self.manager or not self.devs or time.time() - self.born > SESSION_MAX_S:
            await self.connect()

    def row(self, rid: str) -> dict:
        meta = kw.roster_meta(rid)
        st = self.state.get(rid, {})
        return {
            **meta,
            "on": st.get("on"),
            "brightness": st.get("brightness"),
            "online": st.get("online", rid in self.devs),
        }

    def lights(self) -> list[dict]:
        return [self.row(r["id"]) for r in kw.ROSTER]

    async def _call(self, rid, fn):
        """One retry with a fresh session on any failure (expired token etc.)."""
        for attempt in (0, 1):
            try:
                await self.ensure()
                dev = self.devs.get(rid)
                if not dev:
                    raise RuntimeError(f"{rid}: not in cloud device list")
                return await fn(dev)
            except Exception:  # noqa: BLE001
                if attempt:
                    raise
                self.manager = None

    async def read(self, rid):
        raw = await self._call(
            rid, lambda d: d._pass_through_request("system", "get_sysinfo", None)
        )
        on, br = kw._parse_on_brightness(raw if isinstance(raw, dict) else None)
        self.state[rid] = {"on": on, "brightness": br, "online": True, "at": time.time()}

    async def set(self, rid, on, brightness):
        async def do(dev):
            if brightness is not None:
                r = await dev._pass_through_request(
                    "smartlife.iot.dimmer",
                    "set_brightness",
                    {"brightness": max(1, min(100, int(brightness)))},
                )
                if not kw._ok_passthrough(r):
                    raise RuntimeError("set_brightness failed")
            if on is True:
                r = await dev.power_on()
                if not kw._ok_passthrough(r):
                    raise RuntimeError("power_on failed")
            elif on is False:
                r = await dev.power_off()
                if not kw._ok_passthrough(r):
                    raise RuntimeError("power_off failed")

        await self._call(rid, do)
        st = dict(self.state.get(rid, {}))
        if on is not None:
            st["on"] = on
        if brightness is not None:
            st["brightness"] = max(1, min(100, int(brightness)))
        st.update(online=True, at=time.time())
        self.state[rid] = st


W = Warm()


def emit(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


async def refresh_all():
    async with W.lock:
        for r in kw.ROSTER:
            try:
                await W.read(r["id"])
            except Exception:  # noqa: BLE001
                st = W.state.setdefault(r["id"], {})
                st["online"] = False
    emit({"event": "state", "ok": True, "lights": W.lights(), "at": kw.utc_now()})


async def poller():
    while True:
        await asyncio.sleep(POLL_S)
        await refresh_all()


async def handle(msg):
    rid_req = msg.get("rid")
    op = msg.get("op")
    try:
        if op == "state":
            emit({"rid": rid_req, "ok": True, "lights": W.lights(), "at": kw.utc_now()})
            return
        async with W.lock:
            if op == "set":
                lid = str(msg.get("id") or "")
                if lid not in {r["id"] for r in kw.ROSTER}:
                    raise ValueError("unknown id")
                on = msg.get("on") if isinstance(msg.get("on"), bool) else None
                br = msg.get("brightness")
                br = int(br) if isinstance(br, (int, float)) else None
                if on is None and br is None:
                    raise ValueError("need on and/or brightness")
                await W.set(lid, on, br)
            elif op == "all":
                on = bool(msg.get("on"))
                await asyncio.gather(*(W.set(r["id"], on, None) for r in kw.ROSTER))
            else:
                raise ValueError("unknown op")
        emit({"rid": rid_req, "ok": True, "lights": W.lights(), "at": kw.utc_now()})
    except Exception as e:  # noqa: BLE001 — no secrets in messages
        msg_s = str(e) if isinstance(e, (ValueError, RuntimeError)) else type(e).__name__
        emit({"rid": rid_req, "ok": False, "error": msg_s, "lights": W.lights()})


async def main():
    loop = asyncio.get_running_loop()
    reader = asyncio.StreamReader()
    await loop.connect_read_pipe(lambda: asyncio.StreamReaderProtocol(reader), sys.stdin)
    try:
        await W.connect()
        await refresh_all()
        emit({"event": "ready", "ok": True})
    except Exception as e:  # noqa: BLE001
        emit({"event": "ready", "ok": False, "error": type(e).__name__})
    loop.create_task(poller())
    while True:
        line = await reader.readline()
        if not line:
            break
        try:
            msg = json.loads(line)
        except Exception:  # noqa: BLE001
            continue
        loop.create_task(handle(msg))


if __name__ == "__main__":
    asyncio.run(main())
