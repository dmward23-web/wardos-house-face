# Lights recovery review

The ten runtime source pins are filled. This recovery package is ready for independent review. It is not cleared to execute. Cached stills are undecided. Atlas's 17:11 hold still stands. This document does not ask for a user step.

`scripts/sensi-control.mjs` is not a missing parent file. Its sha256 `54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc` is the opaque pin of the existing box file. An independent gate may accept that hash. This package does not lift the security review, and it does not rewrite the file. `--execute` refuses until the gate says `sensi_opaque` is `accept-existing-hash`.

`scripts/sensi-control.mjs` is pinned only by sha256 `54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc`. Line 32 is an embedded CLIENT_SECRET string literal. The file is not in this artifact, and this recovery does not rewrite or rotate the existing box file. That security review stays open.

## What a start would expose

Starting the existing `lights-write-proxy.mjs` on `127.0.0.1:8788` is not a lights-only or calendar-only start, and it does not start camera capture.

The runtime file `ad862b3c58941eeb4764e31c02b6b81e47069cd6b8cbaf74f72fd2a30564800f` already mounts `/api/private/` before other routes. The same device key covers pair mint, taps, Sensi read and set, Spotify routes other than the PKCE exchange, and lights read, set, and refresh. A comment that mint is Dad-only is not a separate role. CORS origins are not a key. This package does not add or remove routes.

Unauthenticated exceptions on that same process: `GET /health` and `GET /api/health` return only ok and the service name; OPTIONS is public; `POST /api/pair` redeems a rate-limited single-use code and returns the shared key; `POST /api/spotify/exchange` uses the pending PKCE state before the general key check.

Private feed can serve cached camera stills that are already on disk at `/api/private/nest/<slug>.jpg` to a holder of that same device token. Parked camera capture is not a privacy boundary for those files. No still inventory was inspected. The gate decision is still open:

- `cached_stills: allow-existing` accepts this existing sharing model.
- `cached_stills: hold`, or no value, makes `--execute` refuse. Routes stay as they are.

An authenticated lights write or `POST /api/lights/refresh` can run the existing `lights-fetch.mjs` path and write private `lights-live.json`. The start itself does not call that path. That file's runtime hash is now pinned.

## Ingress

`ingress-review.json` records the sanitized local config check: `cams.wardhousehub.com` to `127.0.0.1:8787`, `lights.wardhousehub.com` to `127.0.0.1:8788`, then `http_status:404`. Execute validates that shape on the resolved file cloudflared is launched with. `--ingress-config` must be that same path, and the gate must bind that file's sha256. A different file is refused. Credential values were not read. This is not remote Cloudflare policy, and it does not prove that no other host exists. A 17:43 CST read-only snapshot matched the eleven runtime hashes and four reference files, and recorded node, cloudflared, and Python binary hashes. Prod execute refuses if those three binaries differ. That check is not hermetic, not an independent review, and it does not close the Sensi review. Installed package versions matched the 21 lock pins plus extraneous pip 25.1.1. Version names are not proof the installed files match wheel hashes. ws was absent. No install was done.

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
