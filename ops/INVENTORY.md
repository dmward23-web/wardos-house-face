# Inventory, 2026-11-06

Box and Pi stay held. No user step is being asked for with this update.

## Recovery: corrected, still not cleared to execute

Alfred's 17:41 NO-GO defects 3 and 4 are corrected in this tree: the launched tunnel config and the reviewed file are the same resolved bytes, and rollback no longer reports success when the live process is a different identity. See `ops/box-recover/CORRECTION-MAP.md`. A 17:43 read-only snapshot matched the eleven runtime hashes and four reference files. Prod execute refuses if the recorded node, cloudflared, or Python binary hash differs. That is not a hermetic proof and not an independent review.

The ten runtime source pins are filled. Static imports and spawns stay inside that set plus `scripts/sensi-control.mjs`. `scripts/text_law.py` is a comment in `private-dir.mjs`, not a lights import. No parent source file is still missing.

Sensi is an opaque hash, `54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc`. An independent gate may set `sensi_opaque` to `accept-existing-hash`. The security review stays open. The file is not in the tar and the box file is not rewritten.

Execute stays refused until that acceptance and a cached-stills decision are in the gate. This checkout does not supply that gate.

## Pi: incomplete

The service, install, and startup commands are real. Plan and offline-verify are the defaults. Activation checks a gate and then execs the lights proxy and the two tunnel connectors. Units have an install section and are written disabled (`etc/units-enabled` is `no`). Install root `/opt/wardos` is accepted. `/etc`, `/home/dan`, and `/workspace` are refused. Rollback removes only the receipt, including symlinks.

Still incomplete: the aarch64 import has not been run, so the venv command refuses on this machine. A wheel hash is not an install. Sensi is not in the Pi tree. No tunnel was joined and no SSH change was made. Do not treat the Pi kit as finished.
