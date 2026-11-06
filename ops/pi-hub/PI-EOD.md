# Pi packet note, 2026-11-06

The recovery archive `989df41936b209963c0ddeb92603a4705261b556cf09afe8abb26d69be559463` was left unchanged for Alfred's re-review.

This note is the Pi account. It does not decide that no person will ever have to do anything. No step is being asked for now because this packet is not an install and not an activation. SSH on wardos-pi is still off, the hub tree is not on the Pi, and the aarch64 import has not been run. A later install would need a person at the Pi, or another approved path, before `/opt/wardos` can be written there. That is not requested here.

The obsolete stub tar `88515c6c2960cef0a999a9678e750b99f20c97472f9a9e6416f0a6009a0dbbba` is not the current Pi packet.

`sensi-control.mjs` is excluded. Its opaque hash remains `54f8715454d1e4e851ffd2ead6d87ddbaed204368b63c7d74e2b4c4fe0c58ffc` with the security review open. Starting the real lights proxy would expose the full existing `:8788` surface, including unauthenticated health and OPTIONS, pairing-code redeem, Spotify PKCE exchange, and cached camera stills under the shared device key. This packet does not start that process and does not join a tunnel.
