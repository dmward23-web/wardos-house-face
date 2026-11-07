# V5 correction map, Alfred v4 installer-selection NO-GO

V4 archive `a53f8462d1f696c65d49249e80cf36bdec201ad2ac13f71ef27f295929f11696` is unchanged. V3 archive `989df41936b209963c0ddeb92603a4705261b556cf09afe8abb26d69be559463` is unchanged. The Pi offline payload was not rebuilt for this fix. Targeted mock tests of this gap were run in this checkout. They are not an independent verification, and they are not a request to run npm or the suite under a static-only review.

## Installer selection

Alfred cited `hub-recover-lights.sh` hashing npm on the inherited PATH and only afterwards replacing PATH, while `run_deps` invoked bare `npm`. Those can be different files.

Production now sets `PATH` to `/usr/local/bin:/usr/bin:/bin:/home/box/.local/bin` before `node`, `cloudflared`, venv `python`, and `npm` are resolved. That assignment is not repeated after the check. The checker returns the canonical `NODE`, `CF`, and `NPM` paths it hashed. `CF` becomes that returned path. Dependency install runs `"$BOUND_NODE" "$BOUND_NPM" ci ...`, so the npm shebang and a later PATH lookup are not the selector. A test where the inherited PATH and the final PATH name different npm files refuses before `npm ci`, and neither decoy is executed.

## Analogous check-then-rewrite paths

- The old second assignment of `CF` to a literal path is gone. The value is the path the check returned.
- Bare `npm` in this entry point is gone. The supervisor's own `ensure_deps` and `ensure_venv` functions are not called here, and that supervisor file is not edited.
- The lights process still reaches `node` through `PATH` inside the existing `house-proc.sh`. That PATH is the one used for the check and is not rewritten afterwards. This package does not edit `house-proc.sh`.
- Checker invocations after the PATH assignment use the absolute `python3` captured before the first checker run. A PATH change cannot select a different helper.

## Bootstrap interpreter

That absolute `python3` is a trusted prerequisite. It is not compared to a box pin. This package does not claim that every interpreter is pinned.

## Left open on purpose

Opaque Sensi acceptance remains residual risk. `security_review` stays open. Cached stills, the rest of the `:8788` authority, remote ingress policy, and installed wheel or package-byte equality stay open. No hold release is in this archive.
