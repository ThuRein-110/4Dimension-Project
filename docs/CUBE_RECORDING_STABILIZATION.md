# Cube Recording Stabilization

2026-10-05. Baseline: 02e3306. Scope: Cube Lab tests only.

## Failure Evidence

Previously reported test:
`tests/e2e/cube-lab.spec.ts` /
"real ArUco pixels flow through webcam, worker, pose, recording and decoupled replay".

The previous suite report failed the assertion
`expect.poll(async () => (await model(page)).count).toBeGreaterThan(10)`:
expected more than 10 samples, received 0 after the 5-second polling timeout.
The prior stack pointed to the Start Recording/sample assertion at line 49.
That historical result is not a fresh reproduction or a confirmed diagnosis.

The required first isolated run on unchanged production code passed (13.3 seconds).
The full 56-test browser suite also passed before the test hardening below.
Therefore the earlier failure's root cause remains unconfirmed; no A-J category
can be assigned honestly from these successful runs. In particular, there is no
evidence here proving a production regression, stale module instance, invalid
fixture, or recording-start race. Do not claim that one has been fixed.

Future start/sample failures attach actual UI mode/sample count, imported-store
state, module resource URLs, browser errors and console output. Playwright
preserves the assertion stack and screenshot. This distinguishes an unacknowledged
start from missing worker samples or a test reading different state.

## Minimal Changes

- Wait explicitly for RECORDING acknowledgement before polling sample count.
- Replace pause/loss/playback fixed sleeps with actual processed-frame progress
  or rendered-pixel change. The same sample and movement thresholds remain.
- Assert positive duration, near-zero recording-relative first timestamp, strictly
  increasing timestamps, samples within duration, and exported JSON equality.
- Keep the real moving canvas pixels, actual marker worker, pose solver, tracking
  loss/recovery, X/Y/Z and quaternion movement, stop, playback, keyframes and import.
- Add a controlled monotonic-clock unit test for movement, loss, pause/resume,
  stop and interpolation. It does not generate extra production samples.

Production Cube Lab tracking, filtering, recording and clock code is unchanged.
The recorder already uses an injectable performance.now clock, relative elapsed
time, sample-rate limiting, validated poses and strictly chronological imports.
Automatic tracking lifecycle and explicit user recording requests are preserved.

Files changed: this report, tests/e2e/cube-lab.spec.ts and
tests/unit/cube-lab.test.ts. Research View and all analysis/cache/runtime files
remain byte-for-byte unchanged from the baseline.

## Verification

The hardened isolated moving-marker test passed (11.4 seconds).
Lint, typecheck, production build and 102 unit tests passed.
The final full browser suite passed all 56 tests (2.1 minutes), including the
moving-marker recording test (9.8 seconds).
Production smoke passed compiled clients, real marker detection, recording,
scrubbing, export/import, offline replay and keyframes.

The existing wildlife real-video check passed using the unchanged cache:
75 frames, 7 tracks, 208 masks and 40 events. Heatmaps, trajectories, temporal
ranges, graph seeking, presentation/fullscreen and desktop/mobile rendering
passed. All 15 exports passed, including decoded WebM and local H.264 MP4.
No new inference job was requested. Source-video and cache SHA256 hashes match
the pre-verification values. Private media and generated output remain local.

No physical-device marker acceptance is claimed: the browser test supplies
generated moving pixels to the real detector and pose pipeline. The historical
zero-sample failure remains unreproduced, not a confirmed production bug fix.
