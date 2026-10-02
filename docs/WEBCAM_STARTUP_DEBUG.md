# Windows Webcam Startup Audit

Historical first-fix audit. The current native AbortError investigation, device
picker, isolated raw test, stricter fallback, acquisition watchdog and real HP
hardware results are in [WEBCAM_NATIVE_TIMEOUT](WEBCAM_NATIVE_TIMEOUT.md).

2026-10-02. Scope: normal Windows webcam startup only. Cube Lab detector,
tracking, pose filtering and recording code are unchanged.

## Confirmed Failure Boundary

A physical-hardware Chromium probe, without fake-device flags, rejected the
original preferred `getUserMedia` request with:

```text
NotReadableError: Device in use
```

The updated app's physical probe reports the same browser exception, now with
actionable guidance and the original name/message in Camera diagnostics. No
stream was returned, so attachment, metadata, playback and FPS cannot be
physically accepted yet. The probe does not close competing camera applications.
The browser identifies a capture-access failure, not the owning application.
Whether another application, browser capture, virtual-camera service or driver
is responsible is not established by this evidence.

The user's `Timeout starting video source` text did not come from a timer in
the old desktop app: there was no webcam startup timeout there. Its catch displayed
the browser's message verbatim but discarded the exception name. That historical
exception name cannot be recovered from the UI text alone. The AbortError case
with that exact message is covered explicitly by a browser regression test.

## Original Implementation Findings

- `getUserMedia` used ideal width 1280 and height 720, not exact constraints.
  Resolution requirements were not a demonstrated cause of the hardware failure.
- There was no saved device ID or device enumeration in the desktop implementation.
- Start was gesture-triggered, not effect-triggered. React StrictMode did not
  automatically request the camera twice.
- The only guard was a rendered disabled button and a generation counter. Source
  switching reset Starting immediately while an uncancellable browser request
  could still be pending, allowing a new request before the old one settled.
  Late streams were stopped, but only after acquisition returned. This is a
  concurrency gap, not evidence that two physical streams caused this incident.
- `webcamStarting` ended immediately after acquisition, before attachment or
  playback. A separate effect assigned `srcObject` and called `play()` without
  explicitly waiting for metadata, dimensions or playback success.
- Normal stop/switch/unmount did stop known webcam tracks. There was no confirmed
  permanent leak of an acquired webcam stream, but detachment relied on a later
  React effect, and rejected playback left acquisition active.
- FPS was already measured from video frame callbacks. It naturally stays zero
  when acquisition fails; it is not itself the startup cause.

## New Lifecycle

`WebcamController` owns acquisition, tracks and video attachment. The constructor
has no capture side effects; the Start/Restart gesture is the only acquisition
entry point. Start acquires a synchronous promise lock. Repeated calls share it.

1. Stop owned tracks, detach the video and reset camera status.
2. For a live restart, wait 150 ms for device release.
3. Check secure context/media API, query permission where supported, and validate
   an optional saved device preference against enumerated video inputs.
4. Request ideal 1280x720 / 30 FPS, audio off. A stale device preference falls back
   to the first enumerated input; device ID is ideal rather than mandatory.
5. After a settled OverconstrainedError, NotFoundError or non-busy AbortError,
   retry once sequentially with `video: true`. Permission/security/busy failures
   are not retried. Never issue overlapping requests.
6. Persist the actual acquired device ID, attach to the viewport video, and await
   nonzero metadata dimensions.
7. Await `video.play()` plus usable playback; only then show LIVE.
8. Keep normal frame-based FPS measurement running, without per-frame logs.

There is no app timeout over an unanswered permission/acquisition request.
Independent 10-second metadata/playback guards start only after a stream exists.
Their errors explicitly identify the failing stage. Each timer and event listener
is cleared on success, cancellation or failure, and failed attachment/playback
releases all camera tracks. A source switch/unmount cancels the current generation;
any late-acquired stream is immediately stopped. The request lock remains held
until that browser request settles. Planner mode changes retain the same camera
workspace/video intentionally; switching sources or unmounting releases webcam
capture without breaking webcam-first calibration/timeline workflows.

## Files

- `apps/desktop-web/src/DesktopApp.tsx`: lifecycle integration, Start/Stop/Restart,
  source detachment and unmount cleanup; phone/file playback kept separate.
- `apps/desktop-web/src/webcam/WebcamController.ts`: single owner, cancellation,
  constraints/device fallback, stage timers, errors and transition logs.
- `apps/desktop-web/src/webcam/WebcamDiagnostics.tsx` and `styles.css`: collapsed
  permission/device/request/track/dimensions/readiness/playback/error diagnostics.
- `tests/unit/webcam.test.ts`: lock, cancellation/late-stream cleanup, metadata
  and playback timers, delayed playback, disconnect and raw-error handling.
- `tests/e2e/webcam-startup.spec.ts`: real browser media lifecycle using Chromium's
  test camera, nonblank pixels/FPS, source switches, concurrency and error cases.
- `scripts/check-webcam.ts` and `package.json`: separate camera-only hardware
  acceptance command, `npm run test:webcam`, without marker detection.
- This report, `PROGRESS.md` and `PHYSICAL_ACCEPTANCE.md`: evidence and remaining
  hardware checks.

## Verification

Lint, strict typecheck, 47 unit tests and production build pass. Compiled-production
smoke passes. The webcam-specific browser tests verify nonblank frames, positive
FPS, dimensions, stop/start/restart, sample/local/phone switching, single capture
concurrency, no live previous tracks at a new request, late-stream cleanup,
constraint fallback and each requested browser error category.

The first full browser run passed 38/39; the existing optional cube recording
test timed out waiting for samples while its video was still live (27 FPS).
That unchanged test passed on an isolated rerun. The final full-suite run passed
all 39 browser tests. Desktop/mobile webcam screenshots were inspected; the
camera view is nonblank and normal controls fit. This camera update does not
change cube tracking.

Physical acceptance is **not passed**: the real webcam remains inaccessible with
`NotReadableError: Device in use`. Stop camera captures in other tabs/apps, keep
the project at `http://localhost:5173`, and retry Start/Restart. The hardware-only
probe must run with the app's other camera capture stopped. It checks live frames,
positive FPS, resolution, stop/start/restart and sample/local switching before
reporting a lifecycle pass. Test-camera browser results do not prove hardware
availability or fixed-camera alignment.
