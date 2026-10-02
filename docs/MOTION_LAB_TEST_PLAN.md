# Motion Lab Test Plan

## Automated Commands

- npm run check: lint, strict typecheck, Vitest and production build.
- npm run test:e2e: existing camera/phone/Cube/planner tests plus motion workflows.
- npm run test:production: compiled existing workflows and isolated camera routes.
- npm run test:motion: real local-video/model integration and render verification.

The motion CI browser suite generates a private temporary color MP4 and injects
an explicitly labeled mock worker only in the test. It verifies actual decoder
seeks, inference progress, cancellation/retry, synchronized views, manual
keyframes, ghosts, graph/table switching, JSON/PNG download and cache reload.
No synthetic pose exists in application runtime. The separate root-video test
skips when private media is absent from a checkout; it verifies actual playback,
pause/scrub, range responses and API/direct-file access restrictions.

Pure/API tests cover root-only deterministic selection, path rejection, probe
rotation/fractional FPS/duration, source identity invalidation, schema/count/order
validation, interpolation/no-gap bridging, coordinate mapping, normalized fallback,
estimated velocity, backward-compatible project references, loopback/origin/host
guards, byte ranges, validation/atomic cache writes and corrupt cache recovery.

## Real Integration

Put a person-motion clip in the root and run npm run test:motion. This uses the
real worker and real decoded frames, blocking non-local browser requests. It
checks single-frame inference, full-video samples/world landmarks, two different
scrubbed poses, changing nonblank 3D pixels, playback clock synchronization,
manual keyframe, ghost/side view, PNG/JSON export, desktop/mobile dimensions and
overflow, and persisted cache reload. Reports and screenshots live exclusively
in ignored test-results. No personal clip, pose arrays or screenshots are committed.
MOTION_URL can target a localhost production listener to verify the compiled worker.

## Manual Checks

Review 2D overlay alignment through Fit/Fill and viewport resize; portrait rotation
normalization on a rotated HEVC MOV; occlusion/missing-pose gaps; front/side/top/orbit;
manual golf keyframe semantics and club-head annotations; fullscreen source/3D/split;
reload keyframes/settings; save/open room projects with references; Local Media and
missing/corrupt source/model/cache errors. Longer-than-two-minute clips must give an
explicit limit message, not freeze. No metric/biomechanics accuracy is certified.

Regression acceptance includes Windows webcam startup/stop/source switches,
optional iPhone/WebRTC, sample/local media, Cube tracking/record/replay, manual
calibration/floor, furniture placement/transforms/measurement, layout interpolation,
comparison, project persistence and existing exports. No marker/phone requirement
is added to room or Motion Lab workflows.

## Verification Record

Verified locally on 2026-10-03: lint, strict typecheck, unit tests, production
build, all 45 browser tests and existing production smoke checks pass. Real
root-video inference also passes in development and compiled production:
65 sampled poses at 15 FPS, all with world landmarks, synchronized changing
3D pixels, desktop/mobile nonblank canvases, local exports and cache reload.
This confirms data flow/rendering, not certified biomechanical accuracy.
Integration outputs remain ignored; the verification script restores previous
manual annotations after its temporary test keyframe.
