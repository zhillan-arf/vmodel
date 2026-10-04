import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('ops/001-zhil/sprint-001/reports/local', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], messages = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (['warning','error'].includes(message.type())) messages.push(message.text()); });
page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5173/') && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) requests.push(request.url()); });
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => !!window.__vmodel, undefined, { timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'ops/001-zhil/sprint-001/reports/local/studio.png', fullPage: true });
  const diagnostics = await page.evaluate(() => ({
    stats: window.__vmodel.getStats(),
    meta: window.__vmodel.viewer.vrm.meta,
    expressions: window.__vmodel.viewer.vrm.expressionManager.expressions.map(x => x.expressionName),
    status: document.querySelector('#status')?.textContent,
  }));
  await writeFile('ops/001-zhil/sprint-001/reports/browser-smoke.json', JSON.stringify({ diagnostics, errors, messages: messages.slice(0,40), externalRequests: requests }, null, 2));
  console.log(JSON.stringify({ status: diagnostics.status, stats: diagnostics.stats, errors, warnings: messages.length, externalRequests: requests.length }));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
