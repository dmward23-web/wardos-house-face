# Pi hub kit

Held. This does not enable SSH, join a tunnel, or activate a service.

Target for a later install: Raspberry Pi OS Trixie arm64 Desktop, hostname wardos-pi, user dan, Ward Wi-Fi. SSH is off. The kit was not run on that machine.

`pi-hub-install.sh --plan` prints the limits. `--offline-verify` checks the 21 wheel hashes and prints `ARM_IMPORT: NOT TESTED`. A wheel hash is not a successful install. `--install --dest` writes a staging tree under `/tmp`, `/var/tmp`, or `/opt/cursor/artifacts` and records a receipt. It refuses `/etc`, `/home/dan`, and `/workspace`. `--rollback --dest` removes only receipt files. `--activate` exits 78. The startup script exits 78 before any listener. The unit has no install section.

Sensi is not in this kit. The current lights process imports that file, and its security review is open. A Pi install needs a secret-free Sensi integration, or it leaves Sensi out. That choice needs an independent gate. This kit does not copy the existing file.

The box lock `ops/box-recover/reference/kasa-requirements.lock.txt` has 21 packages and 21 hashes. It is the x86_64 cp313 lock. The candidate `deps/kasa-aarch64-cp313.lock.txt` uses the same versions. Pure-Python wheel hashes match the box lock. The eight compiled packages have different aarch64 wheel hashes. Nothing in that file was imported on an aarch64 interpreter.

Node evidence from the runtime-matching lights process: `node:` imports and `base64url` meet at Node 14.18.0. Sensi and Spotify call global `fetch`, unflagged in Node 18.0.0. `ws@8.22.0` declares `node >= 10`. The box reports Node v24.22.1 and npm 11.21.1. The Pi's Debian node package was not read.

The wall client remains the Elo/Beelink. Whether the Beelink should host the hub instead of the Pi is an approval question, not a code requirement. See `ops/box-recover/EOD-ACCOUNT.md`.
