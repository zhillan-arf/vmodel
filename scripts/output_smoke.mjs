import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.VMODEL_TEST_URL ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
] });
const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1280, height: 900 } });
const errors = [], checks = {}, measurements = {};
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
await context.addInitScript(() => {
  window.__cameraRequests = []; window.__testTracks = [];
  if (!navigator.mediaDevices) return; // The popup's initial about:blank has no media API.
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async constraints => {
    window.__cameraRequests.push(constraints);
    const stream = await original(constraints); window.__testTracks.push(...stream.getTracks()); return stream;
  };
});
const page = await context.newPage();
let output;
const ready = p => p.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
async function start() {
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__vmodel.getStats().inferenceMs > 0, undefined, { timeout: 65000 });
}
async function fixture() {
  await page.evaluate(() => {
    clearInterval(window.__poseTimer);
    let sequence = 100000;
    const pose = () => {
      const timestamp = performance.timeOrigin + performance.now();
      const yaw = .25, c = Math.cos(yaw), s = Math.sin(yaw);
      window.__vmodel.setFrame({ version: 1, sequence: sequence++, timestamp,
        face: { jawOpen: .1, eyeBlinkLeft: .15 }, faceMatrix: [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1],
        pose: [], poseImage: [], hands: [], inferenceMs: 1,
        samples: Object.fromEntries(['face','pose','hands'].map(name => [name, { timestamp, inferenceMs: 1, present: name === 'face' }])) });
    };
    pose(); window.__poseTimer = setInterval(pose, 16);
  });
}
async function openOutput() {
  const next = page.waitForEvent('popup'); await page.locator('#output').click();
  output = await next; await ready(output);
  assert.equal(await output.evaluate(() => window.__cameraRequests.length), 0);
}
async function canvasState(p) {
  return p.evaluate(() => {
    const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect();
    return { width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height,
      aspect: window.__vmodel.viewer.camera.aspect, state: window.__vmodel.getState(),
      happy: window.__vmodel.viewer.vrm.expressionManager.getValue('happy'),
      cameraRequests: window.__cameraRequests.length, videoCount: document.querySelectorAll('video').length,
      controls: document.querySelectorAll('button,input,select').length };
  });
}
async function sampleRender(p, seconds = 5) {
  const samples = [];
  for (let i = 0; i < seconds; i++) { await p.waitForTimeout(1000); samples.push(await p.evaluate(() => window.__vmodel.getStats())); }
  return samples;
}
try {
  await mkdir('ops/001-zhil/sprint-001/reports/local/output', { recursive: true });
  await page.goto(base); await ready(page);
  console.log('Ene loaded; starting synthetic camera and saved-state checks.');
  assert.equal(await page.evaluate(() => window.__cameraRequests.length), 0);
  await start(); await fixture();
  await page.locator('#orientation').selectOption('portrait');
  await page.locator('#zoom').fill('0.95'); await page.locator('#zoom').dispatchEvent('change');
  await page.locator('#key-color').click(); await page.locator('[data-expression="happy"]').click();
  await page.locator('#calibrate').click();
  const before = await page.evaluate(() => window.__vmodel.getState());
  assert(before.calibration); assert.match(await page.locator('#status').textContent(), /saved/);
  await openOutput(); await output.setViewportSize({ width: 720, height: 1280 });
  await output.waitForTimeout(1800);
  let state = await canvasState(output);
  assert.equal(state.width, 720); assert.equal(state.height, 1280);
  assert(Math.abs(state.cssWidth / state.cssHeight - 9 / 16) < .001);
  assert.equal(state.state.avatarId, before.avatarId); assert.deepEqual(state.state.settings, before.settings);
  assert.deepEqual(state.state.calibration, before.calibration); assert(state.happy > .6);
  assert.equal(state.videoCount, 0); assert.equal(state.controls, 0);
  checks.portrait = state;
  await output.screenshot({ path: 'ops/001-zhil/sprint-001/reports/local/output/portrait.png' });
  await page.locator('#orientation').selectOption('landscape');
  await output.setViewportSize({ width: 1280, height: 720 });
  await output.waitForFunction(() => document.querySelector('canvas').width === 1280);
  state = await canvasState(output); assert.equal(state.height, 720);
  assert(Math.abs(state.cssWidth / state.cssHeight - 16 / 9) < .001);
  checks.landscape = state;
  console.log('Landscape and portrait geometry/state passed; checking reconnect and restart.');
  await output.screenshot({ path: 'ops/001-zhil/sprint-001/reports/local/output/landscape.png' });
  await output.setViewportSize({ width: 850, height: 900 }); await output.waitForTimeout(250);
  const resized = await canvasState(output);
  assert.equal(resized.width, 1280); assert(Math.abs(resized.cssWidth / resized.cssHeight - 16 / 9) < .001);
  checks.resizeKeepsComposition = true;
  await output.reload(); await ready(output);
  await output.waitForTimeout(800);
  assert.deepEqual((await canvasState(output)).state.calibration, before.calibration);
  checks.outputReloadRestoresCalibration = true;
  await output.close();
  await page.waitForFunction(() => document.querySelector('#output-status').textContent.startsWith('Output closed'), undefined, { timeout: 7000 });
  await openOutput(); await output.waitForTimeout(700);
  assert.equal((await canvasState(output)).state.expression, 'happy');
  assert.equal(await page.evaluate(() => window.__cameraRequests.length), 1);
  checks.reopenSharesSingleCamera = true;
  await page.reload(); await ready(page);
  assert.equal(await page.evaluate(() => window.__cameraRequests.length), 0);
  await start();
  await page.waitForTimeout(1800);
  const restored = await page.evaluate(() => window.__vmodel.getState());
  assert.deepEqual(restored.calibration, before.calibration);
  assert.equal(restored.settings.zoom, .95);
  assert.equal(restored.settings.orientation, 'landscape');
  await output.waitForFunction(expected => JSON.stringify(window.__vmodel.getState().calibration) === JSON.stringify(expected), before.calibration);
  checks.controllerRestartRestoresScopedCalibration = true;
  console.log('Restart passed; sampling render overhead and clean-view controls.');
  await fixture();
  measurements.dualControl = await sampleRender(page);
  measurements.dualOutput = await sampleRender(output);
  await output.close();
  await page.setViewportSize({ width: 1280, height: 720 }); await page.locator('#clean').click();
  await page.waitForTimeout(300);
  const single = await canvasState(page); assert.equal(single.width, 1280); assert.equal(single.height, 720);
  assert.equal(await page.locator('#start').isVisible(), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body, '::after').display), 'none');
  checks.cleanContainsNoControls = true;
  measurements.singleClean = await sampleRender(page);
  await page.keyboard.press('Space');
  assert(await page.evaluate(() => window.__testTracks.every(track => track.readyState === 'ended')));
  checks.cleanSpaceStopsCamera = true;
  await page.keyboard.press('Escape'); assert(await page.locator('#start').isVisible());
  checks.escapeReturnsControls = true;
  await page.locator('#reset').click(); await start();
  assert.equal((await page.evaluate(() => window.__vmodel.getState())).calibration, null);
  checks.resetClearsSavedCalibration = true;
  await page.locator('#stop').click();
  assert.deepEqual(errors, []);
} catch (error) {
  checks.failure = String(error); console.error(error); process.exitCode = 1;
} finally {
  await writeFile('ops/001-zhil/sprint-001/reports/output-smoke.json', JSON.stringify({ date: new Date().toISOString(), base,
    input: 'Synthetic camera plus injected tracking frames; production build and actual Ene VRM. Render samples are headless observations under concurrent local work, not real gesture/OBS performance acceptance.',
    checks, measurements, errors }, null, 2));
  console.log(JSON.stringify({ checks, measurements: Object.fromEntries(Object.entries(measurements).map(([key, value]) => [key, value.map(v => Math.round(v.fps))])), errors }));
  await browser.close();
}
