# Limitations

- Approximate planning model, not automatic room reconstruction, native ARKit,
  LiDAR, RoomPlan, SLAM or professional surveying.
- Manual calibration assumes camera pose/FOV and Y=0 floor. Three image clicks and
  a distance do not uniquely recover arbitrary camera intrinsics/extrinsics.
  Keep the camera fixed and recalibrate after camera/source changes.
- Marker tracking assumes a flat correctly measured ID 100 reference and suitable
  vertical FOV. Unknown lens distortion, oblique views, blur and lighting add
  error. Physical alignment accuracy has not yet been measured.
- Loss holds the last pose and warns; it cannot follow a moving room view without
  a visible marker. There is no real-object depth occlusion or semantic analysis.
- Overlap uses axis-aligned Box3 bounds, not oriented collision meshes, physics or
  walkability. Measurements are calibrated floor-ray distances, not depth sensing.
- Models are recognizable primitives, not photorealistic GLBs. Local GLB loading
  is a developer extension; arbitrary user model imports are not shipped.
- T is ordered layout state, not recorded historical time. Calibration and room
  measurements are shared across states.
- Split comparison shares one camera/projection. PNG excludes DOM badges and
  marker annotations; JSON excludes media, credentials and transient tracking.
- Storage keeps one valid previous backup, not unlimited history or multi-tab
  conflict resolution. Export JSON before major changes. Unknown schema/model
  versions are rejected, not automatically migrated.
- No TURN/cloud fallback, collaboration or motion-sensor fusion. Guest Wi-Fi,
  VPN/firewalls and isolation can block streaming. Safari may suspend when locked.
- CA trust is a private-LAN development workflow. Remove the profile after use.
  Never expose services or private keys to the Internet.
- Chromium synthetic capture uses actual WebRTC but does not prove physical
  iPhone 16e/Safari, lens selection, Wi-Fi latency or marker stability.
- The primary fixed-webcam workflow is tested with real browser capture using a
  synthetic Chromium device, not a physical Windows webcam. Manual alignment
  requires a fixed mount and recalibration after movement; hardware accuracy
  remains unmeasured. iPhone and marker tests are secondary, not prerequisites.
- Performance depends on GPU, objects, browser and video size. Schema ceilings
  of 50 states/500 furniture per state are not interactive-performance guarantees.
