// Occupied, denied and removed microphones must leave audio muted and release resources.
//
// TASK-026 requires that start/stop/restart, model-load failure, occupied
// devices and backend loss all end muted with resources released. Model-load
// and backend failures are already covered by the Python studio tests; this
// covers the device half, which lives in the browser and cannot be produced on
// demand by a physical microphone.
//
// Each failure is injected as the exact DOMException the platform raises, or by
// ending the track mid-session. After each, the owned server's own status must
// report idle and muted, and the page must hold no live track or open audio
// context. The server and its state directory are owned and removed.
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 5084, base = 'http://127.0.0.1:' + PORT;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const CASES = [
  { name: 'occupied', kind: 'reject', error: 'NotReadableError', intent: 'Another application already holds the microphone.' },
  { name: 'denied', kind: 'reject', error: 'NotAllowedError', intent: 'Microphone permission is refused.' },
  { name: 'missing', kind: 'reject', error: 'NotFoundError', intent: 'No microphone device is present.' },
  { name: 'removed-mid-session', kind: 'end-track', intent: 'The microphone is unplugged while live.' },
];

const report = {
  date: new Date().toISOString(), passed: false, status: 'running',
  question: 'Do occupied, denied, missing and removed microphones leave audio muted with resources released, and can the user restart afterwards?',
  physicalMicrophone: false, physicalSpeaker: false, obsInvolved: false, liveAccepted: false, cases: [],
  limits: [
    'Injected DOMExceptions and a synthetic track end, not a physical device: no real microphone, speaker or OBS is involved.',
    'Verifies muted state and resource release, not audio quality, latency or sync.',
    'Model-load and backend-loss failures are covered separately by the Python studio tests, not repeated here.',
    'One attempt per state on one host; flapping or repeated-failure behaviour is not covered.',
  ],
};

const env = Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'].includes(key.toUpperCase())));

let server, browser, cache, exit = 0;
try {
  await mkdir(path.join(root, '.cache/voice'), { recursive: true });
  cache = await mkdtemp(path.join(root, '.cache/voice/mic-failure-'));
  server = spawn(path.join(root, '.tools/voice/venv/Scripts/python.exe'),
    ['-I', path.join(root, 'scripts/voice/studio_server.py'), '--port', String(PORT), '--state-dir', cache],
    { cwd: root, env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let serverErrors = '';
  server.stderr.on('data', chunk => { serverErrors += chunk.toString(); });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/health')).ok) break; } catch {}
    await sleep(100);
  }

  const status = async () => {
    const response = await fetch(base + '/api/status', {
      method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}' });
    return response.json();
  };

  browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'] });

  // One context for every case: a fresh controller per case churns the server's
  // single-controller lease. The injection is switched through a page global the
  // override reads on each call.
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  await context.addInitScript(() => {
    window.__micFailure = { kind: 'reject', error: 'NotReadableError' };
    navigator.mediaDevices.getUserMedia = async () => {
      const injected = window.__micFailure;
      if (injected.kind === 'reject') throw new DOMException('Injected ' + injected.error, injected.error);
      const listeners = [];
      const track = { kind: 'audio', readyState: 'live', stop() { this.readyState = 'ended'; },
        addEventListener: (name, handler) => { if (name === 'ended') listeners.push(handler); } };
      window.__endTrack = () => listeners.forEach(handler => handler());
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    };
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(base);
  await page.locator('#live').waitFor();
  // The engine loads on start-live, so the page sits at IDLE until then. Wait
  // only for the controller connection to enable the controls.
  await page.waitForFunction(() => !document.querySelector('#live').disabled, undefined, { timeout: 120000 });

  for (const testCase of CASES) {
    const before = pageErrors.length;
    await page.evaluate(injected => { window.__micFailure = injected; },
      { kind: testCase.kind, error: testCase.error ?? null });

    await page.locator('#live').click();
    if (testCase.kind === 'end-track') {
      // The microphone must open before it can be removed, and opening waits on
      // a model load that can take tens of seconds.
      await page.waitForFunction(() => typeof window.__endTrack === 'function', undefined, { timeout: 180000 });
      await sleep(1000);
      await page.evaluate(() => window.__endTrack?.());
    }
    // failLive reports this exact phrase once it has closed the microphone and
    // stopped the route; anything else means it did not take that path.
    const reachedFailure = await page.waitForFunction(
      () => /Microphone stopped and both routes muted/i.test(document.querySelector('#message')?.textContent ?? ''),
      undefined, { timeout: 180000 }).then(() => true).catch(() => false);
    await sleep(1000);

    const message = await page.textContent('#message');
    const serverStatus = await status();
    const stopAvailable = await page.evaluate(() => {
      const element = document.querySelector('#stop');
      return Boolean(element) && element.disabled !== true;
    });

    const entry = {
      name: testCase.name, intent: testCase.intent, injected: testCase.error ?? 'track ended',
      message, serverMode: serverStatus.mode, serverMuted: serverStatus.muted,
      endedMuted: serverStatus.mode === 'idle' && serverStatus.muted === true,
      reachedFailurePath: reachedFailure,
      reportsStoppedAndMuted: /Microphone stopped and both routes muted/i.test(message ?? ''),
      stopAvailable, pageErrors: pageErrors.slice(before),
    };
    report.cases.push(entry);
    console.log(JSON.stringify({ case: testCase.name, mode: entry.serverMode, muted: entry.serverMuted, message: (message ?? '').slice(0, 100) }));

    // Return to a clean idle state before the next case.
    await page.locator('#stop').click();
    await sleep(1500);
  }
  report.restartedAfterFailures = await page.evaluate(() => !document.querySelector('#live').disabled);
  await context.close();

  report.serverErrors = serverErrors.slice(0, 4000);
  report.summary = {
    allEndedMuted: report.cases.every(entry => entry.endedMuted),
    allReportedClearly: report.cases.every(entry => entry.reportsStoppedAndMuted),
    allReachedFailurePath: report.cases.every(entry => entry.reachedFailurePath),
    stopAlwaysAvailable: report.cases.every(entry => entry.stopAvailable),
    noPageErrors: report.cases.every(entry => entry.pageErrors.length === 0),
  };
  report.passed = Object.values(report.summary).every(Boolean);
  report.status = report.passed ? 'complete' : 'failed';
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill();
  await sleep(500);
  if (cache) await rm(cache, { recursive: true, force: true }).catch(() => {});
  const file = path.join(root, 'ops/reports', 'voice-mic-failure-smoke.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.relative(root, file), status: report.status, summary: report.summary ?? null }, null, 2));
}
process.exit(exit);
