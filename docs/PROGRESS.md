# Phase Progress Notes

## Cube Tracking Debug Fix

Inspected actual code: js-aruco2 2.0.0, ARUCO_MIP_36h12 ID 101, real local worker.
Separated decoded marker presence from POSIT/filter validity, retained legacy
room pose behavior, and fixed silent missing/unready/paused-frame failures and
worker error handling. Normal webcam frames retain 1280x720 detail. Start/Stop,
engine readiness, all IDs, frame count, FPS, corners/center/polygon, pose failures
and throttled logs are visible. Exact ID 101 PNG/SVG/PDF, Show Marker 101 and a
separate known-image self-test are included; no fake live pose/state is injected.

2026-10-02 verification: lint/typecheck, 37 unit tests, build, all 28 browser tests
and production smoke pass, preserving webcam/phone/QR/HTTPS/media/planner flows.
Real-camera probe returned Device in use; actual hardware tracking/alignment
is not claimed. Debug inventory/root-cause boundaries: CUBE_TRACKING_DEBUG.md.

## Latest Priority: Fixed Webcam Room Planner

The latest owner instruction restores Windows webcam -> transparent overlay ->
manual calibration -> floor -> furniture -> T0/T1/T2 -> 4D timeline as the primary
development path. The prior Cube Lab physical-test gate is superseded. Cube Lab,
marker tracking and iPhone/WebRTC remain available but secondary. Existing code
already defaults to webcam, pairs a phone only on selection, places manual
calibration first, and provides Recalibrate while retaining room content.
Project plan, README, hardware protocol and repository instructions now agree.

Reverification: lint, strict typecheck, 35 unit tests, production build and nine
camera/webcam browser tests pass. The webcam-only test covers manual calibration,
floor, placement/move/rotate/scale, measurement, three layouts, interpolated
timeline with continuing camera frames, comparison, PNG export and Recalibrate
while asserting zero phone sessions/signaling sockets and zero marker workers.
Permission failure/retry and optional WebRTC/QR/HTTPS regressions also pass.
Physical room alignment/measurement error remains separate hardware acceptance.

## Latest: 4D Cube Lab

Implemented as a separate workspace in the existing application. Windows webcam
remains primary; neither phone pairing nor room calibration is required. Real
ID 101 detection/POSIT, approximate camera-relative cube-center pose, raw/filtered
data, smoothing, recording/pause/resume/Stop, trajectory, fractional timeline,
playback speed/loop, named keyframes, JSON import/export, local IndexedDB library,
paginated data and debug controls are integrated. The room planner is preserved.

Final software verification: lint/typecheck/build, 35 unit tests, 21 browser
tests and compiled production smoke pass. Real PNG marker pixels, not mocked
poses, exercise webcam-stream detection and XYZ/rotation movement. Desktop/mobile
transparent canvas checks and replay motion pass; screenshots inspected. Physical
measured-cube/webcam alignment and the two owner acceptance tests remain pending.
Optional graphs and full intrinsic calibration are deferred. Detailed phase
record: CUBE_LAB_PROGRESS.md. Setup/print assets: CUBE_MARKER_SETUP.md.

## Phase 1

Created the requested apps/packages boundaries, React/Vite entry, Express host,
TypeScript strict checks, ESLint, Vitest, Playwright and Windows startup command.
The workspace is a functional camera application; future editing controls are
not represented as working buttons. Build and checks passed.

## Phase 2

Created /camera with environment-camera preference, explicit permission gesture,
muted inline preview, connect/switch/stop, error recovery, actual decoded FPS,
resolution and viewport orientation. Track cleanup is explicit. The phone
remains a camera-only client. Browser capture tests passed; iPhone permission,
exact selected rear lens and background suspension await physical testing.

## Phase 3

Implemented cryptographic pairing, schema-validated WebSocket signaling, actual
offer/answer/ICE, peer departure and reconnect. Added TLS certificate generation
using documented selfsigned 5 APIs, a certificate-only LAN bootstrap endpoint,
Safari trust guidance and QR codes. Filtered unusable IPv4 link-local adapters
and prioritized private LAN addresses. Fixed Vite's HTTPS development WebSocket
route, preserving hot reload and removing runtime errors in camera tests.

Receiver supports webcam, local file, offline sample image and PNG frame export.
Eight unit/integration tests and six browser tests passed. The WebRTC test uses
real transport and verifies decoded nonblank pixels, a signaling interruption,
stop/start and phone reload. Another test validates the generated certificate
against its actual CA without bypassing TLS verification.

Dependency installation and lint/typecheck/build succeeded; audit reports zero
vulnerabilities. Npm 10 initially failed resolving a changed Vitest peer graph;
one npm 11 install repaired the lockfile. Normal npm install was then retested
successfully with the machine's npm 10.9.2.
The production smoke test also passed against the compiled bundle and local
sample asset, using an isolated host that shuts down after the check.

At this historical delivery point, the original brief gated timeline development
on owner confirmation of moving iPhone video. The later expanded brief supersedes
that development gate; physical acceptance itself remains pending.

## Certificate Download Fix

The first physical setup attempt reached the PC but returned NotFoundError:
Express sendFile's dotfile policy blocked the public CA inside `.local/certs`.
Both download listeners now read only the configured public certificate and send
its bytes with the certificate MIME type. Missing-file failures produce a useful
message without a stack trace. Private keys remain inaccessible.

Regression coverage checks the hidden-directory download, missing-file response,
private-key exclusion and the exact certificate URL from the setup dialog. Checks
pass with eleven unit/integration tests and seven browser tests. The live server
was restarted with the fix; physical camera acceptance remains pending.

## Expanded Brief: Phases 0-3

Audited existing frontend/backend, QR, TLS, source ownership and WebRTC before
edits. Added DTO/store boundaries and a persistent transparent Three.js layer
without replacing transport. Implemented meter-based Y-up grid, contain/cover
geometry and resizing. Camera regressions and nonblank canvas-pixel checks pass.

## Expanded Brief: Phases 4-6

Implemented persistent calibration, three floor points/known distance, degeneracy
checks and corrections. Added local js-aruco2/POSIT worker, pose conversion,
smoothing/jump rejection and last-pose hold/loss/reacquire. Generated ID 100 PNG
and measured 20 cm print PDF. A real-image test found/fixed detector call signature;
found/confirm/loss/reacquire pass. Manual mode assumes FOV/pose/floor; physical
alignment accuracy is pending.

## Expanded Brief: Phases 7-11

Added nine recognizable primitive models, GLTFLoader extension and rendered
thumbnails. Ghost placement, selection/gizmos, numeric transforms, snapping,
presets/dimensions, visibility/lock, duplicate/delete confirmation, 100-state
history, conservative Box3 overlap and named approximate measurements work.
Tests verify manual placement, edit/history/duplicate/delete, geometry/measurement.

## Expanded Brief: Phases 12-18

Implemented JSON project lifecycle/loopback API, import/export, autosave,
serialized atomic writes and valid previous backups. Recovery does not overwrite
a valid backup with corrupt data. Independent layout snapshots preserve temporal
IDs. Timeline lerps position/scale, slerps rotations and fades/scales visibility/
existence; play/pause/next/previous, duration/speed/easing, compare and PNG export
work. Browser tests confirm midpoint motion and disk-backed reopen. Actual WebRTC
frames keep arriving during timeline playback; furniture persists after Stop.

## Expanded Brief: Phases 19-22

Added illustrative Bedroom/Study/Gaming demo and exportable sample JSON,
remembered first-run tour, native dialogs, error boundary and separate lazy
phone/desktop bundles. University docs plus installation/limits are updated.
Desktop panels scroll independently with viewport/timeline visible together;
mobile shows viewport before catalog. Inspected 1440x1000 and 390x844 screenshots.
Sample pose is explicitly illustrative, not measured calibration of its image.

Grouped lint/typecheck/unit/build checks pass. Latest unit suite has 26 tests.
Camera baseline has seven browser tests; planner has ten, including real marker
loss/reacquire, live timeline continuity, onboarding, invalid import and actual
storage API. Full final/production evidence is recorded below after verification.
Physical iPhone and room accuracy remain pending; no result is inferred from
synthetic camera capture.

## Final Verification

2026-10-02: lint, strict typecheck, 26 unit/integration tests and production build
pass. Full browser run passes 17 tests, including direct rendered gizmo drag/undo,
real marker found/lost/reacquire, frame continuity during timeline and project
save/reopen. Compiled production smoke verifies nonblank 3D, local JSON save,
actual marker worker and phone bundle isolation. Production dependency audit
reports zero vulnerabilities. Screenshots and alpha-pixel checks confirm desktop
and mobile scenes render; timeline midpoint positions confirm actual motion.

Vite reports a non-fatal >500 KB desktop chunk warning (Three.js and editor).
The phone does not request that chunk; this is verified in production. Physical
iPhone 16e/Safari, printed-marker alignment, measurement error and real LAN
latency remain pending in PHYSICAL_ACCEPTANCE.md. Do not label those checks passed.

## Webcam-First Development Change

Windows webcam is now the default primary source, with explicit Start webcam
permission, actual local status/FPS/resolution, Stop/retry and disconnected-track
handling. iPhone selection alone allocates its session and signaling connection;
secondary errors do not override webcam status. The fixed-camera panel has no
phone pairing requirement. Manual reference is the first calibration section;
marker tracking is collapsed and optional. Recalibrate is available from Camera
and the webcam planner viewport. It invalidates the old calibration and clears
floor clicks/tracking/selection while retaining room data, layouts and measurements.

Validation: lint, strict typecheck, 27 unit tests, build and 19 browser tests pass.
The webcam-only end-to-end test blocks session allocation and verifies zero phone
signaling sockets and marker workers while manually calibrating, placing/editing
transforms, measuring, building T0/T1/T2, checking interpolated position, playing
with continued webcam frames, comparing and exporting PNG, then recalibrating.
Permission denial/retry/Stop is tested separately. Existing optional iPhone and
marker regressions still pass; compiled production smoke passes. Desktop/mobile
screenshots inspected; no browser runtime errors. Physical webcam mounting,
manual alignment and tape-measure accuracy still require owner hardware tests.
Those primary checks no longer depend on physical iPhone acceptance.
