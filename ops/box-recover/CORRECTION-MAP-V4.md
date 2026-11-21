# V4 correction map, Alfred 17:53 CST NO-GO

V3 archive `989df41936b209963c0ddeb92603a4705261b556cf09afe8abb26d69be559463` is unchanged. This map is for the next archive only. Targeted mock tests of these two gaps were run in this checkout. They are not an independent verification, and they are not a request to run the suite or npm under a static-only review.

## Gap 1, actual executable binding

Alfred cited `recover_check.py` hashing fixed paths, `venv_ok` importing before that check, and dependency mode never calling it. `command -v` / PATH `node` and the venv Python were not the files being hashed.

`bind-exec` now resolves the `node`, `cloudflared`, venv `python`, and, for dependency mode, `npm` that the current PATH and venv path would actually use. It compares real path and sha256 to the 17:43 pins in production, or to the test's expected hashes. A symlink or an earlier PATH entry that is not that file is refused. The check only reads bytes. It does not execute the file. Production then narrows PATH to the pinned directories. `venv_ok` and `npm ci` run only after this returns. A metadata version list is still not installed wheel-code proof. The checker says so.

## Gap 2, run-bound rollback

The scope file already stored `run <id>` and rollback skipped that line. Rollback now requires both `--run-id` and gate field `rollback_run_id`, and both must equal the id in that scope file. A different id does not stop the processes recorded for another run. Stale live identity still returns nonzero and does not signal the replacement.

## Left open on purpose

Opaque Sensi acceptance remains residual risk. `security_review` is not set to closed. Cached stills, the rest of the `:8788` authority, and remote ingress policy stay open. No hold release is in this archive.
