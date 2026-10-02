import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { get } from 'node:https';

test('receives real WebRTC video, stops and reconnects', async ({ page, context }) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.stack ?? error.message));
  await page.addInitScript(() => {
    const sockets: WebSocket[] = [];
    const Original = window.WebSocket;
    Object.assign(window, { testSockets: sockets });
    window.WebSocket = class extends Original {
      constructor(url: string | URL, protocols?: string | string[]) { super(url, protocols); if (String(url).includes('/signal?')) sockets.push(this); }
    };
  });
  await page.goto('/');
  const url = page.getByRole('textbox', { name: 'Camera URL' });
  await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'iPhone camera' }).click();
  await expect(url).toHaveValue(/https:\/\/.+\/camera\?session=/);
  const cameraUrl = new URL(await url.inputValue());
  const phone = await context.newPage(); phone.on('pageerror', error => errors.push(error.stack ?? error.message));
  await phone.setViewportSize({ width: 390, height: 844 });
  // Fake device supplies real capture tracks; actual SDP, ICE and encoded frames cross WebRTC.
  await phone.goto(cameraUrl.href);
  await phone.getByRole('button', { name: 'Start Camera' }).click();
  await expect(phone.getByRole('button', { name: 'Connect to PC' })).toBeEnabled();
  await phone.getByRole('button', { name: 'Connect to PC' }).click();
  await expect(page.getByText('Live video received')).toBeVisible({ timeout: 20000 });
  await expect(phone.getByText('Connected to PC')).toBeVisible();
  await expect.poll(() => page.locator('video').evaluate(node => { const video = node as HTMLVideoElement; return video.readyState >= 2 && video.videoWidth > 0; })).toBe(true);
  const pixels = await page.locator('video').evaluate(node => {
    const video = node as HTMLVideoElement;
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(video, 0, 0, 32, 32);
    return new Set(ctx.getImageData(0, 0, 32, 32).data).size;
  });
  expect(pixels).toBeGreaterThan(10);
  await expect.poll(() => page.locator('video').evaluate(node => (node as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames)).toBeGreaterThan(5);
  await expect(page.locator('.stream-details dd').nth(2)).toHaveText(/^[1-9]\d* FPS$/);
  await page.screenshot({ path: 'test-results/desktop-live.png', fullPage: true });
  await phone.screenshot({ path: 'test-results/phone-live.png', fullPage: true });
  // Interrupt the real signaling transport and verify the client's automatic retry.
  await page.evaluate(() => (window as unknown as { testSockets: WebSocket[] }).testSockets.at(-1)?.close());
  await expect(page.getByText('Live video received')).not.toBeVisible();
  await expect(page.getByText('Live video received')).toBeVisible({ timeout: 20000 });
  await phone.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByText('Live video received')).not.toBeVisible();
  await phone.getByRole('button', { name: 'Start Camera' }).click();
  await phone.getByRole('button', { name: 'Connect to PC' }).click();
  await expect(page.getByText('Live video received')).toBeVisible({ timeout: 20000 });
  await phone.reload();
  await expect(page.getByText('Live video received')).not.toBeVisible();
  await phone.getByRole('button', { name: 'Start Camera' }).click();
  await phone.getByRole('button', { name: 'Connect to PC' }).click();
  await expect(page.getByText('Live video received')).toBeVisible({ timeout: 20000 });
  expect(errors).toEqual([]);
});

test('generated CA validates the LAN HTTPS certificate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'iPhone camera' }).click();
  const field = page.getByRole('textbox', { name: 'Camera URL' });
  await expect(field).toHaveValue(/https:/);
  const address = new URL(await field.inputValue()); address.pathname = '/api/health'; address.search = '';
  const ca = await readFile('.local/certs/livespace-ca.crt');
  const body = await new Promise<string>((resolve, reject) => {
    const request = get(address, { ca, rejectUnauthorized: true }, response => {
      let data = ''; response.on('data', chunk => { data += chunk; }); response.on('end', () => resolve(data));
    });
    request.on('error', reject);
  });
  expect(JSON.parse(body)).toEqual({ ok: true, tlsReady: true });
});

test('setup QR certificate endpoint downloads the actual public CA', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'iPhone camera' }).click();
  await expect(page.getByRole('textbox', { name: 'Camera URL' })).toHaveValue(/https:/);
  await page.getByRole('button', { name: 'First-time iPhone setup' }).click();
  const url = await page.getByRole('dialog').getByRole('link').getAttribute('href');
  const response = await request.get(url!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/x-x509-ca-cert');
  expect(await response.body()).toEqual(await readFile('.local/certs/livespace-ca.crt'));
  const desktop = await request.get('/livespace-ca.crt');
  expect(desktop.status()).toBe(200);
  expect(await desktop.body()).toEqual(await response.body());
  const privateKey = await request.get(new URL('/ca-key.pem', url!).href);
  expect(privateKey.status()).toBe(404);
});

test('Windows webcam stops its tracks when changing source', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Windows webcam' }).click();
  await expect(page.getByText('Webcam active')).toBeVisible();
  await page.evaluate(() => Object.assign(window, { testTrack: ((document.querySelector('video')!.srcObject as MediaStream).getVideoTracks()[0]) }));
  await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'Sample room' }).click();
  expect(await page.evaluate(() => (window as unknown as { testTrack: MediaStreamTrack }).testTrack.readyState)).toBe('ended');
});

test('sample image, fit controls and PNG export work offline', async ({ page }) => {
  await page.goto('/'); await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'Sample room' }).click();
  const image = page.getByAltText('Room reference'); await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Fill', exact: true }).click();
  await expect(image).toHaveCSS('object-fit', 'cover');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(image).toHaveCSS('object-fit', 'contain');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Capture camera frame' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await page.screenshot({ path: 'test-results/desktop-reference.png', fullPage: true });
});

test('phone UI fits iPhone portrait and explains missing pairing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/camera');
  await expect(page.getByText('Open the camera link from the desktop QR code.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/phone-portrait.png', fullPage: true });
});

test('desktop responds at mobile width and presents HTTPS onboarding', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('navigation', { name: 'Video sources' }).getByRole('button', { name: 'iPhone camera' }).click();
  await expect(page.getByRole('textbox', { name: 'Camera URL' })).toHaveValue(/https:/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'First-time iPhone setup' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Enable full trust')).toBeVisible();
  await page.screenshot({ path: 'test-results/setup-mobile.png', fullPage: true });
});
