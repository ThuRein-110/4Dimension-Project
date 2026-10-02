# Motion Lab Limitations

- One monocular camera provides estimated depth, not volumetric reconstruction.
- World landmarks are hip-relative model estimates; not measured room coordinates.
  Root translation and actual body/club distances are not reconstructed.
- Visibility, camera angle, framing, occlusion, fast movement and blur affect pose.
  A detected frame does not guarantee every joint is accurate or visible.
- Low-visibility joints/missing frames are hidden; interpolation never fills gaps
  over 0.2 seconds. Sampling may miss a very fast impact at 10/15 FPS.
- Velocity is approximate model units/second, not calibrated professional biomechanics.
- Without model world landmarks, fallback uses normalized image coordinates and
  the model's normalized depth, clearly labeled non-metric.
- The floor/axes are visualization references, not physical floor calibration.
- One person is analyzed. Multi-person identity tracking is not implemented.
- Golf phases are manual keyframes. Club tracking is manual-assisted 2D annotation;
  thin/blurred club motion makes automatic tracking difficult. Optical flow,
  automatic phase suggestions and 3D club reconstruction are not claimed.
- Whole-video analysis is capped at two-minute clips to bound browser memory/cache
  payloads. CPU inference speed depends on the PC. Cancel completes after the
  current worker inference, not midway through synchronous model execution.
- Frame stepping uses nominal source FPS, not exact VFR frame indexing. Analysis
  timestamps record decoded-video seek time, with normal browser seek precision.
- Local Media needs browser codec support and re-selection after reload. Browser
  file metadata lacks codec/FPS/rotation; a labeled stepping assumption is used.
  Root-video FFprobe/FFmpeg is the metadata/compatibility path for unsupported files.
- The public model must be downloaded once. WASM/model and video processing then
  use local endpoints; dependencies/model download require Internet initially.
- Browser storage/disk quotas can prevent caching; errors are surfaced. Corrupt
  caches require reanalysis. Schema/model/FPS/source changes invalidate identities.
- PNG/analysis JSON export is supported; rendered visualization-video export is
  intentionally not implemented. No professional motion-capture certification.

Git ignores source videos, previews, model cache, personal analyses and screenshots.
Do not manually force-add those files. Exports in arbitrary folders are private
and should not be moved into tracked directories.
