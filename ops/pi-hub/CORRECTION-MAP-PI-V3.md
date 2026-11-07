# Pi correction map after independent review v2

Frozen and not rebuilt:

- `pi-hub-offline-prep.tar` `0c2b88f7a5a8b2484a01a52d1d1bcf8c257a8b18aacd62825490e0361003da3d`
- `pi-offline-payload.tar` `c06f47bbaf05b92034eedcedd07b97444437ad4e6a96e441b27286c1fb928bed`

That payload's outer mode is 0666. This packet does not restore those modes. Node and cloudflared bytes stay in that payload. This packet does not claim they were executed.

Mock tests of these corrections ran in this checkout. They are not an independent verification and they are not an aarch64 execution.

## 1. Self-contained runtime

The ten clean runtime sources are in `runtime/` with `SHA256SUMS`. Install hashes each file before it copies, from that directory, not from another checkout. `vendor/ws` is the `ws@8.22.0` tree from `npm ci --ignore-scripts`, also hashed before copy. `sensi-control.mjs` is not included. `hub.env` records `SERVICE_USER`, `SERVICE_HOME`, `LIGHTS_TOKEN_FILE`, `KASA_VENV_PYTHON`, and the Kasa credential paths. It does not create those secret files. The lights command passes `--token-file` and exports `HOME` and `KASA_VENV_PYTHON`. When `WARDOS_PI_PAYLOAD` points at the frozen payload, install checks the Node archive and the cloudflared binary against `OFFLINE-MANIFEST.json` and copies them to `bin/node` and `bin/cloudflared` as mode 0755. It does not run them. The `.deb` stays in the payload as the other packaging of the same binary.

## 2. Preflight

A result is success only when pip and import both exit 0. `aarch64_import_proven` is true only when that happens on aarch64. A file that claims aarch64 on another machine is refused. A pip failure with import exit 0 is refused. The x86 pure-Python fixture records a successful import and `aarch64_import_proven: false`. The aarch64 wheels on this host record a pip failure. Neither is ARM proof.

## 3. Prefix and cleanup

The destination is canonical. `..` and a symlink ancestor are refused. Install requires an empty prefix. Rollback checks every receipt row before it deletes any file. Preflight creates a new directory under `preflight-venvs/` and does not `rm -rf` a configured venv path. Copied sources and ws files are mode 0644. Scripts are mode 0755.

## 4. Holds that stay open

Sensi presence is not approval. The real proxy still requires the opaque hash and `sensi_opaque=accept-existing-hash`, and the review stays open. `privacy_consent=full-8788-accepted` is a gate slot, not a decision supplied by this packet. `provisioning=not-performed` stays the install state. Remote policy is not reviewed here.

## 5. Units and tunnels

Enable, start, and service rollback require the staged unit path and its sha256, and `FragmentPath` must be that file. Any `tunnel:` name in the config needs `cutover=approved`, the same name, and the config sha256. File rollback does not stop a process. The runbook now says enable and start are conditional and that the units have `[Install]` and `Restart=on-failure`.
