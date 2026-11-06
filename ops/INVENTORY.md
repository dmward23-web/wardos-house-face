# Inventory, 2026-11-06

Not gate-ready to execute. No hold release is requested.

## Ready for review

- Box recovery plan, exact-identity rollback, and mock tests. Default mode does not start processes.
- Sanitized ingress review: two hostnames and a 404 fallback. Other hosts are not proven absent.
- Clean runtime bundle `46bc87d451344e3c0c1c66748236bea0a36946175ed5df58558acef03752b4d1`: ten source files pinned in `ops/box-recover/runtime-src/`.
- Kasa lock count corrected to 21 packages and 21 hashes.
- Pi plan, offline-verify, install, and rollback. Activation is a separate command and exits 78.
- Aarch64 wheel hashes for the same 21 versions, listed with filenames. Import on Trixie arm64 was not run.

## Not ready

- Execute on the box. The Sensi security review is open, so the pin is incomplete.
- `scripts/sensi-control.mjs` bytes. The allowed pin is sha256 `54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc` only. The file is not in the distributable tar. The existing runtime file is not rewritten.
- Cached-stills decision.
- Independent gate and the single hold release.
- ARM import. A wheel hash is not a successful install.
- Pi service activation, SSH, tokens, and tunnel join.
- Proof that no other hub host exists. That was not shown.

## Holds that remain

Cached stills: undecided. Sensi: hash-only until a secret-free integration or an independent acceptance of the opaque hash. ARM import: not tested. Box start: not allowed from this checkout.
