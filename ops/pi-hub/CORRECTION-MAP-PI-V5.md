# Pi v5 correction map

Frozen and not rebuilt:

- recovery v5 `d9a5b52eb6d43f412f838c01b4e15f88751d4ba2bca63e2353c6a234438c5ac5`
- Pi v4 `e9d1ec8b866f10febf43d5cf2bf443328bc621190d3eb614239d48d50544952d`
- payload `c06f47bbaf05b92034eedcedd07b97444437ad4e6a96e441b27286c1fb928bed`

Eighteen cloud mock tests passed here. They are not an independent verification. qemu-aarch64 was not run. systemctl was not invoked. This packet is not operationally ready.

## 1. Venv launcher

Preflight creates the venv with `python3 -m venv --copies` and refuses if `bin/python` is still a symlink. The record stores that launcher path as `venv_python` and the same file's realpath as `base_interpreter`. The gate exports the launcher. A record that names an outside interpreter, such as `/usr/bin/python3`, is refused. `fixture-stub` is refused on `/opt/wardos` and requires `fixture_root` plus the sha256 of the stand-in proxy. The JSON file is still not an authenticated record and not ARM approval.

## 2. Nonroot readability

After staging, directories are mode 0755 and non-secret files are mode 0644, including `hub.env`, `run/scripts`, `vendor/ws`, and the venv tree. A mode 0600 secret file is left unreadable. A fixture ran those checks as `nobody`, not as the user who created the tree.

## 3. Cleanup

Each installed file and link is registered when it is created. An explicit failure runs that list: a file is removed only when its parent is inside the prefix and its bytes match, and a link is removed only when its parent is inside the prefix and its text matches. Rollback still checks every row before deleting anything.

## 4. Service reversal

A live MainPID is accepted for service rollback only when the pid, start time, and argv match the approved identity. Any other live pid is refused. The effective command is compared as argv after `%i` expansion, not as a raw substring of the template. Prior enabled and active state is read before any change. The action is recorded before it runs. Enable is reversed with `disable`, not `disable --now`. If a reversal command fails, the result says reversal failed and does not say the action was reversed.

## 5. Still open

Opaque Sensi, the full `:8788` surface, cached stills, remote policy, provisioning, and a real aarch64 import remain separate holds. This packet does not close them and does not start a wall or phone flow.
