/* global importScripts, AR, POS */
importScripts('/assets/vendor/aruco/cv.js', '/assets/vendor/aruco/aruco.js', '/assets/vendor/aruco/svd.js', '/assets/vendor/aruco/posit1.js');
const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12', maxHammingDistance: 2 });
self.onmessage = event => {
  const { width, height, buffer, markerSize, fov, markerId = 100 } = event.data;
  try {
    const markers = detector.detect({ width, height, data: new Uint8ClampedArray(buffer) });
    const marker = markers.find(item => item.id === markerId);
    if (!marker) { self.postMessage({ found: false }); return; }
    const corners = marker.corners.map(point => ({ x: point.x - width / 2, y: height / 2 - point.y }));
    const focal = height / (2 * Math.tan(fov * Math.PI / 360));
    const pose = new POS.Posit(markerSize, focal).pose(corners);
    const valid = Number.isFinite(pose.bestError) && pose.bestError < 8 && pose.bestTranslation.every(Number.isFinite) && pose.bestTranslation[2] > 0;
    self.postMessage({ found: valid, corners: marker.corners, error: pose.bestError, rotation: pose.bestRotation, translation: pose.bestTranslation });
  } catch (error) { self.postMessage({ found: false, message: String(error) }); }
};
