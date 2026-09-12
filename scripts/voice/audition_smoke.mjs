import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = 'http://127.0.0.1:5081';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
const externalRequests = [];
const errors = [];
let saveBody;
await context.addInitScript(() => {
  window.microphoneRequests = 0;
  navigator.mediaDevices.getUserMedia = async () => { window.microphoneRequests++; throw new Error('Microphone must stay off'); };
});
await context.route('**/*', async route => {
  const request = route.request();
  if (!request.url().startsWith(base + '/')) {
    externalRequests.push(request.url());
    return route.abort();
  }
  // Exercise the UI submission without writing simulated opinions over the
  // real user's notes. Server persistence is separately tested in a temp dir.
  if (request.url() === base + '/ratings' && request.method() === 'POST') {
    saveBody = request.postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"saved":true,"provisional":true}' });
  }
  return route.continue();
});
try {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => [...document.querySelectorAll('audio')].every(audio => Number.isFinite(audio.duration)));
  const initial = await page.locator('audio').evaluateAll(players => players.map(p => ({ paused: p.paused, duration: p.duration })));
  assert.equal(initial.length, 4);
  assert(initial.every(p => p.paused && Math.abs(p.duration - 8.3967) < 0.001));
  for (const name of ['bright', 'soft', 'cool']) {
    const button = page.locator(`[data-compare="${name}"]`);
    await button.click();
    await page.waitForFunction(() => !document.querySelector('#source-audio').paused);
    await button.click();
    await page.waitForFunction(name => !document.querySelector(`[data-voice="${name}"] audio`).paused, name);
    assert.equal(await page.locator('audio').evaluateAll(players => players.filter(p => !p.paused).length), 1);
  }
  await page.locator('#stop').click();
  assert(await page.locator('audio').evaluateAll(players => players.every(p => p.paused && p.currentTime === 0)));
  await page.locator('[aria-label="Bright English clarity"]').selectOption('4');
  await page.locator('#preference').selectOption('bright');
  await page.locator('#notes').fill('Automated UI fixture only — not a real audition.');
  await page.locator('#save').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Saved on this laptop'));
  assert(saveBody.provisional === true && saveBody.liveDefaultAccepted === false);
  assert.equal(saveBody.ratings.bright.intelligibility, 4);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#preference').inputValue(), 'bright');
  assert.equal(await page.locator('#notes').inputValue(), 'Automated UI fixture only — not a real audition.');
  assert.equal(await page.evaluate(() => window.microphoneRequests), 0);
  assert.equal(externalRequests.length, 0);
  assert.equal(errors.length, 0);
  // Remove simulated notes before taking the review image.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await fs.mkdir(path.join(root, 'ops/reports/local/voice'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'ops/reports/local/voice/audition-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(root, 'ops/reports/local/voice/audition-mobile.png'), fullPage: true });
  const report = { date: new Date().toISOString(), passed: true, players: initial, automaticPlayback: false,
    comparedVoices: ['bright', 'soft', 'cool'], simultaneousPlaybackMaximum: 1, stopRewindsAll: true,
    referenceOnlySavePayload: true, persistedNotesInIsolatedBrowserContext: true,
    realUserRatingsWritten: false, mobileHorizontalOverflow: false, microphoneRequests: 0, externalRequests, errors,
    boundary: 'Synthetic browser playback/control verification; no user listening or live-conversation acceptance' };
  await fs.writeFile(path.join(root, 'ops/reports/voice-audition-ui-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
