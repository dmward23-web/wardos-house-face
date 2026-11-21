# Actual runtime source inputs for cloud recovery PR15
Prepared 2026-11-06 17:32:00 CST. Source-only internal build inputs, not publication; no upload/send performed.

Source HEAD: `b79bf2270b47294b8e75f76d9b227df924fa3941`; existing dirty worktree: 54 tracked modifications, 3 untracked files. HEAD is context only: SHA256SUMS pins actual copied working bytes, not origin. Read-only source lookup; no checkout/fetch/reset/build/execution.

## Scan / rejection
Every copied source scanned for private-key blocks, AWS/GitHub/JWT/key markers, credentialed URLs, literal token/secret/password assignments and long encoded literals. No findings in included files. Source references to secret paths are not secret values; no referenced config/env/log/feed/token files were opened or bundled. Heuristic scan is not a security certification.

REJECTED / NOT COPIED: `scripts/sensi-control.mjs`, line 32: potential literal-secret assignment. Value intentionally withheld; not resolved safely, so excluded. This makes the bundle deliberately INCOMPLETE for starting lights-write-proxy. Cloud builder must not assume origin's sensi-control bytes equal dirty runtime. Require approved secret-safe review or a separately validated sanitized source before complete recovery gate. No literal values in this report.

## Source files
| Original filename | Source path | SHA-256 | Source mode |
|---|---|---|---|
| `private-feed.mjs` | `/workspace/wt-house-run-b79bf227/scripts/private-feed.mjs` | `9b98af043a9c8a3159a686b4076f8715e49272c75bffa1d862cb49601161b0aa` | `0644` |
| `kasa-daemon.py` | `/workspace/wt-house-run-b79bf227/scripts/kasa-daemon.py` | `385e7ccb1776f5fe4ff66edba3e2d52e42555acd4a940b7d4473794d3320d00a` | `0644` |
| `spotify-control.mjs` | `/workspace/wt-house-run-b79bf227/scripts/spotify-control.mjs` | `9da9a337802c786a35559e94d6cff28ba33791d2275e441ff33358ae2a26b907` | `0644` |
| `access-log.mjs` | `/workspace/wt-house-run-b79bf227/scripts/access-log.mjs` | `589b6677d880dd6552e69c4ee9e3178e05ed1c467e6a80579d55669e9204644f` | `0644` |
| `lights-fetch.mjs` | `/workspace/wt-house-run-b79bf227/scripts/lights-fetch.mjs` | `d6b84c89f86e2dffa8d633ff29a4958c4394e585e1dc7cf0b2d064c204c726eb` | `0755` |
| `kasa-probe.py` | `/workspace/wt-house-run-b79bf227/scripts/kasa-probe.py` | `985ccc2d50ebbf1d9f30b2f7166b9cd644b1890f52459473ea0a46d2724e394b` | `0755` |
| `lights-write-proxy.mjs` | `/workspace/wt-house-run-b79bf227/scripts/lights-write-proxy.mjs` | `ad862b3c58941eeb4764e31c02b6b81e47069cd6b8cbaf74f72fd2a30564800f` | `0755` |
| `private-dir.mjs` | `/workspace/wt-house-run-b79bf227/scripts/private-dir.mjs` | `15bfac225ff35cec179aa35e90d5148020d2e72996c05d35d8b31288fc90b2d0` | `0644` |
| `house-proc.sh` | `/workspace/wt-house-run-b79bf227/scripts/house-proc.sh` | `c4f3475e8812018f94c026b2921fe1a49946261c00e3265073acdad2cdd17ff7` | `0644` |
| `kasa-write.py` | `/workspace/wt-house-run-b79bf227/scripts/kasa-write.py` | `bb96a8a904a3cf866a33021c679edbf886a86588b9e977ca32145cc1c1d782f4` | `0755` |

## Dependency scope / unresolved
- Included requested six sources and minimal inspected local dependencies: lights-write-proxy.mjs, private-dir.mjs, house-proc.sh, kasa-write.py (dynamic import target of kasa-daemon.py / executable fallback).
- sensi-control.mjs is required by lights-write-proxy but rejected above. Its private-dir import is included.
- Static JS import specifiers outside local relative paths found: `node:child_process`, `node:crypto`, `node:fs`, `node:http`, `node:os`, `node:path`, `node:url`. Built-ins need no package artifact. No code imported/executed to discover dependencies.
- Python dynamic local target kasa-write.py included; tplinkcloud external dependency identified. Existing Kasa lock/Node lock referenced in prior TRIAGE evidence, not included here because this bundle is source only. ARM64 lock/testing remains unresolved. Full computed imports/spawn target behavior not proven by static scan.
- No Nest proxy, token, config, credential, environment, private feed data, logs, node_modules or venv included. This bundle cannot independently run services and is not a deployment artifact.

## Archive
`runtime-source.tar` contains exactly the ten source filenames above + SHA256SUMS + MANIFEST.md at archive root. No directory traversal, symlinks, private files or additional entries. Archive sha256 reported separately (not embedded circularly in manifest).

## Follow-up classification (17:32 CST)
Flagged line 32 classification: genuine potentially embedded credential; not cleared as a false positive. Evidence variable NAME: `CLIENT_SECRET`; initializer AST kind: `StringLiteral` (direct const declaration, static source-shape validation; not executed). Literal value intentionally not emitted. This is not an env-variable reference; no evidence establishes the literal as a harmless placeholder/known non-secret constant. Credential validity was not tested.

Hash-only excluded original: source `/workspace/wt-house-run-b79bf227/scripts/sensi-control.mjs`, SHA-256 `54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc`, mode `0644`. File remains EXCLUDED; no sanitized substitute or identity claim. This hash permits BOX comparison of existing bytes without transferring the original. Cloud may separately inspect canonical repository non-secret source; equivalence is NOT asserted. Other kit preparation can proceed with the existing clean sources; full lights runtime test remains dependency-blocked.
