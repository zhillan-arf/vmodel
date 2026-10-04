import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const modelId=process.argv.includes('--ene')?'ene':'rei';
const terms=await readFile(modelId==='ene'?'ops/resources/ENE/Readmes/ReadMe_Tda_English.txt':'public/avatars/rei-notices/readme.txt');
const source = await readFile(`assets/avatars/${modelId}.vrm`);
const sourceHash = createHash('sha256').update(source).digest('hex');
const jsonLength = source.readUInt32LE(12);
const document = JSON.parse(source.subarray(20, 20 + jsonLength));
const binary = source.subarray(28 + jsonLength);
const decodedPixels = document.images.reduce((sum, image) => {
  const view = document.bufferViews[image.bufferView];
  const png = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  return sum + png.readUInt32BE(16) * png.readUInt32BE(20);
}, 0);
const sourceResources = { images: document.images.length, decodedPixels,
  estimatedTextureBytes: Math.ceil(decodedPixels * 4 * 4 / 3) };
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  const errors = [], externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') externalRequests.push(request.url());
  });
  await page.route('**/testing/model-terms',route=>route.fulfill({body:terms,contentType:'text/plain'}));
  await page.goto(`${server.resolvedUrls.local[0]}tests/browser-host.html`);
  const result = await page.evaluate(async modelId => {
    const { LocalModelRepository } = await import('/src/model-repository.ts');
    const { AvatarViewer } = await import('/src/viewer.ts');
    const { defaults } = await import('/src/types.ts');
    const { sha256 } = await import('/src/model-types.ts');
    const repository = new LocalModelRepository();
    const signal = new AbortController().signal;
    const blob = await (await fetch(`/avatars/${modelId}.vrm`)).blob();
    const started = performance.now();
    const inspection = await repository.inspect(blob, signal);
    const inspectionMs = performance.now() - started;
    const container = document.createElement('div');
    container.style.cssText = 'width:800px;height:720px;position:relative';
    document.body.append(container);
    const viewer = new AvatarViewer(container, { ...defaults, framing: 'body' });
    const prepareStart = performance.now();
    const prepared = await viewer.prepareAvatar(blob, signal);
    const preparationMs = performance.now() - prepareStart;
    const emptyBeforeCommit = viewer.vrm === null;
    viewer.commitAvatar(prepared);
    for (let i = 0; i < 120; i++) {
      prepared.retarget.update(null, defaults, 1 / 60, performance.timeOrigin + performance.now());
      viewer.draw(1 / 60);
    }
    viewer.vrm.scene.updateMatrixWorld(true);
    const handsBelowShoulders = ['left', 'right'].map(side => {
      const arm = viewer.vrm.humanoid.getNormalizedBoneNode(`${side}UpperArm`);
      const hand = viewer.vrm.humanoid.getNormalizedBoneNode(`${side}Hand`);
      return hand.matrixWorld.elements[13] < arm.matrixWorld.elements[13];
    });
    const expressionValues={};
    for(const name of ['happy','surprised','neutral']){
      prepared.retarget.setExpression(name);
      for(let i=0;i<120;i++)prepared.retarget.update(null,defaults,1/60,performance.timeOrigin+performance.now());
      expressionValues[name]={happy:viewer.vrm.expressionManager.getValue('happy'),surprised:viewer.vrm.expressionManager.getValue(prepared.capabilities.aliases.surprised??'surprised')};
    }
    viewer.draw(0);
    const graphicsResources={...viewer.renderer.info.memory};
    const active = viewer.vrm;
    let failedCandidateRejected = false;
    try { await viewer.prepareAvatar(new Blob(['invalid'])); } catch { failedCandidateRejected = true; }
    const previousModelRetained = viewer.vrm === active;
    const candidate = await viewer.prepareAvatar(blob, signal);
    viewer.cancelPendingLoad();
    let canceledCommitRejected = false;
    try { viewer.commitAvatar(candidate); } catch { canceledCommitRejected = true; }
    const canceledCandidateDisposed = candidate.disposed;
    const resolved = await repository.resolve(modelId, signal);
    const originalExportHash = await sha256(await repository.export(modelId));
    const terms = await (await fetch('/testing/model-terms')).blob();
    const termsHash = await sha256(terms);
    repository.close();
    window.reiViewer = viewer;
    return { hash: inspection.hash, bytes: blob.size, inspectionMs, preparationMs,
      resources: inspection.resources, graphicsResources, expressionValues, capabilities: prepared.capabilities,
      emptyBeforeCommit, handsBelowShoulders, failedCandidateRejected, previousModelRetained,
      canceledCommitRejected, canceledCandidateDisposed, resolvedHash: resolved.hash,
      originalExportHash, termsHash };
  },modelId);
  assert.equal(result.hash, sourceHash);
  assert.equal(result.resolvedHash, sourceHash);
  assert.equal(result.originalExportHash, sourceHash);
  for (const key of ['emptyBeforeCommit', 'failedCandidateRejected', 'previousModelRetained', 'canceledCommitRejected', 'canceledCandidateDisposed']) assert.equal(result[key], true, key);
  assert(result.handsBelowShoulders.every(Boolean));
  assert(result.expressionValues.happy.happy>.7);
  assert(result.expressionValues.surprised.surprised>.7);
  assert(result.expressionValues.neutral.happy<.001&&result.expressionValues.neutral.surprised<.001);
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  await mkdir('ops/reports/local', { recursive: true });
  await page.screenshot({ path: `ops/reports/local/${modelId}-library.png` });
  result.disposedResources=await page.evaluate(() => {window.reiViewer.dispose();return {...window.reiViewer.renderer.info.memory};});
  assert.equal(result.disposedResources.geometries,0);assert.equal(result.disposedResources.textures,0);
  const report = { generatedAt: new Date().toISOString(), browser: browser.version(), sourceHash,
    ...result, errors, externalRequests,
    platform: process.platform, browserChannel: process.env.VMODEL_BROWSER ?? 'chromium',
    limits: ['No physical camera test or human appearance review.', 'This single-model check does not measure memory across model changes.'] };
  await writeFile(`ops/reports/${modelId}-library-smoke.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const report = { generatedAt: new Date().toISOString(), browser: browser?.version(),
    status: 'failed', sourceHash, bytes: source.length, sourceResources,
    error: String(error), limits: { decodedPixels: 201326592, combinedBytes: 1073741824 },
    consequence: 'The model check failed. Later checks did not run.' };
  await writeFile(`ops/reports/${modelId}-library-smoke.json`, JSON.stringify(report, null, 2) + '\n');
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
}
