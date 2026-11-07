# Pi hub packet, ready for review, not installed

This is not the recovery archive. Recovery v3 `989df41936b209963c0ddeb92603a4705261b556cf09afe8abb26d69be559463` and v4 `a53f8462d1f696c65d49249e80cf36bdec201ad2ac13f71ef27f295929f11696` are unchanged. The previous Pi packet `0c2b88f7a5a8b2484a01a52d1d1bcf8c257a8b18aacd62825490e0361003da3d` and payload `c06f47bbaf05b92034eedcedd07b97444437ad4e6a96e441b27286c1fb928bed` are unchanged.

The earlier Pi tar `88515c6c2960cef0a999a9678e750b99f20c97472f9a9e6416f0a6009a0dbbba` was a staging stub. It is obsolete. Do not use it.

No SSH change, no tunnel join, no secret transfer, and no install on wardos-pi were performed. The Pi was not inspected from this checkout.

## What the code does

`pi-hub-install.sh` defaults to `--plan` and writes nothing.

`--offline-verify` checks that the aarch64 lock has 21 hashes and that each hash is named in the wheelhouse list. It prints `ARM_IMPORT: NOT TESTED`. It does not download or import.

`--install --prefix` writes a tree. `/opt/wardos` is allowed. `/etc`, `/home/dan`, `/workspace`, and this checkout are refused. The tree has the lights, tunnel, and venv scripts, `pi_gate.py`, two systemd unit files under `lib/systemd/system`, `etc/hub.env`, and `etc/secrets.refs`. `bin/hub` points at `wardos-pi-lights.sh`. `current` points at `.`. `etc/units-enabled` is `no`. Install does not call systemctl and does not create token files, `tunnel.yml`, or a Python venv.

`--rollback --prefix` removes only receipt files and those two symlinks, and only when the recorded hash or link text still matches.

`--enable`, `--start`, and `--activate` call `SYSTEMCTL` only when the gate names a staged unit file, its sha256, and `systemctl show -p FragmentPath` returns that same file. A global unit name is not treated as the staged file. A name containing nest, cams, or 8787 is refused. With no gate they exit 78. Install itself does not call systemctl. `--rollback` checks every receipt entry before deleting any file. `--rollback-services` disables and stops only a unit whose FragmentPath is the staged file. The unit files have `[Install]` and `Restart=on-failure`. Those lines do not mean a unit is enabled.

`wardos-pi-lights.sh --activate` then requires a mode-600 token file. `cached_stills` must be `allow-existing`. If the staged proxy imports `sensi-control.mjs` and that file is absent, it refuses before exec. A stub that does not import Sensi can bind. The real staged proxy is copied from the clean runtime bundle and Sensi is not copied.

`wardos-pi-tunnel.sh --activate --connector r1|r2` requires a tunnel config file and execs cloudflared for that connector only. The default name in `hub.env` is `wardos-hub`, and that name refuses unless the gate sets `cutover` to `approved`. This packet did not run that against a real binary.

`wardos-pi-venv.sh --preflight` creates a venv, runs `pip install --require-hashes --no-index --find-links --only-binary=:all:`, then `import kasa, tplinkcloud`, and writes the pip exit, import exit, and imported flag. It does not read an environment phrase. On this x86_64 host the aarch64 wheels fail that attempt. A pure-Python fixture wheel can make the same command record a successful import. That success is not an aarch64 result. qemu-aarch64 was not run. Wheel bytes are in `/opt/cursor/artifacts/pi-offline`, not in git. `OFFLINE-MANIFEST.json` records their hashes.

Mocks on this machine showed the installed lights and both connector commands bind listeners only after that gate, and that a gate asking to start cameras is refused. The lights listener in the mock is a stand-in script, not the pinned proxy.

## If the real proxy is what later runs

That program is not lights-only. On `:8788` the existing code serves unauthenticated `/health`, `/api/health`, and OPTIONS; `POST /api/pair` returns the shared device key for a one-time code; `POST /api/spotify/exchange` uses PKCE state before the general key check. The same device key then covers pair mint, taps, Sensi read and set, the other Spotify routes, lights read/set/refresh, and the private feed. The private feed can serve cached camera stills. Parked capture does not stop that. Cached stills are still an open privacy decision. This Pi packet does not add a route block and does not carry `sensi-control.mjs`.

The opaque Sensi hash is `54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc`. The security review stays open. The file is not in this packet. The real `lights-write-proxy.mjs` imports it, so a start of that pinned file cannot succeed until a secret-free Sensi module is supplied or an independent gate accepts the existing file. This packet does neither.

## Still missing

- No token, Kasa password, or tunnel credential. Those paths are named only.
- Units are written under the prefix, not into `/etc/systemd`, and install does not enable them.
- The aarch64 wheels, Node v24.22.1 linux-arm64, and cloudflared 2026.9.3 arm64 were checksum-checked on this x86_64 host. They were not imported or executed under qemu or on the Pi. `import kasa, tplinkcloud` on Trixie arm64 is still unmet.
- The real proxy still cannot start until Sensi is supplied in a reviewed form or an independent gate accepts the existing file. Cached stills stay an open decision. `wardos-hub` stays behind a separate cutover gate.
- No SSH change and no tunnel join.

Ready for review means this packet can be read. It does not mean the Pi is installed. The mock tests in this checkout are not an independent verification.
