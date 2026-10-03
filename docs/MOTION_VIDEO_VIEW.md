# 4D Video View

## Audit

The prior default split rendered the original video and estimated Three.js pose
side by side. Its canvas mapped image landmarks correctly but rebuilt trail
lookups every frame, exposed no depth/card selection, and fullscreen omitted
the timeline. The new default prioritizes the unchanged source-camera viewpoint.
Room planning, Cube Lab, webcam and optional iPhone workflows are unchanged.

## Architecture

Video currentTime is the single master clock. MotionProjectionService maps the
upright decoded image into Fit/Fill rectangles, including letterboxing/cropping,
inverse clicks and viewport resizing. Browser/FFmpeg already applies orientation;
the overlay does not mirror, rotate or use the orbit camera's projection.

MotionOverlayRenderer draws both live overlays and PNG overlays from cached
samples. Ghosts interpolate only nearby valid samples. Trails retain sample
timestamps, break at missing poses or gaps over 0.2 seconds, and hide future
samples unless explicitly enabled. Normalized joint tracks and composite sample
selections are cached by their data arrays rather than rebuilt during playback.

The depth vector encodes the selected joint's actual estimated Z change over
0.1 seconds. Landmark radius varies subtly with estimated depth. The selected
card shares the inspector's Three-coordinate basis (x, -y, -z), uses estimated
hip-relative world coordinates or explicitly normalized fallback coordinates,
and never presents model-unit velocity as calibrated metres per second.

## Operation

Default: 4D Video, current skeleton, depth, both wrist trails/full prior history,
four ghosts at 0.15-second intervals. Split, 3D and Data remain optional.
Click a current landmark or historical trail sample for XYZT. Drag the card;
hide/show it with the eye buttons. Scrubbing or playing resets historical
selection to the current joint. The external joint selector is also accessible.

Freeze Motion pauses video and restores full prior trails and ghosts.
Full Motion Composite deliberately includes poses from across the whole clip,
including future timestamps. Keyframe Poses uses manually marked times, not
automatic golf-phase detection. Without annotations, generic composite labels
show real sample times, never invented swing phases.

Fullscreen 4D Video includes video, overlays, joint information and timeline.
Screenshots offer Original Video (native decoded size, no cropping, labels or
pose overlays), 4D Video View, 3D and Split.
Screenshot cards, depth, time and composite labels use the live renderer.

Existing analyses retain their identity and samples. Legacy display settings
migrate once to the new defaults; subsequent explicitly saved view choices are
preserved. Media, models, analyses, screenshots and verification artifacts stay
local in ignored locations and are never included in Git commits.

## Verification

Pure tests cover Fit/Fill, upright non-mirrored projection, resizing, ghost
timestamps, historical windows, missing-sample gaps, manual composite selection
and legacy display migration. Browser tests exercise joint/trajectory selection,
card dragging/hiding, frame stepping, freeze, composites, optional modes,
fullscreen with transport, all four PNG exports and mobile sizing.
The real-video verification script reuses the existing local analysis whenever
available, checks desktop/mobile canvas pixels and timestamp synchronization,
and restores the user's annotations/preferences after temporary test keyframes.

## Limitations

This is monocular estimated 3D body pose plus time, not volumetric capture or
exact reconstruction. Depth is relative, not a measured distance from camera.
Club annotation remains experimental manual 2D data. No overlay-only parallax
is applied, so exact image alignment remains intact. Composite labels display
up to twelve entries to avoid covering the original subject; all selected poses
remain rendered and all manual keyframes remain available on the timeline.
