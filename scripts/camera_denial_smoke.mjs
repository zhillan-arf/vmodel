// Denied, missing and busy camera states, and recovery from each.
//
// TASK-009 requires that denied or missing camera states are recoverable.
// A physical webcam cannot produce those states on demand, so each is injected
// by making getUserMedia reject once with the exact DOMException the platform
// raises, then allowing the next attempt through to the fake device.
//
// This exercises the application's handling and recovery path. It does NOT
// certify the physical device stack: a real denial also involves the browser
// permission UI and the OS camera privacy setting, neither of which is touched.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const CASES = [
  { name: 'denied', error: 'NotAllowedError', expect: /permission denied/i,
    intent: 'The user or the OS refuses camera access.' },
  { name: 'missing', error: 'NotFoundError', expect: /no camera found/i,
    intent: 'No camera device is present.' },
  { name: 'busy', error: 'NotReadableError', expect: /busy/i,
    intent: 'Another application holds the camera.' },
  { name: 'overconstrained', error: 'OverconstrainedError', expect: /cannot provide the selected resolution/i,
    intent: 'The device cannot satisfy the requested resolution.' },
];

const report = {
  date: new Date().toISOString(), passed: false, status: 'running',
  question: 'Does the app report denied, missing and busy camera states clearly, release resources, recover on retry, and keep Stop and Recenter available throughout?',
  physicalCamera: false, cases: [],
  limits: [
    'Injected DOMExceptions, not a physical device: the browser permission UI and OS camera privacy setting are untouched.',
    'Recovery is verified against the fake device, so it shows the application path recovers, not that a real camera re-acquires.',
    'One attempt per state on one host; no repeated-failure or flapping-device behaviour is covered.',
  ],
};

let server, browser, exit = 0;
try {
  server = await startIsolatedStudioServer();
  report.server = { base: server.base, port: server.port, owned: true };
  browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  report.chromeVersion = browser.version();

  for (const testCase of CASES) {
    const context = await browser.newContext();
    // Fail exactly the first acquisition, then let the retry reach the fake device.
    await context.addInitScript(errorName => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      let failed = false;
      navigator.mediaDevices.getUserMedia = async constraints => {
        if (!failed) { failed = true; throw new DOMException('Injected ' + errorName, errorName); }
        return real(constraints);
      };
    }, testCase.error);
    const page = await context.newPage();
    // TASK-015: Stop and Recenter must never become unavailable, in any state.
    const controls = async where => page.evaluate(label => {
      const check = selector => {
        const element = document.querySelector(selector);
        return element ? { present: true, disabled: element.disabled === true, hidden: element.hidden === true } : { present: false };
      };
      return { where: label, stop: check('#stop'), recenter: check('#calibrate'), start: check('#start') };
    }, where);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(server.base);
    await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });

    const controlsBeforeStart = await controls('before-start');
    await page.locator('#start').click();
    await page.waitForFunction(expected => new RegExp(expected, 'i').test(document.querySelector('#status')?.textContent ?? ''),
      testCase.expect.source, { timeout: 30000 }).catch(() => {});
    const failureStatus = await page.textContent('#status');
    const afterFailure = await page.evaluate(() => ({
      tracks: (window.__vmodel.cameraStream?.getTracks?.() ?? []).length,
      running: Boolean(window.__vmodel.camera?.running),
    })).catch(() => null);

    const controlsAfterFailure = await controls('after-failure');
    // Retry: the same control must recover without a reload.
    await page.locator('#start').click();
    const recovered = await page.waitForFunction(() => /camera active/i.test(document.querySelector('#status')?.textContent ?? ''),
      undefined, { timeout: 90000 }).then(() => true).catch(() => false);
    const recoveredStatus = await page.textContent('#status');
    const controlsWhileRunning = await controls('while-running');
    await page.locator('#stop').click();
    await sleep(1000);
    const afterStop = await page.textContent('#status');
    const controlsAfterStop = await controls('after-stop');
    const available = [controlsBeforeStart, controlsAfterFailure, controlsWhileRunning, controlsAfterStop];
    const alwaysAvailable = available.every(entry =>
      entry.stop.present && !entry.stop.disabled && !entry.stop.hidden &&
      entry.recenter.present && !entry.recenter.disabled && !entry.recenter.hidden);

    report.cases.push({
      name: testCase.name, injectedError: testCase.error, intent: testCase.intent,
      failureStatus, messageMatchedExpectation: testCase.expect.test(failureStatus ?? ''),
      releasedOnFailure: afterFailure, recoveredOnRetry: recovered, recoveredStatus,
      statusAfterStop: afterStop, pageErrors: errors,
      controlAvailability: available, stopAndRecenterAlwaysAvailable: alwaysAvailable,
    });
    console.log(JSON.stringify({ case: testCase.name, message: failureStatus, recovered }));
    await context.close();
  }

  report.summary = {
    allMessagesClear: report.cases.every(entry => entry.messageMatchedExpectation),
    allRecovered: report.cases.every(entry => entry.recoveredOnRetry),
    noPageErrors: report.cases.every(entry => entry.pageErrors.length === 0),
    stopAndRecenterAlwaysAvailable: report.cases.every(entry => entry.stopAndRecenterAlwaysAvailable),
  };
  report.passed = report.summary.allMessagesClear && report.summary.allRecovered && report.summary.noPageErrors && report.summary.stopAndRecenterAlwaysAvailable;
  report.status = report.passed ? 'complete' : 'failed';
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.close?.().catch?.(() => {});
  const file = path.join(ROOT, 'ops/reports', 'camera-denial-smoke.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status, summary: report.summary ?? null }, null, 2));
}
process.exit(exit);
