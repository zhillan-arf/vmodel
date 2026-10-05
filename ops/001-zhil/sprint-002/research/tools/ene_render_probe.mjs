import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { validateBytes } from 'gltf-validator';

const output = 'ops/001-zhil/sprint-002/research/ene-v2-local';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
await cp('src', `${output}/runtime/src`, { recursive: true, force: true });
const sourceFiles = ['src/viewer.ts', 'src/types.ts', 'src/composition.ts', 'src/lighting.ts', 'src/motion-solver.ts'];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, digest(await readFile(`${output}/runtime/${path}`))])));
const before = digest(await readFile('assets/avatars/ene.vrm'));
const originalValidation = await validateBytes(new Uint8Array(await readFile('assets/avatars/ene.vrm')), { maxIssues: 10000 });
const validation = await validateBytes(new Uint8Array(await readFile(`${output}/ene-packed.vrm`)), { maxIssues: 100 });
await writeFile(`${output}/packed-validation.json`, JSON.stringify(validation, null, 2) + '\n');
assert.equal(validation.issues.numErrors, 0);
const server = await createServer({ server: { host: '127.0.0.1', port: 0, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0] + 'tests/browser-host.html');
  await page.evaluate(async output => {
    const { AvatarViewer } = await import(`/${output}/runtime/src/viewer.ts`);
    const { defaults } = await import(`/${output}/runtime/src/types.ts`);
    document.body.style.cssText = 'margin:0;background:#162637;overflow:hidden';
    const container = document.createElement('div');
    container.style.cssText = 'position:relative;width:1600px;height:1000px';
    document.body.append(container);
    const viewer = new AvatarViewer(container, { ...defaults, framing: 'bust', springMotion: 'off' }, true);
    const stockLights = viewer.scene.children.filter(o => o.isLight).map(light => ({
      light, color: light.color.clone(), intensity: light.intensity, ground: light.groundColor?.clone(),
    }));
    let vrm;
    let loadedSprings;
    const vector = (x = 0, y = 0, z = 0) => viewer.camera.position.clone().set(x, y, z);
    const shapeNames = ['上', '下', '笑い', 'じと目', '優しい', 'ω', 'ぺろっ', '照れ'];
    async function load(kind) {
      let blob = await (await fetch(kind === 'original' ? '/avatars/ene.vrm' : `/${output}/ene-packed.vrm`)).blob();
      if (kind === 'styled') {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const oldLength = new DataView(bytes.buffer).getUint32(12, true);
        const document = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + oldLength)));
        for (const [index, material] of document.materials.entries()) {
          const toon = material.extensions.VRMC_materials_mtoon;
          if ([0, 1, 2, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 39].includes(index)) {
            toon.outlineWidthMode = 'worldCoordinates';
            toon.outlineWidthFactor = .00065;
            toon.outlineColorFactor = [.015, .045, .075];
            toon.outlineLightingMixFactor = .4;
          }
          toon.shadeColorFactor = [.48, .58, .72];
          toon.shadingToonyFactor = .92;
          toon.shadingShiftFactor = -.08;
        }
        const names = document.meshes[0].extras.targetNames;
        const node = document.nodes.findIndex(n => n.mesh === 0);
        for (const name of shapeNames) {
          document.extensions.VRMC_vrm.expressions.custom[`study_${name}`] = {
            isBinary: false, morphTargetBinds: [{ node, index: names.indexOf(name), weight: 1 }],
            overrideBlink: 'none', overrideMouth: 'none', overrideLookAt: 'none',
          };
        }
        const json = new TextEncoder().encode(JSON.stringify(document));
        const padded = Math.ceil(json.length / 4) * 4;
        const binary = bytes.slice(20 + oldLength);
        const result = new Uint8Array(20 + padded + binary.length);
        result.set(bytes.slice(0, 20));
        const header = new DataView(result.buffer);
        header.setUint32(8, result.length, true); header.setUint32(12, padded, true);
        result.fill(32, 20, 20 + padded); result.set(json, 20); result.set(binary, 20 + padded);
        blob = new Blob([result]);
      }
      const prepared = await viewer.prepareAvatar(blob);
      loadedSprings = prepared.vrm.springBoneManager?.joints.size;
      viewer.commitAvatar(prepared); vrm = viewer.vrm;
      vrm.humanoid.getNormalizedBoneNode('leftUpperArm').rotation.z = -1.1;
      vrm.humanoid.getNormalizedBoneNode('rightUpperArm').rotation.z = 1.1;
      viewer.draw(0);
    }
    function render(view = 'front', lighting = 'stock', expression = null) {
      for (const entry of stockLights) {
        entry.light.color.copy(entry.color); entry.light.intensity = entry.intensity;
        if (entry.ground) entry.light.groundColor.copy(entry.ground);
      }
      const [hemi, key, fill] = stockLights.map(x => x.light);
      if (lighting !== 'stock') {
        hemi.color.set(0xffffff); hemi.groundColor.set(0x7186a0); hemi.intensity = 1.15;
        key.color.set(0xfff6ed); key.intensity = 1.65;
        fill.color.set(0x63d9ff); fill.intensity = .45;
      }
      const head = vrm.humanoid.getRawBoneNode('head').getWorldPosition(vector());
      const target = head.clone().add(vector(0, .03, 0));
      viewer.camera.fov = 32;
      let offset = vector(0, 0, .95);
      if (view === 'side') offset = vector(.95, 0, .10);
      if (view === 'back') offset = vector(0, 0, -.95);
      if (view.startsWith('full')) {
        target.y = .8; offset = vector(view === 'full-side' ? 3.1 : 0, 0, view === 'full-side' ? .05 : 3.1);
      }
      viewer.camera.position.copy(target.clone().add(offset)); viewer.camera.lookAt(target);
      viewer.camera.aspect = 1.6; viewer.camera.updateProjectionMatrix();
      viewer.renderer.setSize(1600, 1000, false);
      viewer.renderer.domElement.style.width = '1600px';
      viewer.renderer.domElement.style.height = '1000px';
      viewer.scene.background.set(view === 'full-light' ? 0xdce5ef : 0x162637);
      vrm.expressionManager.resetValues();
      if (expression) for (const [name, value] of Object.entries(expression)) vrm.expressionManager.setValue(name, value);
      viewer.draw(0);
      return { view, lighting, expression, width: viewer.renderer.domElement.width,
        height: viewer.renderer.domElement.height, drawCalls: viewer.renderer.info.render.calls,
        triangles: viewer.renderer.info.render.triangles };
    }
    function inspect() {
      const expressions = [];
      for (const name of Object.keys(vrm.expressionManager.expressionMap)) {
        vrm.expressionManager.resetValues(); vrm.update(0);
        const neutral = [];
        vrm.scene.traverse(o => { if (o.morphTargetInfluences) neutral.push(...o.morphTargetInfluences); });
        vrm.expressionManager.setValue(name, 1); vrm.update(0);
        const active = [];
        vrm.scene.traverse(o => { if (o.morphTargetInfluences) active.push(...o.morphTargetInfluences); });
        expressions.push({ name, changedMorphWeights: active.filter((v, i) => Math.abs(v - neutral[i]) > 1e-5).length });
      }
      const gl = viewer.renderer.getContext(); const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return { expressions, loadedSpringJoints: loadedSprings,
        graphics: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    }
    window.eneProbe = { load, render, inspect, viewer };
  }, output);
  const renders = [], inventories = {};
  async function capture(name, view, lighting, expression) {
    const result = await page.evaluate(args => window.eneProbe.render(...args), [view, lighting, expression]);
    await page.locator('canvas').screenshot({ path: `${output}/${name}.png` });
    renders.push({ name, ...result });
  }
  for (const kind of ['original', 'packed', 'styled']) {
    await page.evaluate(kind => window.eneProbe.load(kind), kind);
    inventories[kind] = await page.evaluate(() => window.eneProbe.inspect());
    await capture(`ene-${kind}`, 'front', 'stock');
    if (kind === 'packed') {
      await capture('ene-lighting-only', 'front', 'cool');
      for (const view of ['side', 'back', 'full', 'full-light', 'full-side']) await capture(`ene-${view}`, view, 'stock');
      await capture('ene-current-happy', 'front', 'stock', { happy: 1 });
    }
    if (kind === 'styled') {
      await capture('ene-styled-cool', 'front', 'cool');
      await capture('ene-new-smile', 'front', 'cool', { happy: .7, 'study_笑い': .7, 'study_ω': .4 });
      await capture('ene-new-skeptical', 'front', 'cool', { 'study_じと目': .7, 'study_下': .35 });
      await capture('ene-new-brows', 'front', 'cool', { 'study_上': 1, aa: .3 });
      await capture('ene-blink', 'front', 'cool', { blink: 1 });
      await capture('ene-wink-mouth', 'front', 'cool', { blinkLeft: 1, aa: .7 });
    }
  }
  assert.deepEqual(inventories.original.expressions, inventories.packed.expressions);
  const active = inventories.original.expressions.filter(e => e.changedMorphWeights > 0);
  assert.equal(active.length, 11);
  assert(inventories.styled.expressions.filter(e => e.name.startsWith('study_')).every(e => e.changedMorphWeights > 0));
  const pixelsEqual = (await readFile(`${output}/ene-original.png`)).equals(await readFile(`${output}/ene-packed.png`));
  assert(pixelsEqual);
  assert.deepEqual(errors, []);
  assert.equal(digest(await readFile('assets/avatars/ene.vrm')), before);
  const sourceHashesAfter = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, digest(await readFile(`${output}/runtime/${path}`))])));
  const sourceUnchangedDuringTest = JSON.stringify(sourceHashesAfter) === JSON.stringify(sourceHashes);
  assert(sourceUnchangedDuringTest);
  const report = { date: '2026-10-05', modelSha256: before, modelUnchanged: true,
    sourceHashes, sourceUnchangedDuringTest,
    packedMatchesOriginalScreenshot: pixelsEqual, gltfErrors: validation.issues.numErrors,
    gltfWarnings: validation.issues.numWarnings, originalGltfWarnings: originalValidation.issues.numWarnings,
    originalGltfErrors: originalValidation.issues.numErrors, inventories, renders, errors,
    limits: 'Static views and expression bindings. No webcam, target GPU, or dynamic collision test.' };
  await writeFile(`${output}/render-probe.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ renders: renders.length, activeExpressions: active.length, pixelsEqual, errors }));
} finally {
  await browser?.close();
  await server.close();
}
