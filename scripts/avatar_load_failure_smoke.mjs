// What does a beginner see when they pick a file that is not a usable VRM?
//
// Selecting the wrong file is an ordinary mistake, and the load path reports
// failures with String(error), which is how the camera path used to surface raw
// DOMException text. This drives three bad inputs through the real file input
// and checks the message, that the working avatar survives, and that a good
// file afterwards recovers.
//
// Owns its server and browser. No OBS, camera or microphone.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..');

const CASES = [
  { name: 'not-a-model', description: 'A text file renamed to .vrm.', bytes: () => Buffer.from('this is clearly not a model') },
  { name: 'empty', description: 'An empty file.', bytes: () => Buffer.alloc(0) },
  { name: 'truncated-gltf', description: 'A glTF header with the body cut off.',
    bytes: () => { const b = Buffer.alloc(64); b.write('glTF', 0, 'ascii'); b.writeUInt32LE(2, 4); b.writeUInt32LE(4096, 8); return b; } },
];

const report = {
  date: new Date().toISOString(), passed: false, status: 'running',
  question: 'Does an unusable avatar file produce a message a beginner can act on, leave the app working, and recover?',
  obsInvolved: false, physicalMedia: false, cases: [],
  limits: [
    'Three malformed inputs, not an exhaustive corpus of broken VRM files.',
    'Judges whether the message names an action, not whether the wording is ideal.',
  ],
};

let server, browser, exit = 0;
try {
  server = await startIsolatedStudioServer();
  browser = await chromium.launch({ ...(process.argv.includes('--chromium') ? {} : { channel: 'chrome' }), headless: true });
  report.browser = browser.version();
  report.browserChannel = process.argv.includes('--chromium') ? 'chromium' : 'chrome';
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(server.base);
  await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
  const goodAvatarId = await page.evaluate(() => window.__vmodel.getState().avatarId);
  report.goodAvatarId = goodAvatarId;

  for (const testCase of CASES) {
    await page.setInputFiles('#avatar-file', { name: testCase.name + '.vrm', mimeType: 'application/octet-stream', buffer: testCase.bytes() });
    await page.waitForFunction(() => document.querySelector('#library-message').textContent.includes('Import failed'));
    const message = await page.textContent('#library-message');
    const stillWorking = await page.evaluate(() => {
      const before = window.__vmodel.viewer.renderer.info.render.frame;
      return new Promise(resolve => setTimeout(() => resolve({
        avatarId: window.__vmodel.getState().avatarId,
        advanced: window.__vmodel.viewer.renderer.info.render.frame > before,
      }), 600));
    });
    report.cases.push({
      name: testCase.name, description: testCase.description, message,
      avatarRetained: stillWorking.avatarId === goodAvatarId,
      stillRendering: stillWorking.advanced,
      // A beginner needs to be told what to do, not shown a parser's exception.
      namesAnAction: /choose|select|use load another|try another|pick/i.test(message ?? ''),
      looksLikeRawError: /^(Error:|TypeError:|RangeError:|\[object)/.test((message ?? '').trim()),
    });
    console.log(JSON.stringify({ case: testCase.name, message: (message ?? '').slice(0, 110) }));
  }

  // A good file afterwards must recover without a reload.
  // The prepared avatar exceeds Playwright's in-memory buffer limit; pass the path.
  await page.setInputFiles('#avatar-file', path.join(ROOT, 'dist/avatars/ene.vrm'));
  await page.waitForFunction(() => /Duplicate bytes|Ready to save/.test(document.querySelector('#library-message').textContent), undefined, { timeout: 60000 })
    .then(() => { report.recoveredAfterFailures = true; })
    .catch(() => { report.recoveredAfterFailures = false; });

  report.pageErrors = pageErrors;
  report.checks = {
    everyFailureRetainedTheAvatar: report.cases.every(entry => entry.avatarRetained),
    everyFailureKeptRendering: report.cases.every(entry => entry.stillRendering),
    everyMessageNamesAnAction: report.cases.every(entry => entry.namesAnAction),
    noRawExceptionText: report.cases.every(entry => !entry.looksLikeRawError),
    recoveredAfterFailures: report.recoveredAfterFailures === true,
    noPageErrors: pageErrors.length === 0,
  };
  report.passed = Object.values(report.checks).every(Boolean);
  report.status = report.passed ? 'complete' : 'failed';
  if (!report.passed) exit = 1;
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack ?? error); exit = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.stop().catch(() => {});
  const file = path.join(ROOT, 'ops/reports', process.argv.includes('--chromium') ? 'avatar-load-failure-chromium.json' : 'avatar-load-failure-smoke.json');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.relative(ROOT, file), status: report.status, checks: report.checks ?? null }, null, 2));
}
process.exit(exit);
