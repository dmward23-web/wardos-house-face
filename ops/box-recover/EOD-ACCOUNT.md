# End of day account, 2026-11-06

Box execution is still held. This file records what was prepared. It does not ask for a hold release.

## Roles

The Pi is the intended always-on house hub: the lights and private-feed process, plus the tunnel, with cameras parked. The Elo 3202L and the Beelink behind it are the wall client. `WALL-STATION.md` describes that Beelink as the mini PC for the portrait display. The house pages are the client. The hub is the loopback proxies and the named tunnel.

A separate Pi is not required by the code. The hub processes are Node, a Python virtualenv, and cloudflared. They do not use Pi-only hardware. The Beelink could host that hub if it is kept always on and that duty is approved. Putting the hub on the wall client would put the mode-600 token files and the tunnel credential on the same machine as the browser that stores the device token. Keeping a second machine separates hub uptime from wall sleep, restart, and maintenance. No power, performance, or reliability measurement was made, so this is not a recommendation on those grounds. No claim is made that no other host exists.

## What is true tonight

The Pi was reported as Raspberry Pi OS Trixie arm64 Desktop, hostname `wardos-pi`, user `dan`, Ward Wi-Fi, SSH off, browser boots, hub software not installed. Those Pi facts come from the corrected plan, not from a new inspection of the Pi.

The box hub listeners were down after the 16:18:48 CST reboot. Public lights and cams health were 530 at 17:08-17:10 CST. The current Kasa venv imports. `ws` is not installed in either deps location. Default supervisor modes would try to start cameras. There is still no supported default command that restores lights and the tunnel while leaving cameras parked. This package is that missing command, and it stays refused.

The local tunnel config maps the two hostnames above and a 404 fallback. That check did not read credentials and does not prove there is no other host.

## What this checkout now contains

- `ops/box-recover/`: the lights recovery script, the pinned manifest, the ingress review, the vendored supervisor and lock files, and mock tests.
- `ops/pi-hub/`: a plan/stage/rollback kit and an aarch64 wheel hash lock for the same 21 Kasa versions. The wheels were downloaded and hashed on x86_64. They were not imported on aarch64. The kit does not enable a service or join a tunnel.

## What is still missing

Runtime hashes and dirty-tree bytes listed in `PARENT-FILE-REQUEST.txt`. A cached-stills decision. An independent gate. The hold release. A Pi-local import of the aarch64 wheels. Any SSH, secret transfer, tunnel join, camera start, or box retirement. None of those are requested now.

## What a person still has to do later, and why

Nothing tonight. The cloud checkout cannot see the box or the Pi.

After an independent gate and a hold release that names this artifact, a person or a gated bot with a route onto the box can run the reviewed command. This VM cannot. For a later Pi install, SSH is off, so a person at the Pi desktop, or another approved path, has to open a route. A password, if one is used, stays on that machine. That step is not part of this package and is not being asked for.

No finish time is implied.
