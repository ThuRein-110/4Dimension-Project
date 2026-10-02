# 4D Cube Lab Implementation Record

Date: 2026-10-02. Current status: **software milestones verified; real physical
cube acceptance pending**. No further furniture/room feature expansion was made.

| Phase | Implementation / Evidence |
| --- | --- |
| 1: inspect | Existing DesktopApp webcam/video ownership, viewport, ThreeOverlay, contentRect, worker and POSIT APIs inspected before changes |
| 2: UI | Cube workspace tab, separate left/right panels and lab store; existing source selection/capture retained |
| 3: transparent overlay | Independent fixed-camera Three.js scene, alpha canvas, contain/cover resizing, cleanup; desktop/mobile pixel checks |
| 4: test cube | Explicit static preview at 0.5 m; no detector or fake recording; first visual browser milestone passed before marker work |
| 5: detection | Existing local js-aruco2 worker generalized to ID 101; ID 100 default retained for room tracking; real PNG pixels detected in browser |
| 6: pose | Known-edge POSIT, FOV/resolution-derived focal length, proper basis conversion, face-to-center offset, meters; Approximate Pose label |
| 7: follow | Live cube follows filtered pose with axes/XYZ/rotation/distance; real pixel-stream motion changes all three coordinates and rotation |
| 8: smoothing | Off/Low/Medium/High; EMA + quaternion slerp, outlier rejection and loss/reacquisition; raw/filtered data remain separate |
| 9: recording | CubeRecordingController, relative clock, 10-20 Hz limit, pause/resume excluding paused time, no loss samples, bounded take size |
| 10: trajectory | THREE.Line from recorded accepted samples; cyan path toggle; GPU geometry replaced/disposed only on sample/take changes |
| 11: timeline | Bottom timeline, elapsed/total, first/previous/next/last, speed and loop |
| 12: scrubbing | Arbitrary millisecond seek, binary sample lookup, Vector3 lerp + Quaternion slerp; live pose cannot control replay |
| 13: playback | LIVE / RECORDING / PLAYBACK separated; Stop enters playback, camera continues independently; offline replay projection uses take metadata |
| 14: keyframes | Time/name states, flags on timeline and named navigation buttons; persistence/import/export retain keyframes |
| 15: data | Validated v1 JSON export/import, named browser-local IndexedDB library with date/duration/count/delete; ten-row paginated data view |
| 16: verification | Lint/strict typecheck/build, 35 unit tests, 21 browser tests, compiled-production smoke; screenshots inspected, no runtime errors |

## Verification Groups

Checks were run after grouped core/UI/overlay implementation, then after pose,
recording and browser-test work, then after the final integration. A unit test
caught quaternion target aliasing in smoothing; corrected before the final run.
Browser selector ambiguity after adding timeline flags was corrected; the full
final suite passes. These are grouped checks, not a claim that sixteen independent
builds were run.

Browser evidence: actual image pixels enter a canvas-backed webcam MediaStream,
video capture, real Web Worker detector and POSIT solver. The test varies marker
image position, scale and roll, then exercises pause/resume, loss/reacquisition,
Stop decoupling, fractional scrubbing, speed/loop, changing rendered canvas
pixels, keyframes, JSON, save/reload and replay with no camera. It does not mock
detector results or substitute an animated pose for tracking.

Regression evidence: webcam permissions/retry/track cleanup, optional phone
WebRTC/reconnect, QR/certificate downloads, actual CA validation, local media,
sample image, room marker, room calibration/transforms, layouts/timeline,
comparison, storage and PNG continue to pass. Phone production bundle isolation
is preserved. The original non-fatal large desktop bundle warning remains.

Artifacts (generated test output): `test-results/cube-preview-desktop.png`,
`cube-preview-mobile.png`, `cube-tracking-replay.png`, `cube-recording.json`;
`.local/production-cube.png` and `.local/production-cube.json`.

## Boundaries and Pending Work

- Camera-relative coordinates and FOV-based intrinsics are approximate. No
  physical accuracy or centimeter-perfect alignment is claimed.
- Mandatory physical acceptance: measured cube/marker, actual Windows webcam,
  left/right/near/far/up/rotate, visual alignment, trajectory/replay, and named
  Start/Left/Right/Near/Far/Rotated keyframes. Protocol: CUBE_MARKER_SETUP.md and
  PHYSICAL_ACCEPTANCE.md. Owner must supply hardware results.
- Full intrinsic/lens calibration, multi-face tracking and optional XYZ-vs-time
  chart views are deferred. Core marker tracking and timeline are implemented.
- Marker-face origin assumes a centered flat attachment. Marker loss creates
  unsampled gaps; replay/trajectory connects accepted samples across them rather
  than claiming measured motion inside the gap.
- The recording library is local to this browser/origin. JSON export is required
  for transferable backups. Room-project data/persistence remains independent.
