import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const host = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts', '--production'], {
  env: { ...process.env, PORT: '5174', HTTPS_PORT: '5444', CERT_PORT: '5445', LIVESPACE_OPEN: '0' },
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
host.stdout.on('data', data => { output += data; });
host.stderr.on('data', data => { output += data; });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let savedId: string | undefined;
try {
  let available = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (host.exitCode !== null) throw new Error(`Production host exited: ${output}`);
    try { available = (await fetch('http://localhost:5174/api/health')).ok; } catch { /* Await local startup. */ }
    if (available) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(available, `Production startup timed out: ${output}`);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5174');
  await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'iPhone camera' }).click();
  await page.getByRole('textbox', { name: 'Camera URL' }).waitFor();
  await page.waitForFunction(() => (document.querySelector('[aria-label="Camera URL"]') as HTMLInputElement)?.value.includes(':5444/camera'));
  await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'Sample room' }).click();
  await page.waitForFunction(() => (document.querySelector('.room-image') as HTMLImageElement)?.naturalWidth > 0);
  await page.screenshot({ path: '.local/production-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Demo project', exact: true }).click();
  await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.getByRole('slider', { name: 'Timeline scrubber', exact: true }).fill('0.5');
  await page.waitForFunction(() => {
    const source = document.querySelector('canvas[aria-label="3D room overlay"]') as HTMLCanvasElement;
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d')!; context.drawImage(source, 0, 0, 64, 64);
    return context.getImageData(0, 0, 64, 64).data.some((value, index) => index % 4 === 3 && value > 0);
  });
  const savedResponse = page.waitForResponse(response => response.url().includes('/api/projects/') && response.request().method() === 'PUT' && response.status() === 200);
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  savedId = ((await (await savedResponse).json()) as { id: string }).id;
  await page.screenshot({ path: '.local/production-planner.png', fullPage: true });
  await page.locator('input[accept="image/*,video/mp4,video/webm,video/quicktime"]').setInputFiles('public/markers/marker.png');
  await page.getByRole('navigation', { name: 'Workspace modes' }).getByRole('button', { name: 'Calibration', exact: true }).click();
  await page.getByText('Optional marker tracking', { exact: true }).click();
  await page.getByRole('button', { name: 'Track marker', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.tracking-state')?.textContent === 'MARKER FOUND');
  await page.getByRole('button', { name: 'Confirm marker origin', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.tracking-state')?.textContent === 'TRACKING');
  await page.locator('input[accept="image/*,video/mp4,video/webm,video/quicktime"]').setInputFiles('public/markers/cube-marker.png');
  await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click();
  await page.getByRole('button', { name: 'Start tracking', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="cube-tracking"]')?.textContent === 'TRACKING');
  await page.getByRole('button', { name: 'Start Recording', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="cube-samples"]')?.textContent) >= 5);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('slider', { name: 'Cube time', exact: true }).fill('150');
  await page.waitForFunction(() => {
    const source = document.querySelector('canvas[aria-label="3D cube overlay"]') as HTMLCanvasElement;
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d')!; context.drawImage(source, 0, 0, 64, 64);
    return context.getImageData(0, 0, 64, 64).data.some((value, index) => index % 4 === 3 && value > 0);
  });
  await page.getByRole('textbox', { name: 'Keyframe name', exact: true }).fill('Production midpoint');
  await page.getByRole('button', { name: 'Add Keyframe', exact: true }).click();
  const exported = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export Recording JSON', exact: true }).click();
  await (await exported).saveAs('.local/production-cube.json');
  await page.reload(); await page.getByRole('button', { name: '4D Cube Lab', exact: true }).click();
  await page.locator('input[accept=".json,application/json"]').setInputFiles('.local/production-cube.json');
  await page.waitForFunction(() => document.querySelector('[data-testid="cube-mode"]')?.textContent === 'PLAYBACK');
  await page.getByRole('button', { name: 'Seek keyframe Production midpoint', exact: true }).click();
  await page.getByRole('button', { name: 'Play cube recording', exact: true }).click();
  await page.getByRole('button', { name: 'Pause cube playback', exact: true }).click();
  await page.getByRole('button', { name: 'Show Marker 101', exact: true }).click();
  await page.getByRole('dialog', { name: 'Marker 101', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close marker', exact: true }).click();
  await page.getByText('Tracking Diagnostics', { exact: true }).click();
  await page.getByRole('button', { name: 'Test Marker Image', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="cube-self-test"]')?.textContent?.includes('SELF-TEST PASS: ID 101'));
  await page.screenshot({ path: '.local/production-cube.png', fullPage: true });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  await phone.goto('https://localhost:5444/camera');
  await phone.getByRole('heading', { name: '4D LiveSpace Camera', exact: true }).waitFor();
  assert(!(await phone.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('DesktopApp-')))), 'Phone must not download the desktop editor');
  assert.deepEqual(errors, []);
  console.log('Production smoke passed: compiled clients, QR/assets, room and cube 3D, JSON save, real ID 100/101 detection, cube record/scrub/export/import/offline replay/keyframes, marker modal/self-test, phone bundle isolation.');
} finally {
  await browser?.close();
  if (savedId) await fetch(`http://localhost:5174/api/projects/${savedId}`, { method: 'DELETE', headers: { 'x-livespace-client': 'desktop' } }).catch(() => undefined);
  const exited = new Promise(resolve => host.once('exit', resolve));
  if (host.exitCode === null) { host.kill('SIGTERM'); await exited; }
}
