# Maximum 4D Reality Audit

Baseline: commit f29db04, audited 2026-10-03 before extension. Code paths:
`scripts/research/analyze.py`, server research service/routes, shared research
schema/events and every Research View renderer, inspector, chart, transport and
export. Existing camera, planner, Cube Lab and human Motion Lab remain separate.
Baseline real cache: 75 samples, seven track histories, 206 masks; selected
frames contain one to four observed animals. Baseline browser integration is
re-run, not inferred from panel names. No labeled identity ground truth exists.

WORKING means functioning output, not scientific ground truth. PARTIAL means
useful output with a missing capability. EXPERIMENTAL means an unvalidated
estimate. BROKEN includes availability handling that produces misleading UI.
PLACEHOLDER/UNUSED means no implemented data path. Scores are quality indices,
not calibrated probabilities.

| Feature | Baseline | Data / algorithm | Current clip and limitations | Normal UI decision |
| --- | --- | --- | --- | --- |
| Animal detection | WORKING | Real decoded frames, pinned Grounding DINO Tiny, class-agnostic NMS | Multiple animals visible; small/overlapping detections can be missed | Keep with scores |
| Species classification | PARTIAL | Prompt labels and track voting | Central animal is animal_unknown; hyena/canine labels are hypotheses; final-frame score improperly affects whole-track score | Keep unknown; do not force lion label; improve aggregation |
| Segmentation | WORKING | Actual SAM 2.1 Tiny box-prompted masks | 206 contours align with animals in inspected frames; small masks/overlap still fail | Keep outline default, fill/off optional |
| Multi-object tracking | PARTIAL | Supervision 0.27 ByteTrack Kalman/IoU | Tracks persist through short misses; detector cutoff removes low-score recovery candidates | Keep; restore low-confidence recovery |
| Track ID stability | PARTIAL | ByteTrack association, 3-second lost buffer | Seven histories are not certified seven unique animals; crossings/long gaps can switch IDs; no appearance re-identification | Expose continuity quality and uncertainty, never zero verified switches |
| Depth estimation | EXPERIMENTAL | Depth Anything V2 Small, median mask inverse depth | Real model depth for all 206 observations; quality capped 0.65, not probability | Keep relative only; temporal smoothing needed |
| Depth normalization | WORKING | Clip-wide depth quantiles | Not independently rescaled each frame; does not compensate moving camera | Keep common scale |
| Scene projection | EXPERIMENTAL | Assumed focal length 0.9 width, x=(u-0.5)z/f | Visible subjects; no camera recovery or metric scale | Auto-gate and provide 2.5D/2D fallback |
| Ground-plane mapping | EXPERIMENTAL | Assumed y=half inferred height on flat reference | No inferred horizon/contact calibration; grid is a diagram, not recovered terrain | Label reference plane; add optional manual reference |
| Body proxies / size | EXPERIMENTAL | Ellipsoid/head dimensions from boxes and relative depth | Visible bodies, no anatomy/facing evidence; size jumps possible | Smooth, label inferred footprint |
| Right Three.js renderer | BROKEN availability; WORKING render | Real cached positions, OrbitControls | Nonblank with valid clip data, but renders a decorative empty grid without valid subjects | Gate per segment; meaningful map fallback; hide grid when unavailable |
| Trajectories | WORKING | Actual observation histories with gap breaks | Visible and time driven, no full-history presentation toggle | Keep short default; explicit full-clip composite |
| Ghosts | WORKING | Real nearest historical samples | Visible, no future prediction; timestamps sampled | Keep optional, reduce default clutter |
| Pair distances | EXPERIMENTAL | Normalized image and inferred xyz Euclidean separation | Current/min/mean/closest-image T work; weak depth is not excluded | Gate scene distance; add closest-scene T/all-pair table |
| Velocity | PARTIAL | Finite differences of raw positions | Maximum baseline speed about 2.86 relative units/s; camera/depth jitter contributes | Smoothed relative speed only |
| Acceleration | PARTIAL | Raw second differences | Maximum baseline about 18.62 units/s2; unvalidated/noisy | Hide unless sufficiently stable; advanced only |
| Heading | PARTIAL | EMA motion-vector angle | Not anatomical facing; derivative jitter can flip direction | Smooth with speed hysteresis; suppress unknown |
| Event analysis | EXPERIMENTAL | Image-distance derivative, speed thresholds, angular coverage | 77 heuristic hypotheses, not behavior diagnoses; no sustained evidence | Add explicit evidence and persistence gates |
| Interaction analysis | PARTIAL | Selected pair relative heading/speed and events | Pair inspector works, missing automatic all-pair/group analytics | Keep supported metrics; add group geometry |
| Heatmaps | PARTIAL / UNUSED activity | Real depth thumbnail coloration; no track activity histogram | Depth visualization works; no activity heatmap implementation | Add actual occupancy/interaction bins; never synthetic density |
| Timeline | WORKING / PARTIAL lanes | video.currentTime, actual observations/event ticks | Synchronization and stepping verified; lanes collapsed, no sample/frame readout | Add visible lanes and closest-approach markers |
| Graphs | BROKEN availability; WORKING data | uPlot detection score/nearest image separation | Correct cached series, but all-null selection still creates empty plot | Hide insufficient series; add genuine depth/speed/pair plots |
| Inspector | BROKEN availability; WORKING values | Selected sample/track and pair summary | Many meaningless unavailable fields on missing tracks | Show observed values only; explicit unobserved state |
| Exports | WORKING / PARTIAL | Browser JSON/CSV/PNG and local silent WebM recorder | Eight exports decode; no pair CSV/Markdown/full snapshot metrics or MP4 | Add working scientific exports; keep WebM fallback |
| Diagnostics | PARTIAL | Cached counts/model timings/status | Depth reported available whenever a frame exists; no continuity quality/validity counts | Report actual availability; unknown switches stay unknown |
| Metric calibration | UNUSED | No research calibration | Not meters | Optional A/B scale with severe assumptions, horizon/ground controls |
| Optical flow / prediction | UNUSED | No data path | Not performed | Do not expose controls or claim capability |
| Neural volumetric capture / animal pose | UNUSED | No data path or required hardware | Not performed | Future architecture only; no normal UI |

## Implementation Priorities

1. Restore tracker recovery candidates; aggregate class scores correctly.
2. Preserve raw observations and derive quality-gated smoothed depth, size,
   positions, velocities and heading. Do not interpolate animals into missing
   frames or claim verified identity-switch counts.
3. AUTO spatial selection: estimated 3D only with sufficient quality; relative
   X/Z top-down for partial geometry; normalized depth diagram for weak depth;
   actual image trajectory map without depth. No subjects means an explicit
   unavailable message and original-video alternative, not an empty grid.
4. Actual pair/group analytics, occupancy density, visible timeline lanes,
   quality-gated graphs/inspector and exports. Experimental angular geometry and
   acceleration stay under Advanced. Prediction/flow remain optional future work.

## Scientific Boundary

4D LiveSpace performs monocular spatiotemporal scene analysis by combining
object detection, instance segmentation, multi-object tracking, monocular
depth estimation and temporal analytics to estimate how subjects move
through 3D space over time.

Because the source is a single uncalibrated camera, depth and physical
distance are estimates rather than ground-truth measurements.

References: [ByteTrack implementation](https://supervision.roboflow.com/0.24.0/trackers/)
documents the two-stage association and FPS-scaled lost buffer. Installed
0.27.0 source is checked before changing parameters. The actual pinned model
revisions and licenses remain in [Research View](RESEARCH_VIEW.md).

This file records the baseline honestly. Post-change evidence and remaining
limits are appended after implementation verification, not preemptively marked
WORKING.

## Post-Change Reality

The v2 pipeline retains the existing local models rather than replacing them.
Model weights, source video, all caches and visual evidence remain private.

| Feature | Current Classification | Change / Remaining Boundary |
| --- | --- | --- |
| Animal detection | WORKING | Real pinned DINO; weak candidates retained for recovery only |
| Species classification | PARTIAL | Whole-track confidence aggregation corrected; central animal remains unknown |
| Segmentation | WORKING | 208 real masks; outline default; overlapping/small subjects remain difficult |
| Multi-object tracking | PARTIAL | ByteTrack low-score second-stage recovery restored; no appearance ReID |
| Track ID stability | PARTIAL | 7 histories; continuity and image-jump warnings visible; actual switches Unknown |
| Track Quality | EXPERIMENTAL | Detection + continuity + jump-warning index, not identity accuracy or probability |
| Depth estimation | EXPERIMENTAL | Real relative model output with causal EMA and variability quality penalty |
| Depth normalization | WORKING | Existing clip-wide quantiles retained; raw samples preserved |
| Scene projection | EXPERIMENTAL | Same assumed camera; per-segment AUTO falls back to useful real data |
| Ground-plane mapping | EXPERIMENTAL | Explicit reference plane; manual region gates unsupported contact points; no terrain recovery |
| Body proxies / size | EXPERIMENTAL | Smoothed footprint ellipsoid/head; heading is motion, not facing/anatomy |
| Right renderer / fallback | WORKING | Current clip AUTO top-down; explicit valid Three.js mode; weak depth diagram/image fallback; empty segments explicit |
| Trajectories | WORKING | Recorded histories, gap breaks/time fade, short default and explicit full-clip composite |
| Ghosts | WORKING | Real earlier observations only, no generated future states |
| Pair distances / closest approach | EXPERIMENTAL | Actual co-observations; weak depth excluded; min/mean/closest time and all-pair export |
| Velocity | EXPERIMENTAL | Causal quality-gated relative derivatives; no velocity across long gaps/large image jumps |
| Acceleration | EXPERIMENTAL | Only sufficiently stable computed samples, hidden outside Advanced |
| Heading | EXPERIMENTAL | Circular smoothing, rate limit and speed hysteresis; not animal facing |
| Event analysis | EXPERIMENTAL | 40 persistent geometric hypotheses with coordinate/value/window evidence; not intent |
| Interaction / group analytics | EXPERIMENTAL | Actual pair geometry and group centroid/spread/nearest/farthest; angular encirclement Advanced only |
| Activity heatmaps | WORKING | Occupied bins from actual recorded coordinates/time; proximity density not biological interaction |
| Timeline | WORKING | VIDEO/track/EVENTS/pair lanes, source-frame/sample distinction, single video clock |
| Graphs | WORKING | Only actual numeric series with at least 2 observations; unsupported choices hidden |
| Inspector | WORKING | Missing subject state explicit; unsupported current geometry/derivatives omitted |
| Exports | WORKING / PARTIAL MP4 | 11 JSON/CSV/Markdown/PNG/WebM modes; snapshot includes metrics/time/lanes; MP4 not implemented |
| Diagnostics | WORKING | Actual model/count/quality/source/frame/sample data; no fake READY or verified switch counts |
| Manual scale / references | EXPERIMENTAL | A/B known distance scales inferred scene; same-time/source guards; horizon visual only; no reload persistence |
| Human Motion Lab empty grid | WORKING availability fix | Separate human mode retained; invalid segments hide floor/axes/ghosts/trails and disable pose controls |
| Optical flow / prediction | UNUSED | Not implemented, no misleading UI |
| Neural capture / animal keypoints / calibrated multicamera | UNUSED | Future modules, not claimed capabilities |

## Verified Evidence

Fresh local CUDA run on the unchanged 15-second root wildlife recording:
75 samples, 7 track histories, 208 SAM contours, 40 persistent geometric events.
Track 1 has 58 observed samples, 85.3% sampled continuity and 10 missing samples
inside its observed span; other histories have 13-42 observations. The quality
indices are approximately 0.686-0.783. Seven histories are not certified seven
physical animals. No labeled identity-switch test exists; switches remain null.

On consecutive observations at most 0.65 seconds apart, mean absolute inferred
depth change falls from 0.107813 with EMA Off to 0.062384 at Medium (42.1% less).
This demonstrates reduced jitter, not improved depth ground-truth accuracy.
Maximum known-heading change per consecutive pair is 36 degrees at Medium;
Off still retains quality/hysteresis/rate-limit safety gates (72 degrees maximum
in this measured clip). Missing observations are never synthesized.

The actual-clip integration runs local inference through the UI, validates the
cache and byte digest, AUTO X/Z map, real-time changes, explicit moving Three.js
subjects, desktop/mobile nonblank pixels, fullscreen, global selection/pairs,
timeline synchronization, activity bins, manual scale/clear, all 11 exports,
decoded annotated WebM/cancellation and cache-only reload. Browser requests to
external hosts are blocked during this verification. Synthetic CI fixtures are
separate and clearly named; they are not evidence of real animal inference.

Source digest for this fresh prepared input:
`4da79a8f6132ad3921cf51a73134ed850214730ba7321a71d2a37acb557a55d0`.
Cache identity binds source metadata/pipeline/settings, with pinned model IDs and
revisions recorded. The digest is additional analysis evidence; playback does
not rehash every source byte or detect malicious preserved-metadata replacement.

Final checks: lint, strict typecheck, 88 unit tests, all 53 browser tests, production
build and compiled-production smoke passed. The actual-clip integration passed
fresh local reanalysis in development and cached playback in the compiled
production UI. Desktop/mobile screenshots were inspected. An intermediate full
suite hit an intermittent existing Cube Lab recording timeout; the final full
rerun passed without modifying Cube Lab. Existing Vite large-chunk warnings remain.

Remaining scientific limits: camera movement, cuts, overlapping animals and
uncertain classification can corrupt geometry and identity. Approximate manual
scale cannot fix camera pose or establish exact metres. No flow, appearance ReID,
animal skeleton, predicted track, biological classifier or volumetric capture
is presented as complete. Annotated WebM is the working video export; MP4 remains
unimplemented rather than adding an unverified transcode/upload path.
