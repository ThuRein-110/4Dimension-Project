import { expect, test } from '@playwright/test';
import type { MarkerResult } from '../../packages/vision/src/MarkerTracker.js';

test('real worker decodes generated ID 101 at all quarter-turns, independently of pose inputs', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const image = new Image(); image.src = '/markers/cube-marker-101.png'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 600;
    const ctx = canvas.getContext('2d')!; const worker = new Worker('/assets/marker-worker.js');
    const next = () => new Promise<unknown>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Worker timeout')), 8000); worker.onmessage = event => { clearTimeout(timer); resolve(event.data); }; worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); }; });
    try {
      const ready = await next(); const output = [];
      for (const angle of [0, 90, 180, 270]) {
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 600, 600); ctx.save(); ctx.translate(300, 300); ctx.rotate(angle * Math.PI / 180); ctx.drawImage(image, -150, -150, 300, 300); ctx.restore();
        const data = ctx.getImageData(0, 0, 600, 600); const result = next(); worker.postMessage({ width: 600, height: 600, buffer: data.data.buffer, markerId: 101, markerSize: .04, fov: 60 }, [data.data.buffer]); output.push(await result);
      }
      for (const [markerSize, fov] of [[.08, 60], [.04, 0], [0, 60]]) {
        const data = ctx.getImageData(0, 0, 600, 600); const result = next(); worker.postMessage({ width: 600, height: 600, buffer: data.data.buffer, markerId: 101, markerSize, fov }, [data.data.buffer]); output.push(await result);
      }
      return { ready, output };
    } finally { worker.terminate(); }
  });
  expect(results.ready).toMatchObject({ type: 'ready', dictionary: 'ARUCO_MIP_36h12' });
  const output = results.output as MarkerResult[];
  for (const result of output) { expect(result.detected).toBe(true); expect(result.markers?.map(m => m.id)).toContain(101); expect(result.corners).toHaveLength(4); }
  for (const result of output.slice(0, 5)) expect(result.poseValid).toBe(true);
  expect(output[4].translation![2]).toBeCloseTo(output[3].translation![2] * 2);
  for (const result of output.slice(5)) { expect(result.poseValid).toBe(false); expect(result.found).toBe(false); expect(result.poseMessage).toBeTruthy(); }
});

test('worker reports wrong IDs and blank frames rather than hiding them', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const image = new Image(); image.src = '/markers/marker.png'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 600; const ctx = canvas.getContext('2d')!;
    const worker = new Worker('/assets/marker-worker.js');
    const next = () => new Promise<unknown>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Worker timeout')), 8000); worker.onmessage = e => { clearTimeout(timeout); resolve(e.data); }; worker.onerror = e => { clearTimeout(timeout); reject(new Error(e.message)); }; });
    try { await next(); const output = [];
      for (const drawMarker of [true, false]) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 600, 600); if (drawMarker) ctx.drawImage(image, 150, 150, 300, 300); const pixels = ctx.getImageData(0, 0, 600, 600); const result = next(); worker.postMessage({ width: 600, height: 600, buffer: pixels.data.buffer, markerId: 101, markerSize: .04, fov: 60 }, [pixels.data.buffer]); output.push(await result); }
      return output;
    } finally { worker.terminate(); }
  }) as MarkerResult[];
  expect(results[0].markers?.map(m => m.id)).toEqual([100]); expect(results[0].detected).toBe(false);
  expect(results[1].markers).toEqual([]); expect(results[1].detected).toBe(false);
});
