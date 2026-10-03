# 4D LiveSpace Project Plan

## Current Development Priority

Windows Webcam -> transparent overlay -> stable manual calibration -> floor ->
furniture -> T0/T1/T2 -> animated 4D timeline. Webcam is the default source and
uses explicit browser permission; iPhone pairing starts only when selected.
A fixed webcam and manual reference are the primary acceptance path. Recalibrate
after moving it. Marker tracking and iPhone transport are optional secondary paths
and their physical tests do not block webcam development.

The latest webcam-first instruction supersedes the earlier Cube Lab physical-test
gate and camera-only development gate. Cube Lab remains an optional experiment;
its marker/physical tests do not block the primary room-planning workflow.
Improve marker tracking and iPhone support only after webcam features are reliable.
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
Primary hardware acceptance requires a fixed Windows webcam, manual alignment,
the full webcam-only workflow and measured errors in PHYSICAL_ACCEPTANCE.md.
Physical iPhone and marker checks are separate secondary acceptance paths, not
prerequisites for the webcam version.

## Decisions

One local host; no cloud/paid APIs/native iOS/ARKit/LiDAR. Direct LAN WebRTC frames,
local vision worker, explicit approximate calibration, DTO-only project data,
independent snapshots, temporal identity matching and atomic local files.

## Wildlife Research Extension

The current wildlife recording uses a separate `/research` workspace; it does
not replace webcam-first planning, Cube Lab or human Motion Lab.

| Phase | Deliverable | State |
| --- | --- | --- |
| A | Existing-system and current-media audit | Human-only schema kept separate |
| B | Local detection, masks, tracking, depth | Pinned DINO/SAM 2/ByteTrack/Depth Anything pipeline |
| C | Assumed scene, body proxies, history | Relative scale, motion heading, gaps and uncertainty explicit |
| D | Synchronized research UI | Split/video/3D/data, timeline, pair metrics, cautious events |
| E | Research exports and cache | Source/version/settings bound; JSON/CSV/PNG/silent WebM |
| F | Verification | Unit/browser/production regressions plus actual-clip integration |

See docs/RESEARCH_VIEW.md for installation, current real-model evidence and
remaining scientific limitations. Private media/models/derived data stay ignored.
