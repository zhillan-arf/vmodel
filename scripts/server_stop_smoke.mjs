// Actual production app + Chrome fake camera. Kill only this script's child server.
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

if (!process.argv.includes('--quiet-window')) throw new Error('Coordinate an idle CPU/browser window, then use --quiet-window.');
const report = { date: new Date().toISOString(), input: 'Actual built studio and tracker with Chromium fake video device. No physical camera, microphone, OBS or shared server is accessed.', errors: [], messages: [], externalResponses: [] };
let browser, server, page;
try {
  server = await startIsolatedStudioServer(); report.server = { base: server.base, port: server.port, pid: server.pid, isolated: true };
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  report.chromeVersion = browser.version();
  const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1100, height: 800 } });
  const external = url => !url.startsWith(server.base + '/') && !url.startsWith('blob:') && !url.startsWith('data:');
  context.on('response', response => { if (external(response.url())) report.externalResponses.push(response.url()); });
  await context.route('**/*', route => external(route.request().url()) ? route.abort('blockedbyclient') : route.continue());
  await context.addInitScript(() => {
    window.__mediaRequests = []; window.__ownedTracks = []; window.__healthChecks = [];
    const originalMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      if (constraints.audio !== false) throw new Error('Only fake video without audio is allowed.');
      window.__mediaRequests.push(constraints);
      const stream = await originalMedia(constraints);
      for (const track of stream.getTracks()) {
        const item = { track, stopCalls: 0, stoppedAt: null }, stop = track.stop.bind(track);
        track.stop = () => { item.stopCalls++; item.stoppedAt = Date.now(); stop(); };
        window.__ownedTracks.push(item);
      }
      return stream;
    };
    navigator.mediaDevices.getDisplayMedia = async () => { throw new Error('Display capture is disabled.'); };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const address = args[0] instanceof Request ? args[0].url : String(args[0]);
      if (new URL(address, location.href).pathname !== '/health') return originalFetch(...args);
      const check = { startedAt: Date.now() }; window.__healthChecks.push(check);
      try { const response = await originalFetch(...args); check.status = response.status; check.finishedAt = Date.now(); return response; }
      catch (error) { check.failed = true; check.finishedAt = Date.now(); throw error; }
    };
  });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (['warning', 'error'].includes(message.type()) && report.messages.length < 100) report.messages.push(message.text()); });
  const response = await page.goto(server.base + '/');
  report.policy = response.headers()['content-security-policy']; assert(report.policy.includes("connect-src 'self'"));
  await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
  report.noAutomaticCamera = await page.evaluate(() => window.__mediaRequests.length === 0); assert(report.noAutomaticCamera);
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__vmodel?.getStats().sequence >= 2 || /could not start|unavailable|too long|stopped responding|Tracker stopped/.test(document.querySelector('#status').textContent), undefined, { timeout: 65000 });
  const state = () => ({ status: document.querySelector('#status').textContent, videoDetached: document.querySelector('#camera-video').srcObject === null,
    stats: window.__vmodel.getStats(), mediaRequests: window.__mediaRequests, healthChecks: window.__healthChecks,
    tracks: window.__ownedTracks.map(item => ({ kind: item.track.kind, label: item.track.label, readyState: item.track.readyState, stopCalls: item.stopCalls, stoppedAt: item.stoppedAt })) });
  report.before = await page.evaluate(state);
  assert(report.before.stats.sequence >= 2, report.before.status);
  assert.equal(report.before.videoDetached, false); assert.equal(report.before.tracks.length, 1);
  assert(report.before.tracks.every(track => track.kind === 'video' && /fake/i.test(track.label) && track.readyState === 'live' && track.stopCalls === 0));
  assert(report.before.mediaRequests.every(constraints => constraints.audio === false));
  // The production watcher must have performed a real successful probe first.
  await page.waitForFunction(() => window.__healthChecks.some(check => check.status === 200), undefined, { timeout: 5000 });
  report.stopRequestedAt = Date.now(); report.serverExit = await server.stop(); report.serverStoppedAt = Date.now();
  await page.waitForFunction(() => document.querySelector('#camera-video').srcObject === null && window.__ownedTracks.length > 0 && window.__ownedTracks.every(item => item.track.readyState === 'ended') && /Local studio server disconnected/.test(document.querySelector('#status').textContent), undefined, { timeout: 10000 });
  report.after = await page.evaluate(state); report.observedReleasedAt = Date.now();
  report.releaseDelayMs = report.observedReleasedAt - report.stopRequestedAt;
  const failed = report.after.healthChecks.filter(check => check.startedAt >= report.stopRequestedAt && check.failed);
  assert(failed.length >= 2); assert(report.after.tracks.every(track => track.stopCalls === 1 && track.readyState === 'ended'));
  assert.equal(report.after.stats.sequence, 0); assert.equal(report.after.mediaRequests.length, 1);
  await page.waitForTimeout(200); report.workersAfterStop = page.workers().length; assert.equal(report.workersAfterStop, 0);
  assert.equal(report.externalResponses.length, 0); assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, releaseDelayMs: report.releaseDelayMs, failedHealthChecks: failed.length, tracks: report.after.tracks, workersAfterStop: report.workersAfterStop, status: report.after.status }));
} catch (error) {
  report.passed = false; report.errors.push(String(error)); console.error(error); process.exitCode = 1;
  if (page && !page.isClosed()) report.finalStatus = await page.locator('#status').textContent().catch(() => null);
} finally {
  try { await browser?.close(); report.browserClosed = !!browser; } catch (error) { report.errors.push(`Browser cleanup: ${error}`); process.exitCode = 1; }
  try { if (server) { await server.stop(); report.serverStopped = true; } } catch (error) { report.errors.push(`Server cleanup: ${error}`); process.exitCode = 1; }
  await mkdir('ops/001-zhil/sprint-001/reports', { recursive: true }); await writeFile('ops/001-zhil/sprint-001/reports/server-stop-smoke.json', JSON.stringify(report, null, 2) + '\n');
}
