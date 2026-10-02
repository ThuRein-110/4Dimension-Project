# 4D Cube Lab: Physical Setup

1. Open http://localhost:5173 on Windows and start the Windows webcam. Keep the camera fixed. An iPhone is not required.
2. Open **4D Cube Lab** in the workspace toolbar. The existing camera stays live.
3. Print [cube-marker-print.pdf](../public/markers/cube-marker-print.pdf) using **Actual size / 100%**, not Fit to page. The black outer square is nominally **40 mm**; the white quiet zone is not included. The PNG is for detection or custom printing; its pixels do not define a physical print size.
4. Measure the entire black outer square with a ruler or caliper. Enter its actual width in **Marker size (mm)**. This is not the width of the inner code cells or the white margin.
5. Measure the cube's side and enter **Cube side (mm)** (default 57 mm). Attach the marker flat, centered on a single face, without folds. Keep its white border unobstructed. The setup assumes this centered placement.
6. Set the webcam's known vertical or horizontal FOV when available. Otherwise the default 60-degree vertical FOV is only an approximation. Lens distortion is not calibrated. Avoid the image edges and very close distances.
7. Point the marked face toward the webcam with even lighting. Start tracking. **DETECTED** then **TRACKING** comes from actual ArUco detection, not a timer or demo animation. Start with the cube about 0.3-0.8 m away so the marker occupies enough pixels.
8. If there is no detection, verify ID 101, adequate size in the image, no glare, no motion blur, and all four borders visible. The separate room-calibration marker (ID 100) does not track this cube.

## First Visual Milestone

Before tracking, enable **Test cube preview**. This renders a static virtual cube at 0.5 m to verify the transparent Three.js layer. It is explicitly a test cube, does not fake tracking, and cannot be recorded. Disable it before starting real tracking.

## Coordinate Convention and Accuracy

- Camera origin is fixed: X right in the unmirrored webcam image, Y up, Z positive depth away from the camera. Units are meters. These are camera-relative coordinates, not surveyed room coordinates.
- Displayed/recorded position is the cube center. The marker center is offset by half the entered cube side along the marker-face normal. A flat centered marker on the local +Z face is required.
- Rendering converts positive depth to negative Three.js camera Z. Quaternion rotations use the right-handed Three.js camera basis; pitch/yaw/roll are XYZ Euler angles in degrees. Euler angles can wrap; interpolation uses quaternions.
- The browser-local js-aruco2 2.0.0 detector uses ARUCO_MIP_36h12, ID **101**, and POSIT with a known marker edge and FOV-derived focal length. The existing worker also retains ID 100 for the room planner.
- **Approximate Pose** is intentional. Incorrect FOV or marker width biases depth/scale. There is no centimeter-perfect guarantee, calibrated lens distortion, world anchoring, multi-face tracking, or markerless cube recognition. Future calibrated intrinsics can replace the focal/projection boundary in `CubeTracker` and `CubeOverlay` without changing the recording clock or timeline schema.
- Recalibrate Cube stops tracking so sizes/FOV can be changed; it does not invent a chessboard calibration. Moving the camera changes the coordinate frame. Clear/start a new take after movement; do not compare old and new coordinates as a shared world frame.

## Physical Acceptance Test 1 (Pending User Verification)

1. Start webcam, enter measured dimensions, start tracking, confirm a virtual cube and updating XYZ.
2. Start Recording. Move left/right, closer/farther, upward, then rotate. Keep the marked face visible.
3. Pause and Resume to test recording controls. Hide the marker briefly: TRACKING LOST must appear, the last pose holds for at most one second, and invalid frames must not add samples.
4. Stop. The mode changes to PLAYBACK. Move the real cube: the replay cube must stay at the recorded time.
5. Drag Cube time between samples. Check continuous position and rotation interpolation.
6. Play at 0.25x, 0.5x, 1x, and 2x; test Loop and first/previous/next/last controls.
7. Show Trajectory, axes, and coordinate label. The cyan line joins accepted recorded samples; it does not imply tracking existed across loss gaps. Replay interpolates across those gaps.

## Physical Acceptance Test 2 (Pending User Verification)

Scrub to each desired time and add named keyframes: Start, Left, Right, Near, Far, Rotated. Click the keyframe flags/names to seek to their recorded poses. Keyframes store time/name, not an independently edited pose.

## Saving and Offline Replay

- Stop recording before Save Recording or Export Recording JSON. Use a take name. Save persists in this browser's IndexedDB on this origin, not the room-project database or a cloud service. HTTP and HTTPS origins have separate libraries. Export JSON for backup/transfer.
- Import Recording JSON works without any camera. Its recorded resolution/FOV/cube size drives replay projection. A current video background with a different aspect/FOV or a moved camera will not align with an old take.
- JSON schema v1 includes ID, creation date, name, coordinate convention, approximate camera metadata, marker/cube dimensions, sample rate, duration, pose samples, confidence proxy, and keyframes. Validation rejects invalid quaternions, nonfinite values, duplicate/out-of-order sample times, and out-of-range keyframes. Imports are limited to 8 MB.
- Limits: 12,000 samples, one hour elapsed recording time, 100 keyframes. Pause excludes paused wall-clock time. Loss excludes samples but retains elapsed time. Sampling/worker capture targets 10-20 Hz; the Three.js overlay renders on requestAnimationFrame. Confidence is a POSIT-error proxy, not a calibrated probability.
- 4D Data shows only ten samples per page. Developer View exposes actual corners, ID, raw/filtered poses, POSIT error, and detection rate. Optional time-series graphs and full intrinsic calibration are deferred.

## Evidence, Not a Physical Completion Claim

Automated tests exercise real printed-marker PNG pixels in a browser webcam stream, the real worker/POSIT solver, changing XYZ/rotation, filtering, loss, pause/resume, recording, interpolation, replay, keyframes, JSON, IndexedDB, transparent canvas pixels, and desktop/mobile layout. This is software evidence only. The two physical tests above must still be performed with your measured cube and actual Windows webcam before the experiment is considered physically proven.
