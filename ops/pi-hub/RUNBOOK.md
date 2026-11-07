# Pi hub kit

Held. This does not enable SSH, join a tunnel, or activate a service. Pi v6 is a static candidate. It does not release any hold.

Target for a later install: Raspberry Pi OS Trixie arm64 Desktop, hostname wardos-pi, user dan, Ward Wi-Fi. SSH is off. The kit was not run on that machine.

`--install` is the target profile and refuses to finish without the frozen payload's Node archive, cloudflared binary, and 21 wheels, copied to `bin/` and `deps/wheelhouse` after a hash check. `--fixture-install` is only for cloud fixtures. It cannot satisfy a target activation. The runtime interpreter is the venv path recorded by a successful preflight, not `prefix/venv/bin/python`. `pi-hub-install.sh --plan` prints the limits. `--offline-verify` checks the 21 wheel hashes and prints `ARM_IMPORT: NOT TESTED`. A wheel hash is not a successful install. `--install --dest` writes a fresh canonical prefix and records a receipt. It refuses traversal, a symlink ancestor, `/etc`, `/home/dan`, and `/workspace`. `--rollback --dest` checks every receipt entry before it removes any file. It does not stop a service. `--rollback-services` disables and stops only a unit whose systemd FragmentPath is the staged unit file. `--enable`, `--start`, and `--activate` do that only when the gate binds that same staged file. They are conditional. With no gate they exit 78. The unit files do have an `[Install]` section and `Restart=on-failure`. That is not a claim that a unit is enabled.

Sensi is not in this kit. The current lights process imports that file, and its security review is open. A Pi install needs a secret-free Sensi integration, or it leaves Sensi out. That choice needs an independent gate. This kit does not copy the existing file.

The box lock `ops/box-recover/reference/kasa-requirements.lock.txt` has 21 packages and 21 hashes. It is the x86_64 cp313 lock. The candidate `deps/kasa-aarch64-cp313.lock.txt` uses the same versions. Pure-Python wheel hashes match the box lock. The eight compiled packages have different aarch64 wheel hashes. Nothing in that file was imported on an aarch64 interpreter.

Node evidence from the runtime-matching lights process: `node:` imports and `base64url` meet at Node 14.18.0. Sensi and Spotify call global `fetch`, unflagged in Node 18.0.0. `ws@8.22.0` declares `node >= 10`. The box reports Node v24.22.1 and npm 11.21.1. The Pi's Debian node package was not read.

The wall client remains the Elo/Beelink. Whether the Beelink should host the hub instead of the Pi is an approval question, not a code requirement. See `ops/box-recover/EOD-ACCOUNT.md`.
