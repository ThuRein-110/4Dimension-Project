# Software Requirements Specification

## Purpose

4D LiveSpace: Real-Time Room Digital Twin and Temporal Layout Planner runs locally
on Windows. The primary video source is a fixed Windows webcam; iPhone Safari is
optional and secondary. Manual calibration requires no marker or paired phone.
X/Y/Z are spatial dimensions in meters; T is an ordered layout/state coordinate.
This is an approximately calibrated planning model, not automatic reconstruction.

## Functional Requirements

Implemented means an executable feature, not certified physical-device accuracy.
Automated coverage is in TEST_PLAN.md; physical acceptance remains pending.

| ID | Requirement | Implementation / acceptance |
| --- | --- | --- |
| FR-01 | Create project | Named schemaVersion 1 project with initial Current state |
| FR-02 | Open project | Local picker and unsaved-change confirmation |
| FR-03 | Connect iPhone | Optional opt-in HTTPS QR and role tokens; physical Safari test pending |
| FR-04 | Windows webcam | Default fixed-camera source, permission, track cleanup and Recalibrate |
| FR-05 | Local media | Image/video browser input; no server upload |
| FR-06 | Room calibration | Persistent pose, origin, FOV, scale and corrections |
| FR-07 | Reference marker | Local ArUco ID 100 detection and POSIT worker |
| FR-08 | Manual calibration | Three noncollinear floor-ray points and known A-B distance |
| FR-09 | Room dimensions | Bounded name/width/length/height inputs |
| FR-10 | Floor grid | Transparent meter-based toggleable grid |
| FR-11 | Furniture loading | Nine recognizable primitives; developer GLB loader path |
| FR-12 | Place furniture | Ghost preview and floor raycast after calibration |
| FR-13 | Select furniture | Raycast or list and selection bounds |
| FR-14 | Move | Gizmo, XYZ fields, floor arrows and snapping |
| FR-15 | Rotate | Gizmo, degrees, presets and reset |
| FR-16 | Scale | Gizmo, uniform percentage, dimensions; 0.1-5 bounds |
| FR-17 | Duplicate | New instance UUID and offset |
| FR-18 | Delete | Optional confirmation; locked items protected |
| FR-19 | Undo | Bounded independent project snapshots |
| FR-20 | Redo | Cleared by new edits |
| FR-21 | Overlap warning | Conservative transformed axis-aligned Box3 tests |
| FR-22 | Measure | Two floor points, names, meters/centimeters and visibility |
| FR-23 | Save project | Explicit save and debounced autosave |
| FR-24 | Load project | Validated atomic JSON and previous valid backup |
| FR-25 | Create layout | Named blank snapshot |
| FR-26 | Duplicate layout | Deep copy retaining temporal instance IDs |
| FR-27 | Rename layout | Validated name |
| FR-28 | Delete layout | Confirmation; at least one remains |
| FR-29 | Activate layout | Exact restoration and selection reset |
| FR-30 | Timeline | Ordered labeled T0/T1/T2 buttons |
| FR-31 | Scrub | Fractional state interpolation |
| FR-32 | Play | RAF animation, duration, speed and easing |
| FR-33 | Pause | Retain current time; previous/next navigation |
| FR-34 | Compare | Wipe, shared-projection split, toggle and raw camera option |
| FR-35 | Screenshot | Camera, composite or 3D-only PNG |
| FR-36 | Project export | Complete editable JSON |
| FR-37 | Project import | Validate version, finite transforms, IDs, models and size |
| FR-38 | Disconnect continuity | Project and layouts independent of camera |
| FR-39 | No LiDAR | No depth hardware dependency |
| FR-40 | No native iPhone app | Safari only; no Mac/Xcode/ARKit |

## Nonfunctional Requirements

| Area | Requirement / evaluation |
| --- | --- |
| Performance | RAF transitions; capped pixel ratio; worker vision at up to 10 Hz/640 px. Measure target hardware; no guaranteed FPS/latency claim. |
| Reliability | Signaling retry, explicit disposal, serialized saves, valid previous backups and safe invalid-import rejection. |
| Privacy | No audio, cloud frames or server video recording; local exports under user control. |
| Usability | Explicit modes, accessible labels, numeric controls, native dialogs, shortcuts and first-run tour. |
| Maintainability | Strict TypeScript, Zod contracts, separate domain modules and focused tests. |
| Compatibility | Windows 11 Chrome/Edge WebGL and trusted-HTTPS iPhone Safari; exact physical versions require testing. |
| Security | Loopback project/pairing APIs plus desktop header; separate expiring role tokens; schema/rate/payload limits; private keys never served. Trusted LAN only. |
| Offline | Initial npm/test-browser installation needs Internet; runtime scripts, images, marker and models are local. |

Limits: 50 states, 500 furniture items per state, 500 measurements, 8 MB JSON and
100 history snapshots. These are validation ceilings, not performance promises.
Manual calibration assumes camera pose/FOV and floor. Marker calibration requires
a correctly measured flat marker and suitable FOV. Measurements are approximate.
No SLAM, depth occlusion or architectural precision is claimed. Optional motion
sensor fusion is not implemented. Unsupported schema versions are rejected.
