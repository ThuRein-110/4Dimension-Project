import { chromium, expect } from '@playwright/test';

// Use physical hardware only. Permission automation does not supply fake frames.
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, permissions: ['camera'] });
  page.on('console', entry => { if (entry.text().includes('[Webcam]')) console.log(entry.text()); });
  await page.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const audit = { calls: 0, concurrent: 0, maxConcurrent: 0, activeAtRequest: [] as number[], tracks: [] as MediaStreamTrack[] };
    Object.assign(window, { hardwareWebcamAudit: audit });
    navigator.mediaDevices.getUserMedia = async constraints => {
      audit.calls++; audit.activeAtRequest.push(audit.tracks.filter(track => track.readyState === 'live').length);
      audit.concurrent++; audit.maxConcurrent = Math.max(audit.maxConcurrent, audit.concurrent);
      try { const stream = await capture(constraints); audit.tracks.push(...stream.getTracks()); return stream; }
      finally { audit.concurrent--; }
    };
  });
  await page.goto(process.env.LIVESPACE_URL ?? 'http://localhost:5173');
  await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  const outcome = await Promise.race([
    page.getByText('Webcam active', { exact: true }).waitFor({ timeout: 30000 }).then(() => 'live'),
    page.getByRole('alert').waitFor({ timeout: 30000 }).then(() => 'error'),
  ]).catch(() => 'waiting');
  if (outcome !== 'live') {
    await page.getByText('Camera diagnostics', { exact: true }).click();
    console.log('REAL WEBCAM NOT VERIFIED:', await page.getByRole('alert').textContent().catch(() => 'Browser acquisition still pending'));
    console.log('EXACT CAMERA ERROR:', await page.getByTestId('webcam-last-error').textContent());
    console.log('Close other camera captures and rerun npm run test:webcam. No competing application was closed by this probe.');
    process.exitCode = 2;
  } else {
    const live = async () => {
      await expect(page.getByText('Webcam active', { exact: true })).toBeVisible({ timeout: 30000 });
      await expect.poll(() => page.locator('.view-status').textContent(), { timeout: 10000 }).toMatch(/[1-9]\d* FPS/);
      return page.locator('video').evaluate(node => {
        const video = node as HTMLVideoElement; const stream = video.srcObject as MediaStream;
        return { active: stream.active, track: stream.getVideoTracks()[0].readyState, settings: stream.getVideoTracks()[0].getSettings(), width: video.videoWidth, height: video.videoHeight, readyState: video.readyState, paused: video.paused };
      });
    };
    console.log('REAL WEBCAM LIVE:', JSON.stringify(await live()));
    await page.getByRole('button', { name: 'Stop webcam', exact: true }).click();
    expect(await page.locator('video').evaluate(node => (node as HTMLVideoElement).srcObject)).toBe(null);
    await page.getByRole('button', { name: 'Start webcam', exact: true }).click(); await live();
    await page.getByRole('button', { name: 'Restart webcam', exact: true }).click(); await live();
    const sources = page.getByRole('navigation', { name: 'Video sources' });
    await sources.getByRole('button', { name: 'Sample room' }).click();
    await expect(page.locator('.room-image')).toBeVisible();
    await sources.getByRole('button', { name: 'Windows webcam' }).click(); await live();
    await page.locator('input[type=file][accept^="image/"]').setInputFiles('assets/demo/room.jpg');
    await expect(page.locator('.room-image')).toBeVisible();
    await sources.getByRole('button', { name: 'Windows webcam' }).click(); await live();
    await page.getByRole('button', { name: 'Stop webcam', exact: true }).click();
    const audit = await page.evaluate(() => {
      const result = (window as unknown as { hardwareWebcamAudit: { calls: number; maxConcurrent: number; activeAtRequest: number[]; tracks: MediaStreamTrack[] } }).hardwareWebcamAudit;
      return { calls: result.calls, maxConcurrent: result.maxConcurrent, activeAtRequest: result.activeAtRequest, allTracksStopped: result.tracks.every(track => track.readyState === 'ended') };
    });
    expect(audit.maxConcurrent).toBe(1); expect(audit.activeAtRequest.every(count => count === 0)).toBe(true); expect(audit.allTracksStopped).toBe(true);
    console.log('REAL WEBCAM LIFECYCLE PASS:', JSON.stringify(audit));
  }
} finally { await browser.close(); }
