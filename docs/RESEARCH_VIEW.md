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

Split is the default: original video observations left, inferred 3D scene right.
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

Overlays / Trails / Scene controls masks, labels, trails, past ghosts, relative
depth heatmaps, uncertainty, floor and camera frustum. Ghosts and trajectories
use recorded past observations only. Heading arrows describe estimated motion;
the illustrative proxy head does not prove facing direction.

Export supports combined report JSON, per-frame JSON, track/event CSV, annotated
PNG, 3D PNG, split PNG and a silent annotated WebM. WebM is recorded locally in
real time through a separate decoder; it does not move the interactive timeline.
It can be cancelled. No export contains calibrated meters or true animal anatomy.

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
histories, 206 SAM 2 masks and 77 heuristic event hypotheses on local CUDA.
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
Physical calibration, animal re-identification, anatomy/keypoints, camera-motion
compensation and validated biological interpretation remain future work.
