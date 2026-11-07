# Correction map for Alfred's 17:41 CST NO-GO

Alfred reviewed archive `0a9a2328fa61a16575260093e4381e3070a2befded6ef9fe35f39f93ed0dff9e`. This file records the code changes for defects 3 and 4, and the endpoint wording. It is not a hold release. No gate file is added.

## Defect 3, ingress path

Alfred cited `hub-recover-lights.sh` accepting `--ingress-config` while `hub-supervise.sh` launches `$CFG`. Those could differ.

Now execute resolves `$CFG` with `readlink -f`, refuses if `--ingress-config` resolves somewhere else, and refuses unless the gate's `ingress_config_sha256` is the sha256 of that same file. The ingress rule check reads that resolved file. `start_connector` still receives the supervisor's `$CFG`, which is that file. A test copies a valid config to a second path and expects exit 15 with no listener.

## Defect 4, scope and rollback

Alfred cited scope creation before `take_lock`, and `stop_ours || true` reporting success when the live process no longer matched.

Scope is now written only after the lock is held, by writing a temp file that includes `run <pid>-<nanoseconds>` and then `mv` onto `lights-recover.scope`. A test profile pause lets another process take the lock first. The loser exits 19 and leaves a pre-seeded scope untouched.

Rollback no longer ignores `stop_ours` failure. If the own record matches the scope but `/proc` is a different identity, the supervisor does not signal, and this script exits nonzero. It then checks that the recorded start time, command hash, and cwd are not the live process. The new test keeps the scope line and the own file identical to each other and different from the live bystander. The bystander stays alive.

## Not changed

Sensi `security_review` stays `open`. Hash match is not a closure. The 17:43 binary pin is a fail-closed prod check only. It is not a hermetic claim and not an independent review. The Sensi AST proposal in the equality note was not implemented.
