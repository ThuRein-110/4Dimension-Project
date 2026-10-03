# Golf 4D Demo Script

1. Open 4D Motion Lab at localhost. Show the discovered root filename and actual
   duration/resolution/FPS/codec/orientation, rather than a preset demo.
2. Play/pause and seek. Explain that preview preparation is local and source is intact.
3. Reuse the existing cache. For new footage wait for Pose model ready and Analyze
   Motion at 15 FPS; do not unnecessarily replace an existing analysis.
4. Show actual detected/missing counts. No phone/camera/marker is needed.
5. In the default 4D Video view, play source footage with synchronized skeleton,
   estimated depth, wrist trails and four historical ghosts.
6. Scrub and Freeze Motion to reveal pose changes through time T.
7. Pause at real stance, swing top, impact and follow-through moments. Add manual
   Address/Top/Impact/Follow-through keyframes at those chosen times; do not assert
   an automatic golf-phase diagnosis.
8. Click keyframes to seek exactly. Enable Keyframe Poses or Full Motion Composite;
   note that composites intentionally include multiple times from the whole clip.
9. Click a confident Right wrist in the video. Show X/Y/Z/T, depth vector,
   confidence and estimated velocity. Drag/hide the card. Switch to optional Split
   or 3D Motion for Side/orbit inspection and Data for graphs.
10. Optionally annotate club-head positions manually; show its 2D-only pink path.
11. Fullscreen 4D Video includes transport. Capture 4D Video View PNG and export
    Analysis JSON. Both downloads remain local; Original/3D/Split PNG also remain.
12. Save with Project, reopen Motion Lab and show cached analysis/keyframes/settings.

Closing caution: single-camera depth and velocity are estimates, not professional
biomechanical measurements or an exact 3D scan. Source video is never pushed to GitHub.
