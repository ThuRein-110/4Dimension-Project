# Monocular 4D Research View

## Repository Audit

The existing Motion Lab analyzes one human with MediaPipe's 33 landmarks. Its
human data, timeline, manual keyframes, exports and optional Three.js inspection
remain intact. Root media ingestion, FFmpeg preparation, timestamped cache
identity and localhost-only routes can be reused. Wildlife cannot be represented
honestly by the human skeleton schema, so `/research` adds a separate analysis
schema, runtime and viewer inside the same application shell.

## Pipeline And Sources

Local decoded frames feed open-vocabulary
[Grounding DINO](https://huggingface.co/docs/transformers/v4.57.1/model_doc/grounding-dino),
box-prompted [SAM 2](https://huggingface.co/docs/transformers/v4.57.1/model_doc/sam2),
[ByteTrack](https://supervision.roboflow.com/trackers/), and
[Depth Anything V2 Small](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf).
Detection prompts include lion, hyena and generic animal. They are model label
estimates, not verified zoological classification. No animal keypoints are assumed.
Models use local inference; only public model/dependency downloads need network.

The small depth model produces relative inverse depth, not metric distance.
Scene grounding uses an assumed pinhole camera, a flat reference ground plane,
and clip-wide relative-depth normalization. Proxy proportions are inferred from
observed boxes/masks, not reconstructed anatomy. Heading is motion direction,
not an assertion of where an animal is facing. Camera motion and scene edits
can confound velocities, depths and identities. Events are threshold-based
kinematic hypotheses, not biological behavior diagnoses.

## Installation

Run `powershell -ExecutionPolicy Bypass -File scripts/setup-research.ps1` with
Python 3.12 installed. The isolated runtime lives in ignored `.local`. Optional
`-Cuda` installs the CUDA wheel for supported NVIDIA hardware; CPU also works.
Model weights and all derived media/data live under ignored `.cache`.
Never commit recordings, models, masks, exported video or generated reports.

Model cards list Grounding DINO and SAM 2 under Apache-2.0 and Depth Anything V2
Small under Apache-2.0. Dependencies retain their respective licenses; this
integration does not relicense the existing application.

## Workflow

Open `http://localhost:5173/research`, or use the 4D Research View workspace link.
The current root recording loads automatically. Local Media copies another
recording into the ignored private cache on this PC, not to GitHub or a model
provider. Root Video returns to the existing root media source. Limits are
256 MB per import and 120 seconds per analysis. Original recordings are untouched.

Analyze Wildlife runs detection, masks, tracking and depth once. The default
is 5 sampled FPS with a 0.23 detector threshold. Cancel stops the local worker;
Reanalyze explicitly replaces a cache. Subsequent visits reuse validated results
bound to source identity, pipeline version, sample rate and threshold. Replacing
the recording clears stale tracks, selection and comparison.

Split is the default: original video observations left, AUTO spatial view right.
AUTO chooses estimated 3D only with sufficient body/depth quality, X/Z top-down
for partial geometry, a relative-depth diagram for weak depth, or image-space
trajectories without subject depth. Empty segments show an explicit unavailable
message, not a decorative grid. The separate human Motion Lab now also hides its
grid and pose controls when its current segment has no valid human pose.
Video, 3D Research and Data are alternate views. Both canvases read the source
video's currentTime directly; transport, frame stepping, events and visibility
spans seek that same clock. Between samples, the nearest real observation is
shown with its sample timestamp. Long gaps hide geometry rather than inventing
animal masks or exact poses.

Select an animal in the video or 3D viewport, or choose its ID in the inspector.
Compare With adds current/minimum/mean 2D and estimated 3D separation, closest
image-space approach, relative motion and an interval filter. The Data panel
offers subject and event tables, sample metrics, confidence/separation charts,
depth assumptions and diagnostics. Timeline events are heuristic hypotheses;
amber markers above 3D subjects indicate a recent event, not verified behavior.

Display & Analysis controls masks, labels, trails, past ghosts, relative
depth, uncertainty and optional reference floor/camera frustum. Ghosts and trajectories
use recorded past observations only. Heading arrows describe estimated motion;
the illustrative proxy head does not prove facing direction.

Outline masks, IDs and two-second trails are clean defaults; ghosts, boxes,
class labels and event tags are optional. Medium causal temporal smoothing is
default, with Off/Low/Medium/High choices. Raw samples remain in JSON. Large
gaps/image jumps reset derivatives; weak motion hides heading. Acceleration and
geometric encirclement require sufficient data and Advanced / Experimental.

Activity heatmaps default to whole-recorded-clip occupancy, including at T=0;
Observed Past to T is optional. Selected/all subjects, available class hypotheses,
observed interaction density and selected-pair proximity density are supported.
Spatial trajectories default to all observed past history rather than two seconds;
Current Position and Full Recorded Clip are explicit modes. Later recorded paths
are dashed and labeled, not predictions. Full Track History pauses playback and explicitly
shows the entire recorded clip, including later recorded observations, not forecasts.
See [Spatial Motion View](SPATIAL_MOTION_VIEW.md) for projection, occupancy weighting,
selection synchronization and limits. Missing-current segments retain real context
without creating a current subject. Screen heading now respects X/Z axis scaling.
Visible VIDEO/track/EVENTS/closest-pair lanes use actual samples. Source frame,
video T and analysis sample are separate readouts. Graphs require at least two
numeric observations; scene distances require usable depth for both subjects.

Optional Manual Research Reference accepts paused-frame A/B points and a known
distance. This scales inferred scene coordinates to approximate metres under an
assumed pinhole/ground model, not recovered camera calibration. Both points must
belong to one sampled reference time. Ground region rejects unsupported contact
locations; horizon is a visual reference only. Clear removes the scale. References
are source-bound and exported in JSON, but are not persisted across page reloads.

Export supports combined report JSON, per-frame JSON, track/event/pair CSV,
Markdown report, annotated PNG, spatial PNG, split PNG, a presentation snapshot
with selected metrics/time/track lanes, and a silent annotated WebM.
WebM is recorded locally in
real time through a separate decoder; it does not move the interactive timeline.
It can be cancelled. Optional H.264 MP4 conversion uses the existing local FFmpeg
through a localhost-only, desktop-header-gated endpoint. It accepts WebM up to
128 MB, one conversion at a time, at most 120 seconds and a bounded timeout.
Temporary recordings live outside the repository and are deleted after conversion.
If conversion is unavailable the original WebM is downloaded with an explicit warning.
No video is uploaded to GitHub or an external service. Uncalibrated results stay in
relative units; manual scale remains approximate. No export contains true anatomy.

## Visual And Temporal Refinement

Spatial Controls and Visual Refinement are collapsed by default. Medium
Gaussian display smoothing replaces hard bins; Low/Medium/High kernel radii are
0.65/1.2/2 histogram cells. Edge-normalized kernels preserve total sampled
subject-time. The density scale is normalized to the smoothed field maximum,
not probability. Raw-bin CSV preserves aggregate observations, projection,
units and range; Heatmap PNG uses full-recorded projection bounds. Occupancy is
a sample-interval estimate, clipped at the selected interval end, not exact dwell time.

Whole Clip, Past To T, Recent Window and shared Range scopes are available.
Temporal Window presets (0.5/1/2/5 seconds) limit recent trails and density.
The shared timeline range overrides those presets and updates trails, density,
graphs and pair interval summaries. Empty intervals do not produce fake charts.
Clear Analysis Range returns to full analysis. Trajectory mode remains separate;
Full Recorded may show later observations and never calls them predictions.

Selected subjects are strongest; other current proxies are reduced in opacity.
Trails fade with age and narrow toward older observations. Selected + Nearby
shows the selected/comparison histories and up to two co-observed nearest
subjects. Optional sparse trajectory timestamps use actual samples. Optional
ghosts remain past observations, and group centroid is a geometric projected mean.
Full Recorded Path, Selected Track and Auto Fit Active control map bounds.

Detection score, depth quality and spatial Q are shown separately. Spatial Q is
the minimum of detection/depth quality in a depth-bearing projection, not a
probability or identity confidence. Tracking association confidence is Unknown.
Weak geometry has faded/dashed outlines and wider rings. Gaps are striped
unobserved periods; observed-again markers are recovery hypotheses, not certified
identity continuity. Identity switches/unique-animal fragmentation remain Unknown.

Graphs require two valid numeric observations, follow the video clock, and
click-to-seek the source. Manual notes and bookmarks live in browser localStorage
bound to source identity; they never modify automatic events or the analysis cache.
The combined report adds a separate viewer section containing range/options/manual
annotations. Previous/Next Bookmark and Previous/Next Event navigate distinct sets.

Presentation Mode hides configuration, workspace navigation and data panels while
retaining source/spatial canvases, compact status, transport and an optional
collapsed inspector. Fullscreen uses that same layout. Presentation PNG omits
debug panels; Research Snapshot includes selected metrics and observed track lanes.
Both identify current time, selection/pair, spatial mode and estimated depth/scale.

## Verification And Remaining Limits

`npm run check`, `npm run test:e2e` and `npm run test:production` cover shared
validation, cache identities, command guards and existing camera/planner/human
regressions. Research CI uses explicitly labeled synthetic media/results only.
`npm run test:research` separately verifies the actual local recording and real
model cache, moving/nonblank desktop and mobile canvases, the master clock,
selection, comparison, fullscreen, all exports including decoded WebM, and no
playback inference. Generated evidence remains in ignored `test-results`.
Set `RESEARCH_URL=http://localhost:5174` for a running production instance, and
`RESEARCH_REANALYZE=1` to verify a fresh analysis through its UI rather than only
reusing the cache. Verification refuses non-localhost URLs and blocks external
browser requests.

The current 15-second lion/hyena clip produced 75 real samples, seven track
histories, 208 SAM 2 masks and 40 persistent geometric event hypotheses on local CUDA
with the v2 weak-detection recovery pipeline. Baseline v1 had 206 masks/77 events.
Not all seven tracks are visible at once, and they are not a certified count of
unique physical animals. The central animal's model classification remains
`animal_unknown`; surrounding animals are canine/hyena hypotheses. Do not
silently relabel uncertain predictions to match the expected species.

ByteTrack has short-gap persistence, but long occlusion, shot changes and camera
motion can switch identities. Visible status means detected/observed, not a
calibrated occlusion probability. Masks can miss small or overlapping animals.
Relative depth normalization cannot recover metric scale or compensate camera
motion. The flat ground and camera frustum are assumed illustrations, not SLAM
or calibrated camera recovery. Confidence/quality indices are not probabilities.
Verified physical calibration, appearance re-identification, anatomy/keypoints, camera-motion
compensation and validated biological interpretation remain future work.

Track quality combines mean detection score, sampled continuity and image-jump
warnings. Occlusion states use overlap/disappearance heuristics. Identity switches
are Unknown, not zero. Weak detections can recover existing ByteTrack IDs without
activating new weak tracks. Event evidence records coordinate system, value and
window; persistence suppresses transient approach/retreat labels. No flow or
predicted animal states are generated.

Cache v2 binds source metadata identity, pipeline and settings; model IDs/revisions
and tracker runtime are recorded. Fresh analyses also record the SHA-256 of the
actual prepared input bytes. This is audit evidence, not continuous rehashing on
every playback request. See [Maximum 4D Reality Audit](MAX_4D_REALITY_AUDIT.md).

4D LiveSpace performs monocular spatiotemporal scene analysis by combining
object detection, instance segmentation, multi-object tracking, monocular
depth estimation and temporal analytics to estimate how subjects move
through 3D space over time.

Because the source is a single uncalibrated camera, depth and physical
distance are estimates rather than ground-truth measurements.
