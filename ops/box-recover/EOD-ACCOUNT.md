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
- `ops/pi-hub/`: plan, offline-verify, install, and rollback are separate from activation. Activation exits 78. The aarch64 wheel hashes were downloaded on x86_64 and were not imported. Sensi is not in the Pi kit.
- `ops/box-recover/runtime-src/`: ten clean runtime sources from bundle `46bc87d4…`. The Sensi file is not among them.

## Ready and not ready

Ready for review: the recovery plan, mock tests, ingress review, rollback behavior, the ten-file runtime pin, and the Pi verify/install tree. Not ready to execute on the box. Not a complete pin. The Sensi hash is an opaque pin of the existing file, the security review is open, and cached stills are undecided. ARM import is not tested. Wheel hashes are not an install. No SSH, token transfer, or tunnel join is included.

## What is still missing

A secret-free Sensi integration, or an independent gate that accepts the existing opaque hash without copying the file. A cached-stills decision. The hold release. A Pi-local import of the aarch64 wheels. Camera start and box retirement stay out. None of those are requested now.

## What a person still has to do later, and why

No user step is being asked for with this update. That is because the package is not ready for the ask, not a decision that no step will be needed.

The box is still down. After an independent review accepts the opaque Sensi hash and the cached-stills choice, a hold release still has to name the recovery command before anyone runs it on the box. This checkout cannot see the box. For a later Pi install, SSH is off, so a person at the Pi, or another approved path, has to open a route before the install root `/opt/wardos` can be written there. A password, if one is used, stays on that machine. The Pi service code is in this pull request and is not yet activated. The aarch64 import has not been run.

No finish time is implied.
