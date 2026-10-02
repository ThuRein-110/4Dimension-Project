import { expect, test } from '@playwright/test';

test('raw webcam is isolated, reports a native failure once, and allows explicit camera selection', async ({ page }) => {
  const errors: string[] = []; let workers = 0; let sessions = 0;
  page.on('pageerror', error => errors.push(error.message)); page.on('worker', () => workers++);
  page.on('request', request => { if (request.url().includes('/api/sessions')) sessions++; });
  await page.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const record = { calls: [] as MediaStreamConstraints[], tracks: [] as MediaStreamTrack[] };
    Object.assign(window, { rawAudit: record });
    navigator.mediaDevices.getUserMedia = async constraints => {
      record.calls.push(constraints ?? {});
      if (record.calls.length === 1) throw new DOMException('Timeout starting video source', 'AbortError');
      const stream = await capture(constraints); record.tracks.push(...stream.getTracks()); return stream;
    };
  });
  await page.goto('/webcam-test');
  await page.getByRole('button', { name: 'Test Raw Webcam', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('AbortError: Timeout starting video source');
  await page.getByText('Camera diagnostics', { exact: true }).click();
  await expect(page.getByTestId('webcam-native-error')).toHaveText('AbortError: Timeout starting video source');
  await expect(page.getByTestId('webcam-application-error')).toHaveText('None');
  const device = await page.getByRole('combobox', { name: 'Webcam device' }).locator('option').nth(1).getAttribute('value');
  expect(device).toBeTruthy();
  await page.getByRole('combobox', { name: 'Webcam device' }).selectOption(device!);
  await page.getByRole('button', { name: 'Test Selected Camera', exact: true }).click();
  await expect(page.getByTestId('raw-camera-result')).toContainText('RAW CAMERA SUCCESS');
  await expect.poll(() => page.locator('.raw-camera-stats').textContent()).toMatch(/[1-9]\d* FPS/);
  await expect(page.getByTestId('webcam-lifecycle')).toHaveText('LIVE');
  const result = await page.evaluate(() => {
    const audit = (window as unknown as { rawAudit: { calls: MediaStreamConstraints[]; tracks: MediaStreamTrack[] } }).rawAudit;
    return { calls: audit.calls, desktopModules: performance.getEntriesByType('resource').filter(entry => /DesktopApp|ThreeOverlay|CubeTracker|marker-worker|three\.js/.test(entry.name)).map(entry => entry.name) };
  });
  expect(result.calls).toEqual([{ video: true, audio: false }, { video: { deviceId: { exact: device } }, audio: false }]);
  expect(result.desktopModules).toEqual([]); expect(workers).toBe(0); expect(sessions).toBe(0);
  await page.screenshot({ path: 'test-results/raw-webcam-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/raw-webcam-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Stop webcam', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { rawAudit: { tracks: MediaStreamTrack[] } }).rawAudit.tracks.every(track => track.readyState === 'ended'))).toBe(true);
  await page.getByRole('button', { name: 'Test Raw Webcam', exact: true }).click();
  await expect(page.getByTestId('raw-camera-result')).toContainText('RAW CAMERA SUCCESS');
  await page.getByRole('button', { name: 'Stop webcam', exact: true }).click();
  expect(errors).toEqual([]);
});

test('StrictMode unmount/remount cannot overlap pending native camera requests', async ({ page }) => {
  await page.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const record = { calls: 0, pending: 0, max: 0, tracks: [] as MediaStreamTrack[] };
    Object.assign(window, { rawAudit: record });
    navigator.mediaDevices.getUserMedia = async constraints => {
      record.calls++; record.pending++; record.max = Math.max(record.max, record.pending);
      try {
        const stream = await capture(constraints); record.tracks.push(...stream.getTracks());
        await new Promise(resolve => setTimeout(resolve, 1000)); return stream;
      } finally { record.pending--; }
    };
  });
  await page.goto('/webcam-test'); await expect(page.getByRole('heading', { name: 'Raw Webcam Test' })).toBeVisible();
  await page.evaluate(async () => {
    const reactPath = '/node_modules/.vite/deps/react.js'; const domPath = '/node_modules/.vite/deps/react-dom_client.js';
    const { default: react } = await import(reactPath); const { createRoot } = (await import(domPath)).default;
    const appPath = performance.getEntriesByType('resource').find(entry => entry.name.includes('/webcam/RawWebcamApp.tsx'))!.name;
    const { RawWebcamApp } = await import(appPath);
    document.getElementById('root')!.style.display = 'none';
    const container = document.createElement('div'); container.id = 'strict-camera-test'; document.body.append(container);
    const root = createRoot(container);
    const render = () => root.render(react.createElement(react.StrictMode, null, react.createElement(RawWebcamApp)));
    Object.assign(window, { remountRaw: async () => { root.render(null); await new Promise(resolve => setTimeout(resolve, 0)); render(); }, unmountRaw: () => root.unmount() });
    render();
  });
  const app = page.locator('#strict-camera-test');
  await app.getByRole('button', { name: 'Test Raw Webcam', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { rawAudit: { tracks: MediaStreamTrack[] } }).rawAudit.tracks.length)).toBe(1);
  await page.evaluate(() => (window as unknown as { remountRaw: () => Promise<void> }).remountRaw());
  await app.getByRole('button', { name: 'Test Raw Webcam', exact: true }).click();
  await expect(app.getByTestId('raw-camera-result')).toContainText('RAW CAMERA SUCCESS');
  await page.evaluate(() => (window as unknown as { unmountRaw: () => void }).unmountRaw());
  const result = await page.evaluate(() => {
    const audit = (window as unknown as { rawAudit: { calls: number; max: number; tracks: MediaStreamTrack[] } }).rawAudit;
    return { calls: audit.calls, max: audit.max, states: audit.tracks.map(track => track.readyState) };
  });
  expect(result).toEqual({ calls: 2, max: 1, states: ['ended', 'ended'] });
});
