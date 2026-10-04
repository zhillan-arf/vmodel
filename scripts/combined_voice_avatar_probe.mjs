// Combined-workload measurement: does the paced voice pipeline still meet its
// deadlines while the avatar renders and tracks, and what does each cost the other?
//
// The hybrid-core diagnosis showed LLVC inference needs a performance core to
// meet its 52 ms chunk budget, and the core-placement probe showed the avatar
// gains nothing from pinning but still wants CPU. This host has only two
// physical performance cores, so contention between the two subsystems is the
// central open risk. This probe runs both at once and measures both.
//
// It owns its server, browser and voice child process. No microphone, speaker,
// OBS, physical camera or served catalog is involved.
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

const avatarAffinity = process.argv.includes('--avatar-affinity') ? process.argv[process.argv.indexOf('--avatar-affinity') + 1] : '';
if (avatarAffinity && !/^[0-9A-F]{1,3}$/.test(avatarAffinity)) { console.error('--avatar-affinity must be a short hex mask'); process.exit(2); }
const FIXTURE = { id: 'portrait', file: 'assets/testing/jsc2021e037768_alt.jpg',
  sha256: '7a7536821783691d1c7b58f5ee7cb601abbeaaa2f4703e755a15c5dbb4271b78', credit: 'NASA/Josh Valcarcel' };
const BASELINE_MS = 20000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, fraction) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * fraction))] : null;

const report = {
  date: new Date().toISOString(), runLabel: label, passed: false, status: 'running',
  question: 'Does the paced LLVC pipeline still meet every deadline while the avatar renders and tracks, and what does each workload cost the other?',
  voiceRunLabel: 'combined-' + label, voiceAffinityMask: 'F', voiceTimerResolutionMs: 1,
  avatarAffinityMask: avatarAffinity || null,
  separationIntent: avatarAffinity ? 'Avatar confined to the requested mask so the voice inference thread does not share a physical performance core with tracking.' : 'Avatar unpinned, as recommended by the core-placement probe.',
  obsInvolved: false, physicalMedia: false, microphoneInvolved: false, liveAccepted: false,
  limits: [
    'A synthetic combined measurement: a permitted still drives tracking and a licensed file drives the converter.',
    'No microphone, speaker, WebAudio sink, OBS or physical device, so this is not measured acoustic latency or sync.',
    'No listening acceptance: numerical completeness is not a quality verdict.',
    'Thirty seconds of paced voice against a continuously rendering avatar; not a five-minute or thirty-minute soak.',
    'Ambient system load is recorded, not controlled.',
    'Affinity is applied to whole processes; per-thread placement inside the browser is not controlled.',
    'Separating the two subsystems onto different core kinds is a measured trade, not an accepted production setting.',
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

async function measureAvatar(page, ms, tag) {
  await page.evaluate(() => window.__soak.begin());
  await sleep(ms);
  const drained = await page.evaluate(() => window.__soak.drain());
  const status = await page.evaluate(() => window.__soak.status());
  const seconds = drained.atMs / 1000;
  const intervals = drained.renders.map(render => render.intervalMs).sort((a, b) => a - b);
  const inferenceMs = drained.inferences.map(value => value.inferenceMs).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    tag, draws: drained.renders.length, drawsPerSecond: Number((drained.renders.length / seconds).toFixed(2)),
    drawIntervalMedianMs: percentile(intervals, 0.5), drawIntervalP95Ms: percentile(intervals, 0.95), drawIntervalMaxMs: intervals.at(-1) ?? null,
    inferences: drained.inferences.length, inferencesPerSecond: Number((drained.inferences.length / seconds).toFixed(2)),
    inferenceMedianMs: percentile(inferenceMs, 0.5), inferenceP95Ms: percentile(inferenceMs, 0.95),
    durationMs: Number(drained.atMs.toFixed(1)), workerErrors: status.workerErrors, overflow: status.overflow, delegate: status.delegate,
  };
}

let server, browser, exit = 0;
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
  await page.evaluate(() => { document.title = 'Ene Combined Voice'; });
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

  let ownedPids = [];
  if (avatarAffinity) {
    const browserCDP = await browser.newBrowserCDPSession();
    const info = (await browserCDP.send('SystemInfo.getProcessInfo')).processInfo;
    ownedPids = info.map(value => value.id);
    report.ownedProcesses = info.map(value => ({ id: value.id, type: value.type }));
    report.avatarAffinityChanges = await setAffinity(ownedPids, parseInt(avatarAffinity, 16));
  }

  await sleep(5000);
  report.avatarBefore = await measureAvatar(page, BASELINE_MS, 'avatar-alone-before');
  console.log(JSON.stringify({ phase: 'avatar-alone-before', drawsPerSecond: report.avatarBefore.drawsPerSecond, inferencesPerSecond: report.avatarBefore.inferencesPerSecond }));

  // Start the paced voice proof and measure the avatar for its whole duration.
  const python = path.join(ROOT, '.tools/voice/venv/Scripts/python.exe');
  const voiceArgs = [path.join(ROOT, 'scripts/voice/probe_llvc_paced.py'), '--quiet-window',
    '--run-label', report.voiceRunLabel, '--affinity-mask', 'F', '--timer-resolution-ms', '1'];
  const voicePromise = run(python, voiceArgs, { cwd: ROOT, timeout: 240000, windowsHide: true, maxBuffer: 4 * 1024 ** 2 })
    .then(result => ({ ok: true, stdout: result.stdout }))
    .catch(error => ({ ok: false, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? error.message ?? error) }));
  await sleep(6000); // model load and warm-up before the paced interval
  report.avatarDuring = await measureAvatar(page, 30000, 'avatar-with-voice');
  console.log(JSON.stringify({ phase: 'avatar-with-voice', drawsPerSecond: report.avatarDuring.drawsPerSecond, inferencesPerSecond: report.avatarDuring.inferencesPerSecond }));
  const voiceResult = await voicePromise;
  report.voiceProcess = { ok: voiceResult.ok, stderr: voiceResult.stderr?.slice(0, 4000) ?? null };

  report.avatarAfter = await measureAvatar(page, BASELINE_MS, 'avatar-alone-after');
  console.log(JSON.stringify({ phase: 'avatar-alone-after', drawsPerSecond: report.avatarAfter.drawsPerSecond, inferencesPerSecond: report.avatarAfter.inferencesPerSecond }));

  const voiceReportPath = path.join(ROOT, 'ops/001-zhil/sprint-001/reports', 'llvc-paced-' + report.voiceRunLabel + '.json');
  const voice = JSON.parse(await readFile(voiceReportPath, 'utf8'));
  report.voiceReport = path.relative(ROOT, voiceReportPath);
  report.voice = {
    passed: voice.passed, status: voice.status, failure: voice.pipeline?.failure ?? null,
    forwardCallCount: voice.timingTotals?.forwardCallCount, expectedNeuralCalls: voice.timingTotals?.expectedNeuralCalls,
    computeDeadlineMisses: voice.timingTotals?.computeDeadlineMisses, medianMs: voice.timingTotals?.medianMs,
    p95Ms: voice.timingTotals?.p95Ms, maxMs: voice.timingTotals?.maxMs, computeRtf: voice.timingTotals?.computeRtf,
    consumedInputPackets: voice.pipeline?.consumedInputPackets, expectedInputPackets: voice.pipeline?.expectedInputPackets,
    inputHighWaterPackets: voice.pipeline?.inputHighWaterPackets,
    modeledSignalStartEstimateMs: voice.pipeline?.modeledSignalStartEstimateMs,
    software350msBudgetMet: voice.pipeline?.software350msBudgetMet,
    completedWithoutLoss: voice.pipeline?.completedWithoutLoss,
  };

  const ratio = (a, b) => (a && b ? Number((b / a).toFixed(3)) : null);
  report.comparison = {
    avatarDrawsBefore: report.avatarBefore.drawsPerSecond, avatarDrawsDuring: report.avatarDuring.drawsPerSecond, avatarDrawsAfter: report.avatarAfter.drawsPerSecond,
    avatarDrawRetention: ratio(report.avatarBefore.drawsPerSecond, report.avatarDuring.drawsPerSecond),
    avatarInferenceRetention: ratio(report.avatarBefore.inferencesPerSecond, report.avatarDuring.inferencesPerSecond),
    avatarRecovered: report.avatarBefore.drawsPerSecond ? report.avatarAfter.drawsPerSecond > report.avatarBefore.drawsPerSecond * 0.9 : null,
    voicePassedUnderCombinedLoad: report.voice.passed === true,
    voiceDeadlineMisses: report.voice.computeDeadlineMisses,
    bothSubsystemsHealthy: report.voice.passed === true && (report.avatarDuring.drawsPerSecond ?? 0) >= 25,
  };
  report.pageErrors = errors;
  report.passed = report.voice.passed === true && report.avatarDuring.draws > 0;
  report.status = report.passed ? 'complete' : 'failed';
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.close?.().catch?.(() => {});
  const file = path.join(ROOT, 'ops/001-zhil/sprint-001/reports', 'combined-voice-avatar-' + label + '.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2), { flag: 'wx' }).catch(error => {
    if (error.code !== 'EEXIST') throw error;
    console.error('Previous evidence exists for this label; nothing was overwritten.'); exit = 2;
  });
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status, comparison: report.comparison ?? null }, null, 2));
}
process.exit(exit);
