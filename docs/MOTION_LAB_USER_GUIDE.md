# Motion Lab User Guide

1. Keep a supported video in the repository root. IMG_0135.MOV is preferred;
   DEMO_VIDEO can name another root MOV/MP4/M4V/WebM. Videos stay local and ignored.
2. npm install, npm run dev, then open http://localhost:5173/motion.
3. Wait for the local browser preview. Existing cached analyses load automatically
   and need no new inference. For new analysis wait for Pose model ready; the
   first model load downloads only the public model.
4. Play/pause/seek first, or Analyze Frame to verify the current image.
5. Select 10/15/30 analysis FPS; 15 is the default. Analyze Motion samples the
   real clip, reports processed/detected/missing counts and permits cancellation.
6. Use the source-time scrubber, frame/keyframe arrows and playback speed. Both
   the 2D overlay and estimated 3D skeleton follow the same source-video time.
7. The default 4D Video view overlays the source with current pose, four ghosts
   at 0.15-second intervals, both wrist trails/full prior history and depth.
   Display & Trails includes depth, axes, time dots, composites, manual keyframe
   poses and Fit/Fill. Future trails require opt-in. Freeze Motion pauses with
   prior history visible; Full Motion Composite deliberately includes the clip's
   future poses. Click a joint/trail point for XYZT, drag or hide the video card.
8. Switch to Split View or 3D Motion for orbit/pan/zoom and presets/reset.
9. Pause at a desired golf moment, choose a name and Add Keyframe. These are
   manual annotations, not automatic phase recognition. Click a keyframe to seek;
   its adjacent X removes it. Duplicate names at different times are allowed.
10. Select a joint (including Hip center) to inspect X/Y/Z/T/confidence and
    estimated velocity. Open Motion Graphs & Data for coordinates/wrist speeds
    and a paginated table. Missing or unreliable values stay unavailable.
11. Analysis JSON exports local data. Choose Original Video, 4D Video View, 3D
    or Split PNG and Capture Current 4D View. Original exports the native frame
    without overlays/cropping. Fullscreen 4D Video includes its timeline controls.
12. Save with Project attaches analysis identity, media reference, keyframes and
    display settings to the existing room project, without embedding video.
    Automatic analysis caching retains annotations and settings between sessions.
13. Experimental Club Head Annotation: pause, click the club head in the source,
    step/seek and repeat. A click at the same time corrects that point. The pink
    path is 2D only. Clear club annotations removes all these manual points.

Local Media loads a selected file as an in-browser object URL; it is not uploaded.
Use browser-compatible MP4/WebM. For an undecodable MOV/HEVC file, put it in the
root so local FFmpeg can prepare it. Local-file stepping uses an explicitly
labeled 30 FPS assumption because browser metadata does not expose source FPS.
Reselect local files after reload. Whole-video analysis currently accepts clips
up to two minutes. No root file is required when using a playable Local Media file.

Motion Diagnostics includes video/decoded/sample times, model status, inference
time, analysis FPS, frame index, confidence, 3D availability and cache status.
Retry model after a loading error. Reanalyze to replace corrupt cache data.
If FFmpeg/probe cannot run, install dependencies or set FFMPEG_PATH/FFPROBE_PATH
to local executable paths and restart. Missing media/errors are shown explicitly.

Depth is estimated from a single camera, not professional motion-capture measurement.

See [4D Video architecture and verification](MOTION_VIDEO_VIEW.md).
