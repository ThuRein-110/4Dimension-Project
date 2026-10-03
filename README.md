# 4D LiveSpace

**Real-Time Room Digital Twin and Temporal Layout Planner**

A local Windows React/Three.js room planner with **Windows webcam as the primary
source** and optional iPhone Safari WebRTC. X/Y/Z represent space; T represents ordered room
layout states. Furniture animates between states, rather than switching screenshots.
This is an approximately calibrated planning model, not depth reconstruction.

## Run On Windows

Node.js 22.12+ and a WebGL-capable Chrome/Edge browser are required.

```sh
npm install
npm run dev
```

Open **http://localhost:5173**, or run start.bat. Startup installs dependencies
only when absent, generates local TLS material if needed, prints LAN URLs and
opens the desktop browser. Initial installation needs Internet; runtime is local.
Production: npm run build then npm start, with the dev host stopped first.

## Primary Workflow: Fixed Windows Webcam

Open the app and press Start webcam, allowing browser camera permission. Keep the
webcam mounted in a fixed position. Open Calibration, select floor A/B/C, enter
measured A-B distance and confirm. Use camera corrections to align approximately.
The grid, furniture transforms, measurements, T0/T1/T2, interpolated timeline,
comparison and PNG exports operate without an iPhone, pairing or marker.
When the webcam moves, press Recalibrate in the webcam panel or planner viewport;
reselect the same physical origin/direction. Layouts and measurements are retained,
but placement needs the new reference confirmed. Marker tracking is optional and
collapsed below manual calibration. Capture starts only after your permission gesture.

The active development priority is the complete webcam-only workflow. Neither
iPhone connection nor the optional Cube Lab physical test blocks that work.

## Optional Cube Lab

Start webcam, then open **4D Cube Lab**. Print the ID 101 marker, enter measured
marker/cube sizes, track, record, Stop, scrub/replay and add named keyframes.
Saved takes and JSON imports replay without a camera. This separate experiment
uses approximate camera-relative pose and requires a marker for real tracking;
the room planner does not. Setup: [CUBE_MARKER_SETUP](docs/CUBE_MARKER_SETUP.md).

## 4D Motion Lab

Open **http://localhost:5173/motion** or the **4D Motion Lab** workspace tab.
Place a MOV/MP4/M4V/WebM in the repository root; IMG_0135.MOV is preferred.
The local server probes real metadata and caches an upright H.264 preview when
needed. Wait for Pose model ready, then Analyze Motion. Real MediaPipe inference
runs in a local browser worker, with a synchronized 2D/estimated 3D skeleton,
source-time timeline, wrist trails, ghosts, manual golf keyframes, X/Y/Z/T
inspection, graphs, experimental 2D club annotations and PNG/JSON exports.
Analysis/settings/annotations cache locally; Save with Project stores references,
not media. Existing webcam/planner/Cube workflows remain separate.

**Your video is not uploaded to GitHub or external AI services.** Root videos,
prepared media, model/pose caches and test screenshots are ignored by Git.
Only the public pose model downloads once; subsequent inference is local.
Depth/velocity are monocular estimates, not professional motion capture.
Whole-video analysis currently accepts clips up to two minutes; playable Local
Media is also supported. Root discovery/preparation remains localhost-only.

Guide: [Motion Lab](docs/MOTION_LAB_USER_GUIDE.md).
Design: [Architecture](docs/MOTION_LAB_ARCHITECTURE.md).
Checks: `npm run test:motion` uses your real local clip and model, saves private
evidence under ignored test-results and checks desktop/mobile rendering and sync.
CI pose mocks exist only in tests. See [Test Plan](docs/MOTION_LAB_TEST_PLAN.md)
and [Limitations](docs/MOTION_LAB_LIMITATIONS.md).

## Optional iPhone

1. Use the same trusted Wi-Fi and permit Node/desktop browser on Private networks.
2. In Camera, select iPhone camera, then First-time iPhone setup and its certificate QR.
3. Install the profile in Settings > General > VPN & Device Management.
4. Enable full trust in General > About > Certificate Trust Settings.
5. Scan the main camera QR; Safari Start Camera, allow permission, Connect to PC.
6. Keep Safari unlocked/foreground; Windows shows moving frames and actual FPS.

Full instructions: [NETWORK_SETUP](docs/NETWORK_SETUP.md).
Desktop HTTP 5173 is loopback-only, LAN HTTPS/WSS is 5443, certificate-only HTTP
is 5442. The certificate-download NotFoundError from hidden .local is fixed.
PORT/HTTPS_PORT/CERT_PORT override defaults. If LAN IP changes, stop, npm run certs,
restart and rescan. Private keys must never be shared. Remove CA trust after use.

## Plan A Room

Camera preserves phone/webcam/local-media/sample, QR, reconnect, FPS/resolution,
Fit/Fill/fullscreen and camera PNG. Calibration adds room dimensions, origin,
camera corrections, three-floor-point manual reference and local ArUco tracking.
Print [marker instructions](public/markers/marker-instructions.md); PDF black
outer square is 20 cm at actual size. Track/confirm when found; loss holds last
pose and warns. Manual calibration assumes camera FOV/pose and a stationary view.

Place offers nine recognizable local furniture models, generated thumbnails,
ghost floor placement, gizmos, numeric transforms, snapping, lock/visibility,
duplicate/delete/history and advisory overlap. Measure reports approximate world
distance in meters/centimeters. No LiDAR, ARKit, Mac, Xcode or native phone app.

Use project menu/save for versioned local JSON, autosave, valid previous backups,
import/export and reopen. Layouts are independent snapshots; duplicate preserves
temporal furniture IDs. Timeline provides fractional scrubbing, play/pause,
previous/next, speed/duration/easing and position/rotation/scale/visibility/existence
interpolation. Compare offers wipe/shared-camera split/toggle or raw camera.
Export camera+3D or 3D-only PNG. **Demo** loads illustrative Bedroom/Study/Gaming
states and works without a phone; it is not measured calibration of the photograph.

## Architecture And Checks

React desktop/phone are lazy-loaded separately. Express handles local TLS,
credential sessions, signaling and loopback project APIs. WebRTC frames go
directly between browsers; desktop vision runs in a local worker. Three.js,
calibration/history, layout/interpolation and atomic persistence are separate
packages. No audio, cloud frames, paid APIs or server recording.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:production
```

Tests use real WebRTC transport with synthetic Chromium camera tracks, real
marker detection, geometry/storage tests and visible editing/timeline workflows.
They do not certify physical iPhone 16e/Safari, Wi-Fi latency or room accuracy.
Physical acceptance remains pending in [PHYSICAL_ACCEPTANCE](docs/PHYSICAL_ACCEPTANCE.md).

## Documentation And Limitations

Motion Lab defaults to [4D Video View](docs/MOTION_VIDEO_VIEW.md): synchronized
pose/depth, real trails/ghosts, clickable XYZT, freeze/composites and fullscreen
with timeline. Existing pose caches are reused; original recordings remain local.

[User guide](docs/USER_GUIDE.md), [installation](docs/INSTALLATION.md),
[architecture](docs/ARCHITECTURE.md), [requirements](docs/SRS.md),
[design](docs/DDS.md), [test plan](docs/TEST_PLAN.md),
[demo script](docs/DEMO_SCRIPT.md), [progress](docs/PROGRESS.md) and
[limitations](docs/LIMITATIONS.md).

Manual/marker alignment and measurements are **approximate**. There is no SLAM,
real-depth occlusion or architectural surveying. Markers need good lighting and
known size; manual mode needs a fixed camera. Guest Wi-Fi/VPN/isolation can block
WebRTC; Safari may suspend on lock. Runtime has no TURN fallback. Local .local
storage keeps one backup, not unlimited history; export JSON independently.
Models are recognizable primitives, not photorealistic GLBs; GLTFLoader supports
developer extensions, not arbitrary user-model import. Sample photograph credit:
[attribution](assets/demo/ATTRIBUTION.md).
