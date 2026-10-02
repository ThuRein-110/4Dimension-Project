import { expect, test } from '@playwright/test';

test('marker preview, isolated image self-test, and missing camera ERROR are truthful', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click();
  await page.getByRole('button', { name: 'Show Marker 101', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Marker 101', exact: true }); await expect(dialog).toBeVisible(); await expect(dialog).toContainText('ARUCO_MIP_36h12');
  expect(await dialog.locator('img').evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(1000);
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'test-results/cube-marker-modal-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Close marker', exact: true }).click();
  await page.getByText('Tracking Diagnostics', { exact: true }).click(); await page.getByRole('button', { name: 'Test Marker Image', exact: true }).click();
  await expect(page.getByTestId('cube-self-test')).toContainText('SELF-TEST PASS: ID 101');
  await expect(page.getByTestId('cube-tracking')).toHaveText('NOT_FOUND'); await expect(page.getByTestId('cube-frame-count')).toHaveText('0'); await expect(page.getByTestId('cube-x')).toHaveText('-- m');
  await page.getByRole('button', { name: 'Start tracking', exact: true }).click(); await expect(page.getByTestId('cube-tracking')).toHaveText('ERROR'); await expect(page.getByRole('alert')).toContainText('No active camera frames');
  await page.getByRole('button', { name: 'Camera', exact: true }).click(); await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible(); expect(errors).toEqual([]);
});

test('wrong ID is visible in diagnostics and debug polygon, and webcam frames are unscaled', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const image = new Image(); image.src = '/markers/marker.png'; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720; const ctx = canvas.getContext('2d')!;
      const draw = () => { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1280, 720); ctx.drawImage(image, 450, 180, 360, 360); }; draw(); const stream = canvas.captureStream(15); setInterval(draw, 66); return stream;
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); await page.getByRole('button', { name: 'Start webcam', exact: true }).click(); await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click(); await page.getByText('Tracking Diagnostics', { exact: true }).click(); await page.getByRole('checkbox', { name: 'Debug Tracking', exact: true }).check();
  await page.getByRole('button', { name: 'Start tracking', exact: true }).click(); await expect(page.getByTestId('cube-engine')).toHaveText('Vision ready'); await expect(page.getByTestId('cube-detected-ids')).toHaveText('100');
  await expect(page.getByText(/Detected ID 100. Expected ID 101/)).toBeVisible(); await expect(page.getByTestId('cube-tracking')).toHaveText('NOT_FOUND'); await expect(page.getByTestId('cube-x')).toHaveText('-- m');
  await expect.poll(async () => Number(await page.getByTestId('cube-frame-count').textContent())).toBeGreaterThan(5);
  await expect.poll(async () => Number(await page.getByTestId('cube-vision-fps').textContent())).toBeGreaterThan(1);
  await expect.poll(() => page.locator('.cube-corners').evaluate(node => { const canvas = node as HTMLCanvasElement; return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0); })).toBe(true);
  await page.getByRole('button', { name: 'Fill', exact: true }).click(); await page.getByRole('button', { name: 'Fit', exact: true }).click(); await expect(page.getByTestId('cube-detected-ids')).toHaveText('100');
  await page.screenshot({ path: 'test-results/cube-wrong-marker-debug.png', fullPage: true });
  const dims = await page.evaluate(async () => { const path = performance.getEntriesByType('resource').find(e => e.name.includes('/cube-lab/store.ts'))!.name; const result = (await import(path)).cubeLab.get().debugResult; return [result.sourceWidth, result.sourceHeight, result.width, result.height]; }); expect(dims).toEqual([1280, 720, 1280, 720]);
  await page.getByRole('button', { name: 'Stop tracking', exact: true }).click(); const count = await page.getByTestId('cube-frame-count').textContent(); await page.waitForTimeout(300); expect(await page.getByTestId('cube-frame-count').textContent()).toBe(count);
});

test('worker initialization failures show ERROR and permit retry', async ({ page }) => {
  await page.route('**/assets/vendor/aruco/aruco.js', route => route.abort());
  await page.goto('/'); await page.locator('input[accept="image/*,video/mp4,video/webm,video/quicktime"]').setInputFiles('public/markers/cube-marker-101.png');
  await expect(page.getByAltText('Room reference')).toBeVisible(); await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click();
  await page.getByRole('button', { name: 'Start tracking', exact: true }).click(); await expect(page.getByTestId('cube-tracking')).toHaveText('ERROR'); await expect(page.getByRole('alert')).toContainText('failed to initialize');
  await page.unroute('**/assets/vendor/aruco/aruco.js'); await page.getByRole('button', { name: 'Start tracking', exact: true }).click(); await expect(page.getByTestId('cube-tracking')).toHaveText('TRACKING');
});

test('a decoded marker remains DETECTED/TRACKING when the pose solver fails', async ({ page }) => {
  await page.route('**/assets/marker-worker.js', async route => { const response = await route.fetch(); const body = (await response.text()).replace('const focal = height /', "throw new Error('Test pose solver unavailable'); const focal = height /"); await route.fulfill({ response, body }); });
  await page.goto('/'); await page.locator('input[accept="image/*,video/mp4,video/webm,video/quicktime"]').setInputFiles('public/markers/cube-marker-101.png'); await expect(page.getByAltText('Room reference')).toBeVisible();
  await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click(); await page.getByRole('button', { name: 'Start tracking', exact: true }).click();
  await expect(page.getByTestId('cube-tracking')).toHaveText('TRACKING'); await expect(page.getByTestId('cube-pose-unavailable')).toContainText('MARKER FOUND / POSE UNAVAILABLE'); await expect(page.getByTestId('cube-x')).toHaveText('-- m'); await expect(page.getByRole('button', { name: 'Start Recording', exact: true })).toBeDisabled();
});

test('paused video fails explicitly, recovers on resume, and leaving the lab releases the worker', async ({ page }) => {
  let closedWorkers = 0; page.on('worker', worker => worker.on('close', () => closedWorkers++));
  await page.goto('/'); await page.getByRole('button', { name: 'Start webcam', exact: true }).click(); await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click(); await page.locator('video').evaluate(node => (node as HTMLVideoElement).pause());
  await page.getByRole('button', { name: 'Start tracking', exact: true }).click(); await expect(page.getByTestId('cube-tracking')).toHaveText('ERROR', { timeout: 7000 }); await expect(page.getByRole('alert')).toContainText('paused');
  await expect.poll(() => closedWorkers).toBeGreaterThan(0);
  await page.locator('video').evaluate(node => (node as HTMLVideoElement).play()); await page.getByRole('button', { name: 'Start tracking', exact: true }).click();
  await expect(page.getByTestId('cube-engine')).toHaveText('Vision ready'); await page.getByText('Tracking Diagnostics', { exact: true }).click(); await expect.poll(async () => Number(await page.getByTestId('cube-frame-count').textContent())).toBeGreaterThan(3);
  const closed = closedWorkers; await page.getByRole('button', { name: 'Camera', exact: true }).click(); await expect.poll(() => closedWorkers).toBeGreaterThan(closed); await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
});
