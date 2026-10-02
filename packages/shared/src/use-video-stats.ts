import { useEffect, useState } from 'react';
export function useVideoStats(video: HTMLVideoElement | null) {
  const [stats, setStats] = useState({ fps: 0, width: 0, height: 0 });
  useEffect(() => {
    if (!video) return;
    let frames = 0; let lastFrames = 0; let lastTime = performance.now(); let handle = 0; let active = true;
    const frame = () => {
      if (!active) return;
      frames++;
      handle = video.requestVideoFrameCallback(frame);
    };
    if ('requestVideoFrameCallback' in video) handle = video.requestVideoFrameCallback(frame);
    const timer = setInterval(() => {
      const time = performance.now();
      const fallback = video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0;
      const count = frames || fallback;
      setStats({ fps: Math.round((count - lastFrames) * 1000 / (time - lastTime)), width: video.videoWidth, height: video.videoHeight });
      lastTime = time; lastFrames = count;
    }, 1000);
    return () => { active = false; clearInterval(timer); if (handle) video.cancelVideoFrameCallback(handle); };
  }, [video]);
  return stats;
}
