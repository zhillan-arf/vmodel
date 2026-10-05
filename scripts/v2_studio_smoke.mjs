import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

const modelId = process.argv[2] ?? 'rei-v2';
assert(['rei-v2', 'ene-v2'].includes(modelId));
const modelName = modelId === 'rei-v2' ? 'Rei v2' : 'Ene v2';
const server = await startIsolatedStudioServer();
let browser;
const base = 'ops/001-zhil/sprint-002/reports';
try {
  browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const errors = [], requests = [];
  context.on('page', page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(server.base)) requests.push(request.url()); });
  });
  await context.addInitScript(modelId => {
    try { if (!localStorage.getItem('vmodel-avatar')) localStorage.setItem('vmodel-avatar', modelId); }
    catch { /* The initial blank window has no local storage. */ }
  }, modelId);
  const page = await context.newPage();
  const ready = p => p.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
  await page.goto(server.base); await ready(page);
  console.log(`${modelName}: studio model is ready.`);
  assert.equal(await page.locator('#avatar-select').inputValue(), modelId);
  await page.locator('#framing').selectOption('face');
  await page.locator('#faceDetail').selectOption('extended');
  await page.locator('#lighting').selectOption('warm');
  await page.locator('#outputResolution').selectOption('1080p');
  for (const [key, value] of [['cameraFov', '42'], ['lightIntensity', '0.9']]) {
    await page.locator(`#${key}`).fill(value); await page.locator(`#${key}`).dispatchEvent('change');
  }
  await page.evaluate(() => {
    const sample = () => {
      const timestamp = performance.timeOrigin + performance.now();
      const face = window.__testFace ?? { jawOpen: .15, browOuterUpLeft: .2 };
      window.__vmodel.setFrame({ version: 1, sequence: 1, timestamp, face,
        faceMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], pose: [], poseImage: [], hands: [], inferenceMs: 0,
        samples: Object.fromEntries(['face', 'pose', 'hands'].map(name => [name, { timestamp, inferenceMs: 0, present: name === 'face' }])) });
    };
    sample(); window.__sampleTimer = setInterval(sample, 50);
  });
  await page.locator('#calibrate').click();
  const before = await page.evaluate(() => window.__vmodel.getState());
  assert.deepEqual(before.calibration.face, { jawOpen: .15, browOuterUpLeft: .2 });
  const popup = page.waitForEvent('popup'); await page.locator('#output').click();
  const output = await popup; await ready(output);
  const state = p => p.evaluate(() => {
    const v = window.__vmodel;
    return { ...v.getState(), canvas: { width: v.viewer.renderer.domElement.width, height: v.viewer.renderer.domElement.height },
      fov: v.viewer.camera.fov, lights: v.viewer.scene.children.filter(child => child.isLight).map(light => ({ color: light.color.getHexString(), intensity: light.intensity })),
      brows: v.viewer.vrm.expressionManager.getValue('vmodelBrowUpLeft'), aa: v.viewer.vrm.expressionManager.getValue('aa') };
  });
  let received = await state(output);
  console.log(`${modelName}: output model is ready.`);
  assert.equal(received.avatarId, before.avatarId); assert.deepEqual(received.settings, before.settings);
  assert.deepEqual(received.calibration, before.calibration); assert.deepEqual(received.canvas, { width: 1920, height: 1080 });
  assert.equal(received.fov, 42); assert.deepEqual(received.lights, (await state(page)).lights);
  await page.evaluate(() => { window.__testFace = { jawOpen: .6, browOuterUpLeft: 1 }; });
  await output.waitForFunction(() => window.__vmodel.viewer.vrm.expressionManager.getValue('vmodelBrowUpLeft') > .6, undefined, { timeout: 30000 });
  const facialOutput = await state(output);
  assert(facialOutput.aa > .7);
  await page.locator('[data-expression="surprised"]').click();
  await output.waitForFunction(() => window.__vmodel.viewer.vrm.expressionManager.getValue('aa') < .01, undefined, { timeout: 30000 });
  await page.locator('[data-expression="neutral"]').click();
  await page.locator('#orientation').selectOption('portrait');
  await output.waitForFunction(() => document.querySelector('canvas').width === 1080);
  assert.deepEqual((await state(output)).canvas, { width: 1080, height: 1920 });
  await output.setViewportSize({ width: 640, height: 600 });
  assert.deepEqual((await state(output)).canvas, { width: 1080, height: 1920 });
  await page.locator('#outputResolution').selectOption('720p');
  await output.waitForFunction(() => document.querySelector('canvas').width === 720);
  assert.deepEqual((await state(output)).canvas, { width: 720, height: 1280 });
  await page.locator('#lighting').selectOption('violet');
  await output.waitForFunction(() => window.__vmodel.getState().settings.lighting === 'violet');
  assert.deepEqual((await state(output)).lights, (await state(page)).lights);
  await output.reload(); await ready(output);
  assert.deepEqual((await state(output)).settings, (await state(page)).settings);
  await page.locator('#orientation').selectOption('landscape');
  await output.waitForFunction(() => document.querySelector('canvas').width === 1280);
  assert.deepEqual((await state(output)).canvas, { width: 1280, height: 720 });
  await output.close();
  await page.evaluate(() => clearInterval(window.__sampleTimer));
  await page.locator('#orientation').selectOption('landscape');
  await page.locator('#outputResolution').selectOption('1080p');
  await page.reload(); await ready(page);
  const persisted = await state(page);
  assert.equal(persisted.settings.faceDetail, 'extended'); assert.equal(persisted.settings.outputResolution, '1080p');
  assert.equal(persisted.settings.lighting, 'violet'); assert.equal(persisted.settings.cameraFov, 42);
  await page.locator('button[data-view="library"]').click();
  const card = page.locator(`[data-entry-id="${modelId}"]`);
  await card.waitFor();
  assert.equal(await card.locator(modelId === 'rei-v2' ? 'a[download="rei-v2-readme.txt"]' : 'a[href="/avatars/ene-v2-notices/index.html"]').count(), 1);
  if (modelId === 'ene-v2') {
    const provenance = await (await context.request.get(server.base + '/avatars/ene-v2-notices/provenance.json')).json();
    for (const [file, expected] of Object.entries(provenance.termsSha256)) {
      const response = await context.request.get(server.base + '/avatars/ene-v2-notices/' + file.split('/').map(encodeURIComponent).join('/'));
      assert(response.ok());
      assert.equal(createHash('sha256').update(await response.body()).digest('hex'), expected);
    }
  }
  await page.waitForFunction(modelId => {
    const image = document.querySelector(`[data-entry-id="${modelId}"] img`); return image?.complete && image.naturalWidth > 0;
  }, modelId);
  await mkdir(`${base}/local/${modelId}`, { recursive: true });
  await page.screenshot({ path: `${base}/local/${modelId}/library.png` });
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  const sourceHashes = {};
  for (const file of ['src/main.ts', 'src/library-panel.ts', 'src/avatars.ts', 'src/viewer.ts', 'src/types.ts', 'src/face-expressions.ts', 'src/motion-solver.ts', 'scripts/v2_studio_smoke.mjs']) {
    sourceHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
  await writeFile(`${base}/${modelId}-studio.json`, JSON.stringify({ date: new Date().toISOString(), sourceHashes,
    initial: before, output: received, facialOutput, persisted, errors, externalRequests: requests,
    checks: ['Local model selection', 'Light and camera settings', '1080p and 720p in both orientations', 'Face calibration transfer',
      'Brow and mouth output', 'Manual expression conflict control', 'Output reload', 'Saved settings', 'Source terms and thumbnail'],
    limits: ['Synthetic face coefficients.', 'No camera, OBS, or target GPU measurement.'] }, null, 2) + '\n');
  console.log(`${modelName} passed the studio and output checks.`);
} finally {
  await browser?.close(); await server.stop();
}
