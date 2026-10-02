# User Guide

## Start And Connect

Run start.bat or npm run dev; open http://localhost:5173 on Windows. Windows webcam
is selected by default. Press Start webcam and grant permission. Keep it fixed;
use manual Calibration for the floor before placement. No iPhone or marker is
required for editing, measurement, projects, timeline, comparison or exports.
Recalibrate after moving the webcam, selecting the same physical A origin and
A-B direction. This invalidates the reference but retains layouts/measurements.
Camera mode also preserves the secondary QR/source workspace. Select iPhone
camera to activate pairing. First-time iPhone setup installs the
PC's public CA; enable full trust, scan the main camera QR and tap Start Camera,
allow permission, then Connect to PC in Safari. Keep Safari unlocked/foreground.
See NETWORK_SETUP.md for TLS/firewall instructions. FPS/resolution and live status
come from actual capture/playback. Fit preserves the frame, Fill crops, Reset
returns to Fit and fullscreen expands the viewport. Local files are not uploaded.
Switching from webcam stops tracks; New pairing code invalidates old credentials.

## Offline Demo

Click Demo for illustrative Current Bedroom, Study and Gaming states over the
bundled photograph. This is not measured calibration of that photograph.
Select furniture, change numerical transforms or gizmo, undo/redo, open Timeline
and scrub or Play. Compare states, export PNG and save/reopen. No phone is needed.

## Calibrate A Real Room

Enter Calibration and measured room width/length/height in meters.
Manual: keep the camera fixed, Select floor points, click noncollinear floor
references A/B/C, enter measured A-B distance, then Confirm floor origin.
A is origin and A-B defines X. Initial pose/FOV are assumptions; use camera
corrections, origin and scale to improve alignment. Three points do not solve an
arbitrary camera. Recalibrate after camera motion/source changes.

Optional marker: expand Optional marker tracking and print public/markers/marker-print.pdf at 100%, not fit-to-page. Verify the
black outer square measures 20 cm, or enter its actual side length. Place flat on
the floor with all corners visible; Track marker then Confirm marker origin when
MARKER FOUND appears. TRACKING requires detections. Loss holds the last pose and
warns after approximately one second. Restore visibility or use manual fallback.
Reset origin discards calibration, not furniture. All alignment is approximate.

## Furniture And Measurement

Search/filter the catalog; plus selects a ghost, move over floor and click to
place. Select an object or Properties list entry. Move/Rotate/Scale choose gizmos;
XYZ fields, degree presets, floor arrows and Snap offer controlled adjustments.
Scale is bounded 10-500%; dimensions alter the corresponding axis. Lock protects
transforms/deletion. Visibility belongs to the active layout. Duplicate uses a
new identity. Delete asks confirmation unless disabled in Project settings.
Overlap warnings use conservative axis-aligned boxes, not physics.

Measure: click two floor points. Rename/hide/delete readings in the right panel;
meters and centimeters reflect calibrated world distance. Measurements are shared
room data and are approximate, not surveying measurements.
Ctrl+Z/Ctrl+Y undo/redo; Escape cancels/deselects; G/R/S choose transforms; Delete
deletes; F focuses selected furniture; Space controls Timeline playback. Text
fields/dialogs do not trigger editor shortcuts. Focus changes virtual projection,
so recheck alignment afterward.

## Projects And Layouts

Project-name menu: New/Open/Save as or Duplicate/Rename/Delete/JSON import/export.
Save icon writes .local/projects. Autosave defaults on with debounce; Layouts
Project settings can disable it. Saved means an actual successful API write.
Export JSON for portability. Storage retains one previous valid .bak; unreadable
projects offer Try backup in Open. SchemaVersion 1 and supported catalog IDs are
required. Live/local media and transient tracking are not stored in project JSON.

Rename initial state Current Bedroom. Duplicate to Study to retain furniture IDs
for animation; edit independently. Duplicate to Gaming and add/remove items.
Blank starts empty. State rows activate, rename, reorder or delete; at least one
remains. Edits immediately update active state; Save persists every state.
Timeline buttons restore snapshots, fractional slider interpolates, and
Play/Pause/Previous/Next navigate. Duration is 0.5-5 seconds per segment; speed and
linear/smooth easing are configurable. Playback never overwrites snapshots or
stops capture. Matching objects move/rotate/scale; additions/removals fade/scale.

## Compare, Export And Help

Compare chooses Before/After layouts or raw Live camera, then wipe,
shared-projection split or toggle. Header capture exports camera PNG in Camera
and fitted camera+3D PNG in planner modes; 3D PNG omits media. Project JSON exports
all editable states. Downloads go to the browser's normal download folder.
Help explains 4D and has an eight-step tour with Skip/Previous/Next/Finish.
Completion is remembered locally.
