# Pi v6 correction map

Frozen and not rebuilt:

- Pi v5 `8fb6a233bf982c7721b869fcc52881c3dad6e0175c2cd49303830252804be915` (460800 bytes)
- recovery v5 `d9a5b52eb6d43f412f838c01b4e15f88751d4ba2bca63e2353c6a234438c5ac5`
- payload `c06f47bbaf05b92034eedcedd07b97444437ad4e6a96e441b27286c1fb928bed`

Twenty cloud mock tests passed in this checkout. They are not an independent verification. qemu-aarch64 was not run. systemctl was not invoked. This packet is not operationally ready and is not ARM proof. `MANIFEST.json` still describes the older functional-review record. That status is not an approval.

## 1. hub.env is registered only after the payload check

`etc/hub.env` is composed in a temp file outside the prefix. Payload hashes and the node archive member are checked before that file is installed. The installed file is registered once, with the hash of those final bytes. A hash failure leaves no `etc/hub.env`. A failure after `hub.env` and `cloudflared` are registered removes both, and does not copy `node`.

Cleanup removes a registered file only when the path is inside the prefix, is not a symlink, and the bytes still match. A link is removed only when its parent is inside the prefix and the link text still matches. A path that no longer matches is named `RESIDUE` and is left in place. The receipt file and the directories created for the prefix are not removed. Temp payload and env files created by that attempt are removed. A failed cleanup says `REFUSE cleanup incomplete`.

## 2. Service queries and reversal

`is-enabled` is accepted only as `enabled` with exit 0 or `disabled` with exit 1. `is-active` is accepted only as `active` with exit 0 or `inactive` with exit 3. `activating`, `deactivating`, `reloading`, and `maintenance` are refused as transitional. Any other text, exit code, permission failure, or connection failure is refused. Those checks happen before any enable, start, stop, or disable.

A start attempt records the invocation, and when a MainPID is present it records the pid, start time, and argv. Reversal of that start reads the unit again. A different pid or argv is `REFUSE systemd replacement` and is not stopped. After a stop, the active state is read again. Exit 0 from the stop command is not treated as restored. If the restored enabled or active state does not match the prior observation, the result is `REFUSE systemd reversal failed`.

`WARDOS_PROC_ROOT` is used only when `WARDOS_SYSTEMD_FIXTURE=isolated` and the prefix is not `/opt/wardos`. Without that flag, or on the production prefix even with the flag, the override is refused before any unit command.

## 3. Preflight result publication

The non-secret preflight JSON is written to a temp file and installed as mode 0644. Its parent directory is mode 0755. A mode 0600 secret placed beside that tree is not changed. A fixture with umask 077 showed `nobody` can read the result and cannot read the secret.

## 4. Still open

Opaque Sensi, the full `:8788` surface, cached stills, remote policy, provisioning, and a real aarch64 import remain separate holds. This packet does not close them and does not start a wall or phone flow. Home and PR 14 were not changed.
