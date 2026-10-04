import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

const server = await startIsolatedStudioServer();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [], checks = {};
context.on('page', child => child.on('pageerror', error => errors.push(error.message)));
page.on('pageerror', error => errors.push(error.message));
const ready = (target, name) => target.waitForFunction(name => window.__vmodel?.getState().label.startsWith(name), name, { timeout: 90000 });
const idleHands = target => target.evaluate(() => {
    const { retarget, viewer, getState } = window.__vmodel;
    for (let i = 0; i < 120; i++) { retarget.update(null, getState().settings, 1 / 60, performance.timeOrigin + performance.now()); viewer.vrm.update(1 / 60); }
    viewer.vrm.scene.updateMatrixWorld(true);
    return ['left', 'right'].map(side => {
      const arm = viewer.vrm.humanoid.getNormalizedBoneNode(side + 'UpperArm');
      const hand = viewer.vrm.humanoid.getNormalizedBoneNode(side + 'Hand');
      return hand.matrixWorld.elements[13] < arm.matrixWorld.elements[13];
    });
  });
try {
  await mkdir('ops/reports/local', { recursive: true });
  await page.goto(server.base); await ready(page, 'Ene');
  assert.equal(await page.title(), 'VModel');
  assert((await idleHands(page)).every(Boolean), 'Both Ene hands should rest below the shoulders');
  checks.eneIdlePose = true;
  const ene = await page.evaluate(() => window.__vmodel.getState().avatarId);
  await page.selectOption('#framing', 'bust');
  const popup = page.waitForEvent('popup'); await page.click('#output'); const output = await popup;
  await ready(output, 'Ene');
  await page.selectOption('#avatar-select', 'rei'); await ready(page, 'Rei'); await ready(output, 'Rei');
  const rei = await page.evaluate(() => window.__vmodel.getState().avatarId);
  assert.notEqual(ene, rei);
  assert.equal(await output.evaluate(() => window.__vmodel.getState().avatarId), rei);
  checks.switchAndOutputSync = true;
  const capabilities = await page.evaluate(() => {
    const vrm = window.__vmodel.viewer.vrm;
    return { meta: vrm.meta, expressions: Object.keys(vrm.expressionManager.expressionMap),
      bones: Object.keys(vrm.humanoid.normalizedHumanBones), meshes: vrm.scene.children.length };
  });
  assert((await idleHands(page)).every(Boolean), 'Both Rei hands should rest below the shoulders');
  await page.click('[data-expression="surprised"]');
  const surprise = await page.evaluate(() => {
    const { retarget, viewer, getState } = window.__vmodel;
    for (let i = 0; i < 120; i++) retarget.update(null, getState().settings, 1 / 60, performance.timeOrigin + performance.now());
    return viewer.vrm.expressionManager.getValue('びっくり');
  });
  assert(surprise > 0.7); await page.click('[data-expression="neutral"]');
  checks.reiIdlePoseAndSurprise = true;
  await page.screenshot({ path: 'ops/reports/local/rei-selection.png' });
  await page.selectOption('#framing', 'body');
  await page.selectOption('#avatar-select', 'ene'); await ready(page, 'Ene');
  assert.equal(await page.inputValue('#framing'), 'bust');
  await page.selectOption('#avatar-select', 'rei'); await ready(page, 'Rei');
  assert.equal(await page.inputValue('#framing'), 'body');
  checks.avatarSettingsIsolation = true;
  await page.reload(); await ready(page, 'Rei');
  assert.equal(await page.inputValue('#avatar-select'), 'rei');
  checks.reloadPersistence = true;
  await page.route('**/avatars/ene.vrm', route => route.fulfill({ status: 404, body: 'missing test avatar' }));
  await page.selectOption('#avatar-select', 'ene');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('not found'));
  assert.equal(await page.evaluate(() => window.__vmodel.getState().avatarId), rei);
  assert.equal(await page.inputValue('#avatar-select'), 'rei');
  assert(await page.locator('#loading').evaluate(el => el.classList.contains('hidden')));
  checks.failureKeepsWorkingAvatar = true;
  await page.unroute('**/avatars/ene.vrm');
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  await page.route('**/avatars/ene.vrm', async route => { await blocked; await route.continue(); });
  const request = page.waitForRequest('**/avatars/ene.vrm');
  await page.selectOption('#avatar-select', 'ene'); await request;
  await page.selectOption('#avatar-select', 'rei');
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Rei') && document.querySelector('#status').textContent.includes('ready'));
  release();
  await page.waitForResponse('**/avatars/ene.vrm');
  await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(() => window.__vmodel.getState().avatarId), rei);
  await ready(output, 'Rei');
  checks.delayedOlderFetchCannotReplaceLatest = true;
  await page.unroute('**/avatars/ene.vrm');
  await page.setInputFiles('#avatar-file', { name: 'invalid.vrm', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid') });
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Select a VRM'));
  assert.equal(await page.evaluate(() => window.__vmodel.getState().avatarId), rei);
  checks.manualUploadFailurePreservesSelection = true;
  assert.deepEqual(errors, []);
  await writeFile('ops/reports/local/model-selection-smoke.json', JSON.stringify({ checks, capabilities, errors }, null, 2));
  console.log(JSON.stringify({ checks, capabilities, errors }));
} finally { await browser.close(); await server.stop(); }
