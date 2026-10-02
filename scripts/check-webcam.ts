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
  const baseUrl = process.env.LIVESPACE_URL ?? 'http://localhost:5173';
  const deviceName = process.argv.find(arg => arg.startsWith('--device-name='))?.slice('--device-name='.length);
  await page.goto(new URL('/webcam-test', baseUrl).href);
  await page.getByRole('button', { name: 'Test Raw Webcam', exact: true }).click();
  const rawOutcome = await Promise.race([
    page.getByTestId('raw-camera-result').filter({ hasText: 'RAW CAMERA SUCCESS' }).waitFor({ timeout: 30000 }).then(() => 'live'),
    page.getByRole('alert').waitFor({ timeout: 30000 }).then(() => 'error'),
  ]).catch(() => 'waiting');
  if (rawOutcome !== 'live') {
    await page.getByText('Camera diagnostics', { exact: true }).click();
    console.log('RAW BROWSER DEFAULT FAILED:', await page.getByTestId('webcam-native-error').textContent());
    console.log('RAW APPLICATION ERROR:', await page.getByTestId('webcam-application-error').textContent());
    if (!deviceName) {
      console.log('No default camera pass. Choose a physical camera with Webcam device, or run npx tsx scripts/check-webcam.ts "--device-name=camera label".');
      process.exitCode = 2;
    }
  }
  async function selectCamera() {
    const selector = page.getByRole('combobox', { name: 'Webcam device' });
    await expect(selector).toBeEnabled({ timeout: 15000 });
    const devices = await selector.locator('option').evaluateAll(options => options.map(option => ({ label: option.textContent ?? '', value: (option as HTMLOptionElement).value })));
    const selected = devices.find(device => device.value && device.label.includes(deviceName!));
    if (!selected) throw new Error(`No camera matching ${deviceName}; available: ${devices.map(device => device.label).join(', ')}`);
    await selector.selectOption(selected.value);
  }
  if (deviceName) {
    await selectCamera();
    await page.getByRole('button', { name: 'Test Selected Camera', exact: true }).click();
    await expect(page.getByTestId('raw-camera-result')).toContainText('RAW CAMERA SUCCESS', { timeout: 30000 });
  }
  if (!process.exitCode) {
    await expect.poll(() => page.locator('.raw-camera-stats').textContent(), { timeout: 10000 }).toMatch(/[1-9]\d* FPS/);
    console.log('RAW CAMERA SUCCESS:', await page.getByTestId('raw-camera-result').textContent(), await page.locator('.raw-camera-stats').textContent());
    await page.getByRole('button', { name: 'Stop webcam', exact: true }).click();
    expect(await page.locator('video').evaluate(node => (node as HTMLVideoElement).srcObject)).toBe(null);
    await page.goto(baseUrl);
    // Fresh private-browser documents may rotate device IDs after capture stops.
    // An explicitly requested label must be selected using this document's ID.
    if (deviceName) await selectCamera();
  }
  if (!process.exitCode) {
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
          const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
          const context = canvas.getContext('2d')!; context.drawImage(video, 0, 0, 64, 48);
          const rgb = [...context.getImageData(0, 0, 64, 48).data].filter((_, index) => index % 4 !== 3);
          return { active: stream.active, track: stream.getVideoTracks()[0].readyState, settings: stream.getVideoTracks()[0].getSettings(), width: video.videoWidth, height: video.videoHeight, readyState: video.readyState, paused: video.paused,
            frames: video.getVideoPlaybackQuality().totalVideoFrames, meanBrightness: rgb.reduce((sum, value) => sum + value, 0) / rgb.length, maxBrightness: Math.max(...rgb) };
        });
      };
      const input = await live(); console.log('REAL WEBCAM LIVE:', JSON.stringify(input));
      expect(input.frames).toBeGreaterThan(0); expect(input.width).toBeGreaterThan(0); expect(input.height).toBeGreaterThan(0);
      if (input.meanBrightness < 10) console.log('VERY DARK REAL CAMERA IMAGE: check the lens/privacy shutter and room lighting; frame delivery is not evidence of scene visibility.');
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
  }
} finally { await browser.close(); }
