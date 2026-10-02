import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Hardware-only check: permission automation, but no fake camera or synthetic pixels.
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, permissions: ['camera'] });
  await page.goto('http://localhost:5173');
  await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  try { await page.getByText('Webcam active', { exact: true }).waitFor({ timeout: 12000 }); }
  catch {
    const message = await page.getByRole('alert').textContent().catch(() => 'No live camera available');
    console.log(`REAL WEBCAM NOT VERIFIED: ${message}`); if (message?.includes('Device in use')) console.log('Stop other camera tabs/apps before running this separate hardware probe; do not close your working app automatically.'); process.exitCode = 2;
  }
  if (!process.exitCode) {
    const info = await page.locator('video').evaluate(node => {
      const video = node as HTMLVideoElement; const stream = video.srcObject as MediaStream;
      return { label: stream.getVideoTracks()[0].label, settings: stream.getVideoTracks()[0].getSettings(), width: video.videoWidth, height: video.videoHeight, readyState: video.readyState };
    });
    console.log('REAL WEBCAM INPUT:', JSON.stringify(info));
    await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click();
    await page.getByRole('button', { name: 'Start tracking', exact: true }).click();
    console.log('Hold the printed ID 101 facing the webcam. Waiting up to 30 seconds.');
    const detected = await page.getByTestId('cube-tracking').filter({ hasText: /^TRACKING$/ }).waitFor({ timeout: 30000 }).then(() => true, () => false);
    await page.getByText('Tracking Diagnostics', { exact: true }).click();
    console.log('REAL WEBCAM RESULT:', JSON.stringify({ detected, state: await page.getByTestId('cube-tracking').textContent(), frames: await page.getByTestId('cube-frame-count').textContent(), ids: await page.getByTestId('cube-detected-ids').textContent(), visionFps: await page.getByTestId('cube-vision-fps').textContent(), x: await page.getByTestId('cube-x').textContent(), y: await page.getByTestId('cube-y').textContent(), z: await page.getByTestId('cube-z').textContent() }));
    await mkdir('.local', { recursive: true }); await page.screenshot({ path: '.local/cube-real-webcam.png', fullPage: true });
    if (!detected) { console.log('Physical ID 101 acceptance remains pending; this is not a passing hardware test.'); process.exitCode = 2; }
  }
} finally { await browser.close(); }
