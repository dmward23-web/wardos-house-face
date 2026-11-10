# Pi v7 correction map

Frozen and not rebuilt:

- Pi v6 `eca2d0528b1fecb044ba4c97eeab759d4949d100dd6f442e40f6fcf02ed7430f` (491520 bytes)
- Pi v5 `8fb6a233bf982c7721b869fcc52881c3dad6e0175c2cd49303830252804be915`
- recovery v5 `d9a5b52eb6d43f412f838c01b4e15f88751d4ba2bca63e2353c6a234438c5ac5`
- payload `c06f47bbaf05b92034eedcedd07b97444437ad4e6a96e441b27286c1fb928bed`

Twenty-one cloud mock tests passed in this checkout. They are not an independent verification. qemu-aarch64 was not run. systemctl was not invoked. This packet is not operationally ready, not ARM proof, and not native systemd proof.

## 1. The installer does not tamper

`WARDOS_PI_TAMPER_REL` is refused before the install creates any file. The installer does not append to that path. Changed-byte, symlink, and `../` receipt cases are in `qa/pi-cleanup-harness.sh`. That harness runs only when `WARDOS_PI_FIXTURE=isolated` and the prefix is not `/opt/wardos`. `WARDOS_PI_INSTALL_FAIL_POINT` is refused unless the same isolated fixture flag is set, the profile is fixture, and the prefix is not `/opt/wardos`. Those checks happen before the install writes.

Cleanup still removes a registered file only when the path is inside the prefix, is a regular file, and the bytes match. A symlink is named `RESIDUE` and is not removed. A `../` or absolute receipt path is refused and is not removed. Temp files that cannot be removed are named `RESIDUE`. The receipt and the created directories can remain.

## 2. Observation failures stay inside the transaction

Pre-mutation refusals still exit immediately. After a command is attempted, show, proc, and is-enabled/is-active failures raise a transaction error instead of `SystemExit`. Each attempted row is reversed on its own. One row's query failure does not skip earlier rows. A row that cannot be reversed is `RESIDUE`. The result is `REFUSE systemd reversal incomplete`, or `REFUSE systemd reversal failed` when a reversal command itself returns nonzero. It is not described as reversed.

## 3. Ownership is the start invocation plus a fresh tuple

A start is owned only when that start command prints `INVOCATION=<id>` and a later show still has the same id, the staged fragment, user, and argv, and the same pid, start time, and argv. A pid that appears only on a later show is not recorded as the transaction's process and is not stopped. Immediately before `disable --now`, the same tuple is read again. If a live pid does not match, the command is not issued and the row is residue.

The fresh show and the following stop or `disable --now` are still two controller calls. A change in that gap is not prevented. The code refuses the destructive call when the fresh show does not match, and it does not claim the pair is atomic. A controller that does not print `INVOCATION=` on start, including real `systemctl`, cannot prove ownership. The start is residue and is not stopped. The mock that prints the token is not systemd.

## 4. The preflight result is a same-directory rename

The JSON is written to a regular file in the result directory, closed, and set to mode 0644. It is then renamed onto the result path. A failed write leaves the previous file and removes the stage, or names the stage `RESIDUE` if it cannot be removed. A symlink result is refused before that write. A mode 0600 secret is not changed.

## 5. Still open

Opaque Sensi, the full `:8788` surface, cached stills, remote policy, provisioning, and a real aarch64 import remain separate holds. This packet does not close them and does not start a wall or phone flow. Home and PR 14 were not changed.
