# Test Plan

## Automated Evidence

Run npm run check, npm run test:e2e and npm run test:production.
Vitest covers tokens/expiry/roles, signal schemas/relay, hidden-directory CA
download/private-key exclusion, project round trips, invalid schemas/models,
independent layout copies and stable IDs, timeline matching/endpoints/slerp/
appearance/disappearance, distance/degenerate calibration, marker coordinate
basis, overlap, history bounds, fit/crop rectangles, atomic storage, corrupt
backup recovery and overlapping saves.

Playwright exercises real SDP/ICE/encoded WebRTC using Chromium synthetic camera
tracks, decoded nonblank frames, FPS/resolution, signaling interruption,
stop/reconnect/reload, certificate validation without TLS bypass, source/media
regressions, Fit/Fill/capture/setup, responsive phone/desktop, transparent grid
pixels, model transforms/history, ghost placement/manual reference/measurement,
state duplication, visible fractional timeline motion, compare/export, real
generated-marker detection/confirmation and disk-backed project reopen.

Screenshots are in test-results. Production smoke starts isolated ports, checks
compiled clients/assets/QRs and planner behavior, and closes its host. Browser
simulation does not establish physical iPhone/Safari or real-room accuracy.

## Physical Device Matrix

Primary acceptance is now fixed Windows webcam plus manual calibration, not
iPhone/marker availability. webcam-planner.spec.ts blocks session allocation and
verifies zero signaling sockets and marker workers while calibrating, placing,
moving/rotating/scaling, measuring, creating T0/T1/T2, interpolating, playing,
comparing, exporting and recalibrating without losing room content. Permission
denial/retry/Stop is covered separately. Chromium synthetic capture tests do not
replace a physical Windows webcam, fixed mounting and tape-measure validation.

Record all outcomes in PHYSICAL_ACCEPTANCE.md; none are assumed passed.
Use iPhone 16e Safari and Windows 11 Chrome/Edge on the same private LAN.

- Install/trust the correct public CA; QR opens HTTPS camera with valid pairing.
- Rear/environment preference, permission allow/deny/retry, camera switch and Stop.
- Moving live frames, measured resolution/FPS and glass-to-glass latency.
- Portrait/landscape dimensions, Fit/Fill/fullscreen and PNG output.
- Stop/restart, reload, lock/background, Wi-Fi dropout/change and reconnect.
- Wrong/expired credentials and second-phone role exclusion.
- Print at actual size; measure marker edge; find/track/loss/reacquire under varied
  light, distances and viewing angles. Verify no uncontrolled pose jumps.
- Manual A/B/C known distance and corrections with fixed camera; reject degeneracy.
- Place/select/move/rotate/scale/duplicate/delete/lock/visibility/history.
- Tape-measure comparison at several floor spans; report absolute and percent
  error, not architectural accuracy.
- Project save, host restart, reopen, backup recovery and JSON import/export.
- T0/T1/T2 matching object motion, shortest-path rotation, scale, visibility and
  existence; scrub/play/pause/previous/next; camera stays live.
- Compare/raw camera/wipe/split/toggle and composite/3D-only exports.
- Disconnect retains room data; onboarding and controls usable at desktop/mobile.
- Modest and larger model counts: record GPU, browser, render FPS and vision cadence.

Current development acceptance requires actual moving Windows webcam frames and
the complete manual editing/save/reopen/temporal demo with a fixed mount.
Physical iPhone/marker checks are secondary and do not block webcam development.
Automated checks support, but do not replace, hardware and accuracy validation.
