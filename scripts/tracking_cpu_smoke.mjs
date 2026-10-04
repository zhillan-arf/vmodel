// Direct production-worker diagnostic using synthetic bitmaps, without a camera.
import { chromium } from '@playwright/test';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

if (!process.argv.includes('--quiet-window')) throw new Error('Coordinate an idle CPU/browser window, then use --quiet-window.');
const report = { date: new Date().toISOString(), input: 'Seven 640 × 480 synthetic geometric bitmaps sent directly to the built tracking worker; no person, camera, microphone or gesture-quality test.', errors: [], messages: [], externalRequests: [], externalResponses: [], runtimeResponses: [] };
let server, browser;
try {
  const assets = (await readdir('dist/assets')).filter(name => /^tracking\.worker-.*\.js$/.test(name));
  assert.equal(assets.length, 1, 'Build exactly one production tracking worker first.');
  const workerPath = `/assets/${assets[0]}`;
  report.worker = { path: workerPath, sha256: createHash('sha256').update(await readFile(`dist${workerPath}`)).digest('hex') };
  report.sdk = JSON.parse(await readFile('node_modules/@mediapipe/tasks-vision/package.json', 'utf8')).version;
  report.runtimeAssets = JSON.parse(await readFile('config/runtime-assets.json', 'utf8'));
  const policy = JSON.parse(await readFile('config/http-policy.json', 'utf8'));
  server = await startIsolatedStudioServer(); report.server = { base: server.base, pid: server.pid, isolated: true };
  browser = await chromium.launch({ channel: 'chrome', headless: true }); report.chromeVersion = browser.version();
  const context = await browser.newContext();
  const external = url => !url.startsWith(server.base + '/') && !url.startsWith('blob:') && !url.startsWith('data:');
  context.on('request', request => { if (external(request.url())) report.externalRequests.push(request.url()); });
  context.on('response', response => {
    if (external(response.url())) report.externalResponses.push(response.url());
    else if (response.url().includes('/runtime/')) report.runtimeResponses.push({ path: response.url().replace(server.base, ''), status: response.status() });
  });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (external(url)) return route.abort('blockedbyclient');
    // Only the host document is minimal; worker, SDK, WASM and models come from
    // the real isolated production server with its normal security policy.
    if (url === server.base + '/') return route.fulfill({ status: 200, contentType: 'text/html', headers: policy, body: '<!doctype html><title>Owned CPU Tracking Diagnostic</title><p>Synthetic worker input only.</p>' });
    return route.continue();
  });
  await context.addInitScript(() => {
    window.__mediaRequests = 0;
    for (const name of ['getUserMedia', 'getDisplayMedia']) navigator.mediaDevices[name] = async () => { window.__mediaRequests++; throw new Error('This diagnostic has no media input.'); };
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (report.messages.length < 100) report.messages.push({ type: message.type(), text: message.text() }); });
  await page.goto(server.base + '/');
  report.measurement = await page.evaluate(async workerPath => {
    const worker = new Worker(workerPath, { type: 'module' });
    const request = (message, transfers = []) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('CPU worker request timed out.')); }, 60000);
      const cleanup = () => { clearTimeout(timer); worker.removeEventListener('message', receive); worker.removeEventListener('error', failed); };
      const receive = ({ data }) => { cleanup(); data.type === 'error' ? reject(new Error(data.message)) : resolve(data); };
      const failed = event => { cleanup(); reject(new Error(event.message)); };
      worker.addEventListener('message', receive); worker.addEventListener('error', failed);
      worker.postMessage(message, transfers);
    });
    try {
      const start = performance.now(), ready = await request({ type: 'init', delegate: 'CPU' });
      const initializationMs = performance.now() - start;
      if (ready.type !== 'ready' || ready.delegate !== 'CPU') throw new Error('Actual worker did not initialize the explicit CPU delegate.');
      const canvas = new OffscreenCanvas(640, 480), draw = canvas.getContext('2d'), frames = [];
      for (let index = 0; index < 7; index++) {
        draw.fillStyle = '#182236'; draw.fillRect(0, 0, 640, 480);
        draw.fillStyle = '#52cbd9'; draw.fillRect(20 + index * 25, 30, 80, 70);
        draw.fillStyle = '#9851bc'; draw.fillRect(450, 330 - index * 10, 40, 40);
        const bitmap = await createImageBitmap(canvas), timestamp = performance.timeOrigin + performance.now();
        const sent = performance.now();
        const result = await request({ type: 'frame', bitmap, timestamp, quality: 'balanced', hands: true }, [bitmap]);
        if (result.type !== 'result') throw new Error('Missing CPU inference result.');
        frames.push({ ...result.frame, roundTripMs: performance.now() - sent, sentTimestamp: timestamp });
      }
      return { ready, initializationMs, frames, mediaRequests: window.__mediaRequests };
    } finally { worker.terminate(); }
  }, workerPath);
  const { frames } = report.measurement;
  assert.equal(frames.length, 7); assert.equal(report.measurement.mediaRequests, 0);
  for (const [index, frame] of frames.entries()) {
    assert.equal(frame.version, 1); assert.equal(frame.sequence, index + 1);
    assert.equal(frame.timestamp, frame.sentTimestamp); assert(frame.inferenceMs > 0 && Number.isFinite(frame.inferenceMs));
    assert.deepEqual(frame.inputSize, { width: 640, height: 480 });
    assert.equal(frame.samples.face.timestamp, frame.timestamp);
    for (const name of ['face', 'pose', 'hands']) {
      assert(frame.samples[name].inferenceMs > 0 && Number.isFinite(frame.samples[name].inferenceMs));
      if (index % 2 === 0) assert.equal(frame.samples[name].timestamp, frame.timestamp);
      assert.equal(frame.samples[name].present, false, 'Synthetic rectangles must not establish a detected person.');
    }
    assert.equal(frame.faceMatrix, null); assert.equal(frame.pose.length, 0); assert.equal(frame.hands.length, 0);
  }
  for (const file of ['face_landmarker.task', 'pose_landmarker_lite.task', 'hand_landmarker.task']) assert(report.runtimeResponses.some(response => response.path === '/runtime/' + file && response.status === 200), `Missing actual model response: ${file}`);
  for (const task of ['face', 'pose', 'hands']) assert(report.runtimeResponses.some(response => response.path.includes(`task=${task}-CPU`) && response.status === 200));
  assert.equal(report.externalResponses.length, 0); assert.equal(report.externalRequests.length, 0); assert.deepEqual(report.errors, []);
  report.passed = true;
  console.log(JSON.stringify({ passed: true, delegate: report.measurement.ready.delegate, initializationMs: report.measurement.initializationMs, frames: frames.length, perFrameMs: frames.map(frame => frame.inferenceMs), models: 3, mediaRequests: 0 }));
} catch (error) { report.errors.push(String(error)); report.passed = false; console.error(error); process.exitCode = 1; }
finally {
  try { await browser?.close(); report.browserClosed = !!browser; } catch (error) { report.errors.push(`Browser cleanup: ${error}`); process.exitCode = 1; }
  try { if (server) { report.serverExit = await server.stop(); report.serverStopped = true; } } catch (error) { report.errors.push(`Server cleanup: ${error}`); process.exitCode = 1; }
  await mkdir('ops/001-zhil/sprint-001/reports', { recursive: true }); await writeFile('ops/001-zhil/sprint-001/reports/tracking-cpu-smoke.json', JSON.stringify(report, null, 2) + '\n');
}
