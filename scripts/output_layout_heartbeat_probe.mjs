// Isolated fetch/Playwright-boundary diagnostic. No app, camera, OBS or shared server.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createOutputLayoutHandler } from './output-layout.mjs';

const server = createServer();
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const port = server.address().port, origin = `http://127.0.0.1:${port}`;
const handler = createOutputLayoutHandler(port);
let observedPosts = 0, completedPosts = 0;
server.on('request', (req, res) => {
  if (req.method === 'POST') { observedPosts++; res.on('finish', () => completedPosts++); }
  void handler(req, res).then(handled => {
    if (!handled) { res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self'; connect-src 'self'" }); res.end('<!doctype html><title>Ene heartbeat probe</title>Owned local heartbeat probe. No media.'); }
  });
});
const report = { startedAt: new Date().toISOString(), noMedia: true, noOBS: true, ownedOrigin: origin, cases: [] };
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: false });
  report.chromeVersion = browser.version();
  for (const variant of [
    { id: 'routed-keepalive-unread', route: true, keepalive: true, consume: false },
    { id: 'unrouted-keepalive-unread', route: false, keepalive: true, consume: false },
    { id: 'routed-keepalive-consumed', route: true, keepalive: true, consume: true },
    { id: 'routed-ordinary-consumed', route: true, keepalive: false, consume: true },
  ]) {
    const context = await browser.newContext();
    if (variant.route) await context.route('**/*', route => route.continue());
    const events = { requests: 0, responses: 0, finished: 0, failures: [] };
    context.on('request', req => { if (req.method() === 'POST') events.requests++; });
    context.on('response', res => { if (res.request().method() === 'POST') events.responses++; });
    context.on('requestfinished', req => { if (req.method() === 'POST') events.finished++; });
    context.on('requestfailed', req => { if (req.method() === 'POST' && events.failures.length < 5) events.failures.push(req.failure()); });
    const page = await context.newPage(); await page.goto(origin);
    const postsBefore = observedPosts, completeBefore = completedPosts;
    const measured = await page.evaluate(async variant => {
      const payload = JSON.stringify({ id: crypto.randomUUID(), active: true, kind: 'clean', orientation: 'landscape',
        title: 'VModel Output Soak 2026-09-12T11-34-10-731Z-a910b510', viewport: { width: 1283, height: 643 },
        canvas: { left: 69.9375, top: 0, width: 1143.104248046875, height: 643 } });
      const failures = []; let passed = 0, failed = 0, lastStatus;
      const started = performance.now();
      for (let index = 0; index < 500; index++) {
        try {
          const response = await fetch('/api/output-layout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: payload, keepalive: variant.keepalive, ...(variant.keepalive ? {} : { signal: AbortSignal.timeout(2000) }) });
          lastStatus = response.status;
          if (variant.consume) await response.text();
          if (!response.ok) throw new Error('HTTP ' + response.status);
          passed++;
        } catch (error) {
          failed++;
          if (failures.length < 5) failures.push({ index, name: error.name, message: error.message, stack: error.stack, atMs: performance.now() - started });
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return { attempts: 500, payloadBytes: new TextEncoder().encode(payload).length, passed, failed, failures, lastStatus,
        elapsedMs: performance.now() - started, online: navigator.onLine, visibility: document.visibilityState };
    }, variant);
    await page.waitForTimeout(150);
    const result = { ...variant, ...measured, browserEvents: events, serverPosts: observedPosts - postsBefore, serverCompletedPosts: completedPosts - completeBefore };
    report.cases.push(result); console.log(JSON.stringify(result));
    await context.close();
  }
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  report.finishedAt = new Date().toISOString(); report.ownedCleanup = true;
  await mkdir('ops/001-zhil/sprint-001/reports', { recursive: true });
  await writeFile('ops/001-zhil/sprint-001/reports/output-layout-heartbeat-probe.json', JSON.stringify(report, null, 2) + '\n');
}
