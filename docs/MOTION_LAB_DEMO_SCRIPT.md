# Golf 4D Demo Script

1. Open 4D Motion Lab at localhost. Show the discovered root filename and actual
   duration/resolution/FPS/codec/orientation, rather than a preset demo.
2. Play/pause and seek. Explain that preview preparation is local and source is intact.
3. Wait for Pose model ready. Analyze Frame, then Analyze Motion at 15 FPS.
4. Show progress and actual detected/missing counts. No phone/camera/marker is needed.
5. In Split View, play source footage and observe synchronized 2D/estimated 3D poses.
6. Enable wrist trails and Ghost Poses; scrub to reveal pose changes through time T.
7. Pause at real stance, swing top, impact and follow-through moments. Add manual
   Address/Top/Impact/Follow-through keyframes at those chosen times; do not assert
   an automatic golf-phase diagnosis.
8. Click keyframes; compare source and 3D. Select Side and orbit the 3D view.
9. Select Right wrist. Show X/Y/Z/T, confidence, estimated velocity and graphs.
10. Optionally annotate club-head positions manually; show its 2D-only pink path.
11. Capture Split PNG and export Analysis JSON. Both downloads remain local.
12. Save with Project, reopen Motion Lab and show cached analysis/keyframes/settings.

Closing caution: single-camera depth and velocity are estimates, not professional
biomechanical measurements or an exact 3D scan. Source video is never pushed to GitHub.
