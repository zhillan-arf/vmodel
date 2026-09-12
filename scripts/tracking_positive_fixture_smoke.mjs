// Real-photo inference diagnostic, not live camera or gesture acceptance.
// Fixture files stay in ignored assets/testing and are not added to the app build.
import { chromium } from '@playwright/test';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { startIsolatedStudioServer } from './isolated-studio-server.mjs';

if (!process.argv.includes('--quiet-window')) throw new Error('Coordinate an idle CPU/GPU window, then use --quiet-window.');
const usage = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';
const fixtures = [
  { id: 'portrait', file: 'assets/testing/jsc2021e037768_alt.jpg', sha256: '7a7536821783691d1c7b58f5ee7cb601abbeaaa2f4703e755a15c5dbb4271b78',
    url: 'https://images-assets.nasa.gov/image/jsc2021e037768_alt/jsc2021e037768_alt~orig.jpg', metadata: 'https://images-api.nasa.gov/search?nasa_id=jsc2021e037768_alt',
    sourcePage: 'https://www.nasa.gov/image-article/spacex-crew-4-mission-specialist-jessica-watkins/', credit: 'NASA/Josh Valcarcel', usage },
  { id: 'full-body', file: 'assets/testing/jsc2026e002116.jpg', sha256: '194f6ba51f7bdeb090c9a47e7ab69d3fa191fbb6240cd4b6f118a215bc27caf0',
    url: 'https://images-assets.nasa.gov/image/jsc2026e002116/jsc2026e002116~medium.jpg', metadata: 'https://images-api.nasa.gov/search?nasa_id=jsc2026e002116',
    sourcePage: 'https://images.nasa.gov/details/jsc2026e002116', credit: 'NASA/Robert Markowitz', usage },
];
const variants = [
  { id: 'portrait-full', fixture: 'portrait' },
  { id: 'body-full', fixture: 'full-body' },
  { id: 'body-upper-crop', fixture: 'full-body', crop: { x: 130, y: 60, width: 670, height: 690 } },
  { id: 'body-face-hand-crop', fixture: 'full-body', crop: { x: 150, y: 75, width: 520, height: 400 } },
];
const relativeTimestamp = process.argv.includes('--relative-timestamps');
const report = { date: new Date().toISOString(), timestampMode: relativeTimestamp ? 'Monotonic session-relative milliseconds (diagnostic comparison)' : 'Epoch milliseconds (normal TrackingFrame contract)', input: 'Two NASA-credited real-person photos, repeated as still frames. Ordinary canvas resizing/letterboxing and two stated upper-body crops only. No camera, image generation, identity/sensitive-trait analysis, training, public redistribution or movement test.',
  terms: { source: usage, basis: 'NASA permits factual informational uses subject to its media guidelines. Files and technical outputs are private test artifacts, imply no NASA endorsement, and are not used as promotional imagery. Photographs retain their publisher content; models are only run for inference, not trained.' },
  fixtures, variants, results: [], errors: [], messages: [], externalRequests: [], externalResponses: [], runtimeResponses: [] };
let server, browser;
try {
  const fixtureBytes = new Map();
  for (const fixture of fixtures) {
    const bytes = await readFile(fixture.file); assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.sha256);
    fixture.bytes = bytes.length; fixtureBytes.set(`/testing/${fixture.id}.jpg`, bytes);
  }
  const assets = (await readdir('dist/assets')).filter(name => /^tracking\.worker-.*\.js$/.test(name)); assert.equal(assets.length, 1);
  const workerPath = `/assets/${assets[0]}`;
  report.worker = { path: workerPath, sha256: createHash('sha256').update(await readFile(`dist${workerPath}`)).digest('hex') };
  report.sdk = JSON.parse(await readFile('node_modules/@mediapipe/tasks-vision/package.json', 'utf8')).version;
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
    if (url === server.base + '/') return route.fulfill({ status: 200, contentType: 'text/html', headers: policy, body: '<!doctype html><title>Owned Photo Fixture Diagnostic</title><p>Private informational inference check.</p>' });
    const bytes = fixtureBytes.get(new URL(url).pathname);
    if (bytes) return route.fulfill({ status: 200, contentType: 'image/jpeg', headers: policy, body: bytes });
    return route.continue();
  });
  await context.addInitScript(() => {
    window.__mediaRequests = 0;
    for (const name of ['getUserMedia', 'getDisplayMedia']) navigator.mediaDevices[name] = async () => { window.__mediaRequests++; throw new Error('Physical/display media are disabled in this fixture.'); };
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (report.messages.length < 150) report.messages.push({ type: message.type(), text: message.text() }); });
  await page.goto(server.base + '/');
  for (const delegate of ['GPU', 'CPU']) {
    const result = await page.evaluate(async ({ delegate, variants, workerPath, relativeTimestamp }) => {
      const worker = new Worker(workerPath, { type: 'module' }), bitmaps = new Map();
      const request = (message, transfers = []) => new Promise((resolve, reject) => {
        const cleanup = () => { clearTimeout(timer); worker.removeEventListener('message', receive); worker.removeEventListener('error', failed); };
        const receive = ({ data }) => { cleanup(); data.type === 'error' ? reject(new Error(data.message)) : resolve(data); };
        const failed = event => { cleanup(); reject(new Error(event.message)); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('Photo fixture worker request timed out.')); }, 60000);
        worker.addEventListener('message', receive); worker.addEventListener('error', failed); worker.postMessage(message, transfers);
      });
      try {
        for (const fixture of new Set(variants.map(variant => variant.fixture))) bitmaps.set(fixture, await createImageBitmap(await (await fetch(`/testing/${fixture}.jpg`)).blob()));
        const start = performance.now(), ready = await request({ type: 'init', ...(delegate === 'CPU' ? { delegate } : {}) });
        if (ready.type !== 'ready' || ready.delegate !== delegate) throw new Error(`Requested ${delegate}; worker returned ${JSON.stringify(ready)}`);
        const initializationMs = performance.now() - start, measurements = [];
        const canvas = new OffscreenCanvas(640, 480), draw = canvas.getContext('2d');
        for (const variant of variants) {
          const image = bitmaps.get(variant.fixture), crop = variant.crop ?? { x: 0, y: 0, width: image.width, height: image.height };
          const scale = Math.min(canvas.width / crop.width, canvas.height / crop.height), width = crop.width * scale, height = crop.height * scale;
          draw.fillStyle = '#000'; draw.fillRect(0, 0, canvas.width, canvas.height);
          draw.drawImage(image, crop.x, crop.y, crop.width, crop.height, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
          const frames = [];
          for (let index = 0; index < 11; index++) {
            const bitmap = await createImageBitmap(canvas), timestamp = (relativeTimestamp ? 0 : performance.timeOrigin) + performance.now(), sent = performance.now();
            const { frame } = await request({ type: 'frame', bitmap, timestamp, quality: 'balanced', hands: true }, [bitmap]);
            if (!frame) throw new Error('Missing real-photo inference frame.');
            const finitePoints = points => points.every(point => ['x', 'y', 'z'].every(axis => Number.isFinite(point[axis])));
            frames.push({ sequence: frame.sequence, timestamp: frame.timestamp, inferenceMs: frame.inferenceMs, roundTripMs: performance.now() - sent, samples: frame.samples,
              warm: index >= 3, allTasksFresh: ['face', 'pose', 'hands'].every(name => frame.samples[name].timestamp === timestamp),
              outputs: { faceMatrixValues: frame.faceMatrix?.length ?? 0, blendshapeCount: Object.keys(frame.face).length, posePoints: frame.pose.length, poseImagePoints: frame.poseImage.length,
                hands: frame.hands.map(hand => ({ points: hand.landmarks.length, worldPoints: hand.world.length, score: hand.score })),
                finite: (!frame.faceMatrix || frame.faceMatrix.every(Number.isFinite)) && finitePoints(frame.pose) && finitePoints(frame.poseImage) && frame.hands.every(hand => finitePoints(hand.landmarks) && finitePoints(hand.world)) } });
          }
          measurements.push({ variant: variant.id, originalSize: { width: image.width, height: image.height }, crop, inputSize: { width: canvas.width, height: canvas.height }, frames });
        }
        return { delegate, initializationMs, measurements, mediaRequests: window.__mediaRequests };
      } finally { worker.terminate(); for (const bitmap of bitmaps.values()) bitmap.close(); }
    }, { delegate, variants, workerPath, relativeTimestamp });
    const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; };
    result.summary = result.measurements.map(measurement => {
      const warm = measurement.frames.filter(frame => frame.warm && frame.allTasksFresh);
      return { variant: measurement.variant, warmFullFrames: warm.length, medianFullMs: median(warm.map(frame => frame.inferenceMs)), minFullMs: Math.min(...warm.map(frame => frame.inferenceMs)), maxFullMs: Math.max(...warm.map(frame => frame.inferenceMs)),
        medianTaskMs: Object.fromEntries(['face', 'pose', 'hands'].map(name => [name, median(warm.map(frame => frame.samples[name].inferenceMs))])),
        positiveWarmFrames: Object.fromEntries(['face', 'pose', 'hands'].map(name => [name, warm.filter(frame => frame.samples[name].present).length])),
        positiveAllWarmFrames: warm.filter(frame => ['face', 'pose', 'hands'].every(name => frame.samples[name].present)).length };
    });
    report.results.push(result);
    console.log(JSON.stringify({ delegate, initializationMs: result.initializationMs, summary: result.summary }));
    assert.equal(result.mediaRequests, 0);
    for (const measurement of result.measurements) for (const frame of measurement.frames) {
      assert(frame.outputs.finite && frame.inferenceMs > 0); if (frame.samples.face.present) assert.equal(frame.outputs.faceMatrixValues, 16);
      if (frame.samples.pose.present) assert.equal(frame.outputs.posePoints, 33);
      if (frame.samples.hands.present) assert(frame.outputs.hands.every(hand => hand.points === 21 && hand.worldPoints === 21));
    }
  }
  report.coverage = report.results.map(result => ({ delegate: result.delegate, ...Object.fromEntries(['face', 'pose', 'hands'].map(name => [name, result.summary.some(summary => summary.positiveWarmFrames[name] > 0)])), simultaneous: result.summary.some(summary => summary.positiveAllWarmFrames > 0) }));
  assert(report.coverage.every(coverage => coverage.face && coverage.pose && coverage.hands), 'Positive coverage is incomplete; record the missing task, do not infer landmark cost from negative detection.');
  assert.equal(report.externalRequests.length, 0); assert.equal(report.externalResponses.length, 0); assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) { report.errors.push(String(error)); report.passed = false; console.error(error); process.exitCode = 1; }
finally {
  try { await browser?.close(); report.browserClosed = !!browser; } catch (error) { report.errors.push(`Browser cleanup: ${error}`); process.exitCode = 1; }
  try { if (server) { report.serverExit = await server.stop(); report.serverStopped = true; } } catch (error) { report.errors.push(`Server cleanup: ${error}`); process.exitCode = 1; }
  await mkdir('ops/reports', { recursive: true }); await writeFile('ops/reports/tracking-positive-fixture.json', JSON.stringify(report, null, 2) + '\n');
}
