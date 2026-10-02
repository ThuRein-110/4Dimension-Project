import { expect, test } from '@playwright/test';

type CaptureAudit = { calls: number; concurrent: number; maxConcurrent: number; activeAtRequest: number[]; tracks: MediaStreamTrack[]; constraints: MediaStreamConstraints[] };
declare global { interface Window { webcamAudit: CaptureAudit } }

async function audit(page: import('@playwright/test').Page, delay = 0) {
  await page.addInitScript(({ delay }) => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const record = window.webcamAudit = { calls: 0, concurrent: 0, maxConcurrent: 0, activeAtRequest: [], tracks: [], constraints: [] } as CaptureAudit;
    navigator.mediaDevices.getUserMedia = async constraints => {
      record.calls++; record.constraints.push(constraints ?? {});
      record.activeAtRequest.push(record.tracks.filter(track => track.readyState === 'live').length);
      record.concurrent++; record.maxConcurrent = Math.max(record.maxConcurrent, record.concurrent);
      try {
        const stream = await capture(constraints); record.tracks.push(...stream.getTracks());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        return stream;
      } finally { record.concurrent--; }
    };
  }, { delay });
}

test('one webcam stream survives start, stop, restart and sample/local/phone switches', async ({ page }) => {
  await audit(page, 350); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start webcam', exact: true })).toBeVisible();
  // A second click cannot reenter startup, even in the same browser task.
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const start = buttons.find(button => button.textContent === 'Start webcam')!;
    start.click(); start.click();
  });
  await expect(page.getByRole('button', { name: 'Starting webcam...', exact: true }).first()).toBeDisabled();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.webcamAudit.calls)).toBe(1);
  await expect.poll(() => page.locator('.view-status').textContent()).toMatch(/[1-9]\d* FPS/);
  await expect.poll(() => page.locator('video').evaluate(node => {
    const video = node as HTMLVideoElement;
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const context = canvas.getContext('2d')!; context.drawImage(video, 0, 0, 32, 32);
    return [...context.getImageData(0, 0, 32, 32).data].filter((_, i) => i % 4 !== 3).some(value => value > 20);
  })).toBe(true);
  await page.getByText('Camera diagnostics', { exact: true }).click();
  await expect(page.getByTestId('webcam-phase')).toHaveText('live');
  await expect(page.getByTestId('webcam-last-error')).toHaveText('None');
  await page.screenshot({ path: 'test-results/webcam-startup-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Stop webcam', exact: true }).click();
  expect(await page.evaluate(() => window.webcamAudit.tracks.every(track => track.readyState === 'ended'))).toBe(true);
  expect(await page.locator('video').evaluate(node => (node as HTMLVideoElement).srcObject)).toBe(null);
  await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restart webcam', exact: true }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.webcamAudit.calls)).toBe(3);
  const sources = page.getByRole('navigation', { name: 'Video sources' });
  await sources.getByRole('button', { name: 'Sample room' }).click();
  await expect(page.locator('.room-image')).toBeVisible();
  expect(await page.evaluate(() => window.webcamAudit.tracks.every(track => track.readyState === 'ended'))).toBe(true);
  await sources.getByRole('button', { name: 'Windows webcam' }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  await page.locator('input[type=file][accept^="image/"]').setInputFiles('assets/demo/room.jpg');
  await expect(page.getByText('Local media', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => window.webcamAudit.tracks.every(track => track.readyState === 'ended'))).toBe(true);
  await sources.getByRole('button', { name: 'Windows webcam' }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  await sources.getByRole('button', { name: 'iPhone camera' }).click();
  expect(await page.evaluate(() => window.webcamAudit.tracks.every(track => track.readyState === 'ended'))).toBe(true);
  await sources.getByRole('button', { name: 'Windows webcam' }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  const result = await page.evaluate(() => ({ max: window.webcamAudit.maxConcurrent, activeAtRequest: window.webcamAudit.activeAtRequest, active: window.webcamAudit.tracks.filter(track => track.readyState === 'live').length }));
  expect(result.max).toBe(1); expect(result.activeAtRequest.every(count => count === 0)).toBe(true); expect(result.active).toBe(1);
});

for (const [name, message, visible] of [
  ['NotAllowedError', 'Permission denied', 'Camera permission was denied'],
  ['NotFoundError', 'Requested device not found', 'No webcam was found'],
  ['NotReadableError', 'Device in use', 'Windows could not open the webcam'],
  ['OverconstrainedError', 'Bad constraint', 'The webcam cannot provide the requested settings'],
  ['AbortError', 'Timeout starting video source', 'The browser could not start the webcam'],
  ['SecurityError', 'Camera disabled by policy', 'Camera access is blocked'],
  ['Error', 'Could not start video source', 'Windows could not open the webcam'],
]) {
  test(`preserves ${name}: ${message} and gives actionable guidance`, async ({ page }) => {
    const logged: string[] = []; page.on('console', entry => { if (entry.type() === 'error') logged.push(entry.text()); });
    await page.addInitScript(({ name, message }) => {
      window.webcamAudit = { calls: 0, concurrent: 0, maxConcurrent: 0, activeAtRequest: [], tracks: [], constraints: [] };
      navigator.mediaDevices.getUserMedia = async () => { window.webcamAudit.calls++; throw new DOMException(message, name); };
    }, { name, message });
    await page.goto('/'); await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(visible);
    await page.getByText('Camera diagnostics', { exact: true }).click();
    await expect(page.getByTestId('webcam-last-error')).toHaveText(`${name}: ${message}`);
    await expect(page.getByTestId('webcam-native-error')).toHaveText(`${name}: ${message}`);
    await expect(page.getByTestId('webcam-application-error')).toHaveText('None');
    expect(await page.evaluate(() => window.webcamAudit.calls)).toBe(name === 'OverconstrainedError' ? 2 : 1);
    await expect(page.getByRole('button', { name: 'Start webcam', exact: true })).toBeEnabled();
    expect(logged.some(line => line.includes(name) && line.includes(message))).toBe(true);
    expect(await page.locator('video').evaluate(node => (node as HTMLVideoElement).srcObject)).toBe(null);
  });
}

test('constraint fallback is sequential and replaces an unavailable saved camera', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('livespace.webcam.deviceId', 'removed-device');
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const record = window.webcamAudit = { calls: 0, concurrent: 0, maxConcurrent: 0, activeAtRequest: [], tracks: [], constraints: [] } as CaptureAudit;
    navigator.mediaDevices.getUserMedia = async constraints => {
      record.calls++; record.constraints.push(constraints ?? {});
      if (record.calls === 1) throw new DOMException('Preferred capture mode unavailable', 'OverconstrainedError');
      const stream = await capture(constraints); record.tracks.push(...stream.getTracks()); return stream;
    };
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  const capture = await page.evaluate(() => ({ constraints: window.webcamAudit.constraints, saved: localStorage.getItem('livespace.webcam.deviceId'), actual: window.webcamAudit.tracks[0].getSettings().deviceId }));
  expect(capture.constraints).toHaveLength(2); expect(capture.constraints[1]).toEqual({ audio: false, video: true });
  expect(capture.saved).toBe(capture.actual); expect(capture.saved).not.toBe('removed-device');
  const first = capture.constraints[0].video as MediaTrackConstraints;
  expect(first.width).toEqual({ ideal: 1280 }); expect(first.height).toEqual({ ideal: 720 }); expect(first.frameRate).toEqual({ ideal: 30 });
  expect(first.deviceId).not.toEqual({ ideal: 'removed-device' });
});

test('switching source during capture stops the late stream and prevents overlap', async ({ page }) => {
  await audit(page, 1000); await page.goto('/');
  await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.webcamAudit.tracks.length)).toBe(1);
  const sources = page.getByRole('navigation', { name: 'Video sources' });
  await sources.getByRole('button', { name: 'Sample room' }).click();
  await expect(sources.getByRole('button', { name: 'Windows webcam' })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.webcamAudit.tracks.every(track => track.readyState === 'ended'))).toBe(true);
  await expect(sources.getByRole('button', { name: 'Windows webcam' })).toBeEnabled();
  expect(await page.locator('video').evaluate(node => (node as HTMLVideoElement).srcObject)).toBe(null);
  await sources.getByRole('button', { name: 'Windows webcam' }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.webcamAudit.maxConcurrent)).toBe(1);
});

test('startup stays locked until playback succeeds and releases failed playback streams', async ({ page }) => {
  await audit(page);
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play; let first = true;
    HTMLMediaElement.prototype.play = function () {
      if (first && this.srcObject) { first = false; return Promise.reject(new DOMException('Playback blocked', 'NotAllowedError')); }
      return play.call(this);
    };
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Webcam playback is blocked');
  expect(await page.evaluate(() => window.webcamAudit.tracks.every(track => track.readyState === 'ended'))).toBe(true);
  await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.webcamAudit.calls)).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator('.view-status').textContent()).toMatch(/[1-9]\d* FPS/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/webcam-startup-mobile.png', fullPage: true });
});
