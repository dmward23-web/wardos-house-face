# Pi hub kit

Held. This does not enable SSH, install the hub on the Pi, or join a tunnel.

`pi-hub-install.sh --plan` prints the current limits. `--stage --dest` only writes under `/tmp` and records a receipt. `--rollback --dest` removes those receipt files and nothing else. The staged unit has no install section and its start command is `/bin/true`.

The box lock `ops/box-recover/reference/kasa-requirements.lock.txt` has 21 packages and 21 hashes. It is the x86_64 cp313 lock. The candidate `deps/kasa-aarch64-cp313.lock.txt` uses the same versions. Pure-Python wheel hashes match the box lock. The eight compiled packages have different aarch64 wheel hashes. Nothing in that file was imported on an aarch64 interpreter.

Node evidence from the runtime-matching lights process: `node:` imports and `base64url` meet at Node 14.18.0. Sensi and Spotify call global `fetch`, unflagged in Node 18.0.0. `ws@8.22.0` declares `node >= 10`. The box reports Node v24.22.1 and npm 11.21.1. The Pi's Debian node package was not read.

The wall client remains the Elo/Beelink. Whether the Beelink should host the hub instead of the Pi is an approval question, not a code requirement. See `ops/box-recover/EOD-ACCOUNT.md`.
