# Lights recovery review

This package is not gate-ready to execute. The runtime pin is incomplete, and cached stills are undecided. Atlas's 17:11 hold still stands. Nothing here asks Dan to approve an unready action.

`scripts/sensi-control.mjs` is pinned only by sha256 `54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc`. Line 32 is an embedded CLIENT_SECRET string literal. The file is not in this artifact, and this recovery does not rewrite or rotate the existing box file. That security review stays open.

## What a start would expose

Starting the existing `lights-write-proxy.mjs` on `127.0.0.1:8788` is not a lights-only or calendar-only start, and it does not start camera capture.

The runtime file `ad862b3c58941eeb4764e31c02b6b81e47069cd6b8cbaf74f72fd2a30564800f` already mounts `/api/private/` before other routes. Under the existing device-token rules it also serves pairing (`/api/pair`, `/api/pair/mint`), taps, Sensi read and set, Spotify auth, setup, library, control, and disconnect, and lights read, set, and refresh. CORS origins are not a key. This package does not add or remove routes.

Private feed can serve cached camera stills that are already on disk at `/api/private/nest/<slug>.jpg` to a holder of that same device token. That is separate from starting `nest-webrtc-proxy.mjs`. The gate decision is still open:

- `cached_stills: allow-existing` means the independent gate accepts that existing behavior.
- `cached_stills: hold`, or no value, makes `--execute` refuse. Routes stay as they are.

An authenticated lights write or `POST /api/lights/refresh` can run the existing `lights-fetch.mjs` path and write private `lights-live.json`. The start itself does not call that path. `--execute` still refuses until that file's runtime hash is pinned, because the process contains the path.

## Ingress

`ingress-review.json` records the sanitized local config check: `cams.wardhousehub.com` to `127.0.0.1:8787`, `lights.wardhousehub.com` to `127.0.0.1:8788`, then `http_status:404`. Credential values were not read. The credential file was reported as mode `0400`. This does not prove remote Cloudflare policy, and it does not prove that no other host exists.

Starting the two existing connectors would restore both hostnames. The cams hostname would point at an empty `:8787`. A public cams health failure is not a reason to start the camera proxy.

## Provenance

Run tree `/workspace/wt-house-run-b79bf227`, HEAD `b79bf2270b47294b8e75f76d9b227df924fa3941`. That commit is not in `origin/main`. The worktree is dirty: 54 tracked modifications and 3 untracked files. HEAD is not a full pin. Pre-reboot `b71` is a historical report, not proof of what the reboot stopped. PR 14 is the open Sunday Home branch, not this runtime.

The clean runtime bundle `46bc87d451344e3c0c1c66748236bea0a36946175ed5df58558acef03752b4d1` replaced `e72743c81c4ea2cfce6fe6be5bf1dcf17b1491e0d08981ed51b9918e6b47e91d`. Its ten source files are under `runtime-src/` and match `MANIFEST.json`. `--execute` still refuses while the Sensi security review is open, before it opens that file.

The box Kasa lock has 21 package declarations and 21 `--hash` entries. An earlier note that said 22 hashes was wrong. Recovery does not rebuild that venv.

## Commands

Default:

```bash
ops/box-recover/hub-recover-lights.sh --plan
```

That prints the exposure and exits. It does not download or start anything.

These exist and stay refused without a gate file that matches this script and the manifest:

- `--execute-deps` runs only `npm ci --ignore-scripts --no-audit --no-fund --prefix <DEPS>` after the lock hashes match.
- `--execute` is the one pass: current Kasa venv, lights on loopback, then the supervisor's existing r1 and r2 connector start. It records new own identities only.
- `--rollback` stops only the lights, r1, and r2 identities in `lights-recover.scope`, and only when the supervisor own record still matches. It does not use a pattern kill. It does not call `--stop-own`, because that stops every recorded service, including cameras if a record exists. It does not remove `node_modules` or logs.

Prod execution also refuses unless the live supervisor file is already present and `WARDOS_RECOVERY_ALLOW_PROD=hold-release-lights-recover-1`. This checkout does not set that, and it does not create `/workspace/wardos-ops`.

## Tests

```bash
node --test --test-concurrency=1 ops/box-recover/qa/recover.test.mjs
```

The mock uses the test profile inside `/tmp`. It does not join `wardos-hub`. It covers a clean mock start, log scrub of a fixture secret, rollback, a foreign listener, a stale own record, a partial connector failure, a replaced identity, a tampered file, a missing gate, a cached-stills hold, and the separate `npm ci` step.

## Still unmet before any box command

- Runtime hashes, and the dirty-file bytes, in `PARENT-FILE-REQUEST.txt`.
- An explicit cached-stills decision.
- Independent gate file. This repo does not contain one.
- The single hold release. Not requested here.
