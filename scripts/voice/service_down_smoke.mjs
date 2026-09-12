// What does the voice studio say when its own service stops?
//
// A stopped or crashed local service surfaces through fetch as "Failed to
// fetch". This starts an owned studio server, loads the page, stops the server,
// then uses the controls and reads what the user is told.
//
// Owns its server and browser. No microphone, speaker or OBS.
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 5085, base = 'http://127.0.0.1:' + PORT;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {
  date: new Date().toISOString(), passed: false, status: 'running',
  question: 'When the local voice service stops, is the user told something actionable rather than shown a fetch error?',
  physicalMedia: false, obsInvolved: false,
  limits: [
    'Stops the owned service abruptly; a gradual failure or a hung service may read differently.',
    'Checks the message only, not recovery after the service is restarted.',
    'Exercises the WebSocket disconnect path. The request path, where HTTP fails while the socket is still open, is not reached by killing the service.',
  ],
};
const env = Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'].includes(key.toUpperCase())));

let server, browser, cache, exit = 0;
try {
  await mkdir(path.join(root, '.cache/voice'), { recursive: true });
  cache = await mkdtemp(path.join(root, '.cache/voice/service-down-'));
  server = spawn(path.join(root, '.tools/voice/venv/Scripts/python.exe'),
    ['-I', path.join(root, 'scripts/voice/studio_server.py'), '--port', String(PORT), '--state-dir', cache],
    { cwd: root, env, windowsHide: true, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await sleep(100); }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto(base);
  await page.locator('#live').waitFor();
  await page.waitForFunction(() => !document.querySelector('#live').disabled, undefined, { timeout: 120000 });

  server.kill();
  await sleep(2500);
  await page.locator('[data-voice="soft"]').click().catch(() => {});
  await sleep(2500);
  report.message = await page.textContent('#message');
  // The control WebSocket closes before any HTTP request is attempted, so this
  // is handled by the disconnect path rather than by the request path.
  report.checks = {
    reportsDisconnection: /disconnect/i.test(report.message ?? ''),
    saysAudioIsMuted: /muted/i.test(report.message ?? ''),
    namesWhatToDo: /reconnect|start/i.test(report.message ?? ''),
    noRawFetchError: !/failed to fetch|networkerror|load failed|\[object/i.test(report.message ?? ''),
  };
  report.passed = Object.values(report.checks).every(Boolean);
  report.status = report.passed ? 'complete' : 'failed';
  if (!report.passed) exit = 1;
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill();
  await sleep(400);
  if (cache) await rm(cache, { recursive: true, force: true }).catch(() => {});
  const file = path.join(root, 'ops/reports', 'voice-service-down-smoke.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.relative(root, file), status: report.status,
    checks: report.checks ?? null, message: report.message ?? null }, null, 2));
}
process.exit(exit);
