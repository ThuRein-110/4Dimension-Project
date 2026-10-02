import { expect, test, type Page } from '@playwright/test';
import { demoProject } from '../../packages/layouts/src/demo.js';

const savedByTest = new WeakMap<Page, Set<string>>();
test.beforeEach(({ page }) => {
  const ids = new Set<string>(); savedByTest.set(page, ids);
  page.on('request', request => {
    if (request.method() !== 'PUT') return;
    const match = new URL(request.url()).pathname.match(/^\/api\/projects\/([0-9a-f-]{36})$/i);
    if (match) ids.add(match[1]);
  });
});
test.afterEach(async ({ page, request }) => {
  await page.close();
  for (const id of savedByTest.get(page) ?? []) await request.delete(`/api/projects/${id}`, { headers: { 'x-livespace-client': 'desktop' } });
});

test('transparent floor grid overlays the existing sample image', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'Sample room' }).click();
  await page.getByRole('checkbox', { name: 'Floor grid', exact: true }).check();
  const element = page.locator('canvas[aria-label="3D room overlay"]');
  await expect(element).toBeVisible();
  const painted = await element.evaluate(node => {
    const source = node as HTMLCanvasElement;
    const copy = document.createElement('canvas'); copy.width = source.width; copy.height = source.height;
    const context = copy.getContext('2d')!; context.drawImage(source, 0, 0);
    const data = context.getImageData(0, 0, copy.width, copy.height).data;
    let count = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) count++;
    return count;
  });
  expect(painted).toBeGreaterThan(100);
  await page.screenshot({ path: 'test-results/floor-grid.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('demo supports transforms, undo, timeline interpolation, comparison and export', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await page.getByRole('button', { name: 'Demo project', exact: true }).click();
  await expect(page.getByRole('region', { name: '4D Timeline' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => { const path = performance.getEntriesByType('resource').find(entry => entry.name.includes('/planner/ThreeOverlay.tsx'))!.name; return (await import(path)).currentEngine?.objects.size; })).toBe(3);
  await page.locator('.object-list button').filter({ hasText: 'Platform bed' }).click();
  const x = page.getByRole('spinbutton', { name: 'Position X', exact: true });
  await x.fill('-0.5'); await expect(x).toHaveValue('-0.5');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.locator('.object-list button').filter({ hasText: 'Platform bed' }).click(); await expect(x).toHaveValue('-1.1');
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.locator('.object-list button')).toHaveCount(4);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('.object-list button')).toHaveCount(3);
  await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Timeline', exact: true }).click();
  const scrubber = page.getByRole('slider', { name: 'Timeline scrubber', exact: true });
  await scrubber.fill('0.5');
  await expect.poll(() => page.evaluate(async () => { const path = performance.getEntriesByType('resource').find(entry => entry.name.includes('/planner/ThreeOverlay.tsx'))!.name; const engine = (await import(path)).currentEngine; return [...engine.objects.values()].find((object: { userData: { furnitureId: string } }) => object.userData.furnitureId === 'bed')?.position.z; })).toBeCloseTo(.2);
  await page.screenshot({ path: 'test-results/timeline-midpoint.png', fullPage: true });
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause timeline', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  await scrubber.fill('2');
  await expect.poll(() => page.evaluate(async () => { const path = performance.getEntriesByType('resource').find(entry => entry.name.includes('/planner/ThreeOverlay.tsx'))!.name; const engine = (await import(path)).currentEngine; return [...engine.objects.values()].some((object: { userData: { furnitureId: string }; visible: boolean }) => object.userData.furnitureId === 'bed' && object.visible); })).toBe(false);
  await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('combobox', { name: 'Before state' }).selectOption('0');
  await page.getByRole('combobox', { name: 'After state' }).selectOption('2');
  await page.screenshot({ path: 'test-results/compare.png', fullPage: true });
  const capture = page.waitForEvent('download'); await page.getByRole('button', { name: 'Capture 3D only' }).click();
  expect((await capture).suggestedFilename()).toMatch(/4DLiveSpace_.*\.png/);
  expect(errors).toEqual([]);
});

test('manual calibration, ghost placement, measurements and layout duplication', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/'); await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'Sample room' }).click();
  await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Calibration', exact: true }).click();
  await page.getByRole('button', { name: 'Select floor points', exact: true }).click();
  const canvas = page.locator('canvas[aria-label="3D room overlay"]'); const box = (await canvas.boundingBox())!;
  for (const [x, y] of [[.42, .6], [.62, .65], [.36, .8]]) await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await expect(page.getByRole('button', { name: 'Confirm floor origin' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm floor origin' }).click();
  await page.getByRole('button', { name: 'Add Writing desk', exact: true }).click();
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .7);
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .7);
  await expect(page.locator('.object-list button')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Measure', exact: true }).click();
  await page.mouse.click(box.x + box.width * .4, box.y + box.height * .75);
  await page.mouse.click(box.x + box.width * .65, box.y + box.height * .75);
  await expect(page.locator('.measurement-row')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Layouts', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Study');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.layout-row')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/manual-placement.png', fullPage: true });
});

test('saved demo restores all layouts after page reload', async ({ page, request }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/'); await page.getByRole('button', { name: 'Demo project', exact: true }).click();
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.locator('.save-status')).toContainText('Saved');
  const id = await page.evaluate(async () => { const path = performance.getEntriesByType('resource').find(entry => entry.name.includes('/planner/store.ts'))!.name; return (await import(path)).workspace.get().project.id as string; });
  try {
    await page.reload(); await expect(page.locator('.project-menu summary')).toContainText('Untitled Room'); await page.locator('.project-menu summary').click();
    await page.getByRole('button', { name: 'Open project', exact: true }).click();
    await page.locator(`[data-project-id="${id}"] button`).first().click();
    await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Layouts', exact: true }).click();
    await expect(page.locator('.layout-row')).toHaveCount(3);
    const response = await request.get(`/api/projects/${id}`, { headers: { 'x-livespace-client': 'desktop' } });
    expect((await response.json()).layouts[1].name).toBe('Study');
  } finally { await request.delete(`/api/projects/${id}`, { headers: { 'x-livespace-client': 'desktop' } }); }
});

test('planner remains framed and usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: 'Demo project', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('canvas[aria-label="3D room overlay"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/planner-mobile.png', fullPage: true });
});

test('detects the real local marker and confirms a metric pose', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('input[accept="image/*,video/mp4,video/webm,video/quicktime"]').setInputFiles('public/markers/marker.png');
  await expect(page.getByAltText('Room reference')).toBeVisible();
  await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Calibration', exact: true }).click();
  await page.getByText('Optional marker tracking', { exact: true }).click();
  await page.getByRole('button', { name: 'Track marker', exact: true }).click();
  await expect(page.locator('.tracking-state')).toHaveText('MARKER FOUND', { timeout: 15000 });
  await page.getByRole('button', { name: 'Confirm marker origin', exact: true }).click();
  await expect(page.locator('.tracking-state')).toHaveText('TRACKING');
  await page.screenshot({ path: 'test-results/marker-detected.png', fullPage: true });
  await page.getByAltText('Room reference').evaluate(node => { (node as HTMLImageElement).src = '/assets/demo/room.jpg'; });
  await expect(page.locator('.tracking-state')).toHaveText('TRACKING LOST', { timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Confirm marker origin', exact: true })).toBeDisabled();
  await page.getByAltText('Room reference').evaluate(node => { (node as HTMLImageElement).src = '/markers/marker.png'; });
  await expect(page.locator('.tracking-state')).toHaveText('TRACKING', { timeout: 8000 });
  expect(errors).toEqual([]);
});

test('timeline preserves live capture and furniture survives camera disconnect', async ({ page, context, request }) => {
  const project = demoProject();
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'iPhone camera' }).click();
  const url = page.getByRole('textbox', { name: 'Camera URL' }); await expect(url).toHaveValue(/https:/);
  const phone = await context.newPage(); await phone.goto(await url.inputValue());
  await phone.getByRole('button', { name: 'Start Camera', exact: true }).click();
  await phone.getByRole('button', { name: 'Connect to PC', exact: true }).click();
  await expect(page.getByText('Live video received')).toBeVisible({ timeout: 20000 });
  try {
    await page.locator('input[accept="application/json,.json"]').setInputFiles({ name: 'live-demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await expect(page.locator('.project-menu summary')).toContainText('Demo Bedroom');
    await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Timeline', exact: true }).click();
    const frames = await page.locator('video').evaluate(node => (node as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames);
    await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
    await expect.poll(() => page.locator('video').evaluate(node => (node as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames)).toBeGreaterThan(frames + 5);
    await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
    await phone.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.getByText('Camera live', { exact: true })).not.toBeVisible();
    await expect(page.locator('canvas[aria-label="3D room overlay"]')).toBeVisible();
    await expect(page.locator('.layout-row')).toHaveCount(3);
    await page.getByRole('slider', { name: 'Timeline scrubber', exact: true }).fill('1');
    await page.screenshot({ path: 'test-results/planner-after-disconnect.png', fullPage: true });
  } finally { await request.delete(`/api/projects/${project.id}`, { headers: { 'x-livespace-client': 'desktop' } }); }
});

test('first-run tutorial remembers completion and invalid imports preserve the project', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Start tour', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connect camera', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Calibrate room', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip', exact: true }).click(); await page.reload();
  await expect(page.getByRole('button', { name: 'Start tour', exact: true })).not.toBeVisible();
  await page.locator('input[accept="application/json,.json"]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":999}') });
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('.project-menu summary')).toContainText('Untitled Room');
});

test('project API rejects unauthorized and malformed data and round-trips complete states', async ({ request }) => {
  const project = demoProject(); const headers = { 'x-livespace-client': 'desktop' };
  expect((await request.get('/api/projects')).status()).toBe(403);
  expect((await request.put(`/api/projects/${project.id}`, { headers, data: { ...project, schemaVersion: 999 } })).status()).toBe(400);
  try {
    expect((await request.put(`/api/projects/${project.id}`, { headers, data: project })).status()).toBe(200);
    expect(await (await request.get(`/api/projects/${project.id}`, { headers })).json()).toEqual(project);
  } finally { expect((await request.delete(`/api/projects/${project.id}`, { headers })).status()).toBe(204); }
});

test('a rendered move gizmo drag commits to the layout and can be undone', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  await page.getByRole('button', { name: 'Demo project', exact: true }).click();
  await page.locator('.object-list button').filter({ hasText: 'Writing desk' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Position X', exact: true })).toHaveValue('1');
  const handle = await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource');
    const { currentEngine: engine } = await import(resources.find(entry => entry.name.includes('/planner/ThreeOverlay.tsx'))!.name);
    const { Box3, Vector3 } = await import(resources.find(entry => entry.name.includes('/deps/three.js'))!.name) as typeof import('three');
    const helper = engine.controls.getHelper(); helper.updateMatrixWorld(true);
    let point: { x: number; y: number } | undefined;
    helper.traverse((object: import('three').Object3D) => {
      if (point || object.type !== 'Mesh' || object.name !== 'X') return;
      for (let parent: import('three').Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return;
      const center = new Box3().setFromObject(object).getCenter(new Vector3()).project(engine.projection.camera);
      const box = engine.renderer.domElement.getBoundingClientRect();
      point = { x: box.x + (center.x + 1) * box.width / 2, y: box.y + (1 - center.y) * box.height / 2 };
    });
    return point;
  });
  expect(handle).toBeDefined();
  await page.mouse.move(handle!.x, handle!.y); await page.mouse.down();
  await page.mouse.move(handle!.x + 45, handle!.y, { steps: 10 }); await page.mouse.up();
  await expect(page.getByRole('spinbutton', { name: 'Position X', exact: true })).not.toHaveValue('1');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.locator('.object-list button').filter({ hasText: 'Writing desk' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Position X', exact: true })).toHaveValue('1');
});
