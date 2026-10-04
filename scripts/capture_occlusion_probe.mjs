// Does native window occlusion explain the TASK-020 draw-cadence collapse?
//
// The production launcher opens Chrome with no flags, so the output window is
// subject to Chrome's Windows occlusion detection and renderer backgrounding.
// This probe covers the owned viewer with an opaque topmost window and measures
// the draw rate before, during and after, under two launch configurations.
//
// It owns its server, browser and occluder. It never touches OBS, the user's
// Chrome profile, recordings or the served catalog.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';
import { installPositiveCameraFixture } from './positive-camera-fixture.mjs';
import { installCaptureAnimationProbe } from './capture-animation-probe.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const label = process.argv.includes('--run-label') ? process.argv[process.argv.indexOf('--run-label') + 1] : '';
if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(label)) { console.error('Supply a fresh simple --run-label'); process.exit(2); }

const PHASE_MS = 12000;
// The same permitted NASA-credited still used by the soak and passive control.
const FIXTURE = { id: 'portrait', file: 'assets/testing/jsc2021e037768_alt.jpg',
  sha256: '7a7536821783691d1c7b58f5ee7cb601abbeaaa2f4703e755a15c5dbb4271b78', credit: 'NASA/Josh Valcarcel' };
const THROTTLE_DEFAULTS = ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'];
const CONDITIONS = [
  {
    name: 'production-default',
    intent: 'Reproduces Start VModel.cmd, which launches Chrome with no flags: occlusion detection and renderer backgrounding both active.',
    ignoreDefaultArgs: THROTTLE_DEFAULTS,
    extraArgs: [],
  },
  {
    name: 'hardened',
    intent: 'Proposed fix: keep the anti-throttling switches and also disable native window occlusion calculation.',
    ignoreDefaultArgs: [],
    extraArgs: ['--disable-features=CalculateNativeWinOcclusion'],
  },
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {
  date: new Date().toISOString(), runLabel: label, passed: false, status: 'running',
  question: 'Does Chrome native window occlusion explain the observed collapse toward 1 Hz draw delivery and blank captures?',
  phaseMs: PHASE_MS, obsInvolved: false, physicalMedia: false, liveAccepted: false,
  conditions: CONDITIONS.map(({ name, intent, ignoreDefaultArgs, extraArgs }) => ({ name, intent, ignoreDefaultArgs, extraArgs })),
  results: [],
  limits: [
    'A draw-cadence diagnostic only: no OBS, recording, microphone, physical camera or acceptance measurement.',
    'The occluder is a synthetic opaque topmost window; a real user covering the window with another application is not identical.',
    'Draw counts come from the owned viewer instrumentation, not from captured video frames.',
    'Blank-white OBS captures are a separate reported symptom; this probe measures rendering, not capture output.',
    'Conditions run sequentially and can see different ambient system load, which is recorded but not controlled.',
  ],
};

async function measure(page, ms) {
  await page.evaluate(() => window.__soak.begin());
  await sleep(ms);
  const drained = await page.evaluate(() => window.__soak.drain());
  const status = await page.evaluate(() => ({ visibility: window.__soak.status().visibility, gl: window.__captureDiag.status().gl }));
  const seconds = drained.atMs / 1000;
  return {
    draws: drained.renders.length,
    drawsPerSecond: Number((drained.renders.length / seconds).toFixed(2)),
    inferences: drained.inferences.length,
    intervalMsMax: drained.renders.length ? Math.max(...drained.renders.map(r => r.intervalMs)) : null,
    durationMs: Number(drained.atMs.toFixed(1)),
    visibility: status.visibility,
    contextLost: status.gl.contextLost,
    rendererFrame: status.gl.rendererFrame,
  };
}

let server, exit = 0;
try {
  const fixtureBytes = await readFile(path.join(ROOT, FIXTURE.file));
  const fixtureDigest = createHash('sha256').update(fixtureBytes).digest('hex');
  if (fixtureDigest !== FIXTURE.sha256) throw new Error('Changed permitted fixture still');
  report.fixture = { ...FIXTURE, verified: true };
  server = await startIsolatedStudioServer();
  report.server = { base: server.base, port: server.port, pid: server.pid, owned: true };

  for (const condition of CONDITIONS) {
    let browser, occluder;
    try {
      browser = await chromium.launch({
        channel: 'chrome', headless: false,
        args: ['--window-size=1280,820', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...condition.extraArgs],
        ...(condition.ignoreDefaultArgs.length ? { ignoreDefaultArgs: condition.ignoreDefaultArgs } : {}),
      });
      const context = await browser.newContext({ viewport: null });
      await context.route('**/testing/soak-*.jpg', route =>
        route.fulfill({ status: 200, contentType: 'image/jpeg', body: fixtureBytes }));
      await context.addInitScript(installPositiveCameraFixture);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(server.base);
      await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
      await page.evaluate(async () => { await window.__soak.prepare([{ id: 'seated', url: '/testing/soak-portrait.jpg' }]); });
      await page.evaluate(() => { window.__soak.select('seated', { hands: false }); window.__soak.instrument(window.__vmodel.viewer); });
      await page.evaluate(installCaptureAnimationProbe);
      await page.locator('#captureResolution').selectOption('640x480');
      await page.locator('#quality').selectOption('balanced');
      await page.locator('#springMotion').selectOption('gentle');
      await page.locator('#orientation').selectOption('landscape');
      await page.locator('#preview').uncheck();
      await page.locator('#clean').click();
      await page.evaluate(value => { document.title = value; }, 'Ene Occlusion ' + condition.name);
      await sleep(4000); // warm-up before any measured phase

      const before = await measure(page, PHASE_MS);
      occluder = spawn('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'scripts', 'occluder_window.ps1'), '-Seconds', '60'],
        { stdio: 'ignore', windowsHide: false, detached: false });
      await sleep(3000); // Chrome recalculates occlusion on a delay
      const during = await measure(page, PHASE_MS);
      occluder.kill();
      occluder = null;
      await sleep(3000);
      const after = await measure(page, PHASE_MS);
      const events = await page.evaluate(() => window.__captureDiag.status().events);

      report.results.push({
        condition: condition.name, intent: condition.intent,
        chromeVersion: browser.version(),
        launchArgs: condition.extraArgs, ignoredDefaultArgs: condition.ignoreDefaultArgs,
        before, during, after,
        duringToBeforeRatio: before.drawsPerSecond ? Number((during.drawsPerSecond / before.drawsPerSecond).toFixed(3)) : null,
        recovered: before.drawsPerSecond ? after.drawsPerSecond > before.drawsPerSecond * 0.8 : null,
        throttledWhileOccluded: during.drawsPerSecond < 5,
        visibilityEvents: events.filter(e => ['visibilitychange', 'freeze', 'resume'].includes(e.kind)),
        contextEvents: events.filter(e => e.kind.startsWith('webglcontext')),
        pageErrors: errors,
      });
      console.log(JSON.stringify({ condition: condition.name, before: before.drawsPerSecond, during: during.drawsPerSecond, after: after.drawsPerSecond }));
    } finally {
      if (occluder) occluder.kill();
      if (browser) await browser.close().catch(() => {});
    }
  }

  const production = report.results.find(r => r.condition === 'production-default');
  const hardened = report.results.find(r => r.condition === 'hardened');
  report.comparison = production && hardened ? {
    productionThrottledWhileOccluded: production.throttledWhileOccluded,
    hardenedThrottledWhileOccluded: hardened.throttledWhileOccluded,
    productionDuringDrawsPerSecond: production.during.drawsPerSecond,
    hardenedDuringDrawsPerSecond: hardened.during.drawsPerSecond,
    occlusionExplainsCollapse: production.throttledWhileOccluded && !hardened.throttledWhileOccluded,
  } : null;
  report.passed = report.results.length === CONDITIONS.length;
  report.status = report.passed ? 'complete' : 'failed';
} catch (error) {
  report.status = 'failed';
  report.error = String(error?.stack ?? error);
  exit = 1;
} finally {
  if (server) await server.close?.().catch?.(() => {});
  const file = path.join(ROOT, 'ops/001-zhil/sprint-001/reports', 'capture-occlusion-' + label + '.json');
  await mkdir(path.dirname(file), { recursive: true });
  const body = JSON.stringify(report, null, 2);
  await writeFile(file, body, { flag: 'wx' }).catch(async error => {
    if (error.code !== 'EEXIST') throw error;
    console.error('Previous evidence exists for this label; nothing was overwritten.');
    exit = 2;
  });
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status, passed: report.passed,
    comparison: report.comparison ?? null, sha256: createHash('sha256').update(body).digest('hex').slice(0, 16) }, null, 2));
}
process.exit(exit);
