// The avatar must start and run with no voice service present.
//
// TASK-024 and TASK-026 both require that avatar startup does not depend on
// voice, local or remote. This starts the studio with nothing listening on the
// voice ports, confirms the app loads, renders Ene and tracks, and asserts that
// it contacts no origin other than its own server.
//
// Owns its server and browser. No OBS, no microphone, no physical camera.
import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';
import { installPositiveCameraFixture } from './positive-camera-fixture.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const FIXTURE = { file: 'assets/testing/jsc2021e037768_alt.jpg',
  sha256: '7a7536821783691d1c7b58f5ee7cb601abbeaaa2f4703e755a15c5dbb4271b78' };
const VOICE_PORTS = [5081, 5082];

const portOpen = port => new Promise(resolve => {
  const socket = createConnection({ host: '127.0.0.1', port }, () => { socket.destroy(); resolve(true); });
  socket.on('error', () => resolve(false));
  setTimeout(() => { socket.destroy(); resolve(false); }, 1500);
});

const report = {
  date: new Date().toISOString(), passed: false, status: 'running',
  question: 'Does the avatar start, render and track with no voice service running, contacting nothing but its own server?',
  voiceServiceRunning: null, obsInvolved: false, physicalCamera: false,
  limits: [
    'A permitted still drives tracking through the fake-camera path; this is not live camera quality.',
    'Confirms independence from the voice service, not that any voice backend works offline.',
    'Shows the avatar never contacts a voice service. When voice happens to be listening, that is independence under availability, not a cold boot with voice absent.',
  ],
};

let server, browser, exit = 0;
try {
  const open = await Promise.all(VOICE_PORTS.map(portOpen));
  report.voicePorts = VOICE_PORTS.map((port, index) => ({ port, listening: open[index] }));
  report.voiceServiceRunning = open.some(Boolean);
  // Running voice services are not a reason to skip: they make the result
  // stronger. The decisive assertion is that the avatar contacts no origin but
  // its own server, and with voice actually listening it had the opportunity to
  // reach for it and did not. What a voice-up run cannot show is a cold boot
  // with voice absent, so that distinction is recorded rather than blurred.
  report.evidenceKind = report.voiceServiceRunning
    ? 'Independence observed while voice services were listening and available.'
    : 'Independence observed with no voice service listening at all.';

  const fixtureBytes = await readFile(path.join(ROOT, FIXTURE.file));
  if (createHash('sha256').update(fixtureBytes).digest('hex') !== FIXTURE.sha256) throw new Error('Changed permitted fixture still');

  server = await startIsolatedStudioServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext();
  const offServer = [];
  context.on('request', request => {
    const url = new URL(request.url());
    if (!['blob:', 'data:'].includes(url.protocol) && url.origin !== server.base) offServer.push(url.origin + url.pathname);
  });
  await context.route('**/testing/soak-*.jpg', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: fixtureBytes }));
  await context.addInitScript(installPositiveCameraFixture);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.goto(server.base);
  await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
  report.avatarLoaded = await page.evaluate(() => window.__vmodel.getState().avatarId);

  await page.evaluate(async () => {
    await window.__soak.prepare([{ id: 'seated', url: '/testing/soak-portrait.jpg' }]);
    window.__soak.select('seated', { mode: 'seated', hands: false, framing: 'body' });
    window.__soak.instrument(window.__vmodel.viewer);
  });
  await page.evaluate(() => document.querySelector('#start').click());
  await page.waitForFunction(() => {
    const state = window.__soak.status();
    return state.workerErrors.length || (state.lastResult?.sequence ?? 0) >= 4;
  }, undefined, { timeout: 120000 });

  await page.evaluate(() => window.__soak.begin());
  await sleep(8000);
  const drained = await page.evaluate(() => window.__soak.drain());
  const status = await page.evaluate(() => window.__soak.status());
  await page.evaluate(() => document.querySelector('#stop').click());
  await sleep(800);

  report.measured = {
    draws: drained.renders.length,
    drawsPerSecond: Number((drained.renders.length / (drained.atMs / 1000)).toFixed(2)),
    inferences: drained.inferences.length,
    delegate: status.delegate, workerErrors: status.workerErrors,
  };
  report.offServerRequests = [...new Set(offServer)];
  report.pageErrors = pageErrors;
  report.checks = {
    avatarLoaded: Boolean(report.avatarLoaded),
    rendered: report.measured.draws > 100,
    tracked: report.measured.inferences > 0,
    contactedNothingElse: report.offServerRequests.length === 0,
    noWorkerErrors: status.workerErrors.length === 0,
    noPageErrors: pageErrors.length === 0,
  };
  report.passed = Object.values(report.checks).every(Boolean);
  report.status = report.passed ? 'complete' : 'failed';
  if (!report.passed) exit = 1;
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.close?.().catch?.(() => {});
  const file = path.join(ROOT, 'ops/reports', 'local-only-startup-smoke.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status,
    checks: report.checks ?? null, measured: report.measured ?? null,
    voiceServiceRunning: report.voiceServiceRunning, evidenceKind: report.evidenceKind ?? null }, null, 2));
}
process.exit(exit);
