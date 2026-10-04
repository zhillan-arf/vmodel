// Does hybrid-core placement affect avatar draw cadence, as it did LLVC inference?
//
// The measured host splits logical CPUs 0-3 (performance, 100% of maximum
// frequency) from 4-11 (efficiency, 50-70%). Voice inference measured 2.32x
// slower per call on efficiency cores. The renderer and tracking workers run
// unpinned under the same scheduler, so this probe measures the real viewer,
// real Ene avatar and real tracking workers under three affinity conditions
// applied to the owned Chrome process tree within one session.
//
// It owns its server and browser, restores the original affinity of every
// process it changed, and never touches OBS, recordings or the served catalog.
import { chromium } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import process from 'node:process';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';
import { installPositiveCameraFixture } from './positive-camera-fixture.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const label = process.argv.includes('--run-label') ? process.argv[process.argv.indexOf('--run-label') + 1] : '';
if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(label)) { console.error('Supply a fresh simple --run-label'); process.exit(2); }

const FIXTURE = { id: 'portrait', file: 'assets/testing/jsc2021e037768_alt.jpg',
  sha256: '7a7536821783691d1c7b58f5ee7cb601abbeaaa2f4703e755a15c5dbb4271b78', credit: 'NASA/Josh Valcarcel' };
const PHASE_MS = 20000;
const PHASES = [
  { name: 'default-fff', mask: 0xFFF, intent: 'Unchanged scheduler behaviour, the current production setting.' },
  { name: 'e-cores-ff0', mask: 0xFF0, intent: 'Confined to the measured 50-70% efficiency cores.' },
  { name: 'p-cores-00f', mask: 0x00F, intent: 'Confined to the measured 100% performance cores.' },
  { name: 'restored-fff', mask: 0xFFF, intent: 'Returned to the original mask to show the effect is reversible.' },
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const report = {
  date: new Date().toISOString(), runLabel: label, passed: false, status: 'running',
  question: 'Does confining the browser process tree to efficiency cores reproduce a draw-cadence collapse?',
  phaseMs: PHASE_MS, phases: PHASES.map(({ name, mask, intent }) => ({ name, mask: mask.toString(16).toUpperCase(), intent })),
  obsInvolved: false, physicalMedia: false, liveAccepted: false, results: [], affinityChanges: [],
  limits: [
    'A cadence diagnostic only: no OBS, recording, microphone, physical camera or acceptance measurement.',
    'Affinity is applied to the owned Chrome process tree; per-thread placement inside those processes is not controlled.',
    'Forcing every browser process onto efficiency cores is more severe than an occasional scheduler migration.',
    'A permitted still image drives tracking, so this is not live camera quality or physical latency.',
    'Phases run sequentially within one session and can see different ambient load, which is recorded but not controlled.',
    'Blank-white OBS captures are a separate unexplained symptom and are not measured here.',
  ],
};

async function setAffinity(pids, mask) {
  const changed = [];
  for (const pid of pids) {
    const command = `$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if($p){$before=$p.ProcessorAffinity.ToInt64();` +
      `try{$p.ProcessorAffinity=[IntPtr]${mask};$after=$p.ProcessorAffinity.ToInt64()}catch{$after=$null};` +
      `[pscustomobject]@{pid=${pid};before=$before;after=$after}|ConvertTo-Json -Compress}`;
    try {
      const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 10000 });
      if (stdout.trim()) changed.push(JSON.parse(stdout.trim()));
    } catch (error) { changed.push({ pid, error: String(error.message ?? error) }); }
  }
  return changed;
}

let server, browser, exit = 0, ownedPids = [];
try {
  const fixtureBytes = await readFile(path.join(ROOT, FIXTURE.file));
  if (createHash('sha256').update(fixtureBytes).digest('hex') !== FIXTURE.sha256) throw new Error('Changed permitted fixture still');
  report.fixture = { ...FIXTURE, verified: true };

  server = await startIsolatedStudioServer();
  report.server = { base: server.base, port: server.port, pid: server.pid, owned: true };
  browser = await chromium.launch({ channel: 'chrome', headless: false,
    args: ['--window-size=1400,900', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  report.chromeVersion = browser.version();
  const context = await browser.newContext({ viewport: null });
  await context.route('**/testing/soak-*.jpg', route => route.fulfill({ status: 200, contentType: 'image/jpeg', body: fixtureBytes }));
  await context.addInitScript(installPositiveCameraFixture);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(server.base);
  await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
  await page.evaluate(async () => { await window.__soak.prepare([{ id: 'seated', url: '/testing/soak-portrait.jpg' }]); window.__soak.instrument(window.__vmodel.viewer); });
  await page.locator('#captureResolution').selectOption('640x480');
  await page.locator('#quality').selectOption('balanced');
  await page.locator('#springMotion').selectOption('gentle');
  await page.locator('#orientation').selectOption('landscape');
  await page.locator('#preview').uncheck();
  await page.locator('#clean').click();
  await page.evaluate(() => { document.title = 'Ene Core Placement'; });
  await page.evaluate(() => {
    for (const [key, value] of [['mode', 'seated'], ['framing', 'body']]) { const input = document.getElementById(key); input.value = value; input.dispatchEvent(new Event('change')); }
    const hands = document.getElementById('hands'); hands.checked = false; hands.dispatchEvent(new Event('change'));
    window.__soak.select('seated', { mode: 'seated', hands: false, framing: 'body' });
  });
  await page.evaluate(() => document.querySelector('#start').click());
  await page.waitForFunction(() => { const state = window.__soak.status(); return state.workerErrors.length || (state.lastResult?.sequence ?? 0) >= 4 && state.lastResult.present.face && state.lastResult.present.pose; }, undefined, { timeout: 120000 });
  const prepared = await page.evaluate(() => window.__soak.status());
  report.trackingPrepared = { delegate: prepared.delegate, workerErrors: prepared.workerErrors, present: prepared.lastResult?.present };
  if (prepared.workerErrors.length) throw new Error('Tracking worker errors before measurement: ' + prepared.workerErrors.join('; '));

  const browserCDP = await browser.newBrowserCDPSession();
  const info = (await browserCDP.send('SystemInfo.getProcessInfo')).processInfo;
  ownedPids = info.map(value => value.id);
  report.ownedProcesses = info.map(value => ({ id: value.id, type: value.type }));

  await sleep(5000); // settle after startup before the first measured phase
  for (const phase of PHASES) {
    const changes = await setAffinity(ownedPids, phase.mask);
    report.affinityChanges.push({ phase: phase.name, requestedMask: phase.mask.toString(16).toUpperCase(), changes });
    await sleep(3000);
    await page.evaluate(() => window.__soak.begin());
    await sleep(PHASE_MS);
    const drained = await page.evaluate(() => window.__soak.drain());
    const status = await page.evaluate(() => window.__soak.status());
    const seconds = drained.atMs / 1000;
    const intervals = drained.renders.map(render => render.intervalMs).sort((a, b) => a - b);
    const inferenceMs = drained.inferences.map(value => value.inferenceMs).filter(Number.isFinite).sort((a, b) => a - b);
    const percentile = (values, fraction) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * fraction))] : null;
    report.results.push({
      phase: phase.name, intent: phase.intent, requestedMask: phase.mask.toString(16).toUpperCase(),
      draws: drained.renders.length, drawsPerSecond: Number((drained.renders.length / seconds).toFixed(2)),
      drawIntervalMedianMs: percentile(intervals, 0.5), drawIntervalP95Ms: percentile(intervals, 0.95), drawIntervalMaxMs: intervals.at(-1) ?? null,
      inferences: drained.inferences.length, inferencesPerSecond: Number((drained.inferences.length / seconds).toFixed(2)),
      inferenceMedianMs: percentile(inferenceMs, 0.5), inferenceP95Ms: percentile(inferenceMs, 0.95),
      durationMs: Number(drained.atMs.toFixed(1)), visibility: status.visibility, delegate: status.delegate,
      workerErrors: status.workerErrors, overflow: status.overflow,
    });
    console.log(JSON.stringify({ phase: phase.name, drawsPerSecond: report.results.at(-1).drawsPerSecond, inferencesPerSecond: report.results.at(-1).inferencesPerSecond }));
  }

  const byName = Object.fromEntries(report.results.map(result => [result.phase, result]));
  report.comparison = {
    defaultDrawsPerSecond: byName['default-fff']?.drawsPerSecond ?? null,
    eCoreDrawsPerSecond: byName['e-cores-ff0']?.drawsPerSecond ?? null,
    pCoreDrawsPerSecond: byName['p-cores-00f']?.drawsPerSecond ?? null,
    restoredDrawsPerSecond: byName['restored-fff']?.drawsPerSecond ?? null,
    eCoreToDefaultRatio: byName['default-fff']?.drawsPerSecond ? Number((byName['e-cores-ff0'].drawsPerSecond / byName['default-fff'].drawsPerSecond).toFixed(3)) : null,
    eCoreCollapsedTowardOneHz: (byName['e-cores-ff0']?.drawsPerSecond ?? Infinity) < 5,
    reversible: byName['default-fff']?.drawsPerSecond && byName['restored-fff']?.drawsPerSecond
      ? byName['restored-fff'].drawsPerSecond > byName['default-fff'].drawsPerSecond * 0.8 : null,
  };
  report.pageErrors = errors;
  report.passed = report.results.length === PHASES.length;
  report.status = report.passed ? 'complete' : 'failed';
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  if (ownedPids.length) report.finalRestore = await setAffinity(ownedPids, 0xFFF).catch(error => String(error));
  if (browser) await browser.close().catch(() => {});
  if (server) await server.close?.().catch?.(() => {});
  const file = path.join(ROOT, 'ops/001-zhil/sprint-001/reports', 'capture-core-placement-' + label + '.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2), { flag: 'wx' }).catch(error => {
    if (error.code !== 'EEXIST') throw error;
    console.error('Previous evidence exists for this label; nothing was overwritten.'); exit = 2;
  });
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status, comparison: report.comparison ?? null }, null, 2));
}
process.exit(exit);
