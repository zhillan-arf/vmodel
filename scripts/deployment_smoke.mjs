import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

const server = process.env.VMODEL_TEST_URL ? null : await startIsolatedStudioServer();
const base = new URL(process.env.VMODEL_TEST_URL ?? server.base).origin;
let browser;
try {
  const health = await fetch(`${base}/health`);
  assert.equal((await health.json()).application, 'vmodel');
  assert.match(health.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.match(health.headers.get('content-security-policy'), /worker-src 'self'/);
  assert.equal((await fetch(`${base}/missing-file.task`)).status, 404);
  assert.equal((await fetch(`${base}/health`, { headers: { Origin: 'https://other.example' } })).status, 403);
  for (const [file, type] of [
    ['runtime/face_landmarker.task', 'application/octet-stream'],
    ['runtime/pose_landmarker_lite.task', 'application/octet-stream'],
    ['runtime/hand_landmarker.task', 'application/octet-stream'],
    ['runtime/wasm/vision_wasm_internal.wasm', 'application/wasm'],
    ['runtime/wasm/vision_wasm_internal.js', 'application/javascript'],
  ]) {
    const response = await fetch(`${base}/${file}`, { method: 'HEAD' });
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get('content-type'), type, file);
  }
  browser = await chromium.launch({ channel: process.env.VMODEL_BROWSER ?? 'chromium', headless: true, args: [
    '--use-fake-device-for-media-stream',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  ] });
  const context = await browser.newContext();
  const errors = [], external = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  context.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) external.push(request.url());
  });
  await context.addInitScript(() => {
    window.cameraRequests = []; window.cameraTracks = [];
    if (!navigator.mediaDevices) return;
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.cameraRequests.push(constraints);
      const stream = await getUserMedia(constraints);
      window.cameraTracks.push(...stream.getTracks());
      return stream;
    };
  });
  const page = await context.newPage();
  await page.goto(base);
  await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
  assert.equal(await page.evaluate(() => window.cameraRequests.length), 0);
  assert.equal(await page.evaluate(async () => (await navigator.permissions.query({ name: 'camera' })).state), 'prompt');
  await context.grantPermissions([], { origin: base });
  assert.equal(await page.evaluate(async () => (await navigator.permissions.query({ name: 'camera' })).state), 'denied');
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('permission denied')).catch(async error => {
    console.error(await page.evaluate(() => ({ status: document.querySelector('#status').textContent, requests: window.cameraRequests })));
    console.error(errors);
    throw error;
  });
  await context.grantPermissions(['camera'], { origin: base });
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__vmodel.getStats().sequence >= 3, undefined, { timeout: 90000 });
  assert.equal(await page.evaluate(() => window.cameraRequests.length), 2);
  assert(await page.evaluate(() => window.cameraRequests.every(request => request.audio === false)));
  console.log('Camera permission and tracking checks passed.');
  const popup = page.waitForEvent('popup');
  await page.locator('#output').click();
  const output = await popup;
  await output.waitForFunction(() => window.__vmodel?.getStats().sequence >= 3, undefined, { timeout: 90000 });
  assert.equal(await output.evaluate(() => window.cameraRequests.length), 0);
  await page.locator('#stop').click();
  assert(await page.evaluate(() => window.cameraTracks.length > 0 && window.cameraTracks.every(track => track.readyState === 'ended')));
  await output.close();
  await page.locator('#start').click();
  await page.waitForFunction(() => window.cameraTracks.some(track => track.readyState === 'live'));
  await page.locator('#stop').click();
  assert(await page.evaluate(() => window.cameraTracks.every(track => track.readyState === 'ended')));
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await context.close();

  const insecure = await browser.newContext();
  const blocked = await insecure.newPage();
  await blocked.addInitScript(() => Object.defineProperty(window, 'isSecureContext', { value: false }));
  await blocked.goto(base);
  await blocked.getByRole('alert').waitFor();
  assert.match(await blocked.getByRole('alert').textContent(), /requires HTTPS or localhost/);
  assert.equal(await blocked.evaluate(() => typeof window.__vmodel), 'undefined');
  await insecure.close();
  console.log('Deployment checks passed: server policy, assets, permission denial, tracking, output, stop, restart, and HTTPS instruction.');
  console.log('The test used a simulated camera. A physical camera check needs a person.');
} finally {
  await browser?.close();
  await server?.stop();
}
