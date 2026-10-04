# Estimated 4D Spatial Motion View

2026-10-04 update to the existing Research View, not a replacement pipeline.

## Default

Open `/research`: the original video and spatial view use the same refined
observations, Track IDs, `trackColor`, selected ID and `video.currentTime`.
For the current wildlife clip AUTO selects the 2.5D X/Z map. Full Three.js
geometry remains optional and quality-gated. Mixed or unavailable depth falls
back to an image/depth diagram without silently dropping a visible animal.

Default spatial layers: full-clip all-subject occupancy, all observed past trails,
current footprints, motion arrows when supported, uncertainty rings, IDs and a
selected/nearest pair relation. The left video retains its short-trail default.
The two trails express the same observations in different coordinate systems;
the right side does not run a separate tracker or invent animal positions.

## Paths And Time

Trajectory choices are Current Position, All Observed Past and Full Recorded Clip.
Past mode includes only observations at or before T. Full mode also shows later
recorded observations as dashed paths in the map, explicitly not predictions.
Current markers always use the same nearest real sample as the video, with the
sample timestamp separate from source playback time. Long gaps are not joined.
If the current segment is unobserved, real history/occupancy remains visible but
no stale or interpolated current marker is created.

Full-path bounds use the chosen analysis interval and remain fixed during scrubbing.
Selected-track and active-subject fit are optional; density always uses full-clip
projection bounds and is cropped visually, so zoom cannot create edge hotspots. The
selected path is stronger than other paths; the current footprint has an outline
and ID/NOW label. Detection, depth and spatial Q appear in a separate legend. Map labels avoid current markers and one another.
Top-down heading uses the correct screen rotation and X/Z axis scaling. Image
and relative-depth maps use recent observed projected motion for arrow direction.
No motion evidence means no heading arrow, especially at the first observation.

## Heatmap

The 32-by-32 histogram uses actual sampled coordinates in the active projection.
Each observed subject contributes up to one sample interval (`1 / analysis FPS`)
of subject-time, clipped at video duration. Multiple subjects in a bin add their
contributions. The display applies an edge-normalized Gaussian kernel to these raw bins;
color intensity is normalized to the smoothed field maximum. Raw-bin data
remains exportable. The legend reports scope, raw-bin count and total sampled
subject-seconds. Shared interval ends clip sample weights, not just positions.

Whole Recorded Clip is the default scope, available even at T=0. Observed Past
to T, Recent Window and Selected Time Range are optional. Scope is independent from trajectory mode: a full-clip heatmap
does not create later current markers or predicted paths. Modes are Off, Selected
Subject, All Subjects, Interaction Density and Pair Proximity Density, plus
available class hypotheses. Pair mode requires a comparison ID. Proximity uses
co-observed image centers less than 0.15 normalized image units apart; it is not
evidence of physical contact or biological interaction. Missing masks/depth or
observations do not produce extra subjects. Calculations are cached by analysis,
projection, sample-time bucket and selected controls.

## Scientific Limits

The X/Z plane is inferred from an assumed monocular camera, smoothed relative
depth and observed image location. Camera motion, depth errors, detector misses,
identity changes and occlusion can distort the path. This is an estimated 4D
interpretation of recorded movement, not recovered terrain, true anatomy or
ground-truth metric motion. Footprints are research proxies, heading is motion
not animal facing, and Q is a quality index rather than a calibrated probability.
Heatmaps describe sampled estimated occupancy, not exact continuous dwell time.

Viewer-only changes reuse the validated v2 cache; models and inference settings
are unchanged. Recordings, masks, model weights, cache data and visual evidence
remain local and ignored by Git.
