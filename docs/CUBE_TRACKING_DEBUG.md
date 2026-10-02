# Cube Tracking Debug Audit

## Inspected Flow (Before Fix)

1. `DesktopApp.tsx` owns the active webcam `video` (getUserMedia -> srcObject),
   passes that element to `cube-lab/CubeOverlay.tsx`, and renders it unmirrored.
2. `CubePanels.tsx` Start tracking calls `cubeLab.toggleTracking()` in `store.ts`.
3. The overlay creates `packages/cube-lab/src/CubeTracker.ts` and calls capture
   on requestAnimationFrame, limited to the configured 10-20 Hz.
4. Capture draws the raw video/image into a canvas (previously downsized to 960
   pixels wide), transfers RGBA to `/assets/marker-worker.js`. CSS Fit/Fill is
   not used for CV extraction.
5. `packages/vision/src/marker-worker.js` loads actual local cv/aruco/svd/posit1
   scripts and constructs `AR.Detector` with **ARUCO_MIP_36h12** and max Hamming
   distance 2. It calls the installed `detect(ImageData-like object)` API.
6. CubeTracker passes `markerId: 101`. Worker defaults to ID 100 only for the
   separate room tracker. `scripts/generate-cube-marker.ts` already generates ID
   101 with the same dictionary; there is no evidence of a family mismatch in
   the existing generated asset. A generic ArUco 6x6/AprilTag/QR with ID 101 is
   NOT interchangeable with this dictionary.
7. The worker filters ID 101, then POSIT estimates pose using markerSize in meters
   and focal = imageHeight / (2 * tan(verticalFov / 2)). Size/FOV enter POSIT only,
   not marker decoding. CubeTracker converts the pose to a cube-center offset,
   filters it, and the store previously declared detection only for a filtered pose.

## Confirmed Defects, Not Hardware Guesses

- Worker `found` was `poseValid`, not marker presence: a decoded ID 101 with
  rejected POSIT/error or a filtered outlier was reported NOT_FOUND/LOST. Detection
  and pose failures were indistinguishable.
- Capture silently returned for missing dimensions, paused/unready video, and
  no media. The UI could stay NOT_FOUND without any frame processing. Worker load
  errors also fell through the normal no-marker state instead of ERROR.
- All other IDs were discarded before returning diagnostics. The user could not
  distinguish room ID 100/wrong-family/no marker from a broken capture loop.
- Capture reduced 1280-width webcam detail to 960. The existing PNG's quiet margin
  was only 20 pixels around an 800-pixel black square. Both can make real small,
  edge-adjacent prints harder to read; neither proves the owner's physical cause.
- There was no engine-ready handshake or in-app known-image self-test and no
  marker preview beside the expected ID.

The owner confirmed using the project cube marker. Its actual print quality,
dimensions and live input have not been inspected. The hardware probe returned
**Device in use**, so it could not establish the physical cause or pass real
marker acceptance. Blur/glare/pixel size and camera/pose issues remain possible;
wrong marker is not assumed from the owner's report.

## Implemented Fixes

- Worker returns engine ready/fatal messages, every decoded ID/corner set, a
  separate `detected` bit and `poseValid`/`poseMessage`. Only its legacy room
  `found` remains pose-valid. Size/FOV errors do not hide decoded markers.
- CubeTracker preserves normal 1280x720 raw pixels (large inputs capped at 1920
  width), measures luminance and actual completed-frame FPS, and checks startup,
  frame-extraction, missing/paused input and processing timeout failures.
- Store derives DETECTED/TRACKING from one/three marker detections, LOST after five
  missed cycles or stale input, then NOT_FOUND after five seconds. ERROR disables
  a failed worker. Only accepted real poses can record; outliers remain separate.
- Overlay releases workers on stop, source change, unavailable camera or unmount.
  Debug Tracking draws all decoded IDs, corners, center and polygon, including
  wrong IDs; expected 101 alone supplies the cube pose. Logs throttle to once
  per two seconds, include actual capture dimensions/IDs, and contain no images.
- New exact-ID PNG/SVG retain native full-cell white margin. Show Marker 101,
  truthful engine/input status, troubleshooting and isolated Test Marker Image
  expose the expected print and validate the real decoder without faking LIVE.

## Changed Modules

`packages/vision/src/{marker-worker.js,MarkerTracker.ts}`,
`packages/cube-lab/src/{CubeTracker.ts,marker.ts,test-marker.ts}`,
`apps/desktop-web/src/cube-lab/{store.ts,CubeOverlay.tsx,CubePanels.tsx,
CubeTrackingControls.tsx,cube-lab.css}`, DesktopApp active-media prop,
marker generation, hardware probe/npm script, print assets, tests and setup docs.

## Mirror Convention

`previewMirrored = false`, `detectorMirrored = false`: no CSS scaleX(-1), mirrored
drawImage, or camera-input flip exists in this flow. Raw unmirrored pixels feed
detection, pose overlay and corner overlay. A camera driver that itself flips
pixels is a separate hardware setting; disable that setting for this marker.

## Verification Plan

Generate exact sharp ID 101 PNG/SVG/PDF with a full white quiet zone. Test PNG
pixels through the real worker at 0/90/180/270 degrees; also wrong ID, blank frame,
invalid pose inputs and dependency/capture failures. Add engine/frame/all-ID
telemetry, detection-only state transitions and an isolated labeled self-test.
Keep the existing room-worker `found` field pose-valid for backward compatibility.
Run lint/typecheck/unit/build, browser regressions and production smoke. Actual
Windows-webcam/printed-marker acceptance remains an owner hardware test.

## Final Software Verification

2026-10-02: lint/strict typecheck, 37 unit tests, production build and all 28
browser tests pass. The compiled production smoke also verifies Show Marker 101
and isolated PNG self-test, alongside room/cube rendering, storage, tracking and
phone bundle isolation. Desktop/mobile screenshots inspected; debug polygons,
all-ID diagnostics and transparent rendered motion are nonblank.

The decoder recognizes the generated ID 101 at all four quarter-turns. Doubling
marker size doubles estimated depth without changing decoding. Invalid size/FOV
keeps `detected: true` with `poseValid: false`. Blank/wrong-ID input reports every
decoded ID. Worker import failure -> ERROR -> retry, absent/paused camera input,
resumed capture and release on leaving the lab pass. The self-test never changes
normal tracking state, coordinates or samples. No new CV dependency was needed.

Hardware probe: `npm run test:cube:webcam` attempted an actual capture with no
fake-device flag and returned **Device in use**. No real frame was inspected and
no physical marker/alignment pass is recorded. It did not stop the owner's other
camera apps. Physical acceptance remains open; use the already-running webcam
browser with the diagnostics, or stop competing capture before rerunning the probe.
