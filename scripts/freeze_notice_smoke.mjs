// The studio must tell the user when its window was hidden.
//
// A hidden window delivers zero animation frames, so the avatar stops and an OBS
// capture of it goes blank. That pair of symptoms took a long time to explain;
// the app should now name it rather than leaving the user to rediscover it.
// The warning cannot be read while the window is hidden, so it is reported on
// return, with the duration.
//
// Owns its server and browser. No OBS, camera, microphone or recording.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const setVisibility = value => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
  document.dispatchEvent(new Event('visibilitychange'));
};

const report = {
  date: new Date().toISOString(), passed: false, status: 'running',
  question: 'Does the studio report that its window was hidden, and stay quiet about a brief flicker?',
  obsInvolved: false, physicalMedia: false,
  limits: [
    'Visibility is driven through the real visibilitychange event, not by actually minimizing the window.',
    'Verifies the message only; the measured frame-delivery behaviour is recorded separately.',
  ],
};

let server, browser, exit = 0;
try {
  server = await startIsolatedStudioServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(server.base);
  await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });

  report.statusBefore = await page.textContent('#status');
  await page.evaluate(setVisibility, 'hidden');
  await sleep(2500);
  await page.evaluate(setVisibility, 'visible');
  await sleep(300);
  report.statusAfterLongHide = await page.textContent('#status');

  // A flicker shorter than a second must not interrupt the user.
  await page.evaluate(() => { const element = document.querySelector('#status'); if (element) element.textContent = 'baseline'; });
  await page.evaluate(setVisibility, 'hidden');
  await sleep(200);
  await page.evaluate(setVisibility, 'visible');
  await sleep(300);
  report.statusAfterFlicker = await page.textContent('#status');

  report.checks = {
    reportedLongHide: /was hidden for/i.test(report.statusAfterLongHide ?? ''),
    namedTheRemedy: /minimizing it is not/i.test(report.statusAfterLongHide ?? ''),
    quietOnFlicker: report.statusAfterFlicker === 'baseline',
    noPageErrors: pageErrors.length === 0,
  };
  report.pageErrors = pageErrors;
  report.passed = Object.values(report.checks).every(Boolean);
  report.status = report.passed ? 'complete' : 'failed';
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.close?.().catch?.(() => {});
  const file = path.join(ROOT, 'ops/001-zhil/sprint-001/reports', 'freeze-notice-smoke.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status,
    checks: report.checks ?? null, message: report.statusAfterLongHide ?? null }, null, 2));
}
process.exit(exit);
