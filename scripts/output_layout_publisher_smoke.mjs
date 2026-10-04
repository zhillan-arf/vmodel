// Exercise the actual production publisher past the old cumulative keepalive threshold.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { stripTypeScriptTypes } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createOutputLayoutHandler } from './output-layout.mjs';

const source = await readFile('src/output-layout.ts', 'utf8');
const javascript = stripTypeScriptTypes(source);
const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const port = server.address().port, origin = `http://127.0.0.1:${port}`, handler = createOutputLayoutHandler(port);
let posts = 0, payloadBytes = 0;
server.on('request', (req, res) => {
  if (req.method === 'POST') { posts++; req.on('data', chunk => { payloadBytes += chunk.length; }); }
  if (req.url === '/publisher.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(javascript); return; }
  void handler(req, res).then(handled => {
    if (!handled) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>VModel Output heartbeat regression</title><canvas width="640" height="360"></canvas>'); }
  });
});
const report = { startedAt: new Date().toISOString(), sourceSHA256: createHash('sha256').update(source).digest('hex'),
  actualSource: 'src/output-layout.ts', cadenceOverrideMs: 10, normalCadenceMs: 1500, noMedia: true, noOBS: true, completed: false };
let browser, context;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false }); report.chromeVersion = browser.version();
  context = await browser.newContext(); await context.route('**/*', route => route.continue());
  let finished = 0, requests = 0, stopping = false; const failures = [];
  context.on('request', request => { if (request.method() === 'POST') requests++; });
  context.on('requestfinished', request => { if (request.method() === 'POST') finished++; });
  context.on('requestfailed', request => { if (request.method() === 'POST' && failures.length < 5) failures.push({ ...request.failure(), duringStop: stopping }); });
  const page = await context.newPage(); await page.goto(origin);
  await page.evaluate(async () => {
    const originalSetInterval = window.setInterval.bind(window);
    window.setInterval = (callback, delay, ...args) => originalSetInterval(callback, delay === 1500 ? 10 : delay, ...args);
    const { publishOutputLayout } = await import('/publisher.js');
    window.stopPublisher = publishOutputLayout(document.querySelector('canvas'), () => ({ active: true, kind: 'clean', orientation: 'landscape' }));
  });
  const deadline = Date.now() + 20000;
  while (posts < 500 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  assert(posts >= 500, 'Actual publisher did not complete 500 accelerated heartbeats within the bounded diagnostic.');
  const activeLayouts = (await (await fetch(origin + '/api/output-layout')).json()).layouts;
  assert.equal(activeLayouts.length, 1); assert(Date.now() - activeLayouts[0].observedAt < 1000);
  report.beforeStop = { posts, payloadBytes, requests, finished, failures: [...failures], activeLayouts: activeLayouts.length };
  assert.equal(failures.length, 0);
  stopping = true;
  await page.evaluate(() => window.stopPublisher()); await page.waitForTimeout(250);
  const inactiveLayouts = (await (await fetch(origin + '/api/output-layout')).json()).layouts;
  assert.equal(inactiveLayouts.length, 0);
  // Stop intentionally aborts the sole pending periodic request, if the 10 ms timer has started one.
  assert(failures.length <= 1 && failures.every(failure => failure.duringStop && failure.errorText === 'net::ERR_ABORTED'));
  assert.equal(requests, finished + failures.length);
  assert(payloadBytes > 65536);
  report.afterStop = { posts, payloadBytes, requests, finished, expectedPendingAbort: failures, activeLayouts: inactiveLayouts.length }; report.completed = true;
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally {
  await context?.close(); await browser?.close(); await new Promise(resolve => server.close(resolve));
  report.finishedAt = new Date().toISOString(); report.ownedCleanup = true;
  await writeFile('ops/001-zhil/sprint-001/reports/output-layout-publisher-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
