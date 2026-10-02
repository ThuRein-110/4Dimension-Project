/* global importScripts, AR, POS */
let detector;
try {
  importScripts('/assets/vendor/aruco/cv.js', '/assets/vendor/aruco/aruco.js', '/assets/vendor/aruco/svd.js', '/assets/vendor/aruco/posit1.js');
  detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12', maxHammingDistance: 2 });
  self.postMessage({ type: 'ready', dictionary: 'ARUCO_MIP_36h12' });
} catch (error) { self.postMessage({ type: 'fatal', message: `Vision engine failed to initialize: ${String(error)}` }); }
self.onmessage = event => {
  const { width, height, buffer, markerSize, fov, markerId = 100 } = event.data;
  try {
    if (!detector) throw new Error('Vision engine is not initialized');
    const startedAt = performance.now();
    const markers = detector.detect({ width, height, data: new Uint8ClampedArray(buffer) });
    const diagnostics = { type: 'result', markers: markers.map(item => ({ id: item.id, corners: item.corners })), detectorMs: performance.now() - startedAt };
    const marker = markers.find(item => item.id === markerId);
    if (!marker) { self.postMessage({ ...diagnostics, detected: false, poseValid: false, found: false }); return; }
    try {
      const corners = marker.corners.map(point => ({ x: point.x - width / 2, y: height / 2 - point.y }));
      if (!Number.isFinite(markerSize) || markerSize <= 0 || !Number.isFinite(fov) || fov <= 0 || fov >= 180) throw new Error('Marker size/FOV unavailable for pose');
      const focal = height / (2 * Math.tan(fov * Math.PI / 360));
      const pose = new POS.Posit(markerSize, focal).pose(corners);
      const valid = Number.isFinite(pose.bestError) && pose.bestError < 8 && pose.bestTranslation.every(Number.isFinite) && pose.bestTranslation[2] > 0 && pose.bestRotation.flat().every(Number.isFinite);
      // Keep legacy room 'found' pose-valid. Cube detection uses 'detected' independently.
      self.postMessage({ ...diagnostics, detected: true, poseValid: valid, found: valid, corners: marker.corners, error: pose.bestError, rotation: valid ? pose.bestRotation : undefined, translation: valid ? pose.bestTranslation : undefined, poseMessage: valid ? '' : 'POSIT rejected this pose; marker was decoded' });
    } catch (error) { self.postMessage({ ...diagnostics, detected: true, poseValid: false, found: false, corners: marker.corners, poseMessage: String(error) }); }
  } catch (error) { self.postMessage({ type: 'fatal', found: false, message: `Detector failed: ${String(error)}` }); }
};
