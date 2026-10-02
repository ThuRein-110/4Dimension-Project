import { expect, test } from '@playwright/test';

test('fixed webcam runs the entire manual planner without iPhone pairing or a marker', async ({ page, request }) => {
  const errors: string[] = []; const saved = new Set<string>(); let pairingRequests = 0; let signalingSockets = 0; let markerWorkers = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => { if (socket.url().includes('/signal?')) signalingSockets++; });
  page.on('worker', worker => { if (worker.url().includes('marker-worker.js')) markerWorkers++; });
  page.on('request', req => { if (req.method() === 'PUT') { const match = new URL(req.url()).pathname.match(/^\/api\/projects\/([0-9a-f-]{36})$/i); if (match) saved.add(match[1]); } });
  await page.route('**/api/sessions**', route => { pairingRequests++; return route.abort(); });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  try {
    await expect(page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'Windows webcam' })).toHaveClass('active');
    await expect(page.getByText('Waiting for iPhone', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Camera URL' })).not.toBeVisible();
    await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
    await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
    const track = await page.locator('video').evaluate(node => (node as HTMLVideoElement).srcObject !== null); expect(track).toBe(true);
    const modes = page.getByRole('navigation', { name: 'Workspace modes' });
    await modes.getByRole('button', { name: 'Calibration', exact: true }).click();
    await expect(page.locator('.tracking-state')).toHaveText('NOT CALIBRATED');
    await expect(page.getByRole('button', { name: 'Track marker', exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Select floor points', exact: true }).click();
    const floorClick = async (x: number, y: number) => {
      const box = (await page.locator('canvas[aria-label="3D room overlay"]').boundingBox())!;
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
    };
    for (const [x, y] of [[.42, .6], [.62, .65], [.36, .8]]) await floorClick(x, y);
    await page.getByRole('spinbutton', { name: 'Distance A-B (m)', exact: true }).fill('1.5');
    await page.getByRole('button', { name: 'Confirm floor origin', exact: true }).click();
    await expect(page.locator('.tracking-state')).toHaveText('MANUAL');
    await expect(page.getByRole('checkbox', { name: 'Floor grid', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Add Writing desk', exact: true }).click(); await floorClick(.5, .7);
    await expect(page.locator('.object-list button')).toHaveCount(1);
    await page.getByRole('spinbutton', { name: 'Position X', exact: true }).fill('1');
    await page.getByRole('spinbutton', { name: 'Rotation Y', exact: true }).fill('45');
    await page.getByRole('spinbutton', { name: 'Uniform scale (%)', exact: true }).fill('125');
    await modes.getByRole('button', { name: 'Measure', exact: true }).click(); await floorClick(.4, .75); await floorClick(.65, .75);
    await expect(page.locator('.measurement-row')).toHaveCount(1);
    await modes.getByRole('button', { name: 'Layouts', exact: true }).click();
    for (const name of ['Study', 'Gaming']) {
      await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
      await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
      await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
      await modes.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('.object-list button').first().click();
      await page.getByRole('spinbutton', { name: 'Position X', exact: true }).fill(name === 'Study' ? '0' : '-1');
      await modes.getByRole('button', { name: 'Layouts', exact: true }).click();
    }
    await expect(page.locator('.layout-row')).toHaveCount(3);
    await modes.getByRole('button', { name: 'Timeline', exact: true }).click();
    await page.getByRole('slider', { name: 'Timeline scrubber', exact: true }).fill('0.5');
    await expect.poll(() => page.evaluate(async () => {
      const path = performance.getEntriesByType('resource').find(entry => entry.name.includes('/planner/ThreeOverlay.tsx'))!.name;
      const engine = (await import(path)).currentEngine; return [...engine.objects.values()][0]?.position.x;
    })).toBeCloseTo(.5);
    const frames = await page.locator('video').evaluate(node => (node as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames);
    await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
    await expect.poll(() => page.locator('video').evaluate(node => (node as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames)).toBeGreaterThan(frames + 5);
    await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
    await modes.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.getByRole('combobox', { name: 'Before state' }).selectOption('0'); await page.getByRole('combobox', { name: 'After state' }).selectOption('2');
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Capture camera frame', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/Compare_T0_T2.*\.png$/);
    await page.screenshot({ path: 'test-results/webcam-planner.png', fullPage: true });
    await page.getByRole('button', { name: 'Recalibrate', exact: true }).click();
    await expect(page.locator('.tracking-state')).toHaveText('MANUAL CALIBRATION');
    await expect(page.locator('.floor-points .complete')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Confirm floor origin', exact: true })).toBeDisabled();
    await modes.getByRole('button', { name: 'Layouts', exact: true }).click(); await expect(page.locator('.layout-row')).toHaveCount(3);
    await modes.getByRole('button', { name: 'Measure', exact: true }).click(); await expect(page.locator('.measurement-row')).toHaveCount(1);
    expect(pairingRequests).toBe(0); expect(signalingSockets).toBe(0); expect(markerWorkers).toBe(0); expect(errors).toEqual([]);
  } finally {
    await page.close(); for (const id of saved) await request.delete(`/api/projects/${id}`, { headers: { 'x-livespace-client': 'desktop' } });
  }
});

test('webcam permission failure is recoverable without starting phone pairing', async ({ page }) => {
  await page.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); let first = true;
    navigator.mediaDevices.getUserMedia = constraints => {
      if (first) { first = false; return Promise.reject(new DOMException('Webcam permission denied', 'NotAllowedError')); }
      return capture(constraints);
    };
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Camera permission was denied');
  await expect(page.getByRole('button', { name: 'Start webcam', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).not.toBeVisible();
  await page.getByRole('button', { name: 'Stop webcam', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start webcam', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Camera URL' })).not.toBeVisible();
});
