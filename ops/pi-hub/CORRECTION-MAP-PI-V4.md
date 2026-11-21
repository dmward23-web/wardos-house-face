# Pi v4 correction map

Frozen and not rebuilt:

- recovery v5 `d9a5b52eb6d43f412f838c01b4e15f88751d4ba2bca63e2353c6a234438c5ac5`
- Pi v3 `fe9798daff4e40776440339060baba3565ea18148759a4abb08fd52023f5e9b2`
- payload `c06f47bbaf05b92034eedcedd07b97444437ad4e6a96e441b27286c1fb928bed`

Sixteen cloud mock tests passed in this checkout. They are not an independent verification. qemu-aarch64 was not run. No systemctl on this machine was invoked. The preflight JSON is not an authenticated record and is not ARM approval.

## 1. Profile and tested venv

`exec_profile` allows only `target` and `fixture-stub`. Any other value is refused. `target` requires this machine to be aarch64, schema `wardos.pi-preflight.result/1`, both pip and import exit 0, the lock and wheelhouse digests, and the recorded `venv_python` to be `venv_path/bin/python` inside the prefix. The lights process exports that path. It does not use `prefix/venv/bin/python`. `record_is_authentication` and `arm_execution_approved` must stay false.

## 2. Containment

Before preflight, rollback, and result writes, every existing ancestor from the prefix down is checked. A symlink child or parent is refused. Link receipt rows are allowed to be the symlink itself; their parents still have to stay inside the prefix. The receipt is opened before the install copies. A failed install removes only the contained paths already listed. Rollback still checks every row before it deletes any file.

## 3. Payload, wheels, ws, permissions

Target install refuses to finish without the payload. It copies `bin/node` and `bin/cloudflared` as mode 0755 and the 21 wheels into `deps/wheelhouse` as mode 0644, after the manifest hashes match. It does not run them. `NODE_PATH` is `prefix/vendor`, which is where `ws` is copied. That is the search path, not an observed crash and not a Sensi review. Directories the service must traverse are mode 0755, not whatever umask 077 would leave. A target install refuses a missing account and refuses root. The ten runtime sources stay hash-checked before copy. Sensi is not in the packet.

## 4. Units

The systemd gate accepts a fragment only when it is the unit file under that prefix. `show` must report the same path, the same User, and an ExecStart that contains the unit's ExecStart. A drop-in path and a non-zero MainPID are refused. Every unit is checked before the first enable, start, or disable. If a later action fails, the units already changed are `disable --now`'d. File rollback is not that reversal.

## 5. Still open

Opaque Sensi, the full `:8788` surface, cached stills, remote policy, provisioning consent, and a real aarch64 import remain separate holds. This packet does not close them.
