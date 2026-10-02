# Native Webcam Failure and Device Selection

2026-10-02. This follow-up supersedes the current-status conclusions in the
earlier [startup audit](WEBCAM_STARTUP_DEBUG.md). Only webcam acquisition,
diagnostics, tests and documentation changed. Cube/marker tracking, calibration,
furniture, layouts and timeline implementations are untouched.

## Exact Error Origin

The owner's logs contain a native `getUserMedia` rejection:
`AbortError: Timeout starting video source`, followed by a sequential retry and
the same native rejection. It is not the application's metadata timer or
AbortController. Production webcam code never creates that message.

Chromium's [UserMediaProcessor::ErrorCodeToString](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/mediastream/user_media_processor.cc)
returns that message for `MediaStreamRequestResult::START_TIMEOUT`.
[UserMediaRequest::Fail](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/mediastream/user_media_request.cc)
maps `START_TIMEOUT` to `DOMExceptionCode::kAbortError`. This locates the error
creation in native Chromium, before the app receives a MediaStream. The precise
Windows driver/service reason for the owner's START_TIMEOUT is not established;
the owner's logs did not identify the selected camera.

## Hardware Evidence

Device enumeration found two physical inputs plus virtual cameras. Separate
hardware probes used permission automation, **without fake-device flags**:

| Input / Test | Observed result |
| --- | --- |
| Browser-default raw `video: true` | NotReadableError: Device in use |
| Integrated Camera, explicit ID | NotReadableError: Device in use |
| ByteCast VirtualCamera1, explicit ID | NotReadableError: Could not start video source |
| HP Wide Vision HD Camera, selected raw test | RAW CAMERA SUCCESS; 640x480, positive measured FPS |
| HP Wide Vision HD Camera, normal app | LIVE; 1280x720, positive measured FPS |
| HP normal Stop/Start, Restart, sample/local switching | Lifecycle pass across five normal acquisitions |
| Concurrent normal native requests | Maximum 1; no live previous tracks at any new request |
| Final track cleanup | All normal acquired tracks ended |

The successful HP request returned in roughly 0.4-0.5 seconds. Measured headless
FPS was about 8-9 on sampled checks; the track's preferred frame rate was 30.
The HP image was very dark (mean sampled RGB around 3/255). Frame delivery does
not prove usable room visibility: the owner must check lighting/lens/privacy
shutter. No personal camera screenshot/video or device identifier was committed.
No competing applications or Windows camera services were terminated or reset.

This demonstrates a device-specific capture failure, not a general broken video
attachment pipeline. It does not prove which app owns the Integrated Camera or
which driver/service caused the owner's native AbortError. The missing camera
picker prevented selecting the accessible physical input. The old automatic
AbortError retry repeated the failed native operation; it was sequential, not
evidence of duplicate concurrent acquisition.

## Lifecycle Findings and Changes

- Existing starts were already user-triggered and single-flight per controller.
  No acquired-stream leak or success-then-stale-timer race was reproduced.
- Added document-wide startup serialization and camera ownership so replacement
  controller instances cannot overlap an old pending request on React remount.
  Cleanup is idempotent and disposes late streams; Stop can cancel startup.
- Lifecycle is STOPPED / STARTING / LIVE / STOPPING / ERROR. Fine-grained phases
  remain getUserMedia / metadata / playback in diagnostics and error logs.
- Native AbortError, busy, permission, security and missing-device failures now
  generate exactly one request. Only native OverconstrainedError retries once
  after cleanup, with `video: true`.
- A separate 15-second acquisition watchdog reports an application timeout.
  It cannot abort native getUserMedia: retry stays locked until native settlement,
  and a late successful stream is stopped. The eventual native error is retained
  independently. Each acquisition timer clears on native settlement; separate
  10-second metadata/playback guards clear on success/failure/cancellation.
- Invalid saved IDs are removed once enumeration exposes IDs; default is used
  rather than endlessly requesting a removed camera. Selecting a specific camera
  uses exact device ID but ideal resolution/FPS, preventing a silent substitution.
  Device enumeration refreshes after capture/permission and on device changes.
- Capture success assigns the viewport video, waits for nonzero metadata,
  awaits play/usable dimensions, then reports LIVE. Playback errors release tracks.
- Diagnostics show actual device/ID, permission, lifecycle, native pending, stream,
  enabled/ready track, video dimensions/readiness/playback, error phase, native
  error and application error. Error UI also shows the original native exception.

## Raw Test and Reproduction

Open `http://localhost:5173/webcam-test`, or **Test Raw Webcam** in the normal
camera panel. Navigation stops the normal stream first. This lazy page does not
load the desktop editor/Three.js, create marker workers or allocate phone sessions.
It shares only webcam cleanup/serialization/diagnostic helpers.

**Test Raw Webcam** requests exactly `{ video: true, audio: false }`, ignoring
saved IDs and preferred constraints. **Test Selected Camera** requests only an
explicit device ID plus audio off. Select **HP Wide Vision HD Camera** for the
hardware path that was verified here. Stop it before running another camera tab.

Hardware command on Windows:

```powershell
npx tsx scripts/check-webcam.ts '--device-name=HP Wide Vision'
```

`npm run test:webcam` tests browser default; it reports failure if default cannot
open. The selected-device command records that default failure before testing HP,
so it does not hide broken inputs. Fresh private-browser documents can rotate IDs;
the hardware probe reselects the requested label using each document's current ID.

## Verification and Files

Lint, strict typecheck, 52 unit tests, all 41 browser tests and production build
pass. Webcam regressions were rerun after final lifecycle/logging adjustments.
Compiled-production smoke checks raw startup/stop and absence of the desktop
bundle, then existing regression flows. Test-camera results remain separate from
the real HP hardware results above. Desktop/mobile screenshots were inspected.

Changed files: `DesktopApp.tsx`, `main.tsx`, `styles.css`; webcam
`WebcamController.ts`, `WebcamDiagnostics.tsx`, new `WebcamDeviceSelect.tsx` and
`RawWebcamApp.tsx`; `check-webcam.ts`, `smoke-production.ts`; webcam unit/startup/
planner browser tests plus new `webcam-raw.spec.ts`; this report, the earlier
startup report, progress and physical acceptance records.

Remaining acceptance: default/Integrated Camera availability, the owner's actual
START_TIMEOUT device/driver cause, clear HP scene visibility and fixed mounting.
No full-room or physical Cube Lab acceptance is implied by this startup pass.
