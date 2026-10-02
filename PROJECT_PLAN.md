# 4D LiveSpace Project Plan

## Current Development Priority

The newest brief pauses further room-planner expansion until **4D Cube Lab** is
physically proven: fixed Windows webcam -> transparent test cube -> real marker
pose -> recording T -> trajectory -> scrub/interpolated replay -> named keyframes.
The lab is a separate module and does not replace the existing camera or planner.
Software milestones are implemented; physical acceptance remains pending. See
docs/CUBE_MARKER_SETUP.md for measured dimensions, print assets and test steps.

Previous room-planner sequence (preserved, not expanded in this experiment):

Windows Webcam -> transparent overlay -> stable manual calibration -> floor ->
furniture -> T0/T1/T2 -> animated 4D timeline. Webcam is the default source and
uses explicit browser permission; iPhone pairing starts only when selected.
A fixed webcam and manual reference are the primary acceptance path. Recalibrate
after moving it. Marker tracking and iPhone transport are optional secondary paths
and their physical tests do not block webcam development.

The latest extended brief supersedes the earlier camera-only development gate.
Existing camera code was audited before extending it. Physical camera acceptance
remains separate from automated development evidence.

## Expanded Implementation Sequence

| Phase | Deliverable | State |
| --- | --- | --- |
| 0 | Existing-system audit | Implemented; docs/CURRENT_SYSTEM_AUDIT.md |
| 1 | Extensibility without capture rewrite | Existing camera preserved; separate planner store/modules |
| 2 | Transparent Three.js overlay | Implemented; nonblank canvas test |
| 3 | Floor/grid/world coordinates | Implemented; meters, Y-up |
| 4 | Calibration framework | Implemented; explicit states/persistent DTO |
| 5 | Manual calibration | Implemented; floor reference/known distance/corrections |
| 6 | Reference marker | Implemented; real worker detection and filtered pose |
| 7 | Catalog/models | Nine local primitives, generated previews, GLB extension |
| 8 | Placement | Ghost/raycast |
| 9 | Selection/transforms | Gizmo/numeric/snapping |
| 10 | Duplicate/delete/history | Confirmation/locks/100-state history |
| 11 | Overlap/measurements | Approximate Box3 and calibrated floor distances |
| 12 | Projects | Validated atomic JSON/previous valid backups/autosave |
| 13 | Multiple layouts | Independent snapshots; stable temporal IDs |
| 14 | Timeline | Ordered state UI |
| 15 | Scrubbing | Fractional state rendering |
| 16 | Transitions | Lerp/slerp/fade/scale, play/pause/duration/speed/easing |
| 17 | Comparison | Wipe/shared-projection split/toggle/raw camera |
| 18 | Exports | Camera/composite/3D PNG and project JSON |
| 19 | Demo | Bedroom/Study/Gaming |
| 20 | Testing | Unit/integration/browser and physical protocol |
| 21 | Documentation | University docs, installation, limits and user guide |
| 22 | UI polish | Responsive panels, local thumbnails, help/tour/error boundary |

## Validation

Grouped implementation checks run lint, strict typecheck, unit tests and build;
browser regressions preserve camera behavior and verify new workflows. Specific
evidence and remaining physical checks are in docs/PROGRESS.md and TEST_PLAN.md.
The full final live-room acceptance is not declared until physical iPhone, marker
alignment and measured errors are recorded in PHYSICAL_ACCEPTANCE.md.

## Decisions

One local host; no cloud/paid APIs/native iOS/ARKit/LiDAR. Direct LAN WebRTC frames,
local vision worker, explicit approximate calibration, DTO-only project data,
independent snapshots, temporal identity matching and atomic local files.
