# Visualization Audit

2026-10-04 baseline c81e297. Scope: Research renderers, timeline, charts,
inspector, exports and localhost conversion; not the human/camera pipelines.

| Area | Baseline | Planned Increment |
| --- | --- | --- |
| Source/tracks/depth/events/cache | Working local analysis | Preserve bytes, IDs and algorithms |
| Spatial AUTO and selection | Working same-track clock/color/selection | Preserve fallback and missing-current context |
| Occupancy | Real 32x32 weighted samples, hard cells | Gaussian display field; keep/export raw bins |
| Density time | Whole clip or past | Recent window and shared selected interval |
| Trajectories | Recorded past/full, fixed colors | Age/width hierarchy, sparse real timestamps, nearby filtering |
| Uncertainty | Quality halo; combined Q is ambiguous | Separate track/detection, depth and spatial quality; weak dashed proxies |
| Graphs | Numeric series gated, moving cursor | Range gating, spatial-quality series, click-to-seek |
| Timeline | Observed/automatic event/pair lanes | Gap/overlap indicators, shared interval, manual notes/bookmarks separately |
| Presentation | Split/fullscreen includes controls | Compact shell, status/transport and optional inspector |
| Exports | 11 JSON/CSV/PNG/WebM modes | Presentation/density PNG, raw-bin CSV, optional local MP4 with WebM fallback |
| Identity diagnostics | Unknown switches, continuity | Keep Unknown; observed-gap indicators are not verified identity recovery |

Density smoothing is visualization, not new animal positions or probability.
Manual notes are user annotations, not automatic events. No appearance-based
identity accuracy or ground-truth occlusion is available. The separate human
Motion Lab retains its human terminology; it is not wildlife UI.

## Delivered

- Gaussian occupancy, three kernel radii, opacity, scopes and raw-bin CSV/PNG.
- Shared interval filtering for paths, density, graphs and pair summaries.
- Age-faded trails, nearby focus, real sparse timestamps, selected NOW marker,
  weak/dashed geometry and separate detection/depth/spatial-quality legend.
- Data-gated graph seeking/cursor, striped observed gaps and uncertain recovery.
- Source-bound manual notes/bookmarks, separate from AUTO events, quick navigation.
- Collapsed configuration/inspector, clean presentation/fullscreen and PNG export.
- Local guarded FFmpeg H.264 conversion with cancellation, cleanup and WebM fallback.

No tracking, segmentation, depth, event derivation or cache schema was replaced.
Density zoom crops the field instead of accumulating offscreen observations at
viewport edges. Heatmap exports retain full-clip projection bounds.

## Verification

2026-10-04: lint/typecheck/build and 101 unit tests passed. Nine Research browser
tests passed, including explicit MP4-failure WebM fallback. Production smoke
passed (webcam/planner/Cube Lab/phone bundle paths).

Real current wildlife cache passed in development and compiled production:
75 samples, seven histories, 208 masks, 40 automatic geometric hypotheses;
all 15 exports, decoded WebM and H.264; same IDs/time/selection; each track
selected, including #01/#03/#04; #01+#04 range/graph/pair synchronization;
whole/recent/range density, no per-frame whole-clip density rebuilds,
no inference during playback, moving nonblank Three.js and mobile canvases,
1920x1080 presentation without page scrolling and fullscreen composition.
Desktop, mobile, fullscreen and slide exports were visually inspected.

Actual all-subject density retains 77 raw occupied bins and 41.6 estimated
sampled subject-seconds. Gaussian convolution conserves mass; it does not
create additional observed positions or certify precise dwell time.

Source SHA-256 is unchanged:
4da79a8f6132ad3921cf51a73134ed850214730ba7321a71d2a37acb557a55d0.
The v2 JSON cache SHA-256 remained
ad883fdf93419f61a2011b4392f10e388a63b2ac04d1f67192be517fd1e4f026.
Private exports/screenshots are ignored under test-results and .local.

Full-suite caveat: the separate generated-moving-marker Cube Lab recording
test returned zero store samples in two suite runs. Its source/runtime modules
are unchanged by this pass. The compiled production static-marker recording
smoke passed. Do not claim all repository browser tests passed; this independent
moving-marker test needs separate investigation. Initial cold-start webcam/
WebRTC flakes passed on the second suite run. The presentation failure in that
run was fixed and the nine focused Research tests passed afterward.

## Remaining Limits

Depth/scale remain monocular estimates unless approximately calibrated.
Tracking association confidence and identity switches are Unknown, not zero.
Recovery and occlusion labels are observation/overlap hypotheses, not identity
ground truth. The optional Three.js inspector retains its existing orbit/preset
interface; map-specific density/centroid/timestamp controls are hidden there.
UI targets responsive playback; no hardware-independent 60 FPS guarantee is made.
