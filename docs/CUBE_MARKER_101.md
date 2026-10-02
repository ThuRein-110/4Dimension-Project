# Exact Cube Marker 101

- Detector: installed **js-aruco2 2.0.0**, real local `AR.Detector`, not a mock,
  QR decoder, OpenCV.js build or AprilTag WASM dependency.
- Dictionary/family: **ARUCO_MIP_36h12**. Exact ID: **101**.
- Black square: 8 x 8 cells (6 x 6 encoded bits plus one black border cell).
- Files: `public/markers/cube-marker-101.png` and `cube-marker-101.svg`.
  Compatibility alias `cube-marker.png` has the same pixels. Print PDF:
  `public/markers/cube-marker-print.pdf`.
- PNG: 1000 x 1000, black square 800 x 800, white margin 100 pixels each side.
  SVG: native 10 x 10 viewBox, white full-cell quiet margin, crispEdges. On paper
  SVG/PDF outer extent is 50 mm; black square is **40 x 40 mm**, margin 5 mm/side.
  These files use the library's actual codebook and `generateSVG(101)`.

## Print and Track

1. In Cube Lab select **Show Marker 101**. Compare your existing print to the
   image and confirm the exact dictionary/ID, not merely a generic numeric ID.
2. Open Print PDF and choose **Actual size / 100%**, not Fit or Shrink.
3. Measure the black outer square, excluding the white margin. Enter its measured
   width under Marker size (mm); enter the actual cube side as well.
4. Attach flat and centered on the cube face. Preserve the full black border and
   white margin; do not laminate with a glossy finish or fold the marker.
5. Start Windows webcam, use good lighting, avoid glare, face the marker toward
   the lens, and begin around 30-80 cm. If its code cells are too small/blurry in
   the actual frame, move closer or refocus.
6. Press Start tracking. Check **Vision ready**, then **DETECTED** (one/two
   consecutive detections) -> **TRACKING** (three). Accepted pose updates XYZ,
   distance and XYZ Euler rotation; its accuracy remains approximate.
7. Open Tracking Diagnostics and enable Debug Tracking for corners, center, ID,
   polygon and FPS. Frame input/processed count must advance; detected IDs reveal
   a wrong marker. A camera/detector failure is ERROR, not a fabricated pose.

Marker size and FOV are pose-scale inputs only. A wrong size can distort distance
but cannot prevent the decoder from identifying ID 101. Pose rejection displays
**MARKER FOUND / POSE UNAVAILABLE**, independent of decoded-marker tracking.
Both preview and detection input are unmirrored by this application.

## Independent Self-Test

Use **Tracking Diagnostics > Test Marker Image** without requiring a webcam.
This loads the exact generated PNG into the same real worker. **SELF-TEST PASS**
means the returned IDs include 101, not that hardware tracking is proven. The
self-test does not modify LIVE/RECORDING/PLAYBACK, pose, live state, or samples.

```sh
npx tsx scripts/generate-cube-marker.ts
npx playwright test tests/e2e/cube-detector.spec.ts tests/e2e/cube-tracking-debug.spec.ts
```

The tests verify real PNG decoding at 0/90/180/270 degrees, wrong IDs/blank frames,
invalid FOV/size with continued decoding, missing/paused input, worker failure and
retry, real live pixel-stream recording, diagnostics and cleanup.

## Hardware Check

With the app server running, stop other camera apps/tabs before the separate
probe, hold the print facing the camera, and run:

```sh
npm run test:cube:webcam
```

This uses a real webcam (no fake camera device), logs input/IDs/FPS/coordinates,
waits up to 30 seconds for actual detection, and releases its camera afterward.
If successful, it stores a local screenshot only in ignored `.local`. Failure
or device contention is reported as not verified, not a hardware pass. The
development probe returned **Device in use**; use your already-open live browser
or free the camera and rerun it. Physical detection/alignment still needs owner
confirmation. Do not push screenshots/recordings containing your real camera.
