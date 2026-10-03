# Motion Lab Architecture

## Boundaries

The /motion route is lazy and separate from room and Cube Lab engines. Navigation
uses browser history without discarding the in-memory room project. Leaving the
camera workspace unmounts DesktopApp and releases its owned webcam stream/peer.
No camera, iPhone, marker or cloud AI is needed for Motion Lab.

Express /api/motion endpoints are loopback-only, allow localhost hostnames only,
reject cross-origin/cross-site requests, and require the desktop header on writes.
Vite denies direct video, .local and .cache filesystem URLs, including /@fs paths.
Production serves dist/web, not the repository root. Stream API accepts a hash,
not a path. Discovery considers only regular root-level MOV/MP4/M4V/WebM files;
symlinks and configured paths are rejected. IMG_0135.MOV is preferred; otherwise
names are sorted. DEMO_VIDEO selects an existing root filename.

## Media Preparation

VideoPreparationService probes with ffprobe-static (or FFPROBE_PATH). Codec,
stored/display resolution, rational FPS, duration, rotation and pixel format
come from the video. ffmpeg-static (or FFMPEG_PATH) creates a silent H.264/yuv420p
MP4 with faststart for MOV, rotated, non-H.264 or incompatible pixel formats.
FFmpeg autorotation normalizes pixels. Original media is not changed. Jobs are
deduplicated and output is renamed atomically. Preparation state is polled.
Express sendFile handles byte ranges without buffering entire videos.

Probed metadata is validated, atomically cached as source-keyed JSON and reused;
corrupt metadata is reprobed. Concurrent metadata reads share one probe job.
Cache identity hashes filename, size, mtime and preparation version. Outputs are
under ignored .cache/4dlivespace/video. Private model downloads are not required:
only the public model is fetched, from its fixed official URL, into the ignored
models cache. No input image or video is sent in that request. WASM is served
from the pinned npm package locally. Offline use works after installation and
the first model download.

## Inference

PoseEngine owns a module worker using pinned @mediapipe/tasks-vision 1.0.1 and
the official Pose Landmarker Lite float16 revision 1 model. API signatures were
verified in installed vision.d.ts and the official
[Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js).
FilesetResolver.forVisionTasks(..., true) uses module-compatible WASM.
PoseLandmarker.createFromOptions configures CPU, VIDEO and one person;
detectForVideo receives transferred ImageBitmap frames and monotonic timestamps.
Model graph is reset between independent runs. Worker resources are terminated
on route exit; pending requests reject instead of leaking.

MotionAnalysisController creates a separate local decoder, seeks controlled
10/15/30 FPS timestamps and records actual resulting video.currentTime. The
source player stays paused and responsive. Every successful processed frame
increments progress; missing poses produce empty invalid samples, not invented
landmarks. Cancel aborts decode waits and stops after any in-flight inference.
Decode/inference waits have bounded timeouts. First-frame proof is not saved over
the full-video cache. Whole-video analysis is limited to two-minute clips to
bound memory and the 64 MB disk-cache payload; single-frame review is independent.

## Coordinates And Time

All 33 IDs and skeleton edges follow MediaPipe. Original model coordinates
are retained in JSON. 2D x/y are normalized to upright decoded image dimensions;
contain/cover contentRect applies the same letterbox/crop to video and overlay.
No mirrored camera transform is applied to the file.

Model world landmarks are estimated hip-relative coordinates. The central mapper
is Three = (x, -y, -z), with Y up and positive Z toward the viewing camera.
Without world landmarks, normalized image landmarks are centered on the mean of
hips 23/24; the model's own normalized z is retained. This fallback is labeled
normalized and not metric. No measured room placement or global body translation
is reconstructed. The fixed floor is a visual reference, not calibration.

Video currentTime is the master clock. Both render loops look up the same time.
Binary sample lookup linearly interpolates adjacent valid samples; gaps over
0.2 s, missing samples and low-visibility joints remain unavailable. React
updates transport/inspector around 12 Hz, not Three object transforms. Decoded
frame time is recorded via requestVideoFrameCallback for diagnostics.

Trails end at T unless Future is enabled and do not bridge missing poses or
representation changes. Ghosts use T minus interval times count. Velocity is
finite-difference nearby valid model coordinates; no exact m/s claim. Manual
club clicks store normalized 2D x/y and T only; no fabricated club z or phases.

## Persistence And Export

Versioned Zod analysis schema validates finite landmarks/order/counts/timestamps.
Analysis ID hashes source identity, FPS, pinned model version and schema version.
IndexedDB and ignored .cache/4dlivespace/motion JSON keep compatible analyses,
keyframes, club annotations and display settings. Writes are serialized and
atomic. Invalid caches produce a useful error and can be overwritten by Analyze.
Projects retain optional motion references, manual keyframes and display settings;
no video, pose arrays or blobs are embedded in room JSON. Existing v1 projects
without a motion field remain valid. Save with Project attaches the current take.
Local Media files must be reselected after a reload; browser file access is not
persisted. Normalized fallback velocity and world velocity are never mixed.

JSON export includes metadata, schema/model/landmark definitions, samples,
annotations/settings, detection counts and derived wrist speeds. PNG export
composes current decoded video, aligned 2D overlay and/or preserved 3D canvas.
All screenshots/data remain local; Git ignores root videos and generated caches.

## Rendering

4D Video is now the primary view. MotionProjectionService centralizes image
projection and temporal selection; MotionOverlayRenderer shares live/export
rendering with cached joint tracks, real ghosts, depth vectors, historical-point
selection and bounded draggable cards. Legacy display settings migrate without
changing inference/cache identity. The fullscreen presentation owns the video
and timeline together. See [4D Video details](MOTION_VIDEO_VIEW.md).

MotionSkeletonRenderer owns shared sphere geometry, joint materials and reusable
bone buffers. Motion3DView owns camera/OrbitControls, reference grid/axes, bounded
ghost groups and trail buffers. ResizeObserver sizes the canvas; WebGL failures
do not stop 2D review. Renderers, controls, geometries, materials and frame loops
are disposed on exit. uPlot charts are lazy-visible, resize and destroy cleanly.
