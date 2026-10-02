import { expect, test, type Page } from '@playwright/test';

async function pixels(page: Page) {
  return page.locator('canvas[aria-label="3D cube overlay"]').evaluate(node => {
    const source = node as HTMLCanvasElement; const copy = document.createElement('canvas'); copy.width = source.width; copy.height = source.height;
    const ctx = copy.getContext('2d')!; ctx.drawImage(source, 0, 0); const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let count = 0; let sum = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) { count++; sum += i; } return { count, sum };
  });
}
async function model(page: Page) {
  return page.evaluate(async () => { const path = performance.getEntriesByType('resource').find(e => e.name.includes('/cube-lab/store.ts'))!.name; const store = (await import(path)).cubeLab; const s = store.get(); return { mode: s.mode, tracking: s.tracking, count: s.recording?.samples.length ?? 0, recording: s.recording, pose: store.pose() }; });
}
test('webcam test cube is transparent and responsive, without a phone or detector', async ({ page }) => {
  const errors: string[] = []; let workers = 0; let pairing = 0; page.on('pageerror', error => errors.push(error.message)); page.on('worker', () => workers++);
  await page.route('**/api/sessions**', route => { pairing++; return route.abort(); });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await page.getByRole('button', { name: 'Start webcam', exact: true }).click(); await expect(page.getByText('Webcam active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click(); await page.getByRole('checkbox', { name: 'Test cube preview', exact: true }).check();
  await expect.poll(async () => (await pixels(page)).count).toBeGreaterThan(100);
  const canvas = page.locator('canvas[aria-label="3D cube overlay"]'); const area = await canvas.evaluate(node => (node as HTMLCanvasElement).width * (node as HTMLCanvasElement).height);
  expect((await pixels(page)).count).toBeLessThan(area * .2);
  await page.locator('.properties-panel').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: 'test-results/cube-preview-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await expect.poll(async () => (await pixels(page)).count).toBeGreaterThan(50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/cube-preview-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Camera', exact: true }).click(); await page.getByRole('button', { name: 'Stop webcam', exact: true }).click();
  expect(workers).toBe(0); expect(pairing).toBe(0); expect(errors).toEqual([]);
});

test('real ArUco pixels flow through webcam, worker, pose, recording and decoupled replay', async ({ page }) => {
  test.setTimeout(60000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const image = new Image(); image.src = '/markers/cube-marker.png'; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720; const ctx = canvas.getContext('2d')!;
      let t = 0; const draw = () => {
        t += .04; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1280, 720);
        if (document.documentElement.dataset.cubeHidden !== 'true') {
          ctx.save(); ctx.translate(640 + Math.sin(t) * 130, 360 + Math.cos(t * .8) * 65); ctx.rotate(Math.sin(t * .5) * .3); const size = 140 + Math.sin(t * .7) * 30; ctx.drawImage(image, -size / 2, -size / 2, size, size); ctx.restore();
        }
      }; draw(); const stream = canvas.captureStream(30); const timer = setInterval(draw, 33); stream.getTracks()[0].addEventListener('ended', () => clearInterval(timer)); return stream;
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); await page.getByRole('button', { name: 'Start webcam', exact: true }).click();
  await expect(page.getByText('Webcam active', { exact: true })).toBeVisible(); await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click();
  await page.getByRole('button', { name: 'Start tracking', exact: true }).click(); await expect(page.getByTestId('cube-tracking')).toHaveText('TRACKING');
  await expect.poll(async () => (await pixels(page)).count).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Start Recording', exact: true }).click(); await expect.poll(async () => (await model(page)).count).toBeGreaterThan(10);
  await page.getByRole('button', { name: 'Pause', exact: true }).click(); const paused = (await model(page)).count; await page.waitForTimeout(500); expect((await model(page)).count).toBe(paused);
  await page.getByRole('button', { name: 'Resume', exact: true }).click(); await expect.poll(async () => (await model(page)).count).toBeGreaterThan(paused + 3);
  await page.evaluate(() => { document.documentElement.dataset.cubeHidden = 'true'; }); await expect(page.getByTestId('cube-tracking')).toHaveText('TRACKING LOST');
  const lost = (await model(page)).count; await page.waitForTimeout(400); expect((await model(page)).count).toBe(lost);
  await page.evaluate(() => { document.documentElement.dataset.cubeHidden = 'false'; }); await expect(page.getByTestId('cube-tracking')).toHaveText('TRACKING');
  await expect.poll(async () => (await model(page)).count).toBeGreaterThan(lost + 3); await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByTestId('cube-mode')).toHaveText('PLAYBACK'); const r = (await model(page)).recording!; expect(r.samples.length).toBeGreaterThan(15);
  for (const axis of ['x', 'y', 'z'] as const) { const values = r.samples.map((p: {position: {x: number; y: number; z: number}}) => p.position[axis]); expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(.005); }
  const rotations = r.samples.map((p: {rotation: {z: number}}) => p.rotation.z); expect(Math.max(...rotations) - Math.min(...rotations)).toBeGreaterThan(.01);
  const initial = (await model(page)).pose; await page.waitForTimeout(400); expect((await model(page)).pose).toEqual(initial);
  const time = Math.floor(r.durationMs / 2); await page.getByRole('slider', { name: 'Cube time', exact: true }).fill(String(time));
  const mid = (await model(page)).pose; expect(mid.timestampMs).toBe(time);
  await page.getByRole('textbox', { name: 'Keyframe name', exact: true }).fill('Center'); await page.getByRole('button', { name: 'Add Keyframe', exact: true }).click();
  await page.getByRole('button', { name: 'Cube first frame' }).click(); await page.getByRole('button', { name: 'Seek keyframe Center', exact: true }).click(); expect((await model(page)).pose).toEqual(mid);
  await page.getByRole('combobox', { name: 'Speed', exact: true }).selectOption('2'); await page.getByRole('checkbox', { name: 'Loop', exact: true }).check();
  const before = await pixels(page); await page.getByRole('button', { name: 'Play cube recording', exact: true }).click(); await page.waitForTimeout(350); expect((await pixels(page)).sum).not.toBe(before.sum); await page.getByRole('button', { name: 'Pause cube playback', exact: true }).click();
  await page.getByRole('textbox', { name: 'Take name', exact: true }).fill('Physical pixel test'); await page.getByRole('button', { name: 'Save Recording', exact: true }).click(); await expect(page.getByRole('button', { name: /^Physical pixel test/ })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export Recording JSON', exact: true }).click(); const file = await download; expect(file.suggestedFilename()).toMatch(/^cube-recording-.*json$/);
  await file.saveAs('test-results/cube-recording.json');
  await page.screenshot({ path: 'test-results/cube-tracking-replay.png', fullPage: true });
  const screenshot = page.waitForEvent('download'); await page.getByRole('button', { name: 'Capture 3D only', exact: true }).click(); expect((await screenshot).suggestedFilename()).toMatch(/png$/);
  await page.reload(); await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click(); await page.getByRole('button', { name: /^Physical pixel test/ }).click();
  await expect(page.getByTestId('cube-mode')).toHaveText('PLAYBACK'); await expect.poll(async () => (await pixels(page)).count).toBeGreaterThan(100); expect((await model(page)).count).toBe(r.samples.length);
  await page.getByRole('button', { name: 'Clear', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.locator('input[accept=".json,application/json"]').setInputFiles('test-results/cube-recording.json'); await expect(page.getByTestId('cube-mode')).toHaveText('PLAYBACK'); expect((await model(page)).count).toBe(r.samples.length);
  expect(errors).toEqual([]);
});
