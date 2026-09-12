/** Browser behavior checks. --draft uses clearly labelled private review media; no final-media acceptance. */
import { chromium, firefox, webkit } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root = process.cwd(), draft = process.argv.includes('--draft');
const engine = process.argv.includes('--browser') ? process.argv[process.argv.indexOf('--browser') + 1] : 'chrome';
assert.ok(['chrome', 'edge', 'firefox', 'webkit'].includes(engine));
const suffix = `${draft ? 'draft-' : ''}${engine === 'chrome' ? '' : `${engine}-`}`;
const base = process.env.ENE_WEB_TEST_URL ?? 'http://127.0.0.1:5180';
const report = { draft, engine, base, startedAt: new Date().toISOString(), cases: [], externalRequests: [], pageErrors: [], testsPhysicalDevices: false, finalFamilies: [] };
const local = path.join(root, 'ops/reports/local/web-showcase'); await fs.mkdir(local, { recursive: true });
const ids = ['home-greeting', 'desk-normal', 'desk-confused', 'desk-surprised', 'desk-excited'];
const bodies = new Map();
let draftManifest;
if (draft) {
  const performances = JSON.parse(await fs.readFile(path.join(root, 'config/web-resources/performances.json'), 'utf8'));
  const asset = async (id, size, type) => {
    const poster = type.startsWith('poster');
    const extension = poster ? 'png' : type;
    const file = path.join(root, `ops/reports/local/web-resources/${id}/${poster ? 'poster.png' : `${id}-preview.${type}`}`);
    const data = await fs.readFile(file);
    const url = `${id}/${size}${poster ? '-poster' : ''}.${type === 'poster-webp' ? 'webp' : extension}`;
    const mime = poster ? 'image/png' : type === 'webm' ? 'video/webm' : 'image/webp';
    bodies.set(`/ene/${url}`, { body: data, contentType: mime });
    return { url, mime, codec: poster ? 'png' : type, width: performances[id][size][0], height: performances[id][size][1], bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
  };
  const resources = {};
  for (const id of ids) {
    const spec = performances[id];
    const resource = { label: id, durationSeconds: spec.seconds, fps: 12, frameCount: spec.seconds * 12, loop: true, renderSize: { width: spec.large[0], height: spec.large[1] }, bounds: { x: .05, y: .05, width: .9, height: .9 }, safeRegion: { x: .05, y: .05, width: .9, height: .9 }, anchor: { kind: id === 'home-greeting' ? 'foot' : 'desk', x: .5, y: id === 'home-greeting' ? .93 : .9222218617796898 }, renditions: {}, posters: {} };
    for (const size of ['small', 'large']) {
      resource.renditions[size] = { width: spec[size][0], height: spec[size][1], webm: await asset(id, size, 'webm'), webp: await asset(id, size, 'webp') };
      resource.posters[size] = { webp: await asset(id, size, 'poster-webp'), png: await asset(id, size, 'poster-png') };
    }
    resources[id] = resource;
  }
  let probe;
  try {
    const data = await fs.readFile(path.join(root, 'web-showcase/public/ene/alpha-probe.webm'));
    bodies.set('/ene/alpha-probe.webm', { body: data, contentType: 'video/webm' });
    probe = { url: 'alpha-probe.webm', mime: 'video/webm', codec: 'vp9', width: 32, height: 32, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), transparentPixel: [0, 0], opaquePixel: [24, 24] };
  } catch {
    probe = { url: 'alpha-probe.webm', mime: 'video/webm', codec: 'vp9', width: 32, height: 32, bytes: 1, sha256: '', transparentPixel: [0, 0], opaquePixel: [24, 24] };
  }
  draftManifest = { schemaVersion: 1, character: { id: 'ene', variant: 'cyber-legs', sourceRevision: 'PRIVATE-12FPS-REVIEW-FIXTURE' }, credits: [], probes: { webmAlpha: probe }, resources };
  // Exercise real finished families as production progresses; other states retain
  // explicitly labelled review fixtures. Only a non-draft run can accept all media.
  const partial = await fs.readFile(path.join(root, 'web-showcase/public/ene/partial-manifest.json'), 'utf8').then(JSON.parse).catch(() => null);
  for (const [id, resource] of Object.entries(partial?.resources ?? {})) {
    if (!ids.includes(id)) continue;
    for (const size of ['small', 'large']) for (const asset of [resource.renditions[size].webm, resource.renditions[size].webp, resource.posters[size].webp, resource.posters[size].png]) {
      bodies.set(`/ene/${asset.url}`, { body: await fs.readFile(path.join(root, 'web-showcase/public/ene', asset.url)), contentType: asset.mime });
    }
    draftManifest.resources[id] = resource; report.finalFamilies.push(id);
  }
}
const browser = await ({ chrome: chromium, edge: chromium, firefox, webkit }[engine]).launch({ headless: true,
  ...(engine === 'chrome' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : engine === 'edge' ? { channel: 'msedge' } : {}) });
report.browser = await browser.version();
const contexts = [];
async function pageFor(name, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, ...options }); contexts.push(context);
  const page = await context.newPage(), requests = [];
  page.on('pageerror', error => report.pageErrors.push({ name, message: error.message }));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(base).origin) { report.externalRequests.push(url.origin + url.pathname); return route.abort(); }
    requests.push(url.pathname);
    if (draft && url.pathname === '/ene/manifest.json') return route.fulfill({ json: draftManifest });
    if (draft && url.pathname.startsWith('/ene/')) return bodies.has(url.pathname) ? route.fulfill({ status: 200, ...bodies.get(url.pathname) }) : route.fulfill({ status: 404, body: 'Fixture file unavailable' });
    return route.continue();
  });
  return { page, context, requests };
}
async function playing(page) {
  await page.locator('#ene-character[data-playing="true"]').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => { const media = document.querySelector('.ene-animation.is-ready'); return media && getComputedStyle(media).opacity === '1'; });
}
async function noOverflow(page) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'horizontal overflow'); }
function animationRequests(requests) { return requests.filter(url => /\/ene\/[^/]+\/(small|large)\.(webm|webp)$/.test(url)); }
try {
  const main = await pageFor('desktop');
  await main.page.goto(base); await playing(main.page); await noOverflow(main.page);
  assert.equal(await main.page.locator('.ene-animation').count(), 1);
  assert.deepEqual([...new Set(animationRequests(main.requests).map(url => url.split('/')[2]))], ['home-greeting']);
  await main.page.screenshot({ path: path.join(local, `${suffix}welcome-desktop.png`), fullPage: true });
  report.cases.push({ name: 'initial-selected-only', pass: true, format: await main.page.locator('#ene-character').getAttribute('data-format'), requests: [...new Set(main.requests.filter(url => url.startsWith('/ene/')))] });
  await main.page.getByRole('button', { name: 'Oh!', exact: false }).click(); await playing(main.page);
  await noOverflow(main.page);
  assert.equal(await main.page.locator('button[data-resource="desk-surprised"]').getAttribute('aria-pressed'), 'true');
  await main.page.screenshot({ path: path.join(local, `${suffix}desk-desktop.png`), fullPage: true });
  await main.page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  assert.equal(await main.page.locator('#ene-character').getAttribute('data-playing'), 'false');
  const before = animationRequests(main.requests).length;
  await main.page.locator('button[data-resource="desk-confused"]').click(); await main.page.waitForTimeout(250);
  assert.equal(animationRequests(main.requests).length, before, 'paused switch fetched an animation');
  assert.equal(await main.page.locator('.ene-animation').count(), 0);
  await main.page.getByRole('button', { name: 'Play animation', exact: true }).click(); await playing(main.page);
  // Actual IntersectionObserver stop, then explicit pause remains after returning.
  await main.page.evaluate(() => { const tail = document.createElement('div'); tail.id = 'test-tail'; tail.style.height = '2500px'; document.body.append(tail); scrollTo(0, document.body.scrollHeight); });
  await main.page.waitForFunction(() => document.querySelector('#ene-character')?.getAttribute('data-playing') === 'false');
  await main.page.evaluate(() => { document.querySelector('#test-tail')?.remove(); scrollTo(0, 0); }); await playing(main.page);
  await main.page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  await main.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await main.page.locator('#ene-character').getAttribute('data-playing'), 'false');
  await main.page.getByRole('button', { name: 'Replay animation', exact: true }).click(); await playing(main.page);
  await main.page.locator('button[data-resource="desk-excited"]').focus(); await main.page.keyboard.press('Enter'); await playing(main.page);
  assert.equal(await main.page.locator('button[data-resource="desk-excited"]').getAttribute('aria-pressed'), 'true');
  report.cases.push({ name: 'controls-pause-switch-offscreen-replay', pass: true, visibilityEvent: 'synthetic', offscreen: 'real scroll + IntersectionObserver' });
  await main.context.close();

  const reduced = await pageFor('reduced-mobile', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await reduced.page.goto(base); await reduced.page.locator('.ene-poster').waitFor(); await reduced.page.waitForFunction(() => document.querySelector('.ene-poster')?.naturalWidth > 0);
  assert.equal(animationRequests(reduced.requests).length, 0); assert.equal(reduced.requests.some(url => url.endsWith('alpha-probe.webm')), false);
  await noOverflow(reduced.page);
  await reduced.page.screenshot({ path: path.join(local, `${suffix}welcome-mobile.png`), fullPage: true });
  await reduced.page.locator('button[data-resource="desk-normal"]').click(); await noOverflow(reduced.page);
  await reduced.page.screenshot({ path: path.join(local, `${suffix}desk-mobile.png`), fullPage: true });
  await reduced.page.getByRole('button', { name: 'Play animation', exact: true }).click(); await reduced.page.locator('#ene-character').scrollIntoViewIfNeeded(); await playing(reduced.page);
  report.cases.push({ name: 'reduced-motion-mobile-explicit-play', pass: true, viewport: '390x844' }); await reduced.context.close();

  const fallback = await pageFor('failed-alpha');
  await fallback.page.route('**/ene/alpha-probe.webm', route => route.fulfill({ status: 404, body: 'deliberately missing probe' }));
  await fallback.page.goto(base); await playing(fallback.page);
  assert.equal(await fallback.page.locator('#ene-character').getAttribute('data-format'), 'webp');
  await fallback.page.getByRole('button', { name: 'Pause animation', exact: true }).click(); assert.equal(await fallback.page.locator('.ene-animation').count(), 0);
  await fallback.page.getByRole('button', { name: 'Play animation', exact: true }).click(); await playing(fallback.page);
  report.cases.push({ name: 'failed-alpha-animated-webp-and-poster-pause', pass: true }); await fallback.context.close();

  const saving = await pageFor('data-saving');
  await saving.page.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: Object.assign(new EventTarget(), { saveData: true }) }));
  await saving.page.goto(base); await saving.page.waitForFunction(() => document.querySelector('.ene-poster')?.naturalWidth > 0);
  assert.equal(animationRequests(saving.requests).length, 0);
  report.cases.push({ name: 'data-saving-poster-default', pass: true, preference: 'simulated navigator.connection.saveData' }); await saving.context.close();

  const missing = await pageFor('missing-files');
  await missing.page.route(/\/ene\/home-greeting\/(small|large)\.(webm|webp)$/, route => route.fulfill({ status: 404, body: 'deliberately missing animation' }));
  await missing.page.goto(base); await missing.page.getByRole('status').filter({ hasText: 'Animation unavailable' }).waitFor({ timeout: 20000 });
  assert.equal(await missing.page.locator('.ene-animation').count(), 0);
  assert.equal(await missing.page.locator('.ene-poster').evaluate(image => image.naturalWidth > 0), true);
  report.cases.push({ name: 'missing-animation-usable-poster', pass: true }); await missing.context.close();

  const missingManifest = await pageFor('missing-manifest');
  await missingManifest.page.route('**/ene/manifest.json', route => route.fulfill({ status: 404, body: 'no manifest' }));
  await missingManifest.page.goto(base); await missingManifest.page.getByRole('button', { name: 'Reload character' }).waitFor();
  report.cases.push({ name: 'missing-manifest-explained-reload', pass: true }); await missingManifest.context.close();

  const poster = await pageFor('poster-png-fallback', { reducedMotion: 'reduce' });
  await poster.page.route(/\/ene\/home-greeting\/(small|large)-poster\.webp$/, route => route.fulfill({ status: 404, body: 'missing webp poster' }));
  await poster.page.goto(base); await poster.page.waitForFunction(() => { const image = document.querySelector('.ene-poster'); return image?.naturalWidth > 0 && image.currentSrc.endsWith('.png'); });
  report.cases.push({ name: 'png-poster-fallback', pass: true }); await poster.context.close();

  const transition = await pageFor('delayed-and-missing-state');
  await transition.page.goto(base); await playing(transition.page);
  await transition.page.route(/\/ene\/desk-normal\//, async route => { await new Promise(resolve => setTimeout(resolve, 650)); await route.fallback(); });
  await transition.page.locator('button[data-resource="desk-normal"]').click(); await transition.page.waitForTimeout(300);
  assert.equal(await transition.page.locator('.ene-snapshot').count(), 1);
  assert.equal(await transition.page.locator('.ene-snapshot').evaluate(node => getComputedStyle(node).opacity), '1');
  await playing(transition.page); await transition.page.locator('.ene-snapshot').waitFor({ state: 'detached' });
  await transition.page.route(/\/ene\/desk-confused\//, route => route.fulfill({ status: 404, body: 'all selected-state files missing' }));
  await transition.page.locator('button[data-resource="desk-confused"]').click();
  await transition.page.getByRole('status').filter({ hasText: 'Showing the previous still' }).waitFor({ timeout: 20000 });
  assert.equal(await transition.page.locator('.ene-snapshot').count(), 1); assert.equal(await transition.page.locator('.ene-animation').count(), 0);
  report.cases.push({ name: 'retain-still-through-delayed-or-missing-state', pass: true }); await transition.context.close();

  if (report.cases[0].format === 'webm') {
    const autoplay = await pageFor('autoplay-rejection');
    await autoplay.page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play; let rejected = false;
      HTMLMediaElement.prototype.play = function() {
        if (this.classList.contains('ene-animation') && !rejected) { rejected = true; return Promise.reject(new DOMException('Simulated autoplay policy', 'NotAllowedError')); }
        return play.call(this);
      };
    });
    await autoplay.page.goto(base); await autoplay.page.getByRole('status').filter({ hasText: 'Select Play' }).waitFor();
    await autoplay.page.getByRole('button', { name: 'Play animation', exact: true }).click(); await playing(autoplay.page);
    report.cases.push({ name: 'rejected-autoplay-explicit-retry', pass: true, policy: 'simulated NotAllowedError on actual animation video' }); await autoplay.context.close();

    const cancelled = await pageFor('cancelled-pending-play');
    await cancelled.page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play, pause = HTMLMediaElement.prototype.pause;
      let intercept = true, rejectPending;
      HTMLMediaElement.prototype.play = function() {
        const promise = play.call(this);
        if (!this.classList.contains('ene-animation') || !intercept) return promise;
        intercept = false; window.__pendingTestPlay = true;
        promise.catch(() => {});
        return new Promise((resolve, reject) => { rejectPending = reject; setTimeout(resolve, 2000); });
      };
      HTMLMediaElement.prototype.pause = function() {
        pause.call(this);
        if (this.classList.contains('ene-animation') && rejectPending) {
          const reject = rejectPending; rejectPending = undefined; window.__pendingTestPlay = false;
          reject(new DOMException('Simulated interrupted native play', 'AbortError'));
        }
      };
    });
    await cancelled.page.goto(base); await cancelled.page.waitForFunction(() => window.__pendingTestPlay === true);
    await cancelled.page.evaluate(() => { const tail = document.createElement('div'); tail.id = 'play-race-tail'; tail.style.height = '2500px'; document.body.append(tail); scrollTo(0, document.body.scrollHeight); });
    await cancelled.page.waitForFunction(() => window.__pendingTestPlay === false);
    await cancelled.page.evaluate(() => { document.querySelector('#play-race-tail').remove(); scrollTo(0, 0); }); await playing(cancelled.page);
    report.cases.push({ name: 'cancelled-pending-play-resumes-onscreen', pass: true, promiseTiming: 'controlled AbortError; actual video and IntersectionObserver' }); await cancelled.context.close();
  }

  assert.deepEqual(report.externalRequests, []); assert.deepEqual(report.pageErrors, []);
  report.pass = true;
} catch (error) { report.pass = false; report.error = String(error); throw error; }
finally {
  await browser.close(); report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(root, `ops/reports/web-showcase-${suffix}smoke.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
