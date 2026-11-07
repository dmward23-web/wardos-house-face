# Read-only checks if a later equality pass is needed

Do not install, start, import Kasa, or open secret files. Print hashes and names only.

```bash
RT=/workspace/wt-house-run-b79bf227
sha256sum \
  "$RT/scripts/house-proc.sh" \
  "$RT/scripts/lights-write-proxy.mjs" \
  "$RT/scripts/sensi-control.mjs" \
  "$RT/scripts/private-dir.mjs" \
  "$RT/scripts/kasa-write.py" \
  "$RT/scripts/private-feed.mjs" \
  "$RT/scripts/kasa-daemon.py" \
  "$RT/scripts/spotify-control.mjs" \
  "$RT/scripts/access-log.mjs" \
  "$RT/scripts/lights-fetch.mjs" \
  "$RT/scripts/kasa-probe.py"
sha256sum \
  /workspace/wardos-ops/hub-supervise.sh \
  /workspace/wardos-ops/kasa-requirements.lock.txt \
  /workspace/wardos-ops/deps/package.json \
  /workspace/wardos-ops/deps/package-lock.json \
  /usr/local/bin/node \
  /home/box/.local/bin/cloudflared \
  /usr/bin/python3.13
readlink -f /workspace/wardos-ops/kasa-venvs/current
readlink -f /workspace/wardos-ops/kasa-venvs/current/bin/python
test ! -e /workspace/wardos-ops/deps/node_modules/ws/package.json && echo ws-absent
VENV=/workspace/wardos-ops/kasa-venvs/venv-261024.115754.179986
SITE="$VENV/lib/python3.13/site-packages" "$VENV/bin/python" -I -S -B -c 'import importlib.metadata, os
rows = []
for d in importlib.metadata.distributions(path=[os.environ["SITE"]]):
    rows.append(d.metadata["Name"] + " " + d.version)
print("\n".join(sorted(rows)))'
```

Compare those lines to `ops/box-recover/live-equality.json`. Version names are not wheel-hash proof. Hashing `sensi-control.mjs` does not review its contents. Do not print file bodies.
